/**
 * Перетаскивание строки за ручку — один дом на оба списка (`Р-11`).
 *
 * **Что это за правило.** «Строку списка можно взять за ручку и бросить на
 * место другой» — пять приёмников событий и два класса состояния. Оно было
 * объявлено дважды: у списка Binder (`binder_view.ts`) и у списков порядка
 * (`order_lists.ts`).
 *
 * **Расхождение измерено до сведения и равно нулю.** Куски по 27 строк; после
 * приведения трёх имён, которые отличаются законно, — узел строки, откуда
 * берётся подпись ручки и чем задана перетаскиваемость, — они совпадают
 * побайтно. У меры два контроля: нарочная порча куска обязана дать расхождение,
 * и приведение имён не должно съедать сам кусок.
 *
 * **Третье место с перетаскиванием сводить было не во что.** В редакторе Fields
 * бросок делают сторона и её подпись, и вопрос там другой: не «переставить
 * строку внутри списка по номеру», а «перенести поле на эту сторону и в это
 * место». Общего с этим правилом у него только имена событий.
 *
 * **Состояние списка передаётся, а не заводится здесь.** «Кого сейчас тащат» —
 * одно на весь список, а эта функция зовётся на каждую строку: заведи она своё
 * поле, каждая строка знала бы только о себе и бросок не находил бы источника.
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

/**
 * Повесить перетаскивание на строку и вернуть саму ручку.
 *
 * Ручка возвращается, потому что блок может дописать ей своё — пока не
 * дописывает никто, но и прятать её незачем: она первый ребёнок строки, и
 * найти её блок всё равно может.
 */
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
