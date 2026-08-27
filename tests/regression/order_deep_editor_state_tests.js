"use strict";
/*
 * Поведение состояния редактора Fields, снятое тестом ДО переноса (PRD фаза
 * 3b, пункт 1). Смысл этого файла не в покрытии, а в том, чтобы перенос
 * редактора «без изменения логики» (Ф12–Ф16) можно было проверить, а не
 * обещать: те же самые проверки должны пройти после переноса без единой
 * правки.
 *
 * Самая ценная проверка здесь — круговой обход: дерево, собранное из полей,
 * применённое обратно и собранное снова, обязано совпасть само с собой. Она
 * ловит то, чего не ловят точечные проверки: тихую потерю подзначения,
 * порядка, режима префикса.
 *
 * Чего здесь нет и почему: диалог конфликта и удаление Field живут не в этом
 * модуле, а в рендерере (`settings_sections_renderer.js`), и снимаются
 * отдельно — на заглушке DOM, вместе с переносом самого редактора. Здесь
 * закреплено состояние: токены, дерево, черновики, история, разбор
 * wikilink-строк.
 */
const path = require("path");
const mod = require(path.join(__dirname, "..", "..", "src", "core", "order_deep_editor_state.js"));

let failures = 0;
function assertEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return;
  console.log(`  FAIL ${name}\n       ожидалось ${e}\n       получено ${a}`);
  failures += 1;
}
function assertTrue(v, name) {
  if (v) return;
  console.log(`  FAIL ${name}`);
  failures += 1;
}

/* ---- токены ---------------------------------------------------------- */
{
  assertEq(mod.normalizeToken("abc", "tag"), "#abc", "тег получает решётку");
  assertEq(mod.normalizeToken("#abc", "tag"), "#abc", "решётка не удваивается");
  assertEq(mod.normalizeToken("  abc  ", "tag"), "#abc", "пробелы по краям снимаются");
  assertEq(mod.normalizeToken("", "tag"), "", "пустой токен остаётся пустым");
  assertEq(mod.normalizeToken("abc", "wikilink"), "[[abc]]", "wikilink получает скобки");
  assertEq(mod.normalizeToken("[[abc]]", "wikilink"), "[[abc]]", "скобки не удваиваются");
  assertEq(mod.normalizeToken("[[abc", "wikilink"), "[[abc]]", "недописанные скобки дописываются");
  assertEq(mod.normalizeToken("Entity Beta", "wikilink"), "[[Entity Beta]]", "пробел внутри wikilink сохраняется");

  assertEq(mod.normalizeCheckboxToken("- [I]"), "[I]", "маркер списка перед чекбоксом снимается");
  assertEq(mod.normalizeCheckboxToken("* [x]"), "[x]", "звёздочка тоже снимается");
  assertEq(mod.normalizeCheckboxToken("[]"), "[ ]", "пустой чекбокс приводится к пробелу");
  assertEq(mod.normalizeCheckboxToken("[ ]"), "[ ]", "чекбокс с пробелом остаётся собой");
  assertEq(mod.normalizeCheckboxToken("plain"), "", "не чекбокс — не токен");
  assertEq(mod.normalizeCheckboxToken(""), "", "пусто остаётся пустым");
}

/* ---- дерево значений -------------------------------------------------- */
const parentField = {
  prefix: "#",
  values: [
    { token: "p1" },
    { token: "p2" },
    { token: "" },          // пустое значение выпадает
  ],
};
const subField = {
  values: [
    { token: "s1", allowedParentValues: ["p1"] },
    { token: "s2", allowedParentValues: ["p1", "p2"] },
    { token: "s3", allowedParentValues: ["ghost"] },   // родителя нет — значение не показывается
  ],
};
const checkboxByToken = { "#p1": "- [I]", "#s2": "[x]" };

{
  const tree = mod.buildTagTree(parentField, subField, "tag", { checkboxByToken });
  assertEq(tree.length, 2, "в дереве два значения: пустое выпало");
  assertEq(tree.map((n) => n.token), ["#p1", "#p2"], "порядок значений сохранён");
  assertEq(tree[0].children.map((c) => c.token), ["#s1", "#s2"], "подзначения родителя p1");
  assertEq(tree[1].children.map((c) => c.token), ["#s2"], "одно подзначение может висеть на двух родителях");

  assertEq(tree[0].prefixMode, "checkbox", "родитель с чекбоксом получает режим checkbox");
  assertEq(tree[0].checkboxToken, "[I]", "и сам чекбокс, уже без маркера списка");
  assertEq(tree[1].prefixMode, "bullet", "родитель без чекбокса остаётся на маркере");
  assertEq(tree[0].children[1].prefixMode, "checkbox", "режим подзначения тоже гидрируется");
  assertEq(tree[0].children[0].checkboxToken, "", "подзначение без чекбокса — пустая строка");
  assertEq(tree[0].prefix, "#", "префикс родителя берётся из Field");

  const orphanTokens = tree.flatMap((n) => n.children.map((c) => c.token));
  assertTrue(!orphanTokens.includes("#s3"), "подзначение неизвестного родителя не показывается");
}

/* ---- круговой обход: собрать, применить, собрать снова ---------------- */
{
  const first = mod.buildTagTree(parentField, subField, "tag", { checkboxByToken });
  const applied = mod.applyTagTreeToFields(first, parentField, subField, "tag");
  const second = mod.buildTagTree(applied.parentField, applied.subField, "tag", {
    checkboxByToken: applied.checkboxByToken,
  });

  assertEq(second, first, "круговой обход не меняет дерево");
  assertEq(applied.checkboxByToken, { "#p1": "[I]", "#s2": "[x]" },
    "карта чекбоксов собирается обратно нормализованной");
  assertEq(applied.parentField.values.map((v) => v.token), ["#p1", "#p2"],
    "значения родителя записываются нормализованными");
  assertEq(applied.parentField.values[0].subtags, ["#s1", "#s2"],
    "подзначения записываются в значение родителя");
  assertTrue(applied.parentField.values.every((v) => v.active === true),
    "применение включает значения");
  assertEq(applied.subField.values.find((v) => v.token === "#s2").allowedParentValues,
    ["#p1", "#p2"], "подзначение помнит оба родителя");
  assertEq(applied.parentField.prefix, "#", "остальные поля Field не теряются");

  /* удаление значения из дерева уносит его подзначения из subField */
  const cut = mod.applyTagTreeToFields([first[1]], parentField, subField, "tag");
  assertEq(cut.parentField.values.map((v) => v.token), ["#p2"], "удалённое значение не возвращается");
  assertEq(cut.subField.values.map((v) => v.token), ["#s2"],
    "подзначение остаётся, только если у него остался родитель");
  assertTrue(!Object.prototype.hasOwnProperty.call(cut.checkboxByToken, "#p1"),
    "чекбокс удалённого значения тоже уходит");
}

/* ---- черновик -------------------------------------------------------- */
{
  const ok = mod.validateDraft({
    rows: [
      { key: "status", kind: "tag" },
      { key: "project", kind: "wikilink" },
      { key: "due", kind: "element", emoji: "\u{1F4C5}", format: "YYYY-MM-DD", behaviorMode: "command", command: "now" },
      { key: "est", kind: "element", emoji: "\u{23F1}", format: "HH:mm", behaviorMode: "increment", incrementBy: 15 },
      { key: "cyc", kind: "element", emoji: "\u{1F501}", format: "x", behaviorMode: "custom", customRaw: ["a", "b"] },
    ],
  });
  assertTrue(ok.ok === true, "правильный черновик принимается");
  assertEq(ok.errors, [], "и не приносит ошибок");

  const bad = mod.validateDraft({
    rows: [
      { key: "", kind: "tag" },
      { key: "dup", kind: "tag" },
      { key: "dup", kind: "tag" },
      { key: "weird", kind: "spaceship" },
      { key: "e1", kind: "element", behaviorMode: "increment", incrementBy: "много" },
      { key: "e2", kind: "element", emoji: "x", format: "f", behaviorMode: "command", command: "tomorrow" },
      { key: "e3", kind: "element", emoji: "x", format: "f", behaviorMode: "custom", customRaw: ["  "] },
      { key: "e4", kind: "element", emoji: "x", format: "f", behaviorMode: "" },
    ],
  });
  assertTrue(bad.ok === false, "черновик с ошибками отклоняется");
  const has = (needle) => bad.errors.some((e) => e.includes(needle));
  assertTrue(has("row[0]: empty key"), "пустой ключ назван с номером строки");
  assertTrue(has("row[2]: duplicate key 'dup'"), "дубль ключа назван вместе с ключом");
  assertTrue(has("row[3]: unsupported kind 'spaceship'"), "неизвестный вид назван");
  assertTrue(has("row[4]: emoji is required"), "элементу нужен значок");
  assertTrue(has("row[4]: format is required"), "и формат");
  assertTrue(has("row[4]: incrementBy must be numeric"), "шаг увеличения обязан быть числом");
  assertTrue(has("row[5]: command must be one of now|randomN|randomE"), "команда только из списка");
  assertTrue(has("row[6]: custom increment list is empty"), "пустой список из пробелов не считается");
  assertTrue(has("row[7]: behavior mode is required"), "режим поведения обязателен");

  assertTrue(mod.validateDraft(null).ok === true, "пустой черновик не ломает разбор");
  assertTrue(mod.validateDraft({ rows: "не массив" }).ok === true, "мусор вместо строк не ломает разбор");
}

/* ---- история --------------------------------------------------------- */
{
  let h = mod.createHistory(4);
  assertEq(h.max, 10, "предел истории не опускается ниже десяти");
  assertEq(mod.createHistory(150).max, 150, "заданный предел выше десяти сохраняется");
  assertEq(mod.createHistory().max, mod.IO_TEMP_HISTORY_LIMIT, "без предела берётся значение модуля");

  /* снимок клонируется: изменение источника не должно менять историю */
  const live = { a: 1 };
  h = mod.pushHistory(h, live);
  live.a = 99;
  const un = mod.undoHistory(h, { a: 2 });
  assertTrue(un.changed === true, "отмена сработала");
  assertEq(un.snapshot.a, 1, "в истории лежит копия, а не ссылка");

  const rd = mod.redoHistory(un.history, { a: 3 });
  assertTrue(rd.changed === true, "повтор сработал");
  assertEq(rd.snapshot.a, 2, "повтор возвращает то, что было до отмены");

  /* новая запись обесценивает повтор */
  const h2 = mod.pushHistory(mod.undoHistory(mod.pushHistory(mod.createHistory(), { a: 1 }), { a: 2 }).history, { a: 5 });
  assertEq(h2.future.length, 0, "запись после отмены очищает будущее");
  assertTrue(mod.redoHistory(h2, { a: 6 }).changed === false, "повторять больше нечего");

  const empty = mod.createHistory();
  assertTrue(mod.undoHistory(empty, { a: 1 }).changed === false, "отменять в пустой истории нечего");
  assertEq(mod.undoHistory(empty, { a: 1 }).snapshot, { a: 1 }, "и текущее состояние остаётся собой");

  /* предел: старые записи вытесняются, новые остаются */
  let deep = mod.createHistory(10);
  for (let i = 0; i < 15; i++) deep = mod.pushHistory(deep, { i });
  assertEq(deep.past.length, 10, "история не растёт выше предела");
  assertEq(deep.past[0], { i: 5 }, "вытесняются самые старые записи");

  const reset = mod.resetHistory(deep);
  assertEq([reset.past.length, reset.future.length], [0, 0], "сброс очищает обе стороны");
}

/* ---- wikilink-строки ------------------------------------------------- */
{
  const rows = [
    { token: "Entity Alpha", parentToken: "p1" },
    { token: "[[Entity Beta]]", parentToken: "ghost" },
    { token: "Entity Alpha", parentToken: "p1" },   // дубль выпадает
    { token: "", parentToken: "p1" },               // пустой выпадает
  ];
  const part = mod.partitionWikilinkRows(rows, ["p1", "#p2"]);
  assertEq(part.linked.length, 1, "с известным родителем — одна строка");
  assertEq(part.linked[0].token, "[[Entity Alpha]]", "токен нормализован");
  assertEq(part.linked[0].parentToken, "#p1", "родитель нормализован");
  assertEq(part.orphans.length, 1, "с неизвестным родителем — одна строка");
  assertEq(part.orphans[0].token, "[[Entity Beta]]", "и её токен сохранён");

  const mixed = [{ token: "[[Alpha]]" }, { token: "[[alpha]]" }];
  assertEq(mod.partitionWikilinkRows(mixed, []).orphans.length, 2,
    "по умолчанию регистр различается");
  assertEq(mod.partitionWikilinkRows(mixed, [], { caseSensitiveIdentity: false }).orphans.length, 1,
    "с выключенным различением регистра второй считается дублем");
}

if (failures) {
  console.log(`\n${failures} problem(s)`);
  process.exit(1);
}
console.log("состояние редактора Fields закреплено до переноса");
