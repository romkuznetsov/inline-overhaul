/**
 * Вёрстка Binder (PRD 10.4, фаза 3c).
 *
 * Здесь нет ни платформы, ни записи: всё приходит обратными вызовами. Так
 * блок рисуется на заглушке DOM, и гейт Г16 это проверяет.
 *
 * Что изменилось против старой панели:
 *
 *   * колонки `Command ID` и подписи `inlineOverhaul_Binder_*` нет (Б2);
 *   * системная строка не удаляется, и её описание не редактируется (Б5).
 *     Второе — не строгость, а правда: `normalizeBinderRows` переписывает
 *     описание этой строки своим на каждом патче, и поле для правки было бы
 *     полем, которое ничего не меняет (З8). В старой панели оно было;
 *   * сетка таблицы живёт в CSS, а не в атрибутах узлов (Б4).
 */

import { el, btn, textInput, type DragEv, type El, type ElInput } from "./dom.ts";
import type { BinderDraft, BinderRow } from "./binder_model.ts";

/* ---- тексты: сняты с прототипа (Приложение B, 10.4) -------------------- */

export const HEAD = ["", "Inserts", "Command name", "Description", "Hotkey", ""] as const;
export const ADD_COMMAND = "Add command";
export const HOTKEY_NONE = "not set";
export const HOTKEY_TITLE = "Open Obsidian's Hotkeys settings at this command";
export const SYSTEM_TITLE = "Built in";
/** Имя команды в списке хоткеев начинается с этого — в таблице оно лишнее. */
export const LABEL_PREFIX = "Binder: ";

/* Окно «завести строку». Прототип держит на этом месте кнопку-заглушку, и
   текстов у окна не даёт: они написаны здесь по правилам раздела 7. */
export const ADD_TITLE = "Add a Binder command";
export const ADD_NOTE =
  "The command is made from the row, so the text it inserts cannot be changed afterwards";
export const INSERT_NAME = "Inserts";
export const INSERT_DESC = "The text this command drops in at the cursor";
export const CMD_NAME = "Command name";
export const CMD_DESC = "What to call it in Obsidian's list of hotkeys";
export const DESC_NAME = "Description";
export const DESC_DESC = "A note to yourself about what the row is for";

/** Как назвать строку в подписях: тем же, чем её называет список хоткеев. */
export function rowTitle(row: BinderRow): string {
  const short = row.commandLabel.startsWith(LABEL_PREFIX)
    ? row.commandLabel.slice(LABEL_PREFIX.length)
    : row.commandLabel;
  return short.trim() || row.commandName.trim() || row.insertText.trim() || "this row";
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
}

export function renderBinder(host: El, o: BinderViewOpts): void {
  const scroll = el(host, "div", "io-scroll");
  const card = el(scroll, "div", "io-card io-binder");

  const head = el(card, "div", "io-tablehead");
  for (const cap of HEAD) el(head, "div", undefined, cap);

  let taken: number | null = null;

  o.rows.forEach((row, i) => {
    const line = el(card, "div", "io-tablerow");
    const name = rowTitle(row);

    const grip = el(line, "span", "io-grip", "⠿");
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", "Drag " + name + " to reorder it");
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
    const desc = textInput(cell, "io-text", {
      value: row.description,
      label: "Description for " + name,
    });
    /* Б5: описание системной строки переписывает нормализация — править нечего. */
    desc.disabled = row.system;
    if (row.system) desc.title = SYSTEM_TITLE;
    desc.addEventListener("change", (() => {
      if (!row.system) o.onDescription(row, desc.value);
    }) as never);

    const hotkey = o.hotkeyOf(row);
    const hk = btn(line, "io-hk" + (hotkey ? "" : " io-hk--none"), {
      text: hotkey || HOTKEY_NONE,
      label: (hotkey ? "Change" : "Assign") + " the hotkey for " + name,
      title: HOTKEY_TITLE,
    });
    hk.disabled = !o.openHotkey;
    hk.addEventListener("click", (() => {
      if (o.openHotkey) o.openHotkey(row);
    }) as never);

    const drop = btn(line, "io-icon", {
      text: row.system ? "" : "✕",
      label: row.system ? SYSTEM_TITLE : "Remove " + name,
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
}): void {
  el(box, "h4", undefined, ADD_TITLE);
  el(box, "p", "io-item__desc", ADD_NOTE);

  const field = (name: string, desc: string, placeholder: string): ElInput => {
    const row = el(box, "div", "io-item");
    const info = el(row, "div", "io-item__info");
    el(info, "div", "io-item__name", name);
    el(info, "div", "io-item__desc", desc);
    return textInput(el(row, "div", "io-item__control"), "io-text", {
      value: "",
      label: name + " of the new command",
      placeholder,
    });
  };

  const insert = field(INSERT_NAME, INSERT_DESC, "→");
  const command = field(CMD_NAME, CMD_DESC, "Arrow");
  const note = field(DESC_NAME, DESC_DESC, "");

  const foot = el(box, "div", "io-dlg__foot");
  const cancel = btn(foot, "io-btn", { text: "Cancel", label: "Cancel" });
  cancel.addEventListener("click", (() => { o.cancel(); }) as never);
  const add = btn(foot, "io-btn io-btn--cta", { text: "Add", label: ADD_COMMAND });
  add.disabled = true;
  insert.addEventListener("input", (() => {
    add.disabled = !String(insert.value || "").trim();
  }) as never);
  add.addEventListener("click", (() => {
    if (!String(insert.value || "").trim()) return;
    o.add({
      insertText: insert.value,
      commandName: command.value,
      description: note.value,
    });
  }) as never);
}
