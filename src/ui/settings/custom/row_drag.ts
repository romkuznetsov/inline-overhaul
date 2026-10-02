/**
 * Перетаскивание строки за ручку — один дом для Binder и списков порядка (`Р-11`).
 * Поля Fields сюда не сведены: там бросок переносит поле на сторону, а не
 * переставляет строку. Состояние «кого тащат» передаёт список: функция зовётся
 * на каждую строку, и своё поле здесь не нашло бы источник броска.
 */

import { el, type DragEv, type El } from "./dom.ts";

/** Кого сейчас тащат. Одно на список, заводит его список. */
export interface DragHold {
  taken: number | null;
}

export interface RowDragOpts {
  /** Узел строки: на нём живут классы состояния и приёмники броска. */
  row: El;
  /** Номер строки: им же отвечает бросок. */
  index: number;
  /** Подпись ручки для программы чтения с экрана, уже собранная блоком. */
  label: string;
  /** Можно ли тащить. У Binder всегда да, у списков порядка — по тумблеру. */
  enabled: boolean;
  /** Состояние списка, общее для всех его строк. */
  held: DragHold;
  /** Переставить: откуда и куда. Зовётся только у настоящего перемещения. */
  onMove: (from: number, to: number) => void;
}

/** Повесить перетаскивание на строку и вернуть ручку (первый ребёнок строки). */
export function attachRowDrag(o: RowDragOpts): El {
  const grip = el(o.row, "span", "io-grip", "⠿");
  grip.setAttribute("role", "button");
  grip.setAttribute("aria-label", o.label);
  grip.draggable = o.enabled;

  grip.addEventListener("dragstart", ((ev: DragEv) => {
    o.held.taken = o.index;
    o.row.classList.add("io-dragging");
    try {
      ev.dataTransfer?.setData("text/plain", String(o.index));
    } catch {
      /* Проба: десктопный браузер всегда даёт `dataTransfer`. */
    }
  }) as never);

  grip.addEventListener("dragend", (() => {
    o.held.taken = null;
    o.row.classList.remove("io-dragging");
  }) as never);

  o.row.addEventListener("dragover", ((ev: DragEv) => {
    if (o.held.taken === null) return;
    ev.preventDefault();
    o.row.classList.add("io-dragover");
  }) as never);

  o.row.addEventListener("dragleave", (() => {
    o.row.classList.remove("io-dragover");
  }) as never);

  o.row.addEventListener("drop", ((ev: DragEv) => {
    ev.preventDefault();
    o.row.classList.remove("io-dragover");
    const from = o.held.taken;
    o.held.taken = null;
    if (from === null || from === o.index) return;
    o.onMove(from, o.index);
  }) as never);

  return grip;
}
