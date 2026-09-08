"use strict";
/**
 * Переходы по заголовкам и шаг курсора внутри строки (D2, D3).
 *
 * Разрешение В-17 от 2026-09-02, девятое исключение к З3: тронуть
 * `navigation_runtime.js` ради двух правок навигации. Разбор — в
 * `docs/OWNER_REMARKS.md`, сессия 4, раздел E.
 *
 * Проверка на НАСТОЯЩИХ функциях плагина: `jumpToHeader` и `navigateInline`
 * берутся из `navigation_runtime.js`. Подделан только **редактор** — команды
 * работают с открытой заметкой, и другого способа позвать их вне Obsidian нет
 * (У-1). Подделка решений не принимает: она держит строки, курсор и запись
 * обратно.
 *
 * Что закреплено:
 *
 *   1. текст выше первого заголовка — такая же секция, только без строки
 *      заголовка, и переходы работают внутри неё (решение В-20);
 *   2. выше первой строки после frontmatter переход не идёт;
 *   3. шаг `sentence` в строке без конца предложения уходит в начало и конец
 *      зоны, а не пересобирается по словам.
 */

const path = require("path");

/*
 * `navigateInline` ставит курсор через `window.setTimeout`: в Obsidian это
 * окно есть, в Node его нет. Подменяется ровно то, что вызывается, и до
 * загрузки модуля — иначе он падает на первом же шаге.
 */
if (typeof globalThis.window === "undefined") {
  globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
}

const nav = require(path.join(__dirname, "..", "..", "navigation_runtime.js"));

let passed = 0;
function ok(what) { passed++; console.log("  ok " + what); }
function assertArrayEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(name + ": expected " + e + ", got " + a);
  passed++;
  console.log("  ok " + name);
}

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

/**
 * Редактор на несколько строк: только то, что зовут переходы.
 *
 * Курсор ставится асинхронно (`setCursorRobustCentered` повторяет установку
 * через микрозадачу и таймер), поэтому проверка читает его после ожидания.
 */
function fakeEditor(text, cursor) {
  const lines = String(text).split("\n");
  const state = { lines, cursor: { ...cursor } };
  return {
    lastLine: () => state.lines.length - 1,
    getLine: (n) => state.lines[n],
    getCursor: () => ({ ...state.cursor }),
    setCursor: (p) => { state.cursor = { ...p }; },
    setValue: (v) => { state.lines = String(v).split(String.fromCharCode(10)); },
    getScrollInfo: () => ({ top: 0, left: 0 }),
    scrollTo: () => {},
    setSelection: () => {},
    getSelection: () => "",
    setLine: (n, t) => { state.lines[n] = t; },
    replaceRange: () => {},
    posToOffset: (p) => p.ch,
    offsetToPos: (ch) => ({ line: 0, ch }),
    getValue: () => state.lines.join("\n"),
    focus: () => {},
    scrollIntoView: () => {},
    at: () => ({ ...state.cursor }),
  };
}

/** Дать курсору доехать: установка повторяется через таймер. */
const settle = () => new Promise((r) => setTimeout(r, 80));

const NOTE = [
  "первая строка вводного текста",
  "вторая строка вводного текста",
  "",
  "## Первый заголовок",
  "строка первой секции",
  "",
  "## Второй заголовок",
  "строка второй секции",
].join("\n");

const WITH_YAML = ["---", "tags: [a]", "---"].concat(NOTE.split("\n")).join("\n");

const CFG = {
  enabled: true,
  centerCursor: false,
  jumpMode: "edge",
  edgeMode: "start-end",
  jumpCursorPosition: "start",
};

async function jump(text, line, direction, over) {
  const ed = fakeEditor(text, { line, ch: 0 });
  nav.jumpToHeader(ed, direction, Object.assign({}, CFG, over || {}));
  await settle();
  return ed.at().line;
}

(async function run() {
  /* ---- D2: текст выше первого заголовка — секция ------------------------ */

  /*
   * Курсор на второй строке вводного текста. Раньше он считался стоящим в
   * ПЕРВОЙ секции — то есть ниже себя, — и переход назад уводил его на
   * нулевую строку. Теперь он в безымянной секции, и переход назад ведёт к её
   * началу.
   */
  assertEq(await jump(NOTE, 1, "up"), 0,
    "назад из вводного текста — к началу своей же секции");

  /* А из её начала наверх идти некуда: она первая. */
  assertEq(await jump(NOTE, 0, "up"), 0,
    "из начала безымянной секции переход назад не двигает курсор");

  /*
   * Вперёд из вводного текста: `alternate start and end` сначала ведёт к
   * концу своей секции, потом в следующую. Конец безымянной секции — её
   * последняя написанная строка, а не пустая.
   */
  assertEq(await jump(NOTE, 0, "down"), 1,
    "вперёд из начала безымянной секции — к её концу");
  assertEq(await jump(NOTE, 1, "down"), 4,
    "с конца безымянной секции — в следующую секцию");

  /*
   * Назад из первой настоящей секции — в безымянную, а не в нулевую строку.
   * Строка 4 — единственная написанная строка первой секции, то есть сразу и
   * её начало, и её конец: `alternate start and end` уводит из неё в
   * предыдущую секцию, а её конец — строка 1. Прежний код отдал бы 0.
   */
  assertEq(await jump(NOTE, 4, "up"), 1,
    "назад из первой секции — к концу безымянной, а не в начало заметки");
  ok("D2: текст выше первого заголовка участвует в переходах как секция");

  /* ---- D2: выше первой строки после frontmatter не прыгаем -------------- */

  /*
   * У заметки со свойствами безымянная секция начинается после `---`. В
   * прошлой версии откат вёл на строку `yamlEnd`, то есть на закрывающий
   * `---`, и курсор оказывался в свойствах.
   */
  assertEq(await jump(WITH_YAML, 4, "up"), 3,
    "назад из вводного текста — на первую строку после свойств, а не в них");
  assertEq(await jump(WITH_YAML, 3, "up"), 3,
    "и дальше вверх переход не идёт");
  assertEq(await jump(WITH_YAML, 1, "down"), 3,
    "из свойств вперёд — на первую строку после них");
  assertEq(await jump(WITH_YAML, 1, "up"), 1,
    "а вверх из свойств идти некуда, и курсор стоит");
  ok("D2: выше первой строки после свойств заметки переход не идёт");

  /* ---- D2: «строка за строкой» на той же безымянной секции -------------- */

  assertEq(await jump(NOTE, 1, "up", { jumpMode: "line" }), 0,
    "строка за строкой: назад по вводному тексту");
  assertEq(await jump(NOTE, 0, "up", { jumpMode: "line" }), 0,
    "и на его первой строке переход не двигает курсор");
  ok("D2: режим «строка за строкой» работает в безымянной секции");

  /* ---- D3: шаг `sentence` без конца предложения ------------------------- */

  /*
   * Заказчик: «при in-line-step=sentence, если в строке нет конца
   * предложения, поведение как при word, а должен прыгать в начало и конец».
   *
   * Проверяется по остановкам: из середины зоны шаг влево обязан привести к
   * её началу, а не к предыдущему слову.
   */
  const SENT = "- один два три четыре пять";
  const step = async (from, direction) => {
    const ed = fakeEditor(SENT, { line: 0, ch: from });
    nav.navigateInline(ed, direction, { delim: "||", trailingMarkers: [] },
      { stepMode: "sentence", boundaryJump: false, onBoundary: "stay" });
    await settle();
    return ed.at().ch;
  };

  const zoneStart = SENT.indexOf("один");
  const zoneEnd = SENT.length;
  const middle = SENT.indexOf("три");

  assertEq(await step(middle, "left"), zoneStart,
    "без конца предложения шаг влево ведёт в начало зоны, а не к слову");
  assertEq(await step(middle, "right"), zoneEnd,
    "и шаг вправо — в её конец");
  ok("D3: шаг `sentence` без точки уходит в начало и конец зоны");

  /*
   * И обратная сторона: с концом предложения шаг по-прежнему считает
   * предложения, а не зону целиком. Иначе правка подменила бы один режим
   * другим.
   */
  const DOTS = "- один два. три четыре. пять";
  const ed = fakeEditor(DOTS, { line: 0, ch: DOTS.length });
  nav.navigateInline(ed, "left", { delim: "||", trailingMarkers: [] },
    { stepMode: "sentence", boundaryJump: false, onBoundary: "stay" });
  await settle();
  assertEq(ed.at().ch, DOTS.indexOf("четыре.") + "четыре".length,
    "с точками шаг влево встаёт на конец предыдущего предложения");
  ok("D3: с концом предложения режим остаётся собой");

  /* ---- D1: где перемещение заголовка молчит ---------------------------- */

  /*
   * Заказчик: «перемещение заголовков не работает — когда я нахожусь на
   * строке-хедере, Move line up/down не делает ничего (при обоих вариантах
   * move-lines-heading)». На его `Демо строки.md` это не воспроизвелось:
   * движок двигает заголовок в обе стороны.
   *
   * Прогон по формам заметки нашёл ровно две, где движок молчит **в обе
   * стороны**, и обе — на любом заголовке, не только на среднем:
   *
   *   1. выше строки стоит НЕЗАКРЫТЫЙ кодовый блок. Разбор считает
   *      ограждения выше курсора и при нечётном числе считает строку кодом.
   *      По правилам Markdown это верно: незакрытое ограждение и правда
   *      делает кодом всё ниже. Но молчит команда так же, как при дефекте;
   *   2. в заметке один заголовок. Переставлять его некуда: и вверх, и вниз
   *      искать нечего.
   *
   * Пин держит границу: если однажды молчать начнёт что-то ещё, он покраснеет
   * на той форме, а не на всех сразу.
   */
  const moveLineOn = (lines, at, dir, headerMode) => {
    const ed = fakeEditor(lines.join("\n"), { line: at, ch: 0 });
    const before = ed.getValue();
    nav.moveLine(ed, dir, {
      enabled: true, headerMode, noSelectionMode: "line-only",
      crossSectionAllowed: true, highlightMovedLines: false,
    });
    return before !== ed.getValue();
  };

  const both = (lines, at) => [
    moveLineOn(lines, at, "up", "move-as-line"),
    moveLineOn(lines, at, "down", "move-as-line"),
    moveLineOn(lines, at, "up", "move-with-section"),
    moveLineOn(lines, at, "down", "move-with-section"),
  ];

  /* Обычная заметка: средний заголовок двигается всеми четырьмя способами. */
  assertEq(both(["## A", "a1", "## B", "b1", "## C", "c1"], 2).join(","),
    "true,true,true,true",
    "средний заголовок обычной заметки двигается в обе стороны");

  /* Закрытый кодовый блок выше не мешает. */
  assertEq(both(["## A", "```js", "code", "```", "## B", "b1", "## C", "c1"], 4).join(","),
    "true,true,true,true",
    "закрытый кодовый блок выше на перемещение не влияет");

  /* Незакрытый — мешает, и в обе стороны, в любом режиме. */
  assertEq(both(["## A", "```js", "code", "## B", "b1", "## C", "c1"], 3).join(","),
    "false,false,false,false",
    "ниже незакрытого ограждения команда молчит: строка считается кодом");

  /*
   * Единственный заголовок заметки: секцию переставлять некуда, а **строку**
   * есть куда — она уходит вниз, за `a1`, как любая другая строка. Это и есть
   * правка D1: при `Headers only` заголовок ведёт себя как обычная строка
   * (заказчик, 2026-09-02). До неё цель считалась «за соседний заголовок того
   * же уровня» в обоих режимах, соседнего не было — и команда молчала.
   */
  assertEq(both(["## A", "a1", "a2"], 0).join(","), "false,true,false,false",
    "единственный заголовок: как строка идёт вниз, как секция — некуда");

  /*
   * Края. Как **строка** заголовок ходит туда, куда ходит любая строка: у
   * последнего заголовка ниже стоит его собственная `b1`, и вниз он идёт за
   * неё. Как **секция** ему вниз некуда: следующей секции нет.
   */
  assertEq(both(["## A", "a1", "## B", "b1"], 0).join(","), "false,true,false,true",
    "первый заголовок: вверх некуда, вниз двигается");
  assertEq(both(["## A", "a1", "## B", "b1"], 2).join(","), "true,true,true,false",
    "последний заголовок: как строка ходит в обе стороны, как секция — только вверх");
  ok("D1: граница молчания — незакрытое ограждение и секция, которую некуда переставить");

  /*
   * D1, само поведение: при `Headers only` заголовок сдвигается **ровно на
   * одну строку**, а при `Headers with their sections` переезжает вместе со
   * своей секцией. Раньше оба режима считали цель одинаково, и заголовок
   * перелетал через целую секцию в обоих: «перемещается как-то непонятно».
   */
  const moveText = (lines, at, dir, headerMode) => {
    const ed = fakeEditor(lines.join("\n"), { line: at, ch: 0 });
    nav.moveLine(ed, dir, {
      enabled: true, headerMode, noSelectionMode: "line-only",
      crossSectionAllowed: true, highlightMovedLines: false,
    });
    return ed.getValue().split("\n");
  };

  const MOVE_NOTE = ["## A", "a1", "a2", "## B", "b1"];

  assertArrayEq(moveText(MOVE_NOTE, 0, "down", "move-as-line"),
    ["a1", "## A", "a2", "## B", "b1"],
    "Headers only: заголовок вниз — ровно на одну строку");
  assertArrayEq(moveText(MOVE_NOTE, 3, "up", "move-as-line"),
    ["## A", "a1", "## B", "a2", "b1"],
    "Headers only: заголовок вверх — тоже на одну строку");

  assertArrayEq(moveText(MOVE_NOTE, 0, "down", "move-with-section"),
    ["## B", "b1", "## A", "a1", "a2"],
    "Headers with their sections: заголовок уезжает вместе со своей секцией");



  /* ---- перемещение выделенного текста внутри строки --------------------- */

  /*
   * Заказчик (свободное замечание, 2026-09-02):
   *
   *   исходная строка   `- [ ] #/1 #todo || 123 || 📅2026-09-02 20:44`
   *   влево получалось  `- [ ] #/1 #123 || todo || 📅2026-09-02 20:44`
   *   ожидалось         `- [ ] #/1 #todo 123 ||  || 📅2026-09-02 20:44`
   *   ещё раз влево     `- [ ] #/1 123 #todo ||  || 📅2026-09-02 20:44`
   *
   * Единицей перескока был набор «символов слова», поэтому от тега бралось
   * `todo`, а решётка оставалась на месте. Теперь единица — то, что стоит
   * между пробелами, и это же правило заказчик и описал в своём ожидании: с
   * первого нажатия текст перепрыгивает разделитель, со второго — тег
   * целиком. Ссылка ведёт себя так же: `[[test1]]` переставляется вся.
   *
   * Одиннадцатое исключение к З3, разрешение 2026-09-02.
   */
  const moveTextIn = (line, phrase, direction, presses, over, lineFormat) => {
    let text = line;
    for (let n = 0; n < presses; n++) {
      const at = text.indexOf(phrase);
      if (at < 0) throw new Error("переносимый текст пропал: " + text);
      const state = { text, from: { line: 0, ch: at }, to: { line: 0, ch: at + phrase.length } };
      const ed = {
        lastLine: () => 0,
        getLine: () => state.text,
        getValue: () => state.text,
        setValue: (v) => { state.text = String(v); },
        getSelection: () => state.text.slice(state.from.ch, state.to.ch),
        getCursor: (which) => (which === "to" ? { ...state.to } : { ...state.from }),
        setCursor: () => {},
        setSelection: (a, b) => { state.from = { ...a }; state.to = { ...b }; },
        posToOffset: (p) => p.ch,
        offsetToPos: (ch) => ({ line: 0, ch }),
        listSelections: () => [{ anchor: state.from, head: state.to }],
        getScrollInfo: () => ({ top: 0, left: 0 }),
        scrollTo: () => {},
        setLine: (_n, t) => { state.text = String(t); },
        replaceRange: () => {},
        focus: () => {},
        scrollIntoView: () => {},
      };
      nav.moveSelection(ed, direction, Object.assign({
        enabled: true, inlineEnabled: true, inlineMoveMode: "word",
        prefixCyclerEnabled: false, indentFallbackEnabled: false,
      }, over || {}), lineFormat);
      text = state.text;
    }
    return text;
  };

  const TAGGED = "- [ ] #/1 #todo || 123 || 📅2026-09-02 20:44";
  /* Порядок — тот, что заказчик и выписал. Двойного пробела на месте текста
     при этом не остаётся: зазор переезжает вместе с ним. */
  assertEq(moveTextIn(TAGGED, "123", "left", 1),
    "- [ ] #/1 #todo 123 || || 📅2026-09-02 20:44",
    "текст перепрыгивает разделитель целиком, а не влезает в тег");
  assertEq(moveTextIn(TAGGED, "123", "left", 2),
    "- [ ] #/1 123 #todo || || 📅2026-09-02 20:44",
    "второе нажатие переставляет тег целиком, вместе с решёткой");
  ok("перемещение текста не разрывает тег (пример заказчика посимвольно)");

  const LINKED = "- [ ] [[test1]] || 123 || конец";
  assertEq(moveTextIn(LINKED, "123", "left", 2),
    "- [ ] 123 [[test1]] || || конец",
    "ссылка переставляется целиком, а текст не уезжает внутрь скобок");
  ok("перемещение текста не разрывает ссылку");

  /* Обратная сторона: в обычном тексте единица осталась словом. */
  assertEq(moveTextIn("одно два три", "три", "left", 1), "одно три два",
    "в обычном тексте перескок остался словом");
  ok("в обычном тексте поведение не изменилось");

  /* ---- часть слова уезжает за пределы слова (замечание 2026-09-08) ------
   *
   * Заказчик: «при выборе части слова выделенный текст двигается только в
   * пределах слова, в котором он был. Я хочу, чтобы он не был ограничен и мог
   * двигаться посимвольно в любом направлении, в т.ч. за пределы слова».
   *
   * Это был не шаг, а **отказ**: при `auto`, когда сосед по направлению не
   * словесный, функция возвращала `noop` — клавиша не делала ничего. Теперь
   * отказ снимается тумблером `Step out of the word`; умолчание выключено,
   * решение заказчика того же дня.
   *
   * Проверяются оба направления и оба положения тумблера: пин на одно
   * положение зелен и у настройки, которая до движка не доехала (У-56).
   */
  {
    const AUTO = { inlineMoveMode: "auto" };
    const FREE = { inlineMoveMode: "auto", inlineWordEscape: true };

    /* Внутри слова шаг посимвольный, и это работало и до правки. */
    assertEq(moveTextIn("text more", "ex", "left", 1, AUTO),
      "extt more", "внутри слова часть слова двигалась и раньше");

    /*
     * На краю слова решает тумблер. Выключен — строка не меняется вовсе;
     * включён — буквы уезжают за пробел, ровно как он и просил.
     */
    assertEq(moveTextIn("text more", "xt", "right", 1, AUTO),
      "text more", "с выключенным тумблером часть слова остаётся в своём слове");
    assertEq(moveTextIn("text more", "xt", "right", 1, FREE),
      "te xtmore", "с включённым тумблером буквы уезжают за пробел");

    /* И в обратную сторону — тем же тумблером. */
    assertEq(moveTextIn("more text", "te", "left", 1, AUTO),
      "more text", "влево на краю слова выключенный тумблер тоже держит");
    assertEq(moveTextIn("more text", "te", "left", 1, FREE),
      "morete xt", "влево с включённым тумблером буквы уезжают за пробел");

    /*
     * Положительный контроль на сам тумблер: там, где отказа не было, он не
     * меняет ничего. Иначе «включил — поехало» объяснялось бы не им.
     */
    assertEq(moveTextIn("one two three", "three", "left", 1, FREE),
      "one three two", "целое слово по-прежнему прыгает словами");

    /*
     * И шов: сборщик правил обязан **назвать** ключ. Он перечисляет поля по
     * одному, и настройка, которую он не назвал, до движка не доезжает молча
     * — этим уже куплен У-56. Заодно проверяется умолчание: выключено, то
     * есть без настройки поведение прежнее.
     */
    const picked = nav.pickMoveSelectionCfg({}, {});
    assertEq(picked.inlineWordEscape, false, "умолчание тумблера — выключен");
    assertEq(nav.pickMoveSelectionCfg({ inlineWordEscape: true }, {}).inlineWordEscape, true,
      "сборщик правил не назвал ключ: настройка до движка не доедет");
    ok("часть слова уезжает за пределы слова только с тумблером, в оба направления");
  }

  /* ---- Continue past a Separator у переноса текста ----------------------
   *
   * Замечание заказчика 2026-09-04: у курсора внутри строки такая опция есть,
   * а у переноса текста не было. Проверяются **оба** положения тумблера, и
   * включённое — то же принятое поведение из его примера 2026-09-02.
   */
  {
    const SEP = { separator1: "::", separator2: "::" };
    const LINE = "- #todo :: купить хлеб :: 📅2026-09-04";

    /* Выключен: за первый разделитель влево не уходит. */
    assertEq(
      moveTextIn(LINE, "купить", "left", 1, { inlineBoundaryJump: false }, SEP),
      LINE,
      "при выключенном тумблере текст не уезжает за первый Separator");
    /* И за второй вправо тоже. */
    assertEq(
      moveTextIn(LINE, "хлеб", "right", 1, { inlineBoundaryJump: false }, SEP),
      LINE,
      "при выключенном тумблере текст не уезжает за второй Separator");
    /* Внутри своей зоны при этом двигается как обычно. */
    assertEq(
      moveTextIn(LINE, "хлеб", "left", 1, { inlineBoundaryJump: false }, SEP),
      "- #todo :: хлеб купить :: 📅2026-09-04",
      "внутри своего текста перенос работает и при выключенном тумблере");
    ok("выключенный Continue past a Separator держит текст между разделителями");

    /* Включён: поведение прежнее — текст перепрыгивает разделитель. */
    assertEq(
      moveTextIn(LINE, "купить", "left", 1, { inlineBoundaryJump: true }, SEP),
      "- #todo купить :: хлеб :: 📅2026-09-04",
      "при включённом тумблере текст перепрыгивает разделитель, как было");
    ok("включённый Continue past a Separator оставляет прежнее поведение");

    /* Умолчание — включено: принятое поведение не отменяется молча. */
    assertEq(
      moveTextIn(LINE, "купить", "left", 1, {}, SEP),
      "- #todo купить :: хлеб :: 📅2026-09-04",
      "по умолчанию перенос ходит через разделитель, как до правки");
    ok("умолчание тумблера сохраняет принятое 2026-09-02 поведение");

    /* Посимвольный режим слушает тот же тумблер. */
    assertEq(
      moveTextIn(LINE, "купить", "left", 1, { inlineMoveMode: "char", inlineBoundaryJump: false }, SEP),
      LINE,
      "посимвольный перенос тоже стоит у разделителя");
    ok("тумблер один на оба шага переноса");
  }

  /* ---- Курсор на прибытии: `End of your text` ---------------------------
   *
   * Замечание заказчика 2026-09-04: при `Cursor on arrival` = `End of your
   * text` курсор встаёт в конец строки, а не перед вторым Separator.
   *
   * Проверка спрашивает **позицию курсора**, а не текст функции. Прежний пин
   * (`bootstrap_loader_tests.js`) сверял строку исходника про «configurable
   * separator1 fallback» и был зелёный всё время, пока режим не работал ни у
   * кого: разделители в `pickJumpCfg` не приходили, значение по умолчанию
   * `||` в строке заказчика не находилось, и функция отдавала конец строки.
   */
  {
    const LINE = "- #todo :: купить хлеб :: 📅2026-09-04";
    const NOTE_SEP = ["## Раздел один", LINE, "", "## Раздел два", "хвост"].join("\n");
    const AT_END = LINE.length;
    /* Ожидание выписано отдельно от того, из чего его считает движок (У-5):
       конец слова «хлеб» — это позиция перед пробелом и вторым `::`. */
    const BEFORE_SECOND = LINE.indexOf(" :: 📅");
    assertEq(LINE.slice(0, BEFORE_SECOND), "- #todo :: купить хлеб",
      "фикстура: до второго разделителя стоит именно текст человека");

    const jumpTo = async (lineFormat) => {
      const ed = fakeEditor(NOTE_SEP, { line: 4, ch: 0 });
      nav.jumpToHeader(ed, "up", Object.assign({}, CFG, {
        edgeMode: "end", jumpCursorPosition: "section-end",
      }), lineFormat);
      await settle();
      return ed.at();
    };

    const own = await jumpTo({ separator1: "::", separator2: "::" });
    assertEq(own.line, 1, "переход пришёл не на ту строку");
    assertEq(own.ch, BEFORE_SECOND,
      "курсор должен встать перед вторым Separator, а не в конец строки");
    ok("End of your text ставит курсор перед вторым Separator (разделители заказчика)");

    /* Разделители разные: второй ищется вторым, а не первым. */
    const LINE2 = "- #todo || купить хлеб :: 📅2026-09-04";
    const NOTE2 = ["## Раздел один", LINE2, "", "## Раздел два", "хвост"].join("\n");
    const ed2 = fakeEditor(NOTE2, { line: 4, ch: 0 });
    nav.jumpToHeader(ed2, "up", Object.assign({}, CFG, {
      edgeMode: "end", jumpCursorPosition: "section-end",
    }), { separator1: "||", separator2: "::" });
    await settle();
    assertEq(ed2.at().ch, LINE2.indexOf(" :: 📅"),
      "при разных разделителях второй ищется вторым");
    ok("второй Separator ищется вторым Separator, а не первым");

    /* Разделителей в строке нет — конец строки, как и было. */
    const NOTE3 = ["## Раздел один", "просто строка", "", "## Раздел два", "хвост"].join("\n");
    const ed3 = fakeEditor(NOTE3, { line: 4, ch: 0 });
    nav.jumpToHeader(ed3, "up", Object.assign({}, CFG, {
      edgeMode: "end", jumpCursorPosition: "section-end",
    }), { separator1: "::", separator2: "::" });
    await settle();
    assertEq(ed3.at().ch, "просто строка".length,
      "в строке без разделителей курсор остаётся в конце");
    ok("строка без разделителей ведёт себя как прежде");

    /* Разделители не переданы вовсе: старое поведение, а не падение. */
    const noFormat = await jumpTo(undefined);
    assertEq(noFormat.ch, AT_END,
      "без разделителей режим отдаёт конец строки, а не падает");
    ok("без переданных разделителей поведение прежнее");
  }

  /* ---- H7: «строка за строкой» считает заголовок обычной строкой ------- */

  /*
   * Замечание заказчика H7 от 2026-09-04: «heading-jumps-mode при line by line
   * перепрыгивает через хедеры, но в этом режиме он должен считать хедеры как
   * обычную линию».
   *
   * Спрашивается **номер строки, на которую встал курсор**, а не текст правки:
   * прежний код ходил внутри секции, а её содержимое начинается со строки
   * после заголовка, — и заголовок оставался пропущен. Строки `NOTE`:
   * 0-1 вводный текст, 2 пусто, 3 первый заголовок, 4 строка, 5 пусто,
   * 6 второй заголовок, 7 строка.
   */
  {
    const line = (from, dir) => jump(NOTE, from, dir, { jumpMode: "line" });

    assertEq(await line(1, "down"), 3,
      "вниз с последней строки вводного текста — на первый заголовок");
    assertEq(await line(3, "down"), 4,
      "с заголовка — на строку под ним");
    assertEq(await line(4, "down"), 6,
      "с последней строки секции — на следующий заголовок, а не через него");
    assertEq(await line(6, "down"), 7,
      "и дальше на строку под ним");
    assertEq(await line(7, "down"), 7,
      "в конце заметки переход не двигает курсор");

    assertEq(await line(7, "up"), 6,
      "вверх со строки — на её заголовок");
    assertEq(await line(6, "up"), 4,
      "с заголовка — на последнюю строку предыдущей секции");
    assertEq(await line(4, "up"), 3,
      "и снова на заголовок, а не через него");
    assertEq(await line(3, "up"), 1,
      "с первого заголовка — в вводный текст");
    ok("H7: в режиме «строка за строкой» заголовок — такая же остановка");

    /* Верхняя граница прежняя: выше первой строки после свойств не идём (В-20). */
    assertEq(await jump(WITH_YAML, 3, "up", { jumpMode: "line" }), 3,
      "выше первой строки после свойств заметки переход не идёт");
    ok("H7: решение В-20 про свойства заметки не тронуто");
  }

  /* ---- H6: правила читаются через адаптер, когда vault их не видит ------ */

  /*
   * Служебный файл правил уехал в папку плагина (решение В-39). Vault не
   * индексирует `.obsidian/**`, значит `getAbstractFileByPath` его не найдёт
   * **никогда**, и работать может только чтение через адаптер. У общего чтения
   * правил эта ветка была с самого начала, у навигации её не было вовсе — и
   * переезд погасил бы обе команды курсора внутри строки целиком.
   *
   * Спрашивается результат: пришли ли разделители из документа. Подделан
   * только `app` — сам разбор документа настоящий.
   */
  {
    const RULES = [
      "```tagwheel-io",
      JSON.stringify({ separator1: "::", separator2: "::" }),
      "```",
      "```tagwheel-left-mode",
      JSON.stringify({ fields: [] }),
      "```",
    ].join("\n");

    const PLUGIN_PATH = ".obsidian/plugins/inline-overhaul/generated_rules.md";
    const asked = [];
    const appAdapterOnly = {
      vault: {
        /* Ровно то, что делает Obsidian с путём внутри своей папки настроек. */
        getAbstractFileByPath: () => null,
        read: () => { throw new Error("vault.read не должен зваться: файла в индексе нет"); },
        adapter: {
          read: async (p) => {
            asked.push(p);
            if (p === PLUGIN_PATH) return RULES;
            throw new Error("нет такого файла: " + p);
          },
        },
      },
    };

    const rules = await nav.loadNavigateRules(appAdapterOnly, PLUGIN_PATH);
    assertEq(rules.delim, "::", "разделитель приехал из документа в папке плагина");
    assertEq(rules.rulesPathUsed, PLUGIN_PATH, "и путь назван тот, по которому прочли");
    assertEq(asked[0], PLUGIN_PATH, "первым спрошен настоящий путь, а не запасной");
    ok("H6: правила в папке плагина читаются запасным путём через адаптер");

    /* Файла нет ни в индексе, ни у адаптера — прежняя ошибка, а не тишина. */
    let failed = "";
    try {
      await nav.loadNavigateRules({
        vault: { getAbstractFileByPath: () => null, adapter: { read: async () => { throw new Error("нет"); } } },
      }, "Нет такого файла.md");
    } catch (e) {
      failed = String(e && e.message ? e.message : e);
    }
    if (failed.indexOf("Rules file not found") !== 0) {
      throw new Error("ожидалась прежняя ошибка чтения правил, получено: " + failed);
    }
    ok("H6: когда файла нет нигде, ошибка та же, что была");
  }

  /* ---- прокрутка при перемещении строки (10.13.36) --------------------- */

  {
    /*
     * Заказчик: «мне не нравится, что при использовании move-lines экран
     * прыгает, причем произвольно — иногда центрирует место перемещения
     * линии, иногда прыгает так, что перемещаемая линия находится наверху
     * экрана».
     *
     * Разбор нашёл, что прокруткой распоряжалась платформа, а свой код до
     * неё не доезжал: он спрашивал `editor.getViewport()`, которого у
     * редактора Obsidian нет вовсе, и выходил первой же строкой. Поэтому
     * подделка редактора здесь **не даёт `getViewport`** — как и настоящая:
     * подделка добрее браузера ловит не тот дефект (У-45).
     *
     * Записан не «был ли вызов», а **что именно уехало в платформу**: y-режим
     * прокрутки и позиция. Пин на факт вызова остался бы зелёным, если
     * перепутать местами верх и низ.
     */
    const viewEditor = (lines, at) => {
      const ed = fakeEditor(lines.join("\n"), { line: at, ch: 0 });
      const seen = { effects: [], scrollTops: [], frames: [] };
      const dom = { scrollTop: 500, scrollLeft: 0 };
      /* Класс представления: статический `scrollIntoView` живёт на нём, и
         именно так до него дотягивается движок (своего импорта у него нет). */
      function View() {}
      View.scrollIntoView = (pos, opts) => ({ pos, y: opts && opts.y });
      const cm = Object.create(View.prototype);
      cm.scrollDOM = dom;
      cm.dispatch = (tr) => { seen.effects.push(tr && tr.effects); };
      cm.dom = { ownerDocument: { defaultView: {
        requestAnimationFrame: (fn) => { seen.frames.push(fn); return 1; },
      } } };
      ed.cm = cm;
      ed.replaceRange = () => {
        /* Платформа прокручивает сама: каждая её транзакция несёт
           `scrollIntoView: true`. Здесь это и изображается — прокрутка
           уезжает, и вернуть её обязан наш код. */
        dom.scrollTop = 900;
      };
      return { ed, seen, dom, at };
    };

    const LINES = ["один", "два", "три", "четыре", "пять"];
    const move = (cfg, at, dir) => {
      const h = viewEditor(LINES, at === undefined ? 2 : at);
      nav.moveLine(h.ed, dir || "down", Object.assign({
        enabled: true, headerMode: "move-as-line", noSelectionMode: "line-only",
        crossSectionAllowed: true, highlightMovedLines: false,
      }, cfg));
      return h;
    };

    const down = move({ keepInView: true, viewPosition: "center" });
    const effects = down.seen.effects.filter(Boolean);
    if (!effects.length) throw new Error("движок не попросил платформу прокрутить вовсе");
    assertEq(effects[effects.length - 1].y, "center",
      "по центру обязано уехать режимом center");

    assertEq(move({ keepInView: true, viewPosition: "top" }).seen.effects.filter(Boolean).pop().y,
      "start", "«по верху» обязано уехать режимом start");
    assertEq(move({ keepInView: true, viewPosition: "bottom" }).seen.effects.filter(Boolean).pop().y,
      "end", "«по низу» обязано уехать режимом end");

    /* Значения нет — читается как «по центру», а не как поломка. */
    assertEq(move({ keepInView: true }).seen.effects.filter(Boolean).pop().y,
      "center", "без выбранной позиции остаётся центр");

    /*
     * Выключено — экран остаётся там, где был. Одной синхронной записи мало:
     * платформа применяет свою прокрутку в проходе измерения, то есть после
     * нашей записи, — поэтому проверяется и то, что вторая запись назначена
     * на следующий кадр, и то, что она действительно возвращает прокрутку.
     */
    const held = move({ keepInView: false });
    assertEq(held.seen.effects.filter(Boolean).length, 0,
      "выключенная настройка всё равно попросила платформу прокрутить");
    assertEq(held.dom.scrollTop, 500, "прокрутка не вернулась на место сразу");
    if (!held.seen.frames.length) throw new Error("вторая запись прокрутки на следующий кадр не назначена");
    held.dom.scrollTop = 900;
    held.seen.frames.forEach((fn) => fn());
    assertEq(held.dom.scrollTop, 500,
      "прокрутка, отданная платформе после нашей записи, осталась чужой");

    ok("прокрутка при перемещении строки: три позиции уезжают режимами, выключенная держит экран");
  }

  /* ---- где встаёт строка на экране после перехода (10.13.37) ----------- */
  {
    /*
     * Заказ заказчика 2026-09-06: «такая же опция, как у перемещения строки».
     * Прежняя строка звала обёртку Obsidian с `center = true` и другого
     * положения не знала.
     *
     * Записан не факт вызова, а **режим**, уехавший в платформу: пин на
     * «прокрутили» остался бы зелёным, если перепутать верх и низ (У-58).
     * Троттлинг здесь снят нулём: он про повторные нажатия, а не про выбор
     * положения, и с ним второй вызов подряд молча не доедет.
     */
    const revealEditor = () => {
      const ed = fakeEditor(NOTE, { line: 0, ch: 0 });
      const seen = { effects: [] };
      function View() {}
      View.scrollIntoView = (pos, opts) => ({ pos, y: opts && opts.y });
      const cm = Object.create(View.prototype);
      cm.dispatch = (tr) => { seen.effects.push(tr && tr.effects); };
      ed.cm = cm;
      return { ed, seen };
    };

    const jumped = async (over) => {
      const h = revealEditor();
      nav.jumpToHeader(h.ed, "down", Object.assign({}, CFG, {
        centerCursor: true, centerDelayMs: 0, centerThrottleMs: 0,
      }, over || {}));
      await settle();
      return h.seen.effects.filter(Boolean);
    };

    const centered = await jumped({ viewPosition: "center" });
    if (!centered.length) throw new Error("переход не попросил платформу прокрутить вовсе");
    assertEq(centered.pop().y, "center", "«по центру» обязано уехать режимом center");
    assertEq((await jumped({ viewPosition: "top" })).pop().y,
      "start", "«по верху» обязано уехать режимом start");
    assertEq((await jumped({ viewPosition: "bottom" })).pop().y,
      "end", "«по низу» обязано уехать режимом end");
    /* Значения нет — читается как «по центру», то есть как было до заказа. */
    assertEq((await jumped({})).pop().y,
      "center", "без выбранной позиции остаётся центр");
    /* Выключенный тумблер не прокручивает вовсе — он и раньше не прокручивал. */
    assertEq((await jumped({ centerCursor: false, viewPosition: "top" })).length, 0,
      "выключенный тумблер всё равно попросил платформу прокрутить");

    ok("прокрутка при переходе по заголовкам: три положения уезжают разными режимами");
  }

  /* ---- пустой слот текста у строки с одним разделителем ---- */

  /*
   * Заказчик 2026-09-06: Field из правого Block активирован на пустой строке,
   * и прыжок внутри строки ставит курсор после разделителя, а надо — в то место, где
   * слово началось бы: `- | :: 📅2026-09-06 10:21`.
   *
   * Записан номер столбца, который видит человек, а не намерение кода: разница
   * между верным и неверным ответом здесь в один символ, и он решает всё:
   * напечатанное в позиции справа слипается с разделителем.
   */
  {
    const MARKER = String.fromCodePoint(0x1F4C5);
    const RULES = { delim: "::", trailingMarkers: [MARKER], dateRegexSrc: "\\d{4}-\\d{2}-\\d{2}" };
    const land = async (text, from, direction) => {
      const ed = fakeEditor(text, { line: 0, ch: from });
      nav.navigateInline(ed, direction, RULES,
        { stepMode: "word", boundaryJump: false, onBoundary: "stay" });
      await settle();
      return ed.at().ch;
    };

    const BULLET = "-  :: " + MARKER + "2026-09-06 10:21";
    const BOX = "- [ ]  :: " + MARKER + "2026-09-06 10:20";

    /* После `- ` и до пробела перед разделителем — столбец 2. */
    assertEq(await land(BULLET, 0, "right"), 2,
      "курсор обязан встать в пустой слот текста, а не вплотную к разделителю");
    assertEq(await land(BULLET, BULLET.length, "left"), 2,
      "и с конца строки — туда же");
    assertEq(await land(BOX, 0, "right"), 6,
      "со снятым чекбоксом — сразу за ним, а не у разделителя");

    /* Обратная сторона: строка с текстом ходит, как ходила. */
    const WITH_TEXT = "- один два :: " + MARKER + "2026-09-06 10:21";
    assertEq(await land(WITH_TEXT, 0, "right"), 2,
      "у строки с текстом начало зоны прежнее");
    assertEq(await land(WITH_TEXT, WITH_TEXT.length, "left"), "- один два".length,
      "и конец зоны прежний — перед разделителем");

    ok("пустой слот текста: курсор встаёт туда, где начнётся слово");
  }

  /* ---- метка Field доезжает до навигации ---- */

  /*
   * У заказчика блок `tagwheel-date-rules` пуст: поле-дата у него не одно из
   * четырёх именованных правил, а свой Field со своей меткой. Без метки
   * навигация считает единственный `::` первым разделителем и уводит курсор
   * в хвост с датой. Спрашивается результат чтения, а не факт разбора блока.
   */
  {
    const MARKER = String.fromCodePoint(0x1F4C5);
    const RULES_MD = [
      "```tagwheel-io",
      JSON.stringify({ separator1: "::", separator2: "::" }),
      "```",
      "```tagwheel-date-rules",
      "{}",
      "```",
      "```tagwheel-left-mode",
      JSON.stringify({ fields: [{ id: "type", prefix: "#", values: ["todo"] }] }),
      "```",
      "```tagwheel-right-mode",
      JSON.stringify({ fields: [{ id: "date_due", kind: "genericElement", marker: MARKER }] }),
      "```",
    ].join("\n");

    const PATH = ".obsidian/plugins/inline-overhaul/generated_rules.md";
    const app = {
      vault: {
        getAbstractFileByPath: () => null,
        adapter: { read: async (p) => { if (p === PATH) return RULES_MD; throw new Error("нет: " + p); } },
      },
    };

    const rules = await nav.loadNavigateRules(app, PATH);
    if (rules.trailingMarkers.indexOf(MARKER) === -1) {
      throw new Error("метка Field не доехала до навигации: " + JSON.stringify(rules.trailingMarkers));
    }
    ok("метка своего Field берётся из списка Field, а не только из четырёх правил дат");

    /* И она впрямь решает, куда встанет курсор: те же правила через прыжок. */
    const LINE = "-  :: " + MARKER + "2026-09-06 10:21";
    const ed = fakeEditor(LINE, { line: 0, ch: LINE.length });
    nav.navigateInline(ed, "left", rules, { stepMode: "word", boundaryJump: false, onBoundary: "stay" });
    await settle();
    assertEq(ed.at().ch, 2, "с правилами из документа курсор всё равно встаёт в слот текста");
    ok("путь целиком: документ правил → метка → положение каретки");
  }

  console.log("\n" + passed + " проверок пройдено");
})().catch((e) => { console.error(e); process.exit(1); });
