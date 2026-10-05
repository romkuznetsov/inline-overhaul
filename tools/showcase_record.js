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
 *   title <заголовок> | <строка>  заставка в начале GIF: что он покажет (место в файле любое)
 *   preset <путь> = <JSON>    настройка за кадром, до первого кадра (`readme-hero`: строка как в README);
 *                            объекты сливаются с конфигом, массивы и листья заменяются
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
 *   set <контрол>[ #N] = <значение>  указатель к контролу (#N — N-й с тем же именем), выбор (список, переключатель on/off,
 *                            кнопки-варианты, текстовое поле, ползунок числом, цвет #rrggbb);
 *                            после последнего `set` подряд
 *                            панель закрывается сама, если следующий шаг не в панели (set, click, fill,
 *                            pick, pause, close); строка ищется и в редакторе Fields
 *                            (`set Child Field = Always` — строка Behavior выбранного Field)
 *   click <текст>[ #N]       указатель к узлу с этим текстом (#N — N-й сверху, иначе последний), щелчок;
 *                            текста нет — узел с этой
 *                            `aria-label` (значок: `click Make #review a child Value`,
 *                            `click Hide #doing from next, previous and tagWheel`)
 *   fill <подсказка> = <текст>  набор в поле, у которого нет имени строки (по placeholder;
 *                            подсказки нет — по `aria-label`, например `Custom text for #todo`)
 *                            поле цвета (`Fill color for #errand = #e05050`) — значение без системного окна
 *   pick <подпись> = <вариант>  список без имени строки (по aria-label, title или подписи рядом)
 *   hover <текст>[ #N][ + Ctrl]  указатель на узел с этим текстом; с Ctrl — зажат 1,5 с (превью ссылки)
 *   spot <текст>[ #N]        рамка вокруг узла панели, о котором субтитр (строка списка Fields; заголовок
 *                            раздела — вместе с разделом); ждёт, пока прочитан прежний субтитр
 *   close                    закрыть панель (показ только в самой панели)
 *   pause <мс>               редко: когда темпа по умолчанию мало
 *   mark none | line | prefix | caret  акцент нажатия: none (умолчание) — ничего; line — строка и то, что
 *                            поехало с ней; prefix — отступ и Prefix строки; caret — светится каретка (прыжки)
 *   stage <подпись>          новый этап полосы под кадром, назван сценарием; есть хоть один — `settings` этапа не начинает
 *   drop <Field>             Field и его дочерний убраны за кадром (в панели только нужное GIF)
 *   room <px>                запас высоты окна под заметкой (окно ужимается по заметке)
 *   line-width <px>          колонка текста уже (`--file-line-width`): место под плашку слева от строки
 *   rec-caret off            родная каретка Obsidian вместо фиолетовой каретки записи (GIF про каретку)
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
/* Полоса этапов под кадром: подписи и полоска просмотра, пиксели GIF. */
const BAR_H = 42, PROG_H = 8;
/* Окно GIF с панелью настроек не ниже этого: панель в кадре остаётся читаемой. */
const MIN_H = 560;
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

/** Заметки демо, с подпапками (шаблоны Transform): путь в vault — через `/`. */
function notes() {
  const dir = path.join(SHOW, "vault");
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true }).filter((n) => n.endsWith(".md"))
    .map((n) => [n.split(path.sep).join("/"), fs.readFileSync(path.join(dir, n), "utf8").replace(/\r\n/g, "\n")]));
}

const CSS = `
.status-bar{display:none!important}
/* Субтитр — справа, в пустом месте заметки, мимо текста и каретки (его слово 2026-10-04);
   место выбирает страница каждый кадр. В панели настроек пустого места нет — внизу по центру. */
#io-rec-sub{position:fixed;z-index:99999;max-width:60vw;right:24px;top:-200px;
 padding:10px 18px;border-radius:10px;background:rgba(20,20,24,.86);color:#fff;font:600 20px/1.3 system-ui,sans-serif;
 text-align:left;pointer-events:none;transition:opacity .2s}
#io-rec-sub.is-wide{right:auto!important;left:50%!important;top:auto!important;bottom:16px;transform:translateX(-50%);max-width:86%;text-align:center}
/* Полоса этапов — не на странице, а под кадром, при сборке GIF (\`renderBars\`, \`encode\`): своя заливка, текст под неё не залезает (его слово 2026-10-05). */
#io-rec-barsrc{position:fixed;left:0;top:0;width:960px;z-index:100010;background:#fff}
#io-rec-barsrc>div{display:flex;gap:2px;height:34px}
#io-rec-barsrc i{min-width:0;padding:0 6px;background:#ecebf0;color:#555;font:600 14px/34px system-ui,sans-serif;font-style:normal;
 text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#io-rec-barsrc i.is-done{background:#ddd0f7;color:#333}
#io-rec-barsrc i.is-now{background:#8b3dff;color:#fff}
#io-rec-barsrc>b{display:block;height:8px;background:#ecebf0}
body.io-rec-hidemodal .modal-container{opacity:0!important}
/* Заставка: что покажет GIF (его слово 2026-10-04: «в начале gif нужно понятное описание того, что будет»). */
#io-rec-title{position:fixed;inset:0;z-index:100003;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
 padding:0 10%;background:rgba(255,255,255,.94);text-align:center;pointer-events:none;transition:opacity .4s}
#io-rec-title b{font:800 40px/1.2 system-ui,sans-serif;color:hsl(var(--accent-h),var(--accent-s),var(--accent-l))}
#io-rec-title span{font:500 22px/1.4 system-ui,sans-serif;color:#333}
/* Каретка записи: фиолетовая, толще, мигает чаще родной (его слово 2026-10-04); родная спрятана.
   Во время нажатия светится — в прыжках смотреть на каретку, а не на строку (его слово 2026-10-04). */
body.io-rec-caret .cm-content{caret-color:transparent!important}
body.io-rec-caret .cm-cursor{display:none!important}
#io-rec-caret{position:fixed;z-index:99997;width:4px;margin-left:-2px;border-radius:2px;pointer-events:none;background:#8b3dff;
 animation:io-rec-blink .8s steps(1) infinite}
/* Без гало — просто фиолетовая и не мигает (его слово 2026-10-05 к jump-line). */
#io-rec-caret.is-hot{animation:none}
@keyframes io-rec-blink{50%{opacity:0}}
#io-rec-ptr{position:fixed;z-index:100002;width:22px;height:22px;pointer-events:none;left:-40px;top:-40px;
 background:no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M2 2l7 18 2.5-7.5L19 10z' fill='%23111' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E")}
.io-rec-ripple{position:fixed;z-index:100001;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;
 background:hsla(var(--accent-h),var(--accent-s),var(--accent-l),.45);border:2px solid hsl(var(--accent-h),var(--accent-s),var(--accent-l));
 animation:io-rec-ripple .7s ease-out forwards}
@keyframes io-rec-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
#io-rec-spot{position:fixed;z-index:100000;pointer-events:none;border:3px solid #8b3dff;border-radius:10px;
 background:rgba(139,61,255,.07);box-shadow:0 0 0 4px rgba(139,61,255,.15);transition:opacity .3s}
.io-rec-mark{position:fixed;z-index:99998;pointer-events:none;border-radius:6px;
 background:hsla(var(--accent-h),var(--accent-s),var(--accent-l),.18);transition:opacity .6s}
.io-rec-hk{position:fixed;z-index:99999;padding:5px 12px;border-radius:7px;white-space:nowrap;pointer-events:none;
 background:#fff;color:#222;border:2px solid #222;box-shadow:0 3px 0 #222;font:700 17px/1 system-ui,sans-serif;transition:opacity .4s}
/* Нажатие — вспышка цвета на плашке (его слово 2026-10-04: «чтобы было более явно»). */
.io-rec-hk.is-press{animation:io-rec-press .7s ease-out}
@keyframes io-rec-press{0%{transform:translateY(3px);box-shadow:0 0 0 #222;background:#8b3dff;color:#fff;border-color:#8b3dff}
 60%{background:#8b3dff;color:#fff;border-color:#8b3dff}100%{transform:none;box-shadow:0 3px 0 #222;background:#fff;color:#222}}
/* Камера на панели плагина (его слово 2026-10-04): окно настроек во весь экран, без левого
   списка Obsidian, сама панель крупно. Видимый вид панели не меняется — меняется масштаб кадра. */
.modal-container:has(.mod-settings) .modal-bg{opacity:1!important}
.modal.mod-settings{width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border-radius:0!important}
.mod-settings .vertical-tab-header{display:none!important}
.mod-settings .vertical-tab-content-container{zoom:1.35}`;

/** Демо-хранилище: английский интерфейс, окно без лишнего, свои заметки и клавиши, панель выбрана за кадром. */
async function stage(win, browser, tab, hotkeys) {
  await win.evaluate(() => { window.localStorage.setItem("language", "en"); });
  await win.reload();
  for (let i = 0; i < 40; i++) {
    if (await win.evaluate(() => !!(window.app && window.app.workspace.layoutReady && window.app.plugins.plugins["inline-overhaul"])).catch(() => false)) break;
    await win.waitForTimeout(500);
  }
  await win.evaluate(async ({ files, hotkeys }) => {
    const a = window.app;
    for (const f of a.vault.getMarkdownFiles()) await a.vault.delete(f);
    for (const [n, t] of Object.entries(files)) {
      const dir = n.split("/").slice(0, -1).join("/");
      if (dir && !a.vault.getAbstractFileByPath(dir)) await a.vault.createFolder(dir);
      await a.vault.create(n, t);
    }
    for (const [id, keys] of Object.entries(hotkeys)) a.hotkeyManager.setHotkeys(id.includes(":") ? id : "inline-overhaul:" + id, keys);
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
  await win.evaluate((css) => {
    const st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    for (const id of ["io-rec-sub", "io-rec-ptr", "io-rec-caret"]) {
      const d = document.createElement("div"); d.id = id; d.style.opacity = id === "io-rec-sub" ? "0" : "1"; document.body.appendChild(d);
    }
    document.body.classList.add("io-rec-caret");
    /* Рамка `spot`: строка списка Fields или заголовок раздела с этим именем — раньше любого текста (тёзки в предпросмотре). */
    window.__ioRecSpotNode = (t) => [...document.querySelectorAll(".io-fields__list .io-fields__item, .io-item__namerow")]
      .find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "") === t);
    /* Узел в кадре — прокрутки нет: панель не ездит на камеру (его слово 2026-10-05). */
    window.__ioRecInView = (n) => { const r = n.getBoundingClientRect(); return r.top >= 50 && r.bottom <= window.innerHeight - 70; };
    /* Каждый кадр: каретка записи у головы выделения; субтитр — справа, в первом снизу месте,
       где он не задевает текст строк, плашку и каретку; с места уходит, только когда задел. */
    const sub = document.getElementById("io-rec-sub"), car = document.getElementById("io-rec-caret");
    let lastHead = -1, frame = 0;
    const tick = () => {
      const ae = window.app.workspace.activeEditor, ed = ae && ae.editor;
      /* В открытом tagWheel каретки нет: смотреть на панель (его слово 2026-10-05). */
      const modal = !!document.querySelector(".modal-container, .cm-line.io-twline");
      const r = ed && !modal && document.body.classList.contains("io-rec-caret") ? ed.cm.coordsAtPos(ed.cm.state.selection.main.head) : null;
      if (!r) car.style.display = "none";
      else {
        const head = ed.cm.state.selection.main.head;
        Object.assign(car.style, { display: "", left: r.left + "px", top: r.top - 1 + "px", height: r.bottom - r.top + 2 + "px" });
        /* Сдвинулась — мигание с начала: каретка видна сразу на новом месте. */
        if (head !== lastHead) { lastHead = head; car.style.animation = "none"; void car.offsetWidth; car.style.animation = ""; }
      }
      const m = window.__ioRecMark;
      car.classList.toggle("is-hot", !!(m && m.hot));
      sub.classList.toggle("is-wide", !!document.querySelector(".modal.mod-settings") && !document.body.classList.contains("io-rec-hidemodal"));
      /* Место субтитра — раз в шесть кадров: замер строк каждый кадр тормозит запись. */
      if (++frame % 6 === 0 && !sub.classList.contains("is-wide") && sub.style.opacity !== "0") {
        const W = window.innerWidth, H = window.innerHeight, b = sub.getBoundingClientRect();
        const rects = [...document.querySelectorAll(".cm-line, .inline-title")].map((l) => {
          const rg = document.createRange(); rg.selectNodeContents(l); return rg.getBoundingClientRect();
        }).filter((x) => x.width > 0);
        /* Край субтитра — по тексту заметки, а не по плашке слева от строки. */
        const text = rects.filter((q) => q.height < 80);
        for (const n of [car, m && m.k, m && m.bg && m.d]) if (n && n.style.opacity !== "0" && n.style.display !== "none") rects.push(n.getBoundingClientRect());
        for (const n of document.querySelectorAll(".io-twscroller--shown, .hover-popover, .suggestion-container")) rects.push(n.getBoundingClientRect());
        const hit = (x, y) => rects.some((q) => q.left < x + b.width + 10 && q.right > x - 10 && q.top < y + b.height + 10 && q.bottom > y - 10);
        /* Сперва — сразу под текстом заметки, от его левого края: глаз не разрывается между строкой и субтитром (его слово 2026-10-05);
           не влез — справа снизу, мимо текста. */
        const left = text.length ? Math.min(...text.map((q) => q.left)) : 24;
        const low = text.length ? Math.max(...text.map((q) => q.bottom)) : 90;
        let x = sub.__x, y = sub.__y;
        if (y === undefined || sub.__h !== b.height || hit(x, y)) {
          x = undefined;
          for (let c = low + 34; c + b.height < H - 12; c += 12) if (!hit(left, c)) { x = left; y = c; break; }
          if (x === undefined) {
            x = W - 24 - b.width; y = H - 20 - b.height;
            for (let c = y; c > 90; c -= 12) if (!hit(x, c)) { y = c; break; }
          }
          sub.__x = x; sub.__y = y; sub.__h = b.height; sub.style.top = y + "px"; sub.style.left = x + "px"; sub.style.right = "auto";
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
    document.addEventListener("mousemove", (e) => { const p = document.getElementById("io-rec-ptr"); p.style.left = e.clientX + "px"; p.style.top = e.clientY + "px"; p.style.opacity = "1"; }, true);
    /* Указатель прячется при нажатии клавиши, как у системы при наборе: в заметке он отвлекает (его слово 2026-10-05). */
    document.addEventListener("keydown", () => { document.getElementById("io-rec-ptr").style.opacity = "0"; }, true);
    /* Затухающий круг на месте щелчка (его слово 2026-10-04). */
    document.addEventListener("mousedown", (e) => {
      const d = document.createElement("div"); d.className = "io-rec-ripple";
      d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px";
      document.body.appendChild(d); setTimeout(() => d.remove(), 800);
    }, true);
  }, CSS);
  return cdp;
}

const overlay = (win, id, text) => win.evaluate(([id, t]) => {
  const d = document.getElementById(id); if (t) d.textContent = t; d.style.opacity = t ? "1" : "0";
}, [id, text]);

/**
 * Подсветка того, что двигает нажатие (его слово 2026-10-04: «куда смотреть»; запаздывание
 * подсветки он назвал «очень плохо»). Встаёт на строку каретки до нажатия; страница сама
 * сверяет заметку каждый кадр и в том же кадре, где строка переехала, переносит подсветку
 * на новое место (`moved`). Запись в этом не участвует — её задержка до экрана не доходит.
 */
const markStart = (win, mode) => win.evaluate(([movedSrc, mode]) => {
  const moved = (0, eval)("(" + movedSrc + ")");
  const ed = window.app.workspace.activeEditor.editor, cm = ed.cm;
  const snap = () => ({ lines: ed.getValue().split("\n"), at: ed.getCursor().line });
  const before = snap();
  let text = before.lines.join("\n"), span = [before.at, before.at];
  const d = document.createElement("div"); d.className = "io-rec-mark";
  /* Фон строки — только `mark line` (перенос строк): в остальных GIF он сбивал (его слово 2026-10-04);
     без фона смотреть на каретку, она светится. `mark prefix` — фон на отступе и Prefix строки. */
  const bg = mode === "line" || mode === "prefix";
  if (!bg) d.style.background = "none";
  if (mode === "prefix") d.style.background = "hsla(var(--accent-h),var(--accent-s),var(--accent-l),.35)";
  /* Клавиша — у самой строки, а не в углу (его слово 2026-10-04): видно, что нажатие и правка одно. */
  const k = document.createElement("div"); k.className = "io-rec-hk"; k.style.opacity = "0";
  document.body.append(d, k);
  /* Светится каретка только в `mark caret` — где суть в её месте (прыжки), его слово 2026-10-05. */
  const st = { live: true, hot: mode === "caret", bg, d, k };
  let caret = before.at;
  const place = () => {
    if (!st.live) return;
    const now = ed.getValue(), at = ed.getCursor().line;
    if (now !== text) { text = now; caret = at; span = moved(before, snap()); }
    /* Текст не менялся, а каретка ушла (прыжки): подсветка идёт за кареткой. */
    else if (at !== caret) { caret = at; span = [at, at]; }
    const top = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: 0 }));
    const end = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: ed.getLine(span[0]).length }));
    const bot = cm.coordsAtPos(ed.posToOffset({ line: span[1], ch: ed.getLine(span[1]).length }));
    const box = cm.contentDOM.getBoundingClientRect();
    if (mode === "prefix") {
      /* Отступ и Prefix строки каретки; простой текст — узкая метка у начала строки. */
      const l = ed.getLine(span[0]);
      const p = l.match(/^\s*(?:(?:#{1,6}|[-*+](?: \[.\])?|\d+[.)]|>)\s)?/)[0].length;
      const a = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: 0 }));
      const z = cm.coordsAtPos(ed.posToOffset({ line: span[0], ch: p }));
      if (a && z) Object.assign(d.style, { left: a.left - 6 + "px", width: Math.max(10, z.left - a.left + 6) + "px", top: a.top - 3 + "px", height: a.bottom - a.top + 6 + "px" });
    } else if (top && bot) Object.assign(d.style, { left: box.left - 12 + "px", width: box.width + 24 + "px", top: top.top - 3 + "px", height: bot.bottom - top.top + 6 + "px" });
    /* Плашка — над кареткой и идёт за ней (его слова 2026-10-05 к jump-line, smart-delete); задевает текст
       другой строки — слева от начала строки (к fields); слева тесно — справа от конца строки. */
    const c = cm.coordsAtPos(cm.state.selection.main.head);
    if (c && end) {
      const kb = k.getBoundingClientRect(), own = cm.lineBlockAt(cm.state.selection.main.head).from;
      const others = [...cm.contentDOM.querySelectorAll(".cm-line")].filter((l) => { try { return cm.lineBlockAt(cm.posAtDOM(l)).from !== own; } catch (_e) { return false; /* узел вне документа — не текст */ } })
        .map((l) => { const rg = document.createRange(); rg.selectNodeContents(l); return rg.getBoundingClientRect(); }).filter((q) => q.width > 0);
      const hit = (x, y) => others.some((q) => q.left < x + kb.width + 6 && q.right > x - 6 && q.top < y + kb.height && q.bottom > y);
      const fit = (v) => Math.max(8, Math.min(window.innerWidth - kb.width - 8, v));
      const a = cm.coordsAtPos(cm.lineBlockAt(cm.state.selection.main.head).from);
      /* Слева от строки: левее её начала и левее окна Scroller tagWheel. */
      const sc = [...document.querySelectorAll(".io-twscroller--shown")].map((n) => n.getBoundingClientRect().left);
      const lx = a ? Math.min(a.left, ...sc) - kb.width - 14 : -1, ly = (c.top + c.bottom) / 2 - kb.height / 2;
      let y = c.top - kb.height - 8, x;
      /* В tagWheel смотрят на его ячейку в начале строки — плашка слева от строки (его слово к fields). */
      if (st.left && lx >= 8) { x = lx; y = ly; }
      /* Прыжки — всегда над кареткой, за ней (к jump-line); иначе над кареткой, если не задевает текст. */
      else if (mode === "caret") x = fit(c.left - kb.width / 2);
      else x = [c.left - kb.width / 2, c.left - 14].map(fit).find((v) => !hit(v, y));
      if (y < 4 || x === undefined) { y = ly; x = lx >= 8 ? lx : end.right + 28; }
      Object.assign(k.style, { left: x + "px", top: y + "px" });
    }
    requestAnimationFrame(place);
  };
  place();
  window.__ioRecMark = st;
}, [moved.toString(), mode]);

/** Плашка вспыхивает в момент нажатия и затухает; следующее нажатие сменяет её, а не ложится рядом (его слово 2026-10-05 к fields). */
const markPress = (win, label, tw) => win.evaluate(([label, tw]) => {
  const st = window.__ioRecMark, k = st.k;
  clearTimeout(st.fade);
  st.left = tw || !!document.querySelector(".cm-line.io-twline");
  k.textContent = label; k.style.opacity = "1";
  k.classList.remove("is-press"); void k.offsetWidth; k.classList.add("is-press");
  st.fade = setTimeout(() => { k.style.opacity = "0"; }, 1300);
}, [label, tw]);

const markEnd = (win) => win.evaluate(() => {
  const st = window.__ioRecMark;
  if (!st) return;
  st.hot = false;
  st.d.style.opacity = "0"; st.k.style.opacity = "0";
  setTimeout(() => { st.live = false; st.d.remove(); st.k.remove(); }, 700);
});

/** Панель закрыта — указатель уходит с экрана: в заметке он отвлекает (его слово 2026-10-05). */
const closeSettings = (win) => win.evaluate(() => {
  window.app.setting.close(); document.getElementById("io-rec-ptr").style.opacity = "0";
  const s = document.getElementById("io-rec-spot"); if (s) s.remove();
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
  /* Строка каретки не та, что была (Enter, вставка): ехать за ней нечему — одна строка.
     Номер пункта не в счёт: после переноса его пересчитывает Obsidian. */
  const bare = (l) => (l || "").replace(/^(\s*)\d+[.)]\s/, "$1");
  if (bare(after.lines[after.at]) !== bare(before.lines[before.at])) return [after.at, to];
  for (let k = 1; after.at + k < after.lines.length && before.at + k < before.lines.length; k++) {
    const l = after.lines[after.at + k];
    if (l !== before.lines[before.at + k] || !l.trim()) break;
    to = after.at + k;
  }
  return [after.at, to];
}

/** Видимый узел с этим текстом (последний или `nth`-й сверху), в центр экрана; его середина. */
async function find(win, text, nth = 0) {
  const box = await win.evaluate(([t, nth]) => {
    const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    /* Вкладка и кнопка раньше текста: «Navigation» — и вкладка, и строка модуля. */
    const hit = (sel, leaf) => {
      const all = [...document.querySelectorAll(sel)]
        .filter((x) => vis(x) && x.textContent.trim() === t && !(leaf && [...x.children].some((c) => c.textContent.trim() === t)));
      return nth ? all[nth - 1] : all.pop();
    };
    const n = hit("button, [role=tab], .vertical-tab-nav-item", false) || hit(".setting-item-name, div, span, a", true);
    if (!n) return null;
    if (!window.__ioRecInView(n)) n.scrollIntoView({ block: "center" });
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [text, nth]);
  if (!box) throw new Error("нет «" + text + "» на экране");
  return box;
}

/** Видимый узел с этой подписью `aria-label` (кнопка-значок без текста: глаз, стрелка уровня). */
async function findLabel(win, label) {
  const box = await win.evaluate((t) => {
    const n = [...document.querySelectorAll("[aria-label]")]
      .filter((x) => x.getAttribute("aria-label") === t && x.getBoundingClientRect().width > 0).pop();
    if (!n) return null;
    if (!window.__ioRecInView(n)) n.scrollIntoView({ block: "center" });
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!box) throw new Error("нет «" + label + "» на экране ни текстом, ни подписью");
  return box;
}

async function point(win, box) {
  await win.mouse.move(box.x, box.y, { steps: 14 });
  await win.waitForTimeout(200);
}

/** Строка панели по имени (у неё есть контрол): метка `data-io-rec`, в кадр без прокрутки, если уже видна; род контрола. */
const markRow = (win, name, nth) => win.evaluate(([name, nth]) => {
    /* Заголовок группы бывает тёзкой контрола (`Tag Bars`, `Inline to note`): берётся строка,
       у которой есть контрол, а не заголовок. */
    const ctl = "select, .checkbox-container, input, textarea, button:not(.clickable-icon)";
    const row = [...document.querySelectorAll(".setting-item:not(.setting-item-heading)")].filter((r) => {
      const n = r.querySelector(".setting-item-name");
      const c = r.querySelector(".setting-item-control");
      return n && n.textContent.trim() === name && c && c.querySelector(ctl);
    })[nth - 1]
      /* Строка редактора Fields (`Child Field`, `Active`…) — свой узел `.io-item`, не `.setting-item`. */
      || [...document.querySelectorAll(".io-item")].filter((r) => {
        const n = r.querySelector(".io-item__name");
        const c = r.querySelector(".io-item__control");
        return n && n.textContent.trim() === name && c && c.querySelector(ctl) && r.getBoundingClientRect().height > 0;
      })[nth - 1];
    if (!row) return null;
    if (!window.__ioRecInView(row)) row.scrollIntoView({ block: "center" });
    row.setAttribute("data-io-rec", "1");
    return row.querySelector("select") ? "select" : row.querySelector(".checkbox-container") ? "toggle"
      : row.querySelector("input[type=range]") ? "range" : row.querySelector("input[type=color]") ? "color"
        : row.querySelector("input[type=text], input[type=number], input:not([type]), textarea") ? "text" : "buttons";
}, [name, nth]);

/** За кадром, пока панель невидима: прокрутить к контролу первого шага в ней. */
async function aimAt(win, [op, arg]) {
  const m = arg.match(/^(.*?)(?: #(\d+))?(?: = .*)?$/);
  if (op === "set") await markRow(win, m[1].trim(), m[2] ? Number(m[2]) : 1);
  /* Первая рамка — у верха панели: следующие разделы (`Values` под Field) остаются в кадре без прокрутки. */
  else if (op === "spot" && await win.evaluate((t) => {
    const n = window.__ioRecSpotNode(t);
    if (!n) return false;
    for (let s = n.parentElement; s; s = s.parentElement) if (s.scrollHeight > s.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(s).overflowY)) {
      for (let k = 0; k < 3; k++) s.scrollTop += n.getBoundingClientRect().top - 110;
      break;
    }
    return true;
  }, arg)) { /* своя строка найдена */ }
  else if (op === "click" || op === "spot") await find(win, m[1], m[2] ? Number(m[2]) : 0).catch(() => findLabel(win, arg));
  else if (op === "hover") { const h = arg.split(" + ")[0].match(/^(.*?)(?: #(\d+))?$/); await find(win, h[1], h[2] ? Number(h[2]) : 0); }
  else if (op === "fill" || op === "pick") {
    const t = arg.split(" = ")[0];
    await win.evaluate((t) => {
      const n = [...document.querySelectorAll("input, textarea, select")].find((x) => x.getBoundingClientRect().width > 0
        && [x.placeholder, x.getAttribute("aria-label"), x.title].some((v) => v && v.startsWith(t)));
      if (n && !window.__ioRecInView(n)) n.scrollIntoView({ block: "center" });
    }, t);
  }
  await win.evaluate(() => document.querySelectorAll("[data-io-rec]").forEach((n) => n.removeAttribute("data-io-rec")));
}

/** Контрол строки панели по её имени: выпадающий список, переключатель или кнопки-варианты. */
async function setControl(win, name, value) {
  /* `<имя> #2` — второй контрол с тем же именем на вкладке. */
  const m = name.match(/^(.*) #(\d+)$/);
  const nth = m ? Number(m[2]) : 1;
  if (m) name = m[1];
  const kind = await markRow(win, name, nth);
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
  } else if (kind === "range" || kind === "color") {
    /* Ползунок: указатель ведёт ручку к новому месту; цвет: щелчок по образцу и значение
       (системное окно цвета в кадр не попадает). Значение ставится событиями input и change. */
    const t = row.locator("input[type=" + kind + "]").first();
    const b = await t.boundingBox();
    const at = kind === "range"
      ? await t.evaluate((n, v) => (Number(v) - Number(n.min || 0)) / ((Number(n.max || 100) - Number(n.min || 0)) || 1), value)
      : 0.5;
    await point(win, { x: b.x + (kind === "range" ? 0 : b.width / 2), y: b.y + b.height / 2 });
    await win.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y })), [b.x, b.y + b.height / 2]);
    if (kind === "range") await win.mouse.move(b.x + b.width * Math.min(1, Math.max(0, at)), b.y + b.height / 2, { steps: 12 });
    await t.evaluate((n, v) => {
      n.value = v;
      n.dispatchEvent(new Event("input", { bubbles: true }));
      n.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
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
  /* Строку редактора Fields выбор перерисовывает: метки может уже не быть. */
  await win.evaluate(() => document.querySelectorAll("[data-io-rec]").forEach((n) => n.removeAttribute("data-io-rec")));
  await win.waitForTimeout(500);
}

/** Плашка называет команду, а не клавиши (его слово 2026-10-04: «hotkey: move line up»): имя — из палитры Obsidian. */
const cmdLabel = (win, id) => win.evaluate((id) => {
  /* Id с двоеточием — чужая команда (встроенная Obsidian для «До»-GIF), без — команда плагина. */
  const c = window.app.commands.commands[id.includes(":") ? id : "inline-overhaul:" + id];
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
    if (op === "preset") {
      const at = arg.indexOf(" = ");
      if (at < 0) throw new Error("preset: нужно «путь = JSON»: " + arg);
      await win.evaluate(([p, v]) => {
        const patch = {};
        const keys = p.split(".");
        let o = patch;
        for (const k of keys.slice(0, -1)) o = o[k] = {};
        o[keys[keys.length - 1]] = v;
        window.app.plugins.plugins["inline-overhaul"].setConfigPatch(patch, "showcase:preset");
      }, [arg.slice(0, at).trim(), JSON.parse(arg.slice(at + 3))]);
      await win.waitForTimeout(300);
    } else if (op === "drop") {
      /* `drop <Field>` — Field (и его дочерний) убран за кадром: в панели остаются только нужные GIF (его слово 2026-10-05). */
      await win.evaluate((k) => {
        const ks = [k, k + "_sub"];
        window.app.plugins.plugins["inline-overhaul"].store.update((c) => {
          const f = c.pkm.fields, o = f.order;
          for (const side of ["left", "right"]) o[side] = (o[side] || []).filter((x) => !ks.includes(x));
          for (const b of o.custom || []) b.keys = (b.keys || []).filter((x) => !ks.includes(x));
          for (const v of Object.values(o)) if (v && typeof v === "object" && !Array.isArray(v)) for (const x of ks) delete v[x];
          for (const g of ["tags", "links"]) if (f[g]) f[g].fields = (f[g].fields || []).filter((x) => !ks.includes(x.id));
          return c;
        }, "showcase:drop", { undoable: false });
      }, arg);
      await win.waitForTimeout(300);
    } else if (op === "open") {
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
      if (!label) throw new Error("нет команды " + arg);
      /* Нажатие ждёт, пока субтитр прочитан; панель между ними — тоже время чтения. */
      await win.waitForTimeout(Math.max(0, readUntil - Date.now()));
      /* Подряд идущие нажатия — одна подсветка: она идёт за строкой, плашка мигает на каждом. */
      if (!run.marking) { await markStart(win, run.markMode || "none"); await win.waitForTimeout(250); }
      /* Плашка — в момент нажатия (его слово 2026-10-05 к fields: «появляется во время нажатия и затухает»). */
      await markPress(win, label, op === "cmd" && /tagwheel/.test(arg));
      await win.waitForTimeout(120);
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
      /* Только для показов в самой панели: после `set` панель закрывается сама. Субтитр дочитывается. */
      await win.waitForTimeout(Math.max(0, readUntil - Date.now()));
      await closeSettings(win);
      await win.waitForTimeout(450);
    } else if (op === "mark") {
      /* `mark line` — фон строки (перенос строк), `mark prefix` — фон отступа и Prefix, `mark caret` — светится каретка (прыжки), `mark none` — ничего. */
      run.markMode = { on: "line", off: "none" }[arg] || arg;
      if (!["line", "prefix", "caret", "none"].includes(run.markMode)) throw new Error("mark: line | prefix | caret | none");
    } else if (op === "stage") {
      /* `stage <подпись>` — новый этап полосы, назван сценарием (его слово 2026-10-05); `settings` тогда этапа не начинает. */
      run.stages.push({ t: Date.now() / 1000, label: arg });
    } else if (op === "room") {
      /* `room <px>` — запас высоты окна под заметкой (окно открывающегося вниз tagWheel). */
      run.room = Number(arg);
    } else if (op === "line-width") {
      /* `line-width <px>` — колонка текста уже: слева от коротких строк место под плашку (fields). */
      await win.evaluate((w) => document.body.style.setProperty("--file-line-width", w + "px"), Number(arg));
    } else if (op === "rec-caret") {
      /* `rec-caret off` — родная каретка вместо каретки записи: GIF про саму каретку (cursor). */
      await win.evaluate((on) => document.body.classList.toggle("io-rec-caret", on), arg !== "off");
    } else if (op === "pause") {
      await win.waitForTimeout(Number(arg));
    } else if (op === "settings") {
      if (run.autoStages) run.stages.push({ t: Date.now() / 1000, label: run.autoStages.shift() });
      /* Панель открывается невидимой и показывается уже на нужном контроле — без прокрутки на камеру (его слово 2026-10-05). */
      await win.evaluate(() => document.body.classList.add("io-rec-hidemodal"));
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
      /* Только в пределах этого этапа: каретка следующего этапа встанет под его панелью. */
      const rest = steps.slice(si + 1), end = rest.findIndex(([o]) => o === "settings");
      const nc = rest.slice(0, end < 0 ? rest.length : end).find(([o]) => o === "caret" || o === "select");
      await win.evaluate(async ([files, at]) => {
        const [line, part] = at.split(" @ ");
        const a = window.app;
        /* Открытую заметку — через редактор: несохранённая правка редактора перебивает запись в файл. */
        const ed = a.workspace.activeEditor;
        for (const [n, t] of Object.entries(files)) {
          if (ed && ed.file && ed.file.path === n) ed.editor.setValue(t);
          /* Заметку, положенную в папку демо после старта записи (параллельные сессии), — пропустить. */
          else if (a.vault.getAbstractFileByPath(n)) await a.vault.modify(a.vault.getAbstractFileByPath(n), t);
        }
        /* Каретка — туда, где её ждёт следующий показ: иначе мелькает первая строка. */
        const e = a.workspace.activeEditor && a.workspace.activeEditor.editor;
        const k = e && line ? e.getValue().split("\n").lastIndexOf(line) : -1;
        const ch = part === undefined ? line.length : line.indexOf(part);
        if (k >= 0 && ch >= 0) e.setCursor({ line: k, ch });
      }, [notes(), nc ? nc[1] : ""]);
      const aim = rest.find(([o]) => ["set", "click", "fill", "pick", "hover", "spot"].includes(o));
      if (aim) await aimAt(win, aim).catch(() => { /* не нашёлся — упадёт сам шаг, с понятной ошибкой */ });
      await win.waitForTimeout(150);
      await win.evaluate(() => document.body.classList.remove("io-rec-hidemodal"));
      await win.waitForTimeout(350);
    } else if (op === "fill") {
      /* Поле своего блока без имени строки — по подсказке внутри поля. */
      const [ph, text] = arg.split(" = ");
      let t = win.locator("input[placeholder=\"" + ph + "\"]:visible, textarea[placeholder=\"" + ph + "\"]:visible").first();
      /* Подсказки нет — поле по `aria-label` (ячейка таблицы Values: «Value #todo of Status»). */
      if (!await t.count()) t = win.locator("input[aria-label=\"" + ph + "\"]:visible, textarea[aria-label=\"" + ph + "\"]:visible").first();
      /* Поле ниже экрана (`#tag / tag` под таблицей Values) — сперва в кадр: иначе щелчок мимо и набор в никуда. */
      if (await t.count()) await t.scrollIntoViewIfNeeded();
      const b = await t.count() ? await t.boundingBox() : null;
      if (!b) throw new Error("нет поля с подсказкой «" + ph + "»");
      await point(win, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      if (await t.evaluate((n) => n.type === "color")) {
        /* Цвет в строке своего блока (`Fill color for #errand`): круг щелчка и значение событиями —
           системное окно цвета в кадр не попадает. */
        await win.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y })), [b.x + b.width / 2, b.y + b.height / 2]);
        await t.evaluate((n, v) => {
          n.value = v;
          n.dispatchEvent(new Event("input", { bubbles: true }));
          n.dispatchEvent(new Event("change", { bubbles: true }));
        }, text);
      } else {
        await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await win.keyboard.type(text, { delay: 60 });
      }
      await win.waitForTimeout(400);
    } else if (op === "pick") {
      /* Список своего блока без имени строки: по aria-label, title или подписи рядом. */
      const [label, value] = arg.split(" = ");
      const ok = await win.evaluate((label) => {
        const own = (s) => [s.getAttribute("aria-label"), s.title, s.previousElementSibling && s.previousElementSibling.textContent,
          s.parentElement && [...s.parentElement.childNodes].filter((c) => c !== s).map((c) => c.textContent).join(" ")];
        const s = [...document.querySelectorAll("select:not(.is-measuring)")]
          .find((x) => x.getBoundingClientRect().width > 0 && own(x).some((t) => t && t.trim().startsWith(label)));
        if (!s) return false;
        if (!window.__ioRecInView(s)) s.scrollIntoView({ block: "center" });
        s.setAttribute("data-io-pick", "1");
        return true;
      }, label);
      if (!ok) throw new Error("нет списка с подписью «" + label + "»");
      const sel = win.locator("[data-io-pick='1']");
      const labels = await sel.evaluate((n) => [...n.options].map((o) => o.textContent.trim()));
      if (!labels.includes(value)) throw new Error("у «" + label + "» нет «" + value + "»; есть: " + labels.join(" | "));
      const b = await sel.boundingBox();
      await point(win, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      await win.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent("mousedown", { clientX: x, clientY: y })), [b.x + b.width / 2, b.y + b.height / 2]);
      await sel.selectOption({ label: value });
      /* Выбор перерисовывает свой блок (ячейка Show таблицы Values): метку снимать с документа, а не со старого узла. */
      await win.evaluate(() => document.querySelectorAll("[data-io-pick]").forEach((n) => n.removeAttribute("data-io-pick")));
      await win.waitForTimeout(500);
    } else if (op === "hover") {
      /* `hover <текст>` — указатель на узел; `+ Ctrl` — с зажатым Ctrl (превью ссылки), 1,5 с. */
      const [t0, mod] = arg.split(" + ");
      const m = t0.match(/^(.*) #(\d+)$/);
      const b = await find(win, m ? m[1] : t0, m ? Number(m[2]) : 0);
      if (mod) await win.keyboard.down(mod === "Ctrl" ? "Control" : mod);
      await point(win, b);
      await win.waitForTimeout(1500);
      if (mod) await win.keyboard.up(mod === "Ctrl" ? "Control" : mod);
    } else if (op === "spot") {
      /* `spot <текст>[ #N]` — рамка вокруг того, о чём субтитр (его слово 2026-10-05 к fields: «я не понял, на что смотреть»).
         Строка списка Fields — целиком; заголовок раздела (`Values`) — вместе с разделом до следующего заголовка. */
      await win.waitForTimeout(Math.max(0, readUntil - Date.now()));
      const m = arg.match(/^(.*) #(\d+)$/);
      const own = await win.evaluate((t) => { const n = window.__ioRecSpotNode(t); if (n && !window.__ioRecInView(n)) n.scrollIntoView({ block: "center" }); return !!n; }, arg);
      const b = own ? { x: 0, y: 0, t: arg } : await find(win, m ? m[1] : arg, m ? Number(m[2]) : 0);
      await win.evaluate(([x, y, t]) => {
        const at = t ? window.__ioRecSpotNode(t) : document.elementFromPoint(x, y);
        const row = at.closest(".io-fields__item, .io-item__namerow, .setting-item, button") || at;
        const parts = [row];
        if (row.classList.contains("io-item__namerow")) for (let s = row.nextElementSibling; s && !s.classList.contains("io-item__namerow"); s = s.nextElementSibling) parts.push(s);
        let d = document.getElementById("io-rec-spot");
        if (!d) { d = document.createElement("div"); d.id = "io-rec-spot"; document.body.append(d); }
        d.__parts = parts; d.style.opacity = "1";
        const place = () => {
          if (d.__parts !== parts || !d.isConnected) return;
          const rs = parts.map((p) => p.getBoundingClientRect()).filter((r) => r.height > 0);
          const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
          const r = Math.max(...rs.map((q) => q.right)), btm = Math.min(window.innerHeight - 84, Math.max(...rs.map((q) => q.bottom)));
          Object.assign(d.style, { left: l - 6 + "px", top: t - 6 + "px", width: r - l + 12 + "px", height: btm - t + 12 + "px" });
          requestAnimationFrame(place);
        };
        place();
      }, [b.x, b.y, b.t || ""]);
    } else if (op === "click") {
      /* `click <текст> #N` — N-е совпадение сверху (без номера — последнее); текста нет — узел по `aria-label`. */
      const m = arg.match(/^(.*) #(\d+)$/);
      const b = await find(win, m ? m[1] : arg, m ? Number(m[2]) : 0).catch(() => findLabel(win, arg));
      await point(win, b);
      await win.mouse.click(b.x, b.y);
      await win.waitForTimeout(600);
    } else if (op === "set") {
      const [name, value] = arg.split(" = ");
      await setControl(win, name.trim(), value.trim());
      /* Панель закрывается сама сразу после контрола: GIF про поведение в заметке (его слово 2026-10-04).
         Следующий шаг тоже в панели (галочки, окно, подсказка) — панель остаётся, закроет `close`. */
      if (!["set", "click", "fill", "pick", "pause", "close", "spot"].includes(next)) {
        await closeSettings(win);
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

/** Полоса этапов картинками: на каждый этап своя (он залит, прошедшие светлее) и одна без этапа — под заставку. Ширина этапа — его доля времени. */
async function renderBars(win, labels, widths, tmp) {
  const files = [];
  for (let now = -1; now < labels.length; now++) {
    await win.evaluate(([labels, widths, now]) => {
      let d = document.getElementById("io-rec-barsrc");
      if (!d) { d = document.createElement("div"); d.id = "io-rec-barsrc"; document.body.append(d); }
      d.innerHTML = "<div></div><b></b>";
      labels.forEach((t, i) => {
        const x = document.createElement("i"); x.textContent = t; x.style.flex = widths[i] + " 1 0";
        if (i < now) x.className = "is-done"; else if (i === now) x.className = "is-now";
        d.firstChild.append(x);
      });
    }, [labels, widths, now]);
    const f = path.join(tmp, "bar" + (now + 1) + ".png");
    await win.locator("#io-rec-barsrc").screenshot({ path: f });
    files.push(f);
  }
  return files;
}

/** Кадры с метками времени → GIF: длительность каждого кадра — до следующего, вырезки за кадром выброшены.
    Под кадром — полоса этапов (\`bars\`: картинки и начала этапов в секундах GIF) и полоска просмотра под ней (его слово 2026-10-05). */
function encode(frames, cut, end, tmp, out, bars) {
  const keep = frames.filter((f) => !cut.some(([a, b]) => f.t >= a && f.t <= b));
  const lines = [];
  keep.forEach((f, i) => {
    let next = i + 1 < keep.length ? keep[i + 1].t : end;
    for (const [a, b] of cut) if (a >= f.t && b <= next) next -= b - a;
    /* Длительность — точная: прежний пол 0,02 с растягивал частые кадры анимаций, и видео к концу
       отставало от полосы этапов на секунды (его слово 2026-10-05 к jump-line). */
    lines.push("file '" + f.file.replace(/\\/g, "/") + "'", "duration " + Math.max(0.001, next - f.t).toFixed(3));
  });
  lines.push("file '" + keep[keep.length - 1].file.replace(/\\/g, "/") + "'");
  const list = path.join(tmp, "frames.txt");
  fs.writeFileSync(list, lines.join("\n"));
  const { files, starts, total } = bars;
  const g = ["[0:v]fps=" + FPS + ",scale=" + OUT_W + ":-2:flags=lanczos,pad=iw:ih+" + BAR_H + ":0:0:white[v0]"];
  /* Картинка 0 — до первого этапа (заставка), картинка i+1 — этап i до начала следующего. */
  const from = [0, ...starts], to = [...starts, 1e9];
  files.forEach((_f, k) => {
    g.push("[" + (k + 1) + ":v]scale=" + OUT_W + ":" + BAR_H + "[b" + k + "]");
    g.push("[v" + k + "][b" + k + "]overlay=0:main_h-" + BAR_H + ":enable='gte(t," + from[k].toFixed(3) + ")*lt(t," + to[k].toFixed(3) + ")'[v" + (k + 1) + "]");
  });
  /* Полоска просмотра — как в видео, от начала GIF (его слово 2026-10-05): сплошная полоса въезжает слева.
     drawbox считал ширину один раз и стоял на месте; x у overlay считается на каждом кадре. */
  g.push("color=c=0x8b3dff:s=" + OUT_W + "x" + PROG_H + "[pg]");
  g.push("[v" + files.length + "][pg]overlay=x='-w+W*clip(t/" + Math.max(0.1, total).toFixed(3) + ",0,1)':y=H-" + PROG_H + ":shortest=1"
    + ",split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, ...files.flatMap((f) => ["-i", f]),
    "-filter_complex", g.join(";"), "-loop", "0", out]);
}

async function main() {
  const id = process.argv[2];
  if (!id) { console.log("node tools/showcase_record.js <id>"); process.exit(2); }
  const all = readSteps(id);
  /* `title <заголовок> | <строка>` — заставка в начале GIF, шагом записи не является. */
  const title = (all.find(([op]) => op === "title") || [, ""])[1].split(" | ");
  const steps = all.filter(([op]) => op !== "title");
  const dry = !!process.env.IO_DRY;
  const { win, env, close, browser } = await launch("clean-showcase");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "io-showcase-"));
  const frames = [], cut = [], log = [];
  let ok = false;
  const watchdog = setTimeout(() => { console.error("запись зависла: 10 минут"); close().finally(() => process.exit(3)); }, 10 * 60 * 1000);
  watchdog.unref();
  try {
    const first = steps.find(([op]) => op === "settings");
    run.stages = [];
    run.autoStages = null;
    if (!steps.some(([op]) => op === "stage")) {
      /* Без шагов \`stage\` — прежние подписи: последний субтитр перед заходом в настройки (\`Moving behavior → Whole tree\`). */
      const labels = [first ? "Default" : title[0] || "Default"];
      steps.forEach(([op], i) => {
        if (op !== "settings") return;
        const say = steps.slice(0, i).reverse().find(([o, a]) => o === "say" && a);
        labels.push(say ? say[1] : "");
      });
      run.stages.push({ t: 0, label: labels[0] });
      run.autoStages = labels.slice(1);
    }
    const cdp = await stage(win, browser, first && first[1], bindCommands(steps));
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
      const pre = steps.findIndex(([op]) => !["preset", "drop", "open", "caret", "mark", "rec-caret", "stage", "room", "line-width"].includes(op));
      await run(win, steps.slice(0, pre), cut, log);
      /* Окно — по высоте заметки: без пустоты между текстом и субтитром (его слово 2026-10-05). */
      await win.evaluate(async ([room, minH]) => {
        const lines = [...document.querySelectorAll(".workspace-leaf.mod-active .cm-line")];
        const last = lines.length ? lines[lines.length - 1].getBoundingClientRect().bottom : window.innerHeight;
        const h = Math.min(window.innerHeight, Math.max(minH, Math.ceil(last + room + 110)));
        const bw = window.require("@electron/remote").getCurrentWindow();
        bw.setContentSize(bw.getContentSize()[0], h);
        await new Promise((r) => setTimeout(r, 600));
      }, [run.room || 0, first ? MIN_H : 0]);
      /* Первый кадр — чистая заметка: ни окна, ни уведомления (его слово 2026-10-04). */
      await win.evaluate(() => document.querySelectorAll(".notice").forEach((n) => n.remove()));
      const extra = await win.evaluate(() => [...document.querySelectorAll(".modal-container, .notice")].map((n) => n.textContent.slice(0, 60)));
      if (extra.length) throw new Error("до записи на экране лишнее: " + extra.join(" | "));
      const size = await win.evaluate(() => [window.innerWidth, window.innerHeight]);
      if (title[0]) {
        await win.evaluate(([t, s]) => {
          const d = document.createElement("div"); d.id = "io-rec-title";
          const b = document.createElement("b"); b.textContent = t; d.append(b);
          if (s) { const p = document.createElement("span"); p.textContent = s; d.append(p); }
          document.body.append(d);
        }, title);
      }
      if (!dry) await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: size[0], maxHeight: size[1], everyNthFrame: 1 });
      if (title[0]) {
        await win.waitForTimeout(Math.max(2600, READ_MS + READ_PER_CHAR * title.join(" ").length));
        await win.evaluate(() => { const d = document.getElementById("io-rec-title"); d.style.opacity = "0"; setTimeout(() => d.remove(), 500); });
      }
      run.titleEnd = Date.now() / 1000;
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
      const sec = end - frames[0].t - cut.reduce((s, [a, b]) => s + b - a, 0);
      /* Этап начинается не раньше конца заставки; ширина на полосе — доля его времени. */
      const starts = run.stages.map((x) => Math.max(x.t, run.titleEnd) - frames[0].t);
      const widths = starts.map((a, i) => Math.max(0.01, (i + 1 < starts.length ? starts[i + 1] : sec) - a));
      const files = await renderBars(win, run.stages.map((x) => x.label), widths, tmp);
      encode(frames, cut, end, tmp, out, { files, starts, total: sec });
      console.log("ok: " + path.relative(ROOT, out) + " — " + sec.toFixed(1) + " с, " + (fs.statSync(out).size / 1048576).toFixed(2) + " МБ, кадров " + frames.length);
    } else console.log("ok: шагов " + log.length + " (без записи)");
    ok = true;
  } finally {
    clearTimeout(watchdog);
    await close();
    await new Promise((r) => setTimeout(r, 1500));
    /* Уборка: папку держит выходящий Obsidian (EPERM) — готовый GIF от этого не хуже, код выхода не портим. */
    try { fs.rmSync(env.work, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch (_e) { console.error("временный vault не убран: " + env.work); }
    if (ok) fs.rmSync(tmp, { recursive: true, force: true }); else console.error("кадры оставлены: " + tmp);
  }
  process.exit(ok ? 0 : 1);
}

module.exports = { stage, moved };
if (require.main === module) main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
