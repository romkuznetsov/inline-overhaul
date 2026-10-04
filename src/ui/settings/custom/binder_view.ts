/**
 * Вёрстка Binder (PRD 10.4, фаза 3c). Ни платформы, ни записи — только
 * обратные вызовы, чтобы рисовать на заглушке DOM (гейт Г16).
 *
 *   * колонки `Command ID` нет (Б2);
 *   * системная строка не удаляется и описание не правится (Б5):
 *     `normalizeBinderRows` переписывает его на каждом патче (З8);
 *   * сетка таблицы — в CSS (Б4).
 */

import { el, btn, segmented, textInput, tipBelow, paintNeeded, type El, type ElInput } from "./dom.ts";
import { attachPicker, pickName, PICK_ALL } from "./char_picker.ts";
import { attachRowDrag, type DragHold } from "./row_drag.ts";
import type { BinderClash, BinderDraft, BinderRow } from "./binder_model.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/* ---- тексты ------------------------------------------------------------ */

/* Тексты в каталоге (Приложение B, 10.4; 10.13.47); имена здесь — то же слово, не второе объявление (У-32). */
const T = BLOCK_TEXTS["binder-table"];

export const HEAD = ["", T.COL_INSERTS, T.COL_COMMAND_NAME, T.COL_DESCRIPTION, T.COL_HOTKEY, ""] as const;
export const ADD_COMMAND = T.ADD_COMMAND;
export const HOTKEY_NONE = T.HOTKEY_NOT_SET;
export { HOTKEY_TITLE } from "./hotkeys.ts";
/** Имя команды в списке хоткеев начинается с этого — в таблице оно лишнее. */
export const LABEL_PREFIX = T.COMMAND_PREFIX.replace("{0}", "");

/* Окно «завести строку»: у прототипа на этом месте заглушка, тексты — по разделу 7. */

/** Как блок спрашивает свой текст. Нет ctx — ответом идёт английское. */
export type Say = (name: string, ...args: readonly (string | number)[]) => string;
const PLAIN: Say = sayIn("binder-table", {});
/* Раскрытые настройки строк Command переживают перерисовку таблицы, но не перезапуск: по умолчанию свёрнуты. */
const openPresets = new Set<string>();

/** Как назвать строку в подписях: тем же, чем её называет список хоткеев. */
export function rowTitle(row: BinderRow): string {
  const short = row.commandLabel.startsWith(LABEL_PREFIX)
    ? row.commandLabel.slice(LABEL_PREFIX.length)
    : row.commandLabel;
  return short.trim() || row.commandName.trim() || row.insertText.trim() || row.category.trim() || T.ROW_ARIA;
}

/* ---- таблица ------------------------------------------------------------ */

export interface BinderViewOpts {
  rows: readonly BinderRow[];
  /** Назначенный хоткей строки или пусто. */
  hotkeyOf: (row: BinderRow) => string;
  /** Пусто — приватного API нет, и кнопка хоткея неактивна (К-2). */
  openHotkey: ((row: BinderRow) => void) | null;
  onDescription: (row: BinderRow, text: string) => void;
  onRemove: (row: BinderRow) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
  /** Видимый текст по имени из каталога (10.13.47). */
  say?: Say;
  /** Тумблеры `Show tips` и `Show option IDs in tips`. */
  showTips?: boolean;
  showIds?: boolean;
  /** Куда сложить снятие открытых подсказок: очистка блока обязана убрать всё (С5). */
  closers?: Array<() => void>;
  /** Имя категории строки `Command` (4.6); нет — ключ реестра. */
  categoryName?: (id: string) => string;
  /** Контролы пресета строки `Command` — те же, что у пресета Command Field (4.6); нет — строки контролов нет. */
  drawPreset?: (host: El, row: BinderRow) => void;
}

/**
 * Подсказки колонок шапки — имена строк каталога (2026-09-08). Тело — в слот
 * под шапкой во всю ширину: в ячейке ~60px прозе не встать (как в Values).
 */
const COLUMN_TIPS: readonly (readonly [string, string])[] = [
  ["COL_INSERTS", "COL_INSERTS_TIP"],
  ["COL_COMMAND_NAME", "COL_COMMAND_NAME_TIP"],
  ["COL_DESCRIPTION", "COL_DESCRIPTION_TIP"],
  ["COL_HOTKEY", "COL_HOTKEY_TIP"],
];

export function renderBinder(host: El, o: BinderViewOpts): void {
  const say = o.say || PLAIN;
  const scroll = el(host, "div", "io-scroll");
  const card = el(scroll, "div", "io-card io-binder");

  const head = el(card, "div", "io-tablehead");
  const headTips = el(card, "div", "io-tabletipslot");
  /* Первая и последняя колонки (ручка, удаление) без подписи — и без «?». */
  const caps: readonly (readonly [string, string])[] = [
    ["", ""], ...COLUMN_TIPS, ["", ""],
  ];
  for (const [name, tipName] of caps) {
    const cell = el(head, "div", undefined);
    if (!name) continue;
    el(cell, "span", "io-tablehead__text", say(name));
    const close = tipBelow({
      head: cell,
      host: headTips,
      text: say(tipName),
      label: say(name),
      id: "io-binder-col-" + tipName.toLowerCase().replace(/_/g, "-").replace(/-tip$/, "") + "-tip",
      showTips: Boolean(o.showTips),
      showIds: Boolean(o.showIds),
    });
    if (o.closers) o.closers.push(close);
  }

  const held: DragHold = { taken: null };

  o.rows.forEach((row, i) => {
    const line = el(card, "div", "io-tablerow");
    const name = rowTitle(row);

    /* Перетаскивание — общий дом (`Р-11`); `enabled: true` — тумблера у списка нет. */
    attachRowDrag({
      row: line,
      index: i,
      label: say("ROW_DRAG", name),
      enabled: true,
      held,
      onMove: o.onMove,
    });

    const command = row.type === "command";
    const inserts = command ? (o.categoryName ? o.categoryName(row.category) : row.category) : row.insertText;
    const insCell = el(line, "code", "io-mono" + (command ? " io-binder__cat" : ""), inserts);
    if (command) insCell.setAttribute("aria-label", inserts);
    /* Строка Command выглядит как строка текста; настройки пресета — под треугольником у имени, свёрнуты (его 💬 к тесту 9 цикла 128). */
    const open = command && openPresets.has(row.rowId);
    let sub: El | null = null;
    const nameCell = el(line, "div", "io-cellname" + (command ? " io-binder__named" : ""));
    if (command && o.drawPreset) {
      const fold = btn(nameCell, "io-icon io-binder__fold" + (open ? " io-binder__fold--open" : ""), {
        text: open ? "▾" : "▸", label: say(open ? "ROW_PRESET_HIDE" : "ROW_PRESET_SHOW", name),
      });
      fold.setAttribute("aria-expanded", open ? "true" : "false");
      fold.addEventListener("click", (() => {
        if (openPresets.has(row.rowId)) openPresets.delete(row.rowId); else openPresets.add(row.rowId);
        const now = openPresets.has(row.rowId);
        if (sub) sub.hidden = !now;
        fold.textContent = now ? "▾" : "▸";
        if (now) fold.classList.add("io-binder__fold--open"); else fold.classList.remove("io-binder__fold--open");
        fold.setAttribute("aria-expanded", now ? "true" : "false");
        fold.setAttribute("aria-label", say(now ? "ROW_PRESET_HIDE" : "ROW_PRESET_SHOW", name));
      }) as never);
    }
    el(nameCell, "span", "io-binder__name", name);

    const cell = el(line, "div", "io-binder__desc");
    if (row.system) {
      /*
       * Описание системной строки — текстом, не отключённым полем: поле не
       * переносится и длинное описание обрезалось (C11), а править его нельзя (Б5).
       */
      const note = el(cell, "div", "io-binder__note", row.description);
      note.setAttribute("aria-label", say("ROW_DESC_ARIA", name));
      note.title = say("BUILT_IN");
    } else {
      const desc = textInput(cell, "io-text", {
        value: row.description,
        label: say("ROW_DESC_ARIA", name),
        placeholder: say("ROW_DESC_PLACEHOLDER"),
      });
      desc.addEventListener("change", (() => {
        o.onDescription(row, desc.value);
      }) as never);
    }

    const hotkey = o.hotkeyOf(row);
    const hk = btn(line, "io-hk" + (hotkey ? "" : " io-hk--none"), {
      text: hotkey || say("HOTKEY_NOT_SET"),
      label: say(hotkey ? "HOTKEY_CHANGE" : "HOTKEY_ASSIGN", name),
      title: say("HOTKEY_OPEN"),
    });
    hk.disabled = !o.openHotkey;
    hk.addEventListener("click", (() => {
      if (o.openHotkey) o.openHotkey(row);
    }) as never);

    const drop = btn(line, "io-icon", {
      text: row.system ? "" : "✕",
      label: row.system ? say("BUILT_IN") : say("ROW_REMOVE", name),
    });
    drop.disabled = row.system;
    drop.addEventListener("click", (() => {
      if (!row.system) o.onRemove(row);
    }) as never);
    /* Пресет строки `Command` — строкой под ней, во всю ширину таблицы (4.6). */
    if (command && o.drawPreset) {
      sub = el(card, "div", "io-binder__preset io-cats");
      sub.setAttribute("aria-label", say("ROW_PRESET_ARIA", name));
      sub.hidden = !open;
      o.drawPreset(el(sub, "div", "io-cats__set"), row);
    }
  });

  const foot = el(card, "div", "io-tablefoot");
  const add = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: ADD_COMMAND, label: ADD_COMMAND });
  add.addEventListener("click", (() => { o.onAdd(); }) as never);
}

/* ---- окно «завести строку» ---------------------------------------------- */

/**
 * Форма новой строки — здесь, чтобы проверять на заглушке: `Add` молчит без
 * текста вставки (иначе команда ничего не пишет).
 */
export function renderAddForm(box: El, o: {
  add: (draft: BinderDraft) => void;
  cancel: () => void;
  /**
   * Повторяет ли черновик заведённую строку; правило — `BinderModel.duplicateOf`.
   */
  duplicateOf?: (draft: BinderDraft) => BinderClash | null;
  say?: Say;
  /** `Escape` сворачивает выбиралку, а не окно (`В-196`); собирает окно. */
  holdKeys?: (onEscape: () => void) => () => void;
  /** Тумблеры `Show tips` и `Show option IDs in tips`, как у таблицы. */
  showTips?: boolean;
  showIds?: boolean;
  /**
   * Тип `Command` (4.6): выбор категории и контролы её пресета; `changed` —
   * выбрана категория. Нет — выбора типа в окне нет.
   */
  drawCommand?: (host: El, state: { category: string; preset: Record<string, unknown> }, changed: () => void) => void;
  categoryName?: (id: string) => string;
}): () => void {
  const say = o.say || PLAIN;
  el(box, "h4", "io-dlg__title", say("NEW_TITLE"));
  const lead = el(box, "p", "io-item__desc", say("NEW_NOTE"));

  /*
   * «?» у каждого поля (2026-09-23); текст тот же, что у колонки таблицы.
   * Устроено как `itemRow` в `fields_editor_view.ts`: подсказка — последним ребёнком строки.
   */
  const tipClosers: Array<() => void> = [];
  const field = (name: string, desc: string, placeholder: string, tip: string,
    needed?: boolean): { input: ElInput; warn: El; row: El } => {
    const row = el(box, "div", "io-item");
    const info = el(row, "div", "io-item__info");
    const nameRow = el(info, "div", "io-item__namerow");
    el(nameRow, "div", "io-item__name", name);
    tipClosers.push(tipBelow({
      head: nameRow,
      host: row,
      text: say(tip),
      label: name,
      id: "io-binder-new-" + tip.toLowerCase().replace(/_/g, "-"),
      showTips: Boolean(o.showTips),
      showIds: Boolean(o.showIds),
    }));
    el(info, "div", "io-item__desc", desc);
    const input = textInput(el(row, "div", "io-item__control"), "io-text", {
      value: "",
      label: say("NEW_FIELD_ARIA", name),
      placeholder,
      needed: needed === true,
    });
    /* Причина отказа под своим полем (C13); пустая строка места не занимает. */
    const warn = el(info, "div", "io-item__warn");
    return { input, warn, row };
  };

  /*
   * Обводится поле, без которого `Add` не работает (пункт 14, 2026-09-22) —
   * тот же вопрос, что гасит кнопку в `recheck`.
   */
  /* Тип строки (4.6): `Text` — прежняя вставка, `Command` — категория с одним пресетом. */
  let type: "insert" | "command" = "insert";
  const cmd = { category: "", preset: {} as Record<string, unknown> };
  let typeRow: El | null = null;
  let cmdRow: El | null = null;
  let drawType = (): void => {};
  if (o.drawCommand) {
    typeRow = el(box, "div", "io-item");
    const info = el(typeRow, "div", "io-item__info");
    el(el(info, "div", "io-item__namerow"), "div", "io-item__name", say("NEW_TYPE_LABEL"));
    el(info, "div", "io-item__desc", say("NEW_TYPE_DESC"));
    const ctl = el(typeRow, "div", "io-item__control");
    drawType = (): void => {
      ctl.empty();
      segmented(ctl, [{ value: "insert", label: say("TYPE_TEXT") }, { value: "command", label: say("TYPE_COMMAND") }],
        type, say("NEW_TYPE_LABEL"), v => { type = v === "command" ? "command" : "insert"; drawType(); shape(); });
    };
  }
  const insert = field(say("NEW_INSERTS_LABEL"), say("NEW_INSERTS_DESC"), say("NEW_INSERTS_HINT"), "COL_INSERTS_TIP", true);
  if (o.drawCommand) {
    cmdRow = el(box, "div", "io-binder__new io-cats");
    const info = el(cmdRow, "div", "io-item__info");
    el(el(info, "div", "io-item__namerow"), "div", "io-item__name", say("NEW_CATEGORY_LABEL"));
    el(info, "div", "io-item__desc", say("NEW_CATEGORY_DESC"));
    o.drawCommand(el(cmdRow, "div", "io-cats__set"), cmd, () => { suggest(); recheck(); });
  }
  const command = field(say("NEW_NAME_LABEL"), say("NEW_NAME_DESC"), say("NEW_NAME_HINT"), "COL_COMMAND_NAME_TIP");
  const note = field(say("NEW_DESC_LABEL"), say("NEW_DESC_DESC"), "", "COL_DESCRIPTION_TIP");

  const foot = el(box, "div", "io-dlg__foot");
  const cancel = btn(foot, "io-btn", { text: say("NEW_CANCEL"), label: say("NEW_CANCEL") });
  cancel.addEventListener("click", (() => { o.cancel(); }) as never);
  const add = btn(foot, "io-btn io-btn--cta", { text: say("NEW_ADD"), label: say("ADD_COMMAND") });

  const draftNow = (): BinderDraft => (type === "command"
    ? { type, category: cmd.category, preset: cmd.preset, insertText: "", commandName: command.input.value, description: note.input.value }
    : { insertText: insert.input.value, commandName: command.input.value, description: note.input.value });

  /*
   * Пересчёт на каждый символ: `Add` доступна при тексте вставки и без повтора;
   * предупреждения — в окне, а не после нажатия (C13).
   */
  const recheck = (): void => {
    const draft = draftNow();
    const clash = o.duplicateOf ? o.duplicateOf(draft) : null;
    insert.warn.textContent = clash && clash.field === "insertText" ? clash.error : "";
    command.warn.textContent = clash && clash.field === "commandName" ? clash.error : "";
    add.disabled = (type === "command" ? !cmd.category : !String(draft.insertText || "").trim()) || Boolean(clash);
  };

  /*
   * Имя команды предлагается само (пункт 9.4, 2026-09-22) и держится, пока в
   * поле ровно прошлое предложение (или пусто); набрал своё — не трогаем.
   */
  let suggested = "";
  const suggest = (): void => {
    const now = command.input.value;
    if (now.trim() && now !== suggested) return;
    if (type === "command") {
      suggested = cmd.category && o.categoryName ? o.categoryName(cmd.category) : "";
    } else {
      const text = insert.input.value.trim();
      suggested = text ? (pickName(text) || say("NEW_NAME_AUTO", text)) : "";
    }
    command.input.value = suggested;
  };

  /* Видно то, что относится к выбранному типу; примечание окна — своё у каждого. */
  const shape = (): void => {
    insert.row.hidden = type === "command";
    if (cmdRow) cmdRow.hidden = type !== "command";
    lead.textContent = say(type === "command" ? "NEW_NOTE_COMMAND" : "NEW_NOTE");
    suggest();
    recheck();
  };

  const picker = attachPicker(insert.input, insert.row, {
    kinds: PICK_ALL,
    say,
    ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
    onPick: char => {
      insert.input.value = char;
      suggest();
      recheck();
      paintNeeded(insert.input);
    },
  });

  insert.input.addEventListener("input", (() => { suggest(); }) as never);
  for (const f of [insert, command, note]) {
    f.input.addEventListener("input", (() => { recheck(); }) as never);
  }
  drawType();
  shape();

  add.addEventListener("click", (() => {
    const draft = draftNow();
    if (type === "command" ? !cmd.category : !String(draft.insertText || "").trim()) return;
    if (o.duplicateOf && o.duplicateOf(draft)) return;
    o.add(draft);
  }) as never);
  /* Окно закрыто мимо выбиралки — она обязана отдать `Escape` обратно. */
  return () => {
    picker.close();
    for (const close of tipClosers) close();
  };
}
