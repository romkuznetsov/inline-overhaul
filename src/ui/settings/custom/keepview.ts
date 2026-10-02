/**
 * Скролл и фокус переживают перерисовку своего блока подменой узла (A8, PRD
 * 4.1). Общий для всех своих блоков.
 *
 * - Фокус ищется по `aria-label`, место в дереве — запасной путь: перерисовка
 *   бывает после перестановки строк.
 * - Фокус возвращается с `preventScroll`, иначе браузер сам сдвинет скролл.
 * - Работает и на заглушке DOM без `scrollTop`/`activeElement` (гейт Г16).
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

/** Ближайший прокручиваемый предок: его `scrollTop` сбрасывает подмена узла. */
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
 * Снять прокрутку и фокус перед перерисовкой `root`. `restore` — только ПОСЛЕ
 * замены поддерева: пока в дереве оба, высота завышена.
 */
export function keepView(root: unknown): ViewKeeper {
  const box = root as Node | null;
  if (!box || typeof box.getAttribute !== "function") return NOTHING;

  const scroller = scrollerOf(box);
  const top = scroller ? Number(scroller.scrollTop) : NaN;

  const active = focusedIn(box);
  /* Два ключа: подпись стрелки `Level` меняется после нажатия, тогда
     выручает место в дереве. */
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
        /* Поле без каретки (пикер цвета) бросает исключение. */
        try {
          node.selectionStart = selStart;
          node.selectionEnd = selEnd === null ? selStart : selEnd;
        } catch { /* каретки у этого поля нет */ }
      }
      /* Тема может прокрутить и при `preventScroll` — ставим ещё раз. */
      if (scroller && Number.isFinite(top)) scroller.scrollTop = top;
    },
  };
}
