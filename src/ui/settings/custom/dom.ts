/**
 * Минимум DOM для своих блоков (PRD 10, С5).
 *
 * Блоки не импортируют `obsidian` и не знают про браузер: им хватает узла с
 * четырьмя операциями. Причина не в чистоте, а в проверках: гейты Г16 и Г20
 * рендерят каждый блок на заглушке `tests/harness/dom_stub.ts`, и блок,
 * который умеет только настоящий DOM, проверить нечем.
 *
 * Запреты, которые здесь соблюдаются за все блоки сразу: разметка только
 * узлами, без строк с тегами (З5); из инлайн-стилей — одни `--io-*` (Г1);
 * цветовых литералов нет (З6), цвет приходит из настройки или из темы.
 */

import { richParts } from "../describe.ts";

export interface ElOpts {
  text?: string;
  cls?: string;
  attr?: Record<string, string>;
  /* Поля ввода. Obsidian принимает их у `createEl` наравне с `cls` и `text`;
     без них `createEl("input")` выходит без типа, и любой ввод читается пустым. */
  value?: string;
  type?: string;
  placeholder?: string;
}

/** Узел, с которым работают свои блоки. */
export interface El {
  createEl(tag: string, o?: ElOpts): El;
  createDiv(o?: ElOpts): El;
  createSpan(o?: ElOpts): El;
  appendChild(child: El): unknown;
  empty(): void;
  addClass(...cls: string[]): void;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, fn: (ev: never) => void): void;
  remove(): void;
  textContent: string;
  tabIndex: number;
  style: { setProperty(name: string, value: string): void };
  /**
   * Классы состояния. Перетаскивание держит их на узле, а не в CSS-переменных:
   * подсветка строки под курсором живёт доли секунды и перерисовки не стоит.
   */
  classList: {
    add(...cls: string[]): void;
    remove(...cls: string[]): void;
    contains(cls: string): boolean;
  };
  /** Ручку перетаскивания несёт она сама, а не строка (Ф2). */
  draggable: boolean;
  /** Подсказка при наведении. Второй уровень объяснения живёт в `tip` (Ст12). */
  title: string;
}

/** Кнопка: у неё, в отличие от прочих узлов, бывает выключенное состояние. */
export interface ElButton extends El {
  disabled: boolean;
}

/** Поле ввода или выбор: у них есть значение. */
export interface ElInput extends El {
  value: string;
  disabled: boolean;
}

/** Событие перетаскивания в том виде, в каком его читают свои блоки. */
export interface DragEv {
  preventDefault(): void;
  stopPropagation(): void;
  dataTransfer?: {
    setData(format: string, data: string): void;
    getData(format: string): string;
    effectAllowed?: string;
  } | null;
}

/** Создать узел: тег, класс, текст, родитель — как в прототипе. */
export function el(parent: El | null, tag: string, cls?: string, text?: string): El {
  if (!parent) throw new Error("своему блоку нужен родитель: " + tag);
  const o: ElOpts = {};
  if (cls) o.cls = cls;
  if (text !== undefined) o.text = text;
  return parent.createEl(tag, o);
}

/**
 * Кнопка со всем, что нужно программе чтения с экрана. Отдельный помощник, а
 * не `el(...)`, по двум причинам: `type="button"` внутри формы иначе
 * отправляет её, а кнопка без `aria-label` со значком вместо текста читается
 * как «кнопка» и ничего больше.
 */
export function btn(parent: El, cls: string, o: {
  text?: string;
  label?: string;
  title?: string;
}): ElButton {
  /*
   * Одна подсказка на узел — и один атрибут, а не два одинаковых.
   *
   * Первая попытка (2026-08-27, четвёртый круг) сливала `label` и `title` в
   * одну строку и писала её в оба атрибута. Подсказок от этого осталось всё
   * равно две: `aria-label` показывает своей тёмной подсказкой Obsidian, а
   * `title` — браузер, светлой и поверх неё. Одинаковый текст ничего не
   * исправил, две коробки так и всплывали одна за другой (замечание
   * заказчика, пятый круг).
   *
   * Поэтому `title` не ставится вовсе. Подпись живёт в `aria-label`: её
   * читает и программа чтения с экрана, и подсказка Obsidian.
   */
  const label = o.label ?? "";
  const full = o.title && o.title !== label
    ? (label ? label + " — " + o.title : o.title)
    : label;
  const attr: Record<string, string> = { type: "button" };
  if (full) attr["aria-label"] = full;
  return parent.createEl("button", { cls, text: o.text ?? "", attr }) as ElButton;
}

/**
 * Однострочное поле ввода. `aria-label` обязателен: подпись у поля тут
 * отдельная строка, а не `<label>`, и без него программа чтения с экрана
 * читает «поле ввода» и ничего больше.
 */
export function textInput(parent: El, cls: string, o: {
  value: string;
  label: string;
  placeholder?: string;
}): ElInput {
  const opts: ElOpts = { cls, type: "text", value: o.value, attr: { "aria-label": o.label } };
  if (o.placeholder !== undefined) opts.placeholder = o.placeholder;
  return parent.createEl("input", opts) as ElInput;
}

/** Выбор из перечня. Значения — те, что лежат в конфиге; меняются подписи (З1). */
export function selectInput(parent: El, cls: string, o: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  label: string;
}): ElInput {
  const node = parent.createEl("select", { cls, attr: { "aria-label": o.label } }) as ElInput;
  for (const opt of o.options) node.createEl("option", { text: opt.label, value: opt.value });
  node.value = o.value;
  return node;
}

/**
 * Мини-разметка описаний в узле: `<code>` и `<b>`, остальное — текст.
 * Разбор общий с описаниями настроек (`describe.ts`), чтобы одна и та же
 * строка выглядела одинаково в строке настройки и внутри своего блока.
 */
export function rich(host: El, text: string): El {
  for (const part of richParts(text)) {
    if (part.tag === "text") host.createSpan({ text: part.text });
    else host.createEl(part.tag, { text: part.text, cls: part.tag === "code" ? "io-code" : "" });
  }
  return host;
}

/** Значение CSS-переменной. Другие свойства свой блок не задаёт (Г1). */
export function cssVar(node: El, name: string, value: string): void {
  if (!name.startsWith("--io-")) throw new Error("свой блок задаёт только --io-*: " + name);
  node.style.setProperty(name, value);
}

/**
 * Подсказка второго уровня у своего блока (Ст12).
 *
 * `?` встаёт в шапку блока, а сама подсказка открывается **под** блоком.
 * Первая версия держала её внутри рамки на `details`: раскрытие раздвигало
 * текст коллаута, и панель читалась как прыгающая. У строки настройки такой
 * задачи нет — там подсказка и так под строкой, и `describe.ts` остаётся на
 * `details` без скриптов.
 *
 * Возвращает функцию, которая убирает открытую подсказку (С5).
 */
export function tipBelow(o: {
  /** Шапка блока: сюда встаёт «?». */
  head: El;
  /** Строка целиком: подсказка становится её последним ребёнком, то есть под блоком. */
  host: El;
  text: string;
  /** Для программы чтения с экрана: «More about …». */
  label: string;
  /** Связка кнопки и подсказки. */
  id: string;
  showTips: boolean;
}): () => void {
  if (!o.text || !o.showTips) return () => {};

  let open: El | null = null;
  const mark = o.head.createEl("button", {
    cls: "io-help",
    text: "?",
    attr: {
      type: "button",
      "aria-expanded": "false",
      "aria-controls": o.id,
      "aria-label": "More about " + o.label,
    },
  });

  mark.addEventListener("click", () => {
    if (open) {
      open.remove();
      open = null;
      mark.setAttribute("aria-expanded", "false");
      return;
    }
    open = o.host.createEl("div", { cls: "io-tip io-tip--below", attr: { id: o.id } });
    rich(open, o.text);
    mark.setAttribute("aria-expanded", "true");
  });

  return () => { if (open) { open.remove(); open = null; } };
}
