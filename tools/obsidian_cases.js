"use strict";

/**
 * Случаи пакета чистого vault для `node tools/obsidian_bench.js clean [id,…]`.
 *
 * Каждый — строка перечня `docs/dev/BUGHUNT_2026-09-26.md`: заметки, каретка,
 * шаги (строка — команда плагина; `{key}`, `{type}`, `{click}` — настоящие
 * нажатия; `{cfg}` — правка настроек; `{open}` — другая заметка), ожидаемое.
 * `{{today}}` — сегодняшняя дата. Настройки после случая возвращаются.
 * Строка перечня и номер случая совпадают: `F3.a` — первый случай F3.
 */

/* Включённый `Keep typed tags in text` — поведение `В-235` (цикл 103). */
const STAY_ON = { pkm: { placement: { typedTagsStayText: true } } };

/* Своя заметка у каждого случая: открытый редактор прошлого случая не
   успевает принять новое содержимое той же заметки. */
const one = (id, title, line, steps, want, extra) => {
  const f = "t-" + id + ".md";
  const re = (o) => o && JSON.parse(JSON.stringify(o).split('"t.md"').join(JSON.stringify(f)));
  return Object.assign({ id, title, files: { [f]: line + "\n" }, at: { file: f, line: 0 }, steps, expect: { [f]: want + "\n" } },
    extra || {}, ...["files", "at", "expect", "expectDisk"].filter((k) => extra && extra[k]).map((k) => ({ [k]: re(extra[k]) })));
};

/* Transform со включённым `Inline to note`: шаги — число (нажатие) или "undo";
   ждём файл `note` и строку (печатается), `more` — дополнительное условие. */
const I2N = { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true } } };
const tr = (id, title, line, presses, note, more) => one(id, title, line,
  [].concat(...presses.map((x) => (x === "undo" ? [{ js: "ed.undo();", wait: 600 }, { js: "if (ed.getLine(0).includes('[[')) throw new Error('отмена не вернула строку: ' + ed.getLine(0));" }] : [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1500 }]))),
  "", { cfg: I2N, expect: {}, settle: 800,
    check: "const line = a.workspace.activeEditor.editor.getLine(0); const ok = !!a.vault.getAbstractFileByPath(" + JSON.stringify(note) + ")" + (more ? " && (" + more + ")" : "") + "; return ok || JSON.stringify({ line, files: a.vault.getFiles().map((f) => f.path).filter((p) => !/^(t-|Демо|Проверка)/.test(p)) });" });

module.exports = [
  one("smoke", "Status next на простой строке", "- x", ["status-next"], "- #todo || x"),

  /* R1 — пробел в Value-ссылке */
  one("F3.a", "Priority next не теряет текст рядом с [[Project B]]", "- позвонить в банк || 📅2026-09-30 [[Project B]]",
    ["priority-next"], "- #low || позвонить в банк || 📅2026-09-30 [[Project B]]", { at: { file: "t.md", line: 0, ch: 5 } }),
  one("F3.b", "Status next не удваивает [[Project B]]", "- позвонить в банк || 📅2026-09-30 [[Project B]]",
    ["status-next"], "- #todo || позвонить в банк || 📅2026-09-30 [[Project B]]", { at: { file: "t.md", line: 0, ch: 5 } }),
  one("F3.c", "tagWheel Right + Enter без нажатий не теряет Project B", "- позвонить в банк || [[Project B]]",
    ["open-tagwheel-right", { key: "Enter" }], "- позвонить в банк || [[Project B]]"),
  one("F1.a", "Project next на пустой строке встаёт за разделителем", "- x", ["project-next"], "- x || [[Project A]]"),
  one("F1.b", "Status next после Project не удваивает ссылку", "- x", ["project-next", "status-next"], "- #todo || x || [[Project A]]"),
  one("F1.c", "Project next дважды листает", "- x", ["project-next", "project-next"], "- x || [[Project B]]"),
  { id: "F4", title: "Полоса tagWheel Right без хвоста ` B]]`", files: { "t.md": "- #todo || позвонить в банк || 📅2026-09-30 [[Project B]]\n" },
    at: { file: "t.md", line: 0 }, steps: ["open-tagwheel-right"],
    /* На экране, а не в документе: полоса пишется различием и прячет прежнее (У-259). */
    check: "const l = a.workspace.activeEditor.editor.cm.contentDOM.querySelector('.cm-line').textContent; return !/B\\]\\]/.test(l) && (l.match(/Project B/g) || []).length === 1 || l;" },
  { id: "S16", title: "Show в другом блоке не дублирует значения своего блока", files: { "t.md": "- #todo || позвонить || 📅2026-09-30\n" },
    at: { file: "t.md", line: 0 }, steps: ["open-tagwheel-left"], cfg: { visual: { tagWheel: { oppositeBlock: "keep" } } },
    check: "const l = a.workspace.activeEditor.editor.cm.contentDOM.querySelector('.cm-line').textContent; return (l.match(/todo/g) || []).length <= 1 && /2026-09-30/.test(l) || l;" },
  one("K4", "Smart Enter Text only на `текст || правый блок`", "- позвонить || 📅2026-09-30",
    [{ key: "Enter" }], "- позвонить || 📅2026-09-30\n- ", { at: { file: "t.md", line: 0, ch: 5 },
      cfg: { editor: { smartEnter: { enabled: true, scope: "text" } } } }),
  one("K5", "Smart Enter Text only: каретка в пробеле перед `||`", "- позвонить || 📅2026-09-30",
    [{ key: "Enter" }], "- позвонить || 📅2026-09-30\n- ", { at: { file: "t.md", line: 0, ch: 11 },
      cfg: { editor: { smartEnter: { enabled: true, scope: "text" } } } }),

  /* R7 — сессия tagWheel и заметка */
  { id: "F5", title: "Смена заметки при открытой панели не пишет в чужую", files: { "A.md": "- текст заметки А\n", "B.md": "- важный текст Б\n- вторая Б\n" },
    at: { file: "A.md", line: 0 }, steps: ["open-tagwheel-left", { open: "B.md" }, { cursor: { line: 1, ch: 3 } }, { key: "ArrowUp" }, { key: "Enter" }],
    /* Сессия закрылась уходом с А, поэтому Enter в Б — обычный Enter Obsidian. */
    settle: 3000, expectDisk: { "A.md": "- текст заметки А\n", "B.md": "- в\n- ажный текст Б\n- вторая Б\n" } },
  { id: "F5.b", title: "Закрытие вкладки при открытой панели возвращает строку на диске", files: { "C.md": "- x\n" },
    at: { file: "C.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowUp" }, { js: "a.workspace.activeLeaf.detach();" }],
    settle: 3000, expectDisk: { "C.md": "- x\n" },
    check: "return !window.__tagWheelState || !window.__tagWheelState.active || 'панель активна без редактора';" },
  { id: "F7.a", title: "Печать при открытой панели закрывает её как Enter и ставит знак", files: { "t.md": "- x\n" },
    at: { file: "t.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowUp" }, { type: "abc" }],
    check: "const l = a.workspace.activeEditor.editor.getLine(0); return (!window.__tagWheelState || !window.__tagWheelState.active) && !/==|\\*\\*/.test(l) && /abc/.test(l) || l;" },
  { id: "F7.b", title: "Щелчок по другой строке закрывает панель как Enter", files: { "t.md": "- x\n- соседняя\n" },
    at: { file: "t.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowUp" }, { click: "соседняя" }],
    check: "const e = a.workspace.activeEditor.editor; return (!window.__tagWheelState || !window.__tagWheelState.active) && !/==|\\*\\*/.test(e.getLine(0)) || e.getValue();" },

  /* R5 — начало строки человека */
  one("N1.a", "Move right не стирает чекбокс", "- [ ] b", ["move-right"], "\t- [ ] b", { files: { "t.md": "- a\n- [ ] b\n" }, at: { file: "t.md", line: 1 }, expect: { "t.md": "- a\n\t- [ ] b\n" } }),
  /* Его ответ `В-255` (2026-10-01): «снимать, как сейчас» — один шаг, один Prefix, чекбокс уходит с ним. */
  one("N1.b", "Move left на задаче у левого края снимает Prefix вместе с чекбоксом (В-255)", "- [x] сделано", ["move-left"], "сделано"),
  one("F15.a", "Clear line не снимает чекбокс, когда текст остался", "- [ ] #todo || купить", ["status-previous"], "- [ ] купить",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),
  one("F15.b", "Clear line не снимает номер, когда текст остался", "1. #todo || пункт", ["status-previous"], "1. пункт",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),
  one("F15.c", "Clear line чистит опустевшую строку", "- [ ] #todo", ["status-previous"], "",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),

  /* R4 — код и таблица */
  one("F8.a", "Status next не пишет внутрь блока кода", "```", ["status-next"], "```\n- код\n```",
    { files: { "t.md": "```\n- код\n```\n" }, at: { file: "t.md", line: 1 }, expect: { "t.md": "```\n- код\n```\n" } }),
  /* Таблица — с рядом-разделителем: одиночный ряд Obsidian рисует текстом (Q1). */
  /* Ячейки — как их выравнивает редактор таблиц Obsidian, иначе он правит их сам. */
  one("F8.b", "Status next не пишет в таблицу", "| a   | b   |\n| --- | --- |\n| 1   | 2   |", ["status-next"], "| a   | b   |\n| --- | --- |\n| 1   | 2   |", { at: { file: "t.md", line: 2, ch: 3 } }),
  one("N8", "Move down не заезжает в блок кода", "- a", ["move-line-down"], "",
    { files: { "t.md": "- a\n```js\nlet x=1;\n```\n- b\n" }, expect: { "t.md": "```js\nlet x=1;\n```\n- a\n- b\n" } }),

  one("N8.up", "Move up не заезжает в блок кода снизу", "- b", ["move-line-up"], "",
    { files: { "t.md": "- a\n```js\nlet x=1;\n```\n- b\n" }, at: { file: "t.md", line: 4 }, expect: { "t.md": "- a\n- b\n```js\nlet x=1;\n```\n" } }),
  one("T20", "Transform не превращает ограду кода в заметку", "```js", ["transform-inline-to-note"], "",
    { files: { "t.md": "```js\nlet x=1;\n```\n" }, expect: { "t.md": "```js\nlet x=1;\n```\n" }, settle: 1200,
      cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true } } },
      check: "return !a.vault.getFiles().some((f) => f.name.startsWith('```')) || a.vault.getFiles().map((f) => f.path).join(', ');" }),

  { id: "F16", title: "Value-ссылка идёт за переименованной заметкой (В-238)", files: { "Project A.md": "заметка\n", "t-F16.md": "- x || [[Project A]]\n" },
    at: { file: "t-F16.md", line: 0 },
    /* Без await: переименование доводит Obsidian сам, стенд только ждёт. */
    steps: [{ js: "a.vault.setConfig('alwaysUpdateLinks', true); a.fileManager.renameFile(a.vault.getAbstractFileByPath('Project A.md'), 'Project Alpha.md');", wait: 2500 }, "project-next"],
    check: "const vals = plugin.getConfig().pkm.fields.links.fields.find((f) => f.id === 'Project').values.map((v) => v.token); const l = a.workspace.activeEditor.editor.getLine(0); return (vals.includes('Project Alpha') && !vals.includes('Project A') && (l.match(/\\[\\[/g) || []).length === 1) || JSON.stringify({ vals, l });" },

  /* F17, F9, F10, F11 */
  /* Его ответ `В-246` (2026-09-28): «как принято» — `В-163`, разделитель в тексте строки без значений снимается. */
  one("F17.a", "`||` в тексте строки без значений — как принято (В-246)", "- if (x || y) return", ["status-next"], "- #todo || if (x y) return"),
  /* `В-243` спрошен заново 2026-09-28: «узнавать обе, писать как сейчас» — без пробела. */
  one("F9", "Дата с пробелом узнаётся", "- [ ] задача 📅 2026-09-30", ["due-next"], "- [ ] задача || 📅2026-10-01"),
  /* Разобрано в цикле 99, не дефект: текущее — последнее Value строки, после последнего — пусто. */
  one("F10", "Status next на двух значениях одного Field — после последнего пусто", "- #todo #done || x", ["status-next"], "- x"),
  one("F11", "Пустая строка без хвостового пробела", "- ", ["status-next"], "- #todo || "),

  /* R6, F2 — ссылка и тег посреди текста — слово человека (В-235) */
  one("F2.a", "Ссылка посреди текста остаётся на месте", "- встреча по [[Project A]] вчера", ["project-next"], "- встреча по [[Project A]] вчера || [[Project A]]"),
  one("F2.b", "Тег посреди текста остаётся на месте", "- купить #todo молоко", ["status-next"], "- #todo || купить #todo молоко"),

  /* K2 — Smart Delete сливает поля (В-242) */
  one("K2", "Smart Delete сливает поля второй строки в блоки первой", "- #todo || a", [{ key: "Delete" }], "- #todo #low || a b",
    { files: { "t.md": "- #todo || a\n- #low || b\n" }, expect: { "t.md": "- #todo #low || a b\n" }, cfg: { editor: { smartDelete: { enabled: true } } } }),
  one("K15", "Smart Delete при нескольких курсорах", "- a", [{ js: "ed.setSelections([{anchor:{line:0,ch:3}},{anchor:{line:2,ch:3}}]);" }, { key: "Delete" }], "",
    { files: { "t.md": "- a\n- b\n- c\n- d\n" }, expect: { "t.md": "- a b\n- c d\n" }, cfg: { editor: { smartDelete: { enabled: true } } } }),

  /* N2, N11, N3 */
  one("N2", "Move right отступает табом", "- b", ["move-right"], "", { files: { "t.md": "- a\n- b\n\t- b1\n" }, at: { file: "t.md", line: 1 }, expect: { "t.md": "- a\n\t- b\n\t- b1\n" } }),
  one("N11", "Move right не делает из абзаца блок кода (цикл выключен)", "para", ["move-right"], "para",
    { cfg: { navigation: { moveSelection: { prefixCyclerEnabled: false } } } }),
  one("N3", "Смена префикса не уводит каретку", "- alpha beta gamma", ["move-left", { js: "" }], "", { at: { file: "t.md", line: 0, ch: 8 },
    expect: {}, check: "const e = a.workspace.activeEditor.editor; return e.getCursor().ch === e.getLine(0).indexOf('beta') || JSON.stringify([e.getLine(0), e.getCursor()]);" }),

  /* T — Transform: `Inline to note` включён (в чистом vault он выключен). */
  tr("T6", "Скобки ссылки не попадают в имя файла", "- #todo || встреча с [[Другое]] сегодня", [1],
    "встреча с Другое сегодня.md"),
  /* `В-235`: Value посреди текста — слово человека, и из имени оно не выпадает. */
  tr("T5", "Value-ссылка посреди текста остаётся в имени заметки", "- встреча по [[Project A]] и [[Другое]] вчера", [1],
    "встреча по Project A и Другое вчера.md"),
  tr("T24", "Повторный Transform дописывает в ту же заметку, скобки не вкладываются", "- #todo || повтор", [1, 2],
    "повтор.md", "!a.vault.getFiles().some((f) => /\\[\\[|-01/.test(f.name)) && !/\\[\\[\\[\\[/.test(line)"),
  /* Его ответ `В-243`: дата с пробелом после знака — значение, а не часть имени заметки.
     Разбор Transform узнаёт её сам: сборка без шва `joinSpacedElementValues` тоже зелёная
     (2026-09-28), поэтому шва на этой дороге нет — случай сторожит, что так и останется. */
  tr("F9.t", "Inline to note: дата с пробелом не входит в имя заметки", "- встреча 📅 2026-09-30", [1], "встреча.md",
    "(async () => true)() && !a.vault.getFiles().some((f) => /2026/.test(f.name)) && !/2026-09-30/.test(a.workspace.activeEditor.editor.getValue().split('[[')[0])"),
  tr("T1", "# в имени заметки не делает ссылку заголовком", "- задача про C# язык", [1], "задача про C язык.md"),
  tr("T8", "[текст](url) — текст в имени", "- читать [статью](https://x.y) завтра", [1], "читать статью завтра.md"),
  tr("T3", "Transform сохраняет чекбокс человека (В-239)", "- [ ] простая задача", [1],
    "простая задача.md", "line.startsWith('- [ ] ')"),
  tr("T3.x", "Transform сохраняет отметку «сделано»", "- [x] сделано давно", [1],
    "сделано давно.md", "line.startsWith('- [x] ')"),
  tr("T13", "Повтор после отмены дописывает, а не заводит -01", "- после отмены", [1, "undo", 1],
    "после отмены.md", "!a.vault.getFiles().some((f) => f.name.includes('после отмены') && f.name !== 'после отмены.md')"),

  /* Эталоны заметки тестов цикла 97 — на копии его vault, его настройки
     (`node tools/obsidian_bench.js mine`). Ожидаемое здесь — то, что стоит в 🎯А. */
  { mine: true, id: "M1", title: "Move right: чекбокс остаётся", files: { "m1.md": "- [ ] задача\n" },
    at: { file: "m1.md", line: 0 }, steps: ["move-right"], expect: { "m1.md": "\t- [ ] задача\n" } },
  /* Его ответ 2026-09-27: на верхнем уровне задача идёт по списку Prefix, чекбокс снимается;
     у него за `- ` в списке стоит «без знака». */
  { mine: true, id: "M2", title: "Move left: задача на верхнем уровне идёт по списку Prefix", files: { "m2.md": "- [x] сделано\n" },
    at: { file: "m2.md", line: 0 }, steps: ["move-left"], expect: { "m2.md": "сделано\n" },
    /* Обе стороны настройки (правило 162): тест 1 цикла 98 просит его выключить. */
    cfg: { navigation: { moveSelection: { prefixCyclerEnabled: true } } } },
  { mine: true, id: "M2.off", title: "Move left без Cycle line Prefixes: задача наверху не меняется", files: { "m2.md": "- [x] сделано\n" },
    at: { file: "m2.md", line: 0 }, steps: ["move-left"], expect: { "m2.md": "- [x] сделано\n" },
    cfg: { navigation: { moveSelection: { prefixCyclerEnabled: false } } } },
  /* Его замечание 2026-09-27: строка Emoji окна Add Field видна у всех типов.
     Спрашивается каскад настоящего Obsidian: `app.css` + наш лист. */
  { mine: true, id: "M9", title: "Add Field: строка Emoji видна только у Element", files: {},
    check: "const s =document.body.createDiv({ cls: 'io-item' }); s.hidden = true; const d = getComputedStyle(s).display; s.remove(); return d === 'none' || 'скрытая строка io-item: display ' + d;" },
  /* Его замечание 2026-09-27: `\t\t- [ ] задача` + Move left давало `[ ] задача`. */
  { mine: true, id: "M8", title: "Move left: вложенная задача теряет один шаг отступа", files: { "m8.md": "- к строке ниже\n\t- исходная строка\n\t\t- [ ] задача\n" },
    at: { file: "m8.md", line: 2 }, steps: ["move-left", "move-left"], expect: { "m8.md": "- к строке ниже\n\t- исходная строка\n- [ ] задача\n" } },
  /* Его ответ `В-243` (2026-09-28): дата с пробелом после знака узнаётся, пишется как сейчас. */
  { mine: true, id: "M10", title: "Дата с пробелом после знака — та же дата: Due next шагает её", files: { "m10.md": "- задача 📅 26-09-30\n" },
    at: { file: "m10.md", line: 0 }, steps: ["due-next"], expect: { "m10.md": "- задача :: 📅26-10-01\n" } },
  { mine: true, id: "M10.u", title: "Дата с пробелом: Ctrl+Z после Due next возвращает строку", files: { "m10u.md": "- задача 📅 26-09-30\n" },
    at: { file: "m10u.md", line: 0 }, steps: ["due-next", { key: "Control+z" }], expect: { "m10u.md": "- задача 📅 26-09-30\n" } },
  { mine: true, id: "M11", title: "Дата с пробелом остаётся значением при команде другого Field", files: { "m11.md": "- задача 📅 26-09-30\n" },
    at: { file: "m11.md", line: 0 }, steps: ["type-next"], expect: { "m11.md": "- #todo :: задача :: 📅26-09-30\n" } },
  { mine: true, id: "M12", title: "Знак со словом через пробел — не дата, текст не трогается", files: { "m12.md": "- задача 📅 встреча\n" },
    at: { file: "m12.md", line: 0 }, steps: ["type-next"], expect: { "m12.md": "- #todo :: задача 📅 встреча\n" } },
  /* Его замечание к тесту 3 цикла 98: `Use as MOC: No` — заметки этого Link без ссылок. */
  { mine: true, id: "M13", title: "Use as MOC: No — Inline to note не пишет ссылку в заметку People", files: { "m13.md": "- [[Man1]] :: звонок\n", "Man1.md": "", "111/template.md": "" },
    cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, backlink: { enabled: true } } }, pkm: { fields: { order: { useAsMoc: { People: false } } } } },
    at: { file: "m13.md", line: 0 }, steps: [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 2000 }],
    /* Контроль «Transform сработал» (У-152): строка обязана смениться. */
    check: "const man = await a.vault.adapter.read('Man1.md'); const line = a.workspace.activeEditor.editor.getLine(0); return (man === '' && line !== '- [[Man1]] :: звонок') || JSON.stringify({ man, line });" },
  { mine: true, id: "M13.on", title: "Use as MOC: Yes — ссылка в заметку People пишется", files: { "m13on.md": "- [[Man1]] :: звонок\n", "Man1.md": "", "111/template.md": "" },
    cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, backlink: { enabled: true } } }, pkm: { fields: { order: { useAsMoc: { People: true } } } } },
    at: { file: "m13on.md", line: 0 }, steps: [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 2000 }],
    check: "const man = await a.vault.adapter.read('Man1.md'); return /\\[\\[/.test(man) || JSON.stringify({ man, line: a.workspace.activeEditor.editor.getLine(0) });" },
  /* Его заказ 2026-09-28: `Add empty line before wikilink` — Off пишет ссылку без пустой строки. */
  { mine: true, id: "M14", title: "Add empty line before wikilink: Off — ссылка встаёт вплотную", files: { "m14.md": "- [[Man1]] :: звонок\n", "Man1.md": "- [[123]]\n", "111/template.md": "" },
    cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, backlink: { enabled: true, emptyLine: false } } }, pkm: { fields: { order: { useAsMoc: { People: true } } } } },
    at: { file: "m14.md", line: 0 }, steps: [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 2000 }],
    check: "const man = await a.vault.adapter.read('Man1.md'); return /^- \\[\\[123\\]\\]\\n- \\[\\[[^\\n]+\\]\\]\\n$/.test(man) || JSON.stringify({ man });" },
  { mine: true, id: "M14.on", title: "Add empty line before wikilink: On — пустая строка, как было", files: { "m14on.md": "- [[Man1]] :: звонок\n", "Man1.md": "- [[123]]\n", "111/template.md": "" },
    cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, backlink: { enabled: true, emptyLine: true } } }, pkm: { fields: { order: { useAsMoc: { People: true } } } } },
    at: { file: "m14on.md", line: 0 }, steps: [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 2000 }],
    check: "const man = await a.vault.adapter.read('Man1.md'); return /^- \\[\\[123\\]\\]\\n\\n- \\[\\[[^\\n]+\\]\\]\\n$/.test(man) || JSON.stringify({ man });" },
  /* Тест Smart bracket цикла 100: выделенное слово в квадратных скобках. */
  { mine: true, id: "M15", title: "Smart bracket: выделенное слово — в одинарные скобки", files: { "m15.md": "- слово\n" },
    at: { file: "m15.md", line: 0, sel: "слово" }, steps: ["smart-bracket"], expect: { "m15.md": "- [слово]\n" } },
  /* Чекбокс Value (выбиралка Prefix цикла 101): у тега и — с В-248 — у ссылки, ключ в написании панели. */
  { mine: true, id: "M16", title: "Prefix [x] у Value тега встаёт в строку", files: { "m16.md": "- задача\n" },
    cfg: { pkm: { prefixRules: { checkboxByFieldValue: { Type: { "#todo": "[x]" } } } } },
    at: { file: "m16.md", line: 0 }, steps: ["type-next"], expect: { "m16.md": "- [x] #todo :: задача\n" } },
  { mine: true, id: "M16.link", title: "В-248: Prefix [x] у Value ссылки встаёт в строку", files: { "m16l.md": "- звонок\n" },
    cfg: { pkm: { prefixRules: { checkboxByFieldValue: { People: { "[[Man1]]": "[x]" } } } } },
    at: { file: "m16l.md", line: 0 }, steps: ["people-next"], expect: { "m16l.md": "- [x] [[Man1]] :: звонок\n" } },
  /* Тесты 1–3 цикла 103, `В-235`: Value посреди текста — слово человека. Тумблер `Keep typed tags in text`
     закреплён включённым: у него он бывает выключен, и случаи мерили бы
     сегодняшнее положение, а не правило (правило 162). */
  { mine: true, id: "M17", title: "Тег посреди фразы остаётся на месте", files: { "m17.md": "- купить #todo молоко\n" },
    cfg: STAY_ON,
    at: { file: "m17.md", line: 0 }, steps: ["type-next"], expect: { "m17.md": "- #todo :: купить #todo молоко\n" } },
  { mine: true, id: "M18", title: "Ссылка посреди фразы остаётся на месте", files: { "m18.md": "- встреча по [[Man1]] вчера\n" },
    cfg: STAY_ON,
    at: { file: "m18.md", line: 0 }, steps: ["people-next"], expect: { "m18.md": "- [[Man1]] :: встреча по [[Man1]] вчера\n" } },
  { mine: true, id: "M19", title: "Панель не стирает тег из фразы", files: { "m19.md": "- купить #todo молоко\n" },
    cfg: STAY_ON,
    at: { file: "m19.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowRight" }, { key: "ArrowRight" }, { key: "ArrowRight" }, { key: "ArrowUp" }, { key: "Enter" }],
    expect: { "m19.md": "- [[Man1]] :: купить #todo молоко\n" } },
  /* Тест 4 цикла 103, его ответ `В-249`: и в конце строки тег — его слово. */
  { mine: true, id: "M20", title: "Тег в конце строки — тоже слово человека", files: { "m20.md": "- купить молоко #todo\n" },
    cfg: STAY_ON,
    at: { file: "m20.md", line: 0 }, steps: ["type-next"], expect: { "m20.md": "- #todo :: купить молоко #todo\n" } },
  /* Тест 5 цикла 103: `Keep typed tags in text` выключен — Value из фразы переезжает в Block. */
  { mine: true, id: "M21", title: "Keep typed tags in text: Off — тег из фразы переезжает в Block", files: { "m21.md": "- купить #todo молоко\n" },
    cfg: { pkm: { placement: { typedTagsStayText: false } } },
    at: { file: "m21.md", line: 0 }, steps: ["importance-next"], expect: { "m21.md": "- #high #todo :: купить молоко\n" } },
  /*
   * `В-247`: Element-список на его конфиге. Поле заводится шагом `js` — его
   * порядок берётся из его же `order` (правило 102), литералом только новое
   * поле. Сперва сессия с тегом на месте: круг идёт рядом с его значением.
   */
  { mine: true, id: "M22", title: "Element-список: команда шагает Values со своим знаком", files: { "m22.md": "- купить\n" },
    steps: [{ js: "const o = plugin.getConfig().pkm.fields.order; plugin.setConfigPatch({ pkm: { fields: { order: { left: o.left.filter(k => k !== 'Mood').concat(['Mood']), types: { Mood: 'element' }, active: { Mood: 'yes' } }, elements: { byField: { Mood: { emoji: '', format: '', increment: { mode: 'list' }, list: ['\u{1F642}‍↕️да', '\u{1F4A1}'] } } } } } }, 'bench'); plugin.registerPkmCommands();", wait: 400 },
      { open: "m22.md" }, { cursor: { line: 0, ch: 8 } }, "type-next", "mood-next", "mood-next"],
    expect: { "m22.md": "- #todo \u{1F4A1} :: купить\n" } },
  { mine: true, id: "M3", title: "Move down: пустая строка — одна остановка", files: { "m3.md": "- раз\n- два\n\n- три\n" },
    at: { file: "m3.md", line: 1 }, steps: ["move-line-down"], expect: { "m3.md": "- раз\n\n- два\n- три\n" } },
  { mine: true, id: "M4", title: "Delete в конце строки сливает поля двух строк", files: { "m4.md": "- #test1 :: первая\n- [[Man1]] :: вторая\n- третья\n" },
    at: { file: "m4.md", line: 0 }, steps: [{ key: "Delete" }], expect: { "m4.md": "- #test1 [[Man1]] :: первая вторая\n- третья\n" } },
  { mine: true, id: "M5", title: "Печать при открытой панели закрывает её", files: { "m5.md": "- строка для печати\n" },
    at: { file: "m5.md", line: 0 }, steps: ["open-tagwheel-left", { type: "!" }],
    expect: { "m5.md": "- строка для печати!\n" }, check: "return !window.__tagWheelState || !window.__tagWheelState.active || 'панель открыта';" },
  { mine: true, id: "M6", title: "Уход в другую заметку при открытой панели не меняет строку", files: { "m6.md": "- строка для ухода\n" },
    at: { file: "m6.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowDown" }, { open: "Man1.md" }, { open: "m6.md" }],
    settle: 1500, expect: { "m6.md": "- строка для ухода\n" } },
  { mine: true, id: "M7", title: "Value идёт за переименованной заметкой", files: { "m7.md": "- [[Man1]] :: звонок\n" },
    at: { file: "m7.md", line: 0 },
    steps: [{ js: "a.fileManager.renameFile(a.vault.getAbstractFileByPath('Child1.md'), 'Child2.md');", wait: 2500 }, { open: "m7.md" }, { cursor: { line: 0, ch: 20 } }, "people-sub-next"],
    expect: { "m7.md": "- [[Man1]] [[Child2]] :: звонок\n" } },

  /* Метка отмеченной строки (`done-marker`, его заказ 2026-09-30): щелчок по
     галочке мышью в Live Preview, каретка — на другой строке. */
  one("DM1", "Галочка ставит ✅ в Right Block", "- [ ] купить хлеб\n- другая",
    [{ clickBox: "купить" }], "- [x] купить хлеб || ✅\n- другая",
    { at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right" } } } }, settle: 800 }),
  one("DM2", "Снятая галочка снимает ✅", "- [x] купить хлеб || ✅\n- другая",
    [{ clickBox: "купить" }], "- [ ] купить хлеб\n- другая",
    { at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right" } } } }, settle: 800 }),
  one("DM3", "Маркер — Value Status: встаёт на место Status", "- [ ] #doing #high || отчёт\n- другая",
    [{ clickBox: "отчёт" }], "- [x] #done #high || отчёт\n- другая",
    { at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "#done", panel: "right" } } } }, settle: 800 }),
  one("DM4", "Left Block и команда Toggle checkbox status", "- [ ] #high || звонок",
    [{ js: "a.commands.executeCommandById('editor:toggle-checklist-status');", wait: 800 }], "- [x] #high #completed || звонок",
    { cfg: { pkm: { behavior: { doneMarker: { token: "#completed", panel: "left" } } } } }),
  one("DM5", "Отмена: первый Ctrl+Z снимает маркер, второй — галочку", "- [ ] купить хлеб\n- другая",
    [{ clickBox: "купить" }, { key: "Control+z", wait: 500 }], "- [x] купить хлеб\n- другая",
    { at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right" } } } }, settle: 800 }),
  one("DM6", "Пустой маркер — галочка ничего не дописывает", "- [ ] купить хлеб\n- другая",
    [{ clickBox: "купить" }], "- [x] купить хлеб\n- другая", { at: { file: "t.md", line: 1 }, settle: 800 }),
  /* Те же на его настройках: разделители `::`, `#todo` — Value его `Type`,
     `💡` — Value `Tech` в custom block (места у такого Field нет — идёт Block). */
  one("MDM1", "Его конфиг: ✅ в Right Block", "- [ ] купить хлеб\n- другая",
    [{ clickBox: "купить" }], "- [x] купить хлеб :: ✅\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right" } } } }, settle: 800 }),
  one("MDM2", "Его конфиг: #todo встаёт на место Type", "- [ ] #idea #high :: отчёт\n- другая",
    [{ clickBox: "отчёт" }], "- [x] #high #todo :: отчёт\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "#todo", panel: "right" } } } }, settle: 800 }),
  one("MDM3", "Его конфиг: 💡 из custom block идёт в Left Block", "- [ ] #high :: купить\n- другая",
    [{ clickBox: "купить" }], "- [x] #high 💡 :: купить\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "💡", panel: "left" } } } }, settle: 800 }),
  /* Эталон карточки теста цикла 108: строка Б → щелчок → А; и шаг 3 с `#todo`. */
  one("MDM4", "Карточка 108: ✅ за вторым разделителем", "- [ ] #high :: позвонить в банк\n- другая",
    [{ clickBox: "позвонить" }], "- [x] #high :: позвонить в банк :: ✅\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right" } } } }, settle: 800 }),
  one("MDM5", "Карточка 108, шаг 3: #todo на место Type и обратно", "- [ ] #high :: позвонить в банк\n- другая",
    [{ clickBox: "позвонить" }, { clickBox: "позвонить" }], "- [ ] #high :: позвонить в банк\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "#todo", panel: "right" } } } }, settle: 800,
      check: "return true;" }),
  one("MDM6", "Карточка 108, шаг 3: #todo встаёт за #high", "- [ ] #high :: позвонить в банк\n- другая",
    [{ clickBox: "позвонить" }], "- [x] #high #todo :: позвонить в банк\n- другая",
    { mine: true, at: { file: "t.md", line: 1 }, cfg: { pkm: { behavior: { doneMarker: { token: "#todo", panel: "right" } } } }, settle: 800 }),
  { id: "DM7", title: "Dim ticked line гасит строку с маркером", files: { "t-DM7.md": "- [x] купить хлеб || ✅\n- другая\n" },
    at: { file: "t-DM7.md", line: 1 }, steps: [], settle: 600,
    cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right", visual: { enabled: true, opacity: 40 } } } } },
    check: "const rows = [...a.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll('.cm-line')]; const r = rows.find((l) => l.textContent.includes('купить')); const o = rows.find((l) => l.textContent.includes('другая')); return (r && r.classList.contains('io-ticked-line') && getComputedStyle(r).opacity === '0.4' && !o.classList.contains('io-ticked-line')) || (r ? r.className + ' ' + getComputedStyle(r).opacity : 'нет строки');" },
  /* BUGHUNT 2026-09-30, корень Q1: «это не строка текста» — frontmatter,
     горизонтальная линия, строка `|| …`, которую плагин пишет сам. */
  one("A1.a", "Status next в frontmatter ничего не пишет", "---\ntitle: a\n---\nbody",
    ["status-next"], "---\ntitle: a\n---\nbody", { at: { file: "t.md", line: 1, ch: 3, source: true } }),
  one("A1.b", "Due next на закрывающей черте frontmatter ничего не пишет", "---\ntitle: a\n---\nbody",
    ["due-next"], "---\ntitle: a\n---\nbody", { at: { file: "t.md", line: 2, ch: 3, source: true } }),
  one("A20", "Status next на горизонтальной линии ничего не пишет", "text\n\n---\n\nmore",
    ["status-next"], "text\n\n---\n\nmore", { at: { file: "t.md", line: 2, ch: 3 } }),
  one("A3", "Строка `|| …`, написанная плагином, отвечает командам", "",
    ["due-next", "status-next"], "", { expect: {}, check: "const l = a.workspace.activeEditor.editor.getLine(0); return (/#todo/.test(l) && /📅/.test(l)) || l;" }),
  /* Ожидание — родной Backspace: он склеивает строку с чертой сам, без плагина;
     дефект был в нашем — пробел между ними и снятый `# ` (B11). */
  one("B11", "Smart Backspace под frontmatter — родная клавиша", "---\nk: v\n---\n# para",
    [{ key: "Backspace" }], "---\nk: v\n---# para", { at: { file: "t.md", line: 3, ch: 0, source: true }, cfg: { editor: { smartDelete: { onBackspace: true } } } }),
  one("B12.a", "Smart Delete внутри кода — родная клавиша", "```yaml\nkey:\n  - item\n```",
    [{ key: "Delete" }], "```yaml\nkey:  - item\n```", { at: { file: "t.md", line: 1, ch: 4 }, cfg: { editor: { smartDelete: { enabled: true } } } }),
  one("B12.b", "Smart Backspace под оградой кода не склеивает с ней", "```\ncode\n```\n- a",
    [{ key: "Backspace" }], "", { at: { file: "t.md", line: 3, ch: 2 }, expect: {}, cfg: { editor: { smartDelete: { onBackspace: true } } },
      check: "const e = a.workspace.activeEditor.editor; return e.getLine(2) === '```' || JSON.stringify(e.getValue());" }),
  /* Q1 в навигации: `# …` в коде — не заголовок, код и таблица — не строки текста. */
  one("B6", "Jump down не останавливается на `# …` внутри кода", "# H1\ntext\n```\n# c\n```\n# H2",
    ["jump-next"], "", { at: { file: "t.md", line: 0, ch: 4 }, expect: {},
      check: "const l = a.workspace.activeEditor.editor.getCursor().line; return l === 4 || l === 5 || 'каретка на строке ' + l;" }),
  one("B7", "Whole section не рвёт блок кода с `# comment`", "# A\n- a\n# B\n```bash\n# comment\necho 1\n```",
    ["move-line-up"], "# B\n```bash\n# comment\necho 1\n```\n# A\n- a",
    { at: { file: "t.md", line: 2, ch: 3 }, cfg: { navigation: { moveLine: { headerMode: "move-with-section" } } } }),
  one("B4.a", "Move right в коде не ставит Prefix", "```\ncode\n```", ["move-right"], "```\ncode\n```",
    { at: { file: "t.md", line: 1, ch: 4 }, cfg: { navigation: { moveSelection: { prefixCyclerEnabled: true } } } }),
  /* Ячейки выравнивает редактор таблиц Obsidian сам — спрашивается только Prefix. */
  one("B4.b", "Move right в таблице не ставит Prefix", "| p | q |\n|---|---|\n| 1 | 2 |", ["move-right"], "",
    { at: { file: "t.md", line: 2, ch: 3 }, expect: {}, cfg: { navigation: { moveSelection: { prefixCyclerEnabled: true } } },
      check: "const l = a.workspace.activeEditor.editor.getLine(2); return /^\\|/.test(l) || l;" }),
  one("B7.ctl", "Whole section в конце файла без кода — контроль к B7", "# A\n- a\n# B\ntext",
    ["move-line-up"], "# B\ntext\n# A\n- a",
    { at: { file: "t.md", line: 2, ch: 3 }, cfg: { navigation: { moveLine: { headerMode: "move-with-section" } } } }),
  one("B1", "Move down перескакивает таблицу целиком", "- a\n| p | q |\n|---|---|\n| 1 | 2 |\n- z",
    ["move-line-down"], "| p | q |\n|---|---|\n| 1 | 2 |\n- a\n- z", { at: { file: "t.md", line: 0, ch: 3 } }),
  /* B2: ребёнок через родителя вверх — последним ребёнком соседа (`В-241`). */
  one("B2", "Дочерняя строка через родителя вверх встаёт последним ребёнком", "- a\n\t- a1\n\t- a2\n- b\n\t- b1",
    ["move-line-up"], "- a\n\t- a1\n\t- a2\n\t- b1\n- b", { at: { file: "t.md", line: 4, ch: 4 } }),
  /* B5: отступ той же природы — пробелы к пробелам. */
  one("B5", "Move right у списка с отступом пробелами добавляет пробелы", "- a\n    - c",
    ["move-right"], "- a\n        - c", { at: { file: "t.md", line: 1, ch: 7 } }),
  /* B3, `В-257`: `Indent the whole tree` — дерево строки идёт с ней; выключен — как было. */
  one("B3.r", "Indent the whole tree: Move right двигает и детей", "- a\n- b\n\t- b1\n- c",
    ["move-right"], "- a\n\t- b\n\t\t- b1\n- c", { at: { file: "t.md", line: 1, ch: 3 }, cfg: { navigation: { moveSelection: { indentWithChildren: true } } } }),
  one("B3.l", "Indent the whole tree: Move left снимает шаг и у детей", "- a\n\t- b\n\t\t- b1\n- c",
    ["move-left"], "- a\n- b\n\t- b1\n- c", { at: { file: "t.md", line: 1, ch: 4 }, cfg: { navigation: { moveSelection: { indentWithChildren: true } } } }),
  one("B3.u", "Indent the whole tree: одна отмена возвращает всё дерево", "- a\n- b\n\t- b1\n- c",
    ["move-right", { js: "ed.undo();", wait: 400 }], "- a\n- b\n\t- b1\n- c", { at: { file: "t.md", line: 1, ch: 3 }, cfg: { navigation: { moveSelection: { indentWithChildren: true } } } }),
  one("B3.off", "Indent the whole tree выключен: отступ у одной строки, как было", "- a\n- b\n\t- b1\n- c",
    ["move-right"], "- a\n\t- b\n\t- b1\n- c", { at: { file: "t.md", line: 1, ch: 3 }, cfg: { navigation: { moveSelection: { indentWithChildren: false } } } }),
  /* B8, `В-256`: `Highlight after moving` — цветом, без выделения: набранная
     буква перенесённого не стирает, а подсветка после неё гаснет. */
  one("B8", "Highlight after moving красит строки и не выделяет их", "- a\n- b\n\t- b1\n- c",
    ["move-line-up", { wait: 300 }, { js: "const rows = [...ed.cm.contentDOM.querySelectorAll('.cm-line.io-moved-line')]; window.__b8 = { sel: ed.somethingSelected(), rows: rows.map((r) => r.textContent), bg: rows[0] ? getComputedStyle(rows[0]).backgroundColor : '' };" }, { type: "x" }],
    "- bx\n\t- b1\n- a\n- c",
    { at: { file: "t.md", line: 1, ch: 3 }, cfg: { navigation: { moveLine: { highlightMovedLines: true, noSelectionMode: "with-children" } } },
      check: "const w = window.__b8 || {}; const left = a.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll('.cm-line.io-moved-line').length; return (w.sel === false && JSON.stringify(w.rows) === JSON.stringify(['- b', '\\t- b1']) && !!w.bg && w.bg !== 'rgba(0, 0, 0, 0)' && left === 0) || JSON.stringify({ w, left });" }),
  /* B8.c, его 💬 к тесту 3 цикла 111: подсветку снимает любое действие, и
     движение курсора внутри перенесённых строк тоже. */
  one("B8.c", "Highlight after moving гаснет от движения курсора внутри перенесённых строк", "- a\n- b\n\t- b1\n- c",
    ["move-line-up", { wait: 300 }, { js: "window.__b8c = ed.cm.contentDOM.querySelectorAll('.cm-line.io-moved-line').length;" }, { key: "ArrowLeft" }, { wait: 200 }],
    "- b\n\t- b1\n- a\n- c",
    { at: { file: "t.md", line: 1, ch: 3 }, cfg: { navigation: { moveLine: { highlightMovedLines: true, noSelectionMode: "with-children" } } },
      check: "const left = a.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll('.cm-line.io-moved-line').length; return (window.__b8c === 2 && left === 0) || JSON.stringify({ before: window.__b8c, left });" }),
  one("B8.j", "Highlight after moving: каждое нажатие перескакивает соседнее дерево", "- A\n\t- a1\n- B\n\t- b1\n- C\n\t- c1",
    ["move-line-up", { wait: 300 }, "move-line-up"], "- C\n\t- c1\n- A\n\t- a1\n- B\n\t- b1",
    { at: { file: "t.md", line: 4, ch: 3 }, cfg: { navigation: { moveLine: { highlightMovedLines: true, noSelectionMode: "with-children", jumpNeighborTrees: true } } } }),
  /* D5, `В-253`: выключенный модуль Visual гасит всё, что рисует вкладка, —
     пузыри, приглушение Block, заливку, каретку; включённый — контроль, что
     на этой строке и этом конфиге всё это и правда нарисовано. */
  ...[["D5.off", false], ["D5.on", true]].map(([id, on]) => one(id, "Модуль Visual " + (on ? "включён — вид есть (контроль)" : "выключен — вида нет"), "- #todo || позвонить", [{ wait: 400 }], "- #todo || позвонить",
    { at: { file: "t.md", line: 0, ch: 12 }, settle: 700,
      cfg: { features: { visual: { enabled: on } }, visual: { tags: { opacityLeft: 50, blockFill: { enabled: true } }, caret: { enabled: true, color: "#ff0000" } } },
      check: "const cm = a.workspace.activeEditor.editor.cm; const row = [...cm.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('позвонить')); const got = { tags: row ? row.querySelectorAll('.io-tagbubble, .io-blockvalue').length : -1, fill: cm.scrollDOM.querySelectorAll('.io-blockfill-marker').length, caret: getComputedStyle(cm.contentDOM).caretColor, caretLayer: [...cm.scrollDOM.querySelectorAll('.io-editor-caret')].map((x) => getComputedStyle(x).borderLeftColor + '|' + getComputedStyle(x).backgroundColor) }; const red = (s) => /255, 0, 0/.test(s); const drawn = got.tags > 0 && got.fill > 0 && (red(got.caret) || got.caretLayer.some(red)); const none = got.tags === 0 && got.fill === 0 && !red(got.caret) && !got.caretLayer.some(red); return (" + (on ? "drawn" : "none") + ") || JSON.stringify(got);" })),
  { id: "D5.tw", title: "Модуль Visual выключен — панель tagWheel в своих цветах", files: { "t-D5tw.md": "- #todo || позвонить\n" },
    at: { file: "t-D5tw.md", line: 0 }, steps: ["open-tagwheel-left", { wait: 600 }], settle: 600,
    cfg: { features: { visual: { enabled: false } }, visual: { tagWheel: { fillColor: "#00ff00" } } },
    check: "const row = a.workspace.activeEditor.editor.cm.contentDOM.querySelector('.cm-line.io-twline'); a.commands.executeCommandById('editor:focus'); if (!row) return 'нет полосы'; const hl = row.querySelector('span.cm-highlight'); const bg = hl ? getComputedStyle(hl).backgroundColor : ''; return /0, 255, 0/.test(bg) || JSON.stringify({ bg });" },
  /* C1: `Keep first words` на строке без Fields не оставляет имя в скобках. */
  one("C1", "Keep first words снимает имя в скобках и не считает его словами", "- [Trip plan] pack bags early morning",
    [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1500 }], "",
    { cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, sourceProcessing: { text: "words", keepWords: 3 } } } }, expect: {}, settle: 800,
      check: "const l = a.workspace.activeEditor.editor.getLine(0); return (/\\[\\[[^\\]]*Trip plan\\]\\] pack bags early/.test(l) && !/\\[Trip plan\\] /.test(l)) || l;" }),
  /* Q4, C4: повторный Transform на обработанной строке ничего не дописывает. */
  one("C4", "Повторный Transform на обработанной строке не дописывает её в заметку", "- repeat me twice",
    [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1500 },
      { js: "ed.setCursor({ line: 0, ch: 3 }); a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1500 }],
    "", { cfg: I2N, expect: {}, settle: 800,
      check: "const f = a.vault.getFiles().find((x) => /^repeat me twice/.test(x.basename)); if (!f) return 'заметки нет'; const t = await a.vault.read(f); return t.split('repeat me twice').length === 2 || JSON.stringify(t);" }),
  /* D6: при выключенных знаках активное поле tagWheel красится своим цветом. */
  { id: "D6", title: "tagWheel без знаков: активное поле цветом Active Field", files: { "t-D6.md": "- #todo || позвонить\n" },
    at: { file: "t-D6.md", line: 0 }, steps: ["open-tagwheel-left"], settle: 600,
    cfg: { visual: { tagWheel: { showMarkers: false, textColor: "#112233", activeTextColor: "#ff0000" } } },
    check: "const w = [...a.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll('.inline-overhaul-tw-token')]; const red = w.filter((n) => getComputedStyle(n).color === 'rgb(255, 0, 0)'); a.commands.executeCommandById('editor:focus'); return (w.length > 0 && red.length === 1) || JSON.stringify(w.map((n) => n.textContent + ':' + getComputedStyle(n).color));" },
  /* Его ответ В-254 (BUGHUNT C2): три записи под `## Log` с уровнем 2 — по порядку,
     заголовками `###`. Шаги — тест 4 цикла 110 на его настройках. */
  { mine: true, id: "MC2", title: "Записи под разделом идут по порядку", files: { "t-MC2.md": "- [Журнал] alpha\n- [Журнал] beta\n- [Журнал] gamma\n",
      /* Его шаблон по умолчанию — копия `test-vault/111/template.md`. */
      "111/template.md": "---\ntype:\ndate_due:\ntags:\ntag:\nproject:\n---\n" },
    at: { file: "t-MC2.md", line: 0, ch: 3 },
    steps: [{ js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1800 }, { open: "t-MC2.md" }, { cursor: { line: 1, ch: 3 } },
      { js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1800 }, { open: "t-MC2.md" }, { cursor: { line: 2, ch: 3 } },
      { js: "a.commands.executeCommandById('inline-overhaul:transform-inline-to-note');", wait: 1800 }, { open: "t-MC2.md" }],
    settle: 600,
    cfg: { features: { transform: { enabled: true } }, transform: { inline2note: { enabled: true, nameCollision: { mode: "add_to_note" }, placement: { position: "custom-header", targetHeader: "## Log", headerLevel: "2" } } } },
    check: "const f = a.vault.getMarkdownFiles().find((x) => x.basename === 'Журнал'); const body = f ? await a.vault.read(f) : ''; const src = await a.vault.read(a.vault.getAbstractFileByPath('t-MC2.md')); const order = body.split('\\n').filter((l) => /alpha|beta|gamma/.test(l)).map((l) => (l.match(/alpha|beta|gamma/) || [''])[0]); const heads = body.split('\\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.split(' ')[0]); return (order.join() === 'alpha,beta,gamma' && heads.join() === '##,###,###,###') || JSON.stringify({ notes: [...document.querySelectorAll('.notice')].map((n) => n.textContent), modal: [...document.querySelectorAll('.modal')].map((n) => n.textContent.slice(0, 200)), body, src, order, heads, files: a.vault.getFiles().map((x) => x.path).filter((x) => !/^(t-|Демо|Проверка)/.test(x)).slice(-15) });" },
  /* Его 💬 к тесту 3 цикла 109: со знаками после перехода к следующему полю
     значение прошлого поля теряет решётку в панели. */
  { mine: true, id: "MD6", title: "tagWheel со знаками: прошлое поле держит решётку", files: { "t-MD6.md": "- [ ] #high :: позвонить в банк\n" },
    at: { file: "t-MD6.md", line: 0 }, steps: ["open-tagwheel-left", { wait: 600 }, { key: "ArrowRight" }, { wait: 400 }, { key: "ArrowRight" }], settle: 600,
    cfg: { visual: { tagWheel: { showMarkers: true } } },
    check: "const e = a.workspace.activeEditor.editor; const row = [...e.cm.contentDOM.querySelectorAll('.cm-line')].find((l) => l.textContent.includes('Type')); const doc = e.getLine(0); a.commands.executeCommandById('editor:focus'); return (!!row && doc.includes('**[Type]**') && row.textContent.includes(' #high ')) || JSON.stringify({ shown: row && row.textContent, doc });" },
  /* Его 💬 к тесту 1 цикла 110: решётка вернулась, а заливка панели у тегов
     пропала. Каждый видимый узел полосы с текстом обязан стоять на заливке
     панели — своей или предка внутри строки. */
  { mine: true, id: "MD7", title: "tagWheel со знаками: теги полосы на заливке панели", files: { "t-MD7.md": "- [ ] #high #todo [[Man1]] :: позвонить в банк\n" },
    at: { file: "t-MD7.md", line: 0 }, steps: ["open-tagwheel-left", { wait: 600 }], settle: 600,
    cfg: { visual: { tagWheel: { showMarkers: true } } },
    check: "const e = a.workspace.activeEditor.editor; const row = e.cm.contentDOM.querySelector('.cm-line.io-twline'); a.commands.executeCommandById('editor:focus'); if (!row) return 'нет полосы'; const fill = getComputedStyle(row).getPropertyValue('--io-twfill').trim(); const bg = (n) => { for (let x = n; x && x !== row; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return 'нет'; }; const leaves = [...row.querySelectorAll('*')].filter((x) => !x.children.length && x.textContent.trim() && /#/.test(x.textContent)); const bad = leaves.filter((x) => bg(x) === 'нет').map((x) => x.className + ':' + x.textContent); const tw = row.querySelectorAll('.inline-overhaul-tw-token').length; return (tw > 0 && bad.length === 0) || JSON.stringify({ fill, tw, bad, html: row.innerHTML.slice(0, 1500) });" },
  /* Его 💬 к тесту 1 цикла 110: между своим текстом 🎯 и #todo «слишком
     большое расстояние». Пустое поле справа в коробке эмодзи (3 px) плюс
     обычный пробел давали 7.3 px; от края рисунка знака до решётки обязано
     быть не больше обычного пробела с запасом в 1 px. */
  { mine: true, id: "MD8", title: "tagWheel Custom + default: свой текст вплотную к написанному", files: { "t-MD8.md": "- [ ] #high #todo [[Man1]] :: позвонить в банк\n" },
    at: { file: "t-MD8.md", line: 0 }, steps: ["open-tagwheel-left", { wait: 600 }], settle: 600,
    cfg: { visual: { tagWheel: { showMarkers: true, valueNames: "both" } } },
    check: "const e = a.workspace.activeEditor.editor; const row = e.cm.contentDOM.querySelector('.cm-line.io-twline'); a.commands.executeCommandById('editor:focus'); if (!row) return 'нет полосы'; const icon = String.fromCodePoint(0x1F3AF); const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let n, at = null; while ((n = w.nextNode())) { const i = n.data.indexOf(icon); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + icon.length); at = r.getBoundingClientRect().left; break; } } const tag = [...row.querySelectorAll('.inline-overhaul-tw-token')].find((x) => x.textContent === '#todo'); if (at == null || !tag) return JSON.stringify({ icon: at, tag: !!tag, text: row.textContent }); const cs = getComputedStyle(row); const ctx = document.createElement('canvas').getContext('2d'); ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const ink = ctx.measureText(icon).actualBoundingBoxRight; const space = ctx.measureText(' ').width; const gap = tag.getBoundingClientRect().left - (at + ink); return (gap <= space + 1) || JSON.stringify({ gap, space, ink });" },
  one("B14", "Smart Enter на заголовке каллаута не начинает второй", "> [!note] Title",
    [{ key: "Enter" }], "> [!note] Title\n> ", { at: { file: "t.md", line: 0, ch: 12, source: true }, cfg: { editor: { smartEnter: { enabled: true } } } }),
  /* Зачёркивание (его 💬 к тесту 1 цикла 108): черта на каждом видимом узле
     строки с маркером, включая пузырь тега, и ни на одном узле соседней. В чистом
     vault строка без галочки: `[x]` зачёркивает сам Obsidian (`app.css`,
     `--checklist-done-decoration`), у его Minimal — нет, и пузырь там пуст. */
  ...[["DM8", false], ["MDM7", true]].map(([id, mine]) => ({ id, mine, title: "Strike through ticked line зачёркивает строку с маркером" + (mine ? " (его конфиг)" : ""),
    files: { ["t-" + id + ".md"]: (mine ? "- [x] #high :: купить хлеб :: ✅" : "- [ ] #todo || купить хлеб || ✅") + "\n- другая #high\n" },
    at: { file: "t-" + id + ".md", line: 1, ch: 0 }, steps: [], settle: 600,
    cfg: { pkm: { behavior: { doneMarker: { token: "✅", panel: "right", strike: true } } } },
    check: "const rows = [...a.workspace.activeEditor.editor.cm.contentDOM.querySelectorAll('.cm-line')]; const r = rows.find((l) => l.textContent.includes('купить')); const o = rows.find((l) => l.textContent.includes('другая')); const struck = (e) => getComputedStyle(e).textDecorationLine.includes('line-through'); const vis = (l) => [l, ...l.querySelectorAll('*')].filter((e) => e.textContent.trim() && getComputedStyle(e).display !== 'none'); const bad = r ? vis(r).filter((e) => !struck(e)) : null; const tag = r && vis(r).some((e) => /tag|hashtag/.test(e.className)); return (r && bad.length === 0" + (mine ? "" : " && tag") + " && !vis(o).some(struck)) || JSON.stringify({ r: !!r, tag, bad: bad && bad.map((e) => e.tagName + '.' + e.className), other: vis(o).filter(struck).map((e) => e.className) });" })),
];
