"use strict";

const path = require("path");
const transform = require(path.join(__dirname, "..", "..", "src", "features", "transform_feature.js"));
const lineFinalize = require(path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function assertDeepEq(actual, expected, name) {
  assertEq(JSON.stringify(actual), JSON.stringify(expected), name);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

function makeConfig() {
  return {
    transform: { inline2note: { yamlNoteFormat: "clean" } },
    pkm: {
      lineFormat: { separator1: "::", separator2: "::" },
      fields: {
        order: {
          left: ["kind", "child"],
          right: ["link", "when"],
          active: {},
          enabled: {},
          types: { kind: "tag", child: "tag", link: "wikilink", when: "element" },
          propertiesByField: { kind: "tags", child: "tags", link: "project", when: "when" },
        },
        tags: {
          fields: [
            { id: "kind", prefix: "#", values: [{ token: "todo" }] },
            { id: "child", dependsOn: "kind", prefix: "#", values: [{ token: "next" }] },
          ],
        },
        links: {
          fields: [
            { id: "link", type: "wikilink", values: [{ token: "ProjectA" }] },
            { id: "when", type: "element", marker: "@", prefix: "!", values: [] },
          ],
        },
      },
    },
  };
}

(function testMissingInline2NoteConfigRequiresExplicitOptIn() {
  assertEq(transform.DEFAULT_INLINE2NOTE.enabled, false, "default transform disabled");
  assertEq(transform.normalizeInline2Note(undefined).enabled, false, "missing transform config disabled");
  assertEq(transform.normalizeTransformConfig({}).transform.inline2note.enabled, false, "migration adds disabled transform config");
  assertEq(transform.normalizeInline2Note({ enabled: true }).enabled, true, "explicit transform opt-in preserved");
})();

(function testPreviewUsesConfiguredSeparators() {
  const cfg = makeConfig();
  /*
   * Строка предпросмотра: префикс, Separator из настроек и текст из
   * нескольких слов.
   *
   * Текст был одним словом `Text`, и на нём не было видно, работает ли
   * `Words to keep`; префикса не было вовсе, и в половинах «до» и «после» не
   * было видно, что с началом строки что-то происходит (замечания заказчика
   * B13 и B18, 2026-09-02).
   */
  assertEq(
    transform.buildPreviewBaseLine(cfg),
    "- [ ] #todo #next :: buy milk bread and eggs today :: [[ProjectA]] @value",
    "preview separator contract",
  );
})();

/*
 * `Words to keep` виден на выдуманной строке: разные значения дают разное
 * число слов. Пока текст был одним словом, ползунок ничего не менял, и
 * проверить его было нечем.
 */
(function testPreviewShowsWordsToKeep() {
  const cfg = makeConfig();
  const after = (keepWords) => transform.buildSourcePreviewTree({
    enabled: true,
    sublines: "stay",
    sourceProcessing: {
      text: "words", keepWords, replaceWithLink: true,
      token: "#processed", panel: "right", cleanupFieldIds: [],
    },
  }, cfg).after[0];

  const words = (line) => String(line || "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[^\]]?\]\s+)?/, "")
    .split(/\s+/)
    .filter(w => w && !/^\[\[/.test(w) && w !== "::" && w !== "#processed").length;

  const one = words(after(1));
  const three = words(after(3));
  const five = words(after(5));
  assertTrue(one < three && three < five,
    "число оставленных слов растёт: " + one + " → " + three + " → " + five);
  assertTrue(/^- /.test(String(after(3))),
    "префикс на строке виден: " + after(3));
})();

(function testDisabledRulesDoNotConflict() {
  const rules = transform.validateSmartRules([
    { id: "off", enabled: false, conditions: { tags: ["#todo"] }, targetTemplate: "off.md" },
    { id: "on", enabled: true, conditions: { tags: ["#todo"] }, targetTemplate: "on.md" },
  ]);
  assertEq(rules[0].enabled, false, "disabled rule remains disabled");
  assertEq(rules[0].validation.isConflict, false, "disabled rule excluded from conflicts");
  assertEq(rules[1].enabled, true, "active rule remains enabled");
})();

(function testConflictValidationUsesFullOverlapGraph() {
  const chain = transform.validateSmartRules([
    { id: "a", enabled: true, conditions: { tags: ["#x"], emojiFields: ["@a"] } },
    { id: "b", enabled: true, conditions: { tags: ["#x"], wikilinks: ["P"] } },
    { id: "c", enabled: true, conditions: { emojiFields: ["@b"], wikilinks: ["P"] } },
  ]);
  /*
   * Вердикт живёт в `validation`, а `enabled` остаётся выбором человека:
   * решение 2026-08-29, вторая половина сделана 2026-08-31. Спорное правило
   * шаблон не выбирает — это проверяет `selectSmartTemplate`, — но тумблер
   * ему не снимают: снятый тумблер следующий прогон уже не пересчитает.
   */
  assertDeepEq(chain.map((rule) => rule.enabled), [true, true, true], "conflict verdict does not touch the toggle");
  assertDeepEq(chain.map((rule) => rule.validation.isConflict), [true, true, true], "chain marks every involved rule conflicted");

  const triangle = transform.validateSmartRules([
    { id: "x", enabled: true, conditions: { tags: ["#same"] } },
    { id: "y", enabled: true, conditions: { tags: ["#same"] } },
    { id: "z", enabled: true, conditions: { tags: ["#same"] } },
  ]);
  assertDeepEq(triangle.map((rule) => rule.validation.isConflict), [true, true, true], "conflict triangle marks every involved rule");
  assertDeepEq(triangle.map((rule) => rule.enabled), [true, true, true], "and leaves the toggles alone");
  assertTrue(triangle.every((rule) => rule.validation.details.length === 2), "triangle records all peer edges");
})();

(function testAutoTitlePriority() {
  const i2n = transform.normalizeInline2Note({ noteName: { delimiters: "{}", wordCount: 3 } });
  assertEq(transform.resolveAutoTitle({ line: "- #todo :: payload words {Explicit Name}", payloadText: "payload words" }, i2n), "Explicit Name", "delimiter title priority");
  const checkboxI2n = transform.normalizeInline2Note({ noteName: { delimiters: "[]", wordCount: 3 } });
  assertEq(transform.resolveAutoTitle({ line: "- [x] :: payload words", payloadText: "payload words" }, checkboxI2n), "payload words", "task checkbox is not explicit title");
  assertEq(transform.resolveAutoTitle({ line: "## Header Name", payloadText: "fallback words" }, i2n), "Header Name", "header title priority");
  assertEq(transform.resolveAutoTitle({ line: "plain", payloadText: "one two three four" }, i2n), "one two three", "word title fallback");
  assertEq(transform.resolveAutoTitle({ line: "plain", payloadText: "" }, i2n), "", "empty title stays empty");
})();

(function testCrLfFrontmatterAndMultilineReplacement() {
  const parsed = transform.parseFrontmatter("---\r\ntags:\r\n  - old\r\nsummary: |\r\n  old text\r\nkeep: yes\r\n---\r\nBody\r\n");
  assertEq(parsed.newline, "\r\n", "CRLF detected");
  const lines = transform.renderYamlBlockWithOrder(parsed.yamlLines, { tags: ["todo"], summary: "new" }, makeConfig());
  /* Кавычек у значений больше нет: их ставят только там, где без них YAML
     прочитается иначе (1.3.2.4). */
  assertDeepEq(lines, ["tags: [todo]", "summary: new", "keep: yes"], "multiline YAML value replaced as block");
})();

(function testYamlMergeAppendsTokenOverrideOutsidePropertiesByField() {
  const cfg = makeConfig();
  cfg.pkm.fields.tags.fields[0].values[0].yamlProperty = "token override";
  const parsed = transform.parseInlineLine("- #todo :: work", cfg);
  const patch = transform.buildYamlMapFromContext(transform.buildTransformContext(parsed, cfg), cfg);
  assertDeepEq(patch, { "token override": "todo" }, "token-level YAML override enters patch");
  assertDeepEq(
    transform.renderYamlBlockWithOrder(["keep: yes"], patch, cfg),
    ["keep: yes", '"token override": todo'],
    "remaining token override key appended"
  );
})();

(function testYamlTopLevelKeyParserSupportsSafeKeysAndRejectsDuplicates() {
  const lines = [
    '"quoted key": old',
    "'single key': old",
    "ключ: old",
    "project.name: old",
    "spaced key: old",
  ];
  const patch = { "quoted key": 1, "single key": 2, "ключ": 3, "project.name": 4, "spaced key": 5 };
  assertDeepEq(transform.renderYamlBlockWithOrder(lines, patch, makeConfig()), [
    '"quoted key": 1',
    "'single key': 2",
    "ключ: 3",
    "project.name: 4",
    "spaced key: 5",
  ], "quoted Unicode dotted and spaced keys update in place");
  let duplicateError = "";
  try { transform.renderYamlBlockWithOrder(["name: one", '"name": two'], { name: "next" }, makeConfig()); } catch (error) { duplicateError = String(error.message || error); }
  assertTrue(/duplicate YAML top-level key/.test(duplicateError), "decoded duplicate YAML keys fail fast");
  let invalidError = "";
  try { transform.renderYamlBlockWithOrder(['"unterminated: value'], { other: "x" }, makeConfig()); } catch (error) { invalidError = String(error.message || error); }
  assertTrue(/invalid quoted YAML top-level key/.test(invalidError), "malformed quoted YAML key fails fast");
})();

(function testSourceCleanupUsesMatchedPanelSpansOnly() {
  const cfg = makeConfig();
  const source = "- #todo :: payload #todo";
  const parsed = transform.parseInlineLine(source, cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  assertEq(
    transform.applySourceCleanupByFieldIds(source, ctx, [], { separator1: "::", separator2: "::" }),
    "- :: payload #todo",
    "cleanup removes left field span but preserves duplicate payload text"
  );

  cfg.pkm.fields.tags.fields.push({ id: "alias", prefix: "#", values: [{ token: "todo" }] });
  cfg.pkm.fields.order.left.push("alias");
  cfg.pkm.fields.order.types.alias = "tag";
  const sharedCtx = transform.buildTransformContext(transform.parseInlineLine(source, cfg), cfg);
  assertEq(
    transform.applySourceCleanupByFieldIds(source, sharedCtx, ["kind"], { separator1: "::", separator2: "::" }),
    source,
    "span shared with preserved field is not removed by unchecked peer field"
  );
})();

(function testSourceLinkAndIndentPreserved() {
  const out = transform.applySourcePayloadReplace("\t- [ ] #todo :: old :: tail", "Notes/Actual-01", { separator1: "::", separator2: "::" });
  assertEq(out, "\t- [ ] #todo :: [[Notes/Actual-01]] :: tail", "actual path wikilink preserves indent");
})();

(function testProcessedTokenPanels() {
  const sep = { separator1: "::", separator2: "::" };
  assertEq(transform.insertProcessedToken("- [ ] #todo :: text", "#done", "left", sep), "- [ ] #todo #done :: text", "processed token left");
  assertEq(transform.insertProcessedToken("- [ ] #todo :: text", "#done", "right", sep), "- [ ] #todo :: text :: #done", "processed token right");
})();

(function testSourcePrefixUsesSharedResolverAfterCleanup() {
  const cfg = makeConfig();
  cfg.pkm.prefixRules = {
    resolver: "priority-first",
    priorityTargets: ["kind"],
    checkboxByFieldValue: { kind: { todo: "[ ]" } },
  };
  const parsed = transform.parseInlineLine("- [I] #todo :: work", cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  const out = transform.applySourcePrefixResolution("- [I] #todo :: work", parsed.line, ctx, ["kind"], cfg, lineFinalize);
  assertEq(out, "- [ ] #todo :: work", "shared prefix resolver replaces stale checkbox");
})();

(function testDataDrivenDependsOnAndWikilinkMatching() {
  const cfg = makeConfig();
  const parsed = transform.parseInlineLine("- #todo #next :: work :: [[Unknown]] @2026", cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  assertTrue(ctx.byFieldId.child, "dependsOn child matched without suffix convention");
  assertEq(ctx.byFieldId.link, undefined, "unmatched wikilink not assigned to field");
  assertEq(ctx.byFieldId.when.rawToken, "@2026", "marker resolver consistently prefers marker");
  assertDeepEq(transform.buildYamlMapFromContext(ctx, cfg), { tags: ["todo", "next"], when: "2026" }, "data-driven YAML cardinality");
})();

(function testSmartTemplateSelection() {
  const parsed = { tags: ["#todo"], emojis: [{ marker: "@", value: "2026" }], wikilinks: ["ProjectA"] };
  const rules = transform.validateSmartRules([
    { id: "disabled", enabled: false, conditions: { tags: ["#todo"] }, targetTemplate: "disabled.md" },
    { id: "match", enabled: true, conditions: { tags: ["#todo"], wikilinks: ["[[ProjectA]]"] }, targetTemplate: "match.md" },
  ]);
  assertEq(transform.selectSmartTemplate(parsed, rules, "default.md"), "match.md", "smart template runtime selection");
})();

(function testSelectionRangeExpandsWholeLinesAndDescendants() {
  const lines = ["root", "  child", "    grandchild", "sibling"];
  const ed = {
    getLine(n) { return lines[n] || ""; },
    lineCount() { return lines.length; },
  };
  const info = transform.deriveSelectionRangeFromEditor(ed, { line: 0, ch: 2 }, { line: 1, ch: 3 });
  assertEq(info.blockStart, 0, "partial selection starts at full line");
  assertEq(info.blockEnd, 2, "selection expands through descendant tree");
  assertEq(info.blockText, "root\n  child\n    grandchild", "selection body preserves tree");
})();

(function testBodyIndentAndNewlineNormalization() {
  assertEq(transform.normalizeInlineBlockForBody("\t- root\n\t\t- child", "\r\n"), "- root\r\n\t- child", "body keeps relative indent and requested newline");
})();

(function testDatetimeHeaderUsesConfiguredFormat() {
  const header = transform.formatHeaderByMode({ placement: { headerMode: "datetime", datetimeFormat: "DD.MM.YYYY HH:mm" } }, new Date(2026, 7, 8, 9, 5));
  assertEq(header, "### 08.08.2026 09:05", "datetime header format");
})();


/*
 * Кавычки у значения свойства (замечание заказчика 1.3.2.4).
 *
 * Раньше в кавычки бралось всё подряд, и в заметке стояло `property: "value"`.
 * Документация Obsidian (Help → Properties) пишет текстовое свойство без
 * кавычек и требует их ровно у внутренней ссылки. Ожидания здесь выписаны
 * строками из документации, а не собраны той же формулой, что и результат.
 */
(function testYamlQuotingFollowsObsidianDocs() {
  const render = (patch) => transform.renderYamlBlockWithOrder([], patch, makeConfig());

  assertDeepEq(render({ title: "A New Hope" }), ["title: A New Hope"],
    "текстовое свойство пишется без кавычек");
  assertDeepEq(render({ link: "[[Episode IV]]" }), ['link: "[[Episode IV]]"'],
    "внутренняя ссылка — единственный случай, где кавычки обязательны");
  assertDeepEq(render({ url: "https://www.example.com" }), ["url: https://www.example.com"],
    "ссылка наружу тоже обходится без кавычек");
  assertDeepEq(render({ tags: ["value", "todo", "[[test1]]"] }), ['tags: [value, todo, "[[test1]]"]'],
    "в списке кавычки достаются той же одной ссылке");

  /* Кавычки остаются там, где без них меняется смысл. */
  assertDeepEq(render({ n: "123" }), ['n: "123"'], "текст из одних цифр остаётся текстом");
  assertDeepEq(render({ b: "true" }), ['b: "true"'], "слово true остаётся словом");
  assertDeepEq(render({ empty: "" }), ['empty: ""'], "пустое значение видно только в кавычках");
  assertDeepEq(render({ colon: "a: b" }), ['colon: "a: b"'], "двоеточие с пробелом развалило бы строку");
  assertDeepEq(render({ hash: "a #b" }), ['hash: "a #b"'], "решётка начала бы комментарий");
  assertDeepEq(render({ dash: "- x" }), ['dash: "- x"'], "дефис в начале начал бы список");
  assertDeepEq(render({ pad: " x " }), ['pad: " x "'], "пробелы по краям иначе пропадут");
})();


/*
 * `Property type` против догадки (замечание заказчика 1.3.2.3).
 *
 * Догадка «в свойство пишут два Field — значит список» стояла после ручной
 * настройки и молча её перекрывала: `tags`, куда пишут два Field, оставался
 * списком, сколько бы раз человек ни выбрал `One Value`. Подсказка контрола
 * обещает обратное, и права она.
 */
(function testExplicitCardinalityBeatsTheGuess() {
  const twoFieldsOneProperty = () => {
    const cfg = makeConfig();
    const order = cfg.pkm.fields.order;
    order.propertiesByField = { kind: "tags", link: "tags" };
    return cfg;
  };
  const yamlFor = (cfg, line) => {
    const parsed = transform.parseInlineLine(line, cfg);
    return transform.buildYamlMapFromContext(transform.buildTransformContext(parsed, cfg), cfg);
  };
  const LINE = "- #todo :: work :: [[ClientA]]";

  const auto = yamlFor(twoFieldsOneProperty(), LINE);
  assertTrue(Array.isArray(auto.tags), "по умолчанию два Field в одном свойстве дают список");

  const one = twoFieldsOneProperty();
  one.pkm.fields.order.yamlCardinalityByField = { kind: "one", link: "one" };
  const single = yamlFor(one, LINE);
  assertTrue(!Array.isArray(single.tags), "выбранное вручную `One Value` перебивает догадку");

  const mixed = twoFieldsOneProperty();
  mixed.pkm.fields.order.yamlCardinalityByField = { kind: "one", link: "list" };
  const conflict = yamlFor(mixed, LINE);
  assertTrue(Array.isArray(conflict.tags),
    "спор двух Fields об одном свойстве решается в пользу списка: он вмещает оба");

  /* И решается одинаково, в каком бы порядке Fields ни стояли: правило про
     свойство, а не про то, кто попался первым. */
  const reversed = twoFieldsOneProperty();
  reversed.pkm.fields.order.yamlCardinalityByField = { kind: "list", link: "one" };
  assertTrue(Array.isArray(yamlFor(reversed, LINE).tags),
    "порядок Fields на решение не влияет");
})();


/*
 * `Line above is header` (10.13.9, замечание заказчика 1.6.4.1).
 *
 * До этого три решётки при `Date and time` стояли **жёстко в коде**, а
 * подсказка `Date format` советовала вписать решётки в сам формат — и
 * `## YYYY-MM-DD` в текстбоксе дал бы в заметке `### ## 2026-09-01`. Теперь
 * решётки ставит уровень, а текстбоксы держат только текст.
 *
 * Половина проверки — про **миграцию**: у человека, писавшего `## Captured`,
 * строка в заметке обязана остаться прежней.
 */
(function testHeaderLevelSeparatesHashesFromText() {
  const at = new Date(2026, 8, 1, 10, 0);
  const place = (placement) =>
    transform.normalizeTransformConfig({ transform: { inline2note: { placement } } })
      .transform.inline2note.placement;
  const header = (placement) => transform.formatHeaderByMode({ placement: place(placement) }, at);

  /* Уровень отделён от текста, и решётки ставит он. */
  assertEq(header({ headerMode: "custom", customHeader: "Captured", headerLevel: 0 }),
    "Captured", "уровень 0 — обычная строка, без решёток");
  assertEq(header({ headerMode: "custom", customHeader: "Captured", headerLevel: 1 }),
    "# Captured", "уровень 1 — самый крупный заголовок");
  assertEq(header({ headerMode: "custom", customHeader: "Captured", headerLevel: 6 }),
    "###### Captured", "уровень 6 — самый мелкий");
  assertEq(header({ headerMode: "custom", customHeader: "Captured", headerLevel: 9 }),
    "###### Captured", "глубже шестого заголовков не бывает");
  assertEq(header({ headerMode: "none", customHeader: "Captured", headerLevel: 3 }),
    "", "Nothing означает, что строки нет вовсе, и уровень к ней не применяется");

  /* Решётки, введённые руками, не удваиваются: текст их не хранит. */
  assertEq(header({ headerMode: "custom", customHeader: "## X", headerLevel: 2 }),
    "## X", "решётки из текстбокса не складываются с решётками уровня");
  assertEq(place({ headerMode: "custom", customHeader: "## X" }).customHeader,
    "X", "и в конфиге текст остаётся без них");

  /* Дата: тот же уровень, тот же текст без решёток. */
  assertEq(header({ headerMode: "datetime", datetimeFormat: "YYYY-MM-DD", headerLevel: 2 }),
    "## 2026-09-01", "у даты уровень тот же, что у текста: строка одна");
  assertEq(header({ headerMode: "datetime", datetimeFormat: "## YYYY-MM-DD", headerLevel: 3 }),
    "### 2026-09-01", "решётки в формате даты тоже не удваиваются");

  /* Миграция: строка в заметке не должна измениться (Н5). */
  assertEq(place({ headerMode: "custom", customHeader: "## Captured" }).headerLevel, "2",
    "уровень выведен из решёток, которые человек написал сам");
  assertEq(header({ headerMode: "custom", customHeader: "## Captured" }),
    "## Captured", "и строка в заметке осталась той же, что была до обновления");
  assertEq(place({ headerMode: "datetime" }).headerLevel, "3",
    "у даты уровень выведен из того, что делал код: три решётки стояли в нём");
  assertEq(header({ headerMode: "datetime", datetimeFormat: "YYYY-MM-DD HH:mm" }),
    "### 2026-09-01 10:00", "и дата выглядит так же, как выглядела");
  assertEq(place({ headerMode: "custom", customHeader: "Captured" }).headerLevel, "0",
    "текст без решёток и был обычной строкой — ею и остаётся");

  /* Выбранное человеком не пересчитывается: вывод одноразовый. */
  assertEq(place({ headerMode: "custom", customHeader: "## Captured", headerLevel: 5 }).headerLevel, "5",
    "уровень, который уже выбран, вывод не перебивает");
})();


/*
 * Предпросмотр `Source line`: дерево «до и после» (10.13.10, замечание
 * заказчика 1.4.3.1.2).
 *
 * Считает движок тем же путём, которым переносит строку по-настоящему,
 * поэтому проверка смотрит на **результат**: что осталось на странице.
 */
(function testSourcePreviewTreeFollowsSettings() {
  const cfg = makeConfig();
  const i2n = (over) => transform.normalizeTransformConfig({
    transform: { inline2note: Object.assign({ enabled: true }, over) },
  }).transform.inline2note;
  const tree = (over) => transform.buildSourcePreviewTree(i2n(over), cfg);

  const stay = tree({ sublines: "stay" });
  assertEq(stay.before.length, 3, "«до» — строка и две дочерние под ней");
  assertTrue(/^\S/.test(stay.before[0]), "родительская строка без отступа");
  assertTrue(/^\s/.test(stay.before[1]) && /^\s/.test(stay.before[2]),
    "дочерние — с отступом");
  assertTrue(stay.before[1] !== stay.before[2],
    "дочерние различимы, иначе дерево читается как одна строка");

  assertEq(stay.after.length, 3, "дети остаются на странице: " + stay.after.join(" / "));
  assertEq(stay.after[1], stay.before[1], "и остаются нетронутыми");

  const away = tree({ sublines: "remove" });
  assertEq(away.after.length, 1, "дети ушли в заметку вместе с текстом");
  assertEq(away.after[0], stay.after[0], "а родительская строка от этого не изменилась");

  /* Настройки группы меняют именно «после». */
  const leave = tree({ sublines: "remove", sourceProcessing: { text: "leave", replaceWithLink: false, token: "" } });
  const remove = tree({ sublines: "remove", sourceProcessing: { text: "remove", replaceWithLink: false, token: "" } });
  assertTrue(leave.after[0] !== remove.after[0],
    "судьба текста видна в предпросмотре: " + leave.after[0] + " против " + remove.after[0]);

  const marked = tree({ sublines: "remove", sourceProcessing: { token: "#done", panel: "right" } });
  assertTrue(marked.after[0].includes("#done"), "метка «обработано» видна: " + marked.after[0]);

  /* Fields нет — считать нечего, и это не падение. Разделители в конфиге при
     этом есть: без них движок обязан ругаться, и ругается он раньше. */
  const noFields = { pkm: { lineFormat: { separator1: "::", separator2: "::" }, fields: { order: {}, tags: { fields: [] }, links: { fields: [] } } } };
  assertEq(transform.buildSourcePreviewTree(i2n({}), noFields).before.length, 0,
    "без Fields предпросмотр пуст, а не сломан");
})();


/*
 * Прозрачность обработанной строки переехала с доли на процент (10.13.12 Н5).
 * Ключ до этого не читался никем, но в чужих файлах доля лежит, и после
 * обновления она обязана означать то же самое.
 */
(function testProcessedOpacityMigratesFromShareToPercent() {
  const opacity = (raw) => transform.normalizeTransformConfig({
    transform: { inline2note: { sourceProcessing: { visual: { opacity: raw } } } },
  }).transform.inline2note.sourceProcessing.visual.opacity;

  assertEq(opacity(0.65), 65, "старая доля становится тем же процентом");
  assertEq(opacity(1), 100, "доля «непрозрачно» становится сотней процентов");
  assertEq(opacity(40), 40, "процент остаётся процентом");
  assertEq(opacity(140), 100, "и не выходит за сотню");
  assertEq(opacity("нет"), 65, "мусор уступает умолчанию");
})();

/*
 * Сторона Field берётся из Order, а не из списка определений, в котором Field
 * объявлен (замечания заказчика B21 и B11, 2026-09-02).
 *
 * Field типа link объявлен в `pkm.fields.links` — «справа», — но в Order стоит
 * в левом Block. На настоящей строке с разделителями он попадает в левый
 * сегмент, и до правки сторона не совпадала: Field не давал совпадения и не
 * попадал в свойства заметки. Предпросмотр `YAML property` собирает строку
 * **без** разделителей, там сторона у всех `any`, и он показывал свойство,
 * которого заметка не получала.
 *
 * Ожидание выписано отдельно от того, из чего строится результат (У-5): здесь
 * перечислены id Fields, а не пересчитан тот же обход.
 */
(function testFieldSideComesFromOrderNotFromDefinitionList() {
  const cfg = makeConfig();
  /* Ссылка переезжает в левый Block, элемент остаётся в правом. */
  cfg.pkm.fields.order.left = ["kind", "child", "link"];
  cfg.pkm.fields.order.right = ["when"];

  const line = "- #todo #next [[ProjectA]] :: text :: @value";
  const ctx = transform.buildTransformContext(transform.parseInlineLine(line, cfg), cfg);
  const ids = (ctx.matches || []).map((m) => m.fieldId).sort();
  assertDeepEq(ids, ["child", "kind", "link", "when"],
    "ссылка в левом Block совпадает: получилось " + JSON.stringify(ids));

  const map = transform.buildYamlMapFromContext(ctx, cfg);
  assertTrue(Object.prototype.hasOwnProperty.call(map, "project"),
    "свойство ссылки записано: " + JSON.stringify(map));

  /* Обратная сторона: тег, уехавший в правый Block, тоже находится там. */
  const flipped = makeConfig();
  flipped.pkm.fields.order.left = ["link"];
  flipped.pkm.fields.order.right = ["kind", "child", "when"];
  const flippedLine = "- [[ProjectA]] :: text :: #todo #next @value";
  const flippedCtx = transform.buildTransformContext(
    transform.parseInlineLine(flippedLine, flipped), flipped);
  const flippedIds = (flippedCtx.matches || []).map((m) => m.fieldId).sort();
  assertDeepEq(flippedIds, ["child", "kind", "link", "when"],
    "тег в правом Block совпадает: получилось " + JSON.stringify(flippedIds));
})();

/*
 * Папка новой заметки нормализуется, откуда бы она ни пришла. Проверяется
 * помощник: путь до заметки собирает `pickTargetPath`, а он просит vault, и
 * подделывать vault ради одной строки дороже, чем закрепить само правило.
 * `/` — это то, что Obsidian отдаёт у заметки в корне (замечание B21).
 */
(function testFolderPathNormalizationDropsRootSlash() {
  assertEq(transform.normalizeFolderPath("/"), "", "корневой слэш даёт пустую папку");
  assertEq(transform.normalizeFolderPath("//"), "", "два слэша тоже");
  assertEq(transform.normalizeFolderPath("/333/"), "333", "обрамляющие слэши снимаются");
  assertEq(transform.normalizeFolderPath("333//444"), "333/444", "двойной слэш внутри схлопывается");
})();


/*
 * B21: свойства заметки не ссорятся с типом, объявленным в хранилище.
 *
 * Три разные причины, и здесь закреплены все три.
 */
function runVaultPropertyTypesSuite() {
  /* 1. Значение `#/1` остаётся строкой, а не становится числом. */
  const cfg = {
    pkm: {
      lineFormat: { separator1: "||", separator2: "||" },
      fields: {
        order: {
          left: ["Importance"], right: [],
          active: { Importance: "yes" }, enabled: { Importance: true },
          types: { Importance: "tag" },
          propertiesByField: { Importance: "tags" },
        },
        tags: { fields: [{ id: "Importance", prefix: "#", yamlValueRule: "clean", values: [
          { token: "#/1", active: true },
        ] }] },
        links: { fields: [] },
      },
    },
    transform: { inline2note: { yamlNoteFormat: "clean" } },
  };
  const parsed = transform.parseInlineLine("- #/1 || text", cfg);
  const ctx = transform.buildTransformContext(parsed, cfg);
  const map = transform.buildYamlMapFromContext(ctx, cfg);
  const written = transform.renderYamlBlockWithOrder([], map, cfg).join(" | ");
  assertEq(typeof (Array.isArray(map.tags) ? map.tags[0] : map.tags), "string",
    "значение #/1 остаётся строкой, а не числом");
  assertTrue(written.indexOf('"1"') !== -1,
    "и в заметку уходит закавыченным, как тег: " + written);

  /* 2. Тип из хранилища сильнее догадки: список остаётся списком. */
  const one = transform.buildYamlMapFromContext(ctx, cfg, {});
  assertTrue(!Array.isArray(one.tags),
    "без объявленного типа одно значение остаётся одним значением");
  const asList = transform.buildYamlMapFromContext(ctx, cfg, { tags: "multitext" });
  assertTrue(Array.isArray(asList.tags),
    "свойство, объявленное списком, пишется списком даже с одним значением");
  const asTags = transform.buildYamlMapFromContext(ctx, cfg, { tags: "tags" });
  assertTrue(Array.isArray(asTags.tags), "встроенный тип `tags` — тоже список");
  const asText = transform.buildYamlMapFromContext(ctx, cfg, { tags: "text" });
  assertTrue(!Array.isArray(asText.tags), "а текстовое свойство списком не становится");

  /* 3. Типы читаются у приватного API, и его отсутствие не мешает. */
  assertEq(JSON.stringify(transform.readVaultPropertyTypes(null)), "{}",
    "без приложения список типов пуст");
  assertEq(JSON.stringify(transform.readVaultPropertyTypes({ metadataTypeManager: {} })), "{}",
    "менеджер без свойств тоже даёт пустой список");
  assertEq(
    JSON.stringify(transform.readVaultPropertyTypes({
      metadataTypeManager: { getAllProperties: () => ({ tags: { name: "tags", type: "tags" } }) },
    })),
    JSON.stringify({ tags: "tags" }),
    "а с менеджером тип свойства читается");
  console.log("  ok B21: тип свойства из хранилища сильнее догадки, значение остаётся строкой");
}

runVaultPropertyTypesSuite();

console.log("Transform feature regression tests: OK");
