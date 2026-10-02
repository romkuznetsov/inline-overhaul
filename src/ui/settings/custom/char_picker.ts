/**
 * Выбиралка знака: эмодзи, символы Unicode, рожицы (`В-182`, 2026-09-22) —
 * одна на Binder и Field `element`; только кладёт знак в поле, поле остаётся
 * полем. Эмодзи и символы — `pick_data.ts` (генератор
 * `tools/build/gen_pick_data.js`), рубрики строками в одной прокрутке
 * (2026-09-23). Английское имя знака — подпись, слово поиска и имя команды
 * Binder (п. 9.4), одно на три дела.
 */

import { el, btn, type El, type ElInput } from "./dom.ts";
import { EMOJI_GROUPS, SYMBOL_GROUPS, type PickGroup } from "./pick_data.ts";

export type PickKind = "emoji" | "symbols" | "faces";
export type PickItem = readonly [string, string];
export type { PickGroup };

/** Текстовые рожицы, вкладка `Kaomoji`: их пишет человек, генератор их не знает. */
const FACES: readonly PickItem[] = [
  ["(◕‿◕)", "Happy face"], ["¯\\_(ツ)_/¯", "Shrug"], ["(╯°□°)╯︵ ┻━┻", "Table flip"],
  ["┬─┬ノ( º _ ºノ)", "Table back"], ["( ͡° ͜ʖ ͡°)", "Lenny face"], ["ಠ_ಠ", "Disapproval"],
  ["(•_•)", "Blank stare"], ["(ಥ﹏ಥ)", "Tears"], ["ʕ•ᴥ•ʔ", "Little bear"],
  ["(づ｡◕‿‿◕｡)づ", "Hug"], ["ヽ(•‿•)ノ", "Cheer"], ["(¬‿¬)", "Smirk"],
  ["(⌐■_■)", "Deal with it"], ["(✿◠‿◠)", "Flower smile"], ["(^_^)", "Smile"],
  ["(>_<)", "Wince"], ["(T_T)", "Cry"], ["(o_O)", "Surprise"],
  ["(-_-)", "Meh"], ["(*^▽^*)", "Joy"], ["(｡◕‿◕｡)", "Cute"],
  ["ᕕ( ᐛ )ᕗ", "Walk away"], ["(☞ﾟヮﾟ)☞", "Point"], ["✌(◕‿-)✌", "Peace"],
];
/* Рожица длиннее клетки и берёт строку сетки на несколько колонок. */
const WIDE = new Set(FACES.map(f => f[0]));

export const PICK_SETS: Readonly<Record<PickKind, readonly PickGroup[]>> = {
  emoji: EMOJI_GROUPS,
  symbols: SYMBOL_GROUPS,
  faces: [{ title: "", items: FACES }],
};

/** Все знаки вкладки подряд, без рубрик. */
export function pickItems(kind: PickKind): readonly PickItem[] {
  return PICK_SETS[kind].flatMap(g => g.items);
}

/** Имя знака из выбиралки или пусто: окно Binder спрашивает его и у набранного руками. */
export function pickName(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "";
  for (const kind of Object.keys(PICK_SETS) as PickKind[]) {
    for (const [char, name] of pickItems(kind)) if (char === t) return name;
  }
  return "";
}

/** Найденное по знаку или слову имени, с непустыми рубриками; пустой запрос — вся вкладка. */
export function pickFilter(kinds: readonly PickKind[], tab: PickKind, query: string): readonly PickGroup[] {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return PICK_SETS[tab];
  const out: PickGroup[] = [];
  for (const kind of kinds) {
    for (const g of PICK_SETS[kind]) {
      const items = g.items.filter(item => item[0] === q || item[1].toLowerCase().includes(q));
      if (items.length) out.push({ title: g.title, items });
    }
  }
  return out;
}

export interface PickerOpts {
  /** Вкладки по порядку. Одна — полосы вкладок нет. */
  kinds: readonly PickKind[];
  /** Подписи: вкладки `PICK_EMOJI`/`PICK_SYMBOLS`/`PICK_FACES`, поиск `PICK_SEARCH`, пусто `PICK_EMPTY`. */
  say: (name: string) => string;
  onPick: (char: string, name: string) => void;
  /** Взять `Escape`, пока раскрыта; возвращает, как отдать обратно. Нет — клавиша окну. */
  holdKeys?: (onEscape: () => void) => () => void;
}

/** То немногое от `Scope` и `app.keymap` Obsidian, что нужно выбиралке. */
interface ScopeLike { register(mods: string[], key: string, fn: () => boolean | void): unknown }
type ScopeCtor = new (parent?: unknown) => ScopeLike;
interface KeymapLike { pushScope(scope: unknown): void; popScope(scope: unknown): void }

/**
 * Своя область клавиш: `Escape` сворачивает выбиралку и гаснет — keymap гасит
 * обработчик, вернувший `false` (`onKeyEvent`, `app.js` 1.13.7). Остальное —
 * `parent`. Нет `Scope`/`keymap` — проба, без своей клавиши.
 */
export function escapeScope(Scope: unknown, app: unknown, parent?: unknown): PickerOpts["holdKeys"] {
  const keymap = (app as { keymap?: KeymapLike } | null | undefined)?.keymap;
  if (typeof Scope !== "function" || !keymap || typeof keymap.pushScope !== "function") return undefined;
  return (onEscape: () => void) => {
    const scope = new (Scope as ScopeCtor)(parent);
    scope.register([], "Escape", () => { onEscape(); return false; });
    keymap.pushScope(scope);
    return () => { keymap.popScope(scope); };
  };
}

/** Вкладки для всех мест; порядок задан 2026-09-30, открывается первая. */
export const PICK_ALL: readonly PickKind[] = ["emoji", "symbols", "faces"];

const TAB_TEXT: Readonly<Record<PickKind, string>> = {
  emoji: "PICK_EMOJI",
  symbols: "PICK_SYMBOLS",
  faces: "PICK_FACES",
};

/**
 * Выбиралка под полем: раскрывается по нажатию или фокусу (п. 10),
 * сворачивается выбором или уходом фокуса. `Escape` сворачивает её одну
 * (`В-196`): keymap слушает `keydown` на окне с перехватом (`app.js` 1.13.7)
 * раньше поля, поэтому поверх ставится своя область (`holdKeys`, `escapeScope`).
 * `host` — строка настройки, панель встаёт последним ребёнком (`flex-wrap`);
 * без позиционирования — слой поверх обрезался бы краем окна.
 */
export function attachPicker(input: ElInput, host: El, o: PickerOpts): { close: () => void } {
  const panel = el(host, "div", "io-pick");
  panel.hidden = true;
  /* Промах между кнопками уводит фокус на панель, а не закрывает её. */
  panel.tabIndex = -1;

  let tab: PickKind = o.kinds[0] || "emoji";
  let query = "";

  /* Вкладки не пересобираются: пересобранная кнопка уносит фокус. */
  const tabs = o.kinds.length > 1 ? el(panel, "div", "io-pick__tabs") : null;
  const tabButtons: Array<[PickKind, El]> = [];
  const search = panel.createEl("input", {
    cls: "io-pick__search",
    type: "search",
    placeholder: o.say("PICK_SEARCH"),
    attr: { "aria-label": o.say("PICK_SEARCH") },
  }) as ElInput;
  const grid = el(panel, "div", "io-pick__grid");

  if (tabs) {
    for (const kind of o.kinds) {
      const b = btn(tabs, "io-pick__tab", { text: o.say(TAB_TEXT[kind]), label: o.say(TAB_TEXT[kind]) });
      b.addEventListener("click", (() => {
        tab = kind;
        query = "";
        search.value = "";
        draw();
      }) as never);
      tabButtons.push([kind, b]);
    }
  }

  const draw = (): void => {
    for (const [kind, b] of tabButtons) {
      if (kind === tab && !query) b.classList.add("is-active");
      else b.classList.remove("is-active");
    }
    grid.empty();
    const groups = pickFilter(o.kinds, tab, query);
    if (!groups.length) el(grid, "div", "io-pick__empty", o.say("PICK_EMPTY"));
    for (const g of groups) {
      if (g.title) el(grid, "div", "io-pick__head", g.title);
      for (const [char, name] of g.items) {
        /* Широкая — по списку рожиц, не по длине: эмодзи семьи длинный, но один знак. */
        const cell = btn(grid, "io-pick__item" + (WIDE.has(char) ? " io-pick__item--wide" : ""), {
          text: char,
          label: name,
        });
        cell.addEventListener("click", (() => {
          o.onPick(char, name);
          close();
        }) as never);
      }
    }
  };

  const { close } = attachPopup(input, panel, { draw, ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}) });

  search.addEventListener("input", (() => {
    query = search.value;
    draw();
  }) as never);

  return { close };
}

/** Документ поля: на нём слушается нажатие мыши, пока панель раскрыта. */
type EventHost = {
  addEventListener?: (type: string, f: () => void, capture: boolean) => void;
  removeEventListener?: (type: string, f: () => void, capture: boolean) => void;
};

/** Раскрывающаяся панель под полем — одна на выбиралку знака и Prefix. */
export function attachPopup(input: ElInput, panel: El, o: {
  draw: () => void;
  holdKeys?: (onEscape: () => void) => () => void;
}): { close: () => void } {
  /* Как отдать `Escape` обратно окну; пусто — клавиша не взята. */
  let release: (() => void) | null = null;
  const open = (): void => {
    if (!panel.hidden) return;
    panel.hidden = false;
    o.draw();
    if (o.holdKeys && !release) release = o.holdKeys(close);
    if (doc && typeof doc.addEventListener === "function") {
      doc.addEventListener("mousedown", onPress, true);
      doc.addEventListener("mouseup", onRelease, true);
    }
  };
  /* Любое сворачивание отдаёт `Escape`: забытая область глотала бы клавишу. */
  const close = (): void => {
    panel.hidden = true;
    if (doc && typeof doc.removeEventListener === "function") {
      doc.removeEventListener("mousedown", onPress, true);
      doc.removeEventListener("mouseup", onRelease, true);
    }
    if (release) {
      const give = release;
      release = null;
      give();
    }
  };

  input.addEventListener("focus", open as never);
  input.addEventListener("click", open as never);

  /* `relatedTarget` — куда уходит фокус; в панель или поле — не закрывать. */
  const inside = (to: unknown): boolean => {
    const probe = panel as unknown as { contains?: (n: unknown) => boolean };
    return Boolean(to) && (to === input || (typeof probe.contains === "function" && probe.contains(to)));
  };
  /* Ушёл нажатием мыши — свернуть после щелчка: сжатое окно уводило отпускание
     мимо кнопки (B19, стенд `binder-add`). `:active` в `focusout` ещё ложен. */
  const doc = (input as unknown as { ownerDocument?: EventHost }).ownerDocument || null;
  let pressed = false;
  const onPress = (): void => { pressed = true; };
  const onRelease = (): void => {
    pressed = false;
    if (waiting) { waiting = false; setTimeout(close, 0); }
  };
  let waiting = false;
  const onLeave = (ev: { relatedTarget?: unknown }): void => {
    if (inside(ev && ev.relatedTarget)) return;
    if (pressed) { waiting = true; return; }
    close();
  };
  input.addEventListener("focusout", onLeave as never);
  panel.addEventListener("focusout", onLeave as never);

  return { close };
}
