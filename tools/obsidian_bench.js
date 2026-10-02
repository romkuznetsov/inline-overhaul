"use strict";

/**
 * Стенд в настоящем Obsidian: копия `test-vault`, свой профиль, наш плагин.
 *
 * **Зачем.** Остальные стенды гоняют настоящий код плагина на подделанных
 * редакторе и vault, и дважды за цикл 95 были зелёными там, где у него не
 * работало (его вопрос 2026-09-26: «а ты можешь сам проверять в obsidian?»).
 * Здесь отвечает сама платформа: разрешение ссылок, щелчок мышью, команда из
 * реестра, файлы на диске.
 *
 * **Чего он не трогает.** Его окно и его vault: профиль и копия vault лежат во
 * временной папке машины, `obsidian.json` профиля знает одну копию. Движок
 * Obsidian (`obsidian-<версия>.asar`) копируется из его профиля — тот, которым
 * он работает. Плагин — сборка, лежащая в `test-vault` (`npm run install:test`).
 *
 * **Почему не `_electron.launch`.** Obsidian грузит свой пакет из профиля в
 * обход крючка Playwright, и запуск ждёт до таймаута. Процесс поднимается сам,
 * с портом отладки, а Playwright подключается по CDP.
 *
 * Запуск (из `repo/`): `node tools/obsidian_bench.js link-click`
 * Другая сборка: `IO_MAIN=dist/main.js node tools/obsidian_bench.js link-click`
 * Сценарии — объект `SCENARIOS` ниже; новый дописывается туда же.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const SRC_VAULT = path.resolve(ROOT, "..", "test-vault");
const EXE = path.join(process.env.LOCALAPPDATA || "", "Programs", "Obsidian", "Obsidian.exe");
const PROFILE_SRC = path.join(process.env.APPDATA || "", "obsidian");
const PORT = 9333;

function prepare(name) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "io-obsidian-bench-"));
  const profile = path.join(work, "profile");
  const vault = path.join(work, "vault");
  fs.mkdirSync(profile, { recursive: true });
  if (/^clean/.test(name)) {
    /* Чистый vault (BUGHUNT 2026-09-26): пустая папка, сборка из `dist` тем же
       установщиком, что у человека, и ни одного `data.json` — стартовый набор. */
    require("child_process").execFileSync(process.execPath,
      [path.join(ROOT, "tools", "build", "install_test_vault.js"), "--no-build", vault], { cwd: ROOT, stdio: "ignore" });
    /* Две демо-заметки установщика — его, а не человека из BRAT: у того их нет. */
    for (const n of fs.readdirSync(vault)) if (n.endsWith(".md")) fs.rmSync(path.join(vault, n));
  } else {
    /* Пустой vault с его настройками (его слово 2026-09-28: «он должен
       тестировать в новом vault (пустом), а если для тестирования нужны
       заметки — то пусть сам создаёт их»). Из его vault берётся только
       `.obsidian` — настройки, тема, плагины — без раскладки окон; заметки
       кладёт `seedNotes`. */
    fs.mkdirSync(vault, { recursive: true });
    fs.cpSync(path.join(SRC_VAULT, ".obsidian"), path.join(vault, ".obsidian"),
      { recursive: true, filter: (p) => !/[\\/]workspace(-mobile)?\.json$/.test(p) });
    seedNotes(vault);
    /* Сборка — из `dist`, а не та, что лежит у него: без этого стенд мерил
       плагин, поставленный последним `install:test`, и 2026-09-28 объявил
       зелёным то, чего в той сборке ещё не было. */
    const plug = path.join(vault, ".obsidian", "plugins", "inline-overhaul");
    for (const f of ["main.js", "styles.css", "manifest.json"]) {
      const from = path.join(ROOT, "dist", f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(plug, f));
    }
  }
  /* `IO_MAIN=<файл>` — другая сборка плагина в копии vault (контроль стенда
     подменённой сборкой); его `test-vault` не трогается. */
  if (process.env.IO_MAIN) {
    fs.copyFileSync(path.resolve(process.env.IO_MAIN), path.join(vault, ".obsidian", "plugins", "inline-overhaul", "main.js"));
  }
  /* `IO_STYLES=<файл>` — то же для стилей: правка вида живёт в `styles.css`, а не в `main.js`. */
  if (process.env.IO_STYLES) {
    fs.copyFileSync(path.resolve(process.env.IO_STYLES), path.join(vault, ".obsidian", "plugins", "inline-overhaul", "styles.css"));
  }
  /* Сценарию бывает нужна своя копия настроек или заметка — только в копии. */
  if (PREPARE[name]) PREPARE[name](vault);
  const asar = fs.readdirSync(PROFILE_SRC).filter((n) => /^obsidian-.*\.asar$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) /* версии числом: 1.9 старше 1.13 (ревизия Г-7) */.pop();
  if (!asar) throw new Error("нет obsidian-<версия>.asar в " + PROFILE_SRC);
  fs.copyFileSync(path.join(PROFILE_SRC, asar), path.join(profile, asar));
  fs.writeFileSync(path.join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { iobench00000001: { path: vault, ts: Date.now(), open: true } } }));
  return { work, profile, vault };
}

/**
 * Заметки пустого vault: по пустой заметке на каждое Value-ссылку его
 * настроек — ссылки в строках разрешаются так же, как у него, — и `SEED`
 * старых сценариев. Остальное случаи заводят сами (`files`).
 */
function seedNotes(vault) {
  const cfg = JSON.parse(fs.readFileSync(path.join(vault, ".obsidian", "plugins", "inline-overhaul", "data.json"), "utf8"));
  const links = (((cfg.pkm || {}).fields || {}).links || {}).fields || [];
  const files = {};
  for (const f of links) {
    for (const v of f.values || []) {
      const t = String((v && v.token) || v || "").replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
      if (t) files[t + ".md"] = "";
    }
  }
  Object.assign(files, SEED);
  for (const [p, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(vault, p)), { recursive: true });
    fs.writeFileSync(path.join(vault, p), text);
  }
}

/** Строки сценариев цикла 96 — одной заметкой, как они стояли в его `testing.md`. */
const SEED = {
  "testing.md": [
    "- строка для проверки порядка :: [[123]]",
    "- строка для проверки Link to Navigator :: [[123]]",
    "- Call the bank", "    - ask about the card", "    - check the rate",
    "- Pay the rent", "    - transfer", "    - receipt",
    "- Write the report", "    - intro", "    - numbers", "",
  ].join("\n"),
  /* Ссылки на Value в других заметках — цена переименования (`value-rename`). */
  "Man1-links.md": "- [[Man1]] :: раз\n- [[Man1]] :: два\n",
};

async function launch(name) {
  const env = prepare(name);
  const proc = spawn(EXE, ["--user-data-dir=" + env.profile, "--remote-debugging-port=" + PORT], { stdio: "ignore" });
  let browser = null;
  for (let i = 0; i < 40 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    browser = await chromium.connectOverCDP("http://127.0.0.1:" + PORT).catch(() => null);
  }
  const close = async () => {
    if (browser) await browser.close().catch(() => { /* уборка: соединения может уже не быть */ });
    proc.kill();
  };
  if (!browser) { await close(); throw new Error("порт отладки Obsidian не поднялся"); }
  let win = null;
  for (let i = 0; i < 60 && !win; i++) {
    for (const w of browser.contexts().flatMap((c) => c.pages())) {
      const ready = await w.evaluate(() => !!(window.app && window.app.workspace && window.app.workspace.layoutReady))
        .catch(() => false);
      if (ready) win = w;
    }
    if (!win) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!win) { await close(); throw new Error("окно vault не открылось"); }
  /* Новый профиль открывает vault в ограниченном режиме (окно «доверять ли
     автору»): плагины сообщества включаются так же, как кнопкой в нём.
     Контроль «открылось то, что надо» (У-152): vault — копия, плагин загружен. */
  const state = await win.evaluate(async () => {
    const p = window.app.plugins;
    /* Окно доверия закрывается его же кнопкой: оно лежит поверх заметки, и
       мышь без этого щёлкает по нему, а не по строке. */
    /* У кнопки «довериться» класса нет, у соседней — `mod-cancel`: выбор без
       слов, язык интерфейса у него русский. */
    const pick = () => document.querySelector(".modal-container button:not(.mod-cancel)");
    for (let i = 0; i < 20 && !pick(); i++) await new Promise((r) => setTimeout(r, 250));
    const trust = pick();
    if (trust) { trust.click(); await new Promise((r) => setTimeout(r, 1500)); }
    /* «Довериться» открывает настройки на плагинах сообщества — закрыть их,
       чтобы осталось одно окно заметки (его слово 2026-09-28). */
    if (window.app.setting && typeof window.app.setting.close === "function") window.app.setting.close();
    if (!p.plugins["inline-overhaul"]) { await p.setEnable(true); await p.enablePlugin("inline-overhaul"); }
    /* Окно «что изменилось» нашего же плагина — закрыть его кнопкой: у копии его
       vault версия в памяти плагина бывает старше сборки. */
    await new Promise((r) => setTimeout(r, 800));
    for (const m of [...document.querySelectorAll(".modal-container")]) {
      if (/what changed/i.test(m.textContent)) { const b = m.querySelector("button.mod-cta"); if (b) b.click(); }
    }
    await new Promise((r) => setTimeout(r, 300));
    return {
      vault: window.app.vault.adapter.basePath,
      plugin: !!p.plugins["inline-overhaul"],
      modals: [...document.querySelectorAll(".modal-container")].map((m) => m.textContent.slice(0, 60)
        + " кнопки: " + [...m.querySelectorAll("button")].map((b) => "[" + b.className + "] " + b.textContent).join("; ")),
    };
  });
  if (state.modals.length) { await close(); throw new Error("поверх заметки осталось окно: " + state.modals.join(" | ")); }
  if (!state.vault.endsWith(path.basename(env.work) + path.sep + "vault")) {
    await close();
    throw new Error("открыт не тот vault: " + state.vault);
  }
  if (!state.plugin) { await close(); throw new Error("плагин inline-overhaul не загрузился"); }
  return { win, env, close, browser };
}

/** Открыть заметку, поставить каретку в начало и прокрутить к строке; вернуть номер строки. */
async function openAt(win, file, lineText) {
  return win.evaluate(async ({ file, lineText }) => {
    const a = window.app;
    await a.workspace.getLeaf(false).openFile(a.vault.getAbstractFileByPath(file), { state: { mode: "source", source: false } });
    await new Promise((r) => setTimeout(r, 800));
    const ed = a.workspace.activeEditor.editor;
    const n = ed.getValue().split("\n").lastIndexOf(lineText);
    ed.setCursor({ line: 0, ch: 0 });
    if (n >= 0) ed.scrollIntoView({ from: { line: n, ch: 0 }, to: { line: n, ch: 0 } }, true);
    return n;
  }, { file, lineText });
}

/** Команда плагина по его идентификатору; ответ платформы «выполнена ли». */
function runCommand(win, id) {
  return win.evaluate((id) => window.app.commands.executeCommandById("inline-overhaul:" + id), id);
}

/** Подготовка копии vault до запуска: имя — то же, что у сценария. */
/** Строка README (`clean-readme-shot`): та же, что в блоке `markdown` README. */
const README_LINE = "- [ ] #todo #high || call the bank || [[Project A]] 📅2026-09-15";

const PREPARE = {
  /* H1.1 прогона 2026-10-02: пустой пузырь для сценария `panel-write-refresh`. */
  "panel-write-refresh"(vault) {
    fs.writeFileSync(path.join(vault, "bubble.md"), "первая строка\n\n- #high :: текст\n\nпоследняя строка\n");
  },
  /* H3.1 прогона 2026-10-02: заметка со свойствами для сценария `properties-focus`. */
  "properties-focus"(vault) {
    fs.writeFileSync(path.join(vault, "props.md"), "---\ntitle: a\nstatus: b\n---\n- first line\n- second line\n");
  },
  /* H2.3 прогона 2026-10-02: набор, сразу команда, одно `Ctrl+Z`. */
  "undo-after-typing"(vault) {
    fs.writeFileSync(path.join(vault, "typed.md"), "- first line\n- second line\n");
  },
  "shift-enter"(vault) { fs.writeFileSync(path.join(vault, "enter.md"), "\n"); },
  /* Заметка строки README и заметка ссылки: ссылка без заметки рисуется неразрешённой. */
  "clean-readme-shot"(vault) {
    fs.writeFileSync(path.join(vault, "readme.md"), README_LINE + "\n\n");
    fs.writeFileSync(path.join(vault, "Project A.md"), "");
  },
  /* H1.5 прогона 2026-10-02: строка README и строка под tagWheel, тёмная тема. */
  "clean-dark-contrast"(vault) { PREPARE["clean-readme-extra"](vault); },
  /* H1.6 прогона 2026-10-02: строка README, `#high` пустым пузырём. */
  "clean-empty-bubble"(vault) { PREPARE["clean-readme-shot"](vault); },
  "clean-readme-extra"(vault) {
    PREPARE["clean-readme-shot"](vault);
    /* Пустые строки сверху: скроллер открывается вверх и лёг бы на заголовок заметки. */
    fs.writeFileSync(path.join(vault, "wheel.md"), "\n\n\n\n\n- your text\n\n\n\n\n");
  },
  /* Его заказ к тесту 2 цикла 96: Value ссылки с папкой. У детей `Project` —
     `222/123` и `333/123`, заметка `bench-folder.md` с пустой строкой. */
  "link-folder-value"(vault) {
    const dataPath = path.join(vault, ".obsidian", "plugins", "inline-overhaul", "data.json");
    const cfg = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const links = cfg.pkm.fields.links.fields;
    const parent = links.find((f) => f.id === "Project");
    const child = links.find((f) => f.id === "Project_sub");
    if (!parent || !child) throw new Error("в его настройках нет Project и Project_sub");
    const parentTok = String(parent.values[0].token);
    child.values = ["222/123", "333/123"].map((token) => Object.assign({}, child.values[0], { token, allowedParentValues: [parentTok] }));
    parent.values[0].subtags = ["222/123", "333/123"];
    fs.writeFileSync(dataPath, JSON.stringify(cfg));
    fs.writeFileSync(path.join(vault, "bench-folder.md"), "- текст\n");
  },
  /* Его `💬` к тесту 5 цикла 114: скроллер подписывает ссылку целью, а он ждёт
     подпись. Первый Field-ссылка Right получает три Value трёх видов. */
  "scroller-link-label"(vault) {
    const dataPath = path.join(vault, ".obsidian", "plugins", "inline-overhaul", "data.json");
    const cfg = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const links = cfg.pkm.fields.links.fields;
    const field = cfg.pkm.fields.order.right.map((id) => links.find((f) => f.id === id)).find(Boolean);
    if (!field) throw new Error("в его настройках нет Field-ссылки в Right");
    field.values = SCROLLER_LINKS.map((token) => Object.assign({}, field.values[0], { token, subtags: [], allowedParentValues: [] }));
    fs.writeFileSync(dataPath, JSON.stringify(cfg));
    for (const t of SCROLLER_LINKS) {
      const p = path.join(vault, t.split("|")[0] + ".md");
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, "");
    }
    fs.writeFileSync(path.join(vault, "bench-scroller.md"), "\n\n\n\n\n- текст\n\n\n\n\n");
  },
};

PREPARE["panel-link-label"] = PREPARE["scroller-link-label"];
/* H1.2 прогона 2026-10-02: `tagWheel Value names = Custom + default` и свой текст у `[[Plain]]`. */
PREPARE["panel-link-label-both"] = (vault) => {
  PREPARE["scroller-link-label"](vault);
  const dataPath = path.join(vault, ".obsidian", "plugins", "inline-overhaul", "data.json");
  const cfg = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const links = cfg.pkm.fields.links.fields;
  const field = cfg.pkm.fields.order.right.map((id) => links.find((x) => x.id === id)).find(Boolean);
  cfg.visual.tagWheel.valueNames = "both";
  cfg.visual.tags.byTag = cfg.visual.tags.byTag || {};
  cfg.visual.tags.byTag[field.id] = Object.assign({}, cfg.visual.tags.byTag[field.id], {
    "[[Plain]]": { fillColor: "", textColor: "", borderColor: "", visibility: "custom", customText: "PL" },
  });
  fs.writeFileSync(dataPath, JSON.stringify(cfg));
};

/** Value-ссылки сценария `scroller-link-label`: с подписью, простая, с папкой. */
const SCROLLER_LINKS = ["Alias Target|Shown", "Plain", "111/Deep"];

/**
 * Один случай пакета чистого vault (`tools/obsidian_cases.js`): заметки →
 * каретка → шаги → сверка. Всё внутри страницы, одним заходом: между шагом и
 * сверкой нет ожидания снаружи (У-211). Настройки и файлы возвращаются к
 * исходным после каждого случая, чтобы случаи не зависели друг от друга.
 */
async function runCase(win, c) {
  return win.evaluate(async (c) => {
    const a = window.app;
    const plugin = a.plugins.plugins["inline-overhaul"];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const today = window.moment().format("YYYY-MM-DD");
    const fill = (s) => String(s).split("{{today}}").join(today);
    if (!window.__ioBenchCfg) window.__ioBenchCfg = JSON.parse(JSON.stringify(plugin.getConfig()));
    const log = [];
    const ed = () => a.workspace.activeEditor && a.workspace.activeEditor.editor;
    /* `at.source` — режим исходника: в Live Preview каретка в frontmatter не встаёт (виджет свойств). */
    const open = async (file, source) => {
      await a.workspace.getLeaf(false).openFile(a.vault.getAbstractFileByPath(file), { state: { mode: "source", source: !!source } });
      await sleep(400);
    };
    try {
      for (const [p, text] of Object.entries(c.files || {})) {
        const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        if (dir && !a.vault.getAbstractFileByPath(dir)) await a.vault.createFolder(dir);
        const f = a.vault.getAbstractFileByPath(p);
        if (f) await a.vault.modify(f, fill(text)); else await a.vault.create(p, fill(text));
      }
      if (c.cfg) { plugin.setConfigPatch(c.cfg, "bench"); plugin.registerPkmCommands(); plugin.registerBinderCommands(); await sleep(200); }
      if (c.at) {
        await open(c.at.file, c.at.source);
        const e = ed();
        const line = typeof c.at.line === "number" ? c.at.line : e.getValue().split("\n").indexOf(c.at.line);
        const text = e.getLine(line);
        const ch = typeof c.at.ch === "number" ? c.at.ch : (c.at.after ? text.indexOf(c.at.after) + c.at.after.length : text.length);
        e.setCursor({ line, ch });
        if (c.at.sel) e.setSelection({ line, ch: text.indexOf(c.at.sel) }, { line, ch: text.indexOf(c.at.sel) + c.at.sel.length });
        e.focus();
      }
      for (const s of c.steps || []) {
        if (typeof s === "string") {
          const ok = a.commands.executeCommandById("inline-overhaul:" + s);
          if (!ok) log.push("команда не выполнилась: " + s);
        } else if (s.open) await open(s.open);
        else if (s.cursor) { ed().setCursor(s.cursor); }
        else if (s.cfg) { plugin.setConfigPatch(s.cfg, "bench"); plugin.registerPkmCommands(); plugin.registerBinderCommands(); }
        else if (s.js) { await (0, eval)("(async (a, plugin, ed) => {" + s.js + "})")(a, plugin, ed()); }
        await sleep(s.wait || 350);
      }
      return { log };
    } catch (e) { return { log: log.concat(["бросок: " + (e && e.stack || e)]) }; }
  }, c);
}

/** Сверка и уборка случая: ожидаемое — текст заметки в редакторе или на диске. */
async function checkCase(win, c) {
  return win.evaluate(async (c) => {
    const a = window.app;
    const plugin = a.plugins.plugins["inline-overhaul"];
    const today = window.moment().format("YYYY-MM-DD");
    const fill = (s) => String(s).split("{{today}}").join(today);
    const got = {};
    const bad = [];
    for (const [p, want] of Object.entries(c.expect || {})) {
      const leaf = a.workspace.getLeavesOfType("markdown").find((l) => l.view.file && l.view.file.path === p);
      const f = a.vault.getAbstractFileByPath(p);
      const text = leaf ? leaf.view.editor.getValue() : (f ? await a.vault.read(f) : null);
      got[p] = text;
      const w = want === null ? null : fill(want);
      if (text !== w) bad.push(p);
    }
    for (const [p, want] of Object.entries(c.expectDisk || {})) {
      const text = await a.vault.adapter.exists(p) ? await a.vault.adapter.read(p) : null;
      got["disk:" + p] = text;
      if (text !== (want === null ? null : fill(want))) bad.push("disk:" + p);
    }
    if (c.check) {
      let r = null;
      try { r = await (0, eval)("(async (a, plugin) => {" + c.check + "})")(a, plugin); } catch (e) { r = "бросок: " + e.message; }
      got.check = r;
      if (r !== true) bad.push("check");
    }
    return { got, bad, open: !!(window.__tagWheelState && window.__tagWheelState.active) };
  }, c);
}

/** Уборка случая: Esc открытой панели снаружи, исходные настройки. */
async function resetCase(win, open) {
  if (open) { await win.keyboard.press("Escape"); await win.waitForTimeout(300); }
  await win.evaluate(() => {
    const plugin = window.app.plugins.plugins["inline-overhaul"];
    plugin.store.update(() => JSON.parse(JSON.stringify(window.__ioBenchCfg)), "bench-reset", { undoable: false });
    plugin.registerPkmCommands(); plugin.registerBinderCommands();
  });
}

/* Случай, зависший в странице, не держит весь прогон: 30 секунд — и дальше.
   Зависший прогон 2026-09-26 простоял два часа и съел память машины. */
function inTime(promise, what) {
  let timer = null;
  const guard = new Promise((_, no) => { timer = setTimeout(() => no(new Error("случай завис: " + what)), 30000); });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

async function runCases(win, filter, mine) {
  delete require.cache[require.resolve("./obsidian_cases.js")];
  const all = require("./obsidian_cases.js");
  const want = filter ? filter.split(",") : null;
  /* Случаи `mine` написаны под его настройки и идут только на копии его vault. */
  const cases = all.filter((c) => !!c.mine === !!mine && (!want || want.some((w) => c.id === w || c.id.startsWith(w + "."))));
  let pass = 0;
  for (const c of cases) {
    /* Шаги с клавишами делятся на куски: команды — в странице, нажатия — снаружи. */
    const chunks = [];
    let cur = [];
    for (const s of c.steps || []) {
      if (typeof s === "object" && (s.key || s.type || s.click || s.clickBox)) { chunks.push(cur); chunks.push(s); cur = []; } else cur.push(s);
    }
    chunks.push(cur);
    let log = [];
    let first = true;
    for (const ch of chunks) {
      if (Array.isArray(ch)) {
        const r = await inTime(runCase(win, Object.assign({}, c, first ? {} : { files: null, cfg: null, at: null }, { steps: ch })), c.id).catch((e) => ({ log: ["бросок: " + e.message] }));
        log = log.concat(r.log);
        first = false;
      } else {
        if (first) { await runCase(win, Object.assign({}, c, { steps: [] })); first = false; }
        if (ch.key) for (let i = 0; i < (ch.times || 1); i++) await win.keyboard.press(ch.key);
        if (ch.type) await win.keyboard.type(ch.type);
        if (ch.click) {
          const box = await win.evaluate((t) => {
            const row = [...window.app.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll(".cm-line")].filter((l) => l.textContent.includes(t)).pop();
            if (!row) return null;
            const r = row.getBoundingClientRect();
            return { x: r.x + r.width - 4, y: r.y + r.height / 2 };
          }, ch.click);
          if (box) await win.mouse.click(box.x, box.y); else log.push("нет строки для щелчка: " + ch.click);
        }
        /* Щелчок по самой галочке — виджету Live Preview, а не по тексту строки. */
        if (ch.clickBox) {
          const box = await win.evaluate((t) => {
            const row = [...window.app.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll(".cm-line")].filter((l) => l.textContent.includes(t)).pop();
            const input = row && row.querySelector("input.task-list-item-checkbox");
            if (!input) return null;
            const r = input.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }, ch.clickBox);
          if (box) await win.mouse.click(box.x, box.y); else log.push("нет галочки для щелчка: " + ch.clickBox);
        }
        await win.waitForTimeout(ch.wait || 350);
      }
    }
    await win.waitForTimeout(c.settle || 300);
    const res = await inTime(checkCase(win, c), c.id).catch((e) => ({ got: { check: e.message }, bad: ["check"], open: false }));
    await resetCase(win, res.open);
    const ok = res.bad.length === 0 && !log.some((l) => l.startsWith("бросок"));
    if (ok) pass++;
    console.log((ok ? "ok   " : "FAIL ") + c.id + " — " + c.title);
    if (!ok || process.env.IO_VERBOSE) {
      for (const k of Object.keys(res.got)) {
        const w = k === "check" ? true : (k.startsWith("disk:") ? c.expectDisk[k.slice(5)] : c.expect[k]);
        console.log("     " + k + "\n       ждём: " + JSON.stringify(w) + "\n       есть: " + JSON.stringify(res.got[k]));
      }
      for (const l of log) console.log("     " + l);
    }
  }
  console.log(pass + " из " + cases.length + " случаев сходятся");
  return pass === cases.length;
}

/** Страница, где нарисована панель настроек: в 1.13 это бывает отдельное окно. */
async function settingsHost(win, browser) {
  const pages = () => browser.contexts().flatMap((c) => c.pages());
  for (let i = 0; i < 20; i++) {
    for (const pg of pages()) {
      if (await pg.evaluate(() => !!document.querySelector(".io-tabstrip, [class*=io-tab]")).catch(() => false)) return pg;
    }
    await win.waitForTimeout(500);
  }
  throw new Error("панель настроек не нашлась ни в одном окне");
}

/** Щелчок мышью по видимому узлу с этим текстом — последнему из совпавших. */
async function clickIn(pg, text) {
  const box = await pg.evaluate((t) => {
    const vis = (x) => x.getBoundingClientRect().width > 0;
    const n = [...document.querySelectorAll("button, [role=tab]")].filter((x) => x.textContent.trim() === t && vis(x)).pop()
      || [...document.querySelectorAll("div, span")].filter((x) => x.children.length === 0 && x.textContent.trim() === t && vis(x)).pop();
    if (!n) return null;
    n.scrollIntoView({ block: "center" });
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);
  if (!box) throw new Error("нет «" + text + "» в окне");
  await pg.mouse.click(box.x, box.y);
  await pg.waitForTimeout(700);
}

const SCENARIOS = {
  /*
   * BUGHUNT 2026-09-30, B19: окно «Add a Binder command». Первый `Esc`
   * сворачивает выбиралку, второй закрывает окно (`В-196`); при раскрытой
   * выбиралке `Cancel` закрывает окно с первого щелчка.
   */
  async "binder-add"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Keyboard");
    const state = () => host.evaluate(() => ({
      modal: [...document.querySelectorAll(".modal-container")].some((m) => m.querySelector(".io-dlg") && m.getBoundingClientRect().width > 0),
      picker: [...document.querySelectorAll(".io-pick")].some((p) => p.getBoundingClientRect().width > 0),
    }));
    const openForm = async () => {
      await clickIn(host, "Add command");
      await host.waitForSelector(".modal .io-dlg", { timeout: 5000 });
      await host.click(".modal .io-dlg input.io-text");
      await host.waitForTimeout(300);
    };
    const log = [];
    await openForm();
    log.push(["открыто", await state()]);
    await host.keyboard.press("Escape");
    await host.waitForTimeout(300);
    log.push(["Esc 1", await state()]);
    await host.keyboard.press("Escape");
    await host.waitForTimeout(300);
    log.push(["Esc 2", await state()]);
    if (log[2][1].modal) { await host.keyboard.press("Escape"); await host.waitForTimeout(300); }
    if ((await state()).modal) await clickIn(host, "Cancel");
    await openForm();
    log.push(["снова открыто", await state()]);
    await clickIn(host, "Cancel");
    log.push(["Cancel 1", await state()]);
    for (const [step, s] of log) console.log(step + ": окно " + (s.modal ? "открыто" : "закрыто") + ", выбиралка " + (s.picker ? "раскрыта" : "свёрнута"));
    const ok = log[0][1].picker && log[1][1].modal && !log[1][1].picker && !log[2][1].modal && log[3][1].picker && !log[4][1].modal;
    console.log(ok ? "ok: Esc сворачивает выбиралку, второй закрывает окно; Cancel — с первого щелчка" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * D22 перечня 2026-09-30: после `Undo last settings change` тумблер панели
   * показывает отменённое значение. Два тумблера Advanced щелчком, две отмены
   * командой — экран обязан совпасть с конфигом после каждой.
   */
  async "undo-toggle-redraw"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Advanced");
    const NAMES = { "Autosave": "autosave", "Save a backup before restoring": "beforeRestore" };
    const screen = () => host.evaluate((names) => {
      const out = {};
      for (const row of document.querySelectorAll(".setting-item")) {
        const n = row.querySelector(".setting-item-name");
        const t = n && n.textContent.trim();
        const box = row.querySelector(".checkbox-container");
        if (t && names.includes(t) && box && box.getBoundingClientRect().width > 0) out[t] = box.classList.contains("is-enabled");
      }
      return out;
    }, Object.keys(NAMES));
    const cfg = async () => {
      const b = await win.evaluate(() => window.app.plugins.plugins["inline-overhaul"].getConfig().advanced.backups);
      const out = {};
      for (const [t, k] of Object.entries(NAMES)) out[t] = b[k] === true;
      return out;
    };
    const flip = (name) => host.evaluate((t) => {
      const row = [...document.querySelectorAll(".setting-item")].find((r) => {
        const n = r.querySelector(".setting-item-name");
        return n && n.textContent.trim() === t && r.getBoundingClientRect().width > 0;
      });
      row.querySelector(".checkbox-container").click();
    }, name);
    const log = [];
    const start = await screen();
    /* Контроль «тумблеры нашлись» (У-152). */
    if (Object.keys(start).length !== 2) { console.log("КОНТРОЛЬ: тумблеров на экране " + JSON.stringify(start)); return false; }
    for (const name of Object.keys(NAMES)) { await flip(name); await host.waitForTimeout(600); }
    log.push(["щелчки", await screen(), await cfg()]);
    for (let i = 1; i <= 2; i++) {
      await win.evaluate(() => window.app.commands.executeCommandById("inline-overhaul:undo-last-settings-change"));
      await host.waitForTimeout(900);
      log.push(["Undo " + i, await screen(), await cfg()]);
    }
    for (const [step, s, c] of log) console.log(step + ": экран " + JSON.stringify(s) + " | конфиг " + JSON.stringify(c));
    /* Контроль «щелчки сдвинули конфиг» — иначе отменять нечего. */
    if (JSON.stringify(log[0][2]) === JSON.stringify(log[2][2])) { console.log("КОНТРОЛЬ: Undo не вернул конфиг — мерить нечего"); return false; }
    const ok = log.every(([, s, c]) => JSON.stringify(s) === JSON.stringify(c));
    console.log(ok ? "ok: тумблеры на экране следуют за отменой" : "РАСХОДИТСЯ: экран не совпал с конфигом");
    return ok;
  },

  /*
   * Предпросмотр строки на его конфиге (его замечание цикла 113: «когда fields
   * становится много, preview вылазит за границы поля»). Правый край строки
   * не дальше края карточки, а строка листается. Контроль — его Fields
   * обязаны быть шире карточки, иначе мерить нечего.
   */
  async "line-preview-scroll"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Tags & PKM");
    await host.waitForSelector(".io-struct", { timeout: 5000 });
    const m = await host.evaluate(() => {
      const s = document.querySelector(".io-struct");
      const box = s.closest(".io-preview").getBoundingClientRect();
      return { right: Math.round(s.getBoundingClientRect().right), boxRight: Math.round(box.right), scroll: s.scrollWidth, client: s.clientWidth, vbar: s.offsetWidth - s.clientWidth };
    });
    console.log(JSON.stringify(m));
    if (m.scroll <= m.client && m.right <= m.boxRight) { console.log("КОНТРОЛЬ: строка уже карточки — мерить нечего"); return false; }
    const ok = m.right <= m.boxRight && m.scroll > m.client && m.vbar === 0; /* листается вбок, вертикальной полосы нет */
    console.log(ok ? "ok: строка внутри карточки и листается" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * Shift+Enter при включённых Smart Enter и `Shift+Enter as usual Enter`
   * (его `💬` к тесту 3 цикла 106 и его слово 2026-09-30 «сделай контрол»).
   * Настоящая клавиатура на его конфиге. Эталон — `Enter` при выключенном
   * Smart Enter; контроль — `Enter` при включённом обязан дать другое.
   */
  async "shift-enter"(win) {
    const line = "- позвонить в банк, завтра в налоговую";
    const at = line.indexOf(",");
    const run = async (enabled, key, shiftPlainEnter = true) => {
      await win.evaluate(async ({ enabled, shiftPlainEnter, line, at }) => {
        const p = window.app.plugins.plugins["inline-overhaul"];
        p.setConfigPatch({ editor: { smartEnter: { enabled, shiftPlainEnter } } }, "bench:shift-enter");
        await window.app.workspace.getLeaf(false).openFile(window.app.vault.getAbstractFileByPath("enter.md"), { state: { mode: "source", source: false } });
        await new Promise((r) => setTimeout(r, 600));
        const ed = window.app.workspace.activeEditor.editor;
        ed.setValue(line);
        ed.setCursor({ line: 0, ch: at });
        ed.focus();
        await new Promise((r) => setTimeout(r, 300));
      }, { enabled, shiftPlainEnter, line, at });
      await win.keyboard.press(key);
      await win.waitForTimeout(400);
      return win.evaluate(() => window.app.workspace.activeEditor.editor.getValue());
    };
    const plain = await run(false, "Enter");
    const shift = await run(true, "Shift+Enter");
    const smart = await run(true, "Enter");
    const own = await run(true, "Shift+Enter", false);
    const base = await run(false, "Shift+Enter", false);
    console.log("Smart Enter выключен, Enter:      " + JSON.stringify(plain));
    console.log("Smart Enter включён, Shift+Enter: " + JSON.stringify(shift));
    console.log("Smart Enter включён, Enter:       " + JSON.stringify(smart));
    console.log("тумблер выключен, Shift+Enter:     " + JSON.stringify(own) + " (Obsidian без Smart Enter: " + JSON.stringify(base) + ")");
    const ok = shift === plain && smart !== plain && plain !== line && own === base && own !== plain;
    console.log(ok ? "ok: Shift+Enter — обычный Enter" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * Снимок строки README настоящим Obsidian (его пункт «Новое» 2026-09-29:
   * «изображение инлайн строки выглядит некрасиво… без всех фишек плагина»).
   * Чистый vault — стартовый набор и тема Obsidian по умолчанию, то есть то,
   * что увидит новый человек. Каретка стоит на соседней строке: на своей
   * строке Obsidian показывает разметку. Снимки — в `docs/media/readme/`,
   * другая папка — `IO_SHOTS`.
   */
  async "clean-readme-shot"(win) {
    const out = process.env.IO_SHOTS || path.join(ROOT, "docs", "media", "readme");
    fs.mkdirSync(out, { recursive: true });
    const n = await openAt(win, "readme.md", README_LINE);
    if (n < 0) throw new Error("строки README нет в заметке");
    /* Снимок вдвое плотнее экрана при той же вёрстке — для экрана высокой
       плотности; README показывает его вдвое меньше. Зум окна сужает строку, и
       она переносится; подмена плотности через Playwright Electron не берёт. */
    const cdp = await win.context().newCDPSession(win);
    let ok = true;
    for (const [theme, dark, file] of [["moonstone", false, "line-light.png"], ["obsidian", true, "line-dark.png"]]) {
      const box = await win.evaluate(async ({ theme, n }) => {
        window.app.changeTheme(theme);
        const ed = window.app.workspace.activeEditor.editor;
        ed.setCursor({ line: n + 1, ch: 0 });
        await new Promise((r) => setTimeout(r, 1500));
        const view = ed.cm;
        /* Каретка соседней строки попадает в поля снимка — фокус снимается. */
        view.contentDOM.blur();
        await new Promise((r) => setTimeout(r, 300));
        const at = view.domAtPos(view.state.doc.line(n + 1).from).node;
        const line = (at.nodeType === 1 ? at : at.parentElement).closest(".cm-line");
        const range = document.createRange();
        range.selectNodeContents(line);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        const outer = line.getBoundingClientRect();
        const left = Math.min(...rects.map((r) => r.left));
        const right = Math.max(...rects.map((r) => r.right));
        return {
          clip: { x: Math.max(0, left - 20), y: outer.top - 12, width: right - left + 40, height: outer.height + 24 },
          dark: document.body.classList.contains("theme-dark"),
          ours: !!line.querySelector("[class*='io-']") || /(^|\s)io-/.test(line.className),
          text: line.textContent,
        };
      }, { theme, n });
      /* Контроль «сняли то, что надо» (У-152): тема сменилась, строку рисует плагин. */
      console.log(file + ":", "тема тёмная —", box.dark, "| наше оформление —", box.ours, "| текст:", box.text);
      if (box.dark !== dark || !box.ours) { ok = false; continue; }
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...box.clip, scale: 2 } });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, "base64"));
    }
    console.log(ok ? "ok: снимки в " + out : "РАСХОДИТСЯ: тема не сменилась или строку рисует не плагин");
    return ok;
  },

  /*
   * Ещё два снимка README (его правки к тесту 2 цикла 105): та же строка
   * «после настройки» — `#todo` знаком 🎯 (`Show` = custom), `#high` пустым
   * пузырём, полосы Block, Tag Bars у Priority, Block на 70 %, как у него в
   * `data.json`, — и строка `your text` с открытым tagWheel и скроллером.
   * Чистый vault со стартовым набором; снимки — в `docs/media/readme/`.
   */
  async "clean-readme-extra"(win) {
    const out = process.env.IO_SHOTS || path.join(ROOT, "docs", "media", "readme");
    fs.mkdirSync(out, { recursive: true });
    const patch = await win.evaluate(async () => {
      const p = window.app.plugins.plugins["inline-overhaul"];
      const byTag = p.getConfig().visual.tags.byTag;
      const set = (f, t, v) => Object.assign(byTag[f]["#" + t], v);
      set("Status", "todo", { fillColor: "#cbd4fb", textColor: "", visibility: "custom", customText: "\u{1F3AF}" });
      set("Priority", "high", { fillColor: "#d11f1f", visibility: "empty" });
      p.setConfigPatch({ visual: {
        tags: { byTag, emptyBubblePct: 35, textSizePctLeft: 70, textSizePctRight: 70,
          blockFill: { enabled: true, direction: "both", color: "#d1c1f5", opacity: 29, heightPct: 100, widthPct: 100 } },
        tagBars: { active: true, fieldId: "Priority", tagVisibility: true, stripesToShow: 3, thickness: 2, spacing: 20, childOffset: 12, lineGap: 2 },
        tagWheel: { scroller: { enabled: true } },
      } }, "bench:readme-extra");
      await new Promise((r) => setTimeout(r, 800));
      const c = p.getConfig().visual;
      return { bars: c.tagBars.active, size: c.tags.textSizePctLeft, todo: c.tags.byTag.Status["#todo"].visibility };
    });
    /* Контроль «правка доехала» (У-152). */
    console.log("настройки:", JSON.stringify(patch));
    if (!patch.bars || patch.size !== 70 || patch.todo !== "custom") { console.log("РАСХОДИТСЯ: настройки не записались"); return false; }
    const cdp = await win.context().newCDPSession(win);
    let ok = true;
    const shoot = async (file, lineText, wheel) => {
      const n = await openAt(win, wheel ? "wheel.md" : "readme.md", lineText);
      if (n < 0) { console.log("РАСХОДИТСЯ: нет строки " + lineText); ok = false; return; }
      for (const [theme, dark, suffix] of [["moonstone", false, "light"], ["obsidian", true, "dark"]]) {
        const box = await win.evaluate(async ({ theme, n, wheel }) => {
          window.app.changeTheme(theme);
          const ed = window.app.workspace.activeEditor.editor;
          if (wheel) {
            ed.setCursor({ line: n, ch: ed.getLine(n).length });
            ed.focus();
            await new Promise((r) => setTimeout(r, 600));
            window.app.commands.executeCommandById("inline-overhaul:open-tagwheel-left");
          } else {
            ed.setCursor({ line: n + 1, ch: 0 });
          }
          await new Promise((r) => setTimeout(r, 1500));
          const view = ed.cm;
          if (!wheel) { view.contentDOM.blur(); await new Promise((r) => setTimeout(r, 300)); }
          const at = view.domAtPos(view.state.doc.line(n + 1).from).node;
          const line = (at.nodeType === 1 ? at : at.parentElement).closest(".cm-line");
          const range = document.createRange();
          range.selectNodeContents(line);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          const outer = line.getBoundingClientRect();
          const extra = [...document.querySelectorAll(".io-twscroller--shown")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0);
          const all = rects.concat(extra);
          const left = Math.min(...all.map((r) => r.left));
          const right = Math.max(...all.map((r) => r.right));
          const top = Math.min(outer.top, ...extra.map((r) => r.top));
          const bottom = Math.max(outer.bottom, ...extra.map((r) => r.bottom));
          return {
            clip: { x: Math.max(0, left - 20), y: top - 12, width: right - left + 40, height: bottom - top + 24 },
            dark: document.body.classList.contains("theme-dark"),
            ours: !!line.querySelector("[class*='io-']") || /(^|\s)io-/.test(line.className),
            wheel: !!document.querySelector(".io-twline") && extra.length > 0,
            text: line.textContent,
          };
        }, { theme, n, wheel });
        const name = file + "-" + suffix + ".png";
        console.log(name + ":", "тема тёмная —", box.dark, "| наше оформление —", box.ours, wheel ? "| tagWheel со скроллером — " + box.wheel : "", "| текст:", box.text);
        if (box.dark !== dark || !box.ours || (wheel && !box.wheel)) { ok = false; continue; }
        const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { ...box.clip, scale: 2 } });
        fs.writeFileSync(path.join(out, name), Buffer.from(shot.data, "base64"));
        if (wheel) {
          await win.keyboard.press("Escape");
          await win.waitForTimeout(500);
        }
      }
    };
    await shoot("line-tuned", README_LINE, false);
    await shoot("tagwheel", "- your text", true);
    console.log(ok ? "ok: снимки в " + out : "РАСХОДИТСЯ: см. строки выше");
    return ok;
  },

  /*
   * H1.6 прогона 2026-10-02: «пустой пузырь ниже соседей (20 против 22.8 px)».
   * Чистый vault, строка README, у `#high` вид `empty`; у каждого пузыря
   * строки — высота и середина по вертикали. Пустой обязан совпасть с
   * соседями по обеим величинам с точностью до полупикселя.
   */
  async "clean-empty-bubble"(win) {
    const set = await win.evaluate(async () => {
      const p = window.app.plugins.plugins["inline-overhaul"];
      const byTag = p.getConfig().visual.tags.byTag;
      Object.assign(byTag.Priority["#high"], { visibility: "empty" });
      p.setConfigPatch({ visual: { tags: { byTag } } }, "bench:empty-bubble");
      await new Promise((r) => setTimeout(r, 800));
      return p.getConfig().visual.tags.byTag.Priority["#high"].visibility;
    });
    if (set !== "empty") { console.log("КОНТРОЛЬ: вид empty не записался"); return false; }
    const n = await openAt(win, "readme.md", README_LINE);
    await win.evaluate((n) => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: n + 1, ch: 0 }); ed.cm.contentDOM.blur(); }, n);
    await win.waitForTimeout(1000);
    const boxes = await win.evaluate(() => [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line .io-tagbubble")].map((b) => {
      const r = b.getBoundingClientRect();
      return { empty: b.classList.contains("io-tagbubble--empty"), token: b.getAttribute("data-io-tag-token"), h: Math.round(r.height * 10) / 10, mid: Math.round((r.top + r.bottom) / 2 * 10) / 10 };
    }));
    for (const b of boxes) console.log("  " + (b.empty ? "пустой " : "        ") + b.token + ": высота " + b.h + ", середина " + b.mid);
    const empty = boxes.filter((b) => b.empty);
    const full = boxes.filter((b) => !b.empty);
    if (!empty.length || !full.length) { console.log("КОНТРОЛЬ: нет пустого или нет соседа — мерить нечего"); return false; }
    const ok = empty.every((e) => full.every((f) => Math.abs(e.h - f.h) <= 0.5 && Math.abs(e.mid - f.mid) <= 0.5));
    console.log(ok ? "ok: пустой пузырь вровень с соседями" : "РАСХОДИТСЯ: пустой пузырь другой высоты или на другом уровне");
    return ok;
  },

  /*
   * H1.5 прогона 2026-10-02: «тёмная тема: текст полосы 2.1–2.8:1 при пороге
   * 3:1». Чистый vault со стартовым набором, обе темы по умолчанию; строка
   * README и строка под открытым tagWheel со скроллером. У каждого узла с
   * текстом внутри нашего оформления — контраст цвета текста к фону, сложенному
   * по предкам, с прозрачностью предков. Порог — `CONTRAST_FLOOR` панели.
   * Печатает всё ниже порога; светлая тема — сторона сверки.
   */
  async "clean-dark-contrast"(win) {
    await win.evaluate(async () => {
      const p = window.app.plugins.plugins["inline-overhaul"];
      p.setConfigPatch({ visual: { tagWheel: { scroller: { enabled: true } } } }, "bench:dark-contrast");
      await new Promise((r) => setTimeout(r, 500));
    });
    const measure = (scope) => win.evaluate((scope) => {
      const rgba = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
      const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const bgOf = (el) => {
        const layers = [];
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const c = rgba(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
        }
        let base = { r: 255, g: 255, b: 255, a: 1 };
        if (!layers.length || layers[layers.length - 1].a < 1) base = rgba(getComputedStyle(document.body).backgroundColor) || base;
        for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
        return base;
      };
      const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity || 1); return o; };
      const roots = [...document.querySelectorAll(scope)];
      const out = [];
      for (const root of roots) {
        for (const el of [root, ...root.querySelectorAll("*")]) {
          const own = [...el.childNodes].filter((t) => t.nodeType === 3).map((t) => t.textContent).join("").trim();
          if (!own) continue;
          const cls = String(el.className || "");
          const inOurs = /(^|\s)io-|inline-overhaul/.test(cls) || !!el.closest("[class*='io-'], [class*='inline-overhaul']");
          if (!inOurs) continue;
          const bg = bgOf(el);
          const fg0 = rgba(getComputedStyle(el).color) || { r: 0, g: 0, b: 0, a: 1 };
          const fg = over({ ...fg0, a: fg0.a * opacityOf(el) }, bg);
          out.push({ text: own.slice(0, 24), cls: cls.slice(0, 60), ratio: Math.round(ratio(fg, bg) * 10) / 10, fg: getComputedStyle(el).color, bg: [bg.r, bg.g, bg.b].map(Math.round).join(","), op: Math.round(opacityOf(el) * 100) / 100 });
        }
      }
      return out;
    }, scope);
    let darkLow = 0, lightLow = 0, seen = 0;
    for (const [theme, dark] of [["moonstone", false], ["obsidian", true]]) {
      await win.evaluate((t) => window.app.changeTheme(t), theme);
      await win.waitForTimeout(800);
      const nr = await openAt(win, "readme.md", README_LINE);
      await win.evaluate(async (n) => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: n + 1, ch: 0 }); ed.cm.contentDOM.blur(); }, nr);
      await win.waitForTimeout(800);
      const line = await measure(".workspace-leaf.mod-active .cm-line");
      const nw = await openAt(win, "wheel.md", "- your text");
      await win.evaluate(async (n) => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: n, ch: ed.getLine(n).length }); ed.focus(); }, nw);
      await win.waitForTimeout(600);
      await win.evaluate(() => window.app.commands.executeCommandById("inline-overhaul:open-tagwheel-left"));
      await win.waitForTimeout(1500);
      const wheel = await measure(".workspace-leaf.mod-active .cm-line, .io-twscroller--shown");
      await win.keyboard.press("Escape");
      await win.waitForTimeout(500);
      /* Цена вариантов умолчания: переменные темы против той же заливки полосы. */
      const vars = await win.evaluate(() => {
        const rgba = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
        const over = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
        const host = document.querySelector(".workspace-leaf.mod-active .cm-content") || document.body;
        const probe = document.createElement("span");
        host.appendChild(probe);
        const at = (v, prop) => { probe.style.cssText = prop + ": var(" + v + ")"; return rgba(getComputedStyle(probe)[prop === "color" ? "color" : "backgroundColor"]); };
        const page = rgba(getComputedStyle(document.body).backgroundColor);
        const band = over(at("--text-highlight-bg", "background-color"), page);
        const out = {};
        for (const v of ["--text-normal", "--text-muted", "--text-faint", "--text-accent", "--text-accent-hover", "--interactive-accent", "--text-on-accent"]) {
          const c = over(at(v, "color"), band);
          const x = lum(c), y = lum(band);
          out[v] = Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 10) / 10;
        }
        probe.remove();
        return out;
      });
      console.log("  переменные темы на заливке полосы: " + Object.entries(vars).map(([k, v]) => k + " " + v).join(", "));
      const all = line.concat(wheel).filter((x) => !/rgba\(0, 0, 0, 0\)/.test(x.fg));
      seen += all.length;
      const low = all.filter((x) => x.ratio < 3);
      if (dark) darkLow = low.length; else lightLow = low.length;
      console.log("\n" + theme + (dark ? " (тёмная)" : " (светлая)") + ": узлов с текстом " + all.length + ", ниже 3:1 — " + low.length);
      for (const x of low) console.log("  " + x.ratio + ":1  «" + x.text + "»  " + x.cls + "  текст " + x.fg + " фон " + x.bg + " прозрачность " + x.op);
    }
    if (!seen) { console.log("КОНТРОЛЬ: ни одного узла с текстом — мерить нечего"); return false; }
    const ok = darkLow === 0;
    console.log(ok ? "ok: в тёмной теме всё не ниже 3:1" : "РАСХОДИТСЯ: в тёмной теме " + darkLow + " узлов ниже 3:1 (в светлой " + lightLow + ")");
    return ok;
  },

  /*
   * BUGHUNT R2 (S1): окна панели встают в окно настроек. Obsidian 1.13
   * открывает настройки отдельным окном; «Add Field» ставил окно в главное,
   * за настройками. Чистый vault, щелчок настоящей мышью по кнопке панели.
   */
  async "clean-settings"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const pages = () => browser.contexts().flatMap((c) => c.pages());
    let host = null;
    for (let i = 0; i < 20 && !host; i++) {
      for (const pg of pages()) {
        if (await pg.evaluate(() => !!document.querySelector(".io-tabstrip, [class*=io-tab]")).catch(() => false)) host = pg;
      }
      if (!host) await win.waitForTimeout(500);
    }
    if (!host) throw new Error("панель настроек не нашлась ни в одном окне");
    const popout = host !== win;
    const clickText = async (pg, text) => {
      const box = await pg.evaluate((t) => {
        const vis = (x) => x.getBoundingClientRect().width > 0;
        const n = [...document.querySelectorAll("button, [role=tab]")].filter((x) => x.textContent.trim() === t && vis(x)).pop()
          || [...document.querySelectorAll("div, span")].filter((x) => x.children.length === 0 && x.textContent.trim() === t && vis(x)).pop();
        if (!n) return null;
        n.scrollIntoView({ block: "center" });
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, text);
      if (!box) throw new Error("нет «" + text + "» в окне настроек");
      /* `IO_DOMCLICK=1` — щелчок узлом, без фокуса окна: так его делал прогон BUGHUNT. */
      if (process.env.IO_DOMCLICK) await pg.evaluate((t) => { const n = [...document.querySelectorAll("button, [role=tab]")].filter((x) => x.textContent.trim() === t).pop(); if (n) n.click(); }, text);
      else await pg.mouse.click(box.x, box.y);
      await pg.waitForTimeout(700);
    };
    await clickText(host, "Tags & PKM");
    /* Главное окно — последнее, где был фокус: так бывает, когда человек
       вернулся в заметку, а потом нажал кнопку в настройках, не дав окну
       настроек события фокуса (клавиатура, щелчок узлом). Obsidian ставит
       окна туда, где был последний фокус (`activeWindow`, `app.js` 1.13.7). */
    await win.evaluate(() => { window.activeWindow = window; window.activeDocument = document; });
    await clickText(host, "Add Field");
    const where = [];
    for (const pg of pages()) {
      const has = await pg.evaluate(() => [...document.querySelectorAll(".modal-container")].some((m) => /Add a Field/i.test(m.textContent))).catch(() => false);
      if (has) where.push(pg === host ? "окно настроек" : (pg === win ? "главное окно" : "другое окно"));
    }
    console.log("настройки открыты отдельным окном:", popout);
    console.log("окно «Add a Field» открылось в:", where.join(", ") || "нигде");
    const ok = where.length === 1 && where[0] === "окно настроек";
    console.log(ok ? "ok: окно панели там, где панель" : "РАСХОДИТСЯ: окно панели не в окне настроек");
    return ok;
  },

  /*
   * Окно `Add a Field` — его заказ 2026-09-27. Снимки трёх типов кладутся в
   * `IO_SHOTS` (папка), затем Tag и Element проходят до `Add Field`, и конфиг
   * спрашивается: Block, Values с цветом, знак и вид значения.
   */
  async "new-field"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Tags & PKM");
    const shots = process.env.IO_SHOTS || "";
    const shot = async (name) => {
      if (!shots) return;
      const m = await host.$(".modal:has(.io-nf)");
      if (m) await m.screenshot({ path: path.join(shots, name + ".png") });
    };
    const openForm = async () => {
      await clickIn(host, "Add Field");
      await host.waitForSelector(".io-nf", { timeout: 5000 });
    };
    const type = async (aria, text) => {
      const sel = "input[aria-label=\"" + aria + "\"]";
      await host.fill(sel, text);
      await host.waitForTimeout(150);
    };
    const card = async (n) => { await host.click(".io-nf__type:nth-child(" + n + ")"); await host.waitForTimeout(200); };
    /* Tag. */
    await openForm();
    await type("Name of the new Field", "mood");
    await type("New Value", "calm");
    await host.press("input[aria-label=\"New Value\"]", "Enter");
    await type("New Value", "busy");
    await host.press("input[aria-label=\"New Value\"]", "Enter");
    /* Порядок Values за ручку (тест 3 цикла 99): `busy` на место `calm` и обратно. */
    await host.dragAndDrop(".io-nf__chip:nth-child(2) > .io-grip", ".io-nf__chip:nth-child(1)");
    await host.waitForTimeout(300);
    const dragged = await host.evaluate(() => [...document.querySelectorAll(".io-nf__chiptext")].map((n) => n.textContent));
    await host.dragAndDrop(".io-nf__chip:nth-child(2) > .io-grip", ".io-nf__chip:nth-child(1)");
    await host.waitForTimeout(300);
    /* Скроллер у Left — внутри рамки предпросмотра; подпись Preview сворачивает. */
    const inside = await host.evaluate(() => {
      const p = document.querySelector(".io-nf__preview").getBoundingClientRect();
      const w = document.querySelector(".io-nf .io-wheelpanel").getBoundingClientRect();
      return w.left >= p.left && w.right <= p.right;
    });
    await host.click(".io-nf__pcap");
    await host.waitForTimeout(150);
    const folded = await host.evaluate(() => getComputedStyle(document.querySelector(".io-nf__pbody")).display === "none");
    await host.click(".io-nf__pcap");
    await host.waitForTimeout(150);
    /* Заливка и цвет текста у первого Value — точками в фишке (тест 3 цикла 98). */
    await host.evaluate(() => {
      const set = (sel, c) => { const d = document.querySelector(sel); d.value = c; d.dispatchEvent(new Event("input")); };
      set(".io-nf__dot--fill", "#44aa66");
      set(".io-nf__dot--text", "#112233");
    });
    await type("YAML property for mood", "mood");
    await host.waitForTimeout(200);
    /* Курсор скроллера шагает сам: два снимка предпросмотра через шаг различаются. */
    const cursorAt = () => host.evaluate(() => { const n = document.querySelector(".io-nf .io-wheelval--on"); return n ? n.textContent : null; });
    const firstCursor = await cursorAt();
    await host.waitForTimeout(1600);
    const nextCursor = await cursorAt();
    const layout = await host.evaluate(() => {
      const box = (sel) => { const n = document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
      return { preview: box(".io-nf__preview"), body: box(".io-nf__body"), add: box(".io-nf .io-btn--cta"), modal: box(".modal:has(.io-nf)") };
    });
    await shot("tag");
    await host.click(".io-nf .io-btn--cta");
    await host.waitForTimeout(800);
    /* Link: заметка из подсказки платформы — щелчком, и `Use as MOC: No`. Заметка
       свободная: `Man1` уже Value у `People`, а одно Value двум Field не принадлежит. */
    await openForm();
    await card(2);
    await type("Name of the new Field", "client");
    await host.click("input[aria-label=\"New Value\"]");
    await host.keyboard.type("test", { delay: 40 });
    await host.waitForTimeout(500);
    const suggested = await host.evaluate(() => [...document.querySelectorAll(".suggestion-container .suggestion-item")].map((n) => n.textContent));
    const hit = (await host.$$(".suggestion-container .suggestion-item")).length
      ? await host.evaluateHandle(() => [...document.querySelectorAll(".suggestion-container .suggestion-item")].find((n) => n.textContent.trim() === "testing"))
      : null;
    if (hit && (await hit.evaluate((n) => !!n))) { await hit.asElement().click(); await host.waitForTimeout(400); }
    const chips = await host.evaluate(() => [...document.querySelectorAll(".io-nf__chiptext")].map((n) => n.textContent));
    const no = await host.evaluate(() => { const b = [...document.querySelectorAll(".io-nf .io-seg__btn")].find((n) => n.textContent.trim() === "No"); if (!b) return null; b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (no) { await host.mouse.click(no.x, no.y); await host.waitForTimeout(400); }
    const mocOn = await host.evaluate(() => { const b = [...document.querySelectorAll(".io-nf .io-seg__btn--on")].map((n) => n.textContent.trim()); return b; });
    await shot("link");
    await host.click(".io-nf .io-btn--cta");
    await host.waitForTimeout(800);
    /* Element: дата и время, момент нажатия. */
    await openForm();
    await card(3);
    await type("Name of the new Field", "when");
    await type("Emoji of the new Field", "⏰");
    const placeholder = await host.evaluate(() => document.querySelector("input[aria-label=\"Emoji of the new Field\"]").getAttribute("placeholder"));
    await clickIn(host, "Date and time");
    await shot("element");
    await host.click(".io-nf .io-btn--cta");
    await host.waitForTimeout(800);
    const got = await win.evaluate(() => {
      const cfg = window.app.plugins.plugins["inline-overhaul"].getConfig();
      const f = cfg.pkm.fields.tags.fields.find((x) => x.id === "mood");
      return {
        left: cfg.pkm.fields.order.left.includes("mood"),
        values: f ? f.values.map((v) => (v && v.token) || v) : null,
        color: cfg.visual.tags.byTag.mood,
        property: cfg.pkm.fields.order.propertiesByField.mood,
        moc: cfg.pkm.fields.order.useAsMoc,
        client: (cfg.pkm.fields.links.fields.find((x) => x.id === "client") || { values: [] }).values.map((v) => (v && v.token) || v),
        when: cfg.pkm.fields.elements.byField.when,
        commands: Object.keys(window.app.commands.commands).filter((k) => /inline-overhaul:(mood|when)-/.test(k)),
      };
    });
    Object.assign(got, { firstCursor, nextCursor, layout, suggested: suggested.slice(0, 5), chips, placeholder, mocOn, dragged, inside, folded });
    /* Конец дороги — строка: новая команда ставит первое Value в свой Block. */
    await host.keyboard.press("Escape").catch(() => {});
    got.line = await win.evaluate(async () => {
      const a = window.app;
      window.app.setting.close();
      const f = await a.vault.create("nf.md", "- купить хлеб\n");
      await a.workspace.getLeaf(false).openFile(f, { state: { mode: "source", source: false } });
      await new Promise((r) => setTimeout(r, 500));
      const e = a.workspace.activeEditor.editor;
      e.setCursor({ line: 0, ch: 13 });
      a.commands.executeCommandById("inline-overhaul:mood-next");
      await new Promise((r) => setTimeout(r, 500));
      return e.getLine(0);
    });
    console.log(JSON.stringify(got, null, 1));
    const colors = JSON.stringify(got.color || {});
    const ok = got.left && got.values && got.values.join() === "#calm,#busy"
      && colors.includes("#44aa66") && colors.includes("#112233") && got.property === "mood"
      && got.firstCursor && got.nextCursor && got.firstCursor !== got.nextCursor
      /* Предпросмотр внизу и виден: кнопки под ним, оба внутри окна. */
      && got.layout.preview && got.layout.add && got.layout.modal && got.layout.add.top >= got.layout.preview.bottom
      && got.layout.add.bottom <= got.layout.modal.bottom + 1
      && got.suggested.length > 0 && got.chips.includes("[[testing]]") && got.client.includes("testing")
      && got.moc && got.moc.client === false
      && !/\p{Extended_Pictographic}/u.test(String(got.placeholder || ""))
      && got.when && got.when.emoji === "⏰" && got.when.format === "YYYY-MM-DD HH:mm" && got.when.increment.mode === "command"
      && got.commands.length >= 4 && got.line === "- #calm :: купить хлеб"
      && got.dragged.join() === "#busy,#calm" && got.inside && got.folded;
    console.log(ok ? "ok: окно заводит Field с главным сразу" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * Его замечания цикла 100: у Link в правой колонке `Add Value` показывает
   * заметки vault (выбор встаёт в Values), у Prefix — выбиралка с видом
   * чекбоксов в его теме, а в окне `Add a Field` строка добавления под фишками.
   * `IO_SHOTS` — снимок выбиралки Prefix.
   */
  /*
   * Снимок блока Values Element-списка на его конфиге (тест 1 цикла 105):
   * первый Field, у которого редактор рисует список, закрытая и открытая
   * подсказка. Снимки — в `IO_SHOTS`, по умолчанию во временную папку.
   */
  async "elist-shot"(win, browser) {
    const out = process.env.IO_SHOTS || path.join(os.tmpdir(), "io-elist-shot");
    fs.mkdirSync(out, { recursive: true });
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Tags & PKM");
    const name = await host.evaluate(async () => {
      for (const n of [...document.querySelectorAll(".io-fields__name")]) {
        n.click();
        await new Promise((r) => setTimeout(r, 500));
        if (document.querySelector(".io-elist")) return n.textContent.trim();
      }
      return "";
    });
    if (!name) { console.log("РАСХОДИТСЯ: ни у одного Field нет списка Values"); return false; }
    const stack = await host.$(".io-item--stack");
    if (!stack) { console.log("РАСХОДИТСЯ: у " + name + " Values не над строками"); return false; }
    await stack.scrollIntoViewIfNeeded();
    await stack.screenshot({ path: path.join(out, "elist.png") });
    const help = await stack.$(".io-help");
    if (help) { await help.click(); await host.waitForTimeout(300); await stack.screenshot({ path: path.join(out, "elist-tip.png") }); }
    /* Контроль рамки: её рисует `.io-vals`, и у темы свои правила на тот же узел. */
    const frame = await host.evaluate(() => {
      const b = document.querySelector(".io-elist");
      const cs = getComputedStyle(b);
      const rules = [];
      for (const sh of document.styleSheets) {
        let list = [];
        try { list = [...sh.cssRules]; } catch (_) { /* проба: чужой лист без доступа */ }
        for (const r of list) if (r.selectorText && b.matches(r.selectorText) && /border/.test(r.cssText)) rules.push((sh.href || "inline").slice(-30) + " " + r.cssText.slice(0, 160));
      }
      return { top: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor, left: cs.borderLeftWidth + " " + cs.borderLeftStyle, cls: b.className, rules };
    });
    console.log("рамка:", JSON.stringify(frame, null, 1));
    console.log("ok: " + name + ", снимки в " + out);
    return true;
  },

  async "values-extras"(win, browser) {
    await win.evaluate(async () => {
      const a = window.app;
      await a.vault.create("vx-note.md", "");
      a.setting.open();
      a.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Tags & PKM");
    await host.evaluate(() => { const n = [...document.querySelectorAll(".io-fields__name")].find((x) => x.textContent.trim() === "People"); if (n) n.click(); });
    await host.waitForTimeout(700);
    const addSel = "input[aria-label=\"New Value for People\"]";
    if (!(await host.$(addSel))) {
      const seen = await host.evaluate(() => [...document.querySelectorAll(".io-vals__foot input")].map((x) => x.getAttribute("aria-label")));
      throw new Error("нет поля нового Value у People; есть: " + JSON.stringify(seen));
    }
    /* Поле внизу окна — там платформа уводила список наверх (тест 1 цикла 101). */
    await host.evaluate((sel) => { document.querySelector(sel).scrollIntoView({ block: "end" }); }, addSel);
    await host.click(addSel);
    await host.waitForTimeout(500);
    const below = () => host.evaluate((sel) => {
      const i = document.querySelector(sel).getBoundingClientRect();
      const box = [...document.querySelectorAll(".suggestion-container")].find((n) => n.offsetParent !== null);
      if (!box) return null;
      const r = box.getBoundingClientRect();
      return r.top >= i.bottom - 1;
    }, addSel);
    const belowLong = await below();
    await host.keyboard.type("vx-no", { delay: 40 });
    await host.waitForTimeout(500);
    const belowShort = await below();
    const suggested = await host.evaluate(() => [...document.querySelectorAll(".suggestion-container .suggestion-item")].map((n) => n.textContent.trim()));
    const hit = await host.evaluateHandle(() => [...document.querySelectorAll(".suggestion-container .suggestion-item")].find((n) => n.textContent.trim() === "vx-note"));
    if (await hit.evaluate((n) => !!n)) { await hit.asElement().click(); await host.waitForTimeout(700); }
    const values = await win.evaluate(() => {
      const cfg = window.app.plugins.plugins["inline-overhaul"].getConfig();
      return cfg.pkm.fields.links.fields.find((f) => f.id === "People").values.map((v) => (v && v.token) || v);
    });
    /* Prefix у Man1: выбиралка, вид чекбоксов от темы, выбор `[x]`. */
    const pfxSel = "input[aria-label=\"Prefix for [[Man1]]\"]";
    await host.click(pfxSel);
    await host.waitForTimeout(400);
    const pfx = await host.evaluate(() => {
      const panel = [...document.querySelectorAll(".io-pfx")].find((n) => !n.hidden);
      if (!panel) return null;
      const r = panel.getBoundingClientRect();
      const boxes = [...panel.querySelectorAll(".task-list-item-checkbox")];
      /* Тема рисует знаки по `data-task`: у разных знаков разный вид. */
      const looks = new Set(boxes.map((b) => { const c = getComputedStyle(b); const m = getComputedStyle(b, "::after"); return [c.backgroundColor, c.borderColor, m.content, m.backgroundColor, m.webkitMaskImage].join("|"); }));
      const grid = panel.querySelector(".io-pfx__grid");
      const items = [...panel.querySelectorAll(".io-pfx__item")];
      const cols = new Set(items.slice(0, 3).map((n) => Math.round(n.getBoundingClientRect().top))).size === 1
        && Math.round(items[3].getBoundingClientRect().left) === Math.round(items[0].getBoundingClientRect().left);
      /* Чекбокс вровень с подписью под ним и по центру своего текста. */
      let worst = 0;
      for (const it of items.slice(1)) {
        const b = it.querySelector(".task-list-item-checkbox").getBoundingClientRect();
        const t = it.querySelector("li > span:last-child").getBoundingClientRect();
        const c = it.querySelector(".io-pfx__code").getBoundingClientRect();
        worst = Math.max(worst, Math.abs(b.left - c.left), Math.abs((b.top + b.bottom) / 2 - (t.top + t.bottom) / 2));
      }
      return { items: items.length, boxes: boxes.length, looks: looks.size, width: r.width, height: r.height,
        threeInRow: cols, sideScroll: grid.scrollWidth > grid.clientWidth + 1, worstPx: Math.round(worst * 10) / 10 };
    });
    const shots = process.env.IO_SHOTS || "";
    if (shots) { const n = await host.$(".io-pfx:not([hidden])"); if (n) await n.screenshot({ path: path.join(shots, "prefix-picker.png") }); }
    await host.evaluate(() => { const b = [...document.querySelectorAll(".io-pfx:not([hidden]) .io-pfx__item")].find((n) => n.getAttribute("aria-label") === "[x] Done"); if (b) b.click(); });
    await host.waitForTimeout(700);
    const checkbox = await win.evaluate(() => {
      const cfg = window.app.plugins.plugins["inline-overhaul"].getConfig();
      return JSON.stringify((cfg.pkm.prefixRules || {}).checkboxByFieldValue || null);
    });
    /* Окно `Add a Field`: строка добавления под фишками. */
    await clickIn(host, "Add Field");
    await host.waitForSelector(".io-nf", { timeout: 5000 });
    await host.fill("input[aria-label=\"New Value\"]", "calm");
    await host.press("input[aria-label=\"New Value\"]", "Enter");
    const stacked = await host.evaluate(() => {
      const c = document.querySelector(".io-nf__chips").getBoundingClientRect();
      const a = document.querySelector(".io-nf__addrow").getBoundingClientRect();
      return a.top >= c.bottom - 1;
    });
    await host.keyboard.press("Escape").catch(() => {});
    /* Конец дороги — строка: `People next` доходит до нового Value, а у `Man1` встаёт чекбокс. */
    const lines = await win.evaluate(async () => {
      const a = window.app;
      a.setting.close();
      const run = async (name, text) => {
        const f = await a.vault.create(name, text + "\n");
        await a.workspace.getLeaf(false).openFile(f, { state: { mode: "source", source: false } });
        await new Promise((r) => setTimeout(r, 500));
        const e = a.workspace.activeEditor.editor;
        e.setCursor({ line: 0, ch: e.getLine(0).length });
        a.commands.executeCommandById("inline-overhaul:people-next");
        await new Promise((r) => setTimeout(r, 500));
        return e.getLine(0);
      };
      return { next: await run("vx1.md", "- [[Woman1]] :: звонок"), box: await run("vx2.md", "- звонок") };
    });
    const got = { suggested: suggested.slice(0, 5), values, pfx, checkbox, stacked, lines, belowLong, belowShort };
    console.log(JSON.stringify(got));
    const ok = got.suggested.includes("vx-note") && got.values.includes("vx-note")
      && got.pfx && got.pfx.items > 20 && got.pfx.boxes > 20 && got.pfx.looks > 1 && got.stacked
      && got.belowLong === true && got.belowShort === true
      && got.pfx.threeInRow && !got.pfx.sideScroll && got.pfx.worstPx <= 1.5
      /* Чекбокс Value-ссылки — с В-248. */
      && got.lines.next === "- [[vx-note]] :: звонок" && got.lines.box === "- [x] [[Man1]] :: звонок";
    console.log(ok ? "ok: подсказка заметок, выбиралка Prefix, строка добавления под фишками" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * Его пункт 2026-09-27 к тесту 7: переименование Value-ссылки в панели
   * называет цену и по «Rename note and links» переименовывает заметку —
   * ссылки переписывает Obsidian. Копия его vault: Value `Man1` у `People`.
   */
  async "value-rename"(win, browser) {
    await win.evaluate(async () => {
      const a = window.app;
      await a.vault.create("vr.md", "- [[Man1]] :: звонок\n");
      a.setting.open();
      a.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const host = await settingsHost(win, browser);
    await clickIn(host, "Tags & PKM");
    await host.evaluate(() => { const n = [...document.querySelectorAll(".io-fields__name")].find((x) => x.textContent.trim() === "People"); if (n) n.click(); });
    await host.waitForTimeout(700);
    /* Набор настоящей клавиатурой, без Enter и без ухода из поля (его
       замечание к тесту 2 цикла 98): окно обязано открыться само, и имя
       допечатывается в нём. `IO_COMMIT=enter` — главное действие Enter-ом. */
    const sel = "input[aria-label=\"Value [[Man1]] of People\"]";
    if (!(await host.$(sel))) {
      const seen = await host.evaluate(() => [...document.querySelectorAll("input")].map((x) => x.getAttribute("aria-label")).filter((x) => /Value /.test(x || "")).slice(0, 12));
      throw new Error("нет поля Value Man1 у People; есть: " + JSON.stringify(seen));
    }
    /* В фокусе поле без скобок (его замечание к тесту 2 цикла 99). */
    await host.click(sel);
    await host.waitForTimeout(150);
    const bare = await host.evaluate(() => document.activeElement && document.activeElement.value);
    if (bare !== "Man1") { console.log("РАСХОДИТСЯ: в фокусе поле показывает " + JSON.stringify(bare) + ", а не Man1"); return false; }
    await host.keyboard.press("Control+A");
    await host.keyboard.type("Man7", { delay: 60 });
    await host.waitForTimeout(500);
    const said = await host.evaluate(() => {
      const m = [...document.querySelectorAll(".modal-container")].find((x) => /Rename the note too/.test(x.textContent));
      const input = m && m.querySelector("input");
      return m ? { text: m.textContent, name: input ? input.value : null } : null;
    });
    console.log("окно:", JSON.stringify(said));
    if (!said || said.name !== "Man7") { console.log("РАСХОДИТСЯ: окна цены нет или имя не допечаталось в нём"); return false; }
    if (process.env.IO_COMMIT === "enter") { await host.keyboard.press("Enter"); await host.waitForTimeout(700); } else
    await clickIn(host, "Rename note and links");
    await win.waitForTimeout(2500);
    const got = await win.evaluate(async () => {
      const a = window.app;
      const cfg = a.plugins.plugins["inline-overhaul"].getConfig();
      const people = cfg.pkm.fields.links.fields.find((f) => f.id === "People");
      return {
        note: !!a.vault.getAbstractFileByPath("Man7.md"),
        old: !!a.vault.getAbstractFileByPath("Man1.md"),
        line: await a.vault.read(a.vault.getAbstractFileByPath("vr.md")),
        values: people.values.map((v) => (v && v.token) || v),
      };
    });
    console.log(JSON.stringify(got));
    const ok = got.note && !got.old && got.line === "- [[Man7]] :: звонок\n" && got.values.includes("Man7") && !got.values.includes("Man1");
    console.log(ok ? "ok: заметка, ссылки и Value переименованы" : "РАСХОДИТСЯ");
    return ok;
  },

  /*
   * BUGHUNT S19: тумблер модуля командой при открытой панели — панель
   * показывает новое положение, а не прежнее до перехода по вкладкам.
   */
  async "clean-toggle"(win, browser) {
    await win.evaluate(async () => {
      window.app.setting.open();
      window.app.setting.openTabById("inline-overhaul");
      await new Promise((r) => setTimeout(r, 1500));
    });
    const pages = () => browser.contexts().flatMap((c) => c.pages());
    let host = null;
    for (const pg of pages()) {
      if (await pg.evaluate(() => !!document.querySelector(".io-tabstrip, [class*=io-tab]")).catch(() => false)) host = pg;
    }
    if (!host) throw new Error("панель настроек не нашлась");
    const state = () => host.evaluate(() => {
      const rows = [...document.querySelectorAll(".setting-item")].filter((r) => /Tags & PKM/.test(r.querySelector(".setting-item-name") ? r.querySelector(".setting-item-name").textContent : ""));
      const box = rows.map((r) => r.querySelector(".checkbox-container")).filter(Boolean)[0];
      return box ? box.classList.contains("is-enabled") : null;
    });
    const before = await state();
    await win.evaluate(() => window.app.commands.executeCommandById("inline-overhaul:toggle-feature-pkm"));
    await win.waitForTimeout(800);
    const after = await state();
    const cfg = await win.evaluate(() => window.app.plugins.plugins["inline-overhaul"].getConfig().features.pkm.enabled);
    console.log("тумблер до:", before, "после:", after, "в настройках:", cfg);
    const ok = before !== null && after === cfg && after !== before;
    console.log(ok ? "ok: панель показала новое положение" : "РАСХОДИТСЯ: панель показывает прежнее");
    return ok;
  },

  /* Пакет чистого vault: `node tools/obsidian_bench.js clean [id,id…]`. */
  async clean(win) {
    return runCases(win, process.argv[3] || "");
  },

  /* Эталоны заметки тестов на копии его vault и его настройках:
     `node tools/obsidian_bench.js mine [id,id…]`. */
  async mine(win) {
    return runCases(win, process.argv[3] || "", true);
  },

  /* Его заказ к тесту 2 цикла 96 (10.13.277): Value `222/123` пишется ссылкой с
     подписью, на экране видно `123`, щелчок открывает `222/123.md`. */
  async "link-folder-value"(win) {
    await openAt(win, "bench-folder.md", "- текст");
    const press = async () => {
      await win.evaluate(() => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: 0, ch: ed.getLine(0).length }); });
      await runCommand(win, "project-sub-next");
      await win.waitForTimeout(500);
      /* Каретку уводим со строки: Live Preview показывает запись ссылки, пока каретка на ней. */
      return win.evaluate(() => { const ed = window.app.workspace.activeEditor.editor; ed.replaceRange("\n", { line: 0, ch: ed.getLine(0).length }); ed.setCursor({ line: 1, ch: 0 }); return ed.getLine(0); });
    };
    const first = await press();
    await win.waitForTimeout(600);
    const view = await win.evaluate(() => {
      const row = window.app.workspace.activeEditor.editor.cm.contentDOM.querySelector(".cm-line");
      const link = row && [...row.querySelectorAll("*")].filter((x) => !x.children.length && x.textContent.trim() === "123").pop();
      if (!link) return { screen: row ? row.textContent : null };
      const r = link.getBoundingClientRect();
      return { screen: row.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    let opened = null;
    if (view.x) {
      await win.mouse.click(view.x, view.y);
      await win.waitForTimeout(1200);
      opened = await win.evaluate(() => window.app.workspace.getActiveFile().path);
      await openAt(win, "bench-folder.md", "__нет__");
    }
    await win.evaluate(() => { const ed = window.app.workspace.activeEditor.editor; ed.replaceRange("", { line: 0, ch: ed.getLine(0).length }, { line: 1, ch: 0 }); });
    const second = await press();
    console.log("первое нажатие, строка:", first);
    console.log("на экране:", view.screen);
    console.log("щелчок открыл:", opened);
    console.log("второе нажатие, строка:", second);
    const ok = /\[\[222\/123\|123\]\]/.test(first) && !/222/.test(String(view.screen)) && opened === "222/123.md"
      && /\[\[333\/123\|123\]\]/.test(second) && !/222/.test(second);
    console.log(ok ? "ok: пишется с подписью, видно 123, щелчок ведёт в 222, круг идёт дальше" : "РАСХОДИТСЯ с заказом");
    return ok;
  },

  /*
   * Его `💬` к тесту 5 цикла 114: «в scroller я вижу Alias target, ожидал
   * увидеть Shown». Скроллер обязан подписывать ссылку тем, что Obsidian
   * покажет в строке: подписью, а у Value с папкой — именем без неё.
   */
  async "scroller-link-label"(win) {
    const n = await openAt(win, "bench-scroller.md", "- текст");
    if (n < 0) throw new Error("нет строки в bench-scroller.md");
    await win.evaluate((n) => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: n, ch: ed.getLine(n).length }); ed.focus(); }, n);
    await win.waitForTimeout(500);
    if (!(await runCommand(win, "open-tagwheel-right"))) throw new Error("команда tagWheel Right не выполнилась");
    await win.waitForTimeout(1200);
    const seen = await win.evaluate(() => ({
      open: !!(window.__tagWheelState && window.__tagWheelState.active),
      rows: [...document.querySelectorAll(".io-twscroller--shown .io-twscroller__row")].map((r) => r.textContent.trim()),
    }));
    await win.keyboard.press("Escape");
    await win.waitForTimeout(400);
    console.log("панель открылась:", seen.open, "| строки скроллера:", JSON.stringify(seen.rows));
    /* Контроль «скроллер открылся» (У-152): без строк мерить нечего. */
    if (!seen.open || !seen.rows.length) { console.log("КОНТРОЛЬ: скроллера нет — мерить нечего"); return false; }
    const all = seen.rows.join(" ");
    const ok = /Shown/.test(all) && !/Alias Target/.test(all) && /Deep/.test(all) && !/111\//.test(all);
    console.log(ok ? "ok: подпись ссылки, имя без папки" : "РАСХОДИТСЯ: скроллер подписывает ссылку не так, как строка");
    return ok;
  },

  /* A10 перечня 2026-09-30: ссылка с подписью в полосе tagWheel видна как `Ex]`.
     Обходит ячейки полосы стрелкой вправо, в каждой листает Value вниз и
     спрашивает экран: подпись `Shown` видна целиком, без скобок и цели. */
  /*
   * H3.1 прогона 2026-10-02: фокус в поле свойства — команда текста молчит,
   * как встроенная `Swap line up`. Контроль: фокус в тексте — та же команда
   * переставляет строку.
   */
  /*
   * H1.1 прогона 2026-10-02: контрол панели, который живёт в самой отрисовке
   * (`Empty tag bubble width`), доезжает до открытой заметки без касания.
   * Пишется тем же хранилищем, каким пишет контрол, — `pane.deps.store.set`.
   * Контроль — пузырь пустой и измерен (У-152).
   */
  async "panel-write-refresh"(win) {
    const n = await openAt(win, "bubble.md", "- #high :: текст");
    if (n < 0) throw new Error("нет строки в bubble.md");
    const r = await win.evaluate(async (n) => {
      const a = window.app;
      const plugin = a.plugins.plugins["inline-overhaul"];
      const ed = a.workspace.activeEditor.editor;
      ed.setCursor({ line: 0, ch: 0 });
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      await sleep(400);
      const width = () => {
        const row = ed.cm.contentDOM.querySelectorAll(".cm-line")[n];
        const b = row && row.querySelector("[data-io-tag-token]");
        return b ? Math.round(b.getBoundingClientRect().width * 10) / 10 : -1;
      };
      const pane = plugin._settingTab && plugin._settingTab.pane;
      const store = pane && pane.deps && pane.deps.store;
      if (!store || typeof store.set !== "function") return { error: "нет хранилища панели" };
      const path = "visual.tags.emptyBubblePct";
      const was = store.get(path);
      await store.set(path, 100);
      await sleep(300);
      const before = width();
      await store.set(path, 20);
      await sleep(400);
      const after = width();
      await store.set(path, was === undefined ? 100 : was);
      return { before, after, text: ed.getLine(n) };
    }, n);
    if (r.error) { console.log("КОНТРОЛЬ: " + r.error); return false; }
    console.log("ширина пустого пузыря: 100% → " + r.before + " px, 20% без касания заметки → " + r.after + " px");
    if (!(r.before > 0)) { console.log("КОНТРОЛЬ: пустого пузыря на строке нет — мерить нечего"); return false; }
    const ok = r.after > 0 && r.after < r.before;
    console.log(ok ? "ok: контрол доехал до заметки сразу" : "РАСХОДИТСЯ: заметка ждёт касания");
    return ok;
  },

  async "properties-focus"(win) {
    const n = await openAt(win, "props.md", "- second line");
    if (n < 0) throw new Error("нет строки в props.md");
    const step = (inProps) => win.evaluate(async ({ n, inProps }) => {
      const a = window.app;
      const ed = a.workspace.activeEditor.editor;
      ed.setCursor({ line: n, ch: 3 });
      ed.focus();
      await new Promise((r) => setTimeout(r, 200));
      if (inProps) {
        const input = document.querySelector(".workspace-leaf.mod-active .metadata-container .metadata-property-value [contenteditable], .workspace-leaf.mod-active .metadata-container .metadata-property-value input");
        if (!input) return { error: "нет поля свойства" };
        input.focus();
        await new Promise((r) => setTimeout(r, 200));
        if (!document.activeElement || !document.activeElement.closest(".metadata-container")) return { error: "фокус не встал в свойство" };
      }
      const before = ed.getValue();
      await a.commands.executeCommandById("inline-overhaul:move-line-up");
      await new Promise((r) => setTimeout(r, 400));
      const after = ed.getValue();
      if (after !== before) ed.setValue(before);
      return { changed: after !== before, after };
    }, { n, inProps });
    const inProps = await step(true);
    if (inProps.error) { console.log("КОНТРОЛЬ: " + inProps.error); return false; }
    const inText = await step(false);
    console.log("фокус в свойстве: " + (inProps.changed ? "строка сменилась — " + JSON.stringify(inProps.after) : "текст не тронут"));
    console.log("фокус в тексте (контроль): " + (inText.changed ? "строка переставлена" : "ничего не сделала"));
    if (!inText.changed) { console.log("КОНТРОЛЬ: команда не работает и в тексте — мерить нечего"); return false; }
    const ok = !inProps.changed;
    console.log(ok ? "ok: в свойстве команда молчит" : "РАСХОДИТСЯ: команда правит текст из поля свойства");
    return ok;
  },

  /*
   * H2.3 прогона 2026-10-02: команда сразу после набора. Настоящие нажатия:
   * набрать три буквы в конце второй строки, без паузы вызвать команду, одно
   * `Ctrl+Z`. Своя ступень у команды — после отмены набранное на месте.
   * Встроенная `editor:swap-line-up` — сторона сверки: как ведёт себя
   * платформа на той же клавише.
   */
  async "undo-after-typing"(win) {
    const base = "- first line\n- second line\n";
    const ids = await win.evaluate(() => Object.keys(window.app.commands.commands)
      .filter((id) => /^inline-overhaul:(?!jump).*-next$/.test(id)).slice(0, 4));
    const cmds = ["editor:swap-line-up", "inline-overhaul:move-line-up"].concat(ids);
    const res = {};
    const n = await openAt(win, "typed.md", "- second line");
    if (n < 0) throw new Error("нет строки в typed.md");
    for (const cmd of cmds) {
      await win.evaluate(({ n, base }) => {
        const ed = window.app.workspace.activeEditor.editor;
        ed.setValue(base);
        ed.setCursor({ line: n, ch: ed.getLine(n).length });
        ed.focus();
      }, { n, base });
      await win.waitForTimeout(800);
      await win.keyboard.type("xyz");
      await win.evaluate((cmd) => window.app.commands.executeCommandById(cmd), cmd);
      await win.waitForTimeout(300);
      const afterCmd = await win.evaluate(() => window.app.workspace.activeEditor.editor.getValue());
      await win.keyboard.press("Control+z");
      await win.waitForTimeout(300);
      const afterUndo = await win.evaluate(() => window.app.workspace.activeEditor.editor.getValue());
      const typed = afterUndo.includes("xyz");
      res[cmd] = { commandChanged: afterCmd !== base.replace("second line", "second linexyz"), typedKept: typed };
      console.log(cmd + ": команда " + (res[cmd].commandChanged ? "сработала" : "НЕ сработала")
        + "; после одного Ctrl+Z набранное " + (typed ? "на месте" : "снято вместе с командой")
        + " — " + JSON.stringify(afterUndo));
    }
    const built = res["editor:swap-line-up"];
    if (!built.commandChanged) { console.log("КОНТРОЛЬ: встроенная команда не сработала"); return false; }
    if (!ids.some((c) => res[c].commandChanged)) { console.log("КОНТРОЛЬ: ни одна команда поля не сработала"); return false; }
    const ok = cmds.every((c) => !res[c].commandChanged || res[c].typedKept);
    console.log(ok ? "ok: у каждой команды своя ступень" : "РАСХОДИТСЯ: команда склеилась с набором");
    return ok;
  },

  async "panel-link-label-both"(win) { return SCENARIOS["panel-link-label"](win, { "Plain": "PL\u200APlain" }); },

  async "panel-link-label"(win, labels) {
    const n = await openAt(win, "bench-scroller.md", "- текст");
    if (n < 0) throw new Error("нет строки в bench-scroller.md");
    await win.evaluate((n) => { const ed = window.app.workspace.activeEditor.editor; ed.setCursor({ line: n, ch: ed.getLine(n).length }); ed.focus(); }, n);
    await win.waitForTimeout(500);
    if (!(await runCommand(win, "open-tagwheel-right"))) throw new Error("команда tagWheel Right не выполнилась");
    await win.waitForTimeout(1000);
    const look = () => win.evaluate((n) => {
      const ed = window.app.workspace.activeEditor.editor;
      const row = ed.cm.contentDOM.querySelectorAll(".cm-line")[n];
      return { open: !!(window.__tagWheelState && window.__tagWheelState.active), doc: ed.getLine(n), screen: row ? row.textContent : "" };
    }, n);
    const seen = [];
    for (let cell = 0; cell < 8; cell++) {
      for (let v = 0; v < 3; v++) {
        await win.keyboard.press("ArrowDown");
        await win.waitForTimeout(250);
        seen.push(await look());
      }
      await win.keyboard.press("ArrowRight");
      await win.waitForTimeout(250);
    }
    await win.keyboard.press("Escape");
    await win.waitForTimeout(400);
    if (!seen.length || !seen[0].open) { console.log("КОНТРОЛЬ: панель не открылась — мерить нечего"); return false; }
    /* Активная ячейка-ссылка: `**[[[цель]]]**` в документе, `[подпись]` на экране. */
    const SHOWN = Object.assign({ "Alias Target|Shown": "Shown", "Plain": "Plain", "111/Deep|Deep": "Deep" }, labels || {});
    const hit = seen.map((s) => {
      const m = /\*\*\[(?:[^\[\]`*]*)\[\[([^\]]+)\]\]\]\*\*/.exec(s.doc);
      return m && SHOWN[m[1]] ? Object.assign({ want: "[" + SHOWN[m[1]] + "]" }, s) : null;
    }).filter(Boolean);
    /* Контроль «активная ячейка-ссылка в полосе побывала» (У-152): без неё мерить нечего. */
    if (!hit.length) { console.log("КОНТРОЛЬ: активной ячейки со ссылкой в полосе не встретилось"); return false; }
    for (const s of hit) console.log("документ:", s.doc, "\nэкран:   ", s.screen);
    const ok = hit.every((s) => (" " + s.screen + " ").includes(" " + s.want + " ") && !/Alias Target|111\//.test(s.screen));
    console.log(ok ? "ok: полоса показывает подпись целиком" : "РАСХОДИТСЯ: полоса показывает ссылку не подписью");
    return ok;
  },

  /* Тест 1 цикла 96: порядок полей в полосе tagWheel Left — `sub` сразу за `test`. */
  async "tagwheel-order"(win) {
    const LINE = "- строка для проверки порядка :: [[123]]";
    const n = await openAt(win, "testing.md", LINE);
    if (n < 0) throw new Error("в testing.md нет строки: " + LINE);
    await win.evaluate(({ n, len }) => window.app.workspace.activeEditor.editor.setCursor({ line: n, ch: len }), { n, len: LINE.length });
    if (!(await runCommand(win, "open-tagwheel-left"))) throw new Error("команда tagWheel Left не выполнилась");
    await win.waitForTimeout(800);
    const seen = await win.evaluate((n) => {
      const ed = window.app.workspace.activeEditor.editor;
      const row = [...window.app.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll(".cm-line")]
        .filter((l) => l.textContent.includes("строка для проверки порядка")).pop(); /* В, а не Б: текст у них один */
      const tw = [...document.querySelectorAll("[class*=tagwheel], [class*=io-strip], [class*=io-panel]")].slice(0, 5)
        .map((e) => e.className + " :: " + e.textContent.slice(0, 80));
      return { doc: ed.getLine(n), screen: row ? row.textContent : null, open: !!(window.__tagWheelState && window.__tagWheelState.active),
        rowHtml: row ? row.outerHTML.slice(0, 1500) : null, tw };
    }, n);
    await win.keyboard.press("Escape");
    await win.waitForTimeout(500);
    const after = await win.evaluate((n) => window.app.workspace.activeEditor.editor.getLine(n), n);
    console.log("панель открылась:", seen.open);
    if (process.env.IO_DEBUG) console.log(JSON.stringify({ doc: seen.doc, rowHtml: seen.rowHtml, tw: seen.tw }, null, 1));
    console.log("на экране:", seen.screen);
    console.log("после Esc:", after);
    const s = String(seen.screen || "");
    const at = (w) => s.indexOf(w);
    const ok = seen.open && at("test") !== -1 && at("sub") > at("test") && at("People") > at("sub") && after === LINE;
    console.log(ok ? "ok: test, sub, People; строка после Esc прежняя" : "РАСХОДИТСЯ с разделом А теста 1");
    return ok;
  },

  /* Тест 3 цикла 96: каждое нажатие Move up / Move down перескакивает соседнее дерево. */
  async "move-trees"(win) {
    const B = ["- Call the bank", "    - ask about the card", "    - check the rate",
      "- Pay the rent", "    - transfer", "    - receipt",
      "- Write the report", "    - intro", "    - numbers"];
    const A = B.slice(6).concat(B.slice(0, 6));
    const start = await openAt(win, "testing.md", "- Write the report") - 6;
    const block = () => win.evaluate((s) => window.app.workspace.activeEditor.editor.getValue().split("\n").slice(s, s + 9), start);
    if (JSON.stringify(await block()) !== JSON.stringify(B)) throw new Error("раздел В теста 3 не равен Б: " + JSON.stringify(await block()));
    const cfg = await win.evaluate(() => {
      const m = window.app.plugins.plugins["inline-overhaul"].getConfig().navigation.moveLine;
      return { mode: m.noSelectionMode, jump: m.jumpNeighborTrees, highlight: m.highlightMovedLines };
    });
    await win.evaluate((s) => window.app.workspace.activeEditor.editor.setCursor({ line: s + 6, ch: 4 }), start);
    const steps = [];
    for (const id of ["move-line-up", "move-line-up", "move-line-down", "move-line-down"]) {
      await runCommand(win, id);
      await win.waitForTimeout(400);
      steps.push({ id, block: await block(), sel: await win.evaluate(() => window.app.workspace.activeEditor.editor.somethingSelected()) });
    }
    console.log("настройки:", JSON.stringify(cfg));
    for (const st of steps) console.log(st.id, "выделено:", st.sel, "первая строка:", st.block[0], "| четвёртая:", st.block[3]);
    const ok = JSON.stringify(steps[1].block) === JSON.stringify(A) && JSON.stringify(steps[3].block) === JSON.stringify(B);
    console.log(ok ? "ok: два нажатия вверх дают раздел А, два вниз возвращают Б" : "РАСХОДИТСЯ с разделом А теста 3:\n" + steps[1].block.join("\n"));
    return ok;
  },

  /* Тест 2 цикла 96: куда ведёт щелчок по [[123]] и куда пишет ссылку Inline to note. */
  async "link-click"(win) {
    const LINE = "- строка для проверки Link to Navigator :: [[123]]";
    const n = await openAt(win, "testing.md", LINE);
    if (n < 0) throw new Error("в testing.md нет строки: " + LINE);
    await win.waitForTimeout(800);
    const box = await win.evaluate(() => {
      const row = [...window.app.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll(".cm-line")]
        .filter((l) => l.textContent.includes("Link to Navigator") && l.textContent.includes("123")).pop();
      const link = row && [...row.querySelectorAll("*")].filter((x) => !x.children.length && x.textContent.trim() === "123").pop();
      if (!link) return null;
      const r = link.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!box) throw new Error("ссылка [[123]] не нарисована в строке В");
    await win.mouse.click(box.x, box.y);
    await win.waitForTimeout(1200);
    const opened = await win.evaluate(() => window.app.workspace.getActiveFile().path);
    await openAt(win, "testing.md", LINE);
    const res = await win.evaluate(async ({ LINE, n }) => {
      const a = window.app;
      const ed = a.workspace.activeEditor.editor;
      ed.setCursor({ line: n, ch: LINE.length });
      const notes = a.vault.getMarkdownFiles().filter((f) => f.basename === "123" || f.basename === "test-project").map((f) => f.path);
      const before = {};
      for (const p of notes) before[p] = await a.vault.adapter.read(p);
      a.commands.executeCommandById("inline-overhaul:transform-inline-to-note");
      await new Promise((r) => setTimeout(r, 2500));
      const written = [];
      for (const p of notes) if ((await a.vault.adapter.read(p)) !== before[p]) written.push(p);
      return { line: ed.getLine(n), written };
    }, { LINE, n });
    console.log("щелчок по [[123]] открыл:", opened);
    console.log("Inline to note дописал ссылку в:", res.written.join(", ") || "никуда");
    console.log("строка после:", res.line);
    const ok = res.written.includes(opened);
    console.log(ok ? "ok: ссылка там же, куда ведёт щелчок" : "РАСХОДИТСЯ: щелчок и ссылка ведут в разные заметки");
    return ok;
  },
};

async function main() {
  const name = process.argv[2];
  if (!SCENARIOS[name]) {
    console.log("сценарии: " + Object.keys(SCENARIOS).join(", "));
    process.exit(2);
  }
  const { win, env, close, browser } = await launch(name).catch((e) => {
    for (const d of fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith("io-obsidian-bench-"))) {
      try { fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch (_) { /* уборка: папку держит выходящий процесс */ }
    }
    throw e;
  });
  /* Сторож всего прогона: зависший стенд гасит свой Obsidian и выходит, а не держит память машины часами. */
  const watchdog = setTimeout(() => { console.error("стенд завис: 20 минут"); close().finally(() => process.exit(3)); }, 20 * 60 * 1000);
  watchdog.unref();
  let ok = false;
  try {
    ok = await SCENARIOS[name](win, browser);
  } finally {
    await close();
    await new Promise((r) => setTimeout(r, 1500));
    fs.rmSync(env.work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
