/**
 * Вёрстка Binder (PRD 10.4, фаза 3c).
 *
 * Здесь нет ни платформы, ни записи: всё приходит обратными вызовами. Так
 * блок рисуется на заглушке DOM, и гейт Г16 это проверяет.
 *
 * Что изменилось против старой панели:
 *
 *   * колонки `Command ID` и подписи идентификатора команды нет (Б2);
 *   * системная строка не удаляется, и её описание не редактируется (Б5).
 *     Второе — не строгость, а правда: `normalizeBinderRows` переписывает
 *     описание этой строки своим на каждом патче, и поле для правки было бы
 *     полем, которое ничего не меняет (З8). В старой панели оно было;
 *   * сетка таблицы живёт в CSS, а не в атрибутах узлов (Б4).
 */

import { el, btn, textInput, tipBelow, type DragEv, type El, type ElInput } from "./dom.ts";
import type { BinderClash, BinderDraft, BinderRow } from "./binder_model.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/* ---- тексты ------------------------------------------------------------ */

/*
 * Сняты с прототипа (Приложение B, 10.4), а живут в каталоге (10.13.47): у
 * видимого текста один дом. Имена здесь оставлены ради тех, кто их зовёт, —
 * и берут они то же самое слово, а не второе его объявление (У-32).
 */
const T = BLOCK_TEXTS["binder-table"];

export const HEAD = ["", T.COL_INSERTS, T.COL_COMMAND_NAME, T.COL_DESCRIPTION, T.COL_HOTKEY, ""] as const;
export const ADD_COMMAND = T.ADD_COMMAND;
export const HOTKEY_NONE = T.HOTKEY_NOT_SET;
export { HOTKEY_TITLE } from "./hotkeys.ts";
export const SYSTEM_TITLE = T.BUILT_IN;
/** Имя команды в списке хоткеев начинается с этого — в таблице оно лишнее. */
export const LABEL_PREFIX = T.COMMAND_PREFIX.replace("{0}", "");

/* Окно «завести строку». Прототип держит на этом месте кнопку-заглушку, и
   текстов у окна не даёт: они написаны по правилам раздела 7. */
export const ADD_TITLE = T.NEW_TITLE;
export const ADD_NOTE = T.NEW_NOTE;
export const INSERT_NAME = T.NEW_INSERTS_LABEL;
export const INSERT_DESC = T.NEW_INSERTS_DESC;
export const CMD_NAME = T.NEW_NAME_LABEL;
export const CMD_DESC = T.NEW_NAME_DESC;
export const DESC_NAME = T.NEW_DESC_LABEL;
export const DESC_DESC = T.NEW_DESC_DESC;

/** Как блок спрашивает свой текст. Нет ctx — ответом идёт английское. */
export type Say = (name: string, ...args: readonly (string | number)[]) => string;
const PLAIN: Say = sayIn("binder-table", {});

/** Как назвать строку в подписях: тем же, чем её называет список хоткеев. */
export function rowTitle(row: BinderRow): string {
  const short = row.commandLabel.startsWith(LABEL_PREFIX)
    ? row.commandLabel.slice(LABEL_PREFIX.length)
    : row.commandLabel;
  return short.trim() || row.commandName.trim() || row.insertText.trim() || T.ROW_ARIA;
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
  /** Тумблеры `Show tips` и `Show setting ids in tips`. */
  showTips?: boolean;
  showIds?: boolean;
  /** Куда сложить снятие открытых подсказок: очистка блока обязана убрать всё (С5). */
  closers?: Array<() => void>;
}

/**
 * Подсказки колонок шапки — имена строк каталога по подписи колонки.
 *
 * Заведены 2026-09-08 по заказу заказчика: «добавь tip ко всем элементам, у
 * которых еще нет». Тело раскрывается в слот ПОД шапкой, во всю ширину
 * таблицы: ячейка шапки тут шириной в шесть десятков точек, и прозе в ней не
 * встать — тот же приём, что в таблице Values.
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
  /* Первая и последняя колонки без подписи: ручка перетаскивания и удаление.
     Подписи нет — «?» ставить некуда, и объяснять нечего. */
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

  let taken: number | null = null;

  o.rows.forEach((row, i) => {
    const line = el(card, "div", "io-tablerow");
    const name = rowTitle(row);

    const grip = el(line, "span", "io-grip", "⠿");
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", say("ROW_DRAG", name));
    grip.draggable = true;
    grip.addEventListener("dragstart", ((ev: DragEv) => {
      taken = i;
      line.classList.add("io-dragging");
      try { ev.dataTransfer?.setData("text/plain", String(i)); } catch { /* десктоп всегда даёт dataTransfer */ }
    }) as never);
    grip.addEventListener("dragend", (() => {
      taken = null;
      line.classList.remove("io-dragging");
    }) as never);
    line.addEventListener("dragover", ((ev: DragEv) => {
      if (taken === null) return;
      ev.preventDefault();
      line.classList.add("io-dragover");
    }) as never);
    line.addEventListener("dragleave", (() => { line.classList.remove("io-dragover"); }) as never);
    line.addEventListener("drop", ((ev: DragEv) => {
      ev.preventDefault();
      line.classList.remove("io-dragover");
      const from = taken;
      taken = null;
      if (from === null || from === i) return;
      o.onMove(from, i);
    }) as never);

    el(line, "code", "io-mono", row.insertText);
    el(line, "div", "io-cellname", name);

    const cell = el(line, "div", "io-binder__desc");
    if (row.system) {
      /*
       * У системной строки описание рисуется **текстом**, а не отключённым
       * полем ввода.
       *
       * Поле ввода однострочно и не переносится: описание `Smart bracket`
       * длинное, и заказчик видел только его начало (C11, 2026-09-02). Править
       * его всё равно нельзя — `normalizeBinderRows` переписывает его своим на
       * каждом патче (Б5), — значит, поле тут вообще не нужно: текст читается
       * целиком и переносится по словам.
       */
      const note = el(cell, "div", "io-binder__note", row.description);
      note.setAttribute("aria-label", say("ROW_DESC_ARIA", name));
      note.title = say("BUILT_IN");
    } else {
      const desc = textInput(cell, "io-text", {
        value: row.description,
        label: say("ROW_DESC_ARIA", name),
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
  });

  const foot = el(card, "div", "io-tablefoot");
  const add = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: ADD_COMMAND, label: ADD_COMMAND });
  add.addEventListener("click", (() => { o.onAdd(); }) as never);
}

/* ---- окно «завести строку» ---------------------------------------------- */

/**
 * Форма новой строки. Живёт здесь, а не рядом с окном, ровно затем, чтобы её
 * можно было нарисовать на заглушке и проверить: `Add` молчит, пока нет
 * текста вставки, — строка без него заводит команду, которая ничего не пишет.
 */
export function renderAddForm(box: El, o: {
  add: (draft: BinderDraft) => void;
  cancel: () => void;
  /**
   * Повторяет ли то, что человек уже напечатал, заведённую строку. Правило
   * живёт в модели одним объявлением (`BinderModel.duplicateOf`): окно только
   * спрашивает и показывает ответ.
   */
  duplicateOf?: (draft: BinderDraft) => BinderClash | null;
  say?: Say;
}): void {
  const say = o.say || PLAIN;
  el(box, "h4", undefined, say("NEW_TITLE"));
  el(box, "p", "io-item__desc", say("NEW_NOTE"));

  const field = (name: string, desc: string, placeholder: string): { input: ElInput; warn: El } => {
    const row = el(box, "div", "io-item");
    const info = el(row, "div", "io-item__info");
    el(info, "div", "io-item__name", name);
    el(info, "div", "io-item__desc", desc);
    const input = textInput(el(row, "div", "io-item__control"), "io-text", {
      value: "",
      label: say("NEW_FIELD_ARIA", name),
      placeholder,
    });
    /* Причина отказа стоит под своим полем, а не над панелью: человек читает
       её там, где печатает (C13). Пустая строка ничего не занимает. */
    const warn = el(info, "div", "io-item__warn");
    return { input, warn };
  };

  const insert = field(say("NEW_INSERTS_LABEL"), say("NEW_INSERTS_DESC"), say("NEW_INSERTS_HINT"));
  const command = field(say("NEW_NAME_LABEL"), say("NEW_NAME_DESC"), say("NEW_NAME_HINT"));
  const note = field(say("NEW_DESC_LABEL"), say("NEW_DESC_DESC"), "");

  const foot = el(box, "div", "io-dlg__foot");
  const cancel = btn(foot, "io-btn", { text: say("NEW_CANCEL"), label: say("NEW_CANCEL") });
  cancel.addEventListener("click", (() => { o.cancel(); }) as never);
  const add = btn(foot, "io-btn io-btn--cta", { text: say("NEW_ADD"), label: say("ADD_COMMAND") });

  const draftNow = (): BinderDraft => ({
    insertText: insert.input.value,
    commandName: command.input.value,
    description: note.input.value,
  });

  /*
   * Состояние окна пересчитывается на каждый набранный символ: `Add` доступна
   * только когда есть текст вставки и когда ничего не повторяется.
   *
   * До 2026-09-02 повтор ловился уже после нажатия: окно закрывалось, блок
   * перерисовывался — и человека возвращало на вкладку `Keyboard`, — а причина
   * приезжала всплывающим сообщением Obsidian. Заказчик: «я хочу, чтобы у
   * пользователя в окне добавлении команды возникали предупреждения» (C13).
   */
  const recheck = (): void => {
    const draft = draftNow();
    const clash = o.duplicateOf ? o.duplicateOf(draft) : null;
    insert.warn.textContent = clash && clash.field === "insertText" ? clash.error : "";
    command.warn.textContent = clash && clash.field === "commandName" ? clash.error : "";
    add.disabled = !String(draft.insertText || "").trim() || Boolean(clash);
  };

  for (const f of [insert, command, note]) {
    f.input.addEventListener("input", (() => { recheck(); }) as never);
  }
  recheck();

  add.addEventListener("click", (() => {
    const draft = draftNow();
    if (!String(draft.insertText || "").trim()) return;
    if (o.duplicateOf && o.duplicateOf(draft)) return;
    o.add(draft);
  }) as never);
}
