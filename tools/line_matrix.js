"use strict";

/**
 * Полный обход поведения строки: каждый Field, обеими дорогами, на нескольких
 * исходных строках.
 *
 * **Зачем.** Заказчик 2026-09-12: «ты уже столько это поведение строки
 * дорабатываешь, что уже неприемлемо такие ошибки иметь; полностью
 * проанализируй поведение строки». Разбор по одному случаю этого не даёт: у
 * каждого замечания свой Field, свой Block и своя исходная строка, а расходятся
 * они там, где сходятся правила. Обход спрашивает **все** сочетания сразу и
 * печатает по каждому:
 *
 *   - что написала команда поля;
 *   - что написала панель;
 *   - совпало ли, и держится ли на получившейся строке **неподвижность**:
 *     разобрать её и собрать заново обязано дать ту же строку.
 *
 * Неподвижность — не украшение. Доводки строки устроены как «разобрать —
 * поправить — собрать», и зовутся по нескольку раз подряд. Строка, которая
 * после разбора и сборки меняется, растёт с каждым кругом: так панель
 * дописывала по разделителю за круг.
 *
 * Запуск (из `repo/`):
 *   node tools/line_matrix.js            — только расхождения
 *   node tools/line_matrix.js --all      — все сочетания
 *
 * Конфиг — тот же, что у `tools/line_bench.js`.
 */

const path = require("path");
const bench = require(path.join(__dirname, "line_bench.js"));

const ROOT = path.resolve(__dirname, "..");
const linePipeline = require(path.join(ROOT, "src", "core", "line_pipeline.js"));
const rulesShape = require(path.join(ROOT, "src", "core", "pkm_rules_shape.js"));
const shared = require(path.join(ROOT, "src", "core", "shared_utils.js"));

const SHOW_ALL = process.argv.includes("--all");

const MARK_DUE = "📅";

/*
 * Исходные строки: пустая, с текстом человека, с чужим значением и текстом.
 *
 * **Четвёртая — без знака списка, и она куплена замечанием.** Первые три все
 * начинались с `- `, и на них расхождения не видно: разбор разводит текст
 * человека и зону значений **только у строк со знаком списка**. А человек
 * начинает с пустой строки, печатает слово и жмёт команду — знака списка на
 * ней ещё нет, его ставит сам плагин. Обход, у которого все примеры с одним и
 * тем же началом, слеп ровно так же, как фикстура с двумя согласными сторонами
 * (У-147).
 */
/*
 * **Пятая — заголовок, и она куплена его словом «чини» 2026-09-13.** Все
 * четыре прежние начинались либо со знака списка, либо ни с чего, и на них не
 * видно целого класса: знак заголовка — чужая разметка, и наше правило «что
 * такое тег» (`#` плюс непробел) ложится на `##` целиком. Одна решётка под
 * правило не подходит, две и больше — подходят, поэтому `# текст` вела себя
 * верно, а `## текст` получала разделитель при пустой зоне значений.
 */
const CASES = [
  { name: "пустая", line: "", ch: 0 },
  { name: "с текстом", line: "- текст", ch: 7 },
  { name: "с текстом в слоте", line: "- #work || текст", ch: 16 },
  { name: "текст без знака списка", line: "1231", ch: 4 },
  { name: "заголовок", line: "## текст", ch: 8 },
  /*
   * **Шестая — текст из двух цифр, и она куплена его словом 2026-09-13:**
   * «была строка `- 12`, после активации Due получил `-  :: 📅… 12`». Все
   * прежние примеры текста были словами, и на них не видно целого класса:
   * «чем бывает хвост значения» было написано рукописным образцом, и две
   * цифры под него подходили — текст человека уезжал в зону значений
   * (У-147: примеры совпадали в том, что проверка не проверяла).
   */
  { name: "текст из двух цифр", line: "- 12", ch: 4 },
  /*
   * **Седьмая и восьмая — со знаком задачи, и куплены его словом 2026-09-13:**
   * «при активации command importance next исходный префикс строки изменился
   * с чекбокса на буллит». Все шесть прежних начинались без чекбокса — то
   * есть предмета правила «исходный префикс переживает действие» в обходе не
   * было вовсе, и правило проверялось на строках, где проверять нечего
   * (У-113). Две, а не одна: на строке с текстом чекбокс переживал действие и
   * до починки, а пропадал он ровно там, где текста нет, — разница между
   * случаями и есть граница дефекта (У-164).
   */
  { name: "знак задачи без текста", line: "- [ ] ", ch: 6 },
  { name: "знак задачи с текстом", line: "- [ ] текст", ch: 11 },
  /*
   * **Девятая — со звёздочкой вместо дефиса** (10.13.106). Все восемь прежних
   * начинались с дефиса или ни с чего, а знаков списка у платформы пять.
   * На дефисе дефект был не виден вовсе: перестановка значений по Order
   * спрашивала именно его (У-147: примеры совпадали в том, что не проверялось).
   */
  { name: "звёздочка вместо дефиса", line: "* текст", ch: 7 },
];

/*
 * Правила для разбора собираются **той же функцией**, что и у движков.
 *
 * Своя сборка «разделители плюс список меток» здесь стояла и врала: без формы
 * Fields разбор не считает значение элемента значением Field, и обход объявил
 * сломанными заведомо здоровые строки вида `- 📅… || ` (У-119).
 */
function rulesOf(cfg) {
  return rulesShape.buildRulesForEngines(cfg);
}

/**
 * Неподвижность строки: разобрать и собрать заново обязано дать её же.
 *
 * Спрашивается у тех самых функций, которыми это делают движки, — своей копии
 * разбора здесь нет.
 */
function fixpointOf(line, rules) {
  const seg = linePipeline.splitSegments(line, rules);
  const again = linePipeline.buildFromSegments(seg, rules);
  return { stable: again === line, again, seg };
}

/*
 * Положительный контроль меры, и ставится он **до** первого вывода (У-119):
 * заведомо верные строки обязаны быть неподвижными. Первая версия сверяла
 * разбор с `joinLineParts` напрямую — а тот ждёт признак «слева есть значения»,
 * который считает не он, — и объявила сломанными все сочетания, включая
 * здоровые. Вторая собирала правила сама и соврала на элементах.
 */
function selfCheck(rules, cfg) {
  /*
   * **Разделители берутся из его конфига, а не пишутся рядом литералом.**
   *
   * Здесь стояли `||` и `::` прямо в строках, и 2026-09-13 заказчик сменил
   * первый разделитель на `::` — стенд умер целиком: собственный контроль
   * объявил сломанными все пять заведомо здоровых строк, и обход не доходил до
   * первого сочетания. То есть стенд, названный в промпте сессии как один из
   * тех, без которых будешь угадывать, молча перестал работать от **настройки
   * человека** (У-147: совпадающей стороной было моё предположение о его
   * конфиге).
   */
  const sep1 = String(shared.readCfgPath(cfg, "pkm.lineFormat.separator1") || "::");
  const sep2 = String(shared.readCfgPath(cfg, "pkm.lineFormat.separator2") || "::");
  const known = [
    "- #work " + sep1 + " текст",
    "- [ ] #todo " + sep1 + " ",
    "- текст",
    "- " + MARK_DUE + "2026-01-02 03:04 " + sep1 + " ",
    "- #work " + sep1 + " текст " + sep2 + " " + MARK_DUE + "2026-01-02 03:04",
  ];
  const bad = known.filter((line) => !fixpointOf(line, rules).stable);
  if (bad.length) {
    throw new Error(
      "мера сломана: заведомо верные строки объявлены не своими:\n  "
      + bad.map((l) => JSON.stringify(l) + " -> " + JSON.stringify(fixpointOf(l, rules).again)).join("\n  ")
    );
  }
}

async function main() {
  const cfg = bench.loadCfg();
  const rules = rulesOf(cfg);
  selfCheck(rules, cfg);

  const order = cfg.pkm.fields.order;
  const defs = bench.defsFor(cfg);

  const sideOf = (key) => ((order.right || []).indexOf(key) !== -1 ? "right" : "left");
  const fieldKeys = [].concat(order.left || [], order.right || []);

  /*
   * Сколько нажатий вправо доводит панель до нужного Field — спрашивается у
   * самой сессии, а не считается по Order.
   *
   * **Порядок панели — это не порядок Order**, и первая версия обхода считала
   * шаги по Order: панель вставала на чужое поле, и обход печатал расхождение
   * там, где сравнивал разные Fields (У-119). Заодно этим же обходом находится
   * Field, которого в панели нет вовсе.
   */
  const walkCache = {};
  const stepsTo = async (key, side, line, ch) => {
    const cacheKey = side + "|" + line;
    if (!walkCache[cacheKey]) walkCache[cacheKey] = await bench.fieldWalk(cfg, side, line, ch, 12);
    const at = walkCache[cacheKey].indexOf(key);
    return at === -1 ? null : at;
  };

  /*
   * У Field со случайным значением две дороги не обязаны дать одну строку:
   * значение на то и случайное. Сравнивается форма — значение закрывается
   * многоточием, и закрывается **у обеих** сторон одинаково. Признак берётся из
   * настроек (`increment.mode === "command"`), а не из вида значения: по виду
   * случайное от неслучайного не отличить.
   */
  const elementCfg = (cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.elements
    && cfg.pkm.fields.elements.byField) || {};
  const isRandom = (key) => {
    const row = elementCfg[key] || {};
    const inc = row.increment || {};
    return String(inc.mode || "") === "command";
  };
  const maskFrom = (line, key) => {
    const marker = String((elementCfg[key] || {}).emoji || "").trim();
    if (!marker) return line;
    const at = String(line).indexOf(marker);
    return at === -1 ? line : String(line).slice(0, at + marker.length) + "…";
  };

  const nameOf = (key) => String((order.labels || {})[key] || key);
  /* Ключ поля в идентификатор команды переводит общий помощник: своя копия
     этого правила стояла и здесь, и в стенде отмены, и вторая из них умерла от
     переименования поля (У-32). */
  const defFor = (key) => {
    const want = bench.fieldCommandId(cfg, key, "next");
    return defs.filter((d) => d.id === want)[0] || null;
  };

  const rows = [];
  for (const key of fieldKeys) {
    const def = defFor(key);
    for (const c of CASES) {
      const byCmd = def ? await bench.runCommandById(cfg, def.id, c.line, c.ch) : null;
      const steps = await stepsTo(key, sideOf(key), c.line, c.ch);
      let byPanel = null;
      if (steps !== null) {
        const keys = [];
        for (let i = 0; i < steps; i++) keys.push("ArrowRight");
        keys.push("ArrowUp");
        byPanel = await bench.runTagWheel(cfg, sideOf(key), c.line, c.ch, keys);
      }
      rows.push({
        field: nameOf(key),
        side: sideOf(key),
        source: c.name,
        random: isRandom(key),
        cmdShown: byCmd ? maskFrom(byCmd.line, key) : "",
        panelShown: byPanel ? maskFrom(byPanel.line, key) : "",
        source_line: c.line,
        cmd: byCmd ? byCmd.line : "(команды нет)",
        panel: byPanel ? byPanel.line : "(этого Field в панели нет)",
        inPanel: steps !== null,
        opened: byPanel ? byPanel.opened : false,
      });
    }
  }

  let bad = 0;
  for (const r of rows) {
    /*
     * Field с предусловием — согласие, а не расхождение: панель его не
     * показывает, пока условие не выполнено, и команда обязана отказаться тем
     * же местом (Н21). Признак отказа — строка осталась прежней.
     */
    const bothRefused = !r.inPanel && r.cmd === r.source_line;
    const same = bothRefused
      || (r.random ? (r.cmdShown === r.panelShown) : (r.cmd === r.panel));
    const fCmd = fixpointOf(r.cmd, rules);
    const fPanel = fixpointOf(r.panel, rules);
    /* Неподвижность спрашивается у строки, которую написал плагин. Строка, до
       которой он не дотронулся, — это текст человека, и переписывать его он не
       обязан. */
    const wrote = r.cmd !== r.source_line;
    const ok = bothRefused
      ? true
      : (same && (!wrote || fCmd.stable) && fPanel.stable && r.opened && r.inPanel);
    if (ok && !SHOW_ALL) continue;
    if (!ok) bad++;
    console.log((ok ? "ok  " : "РАЗОШЛОСЬ ") + r.field + " (" + r.side + "), строка " + r.source);
    console.log("    команда : " + JSON.stringify(r.cmd)
      + (r.random ? "   (значение случайное, сверяется форма: " + JSON.stringify(r.cmdShown) + ")" : ""));
    console.log("    панель  : " + JSON.stringify(r.panel)
      + (r.random && r.inPanel ? "   (форма: " + JSON.stringify(r.panelShown) + ")" : ""));
    if (!r.inPanel) console.log("    этого Field панель не показывает вовсе"
      + (r.cmd === r.source_line ? ", и команда отказалась так же" : ", а команда его всё равно поставила"));
    else if (!r.opened) console.log("    панель не открылась — сверять не с чем");
    if (wrote && !fCmd.stable) console.log("    неподвижность команды: пересборка даёт " + JSON.stringify(fCmd.again));
    if (!fPanel.stable) console.log("    неподвижность панели: пересборка даёт " + JSON.stringify(fPanel.again));
  }

  console.log("");
  console.log("сочетаний " + rows.length + ", расходится " + bad);
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
