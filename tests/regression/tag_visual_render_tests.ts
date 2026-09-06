/**
 * Каким цветом плагин рисует токен Value в заметке.
 *
 * Проверка на НАСТОЯЩЕМ виджете отрисовки: `TagVisualTokenWidget` берётся из
 * `main.js` загрузчиком `tests/harness/plugin_internals.ts`. Подделан только
 * DOM — виджет живёт в редакторе Obsidian, и другого способа посмотреть на
 * его узел нет.
 *
 * Что здесь закреплено. Панель рисует пузырь Value цветом
 * `--io-bubble-fg, var(--text-on-accent)` (`styles.css`, `.io-bubble`), то
 * есть при незаданном цвете текста — «текст на цветной подложке». Заметка же
 * брала цвет темы, и одно и то же значение выглядело в двух местах
 * по-разному: в панели белым, в заметке чёрным (замечание заказчика
 * 2026-08-28). Теперь заметка берёт ту же переменную.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { toDefinitions } from "../../src/ui/settings/to_definitions.ts";
import { THEME_COLOR_VARS, setThemeReader } from "../../src/ui/settings/custom/theme_colors.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Собрать узел так же, как это делает отрисовка строки. */
function paint(fill: string, text: string): Any {
  const w = new I.TagVisualTokenWidget("#todo", fill, text, 1, false, 100, 100, 100, 100, 0, "");
  return w.toDOM();
}

{
  const el = paint("#0008f0", "#f0eaea");
  assert.equal(el.style.color, "#f0eaea", "заданный цвет текста берётся как есть");
  assert.equal(el.style.backgroundColor, "#0008f0", "и заливка тоже");
  ok("цвет текста задан — рисуется он");
}

{
  const el = paint("#0008f0", "");
  assert.equal(el.style.color, "var(--text-on-accent)",
    "цвет не задан, но заливка есть — берётся цвет темы для текста на подложке");
  ok("цвет не задан, заливка есть — текст на подложке, как в панели");
}

{
  /*
   * Без заливки цвет не подставляется, и это не осторожность ради
   * осторожности: `--text-on-accent` в светлой теме белый, и на белом фоне
   * заметки такой текст пропал бы совсем.
   */
  const el = paint("", "");
  assert.ok(!el.style.color, "заливки нет — цвет текста остаётся темы");
  ok("ни цвета, ни заливки — ничего не подставляется");
}

{
  /* Пустой Value рисуется пробелом: цвет ему всё равно не виден, но правило
     одно на все режимы, и подстановка не должна от режима зависеть. */
  const w = new I.TagVisualTokenWidget("#todo", "#0008f0", "", 1, true, 100, 100, 100, 100, 0, "");
  const el = w.toDOM();
  assert.equal(el.style.color, "var(--text-on-accent)", "правило одно на все режимы показа");
  ok("режим показа на подстановку не влияет");
}


/* ---- И-2.2: настройки блока достаются не одним тегам ------------------- */

{
  /*
   * Сканер строки. До правки он искал только `#\S+`, и прозрачность с
   * размером текста доставались одним тегам: эмодзи-элемент и ссылка в разбор
   * не попадали вовсе (замечание заказчика И-2.2, 2026-09-01).
   */
  const hits = I.scanLineVisualTokens(
    "- [ ] #/1 [[test1]] #todo || 111 || 📅2026-09-01 #work", "||", "||", ["📅"]);
  const kinds = hits.map((h: Any) => h.kind + ":" + h.token);
  assert.deepEqual(kinds, [
    "tag:#/1",
    "link:[[test1]]",
    "tag:#todo",
    "element:📅2026-09-01",
    "tag:#work",
  ], "сканер видит теги, ссылки и элементы в порядке появления");
  ok("сканер строки берёт три вида токенов, а не один");
}

{
  const zones = I.scanLineVisualTokens(
    "#/1 [[test1]] || 111 || 📅2026-09-01", "||", "||", ["📅"])
    .map((h: Any) => h.kind + ":" + h.zone);
  assert.deepEqual(zones, ["tag:left", "link:left", "element:right"],
    "сторона считается по разделителям одинаково для всех видов");
  ok("сторона у ссылки и элемента та же, что у тега");
}

{
  /* Решётка внутри ссылки — часть ссылки, а не отдельный тег. */
  const hits = I.scanLineVisualTokens("[[Note#heading]] #todo", "||", "||", []);
  assert.deepEqual(hits.map((h: Any) => h.kind), ["link", "tag"],
    "пересечения снимаются в пользу того, кто начался раньше");
  ok("решётка внутри ссылки не становится тегом");
}

{
  const markers = I.buildElementMarkersFromConfig({
    pkm: { fields: { elements: { byField: {
      date_due: { emoji: "📅", format: "YYYY-MM-DD hh:mm" },
      at: { emoji: "⏰" },
    } } } },
  });
  const of = (marker: string): Any => markers.find((m: Any) => m.marker === marker);
  assert.ok(of("📅") && of("⏰"),
    "метки элементов берутся из конфига, а не из списка литералов");
  /*
   * Хвост токена выводится из формата поля: «всё до пробела» обрывало формат
   * из нескольких слов на первом же (C35). Ожидание выписано образцом
   * отдельно от того, из чего он считается (У-5).
   */
  assert.equal(of("📅").tail, "\\d{4}-\\d{2}-\\d{2}[ ]\\d{2}:\\d{2}",
    "формат из двух слов даёт хвост с пробелом: " + of("📅").tail);
  assert.equal(of("⏰").tail, "",
    "формата нет — хвоста нет, и сканер остаётся на прежнем правиле");
  ok("метки элементов приходят из настроек Fields вместе со своим форматом");
}

/* ---- эмодзи из нескольких слов оформляется целиком (C35) --------------- */

/*
 * Заказчик: «если в emoji field формат в одно слово (📅YYYY-MM-DD), то всё ок,
 * однако если он содержит несколько слов (📅YYYY-MM-DD hh:mm), то ко второй
 * части не применяются настройки».
 *
 * Проверяется сканер: токен обязан взять обе половины и не съесть соседа.
 */
{
  const markers = I.buildElementMarkersFromConfig({
    pkm: { fields: { elements: { byField: {
      date_due: { emoji: "📅", format: "YYYY-MM-DD hh:mm" },
    } } } },
  });
  const line = "- #todo || text || 📅2026-09-02 14:42 #work";
  const hits = I.scanLineVisualTokens(line, "||", "||", markers);
  const element = hits.filter((h: Any) => h.kind === "element");
  assert.equal(element.length, 1, "элемент найден один: " + JSON.stringify(hits.map((h: Any) => h.token)));
  assert.equal(element[0].token, "📅2026-09-02 14:42",
    "токен взял обе половины формата: " + element[0].token);
  assert.ok(hits.some((h: Any) => h.token === "#work"),
    "и не съел соседний тег: " + JSON.stringify(hits.map((h: Any) => h.token)));

  /* Формат в одно слово — как было. */
  const one = I.buildElementMarkersFromConfig({
    pkm: { fields: { elements: { byField: { d: { emoji: "📅", format: "YYYY-MM-DD" } } } } },
  });
  const short = I.scanLineVisualTokens("- 📅2026-09-02 #work", "||", "||", one)
    .filter((h: Any) => h.kind === "element");
  assert.equal(short[0]?.token, "📅2026-09-02",
    "формат в одно слово по-прежнему берётся целиком и не тянет лишнего");
  ok("C35: эмодзи-элемент из нескольких слов попадает в разбор целиком");
}

{
  /*
   * Правило стиля для токена без своего цвета. Ожидание выписано строкой
   * отдельно от того, из чего оно считается (У-5).
   */
  const visuals = { tagTextSizePct: 100 };
  assert.equal(I.buildBlockStyleCss({ zone: "left", zoneOpacity: 0.17 }, visuals),
    "opacity: 0.17;", "левый блок гаснет по своей настройке");
  assert.equal(I.buildBlockStyleCss({ zone: "right", zoneOpacity: 0.44 }, visuals),
    "opacity: 0.44;", "правый блок гаснет по своей");
  assert.equal(I.buildBlockStyleCss({ zone: "middle", zoneOpacity: 0.17 }, visuals),
    "", "текст между разделителями не трогается");
  assert.equal(I.buildBlockStyleCss({ zone: "left", zoneOpacity: 1 }, visuals),
    "", "нечего менять — нет и декорации");
  ok("прозрачность блока достаётся любому токену блока, кроме вашего текста");
}

{
  /* Размер текста у токена без цвета — тот же, что у пузыря с цветом:
     одна настройка не должна давать в одной строке два размера. */
  const css = I.buildBlockStyleCss({ zone: "left", zoneOpacity: 1 }, { tagTextSizePct: 120 });
  const bubble = I.computeTagVisualStyle(120, 100, 100, 0);
  assert.equal(css, "font-size: " + bubble.fontSizePx + "px;",
    "размер текста берётся тем же расчётом, что у пузыря");
  ok("размер текста одинаков у пузыря и у голого токена");
}

/* ---- И-2.3: пустой пузырь в заметке той же ширины, что в панели -------- */

{
  /*
   * Ширина пустого пузыря считалась в заметке своей формулой — от
   * горизонтального поля, — и вся шкала 50…180 % умещалась в 6…18 px, причём
   * нижняя треть упиралась в предел. Настройка работала, а увидеть её было
   * нельзя (замечание И-2.3).
   *
   * Число берётся из `styles.css`, а не переписывается сюда: пин должен
   * краснеть, когда формулы снова разъедутся, а не когда их поправили вместе.
   */
  const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  const m = css.match(/\.io-bubble--empty\s*\{[^}]*width:\s*calc\((\d+)px\s*\*\s*var\(--io-empty-x\)\)/);
  assert.ok(m, "панель по-прежнему считает ширину пустого пузыря от базового числа");
  const basePx = Number(m ? m[1] : 0);
  assert.equal(I.TAG_EMPTY_BUBBLE_BASE_PX, basePx,
    "заметка считает пустой пузырь от того же числа, что и панель");

  const widthAt = (pct: number): string => {
    const w = new I.TagVisualTokenWidget("#todo", "#0008f0", "", 1, true, 100, 80, 80, pct, 0, "");
    return w.toDOM().style.width;
  };
  assert.equal(widthAt(50), Math.round(basePx * 0.5) + "px", "50 % — половина базовой ширины");
  assert.equal(widthAt(100), basePx + "px", "100 % — базовая ширина");
  assert.equal(widthAt(180), Math.round(basePx * 1.8) + "px", "180 % — почти вдвое шире");
  ok("ширина пустого пузыря в заметке двигается так же, как в панели");
}

/* ---- подсветка TagWheel не съедает Fields (B2) ------------------------- */

/*
 * Заказчик включил `Highlight the line` и увидел: «вся строка tagwheel
 * пропадает, я вижу только selector, но fields невидимы и не занимают места».
 *
 * Причина — два слоя оформления на одних символах. Подсветка обособляет строку
 * TagWheel в `==…==`; по этим же `==` себя находит слой TagWheel и при
 * заданной заливке заменяет весь отрезок одним виджетом. А слой пузырей к тому
 * моменту уже спрятал токены строки своими заменами нулевой ширины.
 *
 * Проверяется правило, которое их развело: отрезок объявлен один раз, и слой
 * пузырей внутри него не работает. Ожидание выписано отдельно от того, из чего
 * оно считается (У-5): здесь названы условие заливки и границы отрезка.
 */
{
  const line = "- ==`#todo` **[work]**== || text || 📅2026-09-02";

  /* Заливка задана — отрезок принадлежит TagWheel. */
  const withFill = I.tagwheelPanelSpanInLine(line, { fillColor: "#988925", showPrefix: true });
  assert.ok(withFill, "с заданной заливкой отрезок TagWheel есть");
  assert.equal(line.slice(withFill.start, withFill.end), "==`#todo` **[work]**==",
    "границы отрезка — от первых `==` до вторых: " + line.slice(withFill.start, withFill.end));

  /* Маркеры спрятаны — тоже виджет, тоже отрезок. */
  assert.ok(I.tagwheelPanelSpanInLine(line, { fillColor: "", showPrefix: false }),
    "спрятанные маркеры тоже отдают отрезок виджету");

  /* Ни того, ни другого — слой TagWheel только красит текст, и отрезка нет. */
  assert.equal(I.tagwheelPanelSpanInLine(line, { fillColor: "", showPrefix: true }), null,
    "без заливки и с маркерами отрезок не забирается");

  /* Нет обособления — нечего забирать. */
  assert.equal(I.tagwheelPanelSpanInLine("- #todo || text", { fillColor: "#988925", showPrefix: true }), null,
    "на обычной строке отрезка TagWheel нет");

  ok("B2: отрезок TagWheel объявлен одним правилом на два слоя");
}

/*
 * И вторая половина: цвета TagWheel читаются с путей версии 2. Если бы они
 * читались со старых, отрезок не находился бы никогда и правка выглядела бы
 * работающей.
 */
{
  const colors = I.getTagwheelHeaderColorsFromConfig({
    visual: { tagWheel: { fillColor: "#988925", textColor: "#a5a0d4", showMarkers: false } },
  });
  assert.equal(colors.fillColor, "#988925", "заливка читается с пути версии 2");
  assert.equal(colors.defaultTextColor, "#a5a0d4", "цвет текста тоже");
  assert.equal(colors.showPrefix, false, "и тумблер маркеров");
  ok("цвета TagWheel читаются с путей версии 2, а не со старых имён");
}

/* ---- панель TagWheel: пометки, а не замена отрезка (B2, 10.13.15) ------ */

/*
 * Что здесь закреплено и почему именно это.
 *
 * Слой панели раньше заменял весь отрезок `==…==` **одним виджетом**. Внутри
 * отрезка живут вещи, которые Obsidian оформляет сам — ссылка `[[…]]`,
 * полужирный `**…**`, тег, — и что получится, когда наши замены сложатся с
 * его, из кода не видно и никакой гейт этого не увидит: DOM живого редактора
 * из проверок недостижим, библиотеки DOM в проекте нет. Заказчик увидел итог:
 * панель слева невидима и безразмерна, справа всё в порядке (B2, 2026-09-02);
 * слева у него в панели стоит ссылка, справа нет.
 *
 * Поэтому утверждение выписано **не про вид, а про механизм**: подмена
 * появляется ровно на одном случае — когда решётки просят спрятать, и тогда
 * подменяется один токен. Такую проверку делает машина, и она краснеет на
 * возврате прежнего кода. Как это выглядит на экране — по-прежнему глазами.
 */
{
  const LINE = "- [ ] ==**[#/1]** [[test1]] #todo== || тест";
  const known = new Set(["Imp", "Importance", "Project", "type"]);

  const spans = (wheel: Any, line: string = LINE): Any[] =>
    I.tagwheelPanelSpans(line, I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: wheel } }), known);

  /* 1. Заливка задана — панель оформляется, и ни одной подмены. */
  const painted = spans({ fillColor: "#f0e17f", textColor: "#322b2a", showMarkers: true, highlightLine: true });
  assert.ok(painted.length, "с заданной заливкой панель оформляется: " + painted.length);
  const replaced = painted.filter(x => x.kind === "replace");
  assert.deepEqual(replaced, [],
    "пока решётки показаны, слой панели не подменяет ничего: "
    + JSON.stringify(replaced.map((r: Any) => LINE.slice(r.start, r.end))));

  /*
   * 2. Фон лежит ровно на панели — **вместе с метками `==`** — и приезжает
   *    одной пометкой на строку, а не отрезком.
   *
   * Отрезком он и рисовался, и это был третий заход по одному замечанию.
   * `mark` CodeMirror режет по своим границам — тег, вставка кода, спрятанные
   * `**`, — куски получали фон поштучно, пробелы между ячейками оставались
   * белыми, а поля тега делали куски разной высоты: «по прежнему различается
   * высота элементов, теперь ещё пустоты стали белого цвета» (2026-09-05,
   * `12.png`). Сплошной слой на строке ровно один — подсветка `==…==` самой
   * Obsidian, — и панель теперь **перекрашивает** его, отдавая цвет
   * переменной на строке.
   */
  const lineSpan = painted.find((x: Any) => x.kind === "line");
  assert.ok(lineSpan, "строка панели не помечена — красить будет нечего");
  assert.equal(LINE.slice(lineSpan.start, lineSpan.end), "==**[#/1]** [[test1]] #todo==",
    "заливка объявлена ровно на панели: " + LINE.slice(lineSpan.start, lineSpan.end));
  assert.ok(String(lineSpan.style).includes("--io-twfill: #f0e17f"),
    "цвет заливки обязан приехать на строке: " + String(lineSpan.style));

  /*
   * И ни один отрезок не рисует фон сам: вернуть `background-color` в `mark`
   * значит вернуть рваную панель, а из кода это не видно.
   */
  const painting = painted.filter((x: Any) => /background/i.test(String(x.style || "")));
  assert.deepEqual(painting, [],
    "заливка вернулась отрезком — платформа порежет его на куски: "
    + JSON.stringify(painting));

  /* 3. Ссылка внутри панели ничем не закрыта — это и был дефект B2. */
  const linkAt = LINE.indexOf("[[test1]]");
  const covering = painted.filter((x: Any) =>
    x.kind === "replace" && x.start <= linkAt && x.end >= linkAt + "[[test1]]".length);
  assert.deepEqual(covering, [], "ссылка внутри панели не подменяется");

  /* 4. Обратная сторона: без цветов и с показанными решётками красить нечего. */
  assert.deepEqual(spans({ showMarkers: true }), [],
    "без единого цвета панель не оформляется вовсе");

  /*
   * 5. Спрятанные решётки — единственная подмена, и она шириной в токен.
   *
   * В строке стоит активная ячейка `**[#/1]**`: без неё это не панель, а
   * обычное выделение человека, и слой её больше не красит (10.13.25).
   */
  const STRIPPED = "- ==**[#/1]** `Imp` #todo== || тест";
  const stripped = spans({ textColor: "#322b2a", showMarkers: false }, STRIPPED);
  const narrow = stripped.filter((x: Any) => x.kind === "replace");
  assert.ok(narrow.length, "со спрятанными решётками токен подменяется: " + JSON.stringify(stripped));
  for (const r of narrow) {
    const covered = STRIPPED.slice(r.start, r.end);
    assert.ok(!/\s/.test(covered), "подменяется один токен, а не отрезок: " + covered);
  }

  ok("B2: слой панели оформляет отрезок пометками, а подменяет только токен");
}

/* ---- H5: заливка красит панель, а не любое выделение (10.13.25) -------- */

/*
 * Что закреплено. Отрезок `==…==` сам по себе панелью не является: `==` —
 * разметка выделения Obsidian, и человек ставит её себе сам. До 2026-09-04
 * слой брал первый такой отрезок на любой строке — «panel-background меняет
 * цвет заливки не только tagwheel panel, но и вообще любого текста, который
 * находится между `==`» (замечание H5).
 *
 * Спрашивается **результат**, а не текст правки: получил ли отрезок хоть одно
 * оформление. Второе утверждение — про слой пузырей: он отдавал панели весь
 * отрезок и внутри него не рисовал ничего, поэтому `==#todo==` человека терял
 * пузырь. Оба слоя спрашиваются на одной и той же строке.
 */
{
  const colors = I.getTagwheelHeaderColorsFromConfig({
    visual: { tagWheel: { fillColor: "#f0e17f", textColor: "#322b2a", showMarkers: true } },
  });
  const known = new Set(["Imp"]);
  const widget = { fillColor: "#f0e17f", showPrefix: true };

  /* Выделение человека: ни одного оформления и ни одного отобранного отрезка. */
  const own = "- [ ] купить ==хлеб== до пятницы";
  assert.deepEqual(I.tagwheelPanelSpans(own, colors, known), [],
    "обычное выделение человека слой панели не красит");
  assert.equal(I.tagwheelPanelSpanInLine(own, widget), null,
    "и слой пузырей внутри него работает как обычно");

  /* Выделенный тег — тот же случай, и это вторая половина дефекта. */
  const ownTag = "- ==#todo== || текст";
  assert.deepEqual(I.tagwheelPanelSpans(ownTag, colors, known), [],
    "выделенный тег человека тоже не панель");
  assert.equal(I.tagwheelPanelSpanInLine(ownTag, widget), null,
    "и пузырь у него остаётся: отрезок слою панели не отдан");

  /* Настоящая панель красится, как раньше: правка ничего не отняла. */
  const panel = "- ==**[#/1]** #todo== || текст";
  const spansPanel = I.tagwheelPanelSpans(panel, colors, known);
  assert.ok(spansPanel.some((x: Any) => x.kind === "line" && String(x.style).includes("--io-twfill")),
    "панель по-прежнему получает заливку: " + JSON.stringify(spansPanel));
  assert.ok(I.tagwheelPanelSpanInLine(panel, widget),
    "и её отрезок по-прежнему забирается у слоя пузырей");

  ok("H5: панель узнаётся по своей метке, а не по разметке выделения Obsidian");
}

/*
 * Метки `==` панели красятся вместе с ней (замечание заказчика 2026-09-05:
 * «tagwheel panel перекрашена в цвет panel-background, но знаки `==` красятся
 * в цвет obsidian (жёлтый)»).
 *
 * Спрашивается **покрытие символов**, а не число отрезков: пин, считающий
 * отрезки, был бы верен и у заливки, накрывшей не то (У-58). Здесь берётся
 * каждый символ строки и проверяется, накрыт ли он заливкой, — и у панели
 * накрытым обязан быть весь отрезок от первой `=` до последней.
 */
{
  const colors = I.getTagwheelHeaderColorsFromConfig({
    visual: { tagWheel: { fillColor: "#f0e17f", textColor: "#322b2a", showMarkers: true } },
  });
  const known = new Set(["Imp"]);

  const covered = (line: string, kind: string): Set<number> => {
    const out = new Set<number>();
    for (const s of I.tagwheelPanelSpans(line, colors, known) as Any[]) {
      if (s.kind !== kind) continue;
      for (let i = Number(s.start); i < Number(s.end); i++) out.add(i);
    }
    return out;
  };

  const panel = "- ==**[#/1]** #todo== || текст";
  const from = panel.indexOf("==");
  const to = panel.indexOf("==", from + 2) + 2;

  for (const kind of ["line", "text"]) {
    const seen = covered(panel, kind);
    const missed: number[] = [];
    for (let i = from; i < to; i++) if (!seen.has(i)) missed.push(i);
    assert.deepEqual(missed, [],
      kind + ": в панели остались некрашеные символы на местах "
      + missed.join(", ") + " — это `" + missed.map(i => panel[i]).join("") + "`");
    /* И ни одного символа за пределами панели: заливка не должна вылезать. */
    for (const i of seen) {
      assert.ok(i >= from && i < to,
        kind + ": заливка вылезла за панель на символ " + i);
    }
  }

  /* Выделение человека по-прежнему не красится ни одним из двух видов. */
  const own = "- [ ] купить ==хлеб== до пятницы";
  assert.equal(covered(own, "line").size, 0, "выделение человека получило заливку");
  assert.equal(covered(own, "text").size, 0, "выделение человека получило цвет текста");

  ok("метки `==` панели красятся вместе с ней, чужое выделение — нет");
}

/*
 * Цвет активного Field (D6, 10.13.15) и его начертание (B2, вторая часть).
 *
 * Прежнее условие ставило цвет только если текст ячейки есть в наборе
 * плейсхолдеров, то есть **только пока значение не выбрано**:
 * «panel-active-color применяется только для исходного положения field, а
 * когда я начинаю прокручивать — подсветка слетает». Теперь цвет стоит
 * всегда, а исходное состояние отличается начертанием.
 */
{
  const known = new Set(["Imp", "Importance", "type"]);
  const colors = I.getTagwheelHeaderColorsFromConfig({
    visual: { tagWheel: { textColor: "#a5a0d4", activeTextColor: "#ff0000", showMarkers: true } },
  });
  const activeOf = (line: string): Any =>
    I.tagwheelPanelSpans(line, colors, known).find((x: Any) => x.kind === "active");

  /* Значение выбрано: цвет активного стоит, начертание обычное. */
  const chosen = activeOf("- ==**[#/1]** #todo== || тест");
  assert.ok(chosen, "у активной ячейки со значением есть своё оформление");
  assert.ok(String(chosen.style).includes("#ff0000"),
    "и это цвет активного Field: " + chosen.style);
  assert.ok(String(chosen.style).includes("font-weight: 400"),
    "начертание обычное, чтобы отличать от исходного состояния: " + chosen.style);

  /* Значение не выбрано: в ячейке имя Field — тот же цвет, но полужирно. */
  const empty = activeOf("- ==**[Imp]** #todo== || тест");
  assert.ok(empty && String(empty.style).includes("#ff0000"),
    "у исходного состояния тот же цвет: " + (empty && empty.style));
  assert.ok(String(empty.style).includes("font-weight: 700"),
    "но полужирное начертание, как просил заказчик: " + empty.style);

  /* Своего цвета нет — активный красится общим, как было до правки. */
  const plain = I.tagwheelPanelSpans(
    "- ==**[#/1]** #todo== || тест",
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: { textColor: "#a5a0d4", showMarkers: true } } }),
    known,
  ).find((x: Any) => x.kind === "active");
  assert.ok(plain && String(plain.style).includes("#a5a0d4"),
    "без своего цвета активный не отличается цветом: " + (plain && plain.style));

  ok("B2: цвет активного Field не зависит от того, выбрано ли значение");
}

{
  /* И цвет читается с пути версии 2, а не выдумывается. */
  const colors = I.getTagwheelHeaderColorsFromConfig({
    visual: { tagWheel: { activeTextColor: "#ff0000", textColor: "#a5a0d4" } },
  });
  assert.equal(colors.activeTextColor, "#ff0000", "цвет активного Field читается из конфига");
  assert.equal(
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: {} } }).activeTextColor,
    "",
    "не задан — пусто, и активный красится общим",
  );
  ok("цвет активного Field читается с пути версии 2");
}

/* ---- H4: пустой цвет TagWheel берётся у темы (10.13.23) --------------- */

/*
 * Что закреплено и почему именно это.
 *
 * Чёрное заказчик видел **в панели**: поле выбора цвета принимает только
 * `#rrggbb` и пустую строку рисует чёрным. Значит закреплять надо два конца
 * сразу — чем красит заметка и что показывает поле, — и главное: что это
 * **одна и та же** переменная темы. Разойдись они, и человек увидит в поле
 * одно, а в строке другое, причём молча (У-32).
 *
 * Спрашивается результат: что уехало в стиль отрезка и что уехало в
 * `defaultValue` контрола.
 */
{
  /* 1. Пусто — красится переменной темы, а не ничем и не чёрным. */
  const themed = I.resolveTagwheelPaintColors(
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: {} } }));
  assert.equal(themed.fillColor, "var(--text-highlight-bg)",
    "заливка панели берётся у темы: " + themed.fillColor);
  assert.equal(themed.defaultTextColor, "var(--text-muted)",
    "неактивные Fields — приглушённым цветом темы: " + themed.defaultTextColor);
  assert.equal(themed.activeTextColor, "var(--text-accent)",
    "активный Field — акцентным цветом темы: " + themed.activeTextColor);

  /* 2. Цвет человека сильнее темы всегда (Ц6). */
  const own = I.resolveTagwheelPaintColors(
    I.getTagwheelHeaderColorsFromConfig({
      visual: { tagWheel: { fillColor: "#f0e17f", textColor: "#322b2a" } },
    }));
  assert.equal(own.fillColor, "#f0e17f", "заданная заливка остаётся своей");
  assert.equal(own.defaultTextColor, "#322b2a", "и заданный цвет текста тоже");
  assert.equal(own.activeTextColor, "var(--text-accent)",
    "а незаданный рядом с ними по-прежнему берётся у темы");

  /* 3. Пустое значение в конфиге осталось пустым: признак «не задан» цел. */
  const raw = I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: {} } });
  assert.equal(raw.fillColor, "", "в конфиге по-прежнему пусто, а не цвет темы");
  assert.equal(raw.activeTextColor, "", "и у активного Field тоже");

  /* 4. Панель и заметка называют одни и те же переменные (У-32). */
  assert.deepEqual(
    {
      text: THEME_COLOR_VARS["visual.tagWheel.textColor"],
      active: THEME_COLOR_VARS["visual.tagWheel.activeTextColor"],
      fill: THEME_COLOR_VARS["visual.tagWheel.fillColor"],
    },
    {
      text: I.TAGWHEEL_THEME_COLOR_VARS.defaultTextColor,
      active: I.TAGWHEEL_THEME_COLOR_VARS.activeTextColor,
      fill: I.TAGWHEEL_THEME_COLOR_VARS.fillColor,
    },
    "переменные темы в панели и в заметке — одни и те же",
  );

  /* 5. Панель показывает цвет темы, а не чёрное: `defaultValue` контрола. */
  setThemeReader((v: string) => (v === "--text-muted" ? "rgb(136, 136, 136)" : ""));
  const defs = toDefinitions(SCHEMA, TABS, {
    ctx: { get: () => undefined } as Any,
    activeTab: "visual",
    run: () => {},
    describe: () => "",
  } as Any);
  setThemeReader(null);
  const control = defs
    .flatMap((d: Any) => (d.type === "group" ? d.items : [d]))
    .map((d: Any) => d && d.control)
    .find((c: Any) => c && c.key === "visual.tagWheel.textColor");
  assert.ok(control, "контрол цвета текста панели найден");
  assert.equal(control.defaultValue, "#888888",
    "полю отдан цвет темы, а не пустая строка: " + JSON.stringify(control.defaultValue));

  ok("H4: пустой цвет TagWheel берётся у темы, и панель показывает тот же цвет");
}

console.log("\n" + passed + " проверок пройдено");
