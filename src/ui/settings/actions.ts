/**
 * Реестр действий кнопок (PRD 5.6): можно ли показывать кнопку и что она
 * делает. Кнопка без действия в схему не попадает (З8) — генератор сверяется
 * с `READY_ACTIONS`. Без `obsidian` и DOM: окна и уведомления приходят швом.
 * Снятые действия — PRD 10.12, В-28, В-29. `open-hotkey` действием реестра
 * не станет: кнопка живёт в блоке и зовёт `custom/hotkeys.ts` напрямую.
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
  AUTOSAVE_FOLDER,
  backupPath,
  buildBackupNote,
  describeBackup,
  keepDeviceLocal,
  mergeParts,
  parseBackupHotkeys,
  parseBackupNote,
  summaryPieces,
} from "../../features/settings_backup.js";
/* Адрес полного рассказа о выпусках: один дом на окно и на кнопку панели. */
import releaseNotes from "../../features/release_notes.js";

/**
 * Действия с работающим методом. Список читает `build/gen_schema.js`;
 * совпадение списков закреплено проверкой.
 */
export const READY_ACTIONS: readonly ActionId[] = [
  "open-howto",
  "open-changelog",
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
  /** Что изменится, построчно (Н3). */
  rows?: readonly string[];
  /** Строка под списком: чего действие НЕ трогает. */
  note?: string;
  /**
   * Галочка в окне (2026-09-06, конфликты хоткеев): положение приходит обратным
   * вызовом, чтобы ответ остался «да или нет» у всех окон.
   */
  check?: { label: string; sub?: string; checked: boolean };
  onCheck?: (checked: boolean) => void;
}

/** Vault для руководства: проверить, создать, открыть. Швом — без Obsidian. */
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
  /** Третья строка: имя файла — различает две копии одной минуты (Б6). */
  note?: string;
}

export interface PickRequest {
  title: string;
  body: string;
  options: readonly PickOption[];
}

/** Окно на одну кнопку: сказать и закрыться (просьба 2026-09-06, после восстановления). */
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

/** Хранилище для восстановления: замена через `store.update` проходит миграцию (CS10, Б14). */
export interface ConfigSeam {
  get: () => Record<string, unknown>;
  replace: (config: Record<string, unknown>) => Promise<boolean> | boolean;
}

/**
 * Хоткеи команд плагина: живут в `hotkeys.json` Obsidian, доступ — служебным
 * API, поэтому швом. Только свои команды — ограничение в `obsidian_tab.ts`,
 * закреплено проверкой.
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
  /** Все хоткеи vault, включая чужие, для объёма `all`. Нет — объём сужается до своих. */
  readAll?: () => Record<string, unknown[]>;
  /** Чужие команды с теми же клавишами — имена для галочки «снять конфликтующие». */
  conflicts?: (map: Record<string, unknown[]>) => readonly HotkeyConflict[];
  /** Привести хоткеи к копии: назначить недостающее, снять лишнее. Возвращает число затронутых команд. */
  write: (map: Record<string, unknown[]>, opts?: HotkeyWriteOptions) => Promise<number> | number;
}

/** Окно у `Save a backup` (2026-09-06): всё выбрано по максимуму, `Enter` сразу — как без окна. */
export interface BackupOptionsRequest {
  title: string;
  /** Объяснение — подсказкой у заголовка, не абзацем (Ст12). */
  tip: string;
  /** Части копии галочками. */
  parts: readonly { id: string; label: string; checked: boolean }[];
  /** Заголовок над галочками. */
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
  /** Тумблер `Show tips` (`general.help.showTips`) — общий с панелью. */
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
  /** Открыть адрес снаружи (кнопка `Changelog`). Шов — в прогоне окна браузера нет. Нет шва — говорим и в журнал. */
  openExternal?: (url: string) => void;
  /**
   * Руководство на выбранном языке (10.13.51, В-73). Шов: `.obsidian/**` не
   * индексируется, `vault` до перевода не достаёт (10.13.26 Ф5). Нет шва — английское.
   */
  guide?: () => Promise<{ text: string; lang: string; name: string }>;
  /** Подтверждение. Окна нет — ответ «отказ». */
  confirm?: (o: ConfirmRequest) => Promise<boolean>;
  /** Нужен копиям настроек: без него обе кнопки говорят, что не умеют. */
  config?: ConfigSeam;
  /** Окно выбора копии. Нет окна — восстановление не идёт, как и без `confirm`. */
  pick?: (o: PickRequest) => Promise<string | null>;
  /** Версия плагина: попадает в заметку, чтобы было видно, чем снято. */
  pluginVersion?: string;
  /** Хоткеи. Без шва копия пишется без них. */
  hotkeys?: HotkeySeam;
  /**
   * Пересобрать всё, что плагин строит из конфига. Нужно восстановлению:
   * команды PKM строятся из `cfg` при загрузке, и хоткей из копии иначе
   * приезжает на команду, которой в Obsidian ещё нет (2026-09-06).
   */
  rebuildFromConfig?: () => Promise<void> | void;
  /** Окно на одну кнопку. Без него — всплывающее сообщение. */
  announce?: (o: AnnounceRequest) => Promise<void>;
  /** Окно состава копии. Без него — всё целиком, хоткеи свои, без комментария. */
  askBackupOptions?: (o: BackupOptionsRequest) => Promise<BackupOptions | null>;
  /** Видимый текст по ключу каталога (10.13.46). Без него — английский из таблицы. */
  t?: Resolve;
}

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

/* Тексты — в `texts_dialogs.ts` (10.13.46); здесь только помощники. */

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

  /** Текст окна по имени: ключ и английское идут через одну функцию (У-82). */
  const say = (name: string): string => {
    const english = TEXT_BY_NAME[name] || "";
    return typeof deps.t === "function" ? deps.t(dialogKey(name), english) : english;
  };

  /** Счёт словами: формы единственного и множественного лежат в каталоге порознь. */
  const count = (n: number, one: string, many: string): string =>
    String(n) + " " + say(n === 1 ? one : many);

  /**
   * Состав копии одной строкой для человека; в заметке та же строка остаётся
   * английской (формат файла). Считает обе `summarize`.
   */
  const summaryFor = (cfg: Record<string, unknown>, partIds?: readonly string[] | null): string => {
    /* Только то, что копия несёт (D11): какие части — решает `summaryPieces`. */
    const words: Record<string, [string, string]> = {
      field: ["WORD_FIELD_ONE", "WORD_FIELD_MANY"],
      value: ["WORD_VALUE_ONE", "WORD_VALUE_MANY"],
      binder: ["WORD_BINDER_ROW_ONE", "WORD_BINDER_ROW_MANY"],
    };
    const said = (summaryPieces(cfg, partIds || null) as Array<{ n: number; kind: string }>)
      .map(p => count(p.n, (words[p.kind] as [string, string])[0], (words[p.kind] as [string, string])[1]));
    if (said.length === 3) return fill(say("SUMMARY_LINE"), said[0] as string, said[1] as string, said[2] as string);
    if (said.length === 2) return fill(say("SUMMARY_TWO"), said[0] as string, said[1] as string);
    return said[0] || "";
  };

  /** Подписи вкладок по ключу вкладки из каталога (У-32); id частей и вкладок совпадают — пин `PARTS` (10.13.41). */
  const partLabel = (id: string, english: string): string =>
    typeof deps.t === "function" ? deps.t(tabKey(id, "label"), english) : english;

  /** Подписи частей, которые в копии есть и которых нет — одним обходом `PARTS` (У-32). */
  const partLabelsFor = (ids: readonly string[], inside: boolean): string[] =>
    PARTS.filter((p: { id: string }) => (ids.indexOf(p.id) >= 0) === inside)
      .map((p: { id: string; label: string }) => partLabel(p.id, p.label));

  const partLabelsSaid = (ids: readonly string[]): string[] => partLabelsFor(ids, true);

  /**
   * Сменит ли запись хоткеев копии что-нибудь в vault. При `own` снимает и свои
   * вне копии; чужие не трогает. Прочесть нечем — «не знаю».
   */
  const hotkeysDiffer = (fromBackup: Record<string, unknown[]>, scope: string): boolean => {
    const seam = deps.hotkeys;
    if (!seam || typeof seam.read !== "function") return false;
    let own: Record<string, unknown[]> = {};
    let now: Record<string, unknown[]> = {};
    try {
      own = seam.read() || {};
      now = scope === "all" && typeof seam.readAll === "function" ? seam.readAll() || {} : own;
    } catch (_) {
      /* Прочесть клавиши не вышло — ответ «не знаю», запись идёт как шла. */
      return false;
    }
    const ids = new Set([...Object.keys(fromBackup), ...Object.keys(own)]);
    for (const id of ids) {
      if (JSON.stringify(now[id] || []) !== JSON.stringify(fromBackup[id] || [])) return true;
    }
    return false;
  };

  /**
   * Записать копию нынешних настроек, вернуть путь. Зовут сохранение,
   * восстановление и сброс (Б12). `auto` — постфикс `Autogenerated` в имени (C56).
   * Существующий файл не перезаписывается никогда (Б6).
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
    /* Хоткеи читаются здесь: `buildBackupNote` собирается без Obsidian. */
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
      /* Копия, снятая плагином, всегда полная: это путь назад. */
      parts: auto === true ? allPartIds() : (picked ? picked.parts : allPartIds()),
      hotkeyScope: scope,
      comment: picked ? picked.comment : "",
    })));
    return path;
  };

  /** Показывать ли подсказки (`general.help.showTips`); умолчание — в схеме. */
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

  /**
   * Спросить состав копии. Окна нет — всё целиком, хоткеи свои.
   * `null` — молчаливый отказ; пустой набор частей — ошибка, о ней говорим.
   */
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

  /** Строки окна выбора: дата и версия из шапки, состав из настроек (Б9). Нечитаемый файл остаётся в списке. */
  const listBackups = async (vault: VaultSeam, folder: string): Promise<PickOption[]> => {
    /* Автокопии лежат подпапкой `autosave` — окно выбора видит обе. */
    const found: BackupFile[] = [];
    if (typeof vault.list === "function") {
      for (const dir of [folder, folder + "/" + AUTOSAVE_FOLDER]) {
        found.push(...((await Promise.resolve(vault.list(dir))) || []));
      }
    }
    const notes = found
      .filter(f => f && typeof f.path === "string" && /\.md$/i.test(f.path))
      .sort((a, b) => (Number(b.mtime) || 0) - (Number(a.mtime) || 0)
        || String(b.path).localeCompare(String(a.path)));

    /* По дате в шапке, а не по времени файла: перенос копии меняет время (BUGHUNT
       2026-09-30, D12). Без даты — время файла. */
    const ranked: Array<{ option: PickOption; at: number }> = [];
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
      /* Имя файла — только если первой строкой дата, иначе оно уже там. */
      const note = about.savedAt ? name : "";
      const at = about.savedAt ? Date.parse(about.savedAt.replace(" ", "T")) : NaN;
      ranked.push({ option: { value: file.path, label: about.savedAt || name, sub, note }, at: Number.isFinite(at) ? at : Number(file.mtime) || 0 });
    }
    const options = ranked.sort((a, b) => b.at - a.at).map(r => r.option);

    /* Пункт `Before the update to this version` снят (2026-09-04); голый JSON `data.backup.v1.json` по-прежнему разбирается (Б13). */
    return options;
  };

  /** Состав копии одной строкой для подтверждения: показывается то, что уйдёт (Н3). */
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
    /** Ссылка на changelog (2026-09-19); адрес — из модуля окна «что изменилось». */
    "open-changelog": async () => {
      const open = deps.openExternal;
      if (typeof open !== "function") {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: открыть адрес нечем — шва openExternal нет");
        return;
      }
      open(releaseNotes.CHANGELOG_URL);
    },
    /** Руководство создаётся один раз и дальше только открывается: заметка принадлежит человеку. */
    "open-howto": async () => {
      const vault = deps.vault;
      if (!vault) {
        notify(say("NO_METHOD"));
        console.error("inline-overhaul: руководство открывать нечем — нет доступа к vault");
        return;
      }
      try {
        /* Старое имя (переименование 2026-09-06) открывается, а не создаётся вторая заметка рядом. */
        /*
         * Своя заметка на каждый язык (10.13.51): заметка не перезаписывается (Р-1),
         * и при одном имени перевод молча отдал бы старую английскую.
         */
        const guide = deps.guide
          ? await deps.guide()
          : { text: howtoMarkdown(), lang: "en", name: "English" };
        const target = guideNotePath(HOWTO_PATH, guide.lang, guide.name);

        const had = await Promise.resolve(vault.exists(target));
        /* Прежнее имя — только у английской: переводов тогда не было. */
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

    /** Копия настроек — заметка vault (Б1). Без вопроса: каждое нажатие пишет новый файл (Б6). */
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
     * Сброс до умолчаний (2026-09-04). Порядок: подтверждение — копия текущего —
     * запись; копия пишется всегда. Пустой конфиг проходит миграцию (CS10) и
     * становится умолчаниями — второго объявления умолчаний нет (У-32).
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
          /* Версия формы обязательна: без неё `migrateConfig` видит переезд с версии 1
             и уносит `viewState` в `_unmigrated` (BUGHUNT 2026-09-30, D7). */
          config.replace(keepDeviceLocal(before, { schemaVersion: before["schemaVersion"] }) as Record<string, unknown>),
        );

        /* Пустая карта — шов снимет все свои хоткеи, не тронув чужих. */
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
     * (Б9–Б15). Нет окна выбора или подтверждения — действие не идёт.
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
        /* Разбор до вопроса; чтение одно — три разбора по одному тексту, второе
           чтение могло бы отдать переписанный файл. */
        const text = await Promise.resolve(vault.read(picked));
        const restored = parseBackupNote(text);
        const about = describeBackup(text);
        const hotkeys = parseBackupHotkeys(text);
        const hotkeyCount = Object.keys(hotkeys).length;
        const scope = about.hotkeyScope === "all" ? "all" : "own";

        /* Список: что вернётся и что останется — выборочная копия меняет смысл (Н3). */
        const holds = summaryFor(restored, about.parts);
        const rows = holds ? [fill(say("ROW_RESTORING"), holds)] : [];
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

        /* Конфликты — галочкой, по умолчанию выключенной (2026-09-06); список чужих команд — до вопроса. */
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
        /* Нет конфликтов — тоже строкой: пустое место читается как «функции нет». */
        if (hotkeyCount && !conflicts.length) {
          rows.push(say(scope === "all" ? "CONFLICT_SCOPE_ALL" : "CONFLICT_NONE"));
        }
        /* Хоткеев в копии нет — сказать: копии до 2026-09-04 их не несут. */
        if (!hotkeyCount) rows.push(say("HOTKEYS_NONE_HERE"));
        /* Папка копий не восстанавливается (`DEVICE_LOCAL_LEAVES`); строка — только когда в копии другой путь. */
        if (backupFolder(restored) !== folder) rows.push(said(say("FOLDER_KEPT"), folder));
        let clearConflicts = false;

        const willBackUp = backupBeforeRestore(config.get());
        const partial = !!about.parts && partLabelsFor(about.parts, false).length > 0;
        const yes = await ask({
          title: say("RESTORE_TITLE"),
          /* Выборочная копия меняет не всё — и вопрос говорит это (D10). */
          body: say(partial
            ? (willBackUp ? "RESTORE_BODY_PARTS" : "RESTORE_BODY_PARTS_NO_BACKUP")
            : (willBackUp ? "RESTORE_BODY" : "RESTORE_BODY_NO_BACKUP")),
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

        /* Копия перед записью — тумблер (C56); `RESTORE_BODY` собирается по тому же значению. */
        /* Копия перед восстановлением держит то, что восстановление тронет, в т.ч. чужие хоткеи (H3.2). */
        if (willBackUp) {
          await writeBackup(vault, config, true,
            scope === "all" ? { parts: allPartIds(), comment: "", hotkeyScope: "all" } : undefined);
        }
        /* Неотмеченная вкладка не меняется (2026-09-06); копия без частей — заменой целиком (Б10). */
        const changed = await Promise.resolve(
          config.replace(mergeParts(config.get(), restored, about.parts) as Record<string, unknown>),
        );

        /*
         * Команды — до хоткеев: команды PKM строятся из только что сменившегося
         * конфига, иначе хоткей не виден в `Hotkeys` до перезапуска. Неудача
         * восстановления не отменяет.
         */
        if (typeof deps.rebuildFromConfig === "function") {
          try {
            await Promise.resolve(deps.rebuildFromConfig());
          } catch (e) {
            console.error("inline-overhaul: после восстановления не пересобралось то, что строится из конфига", e);
          }
        }

        /* Хоткеи — после настроек; их неудача восстановления не отменяет. */
        let saidHotkeys = "";
        let hotkeysChanged = false;
        if (hotkeyCount) {
          if (deps.hotkeys && typeof deps.hotkeys.write === "function") {
            try {
              hotkeysChanged = hotkeysDiffer(hotkeys, scope);
              const n = await Promise.resolve(deps.hotkeys.write(hotkeys, { scope, clearConflicts }));
              saidHotkeys = ". " + count(Number(n) || 0, "WORD_HOTKEY_ONE", "WORD_HOTKEY_MANY")
                + " " + say(scope === "all" ? "HOTKEYS_DONE_VAULT" : "HOTKEYS_DONE");
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

        /* Окно — и при совпадении копии с нынешним (2026-09-06). Окна нет — только сообщение. */
        if (typeof deps.announce === "function") {
          try {
            await deps.announce({
              title: say("RESTORED_TITLE"),
              /* Копия совпала — перезапуск не нужен (`В-267`, BUGHUNT D20). */
              body: say(changed ? "RESTORED_BODY" : (hotkeysChanged ? "RESTORED_HOTKEYS_BODY" : "RESTORED_SAME_BODY")),
              rows,
              ...(changed ? { note: say("RESTORED_NOTE") } : {}),
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

/** Тексты наружу для пина; живут в `texts_dialogs.ts` (10.13.46), имя оставлено для вызывающих. */
export { ACTION_TEXTS } from "./texts_dialogs.ts";
