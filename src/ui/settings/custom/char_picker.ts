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
 * У каждого знака есть английское имя. Оно же — подпись кнопки, слово для
 * поиска и имя команды, которое окно Binder предлагает само (его пункт 9.4:
 * «при `→` должно быть `Arrow right`»). Одно имя на три дела нарочно: имя,
 * которое человек видит при наведении, и имя, которое окно подставит, не
 * могут разойтись.
 */

import { el, btn, type El, type ElInput } from "./dom.ts";

export type PickKind = "emoji" | "symbols" | "faces";
export type PickItem = readonly [string, string];

export const PICK_SETS: Readonly<Record<PickKind, readonly PickItem[]>> = {
  emoji: [
    ["😀", "Grinning face"], ["😂", "Tears of joy"], ["🙂", "Slight smile"], ["😉", "Wink"],
    ["😍", "Heart eyes"], ["🤔", "Thinking"], ["😎", "Cool"], ["😴", "Sleeping"],
    ["😢", "Crying"], ["😡", "Angry"], ["🤯", "Mind blown"], ["🥳", "Party"],
    ["👍", "Thumbs up"], ["👎", "Thumbs down"], ["👏", "Clap"], ["🙏", "Pray"],
    ["💪", "Muscle"], ["👀", "Eyes"], ["🧠", "Brain"], ["❤️", "Red heart"],
    ["💔", "Broken heart"], ["⭐", "Star"], ["🌟", "Glowing star"], ["✨", "Sparkles"],
    ["🔥", "Fire"], ["💥", "Collision"], ["⚡", "Lightning"], ["💡", "Idea"],
    ["📌", "Pin"], ["📍", "Round pin"], ["📎", "Paperclip"], ["🔗", "Link"],
    ["📅", "Calendar"], ["📆", "Tear-off calendar"], ["🗓️", "Spiral calendar"], ["⏰", "Alarm clock"],
    ["⏳", "Hourglass"], ["⌛", "Hourglass done"], ["🕐", "Clock"], ["⏱️", "Stopwatch"],
    ["✅", "Check mark button"], ["☑️", "Check box"], ["✔️", "Check mark"], ["❌", "Cross mark"],
    ["❎", "Cross button"], ["❓", "Question"], ["❔", "White question"], ["❗", "Exclamation"],
    ["‼️", "Double exclamation"], ["⚠️", "Warning"], ["🚫", "Prohibited"], ["⛔", "No entry"],
    ["🛑", "Stop sign"], ["🔴", "Red circle"], ["🟠", "Orange circle"], ["🟡", "Yellow circle"],
    ["🟢", "Green circle"], ["🔵", "Blue circle"], ["🟣", "Purple circle"], ["⚫", "Black circle"],
    ["⚪", "White circle"], ["🟥", "Red square"], ["🟩", "Green square"], ["🟦", "Blue square"],
    ["🏁", "Finish flag"], ["🚩", "Red flag"], ["🎯", "Target"], ["🏆", "Trophy"],
    ["🥇", "Gold medal"], ["🎉", "Celebration"], ["🎁", "Gift"], ["📝", "Memo"],
    ["✏️", "Pencil"], ["🖊️", "Pen"], ["📖", "Open book"], ["📚", "Books"],
    ["📓", "Notebook"], ["📄", "Page"], ["📁", "Folder"], ["📂", "Open folder"],
    ["🗂️", "Card index"], ["🗃️", "Card box"], ["📦", "Package"], ["📥", "Inbox"],
    ["📤", "Outbox"], ["📧", "Email"], ["💬", "Speech bubble"], ["💭", "Thought bubble"],
    ["📢", "Loudspeaker"], ["🔔", "Bell"], ["🔕", "Bell off"], ["🔒", "Locked"],
    ["🔓", "Unlocked"], ["🔑", "Key"], ["🔍", "Magnifier"], ["⚙️", "Gear"],
    ["🛠️", "Tools"], ["🔧", "Wrench"], ["🔨", "Hammer"], ["🧪", "Test tube"],
    ["🧩", "Puzzle"], ["🐛", "Bug"], ["🚀", "Rocket"], ["✈️", "Airplane"],
    ["🚗", "Car"], ["🏠", "House"], ["🏢", "Office"], ["🏥", "Hospital"],
    ["🏫", "School"], ["🛒", "Cart"], ["💰", "Money bag"], ["💵", "Banknote"],
    ["💳", "Credit card"], ["📈", "Chart up"], ["📉", "Chart down"], ["📊", "Bar chart"],
    ["🧾", "Receipt"], ["👤", "Person"], ["👥", "People"], ["🤝", "Handshake"],
    ["📞", "Phone"], ["📱", "Mobile"], ["💻", "Laptop"], ["🌐", "Globe"],
    ["☀️", "Sun"], ["🌙", "Moon"], ["☁️", "Cloud"], ["❄️", "Snowflake"],
    ["🌈", "Rainbow"], ["🌱", "Seedling"], ["🌳", "Tree"], ["🍀", "Clover"],
    ["🍎", "Apple"], ["☕", "Coffee"], ["🎵", "Music"], ["🎬", "Clapper"],
    ["🎮", "Game"], ["📷", "Camera"], ["🎨", "Palette"], ["🏃", "Runner"],
    ["💤", "Zzz"], ["🔄", "Repeat"], ["♻️", "Recycle"], ["➕", "Plus"],
    ["➖", "Minus"], ["🆕", "New"], ["🆗", "OK"], ["💯", "Hundred"],
  ],
  symbols: [
    ["→", "Arrow right"], ["←", "Arrow left"], ["↑", "Arrow up"], ["↓", "Arrow down"],
    ["↔", "Arrow left right"], ["↕", "Arrow up down"], ["⇒", "Double arrow right"], ["⇐", "Double arrow left"],
    ["⇔", "Double arrow left right"], ["↗", "Arrow up right"], ["↘", "Arrow down right"], ["↩", "Return arrow"],
    ["⟶", "Long arrow right"], ["➜", "Heavy arrow right"], ["▶", "Triangle right"], ["◀", "Triangle left"],
    ["▲", "Triangle up"], ["▼", "Triangle down"], ["•", "Bullet"], ["·", "Middle dot"],
    ["○", "White circle mark"], ["●", "Black circle mark"], ["◆", "Diamond"], ["◇", "White diamond"],
    ["■", "Black square"], ["□", "White square"], ["★", "Black star"], ["☆", "White star"],
    ["✓", "Tick"], ["✗", "Ballot x"], ["±", "Plus minus"], ["×", "Multiplication"],
    ["÷", "Division"], ["≈", "Almost equal"], ["≠", "Not equal"], ["≤", "Less or equal"],
    ["≥", "Greater or equal"], ["∞", "Infinity"], ["√", "Square root"], ["∑", "Sum"],
    ["∆", "Delta"], ["π", "Pi"], ["°", "Degree"], ["‰", "Per mille"],
    ["№", "Numero"], ["§", "Section"], ["¶", "Pilcrow"], ["†", "Dagger"],
    ["©", "Copyright"], ["®", "Registered"], ["™", "Trademark"], ["€", "Euro"],
    ["£", "Pound"], ["¥", "Yen"], ["₽", "Ruble"], ["₸", "Tenge"],
    ["—", "Em dash"], ["–", "En dash"], ["…", "Ellipsis"], ["«", "Left guillemet"],
    ["»", "Right guillemet"], ["„", "Low quote"], ["“", "Left quote"], ["”", "Right quote"],
    ["♠", "Spade"], ["♣", "Club"], ["♥", "Heart suit"], ["♦", "Diamond suit"],
    ["♪", "Note"], ["☐", "Ballot box"], ["☑", "Ballot box checked"], ["☒", "Ballot box x"],
    ["⌘", "Command key"], ["⌥", "Option key"], ["⇧", "Shift key"], ["⏎", "Enter key"],
  ],
  faces: [
    ["(◕‿◕)", "Happy face"], ["¯\\_(ツ)_/¯", "Shrug"], ["(╯°□°)╯︵ ┻━┻", "Table flip"],
    ["┬─┬ノ( º _ ºノ)", "Table back"], ["( ͡° ͜ʖ ͡°)", "Lenny face"], ["ಠ_ಠ", "Disapproval"],
    ["(•_•)", "Neutral face"], ["(ಥ﹏ಥ)", "Tears"], ["ʕ•ᴥ•ʔ", "Bear"],
    ["(づ｡◕‿‿◕｡)づ", "Hug"], ["ヽ(•‿•)ノ", "Cheer"], ["(¬‿¬)", "Smirk"],
    ["(⌐■_■)", "Deal with it"], ["(✿◠‿◠)", "Flower smile"], ["(^_^)", "Smile"],
    ["(>_<)", "Wince"], ["(T_T)", "Cry"], ["(o_O)", "Surprise"],
    ["(-_-)", "Meh"], ["(*^▽^*)", "Joy"], ["(｡◕‿◕｡)", "Cute"],
    ["ᕕ( ᐛ )ᕗ", "Walk away"], ["(☞ﾟヮﾟ)☞", "Point"], ["✌(◕‿-)✌", "Peace"],
  ],
};

/** Имя знака из выбиралки или пусто: окно Binder спрашивает его и у набранного руками. */
export function pickName(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "";
  for (const kind of Object.keys(PICK_SETS) as PickKind[]) {
    for (const [char, name] of PICK_SETS[kind]) if (char === t) return name;
  }
  return "";
}

/** Что показать по запросу: знак или слово имени; пустой запрос — вся вкладка. */
export function pickFilter(kinds: readonly PickKind[], tab: PickKind, query: string): readonly PickItem[] {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return PICK_SETS[tab];
  const out: PickItem[] = [];
  for (const kind of kinds) {
    for (const item of PICK_SETS[kind]) {
      if (item[0] === q || item[1].toLowerCase().includes(q)) out.push(item);
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
 * **`Escape` она не трогает, и это нарочно.** Клавиши Obsidian слушает на
 * окне с перехватом (`window.addEventListener("keydown", …, !0)` в `app.js`
 * 1.13.7, класс keymap) и отдаёт их верхней области — окну Binder или окну
 * настроек, — раньше, чем событие дойдёт до поля. Остановить его в поле
 * нельзя; свернуть одну выбиралку можно только своей областью поверх
 * (`app.keymap.pushScope`), а блоки платформы не знают. Цена названа:
 * `Escape` закрывает окно так же, как до выбиралки.
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
    const items = pickFilter(o.kinds, tab, query);
    if (!items.length) el(grid, "div", "io-pick__empty", o.say("PICK_EMPTY"));
    for (const [char, name] of items) {
      const cell = btn(grid, "io-pick__item" + (char.length > 3 ? " io-pick__item--wide" : ""), {
        text: char,
        label: name,
      });
      cell.addEventListener("click", (() => {
        o.onPick(char, name);
        close();
      }) as never);
    }
  };

  const open = (): void => {
    if (!panel.hidden) return;
    panel.hidden = false;
    draw();
  };
  const close = (): void => { panel.hidden = true; };

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
