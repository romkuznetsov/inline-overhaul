"use strict";

/**
 * Страница гейта: **настоящий редактор CodeMirror с настоящим слоем плагина**.
 *
 * **Почему это стало возможно** (У-98). В `harness.js` до 2026-09-09 стояло
 * «панель плагина в браузер не поднять — её рисует Obsidian, и платформы тут
 * нет». Про панель это верно и осталось верным. Но слой оформления **редактора**
 * — это чистый CodeMirror: `@codemirror/view` лежит в `node_modules`,
 * `decorations.js` подключает только его, `@codemirror/state` и свои модули, и
 * всё это собирается в страницу одной командой esbuild. То есть «как это
 * выглядит в самой заметке» перестало быть вопросом, на который отвечает
 * только глаз заказчика, — а этой строкой лист приёмки кончался дважды.
 *
 * **Что здесь настоящее и что подделано** (У-1):
 *
 *   * настоящие — `EditorView`, `RectangleMarker`, `layer`, разбор строки,
 *     виджеты пузырей, слой подложки и правила стилей: всё берётся из
 *     `src/**` и `@codemirror/view` без единой копии;
 *   * подделан — **Obsidian**. Ссылку `[[…]]`, чекбокс и знак списка в Live
 *     Preview рисует он, и его тут нет. На месте ссылки стоит пометка
 *     `io-probe-link`, и подделано в ней ровно одно свойство, обмеренное по
 *     скриншоту заказчика 18.png: её строчный ящик **выше** ящика соседнего
 *     текста. Это и есть предмет замечания «если в block встречается wikilink,
 *     то полоска становится выше».
 *
 * Числа наружу не выводятся: страница отдаёт измерения, а утверждения о них
 * живут в `check_editor.js`.
 */

const { EditorState } = require("@codemirror/state");
const { EditorView, Decoration, ViewPlugin } = require("@codemirror/view");
const { StreamLanguage, LanguageSupport } = require("@codemirror/language");
const decorations = require("../../src/ui/editor/decorations.js");
const visuals = require("../../src/core/editor_visuals_config.js");
const scroller = require("../../src/ui/tagwheel_scroller_overlay.js");

const SEP = "::";

/*
 * Конфиг заказчика в той части, которая решает вид блоков: его цвет подложки,
 * его густота, его размеры. Взят с его `data.json` — фикстура, придуманная
 * заново, проверяла бы другого человека (У-2).
 */
/* Метка элемента объявлена один раз: её знают и корзина элементов, и поле. */
const MARKER_DUE = "\u{1F4C5}";

const CFG = {
  pkm: {
    lineFormat: { separator1: SEP, separator2: SEP },
    fields: {
      elements: { byField: { due: { emoji: MARKER_DUE, format: "YYYY-MM-DD hh:mm" } } },
      /*
       * Порядок Fields — часть фикстуры, и без него страница незаконна (У-38):
       * подложка Block спрашивает у него, какого рода значения в этом Block
       * бывают, а конфиг без порядка означает «Block пуст, красить нечего».
       * Роды названы по строкам ниже: слева теги и ссылка, справа элемент и тег.
       */
      order: {
        left: ["type", "Category", "Importance", "Project"],
        right: ["due", "state"],
        types: {
          type: "tag", Category: "tag", Importance: "tag", Project: "wikilink",
          due: "element", state: "tag",
        },
      },
      /*
       * **Списки значений — тоже часть фикстуры, и с 2026-09-18 обязательны**
       * (В-141): ссылка получает оформление Block, только если она названа
       * значением поля, и страница без этих корзин мерила бы не то, что видит
       * человек. `[[test1]]` и `[[test]]` здесь названы значениями `Project` —
       * именно они и стоят в строках ниже.
       */
      tags: {
        fields: [
          { id: "type", prefix: "#", values: [{ token: "todo", active: true }] },
          { id: "Category", prefix: "#", values: [{ token: "work", active: true }, { token: "new", active: true }] },
          { id: "Importance", prefix: "#", values: [{ token: "/1", active: true }] },
          { id: "state", prefix: "#", values: [{ token: "open", active: true }] },
        ],
      },
      links: {
        fields: [
          { id: "due", kind: "genericElement", marker: MARKER_DUE, values: [""] },
          {
            id: "Project",
            source: "wikilinks:Project",
            values: [
              { token: "test1", active: true },
              { token: "test", active: true },
              { token: "shown1", active: true },
            ],
          },
        ],
      },
    },
  },
  /*
   * Плавающая кнопка `→` включена нарочно: с 2026-09-09 подложка правого блока
   * прижимается к ней так же, как левая прижата к чекбоксу (решение заказчика
   * по вопросу о полосе за спиной кнопки). Без кнопки на странице этот прижим
   * проверялся бы отсутствием предмета (У-113).
   */
  features: { transform: { enabled: true } },
  navigation: {
    jumpToHeader: { enabled: true },
  },
  transform: { inline2note: { enabled: true, floatingButton: true, floatingButtonGap: 12 } },
  visual: {
    /*
     * Подсветка места, куда прыгнул курсор (Н5). Включена нарочно: круг живёт
     * доли секунды и виден только в браузере — набор проверок его не увидит ни
     * одним утверждением (У-98). Ветка переехала сюда с вкладки Navigation
     * 2026-09-17 его словом; адрес тут — не украшение: слой читает именно его.
     */
    jumpFlash: { enabled: true, color: "#ff0000", radius: 20, fadeMs: 400, quietMs: 0, inLine: false },
    tags: {
      /* Размер текста тегов спрашивается у страницы: гейт открывает её дважды,
         на умолчании и на мелком кегле, — иначе «пузырь стоит серединой
         строки» проверять не на чем (замечание заказчика 2026-09-16). */
      textSizePctLeft: Number(new URLSearchParams(location.search).get("size")) || 80,
      textSizePctRight: Number(new URLSearchParams(location.search).get("size")) || 80,
      bubbleWidthPct: 80,
      bubbleHeightPct: 80,
      emptyBubblePct: 50,
      cornersPct: 0,
      opacityLeft: 100,
      opacityRight: 100,
      /*
       * Обе повадки подменённой ссылки включены нарочно: выключенные они
       * проверялись бы отсутствием предмета (У-113), а включить их на странице
       * нечем — контролов тут нет. Что при `off` их не появляется, спрашивает
       * набор проверок.
       */
      linkShown: { hoverPreview: true, draggable: true },
      /*
       * Два цвета ссылки, показанной как написано (`З-37`). Оба заданы
       * нарочно и **разными** значениями: при одинаковых переворот правила
       * «цель и скобки красятся врозь» прошёл бы незамеченным (У-147). Ни
       * один не равен цвету подделки Obsidian (`#705dcf`) — иначе «наш цвет
       * выиграл» выполнялось бы совпадением.
       */
      linkAsWritten: { targetColor: "#12a4b6", bracketsColor: "#b61284" },
      /*
       * У гиперссылки своя пара — его замечание 2026-09-22 к тесту 4. Все
       * четыре значения **разные**: пара, равная паре wikilink, оставила бы
       * «управляются отдельными контролами» зелёным от совпадения (У-147).
       */
      hyperlink: { targetColor: "#0f7a2e", bracketsColor: "#c46a00", addressColor: "#4b2ec4" },
      byTagTail: null,
      byTag: {
        type: { "#todo": { fillColor: "#0008f0", textColor: "#f0eaea", visibility: "default" } },
        Category: { "#work": { fillColor: "#1106b2", textColor: "", visibility: "default" } },
        Importance: { "#/1": { fillColor: "#ff0000", textColor: "#ffffff", visibility: "empty" } },
        /* Значение-ссылка со своим текстом — его заказ 2026-09-20, пункт 14. */
        Project: { "[[shown1]]": { fillColor: "", textColor: "", visibility: "custom", customText: "\u{1F464}" } },
      },
      userTags: { "#processed": { fillColor: "#ff0000", textColor: "", visibility: "default" } },
      blockFill: { enabled: true, color: "#908e8e", opacity: 75, heightPct: 40, widthPct: 50 },
    },
  },
};

const plugin = { getConfig: () => CFG };

/*
 * Строки взяты из заметки заказчика (`test-vault/test1.md`) и покрывают ровно
 * те случаи, о которых он писал:
 *
 *   1. блок из одного пузыря;
 *   2. блок из двух пузырей — строка без ссылки, эталон высоты;
 *   3. блок с **ссылкой** на конце — та самая строка, где полоска уходила выше;
 *   4. блок из одного пустого пузыря — «полоска на empty bubble рисуется с
 *      разрывами и отличается по высоте»;
 *   5. длинная строка, у которой правый блок **переносится**.
 */
const LINES = [
  "- [ ] #todo " + SEP + " 1 " + SEP + " \u{1F4C5}2026-09-08 12:36",
  "- [ ] #todo #work " + SEP + " 4 " + SEP + " \u{1F4C5}2026-09-08 12:37",
  "- [ ] #todo #work [[test1]] " + SEP + " 12 " + SEP + " \u{1F4C5}2026-09-08 12:38",
  "- [ ] #/1 " + SEP + " 5 " + SEP + " #processed",
  "- [ ] #todo #work " + SEP + " a line long enough that its right block has to wrap onto"
    + " the next visual row of the very same document line " + SEP
    + " \u{1F4C5}2026-09-08 12:39 #processed",
  /*
   * 6. Тег со своим цветом стоит в **тексте человека**, между разделителями:
   *    «tags-text-size меняет высоту не только left и right blocks, но и тегов
   *    между сепараторами… то, что внутри сепараторов, изменяться от этой
   *    опции не должно» (замечание 2026-09-12). Без такой строки правило
   *    «размеры — про Blocks» проверялось бы отсутствием предмета (У-113).
   */
  "- [ ] #todo #plain " + SEP + " your own text #work and #bare here " + SEP + " #processed",
  /*
   * 7. Строка БЕЗ разделителей — граница, которую назвал заказчик: «обычные
   *    заметки без разделителей плагин не трогает вовсе». Без неё правило
   *    «тегу — наш пузырь» проверялось бы только с одной стороны.
   */
  "a plain note line without separators: #bare2 and #todo",
  /*
   * 8. Строка с ОДНИМ разделителем — ровно та, что он прислал скриншотом
   *    2026-09-12: `📅… #123 || 1231 #авв #new`. Разделители на этой
   *    странице одинаковы, и без такой строки правило «строка плагина»
   *    проверялось бы только на строках с двумя вхождениями — то есть
   *    подмена «нужны оба» осталась бы незамеченной (У-147).
   */
  "- [ ] #todo #single " + SEP + " 1231 #bare3",
  /*
   * 9. Строка-ЗАГОЛОВОК — его замечание 2026-09-13: «в строке хедера полоска
   *    tags-block-fill смещена наверх — выглядит отвратительно», и рядом «`##`
   *    стал пузырьком». Обе половины здесь: решётки в начале и правый Block с
   *    цветным тегом. Без такой строки правило «подложка стоит по написанному»
   *    проверялось бы только там, где ящик строки равен написанному, — то есть
   *    совпадающей стороной было бы отсутствие отступа (У-147).
   */
  "## 123 " + SEP + " #/1",
  /*
   * 10. **Длинная строка, которая переносится, и на ней плавающая кнопка.**
   *     Его замечание 2026-09-13: «если строка становится длинной, то
   *     полоска tags-block-fill начинает вести себя неадекватно… полоска в
   *     left block съезжает вниз». Предмет проверяется только здесь: у
   *     однострочной строки зрительная строка одна, и вертикаль у неё
   *     совпадает с вертикалью всей строки — то есть правило про перенос
   *     проверялось бы совпадением сторон (У-147).
   */
  "- [ ] #todo " + SEP + " a long line of the owner that wraps and leaves the button alone here ok " + SEP + " #processed #dnef",
  /*
   * 11. **Block, который сам пересекает зрительные строки.** У заказчика
   *     правый Block начинается в конце первой строки (пузырь `#/1`) и
   *     продолжается на второй. Без такой строки правило «кусок остаётся
   *     внутри ряда» проверять не на чем: у всех прежних строк каждый
   *     Block умещался в один ряд целиком (У-113).
   */
  "- [ ] #todo " + SEP + " short text here" + SEP
    + " #processed #aVeryLongTagThatCannotFitOnTheFirstRow",
  /*
   * 12. **Ссылка последним значением правого Block.** Его замечание
   *     2026-09-13: «артефакты right block в конце полоски tags-block-fill
   *     (особенно, если последнее value — wikilink)». У строки 3 ссылка
   *     стоит **внутри** левого Block, а здесь она на самом краю правого:
   *     строчный ящик у ссылки свой и выше соседнего текста.
   */
  "- [ ] \u{1F4C5}2026-09-13 23:18 #123 #work #new " + SEP + " 11 " + SEP
    + " #todo [[test1]]",
  /*
   * 13. **Его строка со скриншота `Pasted image 20260914102759.png`**, слово
   *     в слово из `test-vault/test1.md`. Здесь сошлось то, чего нет ни на
   *     одной строке выше: левый Block с **двумя** ссылками, правый Block,
   *     который переносится так, что на втором ряду остаётся одно последнее
   *     значение, и плавающая кнопка на том же ряду. Его слова 2026-09-14:
   *     «иногда полоска по прежнему рисуется до границ экрана» и «на
   *     перенесенной строке полоска не подкрашивает последнее value».
   */
  "- [ ] #/1 #work #new [[test1]] #todo [[test]] " + SEP + " 11111112 " + SEP
    + " #123 \u{1F4C5}2026-09-14 10:27 \u{1F923}PJeZs4 #aaa",
  /*
   * 14. **Ссылка, показанная своим текстом** (его заказ 2026-09-20, пункт 14).
   *     Значение `[[shown1]]` названо значением `Project`, и у него в
   *     настройках стоит `Show = custom` с эмодзи. Своя строка нужна потому,
   *     что все ссылки выше обязаны остаться ссылками Obsidian: правило
   *     «заменяем только при custom» иначе проверялось бы отсутствием
   *     предмета (У-113).
   */
  "- [ ] #todo " + SEP + " own text " + SEP + " [[shown1]]",
  /*
   * 15-16. **Гиперссылки** — его заказ `В-181`, 2026-09-22: «должны краситься
   *     гиперссылки в любой заметке… не только формата `[hyper](link)`, но и
   *     просто ссылки». Две строки, потому что два предмета: разметка внутри
   *     строки плагина и голый адрес в строке, которой плагин не
   *     распоряжается вовсе — «в любой заметке» это про неё.
   */
  "- [ ] #todo " + SEP + " see [hyper](https://example.com/a) here " + SEP + " #processed",
  "a plain line of yours with www.example.com in it",
  /*
   * 17. **Контроль к ним же.** Вставка картинки ссылкой не считается: читать в
   *     ней нечего, и наш цвет туда не идёт. Строка нужна затем, чтобы на
   *     странице остался узел ссылки, которого мы **не** трогаем, — иначе
   *     «красим ссылки» выполнялось бы и правилом «красим всё подряд» (У-113).
   */
  "an image ![pic](https://img.example/a.png) stays the platform's",
  /*
   * 18. **Тег, которого Obsidian не видит** — его слово 2026-09-24: «все теги …
   *     управлялись контролами tag view». Пузырь в чужой строке ставится там,
   *     где тег видит платформа, а в обратных кавычках его нет. Без этой
   *     строки правило «спрашивать платформу» проверялось бы только там, где
   *     сканер и платформа согласны (У-147).
   */
  "a plain line with code `see #code1`, a number #789 and a tag #bare5",
  /*
   * 19. **Число — не тег для Obsidian, а в строке плагина всё равно наше.**
   *     Строка с одним разделителем, и в ней `#456`: пузырь ей рисует правило
   *     «строки плагина», а не платформа. Без неё подмена «строке нужны оба
   *     разделителя» пряталась бы за дорогой платформы (У-147).
   */
  "- [ ] #todo " + SEP + " 1231 #456",
];

/*
 * ПОДДЕЛКА OBSIDIAN, И ОНА НАЗВАНА (У-1). Ссылку `[[…]]` в Live Preview
 * рисует Obsidian, а его тут нет. Пометка ставится на тот же отрезок, что
 * заняла бы ссылка, и несёт класс, у которого в стилях страницы задан
 * **более высокий строчный ящик**, — единственное свойство ссылки, которое
 * обмерено по 18.png и которое решает вертикаль подложки.
 */
const linkStandIn = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildLinkMarks(view); }
  update(u) { this.decorations = buildLinkMarks(u.view); }
}, { decorations: (v) => v.decorations });

/*
 * ПОДДЕЛКА OBSIDIAN, И ОНА НАЗВАНА (У-1). Строку, начинающуюся со знака
 * заголовка, Obsidian рисует крупнее и с отступом сверху; markdown-разбора на
 * этой странице нет. Пометка ставится на строку целиком и несёт класс, у
 * которого в стилях страницы задано ровно то, что решает вертикаль подложки:
 * кегль и верхний отступ.
 */
const headingStandIn = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildHeadingLines(view); }
  update(u) { this.decorations = buildHeadingLines(u.view); }
}, { decorations: (v) => v.decorations });

/*
 * ПОДДЕЛКА OBSIDIAN, И ОНА НАЗВАНА (У-1). Гиперссылку в Live Preview рисует
 * Obsidian, а его тут нет. **Форма списана у оригинала** (У-170): в `app.css`
 * 1.13.7 подпись разметки несёт `span.cm-link`, адрес — `span.cm-url`, внутри
 * подписи стоит `.cm-underline`, и метки разметки платформа прячет, пока
 * выделение не перекрывает узел (У-256) — тем же правилом, что у wikilink.
 *
 * Без этой подделки «наш цвет доехал» проверялось бы отсутствием предмета:
 * выигрывать было бы не у кого (У-88).
 */
const extLinkStandIn = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildExtLinkMarks(view); }
  update(u) { this.decorations = buildExtLinkMarks(u.view); }
}, { decorations: (v) => v.decorations });

function buildExtLinkMarks(view) {
  const out = [];
  const touched = (from, to) => view.state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const line = view.state.doc.line(n);
    const md = /\[([^\][\n]*)\]\(([^()\s]*)\)/g;
    let m;
    while ((m = md.exec(line.text)) !== null) {
      const start = line.from + m.index;
      const end = start + m[0].length;
      const labelFrom = start + 1;
      const labelTo = labelFrom + m[1].length;
      if (labelTo <= labelFrom) continue;
      const hide = !touched(start, end);
      if (hide) out.push(Decoration.replace({}).range(start, labelFrom));
      out.push(Decoration.mark({ class: "cm-link" }).range(labelFrom, labelTo));
      out.push(Decoration.mark({ class: "cm-underline" }).range(labelFrom, labelTo));
      if (hide) out.push(Decoration.replace({}).range(labelTo, end));
      else out.push(Decoration.mark({ class: "cm-url" }).range(labelTo, end));
    }
    const bare = /(?:https?:\/\/|www\.)[^\s]+/g;
    while ((m = bare.exec(line.text)) !== null) {
      const from = line.from + m.index;
      const to = from + m[0].length;
      out.push(Decoration.mark({ class: "cm-url" }).range(from, to));
      out.push(Decoration.mark({ class: "cm-underline" }).range(from, to));
    }
  }
  out.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(out, true);
}

function buildHeadingLines(view) {
  const out = [];
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const line = view.state.doc.line(n);
    if (!/^#{1,6}(?:\s|$)/.test(line.text)) continue;
    out.push(Decoration.line({ attributes: { class: "io-probe-heading" } }).range(line.from));
  }
  return Decoration.set(out, true);
}

/*
 * **Форма подделки списана у оригинала, а не выведена из слова «ссылка»**
 * (У-170). В `app.js` Obsidian 1.13.7 обе пары скобок сняты со строки
 * `Decoration.replace({})` без виджета (`c3`, `u3`, `h3` рядом с
 * `p3=mark({class:"cm-underline"})`), а видимый текст ссылки несёт пометку
 * `cm-underline`. То есть на строке стоят **три** объявления, а не одно:
 * спрятанные скобки и пометка между ними. Разница не украшение — спрятанный
 * отрезок платформа считает атомарным, и именно на нём `moveToLineBoundary`
 * у заказчика возвращало положение, с которого само же не сдвигалось.
 */
function buildLinkMarks(view) {
  const out = [];
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const line = view.state.doc.line(n);
    let at = 0;
    for (let guard = 0; guard < 8; guard += 1) {
      const i = line.text.indexOf("[[", at);
      if (i < 0) break;
      const j = line.text.indexOf("]]", i);
      if (j < 0) break;
      /*
       * **Скобки прячутся не всегда** — правило платформы, и оно про место
       * каретки (У-256): метки разметки Obsidian снимает декорацией, пока
       * выделение не перекрывает узел. В `app.js` 1.13.7 это
       * `IL(range, from, to)` = `range.from <= to && range.to >= from`, и
       * край считается перекрытием.
       *
       * Без этой половины подделка была бы добрее оригинала ровно наоборот
       * (У-45): она прятала бы скобки всегда, и цвет скобок проверялся бы
       * отсутствием предмета.
       */
      const from = line.from + i;
      const to = line.from + j + 2;
      const touched = view.state.selection.ranges.some((r) => r.from <= to && r.to >= from);
      if (!touched) out.push(Decoration.replace({}).range(from, from + 2));
      out.push(Decoration.mark({ class: "io-probe-link cm-underline" })
        .range(from + 2, line.from + j));
      if (!touched) out.push(Decoration.replace({}).range(line.from + j, to));
      at = j + 2;
    }
  }
  return Decoration.set(out, true);
}

/*
 * **Дерево разбора — заменитель HyperMD Obsidian по тегам, и только по ним.**
 * Имена токенов списаны с `app.js` 1.13.7 (`hmdHashtag`): начало тега —
 * `formatting formatting-hashtag hashtag-begin hashtag meta`, тело —
 * `hashtag meta hashtag-end`; вставка в обратных кавычках тегов не несёт.
 * Знаки тела и условие «не одни цифры» — её же образец `aU` и проверка
 * `/[^0-9]/` рядом с ним.
 * Слой спрашивает у дерева, тег ли это (`obsidianTagStarts`), и без
 * заменителя на странице дерево пустое — правило проверялось бы молчанием.
 */
const TAG_BODY = /^(?:[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s])+/;
const hashtagStandIn = new LanguageSupport(StreamLanguage.define({
  startState: () => ({ inTag: false }),
  token(stream, st) {
    if (st.inTag) {
      stream.match(TAG_BODY);
      st.inTag = false;
      return "hashtag meta hashtag-end";
    }
    if (stream.match(/^`[^`]*`/)) return null;
    const prev = stream.pos === 0 ? " " : stream.string.charAt(stream.pos - 1);
    const body = TAG_BODY.exec(stream.string.slice(stream.pos + 1));
    if (/\s/.test(prev) && stream.peek() === "#" && body && /[^0-9]/.test(body[0])) {
      stream.next();
      st.inTag = true;
      return "formatting formatting-hashtag hashtag-begin hashtag meta";
    }
    stream.next();
    return null;
  },
}));

const view = new EditorView({
  state: EditorState.create({
    doc: LINES.join("\n"),
    extensions: [
      EditorView.lineWrapping,
      hashtagStandIn,
      decorations.createTagVisualDecorationExtension(plugin),
      linkStandIn,
      extLinkStandIn,
      headingStandIn,
      /* Кнопка `→` — наш же виджет, и здесь он настоящий. */
      decorations.createSourceMarkDecorationExtension(plugin),
      decorations.createBlockFillLayerExtension(plugin),
      decorations.createJumpFlashExtension(plugin),
    ],
  }),
  parent: document.getElementById("host"),
});

/* Правила подложки ставит плагин; здесь их ставит то же место, что в нём. */
const bandStyle = document.createElement("style");
bandStyle.textContent = visuals.buildBlockFillStyleCss(visuals.blockFillLookFromConfig(CFG));
document.head.appendChild(bandStyle);

/**
 * Поставить настройки подложки и дать слою перерисоваться.
 *
 * Пустая правка выделения — тот же случай, что в заметке: пересборка настроек
 * присылает её же, и решает подпись слоя (`blockFillLayerNeedsRedraw`). То
 * есть проверка ходит тем самым путём, каким до слоя доезжает ползунок.
 */
/**
 * Слой перерисовывается **не сразу**, и это не мелочь.
 *
 * `layer` ставит свои прямоугольники в фазе измерения CodeMirror, а её
 * платформа откладывает до кадра отрисовки. Проба, снятая сразу за
 * `dispatch`, читает **прежнее** состояние слоя: 2026-09-09 из-за этого гейт
 * мерил вчерашнюю высоту подложки и был зелёный при шкале, которая ничего не
 * делала. Поэтому обе рисовалки возвращают обещание и ждут двух кадров: в
 * первом платформа мерит, во втором ставит.
 */
function settled() {
  return new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => done(true)));
  });
}

window.__ioSetBand = function (patch) {
  Object.assign(CFG.visual.tags.blockFill, patch || {});
  bandStyle.textContent = visuals.buildBlockFillStyleCss(visuals.blockFillLookFromConfig(CFG));
  view.dispatch({ selection: view.state.selection });
  return settled();
};

/**
 * Междустрочие страницы — **только ради одного состояния**: того, в котором
 * прижим подложки к зрительной строке и правда решает.
 *
 * До 2026-09-21 такое состояние получалось само: пузырь на верху обеих своих
 * шкал был выше ряда (35,3 при 32). С тех пор кегль тега берётся у платформы
 * (`--tag-size`, У-260), пузырь стал ниже, и на верху шкал он в ряд помещается
 * — то есть подмена «снять прижим» перестала что-либо менять, и проверка
 * оказалась бы зелёной у дефекта (У-127: контроль умирает вместе с предметом).
 *
 * Ряд ужимается только на время этого измерения и возвращается сразу после.
 */
const rowStyle = document.head.appendChild(document.createElement("style"));
window.__ioSetRowHeight = function (value) {
  rowStyle.textContent = value
    ? ".cm-content, .cm-line { line-height: " + Number(value) + " !important; }"
    : "";
  /*
   * **Измерение просится прямо.** Высоту ряда CodeMirror держит посчитанной
   * (`defaultLineHeight`) и сама её не пересчитывает от чужой правки стилей:
   * первая версия этого шва поменяла лист, и ряд остался прежним — то есть
   * состояние, ради которого шов заведён, не наступало вовсе (У-130: мера,
   * снятая сразу за правкой, описывает прежний экран).
   */
  view.requestMeasure();
  view.dispatch({ selection: view.state.selection });
  return settled();
};

/**
 * Поставить курсор на строку: плавающая кнопка `→` рисуется **на активной
 * строке**, и без этого её на нужной строке нет вовсе — то есть правило про
 * неё проверялось бы отсутствием предмета (У-113).
 */
window.__ioSetCursor = function (lineNumber) {
  const line = view.state.doc.line(Number(lineNumber) || 1);
  view.dispatch({ selection: { anchor: line.to, head: line.to } });
  return settled();
};

/**
 * Два цвета ссылки, показанной как написано (`З-37`) — вычисленными
 * величинами, а не объявлениями.
 *
 * Спрашивается **кто выиграл** цвет у одного и того же отрезка: текст ссылки
 * рисует Obsidian со своим `color`, наш слой ставит поверх свою пометку, и
 * решает это каскад, а не рассуждение (У-67). Скобки отдельной строкой:
 * платформа снимает их с экрана, пока каретка не на узле, и `null` здесь —
 * ответ, а не отказ.
 *
 * `at` ставит каретку внутрь ссылки: без этого скобок на странице нет вовсе,
 * и второй цвет проверялся бы отсутствием предмета (У-113).
 */
window.__ioLinkColors = async function (needle, caretInside) {
  let lineNo = 0;
  for (let n = 1; n <= view.state.doc.lines; n++) {
    if (view.state.doc.line(n).text.includes(needle)) { lineNo = n; break; }
  }
  if (!lineNo) return { found: false };
  const line = view.state.doc.line(lineNo);
  const at = line.from + line.text.indexOf(needle);
  const head = caretInside ? at + 3 : line.from;
  view.dispatch({ selection: { anchor: head, head } });
  await settled();
  /*
   * **Спрашивается одна строка, а не вся страница.** Первая попытка брала
   * первый узел каждого вида по всему документу — и сравнивала цвет нашей
   * пометки на одной строке с цветом узла платформы на другой. Проба врала
   * правдоподобно (У-173): числа были настоящие, вопрос чужой.
   */
  const host = Array.from(document.querySelectorAll(".cm-line"))
    .find((n) => (n.textContent || "").includes(needle.slice(2, -2)));
  if (!host) return { found: false };
  const pick = (sel) => {
    const nodes = Array.from(host.querySelectorAll(sel));
    const hit = nodes.find((n) => (n.textContent || "").length > 0);
    return hit ? getComputedStyle(hit).color : null;
  };
  /*
   * Что человек видит **на самих буквах**: у нашей пометки и у узла платформы
   * один текст, и решает тот из них, что лежит внутри. Спрашивается поэтому
   * самый глубокий узел с этими буквами, а не тот, чей класс удобнее.
   */
  const deepest = () => {
    let node = Array.from(host.querySelectorAll(".io-linkwritten__target"))
      .find((n) => (n.textContent || "").length > 0);
    if (!node) return null;
    for (;;) {
      const inner = Array.from(node.children)
        .find((c) => (c.textContent || "") === (node.textContent || ""));
      if (!inner) break;
      node = inner;
    }
    return getComputedStyle(node).color;
  };
  return {
    found: true,
    target: pick(".io-linkwritten__target"),
    brackets: pick(".io-linkwritten__mark"),
    shown: deepest(),
  };
};

/**
 * Цвет гиперссылки на экране — его заказ `В-181`.
 *
 * Спрашивается **самый глубокий узел с теми же буквами**, а не тот, чей класс
 * удобнее: у подписи ссылки узлов трое — наш, `cm-link` и `cm-underline`
 * внутри него, — и решает тот, что лежит внутри (У-67, У-173). Второе число —
 * цвет узла платформы на той же строке **вне** нашей пометки: без него
 * «наш цвет виден» выполнялось бы и правилом, которое красит всё подряд.
 */
window.__ioExtLinkColors = async function (needle, caretInside) {
  let lineNo = 0;
  for (let n = 1; n <= view.state.doc.lines; n++) {
    if (view.state.doc.line(n).text.includes(needle)) { lineNo = n; break; }
  }
  if (!lineNo) return { found: false };
  const line = view.state.doc.line(lineNo);
  const at = line.from + line.text.indexOf(needle);
  const head = caretInside ? at + 1 : line.from;
  view.dispatch({ selection: { anchor: head, head } });
  await settled();
  /*
   * Строка берётся по номеру, а не по тексту: у разметки ссылки платформа
   * прячет и скобку, и адрес, пока каретка не на ней, — искать по написанному
   * значило бы не найти ровно то состояние, ради которого проверка заведена.
   */
  const host = document.querySelectorAll(".cm-line")[lineNo - 1];
  if (!host) return { found: false };
  const deepestIn = (sel) => {
    let node = Array.from(host.querySelectorAll(sel))
      .find((n) => (n.textContent || "").length > 0);
    if (!node) return null;
    for (;;) {
      const inner = Array.from(node.children)
        .find((c) => (c.textContent || "") === (node.textContent || ""));
      if (!inner) break;
      node = inner;
    }
    return { color: getComputedStyle(node).color, text: node.textContent, tag: node.className };
  };
  const ours = deepestIn(".io-linkwritten__target");
  const marks = deepestIn(".io-linkwritten__mark");
  /*
   * Контроль — узел платформы, **которого наша пометка не касается вовсе**:
   * ни внутри неё, ни снаружи вокруг неё. Первая версия брала предка нашей
   * пометки и отвечала цветом платформы на том же отрезке — то есть числом,
   * к вопросу отношения не имеющим (У-173).
   */
  const platform = Array.from(document.querySelectorAll(".cm-link, .cm-url"))
    .filter((n) => !n.querySelector(".io-linkwritten__target, .io-linkwritten__mark"))
    .filter((n) => !n.closest(".io-linkwritten__target") && !n.closest(".io-linkwritten__mark"))
    .map((n) => getComputedStyle(n).color);
  return {
    found: true,
    text: host.textContent,
    target: ours ? ours.color : null,
    targetText: ours ? ours.text : null,
    marks: marks ? marks.color : null,
    marksText: marks ? marks.text : null,
    outside: platform,
    html: host.innerHTML.slice(0, 600),
  };
};

/**
 * Каким цветом нарисован **адрес** разметки ссылки.
 *
 * Отдельная проба, а не поле соседней: у `__ioExtLinkColors` предмет — первый
 * непустой кусок разметки, то есть `[`, и спрашивать у неё про адрес значило
 * бы сменить её предмет.
 *
 * **Какой кусок адрес, говорит зовущий**, а не признак внутри пробы. Первая
 * версия узнавала адрес по `://` — написанному в той единственной ссылке, на
 * которой её писали, — и на `www.example.com` ослепла молча (У-201). Теперь
 * текст адреса приходит доводом, и не найденный кусок — громкий отказ, а не
 * ноль.
 */
window.__ioExtLinkAddressColor = async function (needle, caretInside, addressText) {
  let lineNo = 0;
  for (let n = 1; n <= view.state.doc.lines; n++) {
    if (view.state.doc.line(n).text.includes(needle)) { lineNo = n; break; }
  }
  if (!lineNo) return { found: false };
  const line = view.state.doc.line(lineNo);
  const at = line.from + line.text.indexOf(needle);
  const head = caretInside ? at + 1 : line.from;
  view.dispatch({ selection: { anchor: head, head } });
  await settled();
  const host = document.querySelectorAll(".cm-line")[lineNo - 1];
  if (!host) return { found: false };
  const wanted = String(addressText || "");
  let node = wanted
    ? Array.from(host.querySelectorAll(".io-linkwritten__mark"))
      .find((n) => (n.textContent || "").includes(wanted))
    : null;
  if (!node) return { found: false };
  for (;;) {
    const inner = Array.from(node.children)
      .find((c) => (c.textContent || "") === (node.textContent || ""));
    if (!inner) break;
    node = inner;
  }
  return {
    found: true,
    address: getComputedStyle(node).color,
    addressText: node.textContent,
  };
};

/**
 * Отнять у платформы ответ «где кончается зрительная строка».
 *
 * Не украшение стенда, а единственный способ прогнать **запасной путь**: у
 * заказчика `moveToLineBoundary` отвечал концом строки документа, и подложка
 * от этого опускалась на половину лишней высоты (10.13.102), а нарисованная
 * прямоугольниками платформы — растягивалась во всю ширину окна (10.13.103).
 * В браузере этот отказ сам не случается ни разу; значит его надо устроить.
 *
 * Возврат обязателен: на сломанной границе идут все следующие измерения, и
 * молча оставить её значило бы проверять другой редактор.
 */
const realMoveToLineBoundary = view.moveToLineBoundary.bind(view);
window.__ioBreakRowBoundary = async function (on) {
  view.moveToLineBoundary = on
    ? (range) => ({ head: view.state.doc.lineAt(Number(range && range.head) || 0).to })
    : realMoveToLineBoundary;
  /*
   * Слой перерисовывается **по подписи**, а не по каждой правке: пустая правка
   * выделения его не будит, и первая версия этого выключателя честно ломала
   * границу, а на экране оставались прежние прямоугольники — то есть сверка
   * сравнивала бы состояние само с собой (У-92). Поэтому подпись двигается
   * туда и обратно: ширина на деление в сторону и назад.
   */
  const was = Number(CFG.visual.tags.blockFill.widthPct);
  await window.__ioSetBand({ widthPct: was >= 100 ? was - 1 : was + 1 });
  return window.__ioSetBand({ widthPct: was });
};

/**
 * Второй отказ платформы: граница ряда названа **раньше** конца ряда.
 *
 * Первый (`__ioBreakRowBoundary`) — «граница = конец строки документа»; он у
 * заказчика был, и его разбор в 10.13.102. Этот — зеркальный: обход рядов
 * останавливается на середине строки и до её конца не доходит. В браузере сам
 * он не случается, а у заказчика случился: у ссылки `[[…]]` в Live Preview
 * свой узел, и на нём `moveToLineBoundary` вернуло положение, с которого само
 * же и не сдвинулось.

 * Подделка называет ровно это и ничего больше: граница обрезается семью
 * десятыми строки. Возврат обязателен — на сломанной границе идут все
 * следующие измерения.
 */
window.__ioShortRowBoundary = async function (on) {
  view.moveToLineBoundary = on
    ? (range, forward, includeWrap) => {
      const head = Number(range && range.head) || 0;
      const line = view.state.doc.lineAt(head);
      const stop = line.from + Math.floor(line.length * 0.7);
      const real = realMoveToLineBoundary(range, forward, includeWrap);
      const realHead = real && Number.isFinite(Number(real.head)) ? Number(real.head) : line.to;
      return { head: Math.min(realHead, Math.max(stop, line.from)) };
    }
    : realMoveToLineBoundary;
  const was = Number(CFG.visual.tags.blockFill.widthPct);
  await window.__ioSetBand({ widthPct: was >= 100 ? was - 1 : was + 1 });
  return window.__ioSetBand({ widthPct: was });
};

/**
 * Третий отказ платформы: граница ряда названа **на знак мимо**.
 *
 * Первые два крупные — «граница = конец строки документа» и «граница раньше
 * конца ряда». Этот мельче на порядок, и ровно поэтому он и жил: сдвига на
 * один знак хватает, чтобы `rectanglesForRange` увидела кусок пересекающим
 * ряды и нарисовала его **выделением** — прямоугольник до правого края
 * содержимого и второй от левого. Ровно это заказчик и прислал 2026-09-14:
 * «иногда полоска по прежнему рисуется до границ экрана» и «на перенесённой
 * строке полоска не подкрашивает последнее value».
 *
 * **У подделки свой контроль** (У-110): она считает, сколько раз её ответ и
 * правда разошёлся с платформенным. Ноль означает, что подделка ничего не
 * подделала, и «подложки не сдвинулись» выполнялось бы её отсутствием.
 */
let wrongRowBoundaryHits = 0;
window.__ioWrongRowBoundary = async function (on, shift) {
  const by = Number.isFinite(Number(shift)) ? Number(shift) : 1;
  wrongRowBoundaryHits = 0;
  view.moveToLineBoundary = on
    ? (range, forward, includeWrap) => {
      const real = realMoveToLineBoundary(range, forward, includeWrap);
      const realHead = real && Number.isFinite(Number(real.head)) ? Number(real.head) : null;
      if (realHead === null) return real;
      const line = view.state.doc.lineAt(realHead);
      const moved = Math.max(line.from, Math.min(line.to, realHead + by));
      if (moved !== realHead) wrongRowBoundaryHits += 1;
      return { head: moved };
    }
    : realMoveToLineBoundary;
  const was = Number(CFG.visual.tags.blockFill.widthPct);
  await window.__ioSetBand({ widthPct: was >= 100 ? was - 1 : was + 1 });
  return window.__ioSetBand({ widthPct: was });
};

window.__ioWrongRowBoundaryHits = function () { return wrongRowBoundaryHits; };

window.__ioSetTags = function (patch) {
  Object.assign(CFG.visual.tags, patch || {});
  view.dispatch({ selection: view.state.selection });
  return settled();
};

/**
 * Пузыри тегов по зонам: что браузер насчитал каждому.
 *
 * Зона у каждого спрашивается **у того же объявления, каким её считает
 * продукт** (`resolveTagVisualZone`), а не выводится из вида строки: своя
 * копия правила разошлась бы с ним молча (У-32).
 */
window.__ioBubblesByZone = function () {
  const out = [];
  const doc = view.state.doc;
  for (const el of document.querySelectorAll("[data-io-tag-token]")) {
    const token = el.getAttribute("data-io-tag-token");
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    /*
     * Место узла берётся **у редактора** (`posAtDOM`), а не поиском токена по
     * тексту: `#work` стоит на странице в четырёх строках, и поиск по первому
     * вхождению приписал бы всем пузырям одну зону — то есть проверка мерила
     * бы не то, что нарисовано (У-134).
     */
    const pos = view.posAtDOM(el);
    const line = doc.lineAt(pos);
    const zone = visuals.resolveTagVisualZone(line.text, pos - line.from, SEP, SEP);
    out.push({
      token,
      zone,
      cls: String(el.className || ""),
      fontSize: cs.getPropertyValue("font-size"),
      /*
       * **Чем рисует тег сама платформа на этой строке.** Спрашивается у
       * браузера пробой, а не пересчётом от кегля строки: своя копия правила
       * `--tag-size` разошлась бы с продуктом молча (У-4). Узел живёт один
       * вопрос и снимается тем же тактом.
       */
      themeTagPx: (() => {
        const host = el.closest(".cm-line");
        if (!host) return "";
        const probe = document.createElement("span");
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.fontSize = "var(--tag-size)";
        host.appendChild(probe);
        const px = getComputedStyle(probe).getPropertyValue("font-size");
        probe.remove();
        return px;
      })(),
      /* Подъём пузыря: на сотне он ноль — тег стоит базовой линией, как его
         рисует и сама Obsidian (`vertical-align: baseline`). */
      verticalAlign: cs.getPropertyValue("vertical-align"),
      padTop: cs.getPropertyValue("padding-top"),
      padLeft: cs.getPropertyValue("padding-left"),
      background: cs.getPropertyValue("background-color"),
      cursor: cs.getPropertyValue("cursor"),
      height: round(r.height),
      width: round(r.width),
      /*
       * **Текст той же строки, измеренный как текст** — его требование
       * 2026-09-19: «при 100 текст в left/right block должен быть таким же как
       * в text block (находиться на том же уровне)».
       *
       * Мерится не ящик строки (он с междустрочием темы и втрое выше глифов), а
       * сам текстовый узел — `Range` вокруг него отдаёт ящик написанного.
       * Наши узлы из подсчёта исключены: сравнивать надо с тем, что рисует
       * редактор, а не с собой (У-147).
       */
      lineText: (() => {
        const host = el.closest(".cm-line");
        if (!host) return null;
        /* `NodeFilter.SHOW_TEXT` — это 4; литерал здесь потому, что имя
           объявлено браузером, а линтер этого файла его не знает. */
        const walker = document.createTreeWalker(host, 4, null);
        let best = null;
        let node = walker.nextNode();
        while (node) {
          const parent = node.parentElement;
          const ours = parent && parent.closest("[data-io-tag-token]");
          const text = String(node.nodeValue || "").trim();
          /*
           * **Эмодзи из сравнения исключён.** Его глиф выше буквенного, и ящик
           * выделения у такой строки выше — то есть её середина уезжает вниз
           * сама, без всякого нашего оформления. На такой стороне мера
           * показывала бы промах в точку там, где вид верен (У-147). Предмет
           * сравнения — буквы и цифры, как в его примере `1231`.
           */
          const plain = /^[ -~]+$/.test(text);
          if (!ours && plain && text.length && (!best || text.length > best.text.length)) {
            best = { node, text };
          }
          node = walker.nextNode();
        }
        if (!best) return null;
        const range = document.createRange();
        range.selectNodeContents(best.node);
        /*
         * **Ряд у обоих обязан быть один, и берётся он по частям.**
         * `getBoundingClientRect` у текста, который сам перенёсся, отдаёт
         * объединение рядов — то есть ящик, пересекающийся с чем угодно и с
         * серединой посередине пустоты (У-173). Поэтому спрашиваются
         * `getClientRects` и выбирается та часть, что стоит на ряду пузыря.
         */
        const rows = Array.from(range.getClientRects());
        const mine = r.top + r.height / 2;
        const box = rows.find((x) => x.height > 0 && x.top <= mine && x.bottom >= mine)
          || rows.find((x) => x.height > 0)
          || range.getBoundingClientRect();
        const sameRow = box.top <= mine && box.bottom >= mine;
        const parentStyle = getComputedStyle(best.node.parentElement || host);
        return {
          text: best.text,
          sameRow,
          fontSize: parentStyle.getPropertyValue("font-size"),
          mid: round(box.top + box.height / 2),
          height: round(box.height),
        };
      })(),
      /*
       * **Середина написанного в пузыре, а не его ящика.** Ящик пузыря
       * симметричен вокруг своей строки, а `Range` отдаёт ящик выделения —
       * он считается от метрик шрифта и вокруг базовой линии несимметричен.
       * Сравнивать надо один род ящика с тем же родом, иначе мера даёт
       * систематическую единицу на ровном месте (У-173).
       */
      mid: (() => {
        const walker = document.createTreeWalker(el, 4, null);
        const node = walker.nextNode();
        if (!node) return round(r.top + r.height / 2);
        const range = document.createRange();
        range.selectNodeContents(node);
        const rows = Array.from(range.getClientRects()).filter((x) => x.height > 0);
        const box = rows[0] || range.getBoundingClientRect();
        return round(box.top + box.height / 2);
      })(),
    });
  }
  return out;
};

/**
 * Шаг каретки вправо по строке, как его делает сама платформа.
 *
 * Нужен одному вопросу — его замечанию 2026-09-20: «если выделять клавиатурой
 * wikilink, приходится нажать столько раз, сколько знаков в реальном значении,
 * хотя на экране один знак». Ответ на него знает только CodeMirror: отрезок,
 * отданный в `EditorView.atomicRanges`, курсор проходит целиком. Здесь
 * ставится каретка перед значением и делается один шаг **тем же** вызовом,
 * которым его делает клавиша, — `moveByChar` через команду платформы.
 */
window.__ioStepRight = function (lineNumber, at) {
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Number(lineNumber) || 1)));
  const from = line.from + Math.max(0, Number(at) || 0);
  view.dispatch({ selection: { anchor: from } });
  const range = view.moveByChar(view.state.selection.main, true);
  return { from: from - line.from, to: range.head - line.from, lineText: line.text };
};

/** Каретка на строке: от неё зависит, где стоит кнопка `→`. */
window.__ioPutCaret = function (lineNumber) {
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Number(lineNumber) || 1)));
  view.dispatch({ selection: { anchor: line.to } });
  return settled();
};

/**
 * Прыжок курсора и круг, который он рисует (Н5).
 *
 * Круг живёт доли секунды и уменьшается анимацией — набор проверок этого не
 * увидит ни одним утверждением (У-98), а браузер видит. Ставится курсор,
 * зовётся тот самый шов, каким его зовёт обёртка команд, и отдаётся то, что
 * получилось: сколько кругов на странице, где они и какого размера.
 *
 * Здесь не подделано ничего: `fireJumpFlash` и слой — настоящие, координаты
 * даёт браузер.
 */
window.__ioJumpFlash = async function (lineNumber, kind) {
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Number(lineNumber) || 1)));
  view.dispatch({ selection: { anchor: line.to } });
  await settled();
  view.focus();
  const answer = decorations.fireJumpFlash(plugin, String(kind || "jump"));
  await settled();
  const caret = view.coordsAtPos(view.state.selection.main.head);
  const nodes = Array.from(document.querySelectorAll("." + visuals.JUMP_FLASH_MARKER_CLASS));
  return {
    answer: answer === true,
    count: nodes.length,
    layers: document.querySelectorAll("." + visuals.JUMP_FLASH_LAYER_CLASS).length,
    caret: caret ? { left: round(caret.left), top: round(caret.top), bottom: round(caret.bottom) } : null,
    circles: nodes.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom),
        /*
         * Размер спрашивается у **вёрстки**, а не у прямоугольника на экране:
         * круг уже уменьшается анимацией, и `getBoundingClientRect` отдаёт то,
         * сколько его осталось на этом кадре. Число вышло бы разным от прогона
         * к прогону — мера, зависящая от машины, а не от продукта (У-176).
         */
        width: round(el.offsetWidth), height: round(el.offsetHeight),
        radius: cs.borderRadius,
        durationMs: Math.round(parseFloat(cs.animationDuration || "0") * 1000),
        opacity: round(Number(cs.opacity)),
        color: cs.backgroundColor,
      };
    }),
  };
};

/** Сколько кругов на странице прямо сейчас: ответ «ноль» — тоже ответ. */
window.__ioJumpFlashCount = function () {
  return document.querySelectorAll("." + visuals.JUMP_FLASH_MARKER_CLASS).length;
};

/**
 * Два прыжка подряд — **в одном ходу**, без единого кадра между ними.
 *
 * Его ответ В-136: прежний круг гасить. Проверять это двумя отдельными
 * заходами в страницу нельзя: между ними проходит столько времени, что первый
 * круг успевает погаснуть сам, и утверждение «кругов один» выполняется не
 * правилом, а ожиданием — подмена «прежний не гасится» на нём зелёная (У-142:
 * контроль ставится на тот шаг, о котором утверждение).
 */
window.__ioJumpFlashTwice = async function () {
  const first = view.state.doc.line(3);
  view.dispatch({ selection: { anchor: first.to } });
  await settled();
  view.focus();
  decorations.fireJumpFlash(plugin, "jump");
  const afterFirst = document.querySelectorAll("." + visuals.JUMP_FLASH_MARKER_CLASS).length;
  const second = view.state.doc.line(5);
  view.dispatch({ selection: { anchor: second.to } });
  decorations.fireJumpFlash(plugin, "jump");
  const afterSecond = document.querySelectorAll("." + visuals.JUMP_FLASH_MARKER_CLASS).length;
  return { afterFirst: afterFirst, afterSecond: afterSecond };
};

function round(n) { return Math.round(Number(n) * 100) / 100; }

/** Прямоугольники подложки, как их видит браузер. */
function bands() {
  return Array.from(document.querySelectorAll("." + visuals.BLOCK_FILL_MARKER_CLASS))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
    })
    .sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

/**
 * Измерения, о которых спрашивает проверка.
 *
 * Каждое — вопрос к браузеру, а не к нашему коду: положение прямоугольника,
 * положение первого написанного знака блока, правый край знака начала строки.
 */
window.__ioGeomProbe = function (lineNumber) {
  const line = view.state.doc.line(Number(lineNumber));
  const block = view.lineBlockAt(line.from);
  const at = view.domAtPos(line.from);
  const node = at && at.node ? (at.node.nodeType === 1 ? at.node : at.node.parentElement) : null;
  const el = node && node.closest ? node.closest(".cm-line") : null;
  const box = el ? el.getBoundingClientRect() : null;
  return {
    text: line.text,
    blockTop: block.top, blockHeight: block.height,
    defaultLineHeight: view.defaultLineHeight,
    documentTop: view.documentTop,
    boxTop: box ? box.top : null, boxHeight: box ? box.height : null,
    textHeight: view.viewState && view.viewState.heightOracle
      ? view.viewState.heightOracle.textHeight : null,
  };
};

/**
 * Как стоит написанное в Block относительно полосы `tags-block-fill`.
 *
 * **Мера названа его словами** (замечание `G4`, 2026-09-16): «сверху и снизу
 * от values в технических блоках должно оставаться одинаковое расстояние до
 * границ полоски tags-block-fill». Прежняя мера сверяла пузырь с **написанным
 * в строке**, и она отвечает на другой вопрос: написанное меняется от любой
 * правки вида, и середина уезжает вместе с ним.
 *
 * Рода два, и оба — наши узлы, а не догадка по виду: пузырь (`io-tagbubble`) и
 * значение, которому пузырь не рисуется (`io-blockvalue` — ссылка и
 * эмодзи-элемент).
 */
window.__ioBlockValueAlign = function () {
  const round = (n) => Math.round(Number(n) * 100) / 100;
  const bandRects = Array.from(document.querySelectorAll("." + visuals.BLOCK_FILL_MARKER_CLASS))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  const nodes = []
    .concat(Array.from(document.querySelectorAll("." + visuals.TAG_BUBBLE_CLASS))
      .map((el) => ({ kind: "пузырь", el })))
    .concat(Array.from(document.querySelectorAll("." + visuals.BLOCK_VALUE_CLASS))
      .map((el) => ({ kind: "значение", el })));
  const out = [];
  for (let bandIndex = 0; bandIndex < bandRects.length; bandIndex++) {
    const band = bandRects[bandIndex];
    for (const node of nodes) {
      const r = node.el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      /* Кусок берётся тот, что лежит внутри полосы по горизонтали: полоса
         накрывает ровно свою зону, и всё, что торчит за её края, — из другой
         зоны или из другого зрительного ряда. */
      if (!(r.left >= band.left - 1 && r.right <= band.right + 1)) continue;
      if (!(Math.min(band.bottom, r.bottom) - Math.max(band.top, r.top) > 1)) continue;
      out.push({
        band: bandIndex,
        kind: node.kind,
        text: String(node.el.textContent || "").trim().slice(0, 24),
        over: round(r.top - band.top),
        under: round(band.bottom - r.bottom),
        shift: round((r.top + r.bottom) / 2 - (band.top + band.bottom) / 2),
        bandHeight: round(band.height),
        pieceHeight: round(r.height),
      });
    }
  }
  return out;
};

window.__ioEditorProbe = function () {
  const doc = view.state.doc;
  const rows = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const spans = visuals.blockFillSpansInLine(
      line.text, SEP, SEP,
      visuals.buildElementMarkersFromConfig(CFG),
      /* Род значений каждого Block — тем же вызовом, что и у слоя: проба,
         спрашивающая иначе, мерила бы не то, что нарисовано (У-4). И признак
         «эта ссылка — значение поля» тем же (В-141): без него проба считает
         значением Block ссылку, которой слой оформления его не даёт. */
      visuals.buildBlockKindsFromConfig(CFG),
      visuals.buildWikilinkValueTestFromConfig(CFG));
    const left = spans.find((s) => s.zone === "left") || null;
    const at = (pos, side) => {
      const c = view.coordsAtPos(pos, side);
      return c ? { left: round(c.left), right: round(c.right), top: round(c.top), bottom: round(c.bottom) } : null;
    };
    /*
     * Ящик зрительной строки — от него считается середина подложки, и он же
     * отличает строку со ссылкой от строки без неё: она **выше** умолчания
     * редактора. Берётся у платформы (`lineBlockAt`), а не у узла `.cm-line`:
     * подложка считается от той же меры.
     */
    const block = view.lineBlockAt(line.from);
    /*
     * **Зрительные строки строки документа — то, чем меряется перенос.**
     *
     * `Range` по содержимому узла `.cm-line` отдаёт по прямоугольнику на
     * каждую зрительную строку, и это ровно то, докуда на ней **написано**.
     * Нужно это затем, чтобы вопрос «подложка нарисована выделением?» не
     * зависел от того, где на этой машине встал перенос: у выделения
     * прямоугольник доходит до края ящика независимо от написанного, а у
     * порядной отрисовки — до написанного (У-78).
     */
    const lineEl = document.querySelectorAll(".cm-line")[n - 1] || null;
    const visualRows = (() => {
      if (!lineEl) return [];
      const range = document.createRange();
      range.selectNodeContents(lineEl);
      /*
       * **Группируются они по пересечению вертикалей, а не по равенству
       * верхов.** У пузыря тега свой верх, и равенство рвало одну зрительную
       * строку на десять — то есть число зрительных строк, которое отдавала
       * страница, было числом строчных ящиков (У-120: «одинаковая вертикаль»
       * не отвечает на вопрос «одна ли это зрительная строка»).
       */
      const out = [];
      for (const r of Array.from(range.getClientRects())) {
        if (!(r.width > 0) && !(r.height > 0)) continue;
        const hit = out.find((g) => r.top < g.bottom - 1 && r.bottom > g.top + 1);
        if (hit) {
          hit.top = Math.min(hit.top, round(r.top));
          hit.bottom = Math.max(hit.bottom, round(r.bottom));
          hit.left = Math.min(hit.left, round(r.left));
          hit.right = Math.max(hit.right, round(r.right));
          continue;
        }
        out.push({ top: round(r.top), bottom: round(r.bottom), left: round(r.left), right: round(r.right) });
      }
      out.sort((a, b) => a.top - b.top);
      return out;
    })();
    rows.push({
      line: n,
      text: line.text,
      hasLink: line.text.indexOf("[[") >= 0,
      visualRows,
      rowTop: round(Number(view.documentTop) + Number(block.top)),
      rowHeight: round(Number(block.height)),
      /* Первое значение левого блока и правый край знака начала строки. */
      blockStart: left ? at(line.from + left.start, 1) : null,
      prefixGlyphEnd: left ? at(line.from + left.prefixEnd, -1) : null,
      sepStart: left && left.gapTo >= 0 ? at(line.from + left.gapTo, 1) : null,
      sepEnd: left && left.sepFar >= 0 ? at(line.from + left.sepFar, -1) : null,
    });
  }
  /*
   * Положительный контроль к подделке ссылки: её строчный ящик и правда выше
   * ящика соседнего текста. Без него «высоты подложек равны» выполнялось бы и
   * от подделки, которая ничего не подделала (У-110).
   */
  const linkEl = document.querySelector(".io-probe-link");
  const plainEl = document.querySelector(".cm-line");
  const linkBox = linkEl ? round(linkEl.getBoundingClientRect().height) : -1;
  const textBox = (() => {
    if (!plainEl) return -1;
    const range = document.createRange();
    const node = Array.from(plainEl.childNodes).find((n) => n.nodeType === 3);
    if (!node) return -1;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return round(r.height);
  })();
  /* Пузырь тега: его высота — вторая половина замечания по V1, и мерит её
     браузер, а не наша формула. */
  const bubbleEl = document.querySelector("[data-io-tag-token]");
  const bubbleHeight = bubbleEl ? round(bubbleEl.getBoundingClientRect().height) : -1;
  /* Кнопка `→`: до неё прижимается подложка правого блока. */
  const flyEl = document.querySelector(".io-flybtn");
  const fly = flyEl ? (() => {
    const r = flyEl.getBoundingClientRect();
    return { left: round(r.left), right: round(r.right), top: round(r.top) };
  })() : null;
  /*
   * Строка-заголовок: подложка против того, что на ней написано.
   *
   * **Эталон спрашивается у браузера, а не считается по нашей формуле.**
   * `Range` по содержимому строки отдаёт объединение строчных ящиков — то
   * есть ровно то место, где стоит написанное, — и оно не зависит ни от
   * одного нашего числа. Ящик самого узла в эталон не годится: отступ
   * заголовка Obsidian задаёт `padding`, а тот лежит **внутри** границы, и
   * середина ящика узла выше середины написанного. Сверяя с ней, гейт
   * объявлял бы верной подложку, уехавшую вверх, — это и была его слепота
   * 2026-09-13 (У-147).
   */
  const headingEl = document.querySelector(".io-probe-heading");
  const heading = headingEl ? (() => {
    const lineRect = headingEl.getBoundingClientRect();
    const inkRange = document.createRange();
    inkRange.selectNodeContents(headingEl);
    const inkRect = inkRange.getBoundingClientRect();
    const cs = window.getComputedStyle(headingEl);
    const tokenEl = headingEl.querySelector("[data-io-tag-token]");
    /*
     * Отбор **по пересечению**, а не по вложенности: подложка, уехавшая вверх,
     * выходит за ящик своей строки — и отбор «внутри ящика» не нашёл бы ровно
     * тот прямоугольник, ради которого всё это меряется.
     */
    const inRow = bands().filter((b) => b.bottom > lineRect.top + 1 && b.top < lineRect.bottom - 1);
    return {
      line: { top: round(lineRect.top), bottom: round(lineRect.bottom), height: round(lineRect.height) },
      ink: { top: round(inkRect.top), bottom: round(inkRect.bottom), height: round(inkRect.height) },
      padTop: round(parseFloat(cs.paddingTop) || 0),
      padBottom: round(parseFloat(cs.paddingBottom) || 0),
      token: tokenEl ? (() => {
        const r = tokenEl.getBoundingClientRect();
        return { top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
      })() : null,
      bands: inRow,
      tagBubblesInPrefix: Array.from(headingEl.querySelectorAll("[data-io-tag-token]"))
        .filter((el) => String(el.textContent || "").trim().startsWith("#")
          && /^#+$/.test(String(el.textContent || "").trim()))
        .length,
    };
  })() : null;
  /*
   * Пузыри, лежащие **в Block**, и их место на экране.
   *
   * Нужны они одному вопросу — «подложка накрывает значение или стоит рядом с
   * ним»: его слово 2026-09-14 «на перенесённой строке полоска не подкрашивает
   * последнее value». Зона спрашивается у того же объявления, каким её считает
   * продукт (`resolveTagVisualZone`), а не выводится из вида строки (У-32), а
   * место — у браузера.
   */
  const blockBubbles = Array.from(document.querySelectorAll("[data-io-tag-token]"))
    .map((el) => {
      const pos = view.posAtDOM(el);
      const line = doc.lineAt(pos);
      const zone = visuals.resolveTagVisualZone(line.text, pos - line.from, SEP, SEP);
      if (zone !== "left" && zone !== "right") return null;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0)) return null;
      return {
        token: el.getAttribute("data-io-tag-token"),
        zone,
        line: line.number,
        left: round(r.left),
        right: round(r.right),
        top: round(r.top),
        bottom: round(r.bottom),
      };
    })
    .filter(Boolean);
  return {
    bands: bands(),
    rows,
    blockBubbles,
    linkBoxHeight: linkBox,
    textBoxHeight: textBox,
    bubbleHeight,
    fly,
    heading,
    lineHeight: round(view.defaultLineHeight),
    markerClass: visuals.BLOCK_FILL_MARKER_CLASS,
  };
};

/**
 * Отпечаток отрисовки: вычисленный стиль каждого нарисованного плагином узла.
 *
 * Нужен не подложке, а **переносу инлайновых объявлений оформления в классы**
 * (Р7): перенос вида не меняет, если сделан верно, и проверить это было нечем,
 * кроме глаза заказчика. Здесь это проверяется числами: отпечаток до переноса
 * обязан совпасть с отпечатком после.
 */
const FINGERPRINT_PROPS = [
  "display", "font-size", "line-height", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "border-radius", "background-color",
  "color", "opacity", "width", "min-width", "height", "margin-left",
  "margin-right", "vertical-align", "overflow", "border-top-width",
];

/**
 * Оверлей скроллера TagWheel — тот самый, про который в Р7 написано «проверить
 * это можно только глазами заказчика».
 *
 * Он поднимается здесь целиком и по-настоящему: модуль не знает ни об Obsidian,
 * ни о плагине, ему нужны `document`, `window` и редактор, у которого есть
 * `posToOffset` и `cm.coordsAtPos`. Второе — настоящий `EditorView` этой
 * страницы, то есть положение коробки считает настоящий CodeMirror.
 *
 * **Подделан ровно `Editor` Obsidian** (У-1): `posToOffset` — это его API, а не
 * CodeMirror'а, и здесь он переводит строку и столбец в смещение по настоящему
 * документу.
 */
let scrollerHandle = null;

window.__ioShowScroller = function (opts) {
  if (scrollerHandle) { scrollerHandle.destroy(); scrollerHandle = null; }
  const o = opts && typeof opts === "object" ? opts : {};
  scrollerHandle = scroller.createTagWheelScrollerOverlay({
    direction: o.direction || "full",
    size: o.size || 3,
    fillColor: o.fillColor || "",
    textColor: o.textColor || "",
  });
  const editorStandIn = {
    posToOffset: (at) => {
      const line = view.state.doc.line(Math.max(1, Number(at && at.line) + 1));
      return line.from + Math.max(0, Number(at && at.ch) || 0);
    },
    cm: view,
  };
  /*
   * Строка панели того же вида, что рисует TagWheel: активное значение в ней
   * обособлено `**[…]**`, и по нему оверлей находит, к чему прицепиться. Без
   * этой пометки он прячется, и снимок вышел бы из двух пустых коробок —
   * то есть проверял бы отсутствие предмета (У-113).
   */
  scrollerHandle.update({
    editor: editorStandIn,
    lineNumber: 1,
    controlLine: "==`#todo` **[work]**==",
    upItems: [{ label: "#todo" }, { label: "#doing" }],
    downItems: [{ label: "#work" }, { label: "#home" }, { label: "#health" }],
  });
  /* У-110: коробка обязана появиться, иначе снимок пуст и сверять нечего. */
  const rows = document.querySelectorAll("body > div:not(.markdown-source-view) > div > div");
  if (!rows.length) throw new Error("оверлей скроллера не нарисовал ни одной строки");
  return document.querySelectorAll("body > div:not(.markdown-source-view)").length;
};

window.__ioHideScroller = function () {
  if (scrollerHandle) { scrollerHandle.destroy(); scrollerHandle = null; }
};

/** Отпечаток коробок оверлея: сами коробки и всё, что в них. */
window.__ioFingerprintScroller = function () {
  const out = [];
  const roots = document.querySelectorAll("body > div:not(.markdown-source-view)");
  for (const root of roots) {
    const nodes = [root].concat(Array.from(root.querySelectorAll("*")));
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const row = { tag: el.tagName.toLowerCase(), cls: el.className || "" };
      const text = el.textContent || "";
      row.text = text.length > 24 ? text.slice(0, 24) : text;
      for (const p of SCROLLER_PROPS) row[p] = cs.getPropertyValue(p);
      const r = el.getBoundingClientRect();
      row.box = round(r.width) + "x" + round(r.height)
        + "@" + round(r.left) + "," + round(r.top);
      out.push(row);
    }
  }
  return out;
};

const SCROLLER_PROPS = [
  "position", "z-index", "pointer-events", "display", "border-top-width",
  "border-top-style", "border-top-color", "border-radius", "background-color",
  "box-shadow", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "font-size", "line-height", "white-space", "overflow", "font-family",
  "flex-direction", "gap", "text-overflow", "opacity", "color", "font-weight",
  "visibility", "left", "top", "width", "min-width",
];

window.__ioFingerprint = function () {
  const out = [];
  const nodes = document.querySelectorAll(
    ".cm-content [data-io-tag-token], .cm-content .io-zero-width-inline,"
    + " .cm-content .inline-overhaul-tw-token, ." + visuals.BLOCK_FILL_MARKER_CLASS);
  for (const el of nodes) {
    const cs = getComputedStyle(el);
    const row = { tag: el.tagName.toLowerCase(), cls: el.className || "" };
    const token = el.getAttribute && el.getAttribute("data-io-tag-token");
    if (token) row.token = token;
    const text = el.textContent || "";
    row.text = text.length > 24 ? text.slice(0, 24) : text;
    for (const p of FINGERPRINT_PROPS) row[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    row.box = round(r.width) + "x" + round(r.height);
    out.push(row);
  }
  return out;
};
