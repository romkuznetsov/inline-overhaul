/**
 * Заглушка DOM для гейтов Г16 и Г20 (PRD 12, фаза 0 пункт 7).
 *
 * Два свойства обязательны, иначе гейт зелёный и не проверяет ничего:
 *   - запись textContent ЧИСТИТ детей. Без этого каждый ре-рендер добавлял
 *     в дерево ещё одну копию панели, и проверка читала самую старую;
 *   - style.setProperty ЗАПОМИНАЕТ значение, а getPropertyValue его отдаёт.
 *     Без этого все CSS-переменные читаются пустыми, и любая проверка
 *     геометрии или цвета проходит на пустых строках.
 *
 * Оба случая уже один раз прятали ошибку на прототипе.
 */

/** То же, что принимает createEl в Obsidian. */
export interface ElOpts {
  text?: string;
  cls?: string;
  attr?: Record<string, string>;
  /* Obsidian принимает и value: без него `createEl("option", { value })`
     создаёт вариант без значения, и любой выбор в select читается пустым. */
  value?: string;
  type?: string;
  placeholder?: string;
  title?: string;
}

export interface StubNode {
  tagName: string;
  children: StubNode[];
  parent: StubNode | null;
  attrs: Record<string, string>;
  dataset: Record<string, string>;
  listeners: Record<string, Array<(ev: any) => void>>;
  className: string;
  textContent: string;
  ownText: string;
  value: string;
  type: string;
  checked: boolean;
  disabled: boolean;
  draggable: boolean;
  title: string;
  placeholder: string;
  tabIndex: number;
  style: {
    setProperty(k: string, v: string): void;
    removeProperty(k: string): void;
    getPropertyValue(k: string): string;
  };
  classList: {
    add(...c: string[]): void;
    remove(...c: string[]): void;
    toggle(c: string, on?: boolean): void;
    contains(c: string): boolean;
  };
  appendChild(c: StubNode): StubNode;
  insertBefore(c: StubNode, ref: StubNode | null): StubNode;
  insertAdjacentElement(where: string, other: StubNode): StubNode;
  setChildrenInPlace(next: StubNode[]): void;
  removeChild(c: StubNode): StubNode;
  remove(): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  removeAttribute(k: string): void;
  addEventListener(t: string, fn: (ev: any) => void): void;
  removeEventListener(): void;
  dispatch(t: string, ev?: any): void;
  click(): void;
  focus(opts?: { preventScroll?: boolean }): void;
  blur(): void;
  /* Прокрутка и каретка. Без них проверить возврат скролла и фокуса после
     перерисовки нечем: помощник читает ровно эти свойства (дефект A8). */
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  selectionStart: number | null;
  selectionEnd: number | null;
  addClass(...cls: string[]): void;
  removeClass(...cls: string[]): void;
  toggleClass(cls: string, on?: boolean): void;
  hasClass(cls: string): boolean;
  createEl(tag: string, o?: ElOpts): StubNode;
  createDiv(o?: ElOpts): StubNode;
  createSpan(o?: ElOpts): StubNode;
  empty(): void;
  setText(t: string): void;
  appendText(t: string): void;
  querySelector(sel: string): StubNode | null;
  querySelectorAll(sel: string): StubNode[];
  /** Ближайший предок (или сам узел), подходящий под селектор. */
  closest(sel: string): StubNode | null;
  readonly ownerDocument: { getElementById: (id: string) => StubNode | null } | null;
  readonly lastChild: StubNode | null;
  readonly firstChild: StubNode | null;
  readonly parentElement: StubNode | null;
  readonly isConnected: boolean;
  /* Выпадающий список: доска читает выбранный вариант через них. */
  readonly options: StubNode[];
  readonly selectedIndex: number;
}

let created = 0;
export const nodeCount = () => created;

/** Узел под фокусом. В браузере он один на документ, здесь — один на процесс. */
let focused: StubNode | null = null;
export const focusedNode = (): StubNode | null => focused;
export const clearFocus = (): void => { focused = null; };

export function makeNode(tag?: string): StubNode {
  created++;
  const bag: Record<string, string> = {};
  const classes = new Set<string>();

  const node: any = {
    tagName: String(tag || "div").toUpperCase(),
    children: [] as StubNode[],
    parent: null,
    attrs: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    listeners: {} as Record<string, Array<(ev: any) => void>>,
    ownText: "",
    value: "",
    type: "",
    checked: false,
    disabled: false,
    draggable: false,
    title: "",
    placeholder: "",
    tabIndex: 0,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    /* Как в настоящем DOM: у поля ввода каретка есть всегда и выражена
       числом, у прочих узлов её нет вовсе. */
    selectionStart: /^(INPUT|TEXTAREA)$/.test(String(tag || "div").toUpperCase()) ? 0 : null,
    selectionEnd: /^(INPUT|TEXTAREA)$/.test(String(tag || "div").toUpperCase()) ? 0 : null,

    style: {
      setProperty(k: string, v: string) { bag[k] = String(v); },
      removeProperty(k: string) { delete bag[k]; },
      getPropertyValue(k: string) { return bag[k] === undefined ? "" : bag[k]; },
    },

    classList: {
      add(...c: string[]) { c.forEach(x => classes.add(x)); },
      remove(...c: string[]) { c.forEach(x => classes.delete(x)); },
      toggle(c: string, on?: boolean) {
        if (on === undefined) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
        else if (on) classes.add(c); else classes.delete(c);
      },
      contains(c: string) { return classes.has(c); },
    },

    appendChild(c: StubNode) { node.children.push(c); (c as any).parent = node; return c; },
    insertBefore(c: StubNode, ref: StubNode | null) {
      /*
       * Как в браузере: узел **переезжает**. Без этого шага заглушка была
       * добрее DOM — созданный внутри узла и тут же вставленный первым
       * ребёнком того же узла оставался в дереве дважды, — и полоса вкладок
       * рисовалась в двух экземплярах, чего проверка не видела (10.13.13).
       */
      const had = (c as any).parent as StubNode | null | undefined;
      if (had) {
        const at = had.children.indexOf(c);
        if (at >= 0) had.children.splice(at, 1);
      }
      const i = ref ? node.children.indexOf(ref) : -1;
      if (i < 0) node.children.push(c); else node.children.splice(i, 0, c);
      (c as any).parent = node;
      return c;
    },
    insertAdjacentElement(where: string, other: StubNode) {
      if (!node.parent) return other;
      /*
       * Как в браузере: узел **переезжает**, а не копируется. Без этого шага
       * заглушка была добрее DOM — узел, созданный внутри предка и потом
       * вставленный рядом с соседом, оставался в дереве дважды, и проверка
       * места вставки была зелёной ни о чём (B7, 2026-09-02).
       */
      const had = (other as any).parent as StubNode | null | undefined;
      if (had) {
        const at = had.children.indexOf(other);
        if (at >= 0) had.children.splice(at, 1);
      }
      const i = node.parent.children.indexOf(node);
      node.parent.children.splice(where === "afterend" ? i + 1 : i, 0, other);
      (other as any).parent = node.parent;
      return other;
    },
    /*
     * `setChildrenInPlace` из Obsidian (`enhance.js`): узел оставляет ровно
     * перечисленных детей в перечисленном порядке, всех прочих удаляет, а
     * пришедших со стороны **переносит** к себе.
     *
     * Нужен затем, что именно этим вызовом платформа заканчивает и группу
     * (`i6`), и страницу (`e6`), и именно он отменял переезд полосы вкладок
     * (10.13.13). Без него проверка места полосы была бы зелёной ни о чём.
     */
    setChildrenInPlace(next: StubNode[]) {
      const keep = new Set(next);
      for (const c of node.children.slice()) if (!keep.has(c)) node.removeChild(c);
      node.children.length = 0;
      for (const c of next) {
        const had = (c as any).parent as StubNode | null | undefined;
        if (had && had !== node) {
          const at = had.children.indexOf(c);
          if (at >= 0) had.children.splice(at, 1);
        }
        node.children.push(c);
        (c as any).parent = node;
      }
    },
    removeChild(c: StubNode) {
      const i = node.children.indexOf(c);
      if (i >= 0) node.children.splice(i, 1);
      /*
       * Как в браузере: узел под фокусом ушёл из дерева — фокуса больше нет,
       * он возвращается на `body`. Это и есть половина дефекта A8: блок
       * перерисовывается подменой узла, и поле, в котором печатал человек,
       * фокус теряет. Без этой строки проверка возврата фокуса была бы
       * зелёной ни о чём.
       */
      if (focused && contains(c, focused)) focused = null;
      return c;
    },
    remove() { if (node.parent) node.parent.removeChild(node); },

    setAttribute(k: string, v: string) { node.attrs[k] = String(v); },
    getAttribute(k: string) {
      return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null;
    },
    removeAttribute(k: string) { delete node.attrs[k]; },

    addEventListener(t: string, fn: (ev: any) => void) {
      (node.listeners[t] = node.listeners[t] || []).push(fn);
    },
    removeEventListener() { /* заглушка */ },
    dispatch(t: string, ev?: any) {
      (node.listeners[t] || []).forEach((fn: (e: any) => void) =>
        fn(ev || { preventDefault() {}, stopPropagation() {}, target: node, key: "" }));
    },
    click() { node.dispatch("click"); },
    /*
     * Фокус запоминается: настоящий DOM держит его в `document.activeElement`,
     * и помощник, который возвращает фокус после перерисовки, читает именно
     * его. Заглушка без этого молчала бы, а проверка была бы зелёной ни о чём.
     */
    focus() { focused = node; },
    blur() { if (focused === node) focused = null; },

    /* API Obsidian на элементах */
    addClass(...c: string[]) { c.forEach(x => classes.add(x)); },
    removeClass(...c: string[]) { c.forEach(x => classes.delete(x)); },
    toggleClass(c: string, on?: boolean) { node.classList.toggle(c, on); },
    hasClass(c: string) { return classes.has(c); },
    createEl(t: string, o?: ElOpts) {
      const c = makeNode(t);
      if (o && o.text) (c as any).textContent = o.text;
      if (o && o.cls) c.className = o.cls;
      if (o && o.attr) for (const k of Object.keys(o.attr)) c.setAttribute(k, o.attr[k] as string);
      if (o && o.value !== undefined) (c as any).value = o.value;
      if (o && o.type !== undefined) (c as any).type = o.type;
      if (o && o.placeholder !== undefined) (c as any).placeholder = o.placeholder;
      if (o && o.title !== undefined) (c as any).title = o.title;
      node.appendChild(c);
      return c;
    },
    createDiv(o?: ElOpts) { return node.createEl("div", o); },
    createSpan(o?: ElOpts) { return node.createEl("span", o); },
    empty() { node.children.length = 0; node.ownText = ""; },
    setText(t: string) { (node as any).textContent = t; },
    /* Как в Obsidian: дописывает текстовый узел, не затирая детей. */
    appendText(t: string) {
      const child = makeNode("#text");
      (child as any).textContent = String(t == null ? "" : t);
      node.appendChild(child);
    },

    querySelector(sel: string) { return query(node, sel)[0] || null; },
    querySelectorAll(sel: string) { return query(node, sel); },
    /*
     * `closest` начинает с самого узла и идёт вверх — как в браузере. Нужен
     * панели: «?» заголовка группы поднимается от кнопки до группы, чтобы
     * найти тело подсказки (B7).
     */
    closest(sel: string) {
      let at: StubNode | null = node;
      while (at) {
        if (matches(at, sel)) return at;
        at = at.parent;
      }
      return null;
    },
  };

  /* Настоящий DOM отдаёт детей и по краям: старый рендерер этим пользуется
     (`head.lastChild`), и без них он падает на заглушке, а не в Obsidian. */
  Object.defineProperty(node, "lastChild", {
    get(): StubNode | null { return node.children[node.children.length - 1] || null; },
  });
  Object.defineProperty(node, "firstChild", {
    get(): StubNode | null { return node.children[0] || null; },
  });
  Object.defineProperty(node, "parentElement", {
    get(): StubNode | null { return node.parent; },
  });
  Object.defineProperty(node, "isConnected", { get(): boolean { return true; } });
  /* В браузере документ есть у каждого узла. Панель через него ищет тело
     подсказки группы по id (B7), поэтому заглушка отдаёт тот же документ. */
  Object.defineProperty(node, "ownerDocument", {
    get(): { getElementById: (id: string) => StubNode | null } | null { return currentDoc; },
  });

  /*
   * Выпадающий список отдаёт свои варианты и номер выбранного. Без них доска
   * падает на строке `parentTokenSelect.options[parentTokenSelect.selectedIndex]`
   * — и падает молча, внутри обработчика: сценарий карты записей выглядел как
   * «контрол не нашёлся», а не как ошибка.
   */
  Object.defineProperty(node, "options", {
    get(): StubNode[] { return node.children.filter((c: StubNode) => String(c.tagName) === "OPTION"); },
  });
  Object.defineProperty(node, "selectedIndex", {
    get(): number {
      const opts = node.children.filter((c: StubNode) => String(c.tagName) === "OPTION");
      const idx = opts.findIndex((c: StubNode) => String(c.value || "") === String(node.value || ""));
      return idx;
    },
  });

  Object.defineProperty(node, "className", {
    get() { return Array.from(classes).join(" "); },
    set(v: string) {
      classes.clear();
      String(v || "").split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
    },
  });

  /* Как настоящий DOM: чтение обходит поддерево, запись его заменяет. */
  Object.defineProperty(node, "textContent", {
    get(): string {
      return node.ownText + node.children.map((c: StubNode) => c.textContent).join("");
    },
    set(v: string) {
      node.ownText = v == null ? "" : String(v);
      node.children.length = 0;
    },
  });

  return node as StubNode;
}

/** Лежит ли узел в поддереве. */
function contains(root: StubNode, node: StubNode): boolean {
  if (root === node) return true;
  for (const child of root.children) if (contains(child, node)) return true;
  return false;
}

function matches(n: StubNode, sel: string): boolean {
  if (sel.startsWith(".")) return n.classList.contains(sel.slice(1).split(/[.[]/)[0] as string);
  if (sel.startsWith("#")) return n.getAttribute("id") === sel.slice(1);
  /* [attr="value"] и [attr]: по атрибуту ищется своя строка блока (К3),
     и без этого проверка перехода шла бы не тем путём, что рабочий код. */
  if (sel.startsWith("[") && sel.endsWith("]")) {
    const body = sel.slice(1, -1);
    const eq = body.indexOf("=");
    if (eq < 0) return n.getAttribute(body) !== null;
    const name = body.slice(0, eq);
    const want = body.slice(eq + 1).replace(/^["']|["']$/g, "");
    return n.getAttribute(name) === want;
  }
  return n.tagName === sel.toUpperCase();
}

function query(root: StubNode, sel: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode) => {
    n.children.forEach(c => { if (matches(c, sel)) out.push(c); walk(c); });
  };
  walk(root);
  return out;
}

/**
 * Документ, который отдаёт `ownerDocument` любого узла. В браузере он один на
 * дерево; здесь — последний созданный, и этого хватает: заглушка живёт внутри
 * одного прогона.
 */
let currentDoc: any = null;

export function makeDocument() {
  const doc: any = {
    body: makeNode("body"),
    /* Как в браузере: документ отдаёт узел под фокусом, а не хранит его сам. */
    get activeElement() { return focused; },
    createElement: (t: string) => makeNode(t),
    createTextNode: (t: string) => { const n = makeNode("#text") as any; n.textContent = String(t); return n; },
    /*
     * Поиск по id идёт по дереву документа, как в браузере: узел, никуда не
     * добавленный, не находится. Раньше здесь стояло `null` всегда — то есть
     * любая проверка, опирающаяся на поиск по id, была зелёной ни о чём.
     */
    getElementById: (id: string) => query(doc.body, "#" + id)[0] || null,
    querySelector: (sel: string) => query(doc.body, sel)[0] || null,
    querySelectorAll: (sel: string) => query(doc.body, sel),
  };
  currentDoc = doc;
  return doc;
}
