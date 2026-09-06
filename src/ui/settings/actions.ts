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
import { HOWTO_PATH, howtoMarkdown } from "./howto.ts";
import {
  backupBeforeRestore,
  backupFolder,
  backupPath,
  buildBackupNote,
  describeBackup,
  keepDeviceLocal,
  parseBackupHotkeys,
  parseBackupNote,
  plural,
  summaryLine,
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
export interface HotkeySeam {
  /** Что назначено сейчас: идентификатор команды → список привязок. */
  read: () => Record<string, unknown[]>;
  /**
   * Привести хоткеи своих команд к тому, что в копии: назначить, чего нет,
   * и снять то, чего в копии не было. Возвращает, сколько команд затронуто.
   */
  write: (map: Record<string, unknown[]>) => Promise<number> | number;
}

export interface ActionDeps {
  notify: (message: string) => void;
  /** Нужен только руководству; без него кнопка `Open the guide` не работает. */
  vault?: VaultSeam;
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
}

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

const GUIDE_MADE = "Guide written and opened";
const GUIDE_OPENED = "Guide opened";
const BACKUP_SAVED = "Settings saved";
const BACKUP_NONE = "No backups found in";
const RESTORE_TITLE = "Restore these settings";
const RESTORE_BODY =
  "This replaces everything you have set up, on every tab. What you have now is saved as a backup first";
/**
 * Тот же вопрос, когда копия перед записью выключена (C56). Обещать копию,
 * которой не будет, нельзя: вопрос о разрушительном действии — единственное
 * место, где человек ещё может остановиться.
 */
const RESTORE_BODY_NO_BACKUP =
  "This replaces everything you have set up, on every tab, and what you have now is not saved anywhere first";
const RESTORE_CONFIRM = "Replace my settings";
const RESTORE_DONE =
  "Settings restored. Restart Obsidian so every part of the plugin picks them up";
/** Хоткеи вернулись — сказать отдельно: их человек ищет не там, где настройки. */
const HOTKEYS_DONE = "hotkeys back on the plugin commands";
/** В копии хоткеи есть, а вернуть их этой сборкой нечем. */
const HOTKEYS_NO_METHOD = "The hotkeys in that backup could not be put back";

/* ---- сброс до умолчаний ------------------------------------------------ */

const RESET_TITLE = "Delete all your settings";
const RESET_BODY =
  "Everything you have set up in this plugin goes, on every tab, and the plugin starts as if it had just been installed. What you have now is saved as a backup first";
const RESET_CONFIRM = "Delete my settings";
const RESET_DONE =
  "Settings deleted and back to defaults. Restart Obsidian so every part of the plugin picks them up";
const RESET_NOTHING = "Your settings are already at their defaults";
const RESTORE_SAME = "That backup matches what you already have";
const PICK_TITLE = "Restore a backup";
const PICK_BODY = "Newest first";
/** Метода нет — говорим об этом, а не молчим. */
const NO_METHOD = "This build cannot do that yet";

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
  const writeBackup = async (vault: VaultSeam, config: ConfigSeam, auto?: true): Promise<string> => {
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
    let hotkeys: Record<string, unknown[]> | undefined;
    if (deps.hotkeys && typeof deps.hotkeys.read === "function") {
      try {
        hotkeys = deps.hotkeys.read();
      } catch (e) {
        /* Не прочитались — копия настроек всё равно пишется: она главное. */
        console.error("inline-overhaul: хоткеи для копии не прочитались", e);
      }
    }
    await Promise.resolve(vault.create(path, buildBackupNote({
      config: cfg,
      pluginVersion: deps.pluginVersion,
      savedAt: new Date(),
      hotkeys,
    })));
    return path;
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
      let about = { savedAt: "", pluginVersion: "", summary: "", hotkeys: 0 };
      try {
        if (typeof vault.read === "function") {
          about = describeBackup(await Promise.resolve(vault.read(file.path)));
        }
      } catch (e) {
        console.error("inline-overhaul: копия не прочиталась: " + file.path, e);
      }
      const name = String(file.path).split("/").pop() || file.path;
      const sub = [
        about.summary,
        about.hotkeys ? plural(about.hotkeys, "hotkey", "hotkeys") : "",
        about.pluginVersion ? "plugin " + about.pluginVersion : "",
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
    const rows = ["Deleting " + summaryLine(cfg)];
    if (deps.hotkeys && typeof deps.hotkeys.read === "function") {
      let count = 0;
      try {
        count = Object.keys(deps.hotkeys.read() || {}).length;
      } catch (e) {
        console.error("inline-overhaul: хоткеи для сброса не прочитались", e);
      }
      if (count) {
        rows.push("And " + plural(count, "hotkey", "hotkeys") + " you assigned to plugin commands");
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
        notify(NO_METHOD);
        console.error("inline-overhaul: руководство открывать нечем — нет доступа к vault");
        return;
      }
      try {
        const had = await Promise.resolve(vault.exists(HOWTO_PATH));
        if (!had) await Promise.resolve(vault.create(HOWTO_PATH, howtoMarkdown()));
        await Promise.resolve(vault.open(HOWTO_PATH));
        notify(said(had ? GUIDE_OPENED : GUIDE_MADE, HOWTO_PATH));
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
        notify(NO_METHOD);
        console.error("inline-overhaul: копию настроек снимать нечем — нет доступа к vault или конфигу");
        return;
      }
      try {
        notify(said(BACKUP_SAVED, await writeBackup(vault, config)));
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
        notify(NO_METHOD);
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
          title: RESET_TITLE,
          body: RESET_BODY,
          confirmLabel: RESET_CONFIRM,
          danger: true,
          rows: goingAway(before),
          note: "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin",
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
            if (n) saidHotkeys = ". " + plural(Number(n) || 0, "hotkey", "hotkeys") + " cleared";
          } catch (e) {
            console.error("inline-overhaul: хоткеи при сбросе не снялись", e);
          }
        }
        notify((changed ? RESET_DONE : RESET_NOTHING) + saidHotkeys + ". Backup: " + saved);
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
        notify(NO_METHOD);
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
          notify(said(BACKUP_NONE, folder));
          return;
        }
        const picked = await choose({ title: PICK_TITLE, body: PICK_BODY, options });
        if (!picked) return;

        if (typeof vault.read !== "function") {
          notify(NO_METHOD);
          console.error("inline-overhaul: копию читать нечем");
          return;
        }
        /* Разбор идёт до вопроса: спрашивать про заметку, которую не прочесть, незачем. */
        const restored = parseBackupNote(await Promise.resolve(vault.read(picked)));

        const hotkeys = parseBackupHotkeys(await Promise.resolve(vault.read(picked)));
        const hotkeyCount = Object.keys(hotkeys).length;
        const rows = ["Restoring " + summaryLine(restored)];
        if (hotkeyCount) {
          rows.push("And " + plural(hotkeyCount, "hotkey", "hotkeys") + " on the plugin commands");
        }

        const willBackUp = backupBeforeRestore(config.get());
        const yes = await ask({
          title: RESTORE_TITLE,
          body: willBackUp ? RESTORE_BODY : RESTORE_BODY_NO_BACKUP,
          confirmLabel: RESTORE_CONFIRM,
          danger: true,
          rows,
          note: hotkeyCount
            ? "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin"
            : "Your open tab and what you have expanded here stay as they are",
        });
        if (!yes) return;

        /*
         * Копия перед записью — тумблер, а не правило (замечание заказчика
         * C56). Умолчание прежнее: восстановление затирает всё, и путь назад
         * по умолчанию есть. Выключен — пишем сразу, и вопрос об этом уже
         * сказал (`RESTORE_BODY` собирается по тому же значению).
         */
        if (willBackUp) await writeBackup(vault, config, true);
        const changed = await Promise.resolve(
          config.replace(keepDeviceLocal(config.get(), restored) as Record<string, unknown>),
        );

        /*
         * Хоткеи — после настроек, и их неудача не отменяет восстановления:
         * настройки уже на месте, и молчать об этом было бы хуже.
         */
        let saidHotkeys = "";
        if (hotkeyCount) {
          if (deps.hotkeys && typeof deps.hotkeys.write === "function") {
            try {
              const n = await Promise.resolve(deps.hotkeys.write(hotkeys));
              saidHotkeys = ". " + plural(Number(n) || 0, "hotkey", "hotkeys") + " " + HOTKEYS_DONE;
            } catch (e) {
              saidHotkeys = ". " + HOTKEYS_NO_METHOD;
              console.error("inline-overhaul: хоткеи не вернулись", e);
            }
          } else {
            saidHotkeys = ". " + HOTKEYS_NO_METHOD;
            console.error("inline-overhaul: хоткеи в копии есть, а шва для их записи нет");
          }
        }
        notify(changed ? RESTORE_DONE + saidHotkeys : RESTORE_SAME + saidHotkeys);
      } catch (e) {
        notify(messageOf(e));
        console.error("inline-overhaul: восстановление не выполнилось", e);
      }
    },
  };
}

/** Тексты наружу: их проверяет пин, а не сверка строк с самими собой. */
export const ACTION_TEXTS = {
  GUIDE_MADE,
  GUIDE_OPENED,
  NO_METHOD,
  BACKUP_SAVED,
  BACKUP_NONE,
  RESTORE_TITLE,
  RESTORE_BODY,
  RESTORE_BODY_NO_BACKUP,
  RESTORE_CONFIRM,
  RESTORE_DONE,
  RESTORE_SAME,
  PICK_TITLE,
  PICK_BODY,
  HOTKEYS_DONE,
  HOTKEYS_NO_METHOD,
  RESET_TITLE,
  RESET_BODY,
  RESET_CONFIRM,
  RESET_DONE,
  RESET_NOTHING,
} as const;
