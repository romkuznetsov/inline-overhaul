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
  }
  /* `IO_MAIN=<файл>` — другая сборка плагина в копии vault (контроль стенда
     подменённой сборкой); его `test-vault` не трогается. */
  if (process.env.IO_MAIN) {
    fs.copyFileSync(path.resolve(process.env.IO_MAIN), path.join(vault, ".obsidian", "plugins", "inline-overhaul", "main.js"));
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
const PREPARE = {
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
};

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
    const open = async (file) => {
      await a.workspace.getLeaf(false).openFile(a.vault.getAbstractFileByPath(file), { state: { mode: "source", source: false } });
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
        await open(c.at.file);
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
      if (typeof s === "object" && (s.key || s.type || s.click)) { chunks.push(cur); chunks.push(s); cur = []; } else cur.push(s);
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
