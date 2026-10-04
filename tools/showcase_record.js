"use strict";

/**
 * Запись GIF для Showcase живым Obsidian (навык `showcase-gif`).
 *
 * Два файла на запись. `docs/dev/showcase/<id>.md` читает заказчик: что показывается
 * и какие субтитры — только это он согласует (его слово 2026-10-04: «я не хочу
 * читать технический лог сценария»). `docs/dev/showcase/steps/<id>.steps` — шаги
 * записи; каждый показ закреплён `expect`, поэтому записанное не расходится с
 * согласованным молча. Заметки — `docs/dev/showcase/vault/`, кладутся в чистый
 * vault стенда (`obsidian_bench.js`, стартовый набор, сборка из `dist`).
 *
 * Запуск (из `repo/`): `node tools/showcase_record.js move-lines`
 * Итог: `docs/media/showcase/<id>.gif`. `IO_DRY=1` — шаги без кадров (проверка
 * сценария), `IO_TRACE=1` — печатать каждый шаг.
 *
 * Темп выставляет инструмент, паузы в шагах не пишутся: субтитр держится столько,
 * сколько его читать, результат нажатия — RESULT_MS.
 *
 * Шаги, по одному в строке (`#` — комментарий):
 *   open <файл>              открыть заметку (до первого кадра, если стоит первой)
 *   caret <строка>[ @ <кусок>]  каретка в конец строки с ровно этим текстом или перед куском
 *   select <строка> @ <кусок>   кусок строки выделен
 *   say <фраза>              субтитр внизу; `say` без фразы — убрать
 *   cmd <id команды>         нажатие команды плагина (`move-line-up`): клавишу назначает
 *                            инструмент, плашка у строки — имя команды из палитры
 *   key <Ctrl+A | Enter …>   нажатие клавиши, когда фича сама и есть клавиша; плашка — клавиша
 *   type <текст>             набор текста с человеческой скоростью
 *   settings [вкладка]       Ctrl+, — панель открывается на inlineOverhaul и вкладке
 *                            первого `settings` (выбраны за кадром); другая вкладка — щелчком.
 *                            Начинает новый этап полосы; под панелью заметки возвращаются к исходным.
 *                            Отдельного шага сброса нет: откат на камеру он запретил (2026-10-04)
 *   set <контрол> = <значение>  указатель к контролу, выбор (список, переключатель on/off,
 *                            кнопки-варианты, текстовое поле); после последнего `set` подряд
 *                            панель закрывается сама
 *   click <текст>            указатель к узлу с этим текстом, щелчок
 *   close                    закрыть панель (показ только в самой панели)
 *   pause <мс>               редко: когда темпа по умолчанию мало
 *   expect <строки>          порядок строк заметки через « / »; не сошлось — запись падает;
 *                            `expect ?` — напечатать заметку (черновик сценария)
 *
 * Параллельные записи — каждая со своим `IO_PORT` (порт отладки Obsidian).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { launch } = require("./obsidian_bench.js");

const ROOT = path.resolve(__dirname, "..");
const SHOW = path.join(ROOT, "docs", "dev", "showcase");
const OUT_W = 960, FPS = 15;
/* Темп: результат нажатия на экране, чтение субтитра — основа и на знак. */
const RESULT_MS = 1700, READ_MS = 400, READ_PER_CHAR = 45;
/* Клавиши команд `cmd` назначает инструмент: на экране их нет, плашка называет команду.
   F1…F12 с Ctrl+Alt+Shift: Shift не меняет имя клавиши, сочетание свободно у Obsidian. */
const cmdCombo = {};
function bindCommands(steps) {
  const ids = [...new Set(steps.filter(([op]) => op === "cmd").map(([, a]) => a))];
  if (ids.length > 12) throw new Error("больше 12 команд в одной записи");
  const hotkeys = {};
  ids.forEach((id, i) => {
    cmdCombo[id] = "Ctrl+Alt+Shift+F" + (i + 1);
    hotkeys[id] = [{ modifiers: ["Mod", "Alt", "Shift"], key: "F" + (i + 1) }];
  });
  return hotkeys;
}

function readSteps(id) {
  return fs.readFileSync(path.join(SHOW, "steps", id + ".steps"), "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf(" "); return i < 0 ? [l, ""] : [l.slice(0, i), l.slice(i + 1).trim()]; });
}

function notes() {
  const dir = path.join(SHOW, "vault");
  return Object.fromEntries(fs.readdirSync(dir).filter((n) => n.endsWith(".md"))
    .map((n) => [n, fs.readFileSync(path.join(dir, n), "utf8").replace(/\r\n/g, "\n")]));
}

const CSS = `
.status-bar{display:none!important}
#io-rec-sub{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:86%;
 padding:10px 22px;border-radius:10px;background:rgba(20,20,24,.86);color:#fff;font:600 22px/1.3 system-ui,sans-serif;
 text-align:center;pointer-events:none;transition:opacity .2s}
/* Полоса этапов внизу (его слово 2026-10-04: «GIF зациклена, непонятно где начало и конец»):
   этап начинается заходом в настройки; первый — поведение по умолчанию (его слово 2026-10-04). */
#io-rec-bar{position:fixed;left:0;right:0;bottom:0;height:8px;z-index:99999;display:flex;gap:3px;pointer-events:none}
#io-rec-bar>i{flex:1;background:rgba(20,20,24,.15)}
#io-rec-bar>i.is-done{background:hsla(var(--accent-h),var(--accent-s),var(--accent-l),.45)}
#io-rec-bar>i.is-now{background:hsl(var(--accent-h),var(--accent-s),var(--accent-l))}
#io-rec-ptr{position:fixed;z-index:100002;width:22px;height:22px;pointer-events:none;left:-40px;top:-40px;
 background:no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M2 2l7 18 2.5-7.5L19 10z' fill='%23111' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E")}
.io-rec-ripple{position:fixed;z-index:100001;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;
 background:hsla(var(--accent-h),var(--accent-s),var(--accent-l),.45);border:2px solid hsl(var(--accent-h),var(--accent-s),var(--accent-l));
 animation:io-rec-ripple .7s ease-out forwards}
@keyframes io-rec-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
.io-rec-mark{position:fixed;z-index:99998;pointer-events:none;border-radius:6px;
 background:hsla(var(--accent-h),var(--accent-s),var(--accent-l),.18);transition:opacity .6s}
.io-rec-hk{position:fixed;z-index:99999;padding:5px 12px;border-radius:7px;white-space:nowrap;pointer-events:none;
 background:#fff;color:#222;border:2px solid #222;box-shadow:0 3px 0 #222;font:700 17px/1 system-ui,sans-serif;transition:opacity .4s}
.io-rec-hk.is-press{animation:io-rec-press .25s ease-out}
@keyframes io-rec-press{from{transform:translateY(3px);box-shadow:0 0 0 #222}to{transform:none;box-shadow:0 3px 0 #222}}
/* Камера на панели плагина (его слово 2026-10-04): окно настроек во весь экран, без левого
   списка Obsidian, сама панель крупно. Видимый вид панели не меняется — меняется масштаб кадра. */
.modal-container:has(.mod-settings) .modal-bg{opacity:1!important}
.modal.mod-settings{width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border-radius:0!important}
.mod-settings .vertical-tab-header{display:none!important}
.mod-settings .vertical-tab-content-container{zoom:1.35}`;

/** Демо-хранилище: английский интерфейс, окно без лишнего, свои заметки и клавиши, панель выбрана за кадром. */
async function stage(win, browser, tab, stages, hotkeys) {
  await win.evaluate(() => { window.localStorage.setItem("language", "en"); });
  await win.reload();
  for (let i = 0; i < 40; i++) {
    if (await win.evaluate(() => !!(window.app && window.app.workspace.layoutReady && window.app.plugins.plugins["inline-overhaul"])).catch(() => false)) break;
    await win.waitForTimeout(500);
  }
  await win.evaluate(async ({ files, hotkeys }) => {
    const a = window.app;
    for (const f of a.vault.getMarkdownFiles()) await a.vault.delete(f);
    for (const [n, t] of Object.entries(files)) await a.vault.create(n, t);
    for (const [id, keys] of Object.entries(hotkeys)) a.hotkeyManager.setHotkeys("inline-overhaul:" + id, keys);
    a.hotkeyManager.bake();
    for (const m of document.querySelectorAll(".modal-container")) m.remove();
    /* Окно — как при первом запуске Obsidian, без лишнего: боковые панели, лента, строка состояния (его слово 2026-10-04). */
    if (a.workspace.leftSplit) a.workspace.leftSplit.collapse();
    if (a.workspace.rightSplit) a.workspace.rightSplit.collapse();
    a.vault.setConfig("showRibbon", false);
    /* Панель — поверх заметки, а не отдельным окном Obsidian 1.13: иначе она не попадает в кадр. */
    a.vault.setConfig("settingsPopoutWindow", false);
    /* GIF уменьшается до 960: кегль 20, чтобы текст заметки читался. */
    a.vault.setConfig("baseFontSize", 20);
    a.updateFontSize();
    /* Окно записи не берёт фокус системы: иначе в демо-заметку печатает человек за соседним окном.
       Нажатия записи идут по CDP, им фокус системы не нужен. */
    const bw = window.require("@electron/remote").getCurrentWindow();
    bw.setFocusable(false);
    bw.blur();
  }, { files: notes(), hotkeys });
  /* За кадром — на inlineOverhaul и нужную вкладку: на камеру Ctrl+, открывается сразу там,
     без страницы General Obsidian (версия, аккаунт). */
  await win.evaluate(async (tab) => {
    const st = window.app.setting;
    st.open(); st.openTabById("inline-overhaul");
    await new Promise((r) => setTimeout(r, 800));
    if (tab) { const b = [...document.querySelectorAll("button, [role=tab]")].filter((x) => x.textContent.trim() === tab).pop(); if (b) b.click(); }
    await new Promise((r) => setTimeout(r, 500));
    st.close();
  }, tab || "");
  const cdp = await win.context().newCDPSession(win);
  /* Страница считает себя в фокусе: каретка мигает и без фокуса окна. */
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await win.waitForTimeout(800);
  /* Слой поверх окна: субтитр, плашка клавиши, указатель, круг щелчка — снимок окна указателя не содержит. */
  await win.evaluate(([css, stages]) => {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    for (const id of ["io-rec-sub", "io-rec-ptr", "io-rec-bar"]) {
      const d = document.createElement("div"); d.id = id; d.style.opacity = id === "io-rec-sub" ? "0" : "1"; document.body.appendChild(d);
    }
    for (let i = 0; i < stages; i++) document.getElementById("io-rec-bar").appendChild(document.createElement("i"));
    document.addEventListener("mousemove", (e) => { const p = document.getElementById("io-rec-ptr"); p.style.left = e.clientX + "px"; p.style.top = e.clientY + "px"; }, true);
    /* Затухающий круг на месте щелчка (его слово 2026-10-04). */
    document.addEventListener("mousedown", (e) => {
      const d = document.createElement("div"); d.className = "io-rec-ripple";
      d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px";
      document.body.appendChild(d); setTimeout(() => d.remove(), 800);
    }, true);
  }, [CSS, stages]);
  await setStage(win, 0);
  return cdp;
}

const setStage = (win, n) => win.evaluate((n) => [...document.querySelectorAll("#io-rec-bar>i")]
  .forEach((x, i) => { x.className = i < n ? "is-done" : i === n ? "is-now" : ""; }), n);

const overlay = (win, id, text) => win.evaluate(([id, t]) => {
  const d = document.getElementById(id); if (t) d.textContent = t; d.style.opacity = t ? "1" : "0";
}, [id, text]);

/**
 * Подсветка того, что двигает нажатие (его слово 2026-10-04: «куда смотреть»; запаздывание
 * подсветки он назвал «очень плохо»). Встаёт на строку каретки до нажатия; страница сама
 * сверяет заметку каждый кадр и в том же кадре, где строка переехала, переносит подсветку
 * на новое место (`moved`). Запись в этом не участвует — её задержка до экрана не доходит.
 */
const markStart = (win) => win.evaluate((movedSrc) => {
  const moved = (0, eval)("(" + movedSrc + ")");
  const ed = window.app.workspace.activeEditor.editor, cm = ed.cm;
  const snap = () => ({ lines: ed.getValue().split("\n"), at: ed.getCursor().line });
  const before = snap();
  let text = before.lines.join("\n"), span = [before.at, before.at];
  const d = document.createElement("div"); d.className = "io-rec-mark";
  /* Клавиша — у самой строки, а не в углу (его слово 2026-10-04): видно, что нажатие и правка одно. */
  const k = document.createElement("div"); k.className = "io-rec-hk"; k.style.opacity = "0";
  document.body.append(d, k);
  const st = { live: true, d, k };
  const place = () => {
    if (!st.live) return;
    const now = ed.getValue();
    if (now !== text) { text = now; span = moved(before, snap()); }
    const top = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: 0 }));
    const end = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: ed.getLine(span[0]).length }));
    const bot = cm.coordsAtPos(ed.posToOffset({ line: span[1], ch: ed.getLine(span[1]).length }));
    const box = cm.contentDOM.getBoundingClientRect();
    if (top && bot) Object.assign(d.style, { left: box.left - 12 + "px", width: box.width + 24 + "px", top: top.top - 3 + "px", height: bot.bottom - top.top + 6 + "px" });
    if (end) Object.assign(k.style, { left: end.right + 28 + "px", top: (end.top + end.bottom) / 2 - 15 + "px" });
    requestAnimationFrame(place);
  };
  place();
  window.__ioRecMark = st;
}, moved.toString());

/** Плашка клавиши у строки — тем же вызовом, что и нажатие, без промежутка. */
const markPress = (win, label) => win.evaluate((label) => {
  const k = window.__ioRecMark.k;
  k.textContent = label; k.style.opacity = "1";
  k.classList.remove("is-press"); void k.offsetWidth; k.classList.add("is-press");
}, label);

const markEnd = (win) => win.evaluate(() => {
  const st = window.__ioRecMark;
  if (!st) return;
  st.d.style.opacity = "0"; st.k.style.opacity = "0";
  setTimeout(() => { st.live = false; st.d.remove(); st.k.remove(); }, 700);
});

const editorState = (win) => win.evaluate(() => {
  const ed = window.app.workspace.activeEditor.editor;
  return { lines: ed.getValue().split("\n"), at: ed.getCursor().line };
});

/**
 * Что сдвинулось: строка каретки и те, что шли за ней до нажатия и идут за ней после.
 * ponytail: догадка по соседству; правка внутри строки или стоящая строка — одна строка каретки.
 */
function moved(before, after) {
  let to = after.at;
  if (after.at === before.at) return [after.at, to];
  for (let k = 1; after.at + k < after.lines.length && before.at + k < before.lines.length; k++) {
    const l = after.lines[after.at + k];
    if (l !== before.lines[before.at + k] || !l.trim()) break;
    to = after.at + k;
  }
  return [after.at, to];
}

/** Видимый узел с этим текстом (последний), в центр экрана; его середина. */
async function find(win, text) {
  const box = await win.evaluate((t) => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    /* Вкладка и кнопка раньше текста: «Navigation» — и вкладка, и строка модуля. */
    const hit = (sel, leaf) => [...document.querySelectorAll(sel)]
      .filter((x) => vis(x) && x.textContent.trim() === t && !(leaf && [...x.children].some((c) => c.textContent.trim() === t))).pop();
    const n = hit("button, [role=tab], .vertical-tab-nav-item", false) || hit(".setting-item-name, div, span, a", true);
    if (!n) return null;
    n.scrollIntoView({ block: "center" });
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);
  if (!box) throw new Error("нет «" + text + "» на экране");
  return box;
}

async function point(win, box) {
  await win.mouse.move(box.x, box.y, { steps: 14 });
  await win.waitForTimeout(200);
}

/** Контрол строки панели по её имени: выпадающий список, переключатель или кнопки-варианты. */
async function setControl(win, name, value) {
  const kind = await win.evaluate(([name]) => {
    const row = [...document.querySelectorAll(".setting-item")].find((r) => {
      const n = r.querySelector(".setting-item-name"); return n && n.textContent.trim() === name;
    });
    if (!row) return null;
    row.scrollIntoView({ block: "center" });
    row.setAttribute("data-io-rec", "1");
    return row.querySelector("select") ? "select" : row.querySelector(".checkbox-container") ? "toggle"
      : row.querySelector("input[type=text], input[type=number], input:not([type]), textarea") ? "text" : "buttons";
  }, [name]);
  if (!kind) throw new Error("нет контрола «" + name + "»");
  await win.waitForTimeout(250);
  const row = win.locator("[data-io-rec='1']");
  if (kind === "select") {
    const sel = row.locator("select:not(.is-measuring)");
    const labels = await sel.evaluate((n) => [...n.options].map((o) => o.textContent.trim()));
    if (!labels.includes(value)) throw new Error("у «" + name + "» нет «" + value + "»; есть: " + labels.join(" | "));
    const b = await sel.boundingBox();
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await point(win, c);
    /* Круг щелчка без настоящего щелчка: тот открыл бы системный список, которого нет в кадре. */
    await win.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y })), [c.x, c.y]);
    await sel.selectOption({ label: value });
  } else if (kind === "toggle") {
    const t = row.locator(".checkbox-container");
    const on = await t.evaluate((n) => n.classList.contains("is-enabled"));
    const b = await t.boundingBox();
    await point(win, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    if (on !== (value === "on")) await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  } else if (kind === "text") {
    const t = row.locator("input[type=text], input[type=number], input:not([type]), textarea").first();
    const b = await t.boundingBox();
    await point(win, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await win.keyboard.press("Control+A");
    await win.keyboard.type(value, { delay: 60 });
    /* Поле пишет значение по change: уход фокуса, как у человека. */
    await t.evaluate((n) => n.blur());
  } else {
    const btn = row.getByText(value, { exact: true }).last();
    const b = await btn.boundingBox();
    if (!b) throw new Error("у «" + name + "» нет варианта «" + value + "»");
    await point(win, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await win.evaluate(() => document.querySelector("[data-io-rec]").removeAttribute("data-io-rec"));
  await win.waitForTimeout(500);
}

/** Плашка называет команду, а не клавиши (его слово 2026-10-04: «hotkey: move line up»): имя — из палитры Obsidian. */
const cmdLabel = (win, id) => win.evaluate((id) => {
  const c = window.app.commands.commands["inline-overhaul:" + id];
  return c ? "hotkey: " + c.name.split(": ").pop() : null;
}, id);
const keyName = (k) => "key: " + k.replace(/ArrowUp/, "↑").replace(/ArrowDown/, "↓").replace(/ArrowLeft/, "←").replace(/ArrowRight/, "→").split("+").join(" + ");
const isTab = (win, t) => win.evaluate((t) => [...document.querySelectorAll(".modal.mod-settings button, .modal.mod-settings [role=tab]")]
  .some((x) => x.textContent.trim() === t && (/is-active|mod-active|is-selected/.test(x.className) || x.getAttribute("aria-selected") === "true")), t);

async function run(win, steps, cut, log) {
  let readUntil = 0;
  for (let si = 0; si < steps.length; si++) {
    const [op, arg] = steps[si];
    const next = steps[si + 1] ? steps[si + 1][0] : "";
    log.push(op + " " + arg);
    if (op === "open") {
      await win.evaluate(async (f) => {
        const a = window.app;
        await a.workspace.getLeaf(false).openFile(a.vault.getAbstractFileByPath(f), { state: { mode: "source", source: false } });
        a.workspace.activeEditor.editor.setCursor({ line: 0, ch: 0 });
      }, arg);
      await win.waitForTimeout(600);
    } else if (op === "caret" || op === "select") {
      /* `caret <строка> @ <кусок>` — каретка перед куском; `select <строка> @ <кусок>` — кусок выделен. */
      const [line, part] = arg.split(" @ ");
      const n = await win.evaluate(([t, part, sel]) => {
        const ed = window.app.workspace.activeEditor.editor;
        const n = ed.getValue().split("\n").lastIndexOf(t);
        if (n < 0) return "нет строки «" + t + "»";
        const ch = part === undefined ? t.length : t.indexOf(part);
        if (ch < 0) return "в строке «" + t + "» нет «" + part + "»";
        ed.focus();
        if (sel) ed.setSelection({ line: n, ch }, { line: n, ch: ch + part.length });
        else ed.setCursor({ line: n, ch });
        return "";
      }, [line, part, op === "select"]);
      if (n) throw new Error(n);
      await win.waitForTimeout(300);
    } else if (op === "say") {
      await overlay(win, "io-rec-sub", arg);
      readUntil = Date.now() + (arg ? READ_MS + READ_PER_CHAR * arg.length : 0);
    } else if (op === "cmd" || op === "key") {
      /* `cmd <id команды>` — клавишу назначает инструмент, плашка называет команду;
         `key <клавиша>` — когда фича сама и есть клавиша (Enter, Ctrl+A), плашка называет клавишу. */
      const combo = op === "cmd" ? cmdCombo[arg] : arg;
      const label = op === "cmd" ? await cmdLabel(win, arg) : keyName(arg);
      if (!label) throw new Error("нет команды inline-overhaul:" + arg);
      /* Нажатие ждёт, пока субтитр прочитан; панель между ними — тоже время чтения. */
      await win.waitForTimeout(Math.max(0, readUntil - Date.now()));
      /* Подряд идущие нажатия — одна подсветка: она идёт за строкой, плашка мигает на каждом. */
      if (!run.marking) { await markStart(win); await win.waitForTimeout(250); }
      /* Плашка — раньше нажатия: глаз читает команду, потом видит её действие (его слово 2026-10-04). */
      await markPress(win, label);
      await win.waitForTimeout(450);
      await win.keyboard.press(combo.replace(/^Ctrl\+/, "Control+"));
      run.marking = next === "cmd" || next === "key";
      await win.waitForTimeout(run.marking ? 900 : RESULT_MS);
      if (!run.marking) await markEnd(win);
    } else if (op === "type") {
      /* Набор с человеческой скоростью. */
      await win.waitForTimeout(Math.max(0, readUntil - Date.now()));
      await win.keyboard.type(arg, { delay: 70 });
      await win.waitForTimeout(600);
    } else if (op === "close") {
      /* Только для показов в самой панели: после `set` панель закрывается сама. */
      await win.evaluate(() => window.app.setting.close());
      await win.waitForTimeout(450);
    } else if (op === "pause") {
      await win.waitForTimeout(Number(arg));
    } else if (op === "settings") {
      await setStage(win, run.stage = (run.stage || 0) + 1);
      /* Без плашки: Ctrl+, к фиче не относится (его слово 2026-10-04). */
      await win.keyboard.press("Control+Comma");
      await win.waitForTimeout(700);
      if (!await win.evaluate(() => !!document.querySelector(".modal.mod-settings .io-tabstrip, .modal.mod-settings [class*=io-tab]"))) {
        const b = await find(win, "inlineOverhaul");
        await point(win, b);
        await win.mouse.click(b.x, b.y);
        await win.waitForTimeout(700);
      }
      if (arg && !await isTab(win, arg)) {
        const b = await find(win, arg);
        await point(win, b);
        await win.mouse.click(b.x, b.y);
        await win.waitForTimeout(600);
      }
      /* Заметка возвращается к исходной под панелью: на экране отката не видно, после выхода из
         настроек — свежая заметка (его слово 2026-10-04: откат на камеру «сбивает с толку»). */
      const nc = steps.slice(si + 1).find(([o]) => o === "caret");
      await win.evaluate(async ([files, line]) => {
        const a = window.app;
        /* Открытую заметку — через редактор: несохранённая правка редактора перебивает запись в файл. */
        const ed = a.workspace.activeEditor;
        for (const [n, t] of Object.entries(files)) {
          if (ed && ed.file && ed.file.path === n) ed.editor.setValue(t);
          else await a.vault.modify(a.vault.getAbstractFileByPath(n), t);
        }
        /* Каретка — туда, где её ждёт следующий показ: иначе мелькает первая строка. */
        const e = a.workspace.activeEditor && a.workspace.activeEditor.editor;
        const k = e && line ? e.getValue().split("\n").lastIndexOf(line) : -1;
        if (k >= 0) e.setCursor({ line: k, ch: line.length });
      }, [notes(), nc ? nc[1] : ""]);
    } else if (op === "click") {
      const b = await find(win, arg);
      await point(win, b);
      await win.mouse.click(b.x, b.y);
      await win.waitForTimeout(600);
    } else if (op === "set") {
      const [name, value] = arg.split(" = ");
      await setControl(win, name.trim(), value.trim());
      /* Панель закрывается сама сразу после контрола: GIF про поведение в заметке (его слово 2026-10-04). */
      if (next !== "set") {
        await win.evaluate(() => window.app.setting.close());
        await win.waitForTimeout(450);
      }
    } else if (op === "expect" && arg === "?") {
      /* Черновик сценария: напечатать заметку, чтобы выписать ожидание с неё, а не по памяти. */
      console.log("--- заметка после шага " + log.length + ":\n" + (await editorState(win)).lines.join("\n"));
    } else if (op === "expect") {
      const want = arg.split(" / ");
      const got = (await editorState(win)).lines;
      let at = -1;
      for (const w of want) {
        const i = got.findIndex((l, k) => k > at && l.trimEnd() === w.trimEnd());
        if (i < 0) throw new Error("expect не сошёлся на «" + w + "»; заметка:\n" + got.join("\n"));
        at = i;
      }
    } else throw new Error("неизвестный шаг: " + op);
    if (process.env.IO_TRACE) console.log("· " + op + " " + arg + " | панель: " + await win.evaluate(() => !!document.querySelector(".modal.mod-settings")));
  }
}

/** Кадры с метками времени → GIF: длительность каждого кадра — до следующего, вырезки за кадром выброшены. */
function encode(frames, cut, end, tmp, out) {
  const keep = frames.filter((f) => !cut.some(([a, b]) => f.t >= a && f.t <= b));
  const lines = [];
  keep.forEach((f, i) => {
    let next = i + 1 < keep.length ? keep[i + 1].t : end;
    for (const [a, b] of cut) if (a >= f.t && b <= next) next -= b - a;
    lines.push("file '" + f.file.replace(/\\/g, "/") + "'", "duration " + Math.max(0.02, next - f.t).toFixed(3));
  });
  lines.push("file '" + keep[keep.length - 1].file.replace(/\\/g, "/") + "'");
  const list = path.join(tmp, "frames.txt");
  fs.writeFileSync(list, lines.join("\n"));
  const vf = "fps=" + FPS + ",scale=" + OUT_W + ":-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", vf, "-loop", "0", out]);
}

async function main() {
  const id = process.argv[2];
  if (!id) { console.log("node tools/showcase_record.js <id>"); process.exit(2); }
  const steps = readSteps(id);
  const dry = !!process.env.IO_DRY;
  const { win, env, close, browser } = await launch("clean-showcase");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "io-showcase-"));
  const frames = [], cut = [], log = [];
  let ok = false;
  const watchdog = setTimeout(() => { console.error("запись зависла: 10 минут"); close().finally(() => process.exit(3)); }, 10 * 60 * 1000);
  watchdog.unref();
  try {
    const first = steps.find(([op]) => op === "settings");
    const cdp = await stage(win, browser, first && first[1], steps.filter(([op]) => op === "settings").length + 1, bindCommands(steps));
    if (!dry) {
      cdp.on("Page.screencastFrame", (f) => {
        const file = path.join(tmp, String(frames.length).padStart(5, "0") + ".jpg");
        fs.writeFileSync(file, Buffer.from(f.data, "base64"));
        frames.push({ t: f.metadata.timestamp, file });
        cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => { /* сессия закрыта — запись кончилась */ });
      });
    }
    try {
      /* `open` и первый `caret` — до первого кадра: иначе GIF начинается с каретки в первой строке. */
      const pre = steps.findIndex(([op]) => op !== "open" && op !== "caret");
      await run(win, steps.slice(0, pre), cut, log);
      /* Первый кадр — чистая заметка: ни окна, ни уведомления (его слово 2026-10-04). */
      await win.evaluate(() => document.querySelectorAll(".notice").forEach((n) => n.remove()));
      const extra = await win.evaluate(() => [...document.querySelectorAll(".modal-container, .notice")].map((n) => n.textContent.slice(0, 60)));
      if (extra.length) throw new Error("до записи на экране лишнее: " + extra.join(" | "));
      const size = await win.evaluate(() => [window.innerWidth, window.innerHeight]);
      if (!dry) await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: size[0], maxHeight: size[1], everyNthFrame: 1 });
      await win.waitForTimeout(600);
      await run(win, steps.slice(pre), cut, log);
    } catch (e) {
      await win.screenshot({ path: path.join(tmp, "fail.png") }).catch(() => { /* снимок отказа — не главное */ });
      console.error("шаг " + log.length + " «" + log[log.length - 1] + "»: " + e.message + "\nснимок: " + path.join(tmp, "fail.png"));
      throw e;
    }
    await win.waitForTimeout(1200);
    const end = Date.now() / 1000;
    if (!dry) {
      await cdp.send("Page.stopScreencast");
      const out = path.join(ROOT, "docs", "media", "showcase", id + ".gif");
      encode(frames, cut, end, tmp, out);
      const sec = end - frames[0].t - cut.reduce((s, [a, b]) => s + b - a, 0);
      console.log("ok: " + path.relative(ROOT, out) + " — " + sec.toFixed(1) + " с, " + (fs.statSync(out).size / 1048576).toFixed(2) + " МБ, кадров " + frames.length);
    } else console.log("ok: шагов " + log.length + " (без записи)");
    ok = true;
  } finally {
    clearTimeout(watchdog);
    await close();
    await new Promise((r) => setTimeout(r, 1500));
    fs.rmSync(env.work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    if (ok) fs.rmSync(tmp, { recursive: true, force: true }); else console.error("кадры оставлены: " + tmp);
  }
  process.exit(ok ? 0 : 1);
}

module.exports = { stage, moved };
if (require.main === module) main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
