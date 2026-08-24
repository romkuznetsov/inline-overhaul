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
  removeChild(c: StubNode): StubNode;
  remove(): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  removeAttribute(k: string): void;
  addEventListener(t: string, fn: (ev: any) => void): void;
  removeEventListener(): void;
  dispatch(t: string, ev?: any): void;
  click(): void;
  focus(): void;
  blur(): void;
  createEl(tag: string, o?: { text?: string; cls?: string }): StubNode;
  createDiv(o?: { text?: string; cls?: string }): StubNode;
  createSpan(o?: { text?: string; cls?: string }): StubNode;
  empty(): void;
  setText(t: string): void;
  querySelector(sel: string): StubNode | null;
  querySelectorAll(sel: string): StubNode[];
}

let created = 0;
export const nodeCount = () => created;

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
      const i = ref ? node.children.indexOf(ref) : -1;
      if (i < 0) node.children.push(c); else node.children.splice(i, 0, c);
      (c as any).parent = node;
      return c;
    },
    insertAdjacentElement(where: string, other: StubNode) {
      if (!node.parent) return other;
      const i = node.parent.children.indexOf(node);
      node.parent.children.splice(where === "afterend" ? i + 1 : i, 0, other);
      (other as any).parent = node.parent;
      return other;
    },
    removeChild(c: StubNode) {
      const i = node.children.indexOf(c);
      if (i >= 0) node.children.splice(i, 1);
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
    focus() { /* заглушка */ },
    blur() { /* заглушка */ },

    /* API Obsidian на элементах */
    createEl(t: string, o?: { text?: string; cls?: string }) {
      const c = makeNode(t);
      if (o && o.text) (c as any).textContent = o.text;
      if (o && o.cls) c.className = o.cls;
      node.appendChild(c);
      return c;
    },
    createDiv(o?: { text?: string; cls?: string }) { return node.createEl("div", o); },
    createSpan(o?: { text?: string; cls?: string }) { return node.createEl("span", o); },
    empty() { node.children.length = 0; node.ownText = ""; },
    setText(t: string) { (node as any).textContent = t; },

    querySelector(sel: string) { return query(node, sel)[0] || null; },
    querySelectorAll(sel: string) { return query(node, sel); },
  };

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

function matches(n: StubNode, sel: string): boolean {
  if (sel.startsWith(".")) return n.classList.contains(sel.slice(1).split(/[.[]/)[0] as string);
  if (sel.startsWith("#")) return n.getAttribute("id") === sel.slice(1);
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

export function makeDocument() {
  const doc: any = {
    body: makeNode("body"),
    createElement: (t: string) => makeNode(t),
    createTextNode: (t: string) => { const n = makeNode("#text") as any; n.textContent = String(t); return n; },
    getElementById: (id: string) => null as StubNode | null,
    querySelector: (sel: string) => query(doc.body, sel)[0] || null,
    querySelectorAll: (sel: string) => query(doc.body, sel),
  };
  return doc;
}
