/**
 * Выбиралка знака: эмодзи, символы Unicode, текстовые рожицы (`В-182`).
 *
 * Его пункты 9 и 10 от 2026-09-22: в окне новой команды Binder у `Inserts` —
 * «выпадающий список с вкладками… кликабельные примеры для упрощения выбора
 * (он по прежнему может вписать что угодно)», и то же у знака Field типа
 * `element`, только с одними эмодзи. Его ответ на `В-182` — «одна на оба
 * места», поэтому модуль один, а зовут его два блока.
 *
 * Вписать своё можно всегда: выбиралка только кладёт знак в поле, поле
 * остаётся полем.
 *
 * **Знаков — столько же, сколько в панели эмодзи Windows 11, и под рубриками**
 * (его слово 2026-09-23, тест 1 заметки). Эмодзи и символы лежат в
 * `pick_data.ts`, его пишет генератор `tools/build/gen_pick_data.js` из данных
 * Unicode; рожицы — здесь, их пишет человек. Рубрика — строка над знаками
 * внутри той же прокрутки, а не вкладка: «должна по прежнему остаться одна
 * скроллящаяся форма».
 *
 * У каждого знака есть английское имя. Оно же — подпись кнопки, слово для
 * поиска и имя команды, которое окно Binder предлагает само (его пункт 9.4:
 * «при `→` должно быть `Arrow right`»). Одно имя на три дела нарочно: имя,
 * которое человек видит при наведении, и имя, которое окно подставит, не
 * могут разойтись.
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

/**
 * Что показать по запросу: знак или слово имени; пустой запрос — вся вкладка.
 * Рубрики остаются и в найденном — пустые уходят, — чтобы человек видел,
 * откуда знак.
 */
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
  /**
   * Взять `Escape` себе, пока выбиралка раскрыта: зовётся на раскрытии с тем,
   * что делать по клавише, и возвращает, как отдать её обратно. Нет —
   * `Escape` уходит окну, как до выбиралки (заглушка гейта, проверки).
   */
  holdKeys?: (onEscape: () => void) => () => void;
}

/** То немногое от `Scope` и `app.keymap` Obsidian, что нужно выбиралке. */
interface ScopeLike { register(mods: string[], key: string, fn: () => boolean | void): unknown }
type ScopeCtor = new (parent?: unknown) => ScopeLike;
interface KeymapLike { pushScope(scope: unknown): void; popScope(scope: unknown): void }

/**
 * Своя область клавиш поверх окна: `Escape` в ней сворачивает выбиралку и
 * дальше не идёт — обработчик, вернувший `false`, keymap Obsidian гасит
 * (`preventDefault` и `stopPropagation` в `onKeyEvent`, `app.js` 1.13.7).
 * Остальные клавиши уходят `parent`: у окна Binder это его собственная
 * область, у окна настроек — область приложения, где живут хоткеи.
 *
 * Нет класса или `keymap` — ответ «нет», и выбиралка остаётся без своей
 * клавиши (проба платформы: ответ «нет» — это ответ).
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

const TAB_TEXT: Readonly<Record<PickKind, string>> = {
  emoji: "PICK_EMOJI",
  symbols: "PICK_SYMBOLS",
  faces: "PICK_FACES",
};

/**
 * Повесить выбиралку на поле ввода. Раскрывается под полем, когда в него
 * нажали или перешли клавишей (его пункт 10: «при нажатии на панель ввода»),
 * и сворачивается, когда знак выбран или фокус ушёл за пределы поля и
 * выбиралки.
 *
 * **`Escape` сворачивает одну выбиралку** (`В-196`, его ответ 2026-09-23), а
 * второй — окно. Клавиши Obsidian слушает на окне с перехватом
 * (`window.addEventListener("keydown", …, !0)` в `app.js` 1.13.7, класс
 * keymap) и отдаёт их **верхней** области — окну Binder или окну настроек —
 * раньше, чем событие дойдёт до поля; остановить его в поле нельзя. Поэтому,
 * пока выбиралка раскрыта, поверх ставится своя область (`holdKeys`), а
 * блоки платформы не знают: область собирает тот, кто знает, — помощником
 * `escapeScope` ниже.
 *
 * `host` — строка настройки: панель встаёт в неё последним ребёнком и
 * переносится на свою строчку, как подсказка (`flex-wrap` у `.io-item`).
 * Своего позиционирования у неё нет нарочно — выпадающий слой поверх окна
 * обрезается краем модального окна и панели настроек.
 */
export function attachPicker(input: ElInput, host: El, o: PickerOpts): { close: () => void } {
  const panel = el(host, "div", "io-pick");
  panel.hidden = true;
  /* Нажатие в промежуток между кнопками уводит фокус на саму панель, а не в
     пустоту: иначе выбиралка закрывалась бы от промаха мимо знака. */
  panel.tabIndex = -1;

  let tab: PickKind = o.kinds[0] || "emoji";
  let query = "";
  /* Как отдать `Escape` обратно окну; пусто — клавиша не взята. */
  let release: (() => void) | null = null;

  /* Кнопки вкладок заводятся один раз и не пересобираются: пересобранная
     кнопка уносит фокус с собой, и уход фокуса наружу выбиралка бы не узнала. */
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
        /* Широкая клетка — у рожицы, а не у длинной строки: эмодзи семьи или
           профессии длиннее трёх кодовых единиц и остаётся одним знаком. */
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

  const open = (): void => {
    if (!panel.hidden) return;
    panel.hidden = false;
    draw();
    if (o.holdKeys && !release) release = o.holdKeys(close);
  };
  /* Сворачивание отдаёт `Escape` окну всегда, каким бы путём оно ни пришло:
     забытая область глотала бы клавишу и после того, как окна не стало. */
  const close = (): void => {
    panel.hidden = true;
    if (release) {
      const give = release;
      release = null;
      give();
    }
  };

  search.addEventListener("input", (() => {
    query = search.value;
    draw();
  }) as never);

  input.addEventListener("focus", open as never);
  input.addEventListener("click", open as never);

  /* Фокус ушёл — закрыть, если только он не ушёл внутрь выбиралки или обратно
     в поле. `relatedTarget` — куда уходит фокус; спрашивается у браузера. */
  const inside = (to: unknown): boolean => {
    const probe = panel as unknown as { contains?: (n: unknown) => boolean };
    return Boolean(to) && (to === input || (typeof probe.contains === "function" && probe.contains(to)));
  };
  const onLeave = (ev: { relatedTarget?: unknown }): void => {
    if (!inside(ev && ev.relatedTarget)) close();
  };
  input.addEventListener("focusout", onLeave as never);
  panel.addEventListener("focusout", onLeave as never);

  return { close };
}
