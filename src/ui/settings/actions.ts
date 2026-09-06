/**
 * Реестр действий кнопок (PRD 5.6).
 *
 * Кнопка в схеме называет действие именем, а что оно делает — решается здесь.
 * Реестр отвечает на два вопроса сразу: **можно ли показывать кнопку** и
 * **что произойдёт при нажатии**. Первое важнее: кнопка, за которой нет
 * действия, в панель не попадает вовсе (З8) — генератор схемы отбрасывает её
 * запись, сверяясь со списком `READY_ACTIONS` ниже.
 *
 * Здесь нет ни `obsidian`, ни DOM: окно подтверждения и уведомление приходят
 * швом, как и всё остальное платформенное. Поэтому реестр проверяется без
 * Obsidian, а окно подтверждения — настоящее.
 *
 * Четыре действия — конфиг-заметки и пересборки служебного файла — сняты
 * 2026-09-03 вместе с самой заметкой (PRD 10.12, В-28 и В-29).
 *
 * Из оставшихся четырёх в реестре три. Единственное исключение:
 *
 *   * `open-hotkey` — действием реестра так и не стал, и не станет.
 *     Справочник команд сделан 2026-08-31, но кнопка хоткея живёт **внутри**
 *     своего блока и зовёт `custom/hotkeys.ts` напрямую — как и колонка
 *     хоткея в Binder. Действие реестра нужно кнопке схемы, а такой кнопки у
 *     хоткея нет: у каждой строки таблицы своя. Запись останется в списке
 *     `ActionId`, пока её не уберут вместе с разбором `types.ts`.
 */

import type { ActionId } from "./types.ts";
import { HOWTO_LEGACY_PATH, HOWTO_PATH, howtoMarkdown } from "./howto.ts";
import { guideNotePath } from "./guide_files.ts";
import { TEXT_BY_NAME, dialogKey, fill } from "./texts_dialogs.ts";
import { tabKey, type Resolve } from "./texts.ts";
import {
  PARTS,
  allPartIds,
  backupBeforeRestore,
  backupFolder,
  backupPath,
  buildBackupNote,
  describeBackup,
  keepDeviceLocal,
  mergeParts,
  parseBackupHotkeys,
  parseBackupNote,
  summarize,
} from "../../features/settings_backup.js";

/**
 * Действия, за которыми есть работающий метод плагина. Список читает и
 * генератор схемы (`build/gen_schema.js`): кнопки с действием не из него в
 * схему не попадают. Совпадение двух списков закреплено проверкой — разойтись
 * они не должны, иначе в панели появится кнопка без действия.
 */
export const READY_ACTIONS: readonly ActionId[] = [
  "open-howto",
  "save-backup",
  "restore-backup",
  "reset-settings",
];

export interface ConfirmRequest {
  title: string;
  body: string;
  /** Подпись кнопки согласия: она же говорит, что именно произойдёт. */
  confirmLabel: string;
  /** Действие уносит данные: кнопка согласия красная. */
  danger?: true;
  /**
   * Что именно изменится, построчно. Сброс группы обязан это показывать
   * (Н3): двадцать две настройки Visual одним нажатием без списка — это
   * потеря работы, о которой человек узнаёт после.
   */
  rows?: readonly string[];
  /** Строка под списком: чего действие НЕ трогает. */
  note?: string;
  /**
   * Галочка в окне: решение внутри решения (ответ заказчика 2026-09-06 про
   * конфликты хоткеев). Сам ответ остаётся «да или нет», а положение галочки
   * приходит обратным вызовом: так не меняется форма ответа у всех прочих
   * окон, которых галочка не касается.
   */
  check?: { label: string; sub?: string; checked: boolean };
  onCheck?: (checked: boolean) => void;
}

/**
 * Vault в том виде, в каком его нужно руководству: проверить, создать,
 * открыть. Приходит швом — реестр обязан собираться и проверяться без
 * Obsidian, а `app.vault` это Obsidian.
 */
export interface VaultSeam {
  exists: (path: string) => Promise<boolean> | boolean;
  create: (path: string, text: string) => Promise<void> | void;
  open: (path: string) => Promise<void> | void;
  /** Текст заметки или файла. Нужен восстановлению (10.13.2). */
  read?: (path: string) => Promise<string> | string;
  /** Папка под копии: создаётся при первом сохранении, не раньше (Б2). */
  ensureFolder?: (path: string) => Promise<void> | void;
  /** Что лежит в папке копий. Время правки — чтобы новые шли сверху (Б9). */
  list?: (folder: string) => Promise<BackupFile[]> | BackupFile[];
}

/** Файл в папке копий: путь и время правки, если платформа его знает. */
export interface BackupFile {
  path: string;
  mtime?: number;
}

/** Строка окна выбора копии. */
export interface PickOption {
  /** Значение, которое вернётся выбором: путь файла. */
  value: string;
  /** Первая строка: когда снята копия. */
  label: string;
  /** Вторая строка: состав и версия плагина. */
  sub?: string;
  /**
   * Третья строка: имя файла. Две копии одной минуты по дате и составу не
   * различить — у заказчика в окне стояли ровно такие две, — а имя файла
   * различает их всегда: сохранение никогда не пишет поверх (Б6).
   */
  note?: string;
}

export interface PickRequest {
  title: string;
  body: string;
  options: readonly PickOption[];
}

/**
 * Окно на одну кнопку: сказать и закрыться, выбора в нём нет.
 *
 * Заведено под просьбу заказчика 2026-09-06: «хочу, чтобы после восстановления
 * бэкапа возникало окно с уведомлением с рекомендацией перезапустить
 * Obsidian». Всплывающее сообщение это уже говорило, но оно уезжает за
 * несколько секунд, а восстановление — редкое действие, после которого человек
 * идёт проверять хоткеи и не понимает, почему их часть на месте не сразу.
 */
export interface AnnounceRequest {
  title: string;
  body: string;
  /** Что именно вернулось, построчно. */
  rows?: readonly string[];
  /** Строка под списком: что делать дальше. */
  note?: string;
  /** Подпись единственной кнопки. */
  closeLabel: string;
}

/**
 * Хранилище в том виде, в каком его нужно восстановлению: прочитать всё и
 * заменить всё. Замена идёт через `store.update` и потому проходит миграцию
 * (CS10, Б14) — второй точки записи в конфиг нет.
 */
export interface ConfigSeam {
  get: () => Record<string, unknown>;
  replace: (config: Record<string, unknown>) => Promise<boolean> | boolean;
}

/**
 * Хоткеи команд плагина. Швом, потому что живут они не в настройках плагина, а
 * в `hotkeys.json` Obsidian, и добраться до них можно только его служебным
 * API — реестр действий обязан собираться и проверяться без Obsidian.
 *
 * **Только свои команды.** И чтение, и запись ограничены идентификаторами
 * плагина: восстановление копии не имеет права тронуть хоткей другого плагина
 * или самого Obsidian. Ограничение стоит в реализации шва
 * (`obsidian_tab.ts`), а не здесь, — и закреплено проверкой.
 */
export interface HotkeyConflict {
  /** Идентификатор чужой команды. */
  id: string;
  /** Её имя так, как его видит человек на экране `Hotkeys`. */
  name: string;
  /** Клавиши словами: `Ctrl + Alt + 1`. */
  hotkey: string;
}

export interface HotkeyWriteOptions {
  /** `own` — только свои команды (умолчание), `all` — все хоткеи vault. */
  scope?: "own" | "all";
  /** Снять клавиши у чужих команд, которые мешают восстанавливаемым. */
  clearConflicts?: boolean;
}

export interface HotkeySeam {
  /** Что назначено сейчас у команд плагина: идентификатор → список привязок. */
  read: () => Record<string, unknown[]>;
  /**
   * Все хоткеи vault, включая чужие. Нужен объёму `all` в окне сохранения
   * (заказ заказчика 2026-09-06). Нет его — объём молча сужается до своих.
   */
  readAll?: () => Record<string, unknown[]>;
  /**
   * Чужие команды, у которых те же клавиши, что в переданной карте. Список
   * нужен окну: галочка «снять конфликтующие» без имён была бы просьбой
   * согласиться вслепую.
   */
  conflicts?: (map: Record<string, unknown[]>) => readonly HotkeyConflict[];
  /**
   * Привести хоткеи к тому, что в копии: назначить, чего нет,
   * и снять то, чего в копии не было. Возвращает, сколько команд затронуто.
   */
  write: (map: Record<string, unknown[]>, opts?: HotkeyWriteOptions) => Promise<number> | number;
}

/**
 * Окно у `Save a backup` (заказ заказчика 2026-09-06).
 *
 * Всё, что в нём есть, уже выбрано по-максимуму: человек может только
 * дописать комментарий и снять лишнее. Нажать `Enter` сразу — то же самое,
 * что было до окна.
 */
export interface BackupOptionsRequest {
  title: string;
  /**
   * Длинное объяснение — подсказкой у заголовка, а не абзацем под ним (Ст12,
   * замечание заказчика 2026-09-06). До этого оно стояло текстом и читалось
   * как условие, которое надо выполнить, прежде чем нажимать.
   */
  tip: string;
  /** Части копии галочками. */
  parts: readonly { id: string; label: string; checked: boolean }[];
  /**
   * Заголовок над галочками. Без него было непонятно, к чему они относятся:
   * «сейчас непонятно к чему относятся чекбоксы» (замечание заказчика).
   */
  partsLabel: string;
  partsTip: string;
  /** Необязательное поле комментария. */
  commentLabel: string;
  commentHint: string;
  /** Список объёма хоткеев. */
  hotkeyLabel: string;
  hotkeyTip: string;
  hotkeyOptions: readonly { value: string; label: string }[];
  hotkeyDefault: string;
  confirmLabel: string;
  /**
   * Тумблер `Show tips` (`general.help.showTips`). Подсказки окна подчиняются
   * ему наравне с подсказками панели: заказчик просил об этом прямо.
   */
  showTips: boolean;
}

export interface BackupOptions {
  parts: readonly string[];
  comment: string;
  hotkeyScope: string;
}

export interface ActionDeps {
  notify: (message: string) => void;
  /** Нужен только руководству; без него кнопка `Open the guide` не работает. */
  vault?: VaultSeam;
  /**
   * Руководство на выбранном языке (10.13.51, ответ на В-73).
   *
   * Шов, а не чтение по месту: перевод лежит в папке плагина, а `.obsidian/**`
   * Obsidian не индексирует, и `vault` до него не достаёт (10.13.26 Ф5). Нет
   * шва — руководство английское из кода, и это работа механизма, а не отказ.
   */
  guide?: () => Promise<{ text: string; lang: string; name: string }>;
  /**
   * Спросить подтверждение. Без него разрушительное действие не идёт: если
   * окна нет (проверка, заглушка), ответом считается отказ, а не согласие.
   */
  confirm?: (o: ConfirmRequest) => Promise<boolean>;
  /** Нужен копиям настроек: без него обе кнопки говорят, что не умеют. */
  config?: ConfigSeam;
  /** Окно выбора копии. Нет окна — восстановление не идёт, как и без `confirm`. */
  pick?: (o: PickRequest) => Promise<string | null>;
  /** Версия плагина: попадает в заметку, чтобы было видно, чем снято. */
  pluginVersion?: string;
  /**
   * Хоткеи. Без шва копия обходится: настройки сохранятся и восстановятся, а
   * про хоткеи заметка просто ничего не скажет.
   */
  hotkeys?: HotkeySeam;
  /**
   * Заново собрать всё, что плагин строит из конфига.
   *
   * Нужно ровно одному месту — восстановлению копии (замечание заказчика
   * 2026-09-06: «часть хоткеев не восстанавливается сразу, а появляется только
   * при перезапуске vault»). Причина не в хоткеях: **команды PKM строятся из
   * конфига** (`buildPkmCommandDefs` берёт `cfg`), и каждый Field заводит свою
   * пару. Заводятся они один раз, при загрузке плагина. Копия приносит другой
   * набор Field — и хоткей приезжает на команду, которой в Obsidian ещё нет:
   * в справочнике команд он виден (справочник читает `hotkeys.json` и конфиг),
   * а на экране `Hotkeys` самого Obsidian нет, потому что тот показывает
   * только зарегистрированные команды.
   *
   * Шов, а не прямой вызов: реестр действий обязан собираться без Obsidian.
   */
  rebuildFromConfig?: () => Promise<void> | void;
  /**
   * Окно на одну кнопку. Без него действие обходится всплывающим сообщением,
   * как обходилось до 2026-09-06.
   */
  announce?: (o: AnnounceRequest) => Promise<void>;
  /**
   * Окно выбора состава копии. Без него сохранение идёт как шло: всё
   * целиком, хоткеи только свои, без комментария.
   */
  askBackupOptions?: (o: BackupOptionsRequest) => Promise<BackupOptions | null>;
  /**
   * Видимый текст по ключу каталога (10.13.46). Без него окна говорят
   * английским из таблицы — ровно так, как говорили до перевода.
   */
  t?: Resolve;
}

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

/*
 * Сами тексты уехали в `texts_dialogs.ts` (10.13.46): они видимы, значит у
 * них есть ключ каталога и они переводятся вместе с панелью. Здесь остались
 * только помощники, которые их собирают.
 */

function said(message: string, path: string): string {
  return path ? message + ": " + path : message;
}

/** Текст ошибки так, как его можно показать человеку. */
function messageOf(e: unknown): string {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

export function buildActions(deps: ActionDeps): Partial<Record<ActionId, () => Promise<void>>> {
  const { notify } = deps;

  /**
   * Текст окна по имени. Ключ строит `dialogKey`, английское — таблица; оба
   * конца зовут одну функцию, и разойтись им не на чем (У-82).
   */
  const say = (name: string): string => {
    const english = TEXT_BY_NAME[name] || "";
    return typeof deps.t === "function" ? deps.t(dialogKey(name), english) : english;
  };

  /**
   * Счёт словами. Множественное число не собирается из единственного ни в
   * одном языке, кроме английского, поэтому обе формы лежат в каталоге
   * порознь, а выбирает между ними это место.
   */
  const count = (n: number, one: string, many: string): string =>
    String(n) + " " + say(n === 1 ? one : many);

  /**
   * Состав копии одной строкой: «3 Fields, 12 Values and 2 Binder rows».
   *
   * Своя, а не общая с заметкой копии: в заметке эта строка — часть формата
   * файла и обязана остаться английской, а здесь её читает человек. Считает
   * при этом одна функция — `summarize`, — и разойтись двум строкам не на чем.
   */
  const summaryFor = (cfg: Record<string, unknown>): string => {
    const s = summarize(cfg) as { fields: number; values: number; binderRows: number };
    return fill(
      say("SUMMARY_LINE"),
      count(s.fields, "WORD_FIELD_ONE", "WORD_FIELD_MANY"),
      count(s.values, "WORD_VALUE_ONE", "WORD_VALUE_MANY"),
      count(s.binderRows, "WORD_BINDER_ROW_ONE", "WORD_BINDER_ROW_MANY"),
    );
  };

  /**
   * Подписи вкладок для галочек состава копии и для списка «что вернётся».
   *
   * Берутся из каталога **по ключу вкладки**, а не из своего списка: та же
   * `General`, что стоит в полосе вкладок, и второго её объявления в продукте
   * быть не должно (У-32). Идентификаторы частей копии и вкладок совпадают —
   * это закреплено пином `PARTS` (10.13.41).
   */
  const partLabel = (id: string, english: string): string =>
    typeof deps.t === "function" ? deps.t(tabKey(id, "label"), english) : english;

  /**
   * Подписи частей, которые в копии есть, и тех, которых в ней нет.
   *
   * Одним местом, а не двумя: список `PARTS` один, и «взять из него по
   * признаку» — тоже одно правило. Два обхода одного списка расходятся молча
   * (У-32).
   */
  const partLabelsFor = (ids: readonly string[], inside: boolean): string[] =>
    PARTS.filter((p: { id: string }) => (ids.indexOf(p.id) >= 0) === inside)
      .map((p: { id: string; label: string }) => partLabel(p.id, p.label));

  const partLabelsSaid = (ids: readonly string[]): string[] => partLabelsFor(ids, true);

  /**
   * Записать копию нынешних настроек и вернуть путь. Зовётся и кнопкой
   * `Save a backup`, и восстановлением, и сбросом — оба снимают копию перед
   * записью (Б12), тем же способом и в ту же папку.
   *
   * `auto` отличает копию, которую человек не заказывал: у неё в имени стоит
   * постфикс `Autogenerated`, чтобы в списке `Restore a backup` она читалась
   * сразу (замечание заказчика C56, 2026-09-04).
   *
   * Существующий файл не перезаписывается **никогда** (Б6): совпало имя —
   * рядом появится второй, а не поверх первого.
   */
  const writeBackup = async (
    vault: VaultSeam,
    config: ConfigSeam,
    auto?: true,
    picked?: BackupOptions,
  ): Promise<string> => {
    const cfg = config.get();
    const folder = backupFolder(cfg);
    if (typeof vault.ensureFolder === "function") await Promise.resolve(vault.ensureFolder(folder));
    const base = backupPath(folder, new Date(), auto);
    let path = base;
    for (let n = 2; await Promise.resolve(vault.exists(path)); n++) {
      path = base.replace(/\.md$/, "") + " (" + n + ").md";
    }
    /*
     * Хоткеи читаются здесь, а не в самом `buildBackupNote`: тот обязан
     * собираться без Obsidian, и знать о служебном API ему нечего.
     */
    const scope = picked ? String(picked.hotkeyScope || "own") : "own";
    let hotkeys: Record<string, unknown[]> | undefined;
    if (scope !== "none" && deps.hotkeys) {
      /* `all` без чтения всего vault молча сужается до своих, а не падает. */
      const reader = scope === "all" && typeof deps.hotkeys.readAll === "function"
        ? deps.hotkeys.readAll
        : deps.hotkeys.read;
      if (typeof reader === "function") {
        try {
          hotkeys = reader();
        } catch (e) {
          /* Не прочитались — копия настроек всё равно пишется: она главное. */
          console.error("inline-overhaul: хоткеи для копии не прочитались", e);
        }
      }
    }
    await Promise.resolve(vault.create(path, buildBackupNote({
      config: cfg,
      pluginVersion: deps.pluginVersion,
      savedAt: new Date(),
      hotkeys,
      /*
       * Снятая самим плагином копия — путь назад, а не выбор человека:
       * она всегда полная. Сузить её значило бы обещать возврат, которого нет.
       */
      parts: auto === true ? allPartIds() : (picked ? picked.parts : allPartIds()),
      hotkeyScope: auto === true ? "own" : scope,
      comment: picked ? picked.comment : "",
    })));
    return path;
  };

  /**
   * Спросить состав копии. Окна нет — сохранение идёт как шло до 2026-09-06:
   * всё целиком, хоткеи только свои, без комментария.
   *
   * Отказ (`null`) — это отказ: ничего не пишется и ничего не говорится.
   * Пустой набор частей — не отказ, а ошибка человека, и о ней надо сказать.
   */
  /**
   * Показывать ли подсказки. Тот же тумблер, что и у панели
   * (`general.help.showTips`), и читается он там же, где живёт: в конфиге.
   * Своего умолчания здесь нет — умолчание одно, и оно в схеме.
   */
  const tipsShown = (): boolean => {
    if (!deps.config) return true;
    try {
      const cfg = deps.config.get() as Record<string, unknown>;
      const general = cfg && typeof cfg.general === "object" ? cfg.general as Record<string, unknown> : null;
      const help = general && typeof general.help === "object" ? general.help as Record<string, unknown> : null;
      return help ? help.showTips !== false : true;
    } catch (e) {
      console.error("inline-overhaul: тумблер подсказок не прочитался", e);
      return true;
    }
  };

  const askParts = async (): Promise<BackupOptions | null | undefined> => {
    if (typeof deps.askBackupOptions !== "function") return undefined;
    const hotkeyOptions = [
      { value: "own", label: say("SAVE_HOTKEYS_OWN") },
      { value: "all", label: say("SAVE_HOTKEYS_ALL") },
      { value: "none", label: say("SAVE_HOTKEYS_NONE") },
    ];
    return await deps.askBackupOptions({
      title: say("SAVE_TITLE"),
      tip: say("SAVE_TIP"),
      /* По умолчанию отмечено всё: человек только снимает лишнее. */
      parts: PARTS.map((part: { id: string; label: string }) =>
        ({ id: part.id, label: partLabel(part.id, part.label), checked: true })),
      partsLabel: say("SAVE_PARTS_LABEL"),
      partsTip: say("SAVE_PARTS_TIP"),
      commentLabel: say("SAVE_COMMENT_LABEL"),
      commentHint: say("SAVE_COMMENT_HINT"),
      hotkeyLabel: say("SAVE_HOTKEYS_LABEL"),
      hotkeyTip: say("SAVE_HOTKEYS_TIP"),
      hotkeyOptions,
      hotkeyDefault: "own",
      confirmLabel: say("SAVE_CONFIRM"),
      showTips: tipsShown(),
    });
  };

  /**
   * Что показать в окне выбора. Каждая копия читается: дата и версия лежат в
   * шапке, состав — в самих настройках (Б9). Нечитаемый файл из списка не
   * выбрасывается — человек видит имя и решает сам.
   */
  const listBackups = async (vault: VaultSeam, folder: string): Promise<PickOption[]> => {
    const found: BackupFile[] = typeof vault.list === "function"
      ? (await Promise.resolve(vault.list(folder))) || []
      : [];
    const notes = found
      .filter(f => f && typeof f.path === "string" && /\.md$/i.test(f.path))
      .sort((a, b) => (Number(b.mtime) || 0) - (Number(a.mtime) || 0)
        || String(b.path).localeCompare(String(a.path)));

    const options: PickOption[] = [];
    for (const file of notes) {
      let about: ReturnType<typeof describeBackup> = {
        savedAt: "", pluginVersion: "", summary: "", hotkeys: 0,
        parts: null, hotkeyScope: "own", comment: "",
      };
      try {
        if (typeof vault.read === "function") {
          about = describeBackup(await Promise.resolve(vault.read(file.path)));
        }
      } catch (e) {
        console.error("inline-overhaul: копия не прочиталась: " + file.path, e);
      }
      const name = String(file.path).split("/").pop() || file.path;
      const sub = [
        /* Комментарий человека — первым: его он и ищет в списке. */
        about.comment,
        about.summary,
        about.parts && about.parts.length < PARTS.length
          ? partLabelsSaid(about.parts).join(", ")
          : "",
        about.hotkeys ? count(about.hotkeys, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY") : "",
        about.pluginVersion ? fill(say("PLUGIN_VERSION"), about.pluginVersion) : "",
      ].filter(Boolean).join(" · ");
      /* Имя файла показывается, только если первой строкой стоит дата: иначе
         оно там уже и стоит, и повторять его незачем. */
      const note = about.savedAt ? name : "";
      options.push({ value: file.path, label: about.savedAt || name, sub, note });
    }

    /*
     * Пункта `Before the update to this version` здесь больше нет — снят
     * решением заказчика 2026-09-04. Он показывал `data.backup.v1.json`,
     * файл, который переезд с версии 1 оставил в папке плагина, и в окне
     * читался как случайная строка без даты и состава. Сам файл никуда не
     * делся, и голый JSON по-прежнему разбирается тем же кодом (Б13), — просто
     * кнопка его больше не предлагает.
     */
    return options;
  };

  /**
   * Всё, что копия про себя знает, — одной строкой для окна подтверждения.
   * Показывать нужно именно то, что **уйдёт**, а не то, что придёт: сброс
   * забирает работу, и человек должен видеть её объём до нажатия (Н3).
   */
  const goingAway = (cfg: Record<string, unknown>): readonly string[] => {
    const rows = [fill(say("ROW_DELETING"), summaryFor(cfg))];
    if (deps.hotkeys && typeof deps.hotkeys.read === "function") {
      let n = 0;
      try {
        n = Object.keys(deps.hotkeys.read() || {}).length;
      } catch (e) {
        console.error("inline-overhaul: хоткеи для сброса не прочитались", e);
      }
      if (n) {
        rows.push(fill(say("ROW_DELETING_HOTKEYS"), count(n, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY")));
      }
    }
    return rows;
  };

  return {
    /**
     * Руководство создаётся **один раз** и дальше только открывается: заметка
     * принадлежит человеку, он в ней пишет, и перезаписать её значило бы
     * стереть его пометки. Это же сказано в последней строке самой заметки.
     */
    "open-howto": async () => {
      const vault = deps.vault;
      if (!vault) {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: руководство открывать нечем — нет доступа к vault");
        return;
      }
      try {
        /*
         * Заметка переименована вместе с плагином (2026-09-06), и у того, кто
         * уже её завёл, лежит старая — со своими пометками. Открывается она, а не
         * создаётся вторая рядом: две заметки с одним содержанием и разными
         * пометками — худшее из состояний.
         */
        /*
         * Язык руководства (10.13.51). У каждого — своя заметка: заметка
         * принадлежит человеку и не перезаписывается (Р-1), поэтому при одном
         * имени на все языки тот, у кого уже лежит английская, после перевода
         * получил бы её же — молча. Создать вторую не значит тронуть первую.
         */
        const guide = deps.guide
          ? await deps.guide()
          : { text: howtoMarkdown(), lang: "en", name: "English" };
        const target = guideNotePath(HOWTO_PATH, guide.lang, guide.name);

        const had = await Promise.resolve(vault.exists(target));
        /* Прежнее имя ищется только у английской заметки: переводов под старым
           именем быть не могло — механизма тогда не было. */
        const legacy = had || guide.lang !== "en"
          ? false
          : await Promise.resolve(vault.exists(HOWTO_LEGACY_PATH));
        const path = legacy ? HOWTO_LEGACY_PATH : target;
        if (!had && !legacy) await Promise.resolve(vault.create(target, guide.text));
        await Promise.resolve(vault.open(path));
        notify(said(say(had || legacy ? "GUIDE_OPENED" : "GUIDE_MADE"), path));
      } catch (e) {
        const message = e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
        notify(message);
        console.error("inline-overhaul: руководство не открылось", e);
      }
    },

    /**
     * Копия настроек — обычная заметка vault (Б1). Ничего не спрашивает:
     * сохранение ничего не портит, а каждое нажатие пишет новый файл (Б6).
     */
    "save-backup": async () => {
      const vault = deps.vault;
      const config = deps.config;
      if (!vault || !config) {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: копию настроек снимать нечем — нет доступа к vault или конфигу");
        return;
      }
      try {
        const picked = await askParts();
        if (picked === null) return;
        if (picked && (!Array.isArray(picked.parts) || !picked.parts.length)) {
          notify(say("SAVE_NOTHING"));
          return;
        }
        notify(said(say("BACKUP_SAVED"), await writeBackup(vault, config, undefined, picked || undefined)));
      } catch (e) {
        notify(messageOf(e));
        console.error("inline-overhaul: копия настроек не записалась", e);
      }
    },

    /**
     * Сброс до умолчаний. Заводился под проверку копий (замечание заказчика
     * 2026-09-04): чтобы убедиться, что копия и вправду возвращает всё, нужно
     * сперва честно всё потерять.
     *
     * Порядок тот же, что у восстановления, и по той же причине: подтверждение
     * — копия текущего — запись. Копия пишется **всегда**, даже если человек
     * уверен: это единственный путь назад, и стоит он одну заметку.
     *
     * Умолчания не собираются здесь заново. Пустой конфиг проходит миграцию на
     * записи (CS10) и выходит из неё полным конфигом по умолчанию — ровно тем,
     * что видит человек после установки. Второго объявления умолчаний в
     * продукте нет и быть не должно (У-32).
     */
    "reset-settings": async () => {
      const vault = deps.vault;
      const config = deps.config;
      const ask = deps.confirm;
      if (!vault || !config) {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: сбрасывать нечем — нет доступа к vault или конфигу");
        return;
      }
      if (typeof ask !== "function") {
        console.error("inline-overhaul: сброс без окна подтверждения не идёт");
        return;
      }
      try {
        const before = config.get();
        const yes = await ask({
          title: say("RESET_TITLE"),
          body: say("RESET_BODY"),
          confirmLabel: say("RESET_CONFIRM"),
          danger: true,
          rows: goingAway(before),
          note: say("RESET_NOTE"),
        });
        if (!yes) return;

        const saved = await writeBackup(vault, config, true);
        const changed = await Promise.resolve(
          config.replace(keepDeviceLocal(before, {}) as Record<string, unknown>),
        );

        /*
         * Хоткеи своих команд снимаются тем же швом: пустая карта означает
         * «своего не назначено», и шов снимет всё своё, не тронув чужого.
         * Иначе сброс оставил бы половину состояния и проверка копии врала бы.
         */
        let saidHotkeys = "";
        if (deps.hotkeys && typeof deps.hotkeys.write === "function") {
          try {
            const n = await Promise.resolve(deps.hotkeys.write({}));
            if (n) {
              saidHotkeys = ". " + count(Number(n) || 0, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY")
                + " " + say("HOTKEYS_CLEARED");
            }
          } catch (e) {
            console.error("inline-overhaul: хоткеи при сбросе не снялись", e);
          }
        }
        notify((changed ? say("RESET_DONE") : say("RESET_NOTHING"))
          + saidHotkeys + ". " + say("SAVED_AS") + ": " + saved);
      } catch (e) {
        notify(messageOf(e));
        console.error("inline-overhaul: сброс не выполнился", e);
      }
    },

    /**
     * Восстановление: список — выбор — подтверждение — копия текущего — запись
     * (Б9–Б15). Порядок обязателен, и каждый шаг умеет отказаться: нет окна
     * выбора или подтверждения — действие не идёт вовсе, как и применение
     * конфиг-заметки.
     */
    "restore-backup": async () => {
      const vault = deps.vault;
      const config = deps.config;
      const ask = deps.confirm;
      const choose = deps.pick;
      if (!vault || !config) {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: восстанавливать нечем — нет доступа к vault или конфигу");
        return;
      }
      if (typeof choose !== "function" || typeof ask !== "function") {
        console.error("inline-overhaul: восстановление без окна выбора и подтверждения не идёт");
        return;
      }
      const folder = backupFolder(config.get());
      try {
        const options = await listBackups(vault, folder);
        if (!options.length) {
          notify(said(say("BACKUP_NONE"), folder));
          return;
        }
        const picked = await choose({ title: say("PICK_TITLE"), body: say("PICK_BODY"), options });
        if (!picked) return;

        if (typeof vault.read !== "function") {
          notify(say("NO_METHOD"));
          console.error("inline-overhaul: копию читать нечем");
          return;
        }
        /* Разбор идёт до вопроса: спрашивать про заметку, которую не прочесть, незачем.
           Читается она один раз: три разбора идут по одному и тому же тексту, и
           второе чтение отдало бы другой файл, успей его кто-то переписать. */
        const text = await Promise.resolve(vault.read(picked));
        const restored = parseBackupNote(text);
        const about = describeBackup(text);
        const hotkeys = parseBackupHotkeys(text);
        const hotkeyCount = Object.keys(hotkeys).length;
        const scope = about.hotkeyScope === "all" ? "all" : "own";

        /*
         * Список говорит две вещи, а не одну: что вернётся и что останется.
         * Второе важнее первого: выборочная копия меняет смысл действия,
         * и человек должен увидеть это до нажатия, а не после (Н3).
         */
        const rows = [fill(say("ROW_RESTORING"), summaryFor(restored))];
        if (about.parts) {
          rows.push(fill(say("ROW_PARTS_BACK"), partLabelsSaid(about.parts).join(", ")));
          const kept = partLabelsFor(about.parts, false);
          if (kept.length) rows.push(fill(say("ROW_PARTS_KEPT"), kept.join(", ")));
        }
        if (hotkeyCount) {
          rows.push(fill(
            say(scope === "all" ? "ROW_HOTKEYS_VAULT" : "ROW_HOTKEYS_OWN"),
            count(hotkeyCount, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY"),
          ));
        }
        if (scope === "all") rows.push(say("HOTKEYS_ALL_WARNING"));

        /*
         * Конфликты — галочкой, и по умолчанию выключенной (ответ заказчика
         * 2026-09-06). Список чужих команд считается **до** вопроса: соглашаться
         * вслепую на то, что трогает чужой плагин, — единственный шаг, который
         * человек потом не сможет объяснить себе сам.
         */
        let conflicts: readonly HotkeyConflict[] = [];
        if (hotkeyCount && deps.hotkeys && typeof deps.hotkeys.conflicts === "function") {
          try {
            conflicts = deps.hotkeys.conflicts(hotkeys) || [];
          } catch (e) {
            console.error("inline-overhaul: конфликты хоткеев не посчитались", e);
          }
        }
        for (const clash of conflicts) {
          rows.push(fill(say("CONFLICT_HELD"), clash.name, clash.hotkey));
        }
        /*
         * И когда конфликтов нет — тоже строкой. Пустое место в окне человек
         * читает как «функции нет», а не как «посмотрели и чисто».
         */
        if (hotkeyCount && !conflicts.length) {
          rows.push(say(scope === "all" ? "CONFLICT_SCOPE_ALL" : "CONFLICT_NONE"));
        }
        /*
         * Хоткеев в копии нет — сказать и это. Копии до 2026-09-04 их не
         * несут вовсе, и человек, пришедший проверять именно хоткеи, читал
         * пустое место как «функция не работает».
         */
        if (!hotkeyCount) rows.push(say("HOTKEYS_NONE_HERE"));
        /*
         * Папка копий не восстанавливается (`DEVICE_LOCAL_LEAVES`): это адрес
         * в этом vault, а не настройка. Говорится это только тогда, когда в
         * копии лежит другой путь, — иначе строка была бы шумом.
         */
        if (backupFolder(restored) !== folder) rows.push(said(say("FOLDER_KEPT"), folder));
        let clearConflicts = false;

        const willBackUp = backupBeforeRestore(config.get());
        const yes = await ask({
          title: say("RESTORE_TITLE"),
          body: say(willBackUp ? "RESTORE_BODY" : "RESTORE_BODY_NO_BACKUP"),
          confirmLabel: say("RESTORE_CONFIRM"),
          danger: true,
          rows,
          ...(conflicts.length
            ? { check: { label: say("CONFLICT_LABEL"), sub: say("CONFLICT_SUB"), checked: false } }
            : {}),
          onCheck: (checked: boolean) => { clearConflicts = checked; },
          note: say(hotkeyCount && scope !== "all" ? "RESTORE_NOTE_OTHERS" : "RESTORE_NOTE"),
        });
        if (!yes) return;

        /*
         * Копия перед записью — тумблер, а не правило (замечание заказчика
         * C56). Умолчание прежнее: восстановление затирает всё, и путь назад
         * по умолчанию есть. Выключен — пишем сразу, и вопрос об этом уже
         * сказал (`RESTORE_BODY` собирается по тому же значению).
         */
        if (willBackUp) await writeBackup(vault, config, true);
        /*
         * Неотмеченная вкладка остаётся такой, какая сейчас (решение
         * заказчика 2026-09-06). Копия, снятая до галочек, частей не называет,
         * и восстанавливается заменой целиком, как и раньше (Б10).
         */
        const changed = await Promise.resolve(
          config.replace(mergeParts(config.get(), restored, about.parts) as Record<string, unknown>),
        );

        /*
         * Команды — до хоткеев. Набор команд PKM строится из конфига, конфиг
         * только что сменился, и хоткей из копии обязан приехать на команду,
         * которая в Obsidian уже есть: иначе на экране `Hotkeys` его не видно
         * до перезапуска (замечание заказчика 2026-09-06). Неудача здесь
         * восстановления не отменяет — настройки уже записаны.
         */
        if (typeof deps.rebuildFromConfig === "function") {
          try {
            await Promise.resolve(deps.rebuildFromConfig());
          } catch (e) {
            console.error("inline-overhaul: после восстановления не пересобралось то, что строится из конфига", e);
          }
        }

        /*
         * Хоткеи — после настроек, и их неудача не отменяет восстановления:
         * настройки уже на месте, и молчать об этом было бы хуже.
         */
        let saidHotkeys = "";
        if (hotkeyCount) {
          if (deps.hotkeys && typeof deps.hotkeys.write === "function") {
            try {
              const n = await Promise.resolve(deps.hotkeys.write(hotkeys, { scope, clearConflicts }));
              saidHotkeys = ". " + count(Number(n) || 0, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY")
                + " " + say("HOTKEYS_DONE");
              if (clearConflicts && conflicts.length) {
                saidHotkeys += ", " + count(conflicts.length, "WORD_KEY_ONE", "WORD_KEY_MANY")
                  + " " + say("CONFLICT_CLEARED");
              }
            } catch (e) {
              saidHotkeys = ". " + say("HOTKEYS_NO_METHOD");
              console.error("inline-overhaul: хоткеи не вернулись", e);
            }
          } else {
            saidHotkeys = ". " + say("HOTKEYS_NO_METHOD");
            console.error("inline-overhaul: хоткеи в копии есть, а шва для их записи нет");
          }
        }
        notify(say(changed ? "RESTORE_DONE" : "RESTORE_SAME") + saidHotkeys);

        /*
         * И окно — оно живёт до нажатия, а всплывающее сообщение уезжает
         * (просьба заказчика 2026-09-06). Показывается и тогда, когда копия
         * совпала с нынешним: человек нажал `Restore` и вправе узнать, чем
         * это кончилось. Окна нет — остаётся только сообщение, как было.
         */
        if (typeof deps.announce === "function") {
          try {
            await deps.announce({
              title: say("RESTORED_TITLE"),
              body: say("RESTORED_BODY"),
              rows,
              note: say("RESTORED_NOTE"),
              closeLabel: say("RESTORED_CLOSE"),
            });
          } catch (e) {
            console.error("inline-overhaul: окно после восстановления не открылось", e);
          }
        }
      } catch (e) {
        notify(messageOf(e));
        console.error("inline-overhaul: восстановление не выполнилось", e);
      }
    },
  };
}

/**
 * Тексты наружу: их проверяет пин, а не сверка строк с самими собой.
 *
 * Живут они в `texts_dialogs.ts` (10.13.46): текст видим, значит у него
 * есть ключ каталога. Здесь имя оставлено ради тех, кто его уже зовёт.
 */
export { ACTION_TEXTS } from "./texts_dialogs.ts";
