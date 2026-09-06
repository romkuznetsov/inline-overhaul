"use strict";
/* Три новые функции слоя настроек проверяются выводом, а не чтением кода:
   сброс группы, предупреждение о контрасте, строки копий настроек. */
const fs = require("fs");
const path = require("path");

const target = process.argv[2];
const smoke = fs.readFileSync(path.join(__dirname, "smoke.js"), "utf8");
const tmp = path.join(__dirname, "_h9.js");
fs.writeFileSync(tmp, smoke.replace("process.exit(failures ? 1 : 0);",
  "module.exports = { ctxVm, vm };"), "utf8");
process.argv[2] = target;
const h = require(tmp);
fs.unlinkSync(tmp);
const run = e => h.vm.runInContext(e, h.ctxVm);

let failures = 0;
const check = (label, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log("  " + (ok ? "ok  " : "FAIL") + "  " + label + ": " + got +
    (ok ? "" : "   (ждали " + want + ")"));
};

/* ---- 1. контраст ---------------------------------------------------- */
console.log("\nконтраст, известные пары:");
check("белое на чёрном", run('contrastRatio("#000000", "#ffffff").toFixed(1)'), "21.0");
check("белое на белом", run('contrastRatio("#ffffff", "#ffffff").toFixed(1)'), "1.0");
check("#767676 на белом", run('contrastRatio("#767676", "#ffffff").toFixed(2)'), "4.54");

console.log("\nзначения мокового vault ниже порога 3:1:");
console.log(run([
  '(() => {',
  '  const out = [];',
  '  FIELDS.forEach(f => (f.values || []).forEach(v => {',
  '    if (v.shown === "nothing") return;',
  '    const r = contrastRatio(v.color, v.textColor);',
  '    if (r < 3) out.push("    " + f.name + " / " + v.token + " \\u2014 " + r.toFixed(1) + ":1");',
  '  }));',
  '  return out.length ? out.join(String.fromCharCode(10)) : "    ни одного";',
  '})()'
].join("\n")));

/* ---- 2. сброс группы ------------------------------------------------ */
const GROUP = 'SCHEMA.find(g => g.id === "tag-bars")';
console.log("\nсброс группы Tag Bars:");
/* дымовой тест перед этим щёлкает каждый контрол, поэтому начинаем с чистого */
run('resetGroup(' + GROUP + ')');
check("после сброса на старте отличий нет", run('groupDrift(' + GROUP + ').length'), "0");
run('ctx.set("visual.tagBars.thickness", 9)');
run('ctx.set("visual.tagBars.stripesToShow", 1)');
check("после двух правок отличий", run('groupDrift(' + GROUP + ').length'), "2");
console.log("  список, как его покажет подтверждение:");
console.log(run('groupDrift(' + GROUP + ').map(d => "    " + d.item.name + ": " + ' +
  'shownValue(d.item, d.now) + " \\u2192 " + shownValue(d.item, d.was)).join(String.fromCharCode(10))'));
run('resetGroup(' + GROUP + ')');
check("после сброса отличий", run('groupDrift(' + GROUP + ').length'), "0");
check("толщина вернулась к умолчанию",
  run('String(val("visual.tagBars.thickness") === ' + GROUP + '.items.find(i => i.id === "bars-thickness").default)'),
  "true");
check("Fields не тронуты", run('FIELDS.length > 0 && FIELDS[0].values.length > 0'), "true");

/* ---- 3. копии настроек (10.13.2) ------------------------------------- */
console.log("\nстрока копий настроек:");
const backup = run([
  '(() => {',
  '  const it = SCHEMA.flatMap(g => g.items).find(x => x.id === "settings-backup-actions");',
  '  if (!it) return "нет";',
  '  return it.kind + " / " + it.buttons.map(b => b.action + (b.warning ? " (warning)" : "")).join(", ");',
  '})()'
].join("\n"));
/* Порядок кнопок обязателен: сначала сохранить, потом заменить. Красная
   кнопка первой предлагала бы разрушительное действие раньше безопасного. */
check("описана в схеме", backup, "buttons / save-backup, restore-backup (warning)");

const folder = run([
  '(() => {',
  '  const it = SCHEMA.flatMap(g => g.items).find(x => x.id === "backup-folder");',
  '  if (!it) return "нет";',
  '  return it.kind + " / " + it.path + " / " + it.default;',
  '})()'
].join("\n"));
check("папка копий описана", folder, "text / advanced.backups.folder / Inline Overhaul/Backups");

console.log(failures ? "\n" + failures + " problem(s)" : "\nвсе три функции ведут себя как описано");
process.exit(failures ? 1 : 0);
