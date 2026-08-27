/**
 * Скролл и фокус переживают перерисовку блока (дефект A8, раздел 4.1 PRD).
 *
 * Свой блок перерисовывается подменой узла: строится новое поддерево, старое
 * выбрасывается. Для человека это выглядит так, будто панель прыгнула к
 * началу — на мгновение содержимое короче, и прокрутка схлопывается, — а
 * поле, в котором он печатал, теряет фокус и каретку. Заказчик увидел это
 * на каждом контроле редактора Fields.
 *
 * Здесь ровно то, чего в A8 не хватало: `scrollTop` и `activeElement`.
 * Помощник общий, а не частный для редактора Fields: подмена узла — приём
 * всех своих блоков, и болеть этим будет каждый следующий.
 *
 * Что здесь важно и неочевидно:
 *
 * - **Фокус ищется по подписи, а не по месту.** Перерисовка бывает и после
 *   изменения формы дерева — стрелка `Level` уносит строку на уровень ниже,
 *   — и тогда узел с тем же номером окажется чужим контролом. `aria-label` у
 *   контролов редактора уникален и переживает перестановку строки; номер в
 *   дереве остаётся запасным путём для узлов без подписи.
 * - **Фокус возвращается с `preventScroll`.** Без него браузер сам прокрутит
 *   панель к узлу — то есть починка скролла сама же его и сдвинет.
 * - **Ничего не обязано существовать.** Помощник работает и на заглушке DOM,
 *   где нет ни `scrollTop`, ни `activeElement`: гейт Г16 рисует блоки на ней.
 */

/** Узел настоящего DOM в объёме, который нужен этому помощнику. */
interface Node {
  parentElement: Node | null;
  children: ArrayLike<Node>;
  getAttribute(name: string): string | null;
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  className?: string;
  focus?: (opts?: { preventScroll?: boolean }) => void;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

export interface ViewKeeper {
  /** Вернуть прокрутку и фокус после того, как поддерево заменено. */
  restore(): void;
}

/** Пустой хранитель: возвращать нечего, и звать его безопасно. */
const NOTHING: ViewKeeper = { restore: () => { /* нечего возвращать */ } };

/**
 * Ближайший предок, который умеет прокручиваться. Именно его `scrollTop` и
 * сбрасывается подменой узла: у самого блока прокрутки нет.
 */
function scrollerOf(node: Node | null): Node | null {
  let at: Node | null = node;
  let guard = 0;
  while (at && guard++ < 64) {
    const height = Number(at.scrollHeight);
    const view = Number(at.clientHeight);
    if (Number.isFinite(height) && Number.isFinite(view) && height - view > 1) return at;
    at = at.parentElement;
  }
  return null;
}

/** Подпись узла: у контролов редактора она своя у каждого. */
function labelOf(node: Node): string {
  const label = String(node.getAttribute("aria-label") || "").trim();
  return label ? "label:" + label : "";
}

/** Место узла в поддереве: запасной путь для тех, у кого подписи нет. */
function pathOf(root: Node, node: Node): string {
  const path: number[] = [];
  let at: Node | null = node;
  let guard = 0;
  while (at && at !== root && guard++ < 64) {
    const parent: Node | null = at.parentElement;
    if (!parent) break;
    const kids = parent.children;
    let index = -1;
    for (let i = 0; i < kids.length; i++) if (kids[i] === at) { index = i; break; }
    path.unshift(index);
    at = parent;
  }
  if (at !== root) return "";
  return "path:" + String(node.className || "") + ":" + path.join(".");
}

/** Первый узел поддерева, у которого совпал ключ. */
function findByKey(root: Node, keyFn: (node: Node) => string, key: string): Node | null {
  let found: Node | null = null;
  const walk = (node: Node): void => {
    if (found) return;
    if (keyFn(node) === key) { found = node; return; }
    const kids = node.children;
    for (let i = 0; i < kids.length && !found; i++) walk(kids[i] as Node);
  };
  const kids = root.children;
  for (let i = 0; i < kids.length && !found; i++) walk(kids[i] as Node);
  return found;
}

/** Узел под фокусом — если он вообще есть и лежит внутри `root`. */
function focusedIn(root: Node): Node | null {
  const doc = (globalThis as { document?: { activeElement?: unknown } }).document;
  const active = doc && doc.activeElement ? (doc.activeElement as Node) : null;
  if (!active || active === root) return null;
  let at: Node | null = active.parentElement;
  let guard = 0;
  while (at && guard++ < 64) {
    if (at === root) return active;
    at = at.parentElement;
  }
  return null;
}

/**
 * Снять прокрутку и фокус перед перерисовкой `root`.
 *
 * `restore` зовётся ПОСЛЕ того, как старое поддерево выброшено, а новое
 * стоит на его месте: пока оба в дереве, высота больше настоящей, и
 * восстановленный `scrollTop` был бы не тем.
 */
export function keepView(root: unknown): ViewKeeper {
  const box = root as Node | null;
  if (!box || typeof box.getAttribute !== "function") return NOTHING;

  const scroller = scrollerOf(box);
  const top = scroller ? Number(scroller.scrollTop) : NaN;

  const active = focusedIn(box);
  /*
   * Два ключа, и оба нужны. Подпись переживает перестановку строки, но у
   * некоторых кнопок она меняется вместе с состоянием: у стрелки `Level`
   * после нажатия подпись становится обратной («вернуть наверх» вместо
   * «сделать дочерним»). Тогда в дело идёт место в дереве — ячейка-то та же.
   */
  const label = active ? labelOf(active) : "";
  const path = active ? pathOf(box, active) : "";
  const selStart = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === "number" ? active.selectionEnd : null;

  return {
    restore(): void {
      if (scroller && Number.isFinite(top)) {
        /* Присваивание браузер зажмёт по новой высоте сам — это и нужно. */
        scroller.scrollTop = top;
      }
      if (!label && !path) return;
      const node = (label ? findByKey(box, labelOf, label) : null)
        || (path ? findByKey(box, n => pathOf(box, n), path) : null);
      if (!node || typeof node.focus !== "function") return;
      node.focus({ preventScroll: true });
      if (selStart !== null && typeof node.selectionStart === "number") {
        /* Поле, которое кареткой не управляет (например, пикер цвета), на
           присваивание отвечает исключением — фокус от этого терять незачем. */
        try {
          node.selectionStart = selStart;
          node.selectionEnd = selEnd === null ? selStart : selEnd;
        } catch { /* каретки у этого поля нет */ }
      }
      /* Фокус мог сам сдвинуть прокрутку, даже с `preventScroll`: тема или
         плагин темы вправе прокрутить свой контейнер. Ставим ещё раз. */
      if (scroller && Number.isFinite(top)) scroller.scrollTop = top;
    },
  };
}
