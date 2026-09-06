/**
 * Гейты слоя настроек (PRD раздел 12). Запускаются на обвязке из
 * tests/harness, без Obsidian и без браузера.
 *
 * Пока слоя нет, гейт сообщает об этом и выходит с нулём: в фазе 0 нечего
 * проверять. Начиная с фазы 1 отсутствие схемы — это падение, потому что
 * гейт, который молча ничего не проверяет, хуже отсутствующего.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setupGlobals, Setting, PluginSettingTab, makeApp, notices } from "../harness/obsidian_stub.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const SCHEMA_DIR = path.join(root, "src", "ui", "settings", "schema");
const PHASE_FILE = path.join(root, "tests", "gates", "phase.txt");

let failures = 0;
const fail = (m: string) => { console.log("  FAIL " + m); failures++; };
const ok = (m: string) => console.log("  ok   " + m);

/**
 * Текущая фаза работ. Гейты включаются по фазе (12).
 *
 * В файле две строки, и вторая появилась 2026-08-31 не для красоты.
 *
 *   1. подпись фазы, которая идёт сейчас — у неё бывает буква (`3a`, `3b`);
 *   2. список уже закрытых фаз.
 *
 * Почему двух строк мало одной. Фазы закрывались не по порядку номеров:
 * решением заказчика от 2026-08-24 сначала делались вид и паритет панели
 * (3a, 3b, 3c), а миграция конфига — фаза 2 — после них. Порог гейтов при
 * этом обязан помнить **максимум закрытого**, иначе переход к фазе 2 опустил
 * бы порог с трёх до двух и молча выключил бы проверки структуры. А подпись
 * обязана называть то, что идёт сейчас, иначе она врёт: до 2026-08-31 в файле
 * стояло `3b`, хотя 3c была закрыта, а работа шла по фазе 2.
 */
function readPhaseFile(): { label: string; closed: string[] } {
  let text = "";
  try { text = fs.readFileSync(PHASE_FILE, "utf8"); } catch { text = ""; }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const label = lines[0] || "0";
  const closedLine = lines.find(l => l.startsWith("закрыто:")) || "";
  const closed = closedLine.replace(/^закрыто:/, "").split(",").map(x => x.trim()).filter(Boolean);
  return { label, closed };
}

const phaseFile = readPhaseFile();
const phaseLabel = phaseFile.label;
/* Порог — максимум из идущей фазы и всех закрытых. */
const phase = [phaseLabel, ...phaseFile.closed]
  .map(x => parseInt(x, 10) || 0)
  .reduce((a, b) => (b > a ? b : a), 0);
console.log("Гейты слоя настроек, фаза " + phaseLabel
  + (phaseFile.closed.length ? " (закрыто: " + phaseFile.closed.join(", ") + ")" : ""));

setupGlobals();

/* ---- обвязка обязана вести себя как настоящий DOM (фаза 0, пункт 7) ---- */
{
  const { makeNode } = await import("../harness/dom_stub.ts");
  const n = makeNode("div");
  n.createEl("span", { text: "а" });
  n.createEl("span", { text: "б" });
  if (n.textContent !== "аб") fail("чтение textContent не обходит поддерево: " + n.textContent);
  else ok("чтение textContent обходит поддерево");

  n.textContent = "";
  if (n.children.length !== 0) fail("запись textContent не очистила детей: осталось " + n.children.length);
  else ok("запись textContent очищает детей");

  n.style.setProperty("--io-lane", "2");
  if (n.style.getPropertyValue("--io-lane") !== "2") fail("style.setProperty не запоминает значение");
  else ok("style.setProperty запоминает значение");
}

/* ---- ни один исходник не содержит нулевых байтов ----------------------- */
{
  const exts = [".ts", ".js", ".mjs", ".json", ".md", ".css"];
  const skip = ["node_modules", ".git", "dist"];
  const dirty: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      if (skip.includes(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!exts.some(e => name.endsWith(e))) continue;
      if (fs.readFileSync(full).includes(0)) dirty.push(path.relative(root, full));
    }
  };
  walk(root);
  if (dirty.length) fail("нулевые байты в исходниках: " + dirty.join(", "));
  else ok("нулевых байтов в исходниках нет");
}

/* ---- мок Obsidian строит настройку без исключений ---------------------- */
{
  const { makeNode } = await import("../harness/dom_stub.ts");
  const host = makeNode("div");
  let changed: unknown = null;
  const s = new Setting(host).setName("Пример").setDesc("Описание");
  s.addToggle(t => t.setValue(false).onChange(v => { changed = v; }));
  (s.components[0] as any).toggle();
  if (changed !== true) fail("тумблер мока не доводит изменение до обработчика");
  else ok("мок Obsidian: Setting и тумблер работают");

  const tab = new PluginSettingTab(makeApp(), {});
  if (typeof tab.getSettingDefinitions !== "function") fail("в моке нет getSettingDefinitions");
  else if (typeof tab.setControlValue !== "function") fail("в моке нет setControlValue");
  else ok("мок поддерживает декларативный путь 1.13");
}

/* ---- схема: пока её нет, дальше проверять нечего ----------------------- */
if (!fs.existsSync(SCHEMA_DIR)) {
  if (phase >= 1) {
    fail("схемы нет: " + path.relative(root, SCHEMA_DIR) + ", а фаза " + phaseLabel + " её требует");
  } else {
    console.log("  —    схемы ещё нет, проверки структуры и текстов пропущены (фаза 0)");
  }
  console.log(failures ? "\n" + failures + " problem(s)" : "\nвсе гейты фазы " + phaseLabel + " прошли");
  process.exit(failures ? 1 : 0);
}

/* Начиная с фазы 1 здесь подключается схема и запускаются гейты
   Г6, Г7, Г10, Г11, Г12, Г17-Г23 — теми же проверками, что уже
   работают на прототипе в tests/prototype/gates.js. */
const { SCHEMA, TABS } = await import(pathToFileURL(path.join(SCHEMA_DIR, "index.ts")).href);
if (!Array.isArray(SCHEMA) || !SCHEMA.length) fail("схема пуста");
else ok("схема загружена: групп " + SCHEMA.length);

/* ---- ширина редактора Fields: колонки обязаны помещаться --------------- */

/*
 * Считается ровно то, что однажды сломалось на живой панели: таблица Values
 * шире своей колонки уезжает в горизонтальную прокрутку, и последние четыре
 * колонки — два цвета, предпросмотр и удаление — оказываются за краем.
 * Человек видит таблицу без половины контролов и решает, что их нет.
 *
 * Проверка арифметическая, потому что вёрстку тут проверить нечем: заглушка
 * DOM ничего не раскладывает. Зато складывать числа она не мешает.
 */
{
  /* Комментарии выкидываются: в них лежат объяснения с теми же словами, и
     проверка на `@container` однажды поймала собственный комментарий. */
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8")
    .replace(/[/][*][^]*?[*][/]/g, "");

  /** Ширина колонки списка Fields и поля правой колонки — из тех же правил. */
  const px = (re: RegExp, what: string): number => {
    const m = re.exec(css);
    if (!m) { fail("не нашёл в styles.css: " + what); return NaN; }
    return parseFloat(m[1] as string);
  };

  const tableMin = px(/\.io-vals__inner\s*\{\s*min-width:\s*(\d+)px/, "min-width таблицы Values");

  /* Сетка таблицы: девять колонок, из них одна тянется. */
  const grid = /\.io-vals__head,\s*\.io-vals__row\s*\{[^}]*grid-template-columns:([^;]+);/.exec(css);
  const gapM = /\.io-vals__head,\s*\.io-vals__row\s*\{[^}]*gap:\s*(\d+)px/.exec(css);
  const padM = /\.io-vals__head,\s*\.io-vals__row\s*\{[^}]*padding:\s*\d+px\s+(\d+)px/.exec(css);
  if (!grid || !gapM || !padM) fail("не нашёл сетку таблицы Values в styles.css");
  else {
    const parts = String(grid[1]).trim().split(/\s+(?![^(]*\))/);
    if (parts.length !== 9) fail("Ф7: колонок в сетке таблицы Values " + parts.length + ", а должно быть девять");
    else ok("Ф7: в сетке таблицы Values девять колонок");
    /*
     * Нижняя граница каждой колонки: у `minmax(X, …)` это X, у пиксельной —
     * она сама. Сумма границ плюс зазоры и поля — самая узкая раскладка, при
     * которой ни один контрол ещё не сжат в ноль.
     */
    const floorOf = (track: string): number => {
      const m = /minmax\(\s*([\d.]+)px/.exec(track);
      return m ? parseFloat(String(m[1])) : parseFloat(track);
    };
    const floors = parts.map(floorOf);
    if (floors.some(n => !Number.isFinite(n))) {
      fail("в сетке таблицы Values есть колонка без нижней границы: " + parts.join(" "));
    }
    const gap = parseFloat(String(gapM[1]));
    const pad = parseFloat(String(padM[1]));
    const need = floors.reduce((a, b) => a + b, 0) + gap * (parts.length - 1) + pad * 2;

    /*
     * Колонка `Value` — третья по Ф7, и её граница проверяется отдельно:
     * сжатая в ноль, она единственная, без которой со строкой нельзя
     * работать вовсе, и ровно это с ней сделала узкая панель.
     */
    const valueFloor = floors[2] ?? 0;
    if (!(valueFloor >= 72)) {
      fail("у колонки Value нижняя граница " + valueFloor + "px: на узкой панели её сожмёт");
    } else ok("колонка Value не сожмётся: нижняя граница " + valueFloor + "px");

    if (!(tableMin >= need)) {
      fail("min-width таблицы " + tableMin + "px меньше её самой узкой раскладки " + need + "px");
    } else ok("таблица Values помещается в объявленную ширину: " + need + " ≤ " + tableMin);

    /*
     * Объявленная ширина обязана быть не меньше самой узкой раскладки, иначе
     * таблица прокручивалась бы всегда, даже когда места довольно.
     */
  }

  /*
   * Ширину редактор не спрашивает ни у кого, и это проверяется прямо.
   * Оконный медиазапрос не срабатывает: панель настроек Obsidian уже окна.
   * Контейнерный меряет не тот элемент: `@container` смотрит на ближайшего
   * предка-контейнера, а не на тот, где объявлен `container-type`, — в
   * Obsidian такой предок нашёлся, и левый список сложился в строку на
   * широкой панели. Обе попытки записаны, чтобы их не повторили.
   */
  if (!/\.io-fields\s*\{[^}]*flex-wrap:\s*nowrap/.test(css)) {
    fail("колонки редактора Fields снова переносятся: правая уедет вниз, как уже было");
  } else ok("две колонки редактора Fields стоят рядом всегда");

  /*
   * Правая колонка обязана уметь сжаться. Без этого её содержимое выталкивает
   * список Fields, и рядом они уже не стоят.
   */
  const detailRule = /\.io-fields__col \+ \.io-fields__col\s*\{([^}]*)\}/.exec(css);
  const detailBody = detailRule ? String(detailRule[1]) : "";
  if (!/flex:\s*1\s+1\s+0/.test(detailBody) || !/min-width:\s*0/.test(detailBody)) {
    fail("правая колонка не умеет сжиматься: нужны flex: 1 1 0 и min-width: 0");
  } else ok("правая колонка берёт остаток и умеет сжаться");

  /* Тесно стало — прокручивается таблица, а не панель. */
  if (!/\.io-scroll\s*\{[^}]*overflow-x:\s*auto/.test(css)) {
    fail("таблица Values не прокручивается внутри себя: на узкой панели она растянет всю страницу");
  } else ok("таблица Values прокручивается внутри себя");

  if (/@container/.test(css)) {
    fail("в стилях снова появился @container: он меряет предка, а не сам блок");
  } else ok("контейнерных запросов в стилях нет");

  const windowRules = css.match(/@media[^{]*\{[^@]*?\.io-fields[^_-]/g);
  if (windowRules && windowRules.length) {
    fail("оконный медиазапрос трогает .io-fields: в панели настроек он не сработает");
  } else ok("оконных медиазапросов у .io-fields нет");
}

/* ---- Г14: у каждого своего блока есть рендерер ------------------------- */
{
  const bad: string[] = [];
  for (const g of SCHEMA) {
    for (const it of g.items) {
      if (it.kind !== "custom") continue;
      if (typeof it.render !== "function") bad.push(g.id + "/" + it.id);
    }
  }
  if (bad.length) fail("свой блок без рендерера: " + bad.join(", "));
  else ok("Г14: у каждого своего блока есть рендерер");
}

/* ---- Г16: дымовой тест — каждая вкладка и каждый свой блок ------------- */
{
  const { makeNode } = await import("../harness/dom_stub.ts");
  const { MemoryStore } = await import("../../src/ui/settings/store.ts");
  const { SettingsPane } = await import("../../src/ui/settings/settings_tab.ts");
  const { Modal, Notice: StubNotice } = await import("../harness/obsidian_stub.ts");
  const { loadPluginInternals } = await import("../harness/plugin_internals.ts");

  /*
   * Перенесённый редактор Fields ждёт платформу и плагин. Без них он не
   * рисуется, и Г16 проверял бы пустое место. Подделки тонкие: конфиг с одним
   * Field и нормализация, доводящая форму до полной — как настоящая.
   */
  const normalizePkmOrder = (raw: any) => {
    const o = raw && typeof raw === "object" ? raw : {};
    const map = (x: any) => (x && typeof x === "object" ? { ...x } : {});
    return {
      left: Array.isArray(o.left) ? o.left.slice() : [],
      right: Array.isArray(o.right) ? o.right.slice() : [],
      lead: map(o.lead), labels: map(o.labels), strictNames: map(o.strictNames),
      types: map(o.types), active: map(o.active), freeRoam: map(o.freeRoam),
      enabled: map(o.enabled), propertiesByField: map(o.propertiesByField),
    };
  };
  /*
   * **Конфиг настоящий, и это важнее, чем кажется.** До 2026-08-31 здесь лежал
   * выдуманный конфиг формы версии 1 (`pkm.behavior.order`, `ui: {}`). После
   * фазы 2 блоки читают `pkm.fields.*` и `visual.tags.*` — данных для них в том
   * конфиге не было вовсе. Блоки рисовались пустыми, проверка «нарисовал хоть
   * что-то» проходила, и редактор Fields с настоящими Fields, таблица Values,
   * предупреждение о контрасте и предпросмотры дымом не проверялись. Подделка
   * конфига оказалась подделкой плагина, как и всякая другая: она молча
   * выключила половину проверки, и нашлось это не чтением, а прогоном панели на
   * настоящем файле настроек.
   *
   * Теперь конфиг едет через настоящую `migrateConfig` из `main.js`, а форму
   * Order доводит настоящая `normalizePkmOrder` — обе из загрузчика. Фикстура
   * `config_v1_full.json` заморожена для этого же (Ф2-3).
   *
   * Свой файл настроек гоняется тем же кодом:
   * `node tools/panel_dry_run.mjs <путь к data.json>`.
   */
  const internals = loadPluginInternals();
  const realConfig: any = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_full.json"), "utf8")),
  );

  const ownFields = [
    ...(realConfig.pkm?.fields?.order?.left || []),
    ...(realConfig.pkm?.fields?.order?.right || []),
  ].filter((id: unknown) => id && !/_sub$/.test(String(id)));
  if (!ownFields.length) {
    fail("Г16: в фикстуре нет ни одного Field — редактор Fields нарисуется пустым, и дым ничего не проверит");
  }

  const legacyPlugin: any = {
    app: { workspace: {}, vault: {} },
    manifest: { id: "inline-overhaul", version: "gate", dir: ".obsidian/plugins/inline-overhaul" },
    getConfig: () => realConfig,
    setConfigPatch: () => {},
    listOwnCommands: () => internals.buildOwnCommandList(legacyPlugin),
  };
  const platform = {
    Setting,
    Notice: StubNotice,
    Modal,
    setIcon: () => {},
    plugin: legacyPlugin,
    getConfig: () => realConfig,
    normalizePkmOrder: internals.normalizePkmOrder,
    pkmOrderFields: [] as string[],
  };

  /* Подсказки в обе стороны: «?» появляется и исчезает, и рисуют его разные
     ветки — блок, который падает только с выключенными подсказками, уже был. */
  let blocks = 0;
  let cleanups = 0;
  let tipsOpened = 0;
  /* Подсказки своего блока, открывшиеся без подписи id. */
  const idless = new Set<string>();
  /*
   * Г20: подсказка группы доезжает до панели.
   *
   * До 2026-09-01 `tip` группы не читался ниоткуда — в определение уходили
   * только `heading` и `intro`, — и подсказки, написанные у каждой группы,
   * не показывались ни на одной вкладке (замечание заказчика 1.1.1).
   * Смотреть надо на то, что панель отдаёт платформе: расхождение было
   * именно между схемой и определениями.
   */
  const groupTipsOn = new Set<string>();
  const groupTipsOff = new Set<string>();
  /*
   * «?» обязан стоять **в строке заголовка**, а не под ним. Заголовку
   * декларативный API даёт один слот — `extraButtons`, — и панель кладёт туда
   * знак первым, перед кнопкой сброса. Заказчик четыре раза написал, что
   * подсказки у заголовков нет, потому что знак стоял строкой ниже
   * (B7, C11, C18, C41, C42 листа приёмки, 2026-09-02).
   */
  const groupMarkOn = new Set<string>();
  const groupMarkOff = new Set<string>();
  for (const showTips of [true, false]) {
    const store = new MemoryStore(JSON.parse(JSON.stringify(realConfig)));
    await store.set("general.help.showTips", showTips);
    /* Подписи id включены: гейт проверяет, что они доходят и до своих блоков. */
    await store.set("advanced.showSettingIds", true);
    /*
     * Все модули включены, иначе смотреть нечего.
     *
     * В фикстуре `visual.enabled` выключен, и до 2026-09-02 панель это
     * игнорировала — вкладка рисовалась целиком, что и было дефектом C7.
     * С калиткой выключенный модуль оставляет на вкладке один тумблер, и
     * подсказки четырёх групп Visual до панели не доезжают: не потому, что их
     * нет, а потому, что вкладка закрыта. Гейт про тексты обязан смотреть на
     * открытые вкладки; саму калитку держат пины в
     * `tests/regression/settings_layer_tests.ts`.
     */
    for (const tab of TABS as Array<{ module?: string }>) {
      if (tab.module) await store.set(tab.module, true);
    }
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {},
      fragments: { createFragment: () => makeNode("fragment") },
      platform,
    });

    for (const tab of TABS) {
      pane.setActiveTab(tab.id);
      const defs = pane.getSettingDefinitions() as Array<Record<string, any>>;
      const rows: Array<Record<string, any>> = [];
      for (const def of defs) {
        if (Array.isArray(def["items"])) rows.push(...def["items"]);
        else rows.push(def);
      }
      for (const def of defs) {
        const cls = String(def["cls"] || "");
        if (!cls.startsWith("io-group-")) continue;
        const id = cls.slice("io-group-".length);
        /*
         * Знак в заголовке и его подсказка проверяются **нажатием**, а не по
         * определениям.
         *
         * До 2026-09-02 гейт искал тело подсказки в `desc` вводной строки
         * группы — и был зелёный, хотя до окна тело не доезжало ни разу:
         * строку без `name`, `render`, `control` и `action` платформа
         * отбрасывает до отрисовки (`app.js`, `Z2`). Поэтому здесь
         * собирается дерево, какое строит платформа (`Xb`: группа, отдельная
         * строка заголовка с колонкой контролов, список строк рядом),
         * обработчик сохраняется и зовётся, а спрашивается то, что
         * получилось в дереве.
         */
        const buttons = Array.isArray(def["extraButtons"]) ? def["extraButtons"] : [];
        for (const make of buttons) {
          if (typeof make !== "function") continue;
          const box = makeNode("div");
          box.className = cls;
          const heading = box.createDiv({ cls: "setting-item setting-item-heading" });
          const control = heading.createDiv({ cls: "setting-item-control" });
          box.createDiv({ cls: "setting-items" });
          const node = control.createDiv({ cls: "clickable-icon" });
          let handler: (() => void) | null = null;
          const stub = {
            extraSettingsEl: node,
            setIcon() { return stub; },
            setTooltip() { return stub; },
            setDisabled() { return stub; },
            /* Обработчик СОХРАНЯЕТСЯ, иначе проверено размещение, а не
               поведение (У-43). */
            onClick(cb: () => void) { handler = cb; return stub; },
          };
          try {
            make(stub);
          } catch (e) {
            fail("Г20: кнопка заголовка группы " + id + " упала: " + String(e));
            continue;
          }
          if (!node.classList.contains("io-help--group")) continue;
          (showTips ? groupMarkOn : groupMarkOff).add(id);
          if (typeof handler !== "function") {
            fail("Г20: «?» группы " + id + " не завёл обработчик нажатия");
            continue;
          }
          (handler as unknown as () => void)();
          const body = box.querySelector(".io-grouptip");
          if (!body) {
            fail("Г20: нажатие на «?» группы " + id + " не открыло подсказку");
            continue;
          }
          if (box.children.indexOf(body) !== box.children.indexOf(heading) + 1) {
            fail("Г20: тело подсказки группы " + id + " встало не за строкой заголовка");
            continue;
          }
          if (!body.querySelectorAll(".io-tip__body").length) {
            fail("Г20: подсказка группы " + id + " открылась без текста");
            continue;
          }
          (showTips ? groupTipsOn : groupTipsOff).add(id);
          (handler as unknown as () => void)();
          if (box.querySelector(".io-grouptip")) {
            fail("Г20: повторное нажатие не сняло подсказку группы " + id);
          }
        }
      }
      for (const row of rows) {
        if (typeof row["render"] !== "function") continue;
        const host = makeNode("div");
        const setting = new Setting(host);
        try {
          const cleanup = row["render"](setting, {});
          blocks++;
          /* Г16 требует открыть каждую подсказку: раскрытие — отдельная
             ветка кода, и падало именно оно. */
          for (const mark of setting.settingEl.querySelectorAll(".io-help")) {
            mark.click();
            tipsOpened++;
            /*
             * Подпись id обязана быть в КАЖДОЙ открытой подсказке своего блока,
             * а не только у строк схемы. Заказчик называет элементы их id, и
             * без подписи в подсказках `Values`, `Behavior`, `YAML property` и
             * предпросмотров ему приходилось объяснять словами, о чём речь
             * (A3 и C52 листа приёмки, 2026-09-02).
             */
            const opened = setting.settingEl.querySelectorAll(".io-tip--below");
            for (const body of opened) {
              if (!body.querySelectorAll(".io-tip__id").length) {
                idless.add(String(body.getAttribute("id") || row["id"] || "без id"));
              }
            }
            mark.click();
          }
          /*
           * Очистку обязан вернуть **свой блок**: он подписан на хранилище, и
           * без снятия подписки перерисовка удваивает слушателей. Строка с
           * кнопками (`kind: "buttons"`) тоже рисуется через `render` — с
           * 2026-09-02 у неё настоящие кнопки с подписями, а не кликабельная
           * строка (C9), — но подписки у неё нет, и очищать ей нечего.
           * Отличаются они тем, что свой блок помечает строку классом
           * `io-block` (`SettingsPane.renderCustom`).
           */
          const ownBlock = setting.settingEl.classList.contains("io-block");
          if (typeof cleanup === "function") { cleanup(); cleanups++; }
          else if (ownBlock) {
            fail("блок " + String(row["name"]) + " на вкладке " + tab.id + " не вернул функцию очистки");
          }
          if (!setting.settingEl.children.length) {
            fail("блок на вкладке " + tab.id + " ничего не нарисовал");
          }
        } catch (e) {
          fail("блок на вкладке " + tab.id + " упал: " + String(e));
        }
      }
    }
  }
  const groupsWithTip = SCHEMA.filter((g: any) => String(g.tip || "").trim()).map((g: any) => String(g.id));
  const tipMissing = groupsWithTip.filter((id: string) => !groupTipsOn.has(id));
  /*
   * У группы с заголовком подсказка обязана быть. Восемь групп жили без неё —
   * `Help`, `Modules`, `Writing rules`, `Prefix priority`, `Tag appearance`,
   * `Tag Bars`, `Settings backup`, `Diagnostics`, — и по двум из них заказчик
   * это и написал (C35, B22 упирались в `Tag appearance` и `Tag Bars`).
   *
   * Вводные группы-коллауты исключены не по доброте: заголовка у них нет
   * вовсе, а знаку негде стоять, кроме строки заголовка.
   */
  const headedGroups = SCHEMA
    .filter((g: any) => !/-intro$/.test(String(g.id)))
    .map((g: any) => String(g.id));
  const tipUnwritten = headedGroups.filter((id: string) => !groupsWithTip.includes(id));
  const markMissing = headedGroups.filter((id: string) => !groupMarkOn.has(id));

  if (!groupsWithTip.length) fail("Г20: в схеме нет ни одной группы с подсказкой — гейт ничего не проверяет");
  else if (tipUnwritten.length) fail("Г20: у группы с заголовком нет подсказки: " + tipUnwritten.join(", "));
  else if (tipMissing.length) fail("Г20: подсказка группы не дошла до панели: " + tipMissing.join(", "));
  else if (groupTipsOff.size) fail("Г20: подсказки выключены, а тело подсказки у групп осталось: " + Array.from(groupTipsOff).join(", "));
  else if (markMissing.length) fail("Г20: «?» не встал в строку заголовка группы: " + markMissing.join(", "));
  else if (groupMarkOff.size) fail("Г20: подсказки выключены, а «?» в заголовке остался: " + Array.from(groupMarkOff).join(", "));
  else ok("Г20: подсказка и «?» в строке заголовка у " + groupMarkOn.size + " групп из "
    + headedGroups.length + ", с выключенными подсказками ни одной");

  if (idless.size) {
    fail("Г16: подсказка своего блока открылась без подписи id: "
      + Array.from(idless).slice(0, 8).join(", "));
  } else {
    ok("Г16: подпись id есть в каждой открытой подсказке своего блока");
  }

  if (!blocks) fail("Г16: ни одного своего блока не отрисовано — проверка ничего не проверяет");
  else if (!tipsOpened) fail("Г16: ни одна подсказка не открыта — проверка неполная");
  else ok("Г16: отрисовано своих блоков " + blocks + ", открыто подсказок " + tipsOpened +
          ", снято " + cleanups);
}

if (notices.length) console.log("  показанные Notice: " + notices.length);
console.log(failures ? "\n" + failures + " problem(s)" : "\nвсе гейты фазы " + phaseLabel + " прошли");
process.exit(failures ? 1 : 0);
