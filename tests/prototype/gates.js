"use strict";
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const src = fs.readFileSync(target, "utf8");
const js = /<script>([\s\S]*?)<\/script>/.exec(src)[1];
const css = /<style>([\s\S]*?)<\/style>/.exec(src)[1];

// evaluate the schema half only: stub the renderers, cut before State
const cut = js.indexOf("/* ============================================================ State */");
/*
 * Рисовалки подделываются **сплошным обходом**, а не по списку имён (У-85).
 * Список был рукописным, и первая же новая рисовалка (`renderSelectAllCustom`,
 * З-3) уронила гейт `ReferenceError`-ом: предмет заводится в прототипе, а
 * перепись о нём не знала.
 */
const stubNames = Array.from(new Set(
  Array.from(js.matchAll(/function (render[A-Za-z0-9_$]*)\s*\(/g), m => m[1])));
if (stubNames.length < 15) {
  console.log("  FAIL обход нашёл рисовалок " + stubNames.length + " — подделывать нечего");
  process.exit(1);
}
const stubs = stubNames.map(n => "function " + n + "(){}").join("\n");

const tmp = path.resolve(path.dirname(path.resolve(target)), "_gate_mod.js");
fs.writeFileSync(tmp,
  stubs + "\n" + js.slice(0, cut) +
  "\nmodule.exports={SCHEMA,TABS,TAB_MODULE};\n", "utf8");

const { SCHEMA, TABS, TAB_MODULE } = require(tmp);
fs.unlinkSync(tmp);

let fail = 0;
const bad = m => { console.log("  FAIL " + m); fail++; };

/* Sentence case, with one exception the owner set: anything InlineOverhaul
   itself defines is a proper noun, so a reader can tell the Bar the plugin
   draws from a bar in general. Obsidian’s words and plain English are not. */
/*
 * `TagWheel` ушло отсюда 2026-09-21 его словом В-166: человек видит
 * `tagWheel`, как и `inlineOverhaul`. Это отменяет строку правил текстов
 * PRD 7 о заглавной — правило перечисляет сущности плагина, а написание
 * одной из них теперь задано им. Прежнее написание не просто разрешено
 * перестало быть: оно запрещено списком `FORBIDDEN` ниже, иначе запрет
 * пережил бы своё основание молча (У-247).
 */
const ENTITIES = ["Field","Fields","Value","Values","Bar","Bars","Prefix","Prefixes",
  "Separator","Separators","Block","Blocks","tagWheel","Binder","Transform","Wheel",
  /* `Stripe` — его слово 2026-09-19 (З-13): полосу за Block рисуем мы, и
     от полосы в общем смысле она отличается так же, как Bar. Прежнее
     значение слова — старое имя Bars, и живёт оно только в `searchTerms`. */
  "Stripe","Stripes"];
/* `Delete` is not here on purpose: `Smart Delete` gets its pass from KEY_NAME
   below, where the key names live. One word, one list. */
/* An abbreviation keeps its capitals in sentence case, and three of these
   are abbreviations rather than proper nouns: YAML, PKM and `IDs`. The
   last one arrived with В-87, answered 2026-09-08: the owner renamed the
   group `Setting ids` to `Options IDs` and its row to `Show option IDs in
   tips`, so the rule has to know that `IDs` is not a Title Case slip. */
const PROPER = new Set(["Obsidian","Markdown","YAML","Ctrl","Cmd","Inline","Dataview",
  "Status","Priority","Strict","Free","Behavior","Position","PKM","IDs","I","Smart","Rules","Level"]);
const CASE_OK = new Set([...ENTITIES, ...PROPER]);

/*
 * Names the owner asked for by name, longer than the five-word rule allows.
 *
 * The rule stays: this is a list of decisions, not a loophole. Each entry
 * carries the date and the question it was settled by, so the next long name
 * is a conversation, not a precedent. Adding one without an answered question
 * is how a rule quietly stops being a rule.
 */
const LONG_NAME_OK = {
  /* В-47, answered 2026-09-05: the owner asked for these exact six words back
     after seeing the five-word version. */
  "in-line-boundary": "What to do at the end",
  /* PRD 10.13.260, his item of 2026-09-24: «нужно добавить отдельный контрол
     `Switch custom blocks on Tab`». His exact words, capital after
     the dash included, so the sentence-case rule steps aside for it too. */
  "wheel-custom-tab": "Switch custom blocks on Tab",
};

/* A key combination, quoted or bare: 'Ctrl+A', Cmd + A, Shift+Tab. */
const HOTKEY = /^['"]?(?:Ctrl|Cmd|Alt|Shift|Meta)(?:\s*\+\s*[A-Za-z0-9]+)+['"]?$/;

/* A single key carries its own name for the same reason a combination does:
   `Backspace` is what is printed on the key, not an English word. The list is
   closed on purpose, so a capitalised ordinary word still fails the rule. */
const KEY_NAME = /^['"]?(?:Backspace|Delete|Enter|Escape|Tab|Home|End)['"]?$/;

/* The same rule read backwards: an entity written in lower case is the bug
   this convention exists to prevent, so catch it too. */
const LOWER = /(?<![A-Za-z#\/-])(fields?|values?|bars?|prefix(?:es)?|separators?|tagwheel|stripes?)(?![A-Za-z-])/g;
const FORBIDDEN = ["inlineOverhaul_", "Command ID", "debounce", "undo stack", "runtime", "backend",
  "sprint", "status_tags", ".js", "free roam", " zone", "Segment", "Marker priority",
  /* `band` — прежнее слово для полосы Block, снятое его переименованием
     2026-09-19 (З-13). Запрет держит второе слово от возврата: на экране у
     одной вещи одно имя, а не два в разных текстах. */
  "band",
  /* `TagWheel` — прежнее написание, снятое его словом В-166 (2026-09-21).
     Ровно то же, что с `band`: на экране у одной вещи одно написание. */
  "TagWheel",
  /* `Open TagWheel on the` — прежнее имя пары команд, снятое тем же словом
     (В-166): человек ищет в палитре `tagWheel Left` и `tagWheel Right`. */
  "Open TagWheel on the"];
const outsideCode = t => t.replace(/<code>[\s\S]*?<\/code>/g, "");
const lowerEntities = t => [...new Set((outsideCode(t).match(LOWER) || []))];

/*
 * **Контроль запрета стоит до первого вывода** (У-119, правило 44), и у него
 * две половины. Положительная: запрет обязан краснеть на образце — иначе
 * «запрещённого нет» бывает правдой от того, что искать нечем (У-127).
 * Отрицательные: он обязан молчать на том написании, которым мы пишем
 * сегодня, — запрет по списку строк слепнет ровно наоборот, когда продукт
 * передумал (У-247, правило 170). Образцы взяты из живых текстов панели.
 */
{
  const hits = t => FORBIDDEN.filter(f => String(t).includes(f));
  if (!hits("строка про TagWheel внутри").length) {
    bad("контроль запрета: прежнее написание `TagWheel` проходит мимо");
  }
  for (const live of ["tagWheel Value names", "tagWheel Left", "Highlight the tagWheel line"]) {
    if (hits(live).length) bad("контроль запрета: он цепляет нынешний текст «" + live + "»");
  }
}


/* Two definitions of the same function is worse than none: the file parses,
   the gate passes, and the later one silently wins. */
{
  const seen = {};
  const re = /^function ([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(js))) {
    const line = js.slice(0, m.index).split("\n").length;
    (seen[m[1]] = seen[m[1]] || []).push(line);
  }
  for (const [name, lines] of Object.entries(seen)) {
    if (lines.length > 1) bad(name + " is defined " + lines.length + " times, at lines " + lines.join(", "));
  }
}

/* The renderers are stubbed above so the schema can be evaluated, which means
   a deleted renderer would pass unnoticed. Check each one really exists. */
for (const name of js.match(/render:\s*([A-Za-z0-9_]+)/g) || []) {
  const fn = name.replace(/render:\s*/, "");
  if (!new RegExp("function\\s+" + fn + "\\s*\\(").test(js)) {
    bad("schema points at render: " + fn + ", which is not defined in the file");
  }
}
/* Same for every other bare call the renderers rely on. */
for (const fn of ["moveIn", "sortableList", "hotkeyCell", "commentAffordance", "helpButton",
                  "fieldValue", "structuralLine", "fieldChip", "bubble", "applyTagVars",
                  "valuesTable", "elementRows", "placementRows", "renderDialog", "renderExport"]) {
  if (new RegExp("[^A-Za-z0-9_]" + fn + "\\s*\\(").test(js) &&
      !new RegExp("function\\s+" + fn + "\\s*\\(").test(js)) {
    bad(fn + " is called but never defined");
  }
}

/* `folder` — контрол Obsidian 1.13: поле ввода с подсказчиком папок vault.
   Появился по замечанию 1.6.2.3 вместо простого текстового поля.

   `note` — строка-подпись без контрола: имя, описание и подсказка. Появилась
   по замечаниям B13 и B18 (2026-09-02), чтобы назвать список флажков
   `Fields to keep`, который начинался сразу под предыдущей строкой. У
   платформы для этого есть своя форма — `SettingDefinitionEmpty`. */
const KINDS = new Set(["toggle","dropdown","slider","number","text","textarea","color","folder","buttons","custom","note"]);
const ids = new Set();
for (const g of SCHEMA) {
  if (ids.has(g.id)) bad("duplicate group id " + g.id); else ids.add(g.id);
  for (const it of g.items) {
    if (ids.has(it.id)) bad("duplicate id " + it.id); else ids.add(it.id);
    if (!KINDS.has(it.kind)) bad(it.id + " unknown kind " + it.kind);
  }
}
const tabIds = new Set(TABS.map(t => t.id));
for (const g of SCHEMA) if (!tabIds.has(g.tab)) bad("group " + g.id + " unknown tab " + g.tab);
for (const t of TABS) if (!SCHEMA.some(g => g.tab === t.id)) bad("tab " + t.id + " has no groups");

// Г7: every path has a default, every predicate dep is a real path
const defaults = {};
const setIn = (o, p, v) => {
  const k = p.split("."); let c = o;
  for (let i = 0; i < k.length - 1; i++) c = (c[k[i]] = c[k[i]] || {});
  c[k[k.length - 1]] = v;
};
const getIn = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
for (const g of SCHEMA) for (const it of g.items) if (it.path) setIn(defaults, it.path, it.default);
setIn(defaults, "general.help.showTips", true);
const known = new Set();
for (const g of SCHEMA) for (const it of g.items) if (it.path) known.add(it.path);
/* Config paths a predicate may ask that no row writes; each is written by a
   block of its own. One list for this gate and the settings layer test. */
const WRITTEN_BY_BLOCK = require("../harness/written_by_block.js");
const knownDeps = new Set([...known, ...WRITTEN_BY_BLOCK]);
for (const p of known) if (getIn(defaults, p) === undefined) bad("path has no default: " + p);
const checkPred = (owner, pr) => {
  if (!pr) return;
  if (!Array.isArray(pr.deps) || !pr.deps.length) bad(owner + " predicate has no deps");
  for (const d of pr.deps || []) if (!knownDeps.has(d)) bad(owner + " depends on unknown path " + d);
};
for (const g of SCHEMA) {
  checkPred("group " + g.id, g.visible);
  for (const it of g.items) { checkPred(it.id, it.visible); checkPred(it.id, it.disabled); }
}
for (const [t, p] of Object.entries(TAB_MODULE)) if (!known.has(p)) bad("tab gate " + t + " unknown path " + p);

// seeAlso targets must exist
for (const g of SCHEMA) for (const it of g.items) {
  if (it.seeAlso && !ids.has(it.seeAlso.id)) bad(it.id + " seeAlso points at unknown id " + it.seeAlso.id);
}

/*
 * Строки-субхедеры, собранные обходом объявлений прототипа. Порог рядом:
 * пустой набор означал бы «разделов нет», и предел считался бы по группе
 * целиком — то есть проверка была бы зелёной от того, что искать перестало
 * (У-88).
 */
const SUBHEADER_IDS = new Set(
  Array.from(js.matchAll(/id:"([^"]+)",\s*render:\s*renderSubheader\(/g), m => m[1]));
if (SUBHEADER_IDS.size < 3) {
  bad("обход нашёл субхедеров " + SUBHEADER_IDS.size + " — разделы считать нечем");
}

/*
 * **Подпись субхедера — такой же видимый текст, как заголовок группы.**
 * Куплено переносом `tagWheel opening` из своей группы в субхедер 2026-09-21
 * (его пункт 11): у записи `kind: "custom"` нет ни `name`, ни `tip`, и все
 * запреты Г10 — `TagWheel`, `band`, сущность со строчной — её обходили
 * стороной. Перенос текста под субхедер выносил его из-под сторожа молча,
 * то есть у лекарства была своя цена (У-166, правило 87).
 *
 * Текст берётся из **аргументов вызова** тем же образцом, каким его читает
 * `gen_schema.js`: у самой записи схемы признака не остаётся, спрашивать надо
 * исходник. Порог рядом — ноль разобранных подписей значит «искать перестало».
 */
{
  const calls = Array.from(
    js.matchAll(/render:\s*renderSubheader\(((?:[^()"]|"(?:[^"\\]|\\.)*")*)\)/g), m => m[1]);
  let parsed = 0;
  for (const args of calls) {
    for (const lit of args.match(/"(?:[^"\\]|\\.)*"/g) || []) {
      let text;
      try { text = JSON.parse(lit); } catch { continue; }
      parsed += 1;
      for (const f of FORBIDDEN) {
        if (text.includes(f)) bad("текст субхедера содержит " + f + ": " + text.slice(0, 60));
      }
      const low = lowerEntities(text);
      if (low.length) bad("текст субхедера оставляет сущность со строчной: " + low.join(", "));
    }
  }
  if (parsed < SUBHEADER_IDS.size) {
    bad("разобрано подписей субхедеров " + parsed + " при " + SUBHEADER_IDS.size + " субхедерах");
  }
}

/*
 * Приписка, которая сама ранжирует вариант списка. Предмет — **скобка**, а не
 * слово: имя режима `Standard` законно, `(standard)` рядом с подписью — вторая
 * приписка к той, что панель ставит сама.
 */
const RANKING_ASIDE =
  /\([^)]*\b(?:recommend(?:ed)?|preferred|suggested|advised|standard|usual|normal|best)\b[^)]*\)/i;
{
  /* Положительные — то, ради чего запрет заведён; отрицательные — подписи,
     которые он путать не должен: пример значения, уточнение и имя режима. */
  const should = ["End of your text (recommended)", "Both ways (preferred)", "Keep it (standard)"];
  const shouldNot = ["Separate tags (#doing #review)", "Only custom name", "No (plain text)",
                     "Standard", "Normal weight", "Best of both"];
  for (const s of should) {
    if (!RANKING_ASIDE.test(s)) bad("контроль запрета приписки: не нашёл в " + JSON.stringify(s));
  }
  for (const s of shouldNot) {
    if (RANKING_ASIDE.test(s)) bad("контроль запрета приписки: нашёл лишнее в " + JSON.stringify(s));
  }
}

// Г11 group size, Г12 every group has an intro
for (const g of SCHEMA) {
  /*
   * Текст группы проверяется тем же запретом, что и текст строки, и куплено
   * это переименованием полосы (З-13, 2026-09-19): пять имён я поменял по
   * списку, а групповая подсказка называла тумблер прежним именем и полосу
   * прежним словом — то есть список был признаком, написанным по образцу
   * (У-201). Нашлось это Приложением B, которое печатает текст целиком, а не
   * проверкой. Теперь у обоих текстов группы запрет тот же.
   */
  for (const [what, text] of [["intro", g.intro], ["tip", g.tip]]) {
    if (!text) continue;
    const low = lowerEntities(text);
    if (low.length) {
      bad("group " + g.id + " " + what + " leaves an entity in lower case: " + low.join(", "));
    }
    for (const f of FORBIDDEN) {
      if (text.includes(f)) bad("group " + g.id + " " + what + " contains: " + f);
    }
  }
  /*
   * **Заголовок группы — такой же видимый текст, как её вводный абзац.**
   * Куплено это переименованием `TagWheel` → `tagWheel` (В-166, 2026-09-21):
   * запрет стоял на `desc`, `tip` и текстах группы, а заголовок `TagWheel`
   * человек читает первым. Переименование по списку пропускает место, где
   * предмет не назван контролом (У-229, правило 151).
   */
  for (const f of FORBIDDEN) {
    if (String(g.heading || "").includes(f)) bad("group " + g.id + " heading contains: " + f);
  }
  /*
   * Г11 считает настройки **в разделе**, а не в группе целиком, и раздел
   * начинается с субхедера. Предел куплен читаемостью: двенадцать строк
   * подряд под одной подписью человек уже не охватывает глазом. Подпись
   * внутри группы делит их ровно так же, как делит заголовок — ради этого
   * субхедеры и заведены, — и заказчик выбрал именно её 2026-09-17:
   * «я хочу, чтобы все настройки tagwheel были в одном месте. Может быть не
   * создавать отдельную группу, а сделать суб-группу (субхедер)».
   *
   * Субхедер узнаётся по **объявлению в прототипе**, а не по имени строки:
   * имя пишет человек, а объявление ставит схема (У-201). Рисовалки здесь
   * подделаны пустыми функциями, и фабрика субхедера возвращает `undefined` —
   * то есть у самой записи признака не остаётся, спрашивать надо исходник.
   */
  let section = 0;
  for (const it of g.items) {
    if (it.kind === "custom") {
      if (SUBHEADER_IDS.has(String(it.id || ""))) section = 0;
      continue;
    }
    section += 1;
    if (section > 12) bad("group " + g.id + " has " + section + " settings in one section");
  }
  if (!g.intro && !/-intro$/.test(g.id)) bad("group " + g.id + " has no intro");
}

// Г10 copy lint
let total = 0, custom = 0, tips = 0, described = 0;
const perTab = {};
for (const g of SCHEMA) for (const it of g.items) {
  if (it.kind === "custom") { custom++; continue; }
  total++; perTab[g.tab] = (perTab[g.tab] || 0) + 1;
  const words = it.name.split(" ");
  if (words.length > 5 && LONG_NAME_OK[it.id] !== it.name) {
    bad(it.id + " name over 5 words: " + it.name);
  }
  /* `Left Block` and `Right Block` are entities in their own right (Ct10),
     so the pair keeps its capitals. Only as a pair: a bare `Left` in a name
     is still the sentence case bug this check is here to find. */
  /* A name the owner gave word for word is his decision on case as well. */
  if (LONG_NAME_OK[it.id] !== it.name) it.name.replace(/(Left|Right) Block/g, "block block").split(" ").slice(1).forEach(w => {
    /* A key name is not an English word: 'Ctrl+A' has to keep its capitals,
       and a name cannot carry <code>, so the owner writes it in quotes.
       Stripping the punctuation first turned it into CtrlA and the sentence
       case rule flagged it. */
    if (HOTKEY.test(w) || KEY_NAME.test(w)) return;
    const c = w.replace(/[^A-Za-z]/g, "");
    if (c && c[0] === c[0].toUpperCase() && c[0] !== c[0].toLowerCase() && !CASE_OK.has(c)) {
      bad(it.id + " name not sentence case: " + it.name);
    }
  });
  /* Имя строки — то, что человек читает раньше описания; запрет тот же. */
  for (const f of FORBIDDEN) if (it.name && it.name.includes(f)) bad(it.id + " name contains: " + f);
  if (it.desc) {
    described++;
    if (it.desc.length > 140) bad(it.id + " desc " + it.desc.length + " chars");
    /* the owner's rule: a visible string does not end in a full stop */
    if (/\.$/.test(it.desc)) bad(it.id + " desc ends in a full stop: " + it.desc.slice(-40));
    for (const f of FORBIDDEN) if (it.desc.includes(f)) bad(it.id + " desc contains: " + f);
    const lowDesc = lowerEntities(it.desc);
    if (lowDesc.length) bad(it.id + " desc leaves an entity in lower case: " + lowDesc.join(", "));
    if (it.desc.toLowerCase() === it.name.toLowerCase()) bad(it.id + " desc repeats name");
  }
  /*
   * A row with no tip is not a row without an explanation: the tipbox opens
   * anyway, because the id line lives in it, and the owner gets a panel that
   * answers his question with `bars-active`. He wrote exactly that on
   * 2026-09-07 and named four rows; a sweep found eighteen (У-85).
   */
  if (!it.tip) bad(it.id + " has no tip: its tipbox would show the id and nothing else");
  if (it.tip) {
    tips++;
    for (const f of FORBIDDEN) if (it.tip.includes(f)) bad(it.id + " tip contains: " + f);
    const lowTip = lowerEntities(it.tip);
    if (lowTip.length) bad(it.id + " tip leaves an entity in lower case: " + lowTip.join(", "));
  }
  if (it.options) it.options.forEach(o => {
    if (/_/.test(o.label)) bad(it.id + " option label has an underscore: " + o.label);
    /*
     * На вопрос «какой из вариантов стандартный» отвечает сама панель —
     * припиской `(default)` у того значения, что стоит умолчанием в схеме.
     * Подпись, отвечающая на него второй раз, читается подряд с ней: у
     * `cursor-policy` человек видел `End of your text (recommended) (default)`
     * и написал об этом 2026-09-21, пункт 10.
     *
     * Запрет по **скобочной** форме, а не по слову: `Standard` именем режима
     * законно, `(standard)` рядом с подписью — та же приписка другими буквами.
     * Ширина померена до того, как признак стал сторожем (У-204, правило 125):
     * на 187 подписях прототипа слово `recommended`, любое ранжирующее слово и
     * эта форма нашли **одно и то же** место, и отрицательные контроли ниже
     * стоят на подписях, которые он путать не должен.
     */
    if (RANKING_ASIDE.test(o.label)) {
      bad(it.id + " option label ranks itself; the panel already marks the default: " + o.label);
    }
  });
}

/* Appending a new rule instead of editing the old one is how a stylesheet
   ends up with four blocks fighting over one class. Two is a warning sign,
   three is a bug waiting to surface. */
{
  const counts = {};
  /* a responsive override inside @media is deliberate, not accretion, so
     those blocks come out before counting */
  const flat = css.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, "");
  for (const m of flat.matchAll(/^\s*(\.[a-zA-Z0-9_-]+(?:::?[a-zA-Z-]+)?)\s*(?:,|\{)/gm)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  for (const [sel, n] of Object.entries(counts)) {
    if (n > 2) bad("the selector " + sel + " is declared " + n + " times; collapse it into one rule");
  }
}

// Г1-Г5 on the stylesheet and the script
const styleAssignments = (js.match(/\.style\.setProperty/g) || []).length;
// only setProperty is allowed; anything else is a direct style write
const otherStyle = (js.match(/\.style\.(?!setProperty)[a-zA-Z]/g) || []).length;
if (otherStyle > 0) bad("script sets " + otherStyle + " style properties directly (only setProperty is allowed)");
const hexInJs = (js.match(/#[0-9a-fA-F]{6}\b/g) || []);
const hexAllowed = 42;   // mock vault colors, the three type colors, and TagWheel defaults
if (hexInJs.length > hexAllowed) bad("script has " + hexInJs.length + " hex colors, over the " + hexAllowed + " mock-data budget");
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(js)) bad("script uses raw HTML insertion");
if (/new Function|eval\(/.test(js)) bad("script evaluates code");
if (/createEl\(["']h[1-6]["']/.test(js)) bad("script creates a raw heading element");
// as a class, not as a mention in a comment
if (/["']mod-cta["']|\.mod-cta\s*[{,]/.test(js + css)) bad("mod-cta is used as a class");
if (/cfg\.ui\./.test(js)) bad("script reads cfg.ui");

console.log("settings: " + total + " (+" + custom + " custom blocks)");
console.log("described: " + described + ", with tips: " + tips);
console.log("groups: " + SCHEMA.length + ", tabs: " + TABS.length);
console.log("per tab: " + JSON.stringify(perTab));
console.log("setProperty calls: " + styleAssignments + ", hex colors in mock data: " + hexInJs.length);
console.log(fail ? ("\n" + fail + " problem(s)") : "\nall gates passed");
process.exit(fail ? 1 : 0);
