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

/**
 * Тот же узел, но с плагином: без него пузырю неоткуда взять поиск по тегу.
 *
 * Подделан **Obsidian** (У-1): `internalPlugins` — его реестр, и здесь он
 * запоминает, с чем позвали поиск. Сам вызов взят из `app.js` 1.13.7, где
 * платформа открывает поиск по клику на тег.
 */
function paintWithApp(token: string, fill: string, border = ""): Any {
  const calls: string[] = [];
  const plugin = {
    app: {
      internalPlugins: {
        getEnabledPluginById: (id: string) => (id === "global-search"
          ? { openGlobalSearch: (q: string) => { calls.push(q); } }
          : null),
      },
    },
  };
  const w = new I.TagVisualTokenWidget(token, fill, "", 1, false, 100, 100, 100, 100, 0, "", plugin,
    undefined, undefined, false, border);
  return { el: w.toDOM(), calls };
}

/*
 * **Утверждения переехали вместе со своим предметом** (У-94, 2026-09-09). Вид
 * пузыря ушёл из свойств узла в классы и переменные (правило каталога Р7), и
 * `el.style.color` теперь пуст всегда. Самое опасное тут было
 * утверждение `assert.ok(!el.style.color)`: оно осталось бы зелёным именно
 * потому, что искать стало нечего, — запрет молчит.
 *
 * Спрашивается то же самое, тем же швом, каким его задаёт отрисовка:
 * переменная цвета и класс «есть заливка». Условие «без заливки цвет
 * не подставлять» выражено именно классом: в одном объявлении цвета
 * его не выразить.
 */
const fg = (el: Any): string => el.style.getPropertyValue("--io-tagbubble-fg");
const bg = (el: Any): string => el.style.getPropertyValue("--io-tagbubble-bg");
const filled = (el: Any): boolean =>
  String(el.className || "").split(/\s+/).includes(I.TAG_BUBBLE_FILLED_CLASS);

{
  const el = paint("#0008f0", "#f0eaea");
  assert.equal(fg(el), "#f0eaea", "заданный цвет текста берётся как есть");
  assert.equal(bg(el), "#0008f0", "и заливка тоже");
  ok("цвет текста задан — рисуется он");
}

{
  const el = paint("#0008f0", "");
  assert.equal(fg(el), "", "своего цвета текста нет");
  assert.ok(filled(el),
    "но заливка есть — и именно она включает цвет текста на подложке");
  ok("цвет не задан, заливка есть — текст на подложке, как в панели");
}

{
  /*
   * Без заливки цвет не подставляется, и это не осторожность ради
   * осторожности: `--text-on-accent` в светлой теме белый, и на белом фоне
   * заметки такой текст пропал бы совсем.
   *
   * Утверждение положительное, а не «ничего не найдено»: класса
   * «есть заливка» нет, а базовый — есть. Запрет без положительной
   * половины зелен и у узла, которого нет вовсе (У-71).
   */
  const el = paint("", "");
  assert.equal(fg(el), "", "своего цвета текста нет");
  assert.equal(bg(el), "", "и заливки тоже");
  assert.ok(!filled(el), "заливки нет — цвет текста остаётся темы");
  assert.ok(String(el.className || "").split(/\s+/).includes(I.TAG_BUBBLE_CLASS),
    "но сам пузырь на месте: утверждение выше не об отсутствии узла");
  ok("ни цвета, ни заливки — ничего не подставляется");
}

{
  /* Пустой Value рисуется пробелом: цвет ему всё равно не виден, но правило
     одно на все режимы, и подстановка не должна от режима зависеть. */
  const w = new I.TagVisualTokenWidget("#todo", "#0008f0", "", 1, true, 100, 100, 100, 100, 0, "");
  const el = w.toDOM();
  assert.ok(filled(el), "правило одно на все режимы показа");
  assert.ok(String(el.className || "").split(/\s+/).includes(I.TAG_BUBBLE_EMPTY_CLASS),
    "и режим «пусто» назван своим классом");
  ok("режим показа на подстановку не влияет");
}

{
  /*
   * И шов переноса целиком: свойств узла у пузыря больше нет ни
   * одного, и каждое правило его вида читает свою переменную из `styles.css`.
   * Без этого утверждения «перенесено в классы» было бы только в
   * планке бюджета, а планка не знает, что именно уехало.
   */
  const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
  const el = paint("#0008f0", "#f0eaea");
  const need = ["radius", "pad-y", "pad-x", "font", "line"];
  for (const key of need) {
    assert.ok(el.style.getPropertyValue("--io-tagbubble-" + key),
      "величина `" + key + "` приезжает переменной");
    assert.ok(css.indexOf("var(--io-tagbubble-" + key) >= 0,
      "и правило в `styles.css` её читает: иначе величина едет в пустоту");
  }
  assert.ok(css.indexOf("." + I.TAG_BUBBLE_CLASS + " {") >= 0,
    "у пузыря есть своё правило, а не один класс без правил");
  assert.ok(css.indexOf("." + I.TAG_BUBBLE_EMPTY_CLASS + " {") >= 0, "и у пустого");
  assert.ok(css.indexOf("." + I.TAG_BUBBLE_FILLED_CLASS + " {") >= 0, "и у залитого");
  ok("вид пузыря живёт в классах, а величины — в переменных (Р7)");
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
  const line = "#/1 [[test1]] || 111 || 📅2026-09-01";
  const zonesOf = (kinds: Any): string[] => I.scanLineVisualTokens(line, "||", "||", ["📅"], kinds)
    .map((h: Any) => h.kind + ":" + h.zone);

  /* Block, в котором значения такого рода бывают: сторона считается по
     разделителям одинаково для всех видов. */
  const full = I.buildBlockKindsFromConfig({
    pkm: { fields: { order: {
      left: ["Importance", "Project"], right: ["due"],
      types: { Importance: "tag", Project: "wikilink", due: "element" },
    } } },
  });
  assert.deepEqual(zonesOf(full), ["tag:left", "link:left", "element:right"],
    "сторона считается по разделителям одинаково для всех видов");

  /*
   * **А Block, в котором таких значений не бывает, значения не получает** —
   * его замечание 2026-09-17 про ссылку `Inline to note`: она стоит слева, где
   * у него нет ни одного Field, и кегль Block ей доставаться не должен. Это
   * то же правило, каким днём раньше чинилась полоса (правило 135), и теперь
   * оно одно на обе половины.
   */
  const emptyLeft = I.buildBlockKindsFromConfig({
    pkm: { fields: { order: { left: [], right: ["due"], types: { due: "element" } } } },
  });
  assert.deepEqual(zonesOf(emptyLeft), ["tag:middle", "link:middle", "element:right"],
    "у пустого слева Block значений нет: написанное там — ваш текст");

  /* И по родам, а не «всё или ничего»: слева бывают теги, но не ссылки. */
  const tagsOnlyLeft = I.buildBlockKindsFromConfig({
    pkm: { fields: { order: {
      left: ["Importance"], right: ["due"], types: { Importance: "tag", due: "element" },
    } } },
  });
  assert.deepEqual(zonesOf(tagsOnlyLeft), ["tag:left", "link:middle", "element:right"],
    "тег слева остаётся значением Block, ссылка рядом с ним — нет");

  ok("сторона у ссылки и элемента та же, что у тега, — и только там, где такие значения бывают");
}

{
  /*
   * **Кегль и прозрачность Block достаются только значениям Block.** Его
   * замечание 2026-09-17: «в исходной строке wikilink на трансформированную
   * заметку размера как в `tags-text-size` — так быть не должно».
   *
   * Утверждение написано **поведением до самой отрисовки**: зона решает и
   * размер, и прозрачность, и пометку выравнивания, и все три спрашивают одно
   * объявление.
   */
  const visuals = { tagTextSizeLeftPct: 50, tagTextSizeRightPct: 70,
    tagBubbleWidthPct: 100, tagBubbleHeightPct: 100 };
  const emptyLeft = I.buildBlockKindsFromConfig({
    pkm: { fields: { order: { left: [], right: ["type"], types: { type: "tag" } } } },
  });
  const line = "- [[333/имя]] :: #processed";
  const hits = I.scanLineVisualTokens(line, "::", "::", [], emptyLeft) as Any[];
  const link = hits.find((h: Any) => h.kind === "link");
  const tag = hits.find((h: Any) => h.kind === "tag");
  assert.ok(link && tag, "на строке после `Inline to note` нашлись и ссылка, и метка");

  assert.equal(I.tagVisualSizingForZone(link.zone, visuals).textSizePct, 100,
    "ссылка, которую поставил Transform, — ваш текст: кегль Block её не трогает");
  assert.equal(I.buildBlockStyleCss({ zone: link.zone, zoneOpacity: 0.4 }, visuals), "",
    "и прозрачность Block тоже: у вашего текста её нет");
  assert.equal(I.blockValueClassFor({ zone: link.zone }, visuals), "",
    "и пометки «значение в Block» она не получает");

  assert.equal(I.tagVisualSizingForZone(tag.zone, visuals).textSizePct, 70,
    "а метка справа, где теги бывают, кегль Block получает — и правый, а не левый");
  assert.equal(I.blockValueClassFor({ zone: tag.zone }, visuals), I.BLOCK_VALUE_CLASS,
    "и пометку тоже");

  ok("ссылка `Inline to note` слева не получает ни кегля Block, ни его прозрачности");
}

/* ---- две пары цветов, а не одна (его замечание к тесту 4) ------------- */

/*
 * Его слова 2026-09-22: «ты сделал два контрола (цвет ссылки и цвет
 * квадратных скобок) едиными для работы с wikilinks и hyperlinks — а я хотел,
 * чтобы hyperlinks управлялись отдельными контролами».
 *
 * Спрашивается **дорога целиком**: конфиг человека → `migrateConfig` →
 * величины, которые читает отрисовка. Проверка, подающая ветку конфига в
 * движок напрямую, минует ту самую нормализацию, где живёт перенос (У-55).
 */
{
  const visualsOf = (cfg: Any): Any => I.getTagVisualsFromConfig(I.migrateConfig(cfg)) as Any;

  /*
   * **Новая пара заводится от старой** (У-17). У того, кто цвет уже задал,
   * гиперссылки обязаны остаться того же цвета, каким были до разделения:
   * иначе разделение читается как поломка.
   */
  const inherited = visualsOf({
    schemaVersion: 2,
    visual: { tags: { linkAsWritten: { targetColor: "#12a4b6", bracketsColor: "#b61284" } } },
  });
  assert.equal(inherited.hyperlinkTargetColor, "#12a4b6",
    "цвет подписи гиперссылки заведён от прежнего контрола");
  assert.equal(inherited.hyperlinkBracketsColor, "#b61284",
    "и цвет её разметки тоже");

  /*
   * И главное: пары **расходятся**. Значения разведены нарочно — на
   * одинаковых «управляются отдельно» выполнялось бы само (У-147).
   */
  const apart = visualsOf({
    schemaVersion: 2,
    visual: {
      tags: {
        linkAsWritten: { targetColor: "#12a4b6", bracketsColor: "#b61284" },
        hyperlink: { targetColor: "#0f7a2e", bracketsColor: "#c46a00" },
      },
    },
  });
  assert.equal(apart.linkTargetColor, "#12a4b6", "у wikilink свой цвет подписи");
  assert.equal(apart.linkBracketsColor, "#b61284", "и своей разметки");
  assert.equal(apart.hyperlinkTargetColor, "#0f7a2e", "у гиперссылки свой");
  assert.equal(apart.hyperlinkBracketsColor, "#c46a00", "и своей разметки тоже");

  /*
   * Отрицательный контроль к переносу: пустая строка — законное значение
   * («взять у темы»), и она значит «человек уже решил». Перенос обязан её
   * не трогать, иначе он возвращал бы цвет, который тот снял (У-188).
   */
  const cleared = visualsOf({
    schemaVersion: 2,
    visual: {
      tags: {
        linkAsWritten: { targetColor: "#12a4b6", bracketsColor: "#b61284" },
        hyperlink: { targetColor: "", bracketsColor: "" },
      },
    },
  });
  assert.equal(cleared.hyperlinkTargetColor, "",
    "снятый цвет гиперссылки остаётся снятым, а не заводится заново от соседа");
  assert.equal(cleared.hyperlinkBracketsColor, "",
    "и второй тоже");

  /*
   * Перенос идёт один раз: второй проход по уже перенесённому конфигу ничего
   * не меняет — иначе снятый цвет возвращался бы при каждой записи настроек.
   */
  const once = I.migrateConfig({
    schemaVersion: 2,
    visual: { tags: { linkAsWritten: { targetColor: "#12a4b6", bracketsColor: "#b61284" } } },
  }) as Any;
  once.visual.tags.hyperlink.targetColor = "";
  const twice = I.getTagVisualsFromConfig(I.migrateConfig(once)) as Any;
  assert.equal(twice.hyperlinkTargetColor, "",
    "повторная запись настроек не заводит цвет заново");

  /*
   * **Третий цвет гиперссылки — адрес** (его замечание 2026-09-22 к тесту 2).
   * Он тоже заводится от соседа: до этой строки адрес красили скобки.
   */
  const inheritedAddr = visualsOf({
    schemaVersion: 2,
    visual: { tags: { hyperlink: { targetColor: "#0f7a2e", bracketsColor: "#c46a00" } } },
  });
  assert.equal(inheritedAddr.hyperlinkAddressColor, "#c46a00",
    "цвет адреса заведён от цвета скобок, которыми он красился до разделения");
  const apartAddr = visualsOf({
    schemaVersion: 2,
    visual: {
      tags: {
        hyperlink: { targetColor: "#0f7a2e", bracketsColor: "#c46a00", addressColor: "#4b2ec4" },
      },
    },
  });
  assert.equal(apartAddr.hyperlinkBracketsColor, "#c46a00", "у скобок свой цвет");
  assert.equal(apartAddr.hyperlinkAddressColor, "#4b2ec4", "у адреса свой");

  ok("его замечание к тесту 4: у гиперссылки своя пара цветов, и заведена она от прежней");
}

/* ---- гиперссылки в любой заметке (его заказ `В-181`) ------------------- */

/*
 * Его слова 2026-09-22: «должны краситься гиперссылки в любой заметке (по
 * аналогии как сейчас реализовано с wikilink)… пусть гиперссылки будут не
 * только формата `[hyper](link)`, но и просто ссылки (кроме wikilink). Если я
 * просто вставлю в строку `www.example.com`, то цвет ссылки будет как у
 * контрола на цвет текста ссылки».
 *
 * Разбор отвечает на два вопроса: где подпись (её красит цвет текста ссылки) и
 * где сама разметка (её красит цвет скобок). Отрицательные контроли тут
 * важнее положительных: вокруг ровно те формы, которые похожи на ссылку и ею
 * не являются.
 */
{
  const of = (line: string): Any[] => I.scanHyperlinksInLine(line) as Any[];
  const shown = (line: string, h: Any): string => line.slice(h.labelFrom, h.labelTo);
  const marks = (line: string, h: Any): string[] =>
    (h.marks as Any[]).map((m: Any) => line.slice(m.from, m.to));

  const bare = "смотри www.example.com дальше";
  assert.equal(of(bare).length, 1, "голый адрес найден один");
  /*
   * **Голый адрес — адрес, а не подпись** (его слово 2026-09-22, вечер: «я
   * передумал… просто ссылка в тексте должна управляться одним контролом
   * `hyperlink-address-color`»). Это отменяет его же `В-191` того же дня, и
   * отменил он сам — тут не моё перечитывание (правило 154).
   */
  assert.equal(shown(bare, of(bare)[0]), "",
    "подписи у голого адреса нет: красить цветом подписи нечего");
  assert.deepEqual(marks(bare, of(bare)[0]), [],
    "и разметки у него нет вовсе");

  const md = "ссылка [hyper](https://example.com/a) в тексте";
  assert.equal(shown(md, of(md)[0]), "hyper",
    "у разметки подпись — то, что человек читает");
  /*
   * **Знаков три, а адрес отдельно** — его замечание 2026-09-22 к тесту 2:
   * «мне не нравится что в `[hyper](link)` цвет `link` управляется
   * hyperlink-brackets-color — сделай отдельный контрол на него». До этого
   * адрес ехал вторым знаком, вместе с `](` и `)`.
   */
  assert.deepEqual(marks(md, of(md)[0]), ["[", "](", ")"],
    "разметка — только знаки: адрес из них вынут");
  const addr = (line: string, h: Any): string =>
    (h.address ? line.slice(h.address.from, h.address.to) : "");
  assert.equal(addr(md, of(md)[0]), "https://example.com/a",
    "адрес — свой кусок, и он ровно между круглыми скобками");
  assert.equal(addr(bare, of(bare)[0]), "www.example.com",
    "голый адрес весь — кусок адреса, и красит его цвет адреса");
  /*
   * Отрицательный контроль к тому же: цвет подписи до голого адреса теперь
   * не доходит **ни на знак**. Без него «адрес красится цветом адреса» было
   * бы зелёным и у разбора, который красит его обоими.
   */
  assert.equal(of(bare)[0].labelTo - of(bare)[0].labelFrom, 0,
    "у голого адреса подпись пуста: цвету подписи красить нечего");

  /* Точка в конце предложения адресу не принадлежит. */
  const dotted = "адрес https://example.com/x?y=1. конец";
  assert.equal(addr(dotted, of(dotted)[0]), "https://example.com/x?y=1",
    "знак конца предложения в адрес не входит");

  /*
   * Отрицательные контроли. Без них «ссылки красятся» выполнялось бы и
   * правилом, которое красит всё подряд.
   */
  assert.deepEqual(of("[[test1]] и [[Note#heading]]"), [],
    "wikilink — чужая дорога: его красит значение Field, а не этот разбор");
  assert.deepEqual(of("картинка ![alt](pic.png) в строке"), [],
    "вставка картинки ссылкой не считается: читать в ней нечего");
  assert.deepEqual(of("код `https://example.com` рядом"), [],
    "внутри обратных кавычек ссылок не бывает");
  assert.deepEqual(of("- [ ] #todo || текст || 📅2026-09-02"), [],
    "чекбокс задачи на разметку ссылки не похож");
  const mixed = "[[wiki]] и [подпись](https://a.b) рядом";
  assert.equal(of(mixed).length, 1, "рядом с wikilink разметка находится: " + of(mixed).length);
  assert.equal(shown(mixed, of(mixed)[0]), "подпись", "и подпись у неё своя");
  ok("`В-181`: разбор находит обе формы гиперссылки и не трогает чужие");
}

{
  /*
   * **Цена разбора на длинной строке — не миллисекунды, а отношение** (У-223).
   * Разбор зовётся на каждую видимую строку при каждой перерисовке, и строку в
   * двадцать тысяч знаков человек получает одной вставкой.
   *
   * Первая версия образца голого адреса брала схему открытым
   * `[A-Za-z0-9+.-]*` перед `://`, и на каждой букве длинного слова проходила
   * его до конца в поисках двоеточия: 251 мс на строку в 22 тысячи знаков.
   * Порог проверяется **прежней версией образца** — она обязана быть заметно
   * медленнее нынешней на той же строке и той же машине; абсолютное время
   * тут ничего не значит (У-78).
   */
  const OLD_SCHEME = /(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/|mailto:|www\.)[^\s<>"'`]+/g;
  const long = "[a](" + "a".repeat(20000) + ") текст " + "слово ".repeat(400);
  const best = (body: () => void): number => {
    let min = Infinity;
    for (let i = 0; i < 3; i++) {
      const at = process.hrtime.bigint();
      body();
      const took = Number(process.hrtime.bigint() - at);
      if (took < min) min = took;
    }
    return min;
  };
  const now = best(() => { I.scanHyperlinksInLine(long); });
  const before = best(() => {
    OLD_SCHEME.lastIndex = 0;
    while (OLD_SCHEME.exec(long) !== null) { /* прежний образец, целиком */ }
  });
  assert.ok(now * 10 < before,
    "разбор ссылок на длинной строке стоит как прежний образец схемы: "
    + Math.round(now / 1000) + " мкс против " + Math.round(before / 1000)
    + " — предел длины схемы снят или обойдён");
  /*
   * Контроль к самому порогу: прежний образец обязан быть медленным **здесь и
   * сейчас**. Окажись он быстрым — порог зелен от того, что мерить нечем.
   */
  assert.ok(before > 20000000,
    "положительный контроль: прежний образец схемы прошёл длинную строку за "
    + Math.round(before / 1000) + " мкс — на этой машине порог измеряет не то");
  ok("цена разбора длинной строки: " + Math.round(now / 1000) + " мкс против "
    + Math.round(before / 1000) + " у прежнего образца");
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
  const visuals = { tagTextSizeLeftPct: 100, tagTextSizeRightPct: 100 };
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
  const visuals = { tagTextSizeLeftPct: 120, tagTextSizeRightPct: 95 };
  const css = I.buildBlockStyleCss({ zone: "left", zoneOpacity: 1 }, visuals);
  const bubble = I.computeTagVisualStyle(120, 100, 100, 0);
  /*
   * **И подъём тот же** (его слово 2026-09-19: «при 100 текст в left/right
   * block должен быть таким же как в text block»): ссылка и эмодзи-элемент
   * стоят на том же уровне, что пузырь, и считается он одной формулой —
   * половина разницы кеглей строки и значения. На сотне процентов подъёма нет
   * вовсе, и это проверяется ниже отдельно.
   */
  const rise = Math.round((I.TAG_TEXT_FALLBACK_PX - bubble.fontSizePx) / 2 * 100) / 100;
  assert.equal(css, "font-size: " + bubble.fontSizePx + "px; vertical-align: " + rise + "px;",
    "размер и уровень берутся тем же расчётом, что у пузыря");
  assert.equal(I.buildBlockStyleCss({ zone: "left", zoneOpacity: 1 },
    { tagTextSizeLeftPct: 100, tagTextSizeRightPct: 100 }), "",
    "на сотне процентов не задаётся ни кегль, ни уровень: значение — обычный текст строки");
  ok("размер текста одинаков у пузыря и у голого токена");
}

{
  /*
   * **Тег без своего цвета: пузырь наш, вид темы, щелчок работает.**
   *
   * Его слово 2026-09-12: «теги, у которых стоит дефолтный fill и text, не
   * подчиняются настройкам tag-appearance», и выбор он сделал сам — «пусть его
   * рисует плагин, цвет из темы», с условием: «меня не устраивает, что по
   * такому тегу нельзя кликнуть, это недопустимо».
   */
  const { el, calls } = paintWithApp("#todo", "");
  const cls = String(el.className || "").split(/\s+/);
  assert.ok(cls.includes(I.TAG_BUBBLE_THEME_CLASS),
    "у пузыря без своей заливки обязан быть класс вида темы: " + el.className);
  assert.ok(!cls.includes(I.TAG_BUBBLE_FILLED_CLASS), "заливки своей у него нет");
  assert.ok(cls.includes(I.TAG_BUBBLE_CLICKABLE_CLASS), "и класс «по мне можно щёлкнуть»");
  el.dispatch("mousedown", { button: 0, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(calls, ["tag:#todo"],
    "щелчок обязан открыть поиск по тегу тем же запросом, каким его открывает Obsidian: "
    + JSON.stringify(calls));
  ok("тег без цвета: пузырь наш, вид темы, щелчок открывает поиск");
}

{
  /*
   * И вторая половина того же правила: **ссылка и эмодзи-элемент пузыря не
   * получают**. Заменить `[[Note]]` своим узлом значит забрать у ссылки клик,
   * и поиск по тегу тут не замена. Утверждение положительное: класс щелчка
   * ставится по признаку «это тег», а не «это наш узел».
   */
  const { el, calls } = paintWithApp("[[test1]]", "#0008f0");
  const cls = String(el.className || "").split(/\s+/);
  assert.ok(!cls.includes(I.TAG_BUBBLE_CLICKABLE_CLASS),
    "ссылке щелчок по тегу не приделывается: " + el.className);
  assert.ok(!cls.includes(I.TAG_BUBBLE_THEME_CLASS), "и вид тега ей не достаётся");
  el.dispatch("mousedown", { button: 0, preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(calls, [], "и поиска по ней не открывается");
  ok("ссылке пузырь тега не приделывается");
}

{
  /*
   * **`#FFFFFF` — прозрачно, и в заливке, и в рамке** (его пункт цикла 89:
   * «при fill = `#FFFFFF` цвет был прозрачным… не хочу делать отдельный
   * контрол на прозрачность»; то же о `Side`). Заливка `#FFFFFF` — не своя
   * подложка, а вид темы с прозрачным фоном.
   */
  assert.ok(I.isClearColor("#FFFFFF") && I.isClearColor("#ffffff"), "белый в любом регистре — прозрачно");
  assert.ok(!I.isClearColor("#fffffe") && !I.isClearColor(""), "и только он");
  const clear = paintWithApp("#todo", "#FFFFFF").el;
  const clearCls = String(clear.className || "").split(/\s+/);
  assert.ok(!clearCls.includes(I.TAG_BUBBLE_FILLED_CLASS), "белой подложки нет: " + clear.className);
  assert.ok(clearCls.includes(I.TAG_BUBBLE_THEME_CLASS), "текст и рамка — темы");
  assert.equal(clear.style.getPropertyValue("--io-tagbubble-bg"), "transparent", "фон прозрачный");
  const red = paintWithApp("#todo", "", "#ff0000").el;
  assert.ok(String(red.className).split(/\s+/).includes(I.TAG_BUBBLE_SIDE_CLASS), "свой цвет рамки — свой класс");
  assert.equal(red.style.getPropertyValue("--io-tagbubble-side"), "#ff0000", "и цвет рамки переменной");
  const none = paintWithApp("#todo", "", "#FFFFFF").el;
  assert.equal(none.style.getPropertyValue("--io-tagbubble-side"), "transparent", "рамка #FFFFFF прозрачна");
  const plain = paintWithApp("#todo", "").el;
  assert.ok(!String(plain.className).split(/\s+/).includes(I.TAG_BUBBLE_SIDE_CLASS), "без Side рамка темы");
  ok("#FFFFFF прозрачен в заливке и рамке, Side красит рамку");
}

{
  /*
   * **Размеры `Inline appearance` — про Blocks, и объявление у правила одно**
   * (замечание заказчика 2026-09-12, правило 80). Раньше зону спрашивала
   * только отрисовка отрезком, а пузырю размеры передавались безусловно — и
   * тег со своим цветом, стоящий в тексте человека между разделителями, рос
   * от `Text size` наравне с блоками.
   *
   * Здесь закреплено само объявление; то, что его спрашивает **отрисовка**,
   * видит браузер: `tests/browser/check_editor.js`, пункт 10, и подмены
   * `middle-takes-sizing` и `block-loses-sizing`.
   */
  /* Стороны разведены нарочно: на равных числах переворот правила «левая
     величина левой зоне» прошёл бы незамеченным (У-147). */
  const visuals = {
    tagTextSizeLeftPct: 140, tagTextSizeRightPct: 65, tagBubbleWidthPct: 130,
    tagBubbleHeightPct: 120, emptyBubbleSizePct: 150, tagShapePct: 100,
  };
  const wantSize: Record<string, number> = { left: 140, right: 65 };
  for (const zone of ["left", "right"]) {
    const sizing = I.tagVisualSizingForZone(zone, visuals);
    assert.equal(sizing.inBlock, true, zone + ": это Block");
    assert.equal(sizing.textSizePct, wantSize[zone], zone + ": размер текста своей стороны");
    assert.equal(sizing.bubbleWidthPct, 130, zone + ": ширина пузыря приезжает");
    assert.equal(sizing.bubbleHeightPct, 120, zone + ": высота пузыря приезжает");
    assert.equal(sizing.emptyBubblePct, 150, zone + ": ширина пустого пузыря приезжает");
  }
  const mid = I.tagVisualSizingForZone("middle", visuals);
  assert.equal(mid.inBlock, false, "текст между разделителями — не Block");
  /*
   * **Кончается на границе Block ровно одна настройка — кегль.** Его слово
   * 2026-09-12, второй заход: «да, должны. Не должен действовать только
   * tags-text-size». Первая версия правила обнуляла в вашем тексте все четыре
   * величины, и тег там выходил не такой, как в блоке.
   */
  assert.equal(mid.textSizePct, 100, "кегль в вашем тексте остаётся обычным");
  assert.deepEqual(
    [mid.bubbleWidthPct, mid.bubbleHeightPct, mid.emptyBubblePct],
    [130, 120, 150],
    "а ширина, высота и пустой пузырь правятся ползунками и там");
  /*
   * И форма сюда не входит: скругление — вид, а не размер, и оно приезжает к
   * пузырю где угодно. Утверждение положительное: правило не отдаёт формы
   * вовсе, значит её берут мимо него.
   */
  assert.equal(Object.prototype.hasOwnProperty.call(mid, "tagShapePct"), false,
    "форма пузыря через это правило не ездит — она общая для любой зоны");
  ok("размеры Inline appearance объявлены один раз, а границу Block держит кегль");

  /*
   * **Строка плагина — та, где есть хотя бы ОДИН его разделитель.** Граница
   * его же: «обычные заметки без разделителей плагин не трогает вовсе». Случай
   * с одним разделителем назван отдельно: он пришёл со скриншотом, и при
   * совпадающих разделителях его не отличить от случая с двумя (У-147).
   */
  assert.equal(I.lineBelongsToPlugin("- #123 || 1231 #new", "||", "::"), true,
    "один разделитель — строка наша");
  assert.equal(I.lineBelongsToPlugin("- #123 || 1231 :: 👤111", "||", "::"), true,
    "два — тем более");
  assert.equal(I.lineBelongsToPlugin("- 1231 :: 👤111", "||", "::"), true,
    "и один только второй — тоже");
  assert.equal(I.lineBelongsToPlugin("обычная строка заметки с тегом #todo", "||", "::"), false,
    "а строка без разделителей плагину не принадлежит");
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
  const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
  const m = css.match(/\.io-bubble--empty\s*\{[^}]*width:\s*calc\((\d+)px\s*\*\s*var\(--io-empty-x\)\)/);
  assert.ok(m, "панель по-прежнему считает ширину пустого пузыря от базового числа");
  const basePx = Number(m ? m[1] : 0);
  assert.equal(I.TAG_EMPTY_BUBBLE_BASE_PX, basePx,
    "заметка считает пустой пузырь от того же числа, что и панель");

  const widthAt = (pct: number): string => {
    const w = new I.TagVisualTokenWidget("#todo", "#0008f0", "", 1, true, 100, 80, 80, pct, 0, "");
    /* Ширина — вычисленная величина, и после переноса Р7 она приезжает
       переменной: тот же шов, что у цвета выше (У-94). */
    return w.toDOM().style.getPropertyValue("--io-tagbubble-width");
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

  /* Панель на строке есть — отрезок принадлежит ей. */
  const span = I.tagwheelPanelSpanInLine(line);
  assert.ok(span, "на строке с панелью отрезок TagWheel есть");
  assert.equal(line.slice(span.start, span.end), "==`#todo` **[work]**==",
    "границы отрезка — от первых `==` до вторых: " + line.slice(span.start, span.end));

  /* Нет обособления — нечего забирать. */
  assert.equal(I.tagwheelPanelSpanInLine("- #todo || text"), null,
    "на обычной строке отрезка TagWheel нет");

  ok("B2: отрезок TagWheel объявлен одним правилом на два слоя");
}

/*
 * **Отрезок панели не зависит от цветов, и это его замечание 2026-09-20**
 * («я удалил все настройки и начал заново — получил такое»).
 *
 * Прежде вопрос «забрать ли отрезок у слоя пузырей» решался заливкой, и у двух
 * читателей одних цветов ответы разошлись (У-216): слой оформления спрашивает
 * их через `resolveTagwheelPaintColors`, где пустое заменяется цветом темы, а
 * слой пузырей спрашивал ответ конфига напрямую. У свежей установки, где цвета
 * панели не трогали вовсе, отрезок не забирался — и пузырь вставал поверх
 * разметки самой панели.
 *
 * Спрашивается симптом, а не правка: на строке панели, снятой стендом с его
 * настроек, слой пузырей находит токен **внутри** панели, и этот токен обязан
 * попасть в отрезок. Цвета берутся **через читателя продукта**, а не литералом:
 * иначе проверка снова смотрела бы мимо шва.
 */
{
  const fresh = I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: {} } }) as Any;
  assert.equal(String(fresh.fillColor || ""), "",
    "у свежей установки заливка панели пуста — иначе случай не тот");

  const panel = "- #low ==**[#low]** `Type`== ::  :: текст";
  const seg = I.tagwheelPanelSpanInLine(panel);
  assert.ok(seg, "панель узнаётся и при пустых цветах");

  /* Положительный контроль: внутри панели слою пузырей есть что найти. */
  const hits = Array.from(I.scanLineVisualTokens(panel, "::", "::", [], {}) as Any[]);
  const inside = hits.filter((h: Any) => Number(h.index) >= seg.start && Number(h.index) < seg.end);
  assert.ok(inside.length > 0,
    "внутри панели слой пузырей находит токен — иначе проверять нечего: " + JSON.stringify(hits.map((h: Any) => h.token)));
  assert.ok(inside.some((h: Any) => String(h.token).indexOf("]**") >= 0),
    "и находит он разметку самой панели, а не значение человека: " + JSON.stringify(inside.map((h: Any) => h.token)));

  ok("S12: отрезок панели забирается у слоя пузырей и при нетронутых цветах");
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

  /*
   * **Набор имён строится настоящей функцией, а не пишется здесь руками**
   * (У-55, заход 6 ревизии 2026-09-11). Прежде тут стоял
   * `new Set(["Imp", "Importance", "Project", "type"])`, и это значило две
   * вещи сразу:
   *
   *   * `buildTagwheelPlaceholderSetFromConfig` — та функция, которая набор и
   *     собирает в продукте, — **не выполнялась ни одним прогоном**; проба
   *     `throw` в её теле оставляла все 66 файлов зелёными;
   *   * разницы между **подписью** Field и его **ключом** набор не видел:
   *     подставь продукту ключ вместо подписи, и ни одна проверка не покраснеет.
   *
   * Поэтому конфиг здесь такой, в каком подпись и ключ **различаются**:
   * `imp → "Imp"`, `project → "Project"`, а у `type` подписи нет вовсе — и
   * тогда по правилу нормализации именем становится сам ключ.
   */
  const ORDER_CFG = I.migrateConfig({
    schemaVersion: 1,
    pkm: { behavior: { order: {
      left: ["imp", "type"],
      right: ["project"],
      labels: { imp: "Imp", project: "Project" },
      types: { imp: "tag", type: "tag", project: "link" },
      active: { imp: "yes", type: "yes", project: "yes" },
      enabled: { imp: true, type: true, project: true },
    } } },
  });
  const known = I.buildTagwheelPlaceholderSetFromConfig(ORDER_CFG) as Set<string>;

  /*
   * Контроль до вывода (У-88). Первая версия этой фикстуры подавала конфиг
   * **мимо** `migrateConfig` — и тут же выяснилось, что Field без подписи в
   * набор не попадает вовсе: подписи досыпает нормализация, а сырую форму
   * продукт не видит никогда. То есть фикстура, минующая нормализацию,
   * проверяет функцию, которой в продукте нет (У-55) — ровно то, что этот
   * заход ревизии и ищет.
   */
  assert.ok(known.has("Imp") && known.has("Project"),
    "подписи Fields не доехали до набора имён панели — панель перестанет узнавать"
    + " себя, как только человек переименует Field: " + JSON.stringify(Array.from(known)));
  /*
   * Ключи в наборе тоже есть, и это **не** замена подписи, а союз: имя Field
   * приезжает и как `id`, и как `placeholder`, потому что в строке может
   * стоять любое из двух. Утверждение «ключа быть не должно» было моей
   * догадкой о замысле, а не чтением продукта, и первая версия этой правки
   * на нём и покраснела.
   */
  assert.ok(known.has("imp") && known.has("project"),
    "ключи Fields из набора пропали — панель перестанет узнавать себя там, где"
    + " в строке стоит ключ: " + JSON.stringify(Array.from(known)));
  assert.ok(known.has("type"),
    "Field без подписи обязан войти в набор своим ключом — его имя и есть ключ: "
    + JSON.stringify(Array.from(known)));

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

  /* Выделение человека: ни одного оформления и ни одного отобранного отрезка. */
  const own = "- [ ] купить ==хлеб== до пятницы";
  assert.deepEqual(I.tagwheelPanelSpans(own, colors, known), [],
    "обычное выделение человека слой панели не красит");
  assert.equal(I.tagwheelPanelSpanInLine(own), null,
    "и слой пузырей внутри него работает как обычно");

  /* Выделенный тег — тот же случай, и это вторая половина дефекта. */
  const ownTag = "- ==#todo== || текст";
  assert.deepEqual(I.tagwheelPanelSpans(ownTag, colors, known), [],
    "выделенный тег человека тоже не панель");
  assert.equal(I.tagwheelPanelSpanInLine(ownTag), null,
    "и пузырь у него остаётся: отрезок слою панели не отдан");

  /* Настоящая панель красится, как раньше: правка ничего не отняла. */
  const panel = "- ==**[#/1]** #todo== || текст";
  const spansPanel = I.tagwheelPanelSpans(panel, colors, known);
  assert.ok(spansPanel.some((x: Any) => x.kind === "line" && String(x.style).includes("--io-twfill")),
    "панель по-прежнему получает заливку: " + JSON.stringify(spansPanel));
  assert.ok(I.tagwheelPanelSpanInLine(panel),
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
  /*
   * **Цвет ячейки с уже выбранным значением** — его заказ 2026-09-17: «сейчас
   * в tagwheel дефолтное значение field (само название field) визуально не
   * различается от измененного значения field (когда пользователь выбрал
   * value)… при `Type` цвет field должен определяться panel-text-color, а при
   * `#todo` в зависимости от этого контрола».
   *
   * Ячейки не режутся: красится **дополнение** — из отрезка панели вычитается
   * всё, что рисует не выбранное значение. Поэтому утверждения написаны про
   * то, **что попало под цвет**, а не про число отрезков: число зависит от
   * того, сколько имён полей стоит между значениями, и говорило бы о фикстуре.
   */
  const known = new Set(["Imp", "Type", "Cat"]);
  const wheel = {
    textColor: "#a5a0d4", activeTextColor: "#ff0000", chosenValueColor: "#00aa55",
    showMarkers: true,
  };
  const colors = I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: wheel } });
  /* Панель: активная ячейка, выбранное значение и имя поля в обратных
     кавычках — три состояния разом, иначе правило проверялось бы на одном. */
  const line = "- ==**[#/1]** #todo `Cat`== || тест";
  const painted = (I.tagwheelPanelSpans(line, colors, known) as Any[])
    .filter(x => x.kind === "chosen")
    .map(x => line.slice(x.start, x.end));
  const joined = painted.join("");

  assert.ok(joined.includes("#todo"),
    "выбранное значение красится своим цветом: " + JSON.stringify(painted));
  assert.ok(!joined.includes("Cat"),
    "а имя поля — нет, оно остаётся цветом неактивных: " + JSON.stringify(painted));
  assert.ok(!joined.includes("#/1"),
    "и активная ячейка не трогается, у неё свой цвет: " + JSON.stringify(painted));

  /*
   * **Имя поля узнаётся по обратным кавычкам, а не только по набору имён.**
   * Набор собран из конфига и знает поля поимённо; движок же печатает имя
   * **группы**, а группа бывает склеена из двух полей (`#parent/#child`), и
   * такого имени в наборе нет. Без этого утверждения ветка с кавычками была бы
   * зелёной от того, что её работу делает набор (У-56).
   */
  const merged = "- ==**[#/1]** #todo `Type+Cat`== || тест";
  const mergedPaint = (I.tagwheelPanelSpans(merged, colors, known) as Any[])
    .filter(x => x.kind === "chosen")
    .map(x => merged.slice(x.start, x.end))
    .join("");
  assert.ok(!mergedPaint.includes("Type+Cat"),
    "имя склеенной группы — тоже имя поля, и оно не красится как значение: "
    + JSON.stringify(mergedPaint));
  assert.ok(mergedPaint.includes("#todo"),
    "а значение рядом с ним красится по-прежнему: " + JSON.stringify(mergedPaint));

  /*
   * Отрицательный контроль, и он здесь важнее остальных: без своего цвета
   * отрезков этого рода быть не должно вовсе — иначе «пусто» красило бы
   * пустой строкой и гасило текст.
   */
  const without = (I.tagwheelPanelSpans(
    line,
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: { textColor: "#a5a0d4", showMarkers: true } } }),
    known,
  ) as Any[]).filter(x => x.kind === "chosen");
  assert.deepEqual(without, [],
    "без своего цвета выбранное значение не красится ничем: " + JSON.stringify(without));

  /*
   * И второй: **один** цвет ячейки без остальных всё равно оформляет панель.
   * Признак «панель вообще красится» перечислял цвета поимённо, и новый в него
   * надо было вписать — иначе человек, задавший только его, не увидел бы
   * ничего (У-32).
   */
  const alone = I.tagwheelPanelSpans(
    line,
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: { chosenValueColor: "#00aa55", showMarkers: true } } }),
    known,
  ) as Any[];
  assert.ok(alone.some(x => x.kind === "chosen"),
    "заданный один этот цвет оформляет панель сам по себе: " + JSON.stringify(alone.map(x => x.kind)));

  ok("Chosen Value text color: красится значение, а имя поля и активная ячейка — нет");
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

{
  /*
   * **Шов «что сказано в конфиге» → «чем панель и правда красится» ничего не
   * теряет.** Его замечание 2026-09-17: «не работает — я установил
   * `panel-chosen-color`, ждал, что поменяется цвет выбранных значений».
   * Цвет доезжал до предпросмотра в панели и не доезжал до заметки: в
   * `resolveTagwheelPaintColors` ключи были перечислены поимённо, и нового
   * среди них не было. Весь набор был при этом зелёным — все проверки выше
   * зовут `tagwheelPanelSpans` с ответом конфига **напрямую**, минуя шов.
   *
   * Поэтому утверждение написано **по свойству, а не по списку имён** (У-201):
   * что бы ни отдал конфиг, до слоя заметки это обязано доехать. Следующий
   * цвет попадёт под него сам.
   */
  const wheel = {
    textColor: "#a5a0d4",
    activeTextColor: "#ff0000",
    chosenValueColor: "#00aa55",
    fillColor: "#ddc5c5",
    showMarkers: true,
  };
  const fromConfig = I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: wheel } }) as Any;
  const painted = I.resolveTagwheelPaintColors(fromConfig) as Any;
  const lost = Object.keys(fromConfig).filter(
    key => key !== "showPrefix" && String(painted[key] || "") !== String(fromConfig[key] || ""),
  );
  assert.deepEqual(lost, [],
    "каждый заданный цвет доезжает от конфига до слоя заметки: " + JSON.stringify(lost));

  /*
   * И то же поведением, до самого отрезка: ту дорогу, которой рисуется
   * заметка, проверки не проходили ни разу (У-56).
   */
  const line = "- ==**[#/1]** #todo `Cat`== || тест";
  const known = new Set(["Imp", "Type", "Cat"]);
  const chosen = (I.tagwheelPanelSpans(line, painted, known) as Any[])
    .filter(x => x.kind === "chosen")
    .map(x => line.slice(x.start, x.end))
    .join("");
  assert.ok(chosen.includes("#todo"),
    "на дороге заметки выбранное значение красится своим цветом: " + JSON.stringify(chosen));

  /*
   * Отрицательный контроль: у `Chosen Value text color` переменной темы нет
   * нарочно — «пусто» значит «как остальные неактивные». Подстановка темы
   * перекрасила бы ячейку у каждого, кто контрол не трогал.
   */
  const emptyChosen = I.resolveTagwheelPaintColors(
    I.getTagwheelHeaderColorsFromConfig({ visual: { tagWheel: { textColor: "#a5a0d4" } } })) as Any;
  assert.equal(String(emptyChosen.chosenValueColor || ""), "",
    "незаданный цвет выбранного значения остаётся пустым: "
    + JSON.stringify(emptyChosen.chosenValueColor));
  assert.deepEqual(
    (I.tagwheelPanelSpans(line, emptyChosen, known) as Any[]).filter(x => x.kind === "chosen"),
    [],
    "и отрезков этого рода на дороге заметки тогда нет вовсе",
  );

  ok("Цвета панели доезжают до заметки: шов не теряет ни одного ключа");
}

/*
 * **Чем печатается значение вместо себя — один ответ на два места** (его заказ
 * 2026-09-20: «в настройках скроллера нужно добавить режим отображения… чтобы при
 * прокручивании пользователь видел `#todo` либо `🎯`»).
 *
 * Коробка скроллера показывает значения, которых на строке ещё нет, — спросить
 * их у отрисовки нечем. Поэтому карта собирается заранее, и собирает её тот же
 * ответ, каким пузырь решает то же самое: `custom` только тогда, когда текст и
 * правда задан (`resolveEffectiveTagVisualMode`).
 *
 * Отрицательные контроли здесь важнее положительного: в карту не должно
 * попасть ни значение с режимом `custom` и пустым текстом, ни значение, у
 * которого текст написан, а режим остался прежним.
 */
{
  const cfg = {
    visual: {
      tags: {
        byTag: {
          Type: {
            "#todo": { visibility: "custom", customText: "🎯" },
            "#idea": { visibility: "custom", customText: "" },
            "#mem": { visibility: "default", customText: "🧠" },
            "#done": { visibility: "empty", customText: "" },
          },
        },
      },
    },
  };
  const map = I.buildTagCustomTextMap(cfg) as Any;
  assert.equal(map["#todo"], "🎯",
    "значение со своим текстом печатается им: " + JSON.stringify(map));
  assert.ok(!Object.prototype.hasOwnProperty.call(map, "#idea"),
    "режим `custom` с пустым текстом в карту не попадает: " + JSON.stringify(map));
  assert.ok(!Object.prototype.hasOwnProperty.call(map, "#mem"),
    "написанный текст без режима `custom` в карту не попадает: " + JSON.stringify(map));
  assert.ok(!Object.prototype.hasOwnProperty.call(map, "#done"),
    "пустой пузырь своего текста не печатает: " + JSON.stringify(map));

  /* Контроль: на конфиге без своих текстов карта пуста, а не «что-нибудь». */
  assert.deepEqual(I.buildTagCustomTextMap({ visual: { tags: { byTag: {} } } }), {},
    "без заданных текстов карта пуста");

  ok("S13: чем печатается значение вместо себя — один ответ на заметку и на скроллер");
}

console.log("\n" + passed + " проверок пройдено");
