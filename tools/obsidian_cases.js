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
  one("N1.b", "Move left не стирает [x]: шаг по знакам списка", "- [x] сделано", ["move-left"], "1. [x] сделано"),
  one("F15.a", "Clear line не снимает чекбокс, когда текст остался", "- [ ] #todo || купить", ["status-previous"], "- [ ] купить",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),
  one("F15.b", "Clear line не снимает номер, когда текст остался", "1. #todo || пункт", ["status-previous"], "1. пункт",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),
  one("F15.c", "Clear line чистит опустевшую строку", "- [ ] #todo", ["status-previous"], "",
    { cfg: { pkm: { behavior: { cycleEndBehavior: "clear-prefix" } } } }),

  /* R4 — код и таблица */
  one("F8.a", "Status next не пишет внутрь блока кода", "```", ["status-next"], "```\n- код\n```",
    { files: { "t.md": "```\n- код\n```\n" }, at: { file: "t.md", line: 1 }, expect: { "t.md": "```\n- код\n```\n" } }),
  one("F8.b", "Status next не пишет в таблицу", "| 1 | 2 |", ["status-next"], "| 1 | 2 |"),
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
  one("F17.a", "`||` в тексте человека не стирается", "- if (x || y) return", ["status-next"], "- #todo || if (x || y) return"),
  one("F9", "Дата с пробелом узнаётся", "- [ ] задача 📅 2026-09-30", ["due-next"], "- [ ] задача || 📅 2026-10-01"),
  one("F10", "Status next на двух значениях одного Field", "- #todo #done || x", ["status-next"], "- #doing || x"),
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
  tr("T24", "Повторный Transform дописывает в ту же заметку, скобки не вкладываются", "- #todo || повтор", [1, 2],
    "повтор.md", "!a.vault.getFiles().some((f) => /\\[\\[|-01/.test(f.name)) && !/\\[\\[\\[\\[/.test(line)"),
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
    at: { file: "m2.md", line: 0 }, steps: ["move-left"], expect: { "m2.md": "сделано\n" } },
  /* Его замечание 2026-09-27: `\t\t- [ ] задача` + Move left давало `[ ] задача`. */
  { mine: true, id: "M8", title: "Move left: вложенная задача теряет один шаг отступа", files: { "m8.md": "- к строке ниже\n\t- исходная строка\n\t\t- [ ] задача\n" },
    at: { file: "m8.md", line: 2 }, steps: ["move-left", "move-left"], expect: { "m8.md": "- к строке ниже\n\t- исходная строка\n- [ ] задача\n" } },
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
];
