/**
 * Мок модуля obsidian для гейтов слоя настроек (PRD фаза 0, пункт 7).
 *
 * Настолько похож на настоящий, насколько нужно гейтам: `Setting` строит
 * узлы в заглушке DOM, `PluginSettingTab` умеет декларативный путь 1.13
 * (`getSettingDefinitions`, `getControlValue`, `setControlValue`), `Notice`
 * и `Modal` запоминают, что их показали.
 *
 * Чего мок сознательно НЕ делает: не воспроизводит вёрстку и разметку
 * Obsidian. Гейт проверяет схему, тексты и то, что панель строится без
 * исключений, а не то, как она выглядит.
 */

import { makeNode, makeDocument, type StubNode } from "./dom_stub.ts";

export const notices: string[] = [];
export const modalsOpened: string[] = [];

export class Notice {
  message: string;
  duration: number | undefined;
  constructor(message: string, duration?: number) {
    this.message = String(message);
    this.duration = duration;
    notices.push(this.message);
  }
  hide(): void { /* заглушка */ }
}

export class Modal {
  contentEl: StubNode = makeNode("div");
  titleEl: StubNode = makeNode("div");
  app: any;
  constructor(app: any) { this.app = app; }
  open(): void { modalsOpened.push(this.constructor.name); this.onOpen(); }
  close(): void { this.onClose(); }
  onOpen(): void { /* переопределяется */ }
  onClose(): void { /* переопределяется */ }
}

/** Цепочка, которую Obsidian даёт при императивном построении настройки. */
export class Setting {
  nameEl: StubNode;
  descEl: StubNode;
  controlEl: StubNode;
  settingEl: StubNode;
  components: any[] = [];
  isHeading = false;
  disabled = false;

  containerEl: StubNode;
  constructor(containerEl: StubNode) {
    this.containerEl = containerEl;
    this.settingEl = containerEl.createEl("div", { cls: "setting-item" });
    const info = this.settingEl.createEl("div", { cls: "setting-item-info" });
    this.nameEl = info.createEl("div", { cls: "setting-item-name" });
    this.descEl = info.createEl("div", { cls: "setting-item-description" });
    this.controlEl = this.settingEl.createEl("div", { cls: "setting-item-control" });
  }

  setName(v: string): this { this.nameEl.textContent = v; return this; }
  setDesc(v: string): this { this.descEl.textContent = v; return this; }
  setHeading(): this { this.isHeading = true; this.settingEl.classList.add("setting-item-heading"); return this; }
  setClass(c: string): this { this.settingEl.classList.add(c); return this; }
  setTooltip(t: string): this { this.settingEl.setAttribute("aria-label", t); return this; }
  setDisabled(v: boolean): this { this.disabled = v; return this; }
  then(cb: (s: this) => void): this { cb(this); return this; }

  private add<T>(comp: T): this { this.components.push(comp); return this; }

  addToggle(cb: (t: ToggleComponent) => void): this {
    const t = new ToggleComponent(this.controlEl); cb(t); return this.add(t);
  }
  addText(cb: (t: TextComponent) => void): this {
    const t = new TextComponent(this.controlEl); cb(t); return this.add(t);
  }
  addTextArea(cb: (t: TextComponent) => void): this {
    const t = new TextComponent(this.controlEl); cb(t); return this.add(t);
  }
  addDropdown(cb: (t: DropdownComponent) => void): this {
    const t = new DropdownComponent(this.controlEl); cb(t); return this.add(t);
  }
  addSlider(cb: (t: SliderComponent) => void): this {
    const t = new SliderComponent(this.controlEl); cb(t); return this.add(t);
  }
  addButton(cb: (t: ButtonComponent) => void): this {
    const t = new ButtonComponent(this.controlEl); cb(t); return this.add(t);
  }
  addExtraButton(cb: (t: ButtonComponent) => void): this {
    const t = new ButtonComponent(this.controlEl); cb(t); return this.add(t);
  }
  addColorPicker(cb: (t: TextComponent) => void): this {
    const t = new TextComponent(this.controlEl); cb(t); return this.add(t);
  }
}

class BaseComponent {
  el: StubNode;
  disabled = false;
  constructor(parent: StubNode, tag: string) { this.el = parent.createEl(tag); }
  setDisabled(v: boolean): this { this.disabled = v; this.el.disabled = v; return this; }
  setTooltip(t: string): this { this.el.title = t; return this; }
}

export class ToggleComponent extends BaseComponent {
  value = false;
  private handler: ((v: boolean) => any) | null = null;
  constructor(parent: StubNode) {
    super(parent, "input");
    this.el.type = "checkbox";
    /* Как в Obsidian: щелчок по узлу переключает и доводит до обработчика. */
    this.el.addEventListener("click", () => { this.toggle(); });
  }
  setValue(v: boolean): this { this.value = v; this.el.checked = v; return this; }
  getValue(): boolean { return this.value; }
  onChange(cb: (v: boolean) => any): this { this.handler = cb; return this; }
  /** для теста: щёлкнуть тумблер */
  toggle(): void { this.setValue(!this.value); if (this.handler) this.handler(this.value); }
}

export class TextComponent extends BaseComponent {
  value = "";
  private handler: ((v: string) => any) | null = null;
  constructor(parent: StubNode) { super(parent, "input"); this.el.type = "text"; }
  setValue(v: string): this { this.value = v; this.el.value = v; return this; }
  getValue(): string { return this.value; }
  setPlaceholder(p: string): this { this.el.placeholder = p; return this; }
  onChange(cb: (v: string) => any): this { this.handler = cb; return this; }
  type(v: string): void { this.setValue(v); if (this.handler) this.handler(v); }
}

export class DropdownComponent extends BaseComponent {
  value = "";
  options: Record<string, string> = {};
  private handler: ((v: string) => any) | null = null;
  constructor(parent: StubNode) { super(parent, "select"); }
  addOption(v: string, label: string): this { this.options[v] = label; return this; }
  addOptions(o: Record<string, string>): this { Object.assign(this.options, o); return this; }
  setValue(v: string): this { this.value = v; this.el.value = v; return this; }
  getValue(): string { return this.value; }
  onChange(cb: (v: string) => any): this { this.handler = cb; return this; }
  pick(v: string): void { this.setValue(v); if (this.handler) this.handler(v); }
}

export class SliderComponent extends BaseComponent {
  value = 0;
  limits: [number, number, number] = [0, 100, 1];
  private handler: ((v: number) => any) | null = null;
  constructor(parent: StubNode) { super(parent, "input"); this.el.type = "range"; }
  setLimits(min: number, max: number, step: number): this { this.limits = [min, max, step]; return this; }
  setValue(v: number): this { this.value = v; return this; }
  getValue(): number { return this.value; }
  setDynamicTooltip(): this { return this; }
  onChange(cb: (v: number) => any): this { this.handler = cb; return this; }
  drag(v: number): void { this.setValue(v); if (this.handler) this.handler(v); }
}

export class ButtonComponent extends BaseComponent {
  label = "";
  cta = false;
  warning = false;
  private handler: (() => any) | null = null;
  constructor(parent: StubNode) {
    super(parent, "button");
    /* Как в Obsidian: нажатие по узлу доходит до обработчика. Иначе тест
       вынужден звать компонент, а не кнопку, и проверяет не то, что человек. */
    this.el.addEventListener("click", () => { if (this.handler) this.handler(); });
  }
  setButtonText(t: string): this { this.label = t; this.el.textContent = t; return this; }
  setIcon(_i: string): this { return this; }
  setCta(): this { this.cta = true; return this; }
  setWarning(): this { this.warning = true; return this; }
  onClick(cb: () => any): this { this.handler = cb; return this; }
  press(): void { if (this.handler) this.handler(); }
}

/** Вкладка настроек. Поддерживает декларативный путь Obsidian 1.13. */
export class PluginSettingTab {
  containerEl: StubNode = makeNode("div");
  app: any;
  plugin: any;
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  display(): void { /* переопределяется или не нужен при декларативном пути */ }
  hide(): void { /* переопределяется */ }

  /** Obsidian 1.13: описание настроек вместо построения DOM. */
  getSettingDefinitions(): any[] { return []; }
  /** Своё хранилище: читаем из него, а не из plugin.settings. */
  getControlValue(_key: string): unknown { return undefined; }
  /** Своё хранилище: пишем сами и сами сохраняем. */
  async setControlValue(_key: string, _value: unknown): Promise<void> { /* переопределяется */ }
  refreshDomState(): void { /* платформа пересчитывает предикаты */ }
  update(): void { /* платформа обновляет определения и индекс поиска */ }
}

export class Plugin {
  settings: any = {};
  app: any;
  manifest: any;
  constructor(app: any, manifest: any) { this.app = app; this.manifest = manifest; }
  async onload(): Promise<void> { /* переопределяется */ }
  onunload(): void { /* переопределяется */ }
  addCommand(_c: any): any { return _c; }
  addSettingTab(_t: any): void { /* заглушка */ }
  registerEvent(_e: any): void { /* заглушка */ }
  async loadData(): Promise<any> { return {}; }
  async saveData(_d: any): Promise<void> { /* заглушка */ }
}

export function makeApp() {
  return {
    workspace: { getActiveViewOfType: () => null, on: () => ({}) },
    vault: {
      adapter: { exists: async () => false, read: async () => "", write: async () => {} },
      getAbstractFileByPath: () => null,
    },
    metadataTypeManager: undefined,   // недокументированное API: его может не быть
    setting: undefined,               // приватное API: гейт следит, чтобы им не пользовались
  };
}

export function setupGlobals() {
  const doc = makeDocument();
  /* Слушатели на окне и документе: старый рендерер вешает их, чтобы закрывать
     подсказки по щелчку вне них. Без них он ловит исключение и молча теряет
     строку — проверка при этом остаётся зелёной, что хуже падения. */
  const listeners: Record<string, Array<(ev: unknown) => void>> = {};
  const addEventListener = (type: string, fn: (ev: unknown) => void) => {
    (listeners[type] = listeners[type] || []).push(fn);
  };
  const removeEventListener = (type: string, fn: (ev: unknown) => void) => {
    listeners[type] = (listeners[type] || []).filter(x => x !== fn);
  };
  (doc as any).addEventListener = addEventListener;
  (doc as any).removeEventListener = removeEventListener;
  (globalThis as any).document = doc;
  (globalThis as any).window = {
    document: doc,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    addEventListener,
    removeEventListener,
    /* Диалог удаления падает на этот путь, если Modal не передали. */
    confirm: () => true,
    listeners,
  };
  (globalThis as any).requestAnimationFrame = (fn: () => void) => { fn(); return 0; };
  /*
   * Наблюдатель за деревом: старый редактор через него узнаёт, что строка
   * снята с экрана, и доводит незаписанный черновик. Заглушка ничего не
   * наблюдает — в тестах дерево не живёт само, — но её отсутствие ронял
   * отрисовку строки, и падение молча съедалось внутренним try/catch.
   */
  (globalThis as any).MutationObserver = class {
    observe(): void { /* заглушке нечего наблюдать */ }
    disconnect(): void {}
    takeRecords(): unknown[] { return []; }
  };
  (globalThis as any).cancelAnimationFrame = () => {};
  return doc;
}

export { makeNode, type StubNode };
