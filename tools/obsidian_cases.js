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
  /* `В-243` спрошен заново 2026-09-28: «узнавать обе, писать как сейчас» — без пробела. */
  one("F9", "Дата с пробелом узнаётся", "- [ ] задача 📅 2026-09-30", ["due-next"], "- [ ] задача || 📅2026-10-01"),
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
  /* Тесты 1–3 цикла 103, `В-235`: Value посреди текста — слово человека. */
  { mine: true, id: "M17", title: "Тег посреди фразы остаётся на месте", files: { "m17.md": "- купить #todo молоко\n" },
    at: { file: "m17.md", line: 0 }, steps: ["type-next"], expect: { "m17.md": "- #todo :: купить #todo молоко\n" } },
  { mine: true, id: "M18", title: "Ссылка посреди фразы остаётся на месте", files: { "m18.md": "- встреча по [[Man1]] вчера\n" },
    at: { file: "m18.md", line: 0 }, steps: ["people-next"], expect: { "m18.md": "- [[Man1]] :: встреча по [[Man1]] вчера\n" } },
  { mine: true, id: "M19", title: "Панель не стирает тег из фразы", files: { "m19.md": "- купить #todo молоко\n" },
    at: { file: "m19.md", line: 0 }, steps: ["open-tagwheel-left", { key: "ArrowRight" }, { key: "ArrowRight" }, { key: "ArrowRight" }, { key: "ArrowUp" }, { key: "Enter" }],
    expect: { "m19.md": "- [[Man1]] :: купить #todo молоко\n" } },
  /* Тест 4 цикла 103, его ответ `В-249`: и в конце строки тег — его слово. */
  { mine: true, id: "M20", title: "Тег в конце строки — тоже слово человека", files: { "m20.md": "- купить молоко #todo\n" },
    at: { file: "m20.md", line: 0 }, steps: ["type-next"], expect: { "m20.md": "- #todo :: купить молоко #todo\n" } },
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
