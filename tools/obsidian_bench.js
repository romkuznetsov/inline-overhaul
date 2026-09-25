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

function prepare() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "io-obsidian-bench-"));
  const profile = path.join(work, "profile");
  const vault = path.join(work, "vault");
  fs.mkdirSync(profile, { recursive: true });
  /* Раскладка окон — его, стенду она не нужна и открывает лишнее. */
  fs.cpSync(SRC_VAULT, vault, { recursive: true, filter: (p) => !/[\\/]\.obsidian[\\/]workspace(-mobile)?\.json$/.test(p) });
  /* `IO_MAIN=<файл>` — другая сборка плагина в копии vault (контроль стенда
     подменённой сборкой); его `test-vault` не трогается. */
  if (process.env.IO_MAIN) {
    fs.copyFileSync(path.resolve(process.env.IO_MAIN), path.join(vault, ".obsidian", "plugins", "inline-overhaul", "main.js"));
  }
  const asar = fs.readdirSync(PROFILE_SRC).filter((n) => /^obsidian-.*\.asar$/.test(n)).sort().pop();
  if (!asar) throw new Error("нет obsidian-<версия>.asar в " + PROFILE_SRC);
  fs.copyFileSync(path.join(PROFILE_SRC, asar), path.join(profile, asar));
  fs.writeFileSync(path.join(profile, "obsidian.json"),
    JSON.stringify({ vaults: { iobench00000001: { path: vault, ts: Date.now(), open: true } } }));
  return { work, profile, vault };
}

async function launch() {
  const env = prepare();
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
    if (!p.plugins["inline-overhaul"]) { await p.setEnable(true); await p.enablePlugin("inline-overhaul"); }
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
  return { win, env, close };
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

const SCENARIOS = {
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
  const { win, env, close } = await launch().catch((e) => {
    for (const d of fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith("io-obsidian-bench-"))) {
      try { fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch (_) { /* уборка: папку держит выходящий процесс */ }
    }
    throw e;
  });
  let ok = false;
  try {
    ok = await SCENARIOS[name](win);
  } finally {
    await close();
    await new Promise((r) => setTimeout(r, 1500));
    fs.rmSync(env.work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
