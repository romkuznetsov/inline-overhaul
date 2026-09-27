"use strict";
/**
 * Value-ссылка идёт за переименованной заметкой (`В-238`, BUGHUNT F16).
 *
 * Проверяется план патча: какие Value и какие их следы переименовываются, а
 * какие — нет. Отрицательные контроли — заметка с тем же именем в другой
 * папке, чужой тег, не-markdown файл.
 */

const path = require("path");
const assert = require("node:assert/strict");
const { planLinkValueRename } = require(path.join(__dirname, "..", "..", "src", "features", "link_value_rename.js"));

let passed = 0;
const ok = (what) => { passed++; console.log("  ok " + what); };

function cfg() {
  return {
    pkm: {
      fields: {
        links: { fields: [
          { id: "Project", source: "wikilinks:Project", values: [{ token: "Project A" }, { token: "Archive/Old" }, { token: "Other" }] },
          { id: "Project_sub", source: "wikilinks:Project_sub", values: [{ token: "Step", allowedParentValues: ["Project A"] }] },
        ] },
        tags: { fields: [{ id: "Status", prefix: "#", values: [{ token: "Project A" }] }] },
      },
      prefixRules: { checkboxByFieldValue: { Project: { "Project A": "[ ]" } } },
    },
    visual: { tags: { byTag: { "[[Project A]]": { fill: "#111111" } } } },
  };
}

{
  const plan = planLinkValueRename(cfg(), "Project A.md", "Project Alpha.md");
  assert.ok(plan, "F16: переименование заметки из корня не нашло Value");
  const f = plan.patch.pkm.fields.links.fields;
  assert.equal(f[0].values[0].token, "Project Alpha", "Value не переименовано");
  assert.equal(f[0].values[2].token, "Other", "чужое Value тронуто");
  assert.deepEqual(f[1].values[0].allowedParentValues, ["Project Alpha"], "родитель у дочернего Value остался прежним");
  assert.deepEqual(plan.patch.visual.tags.byTag, { "[[Project Alpha]]": { fill: "#111111" }, "[[Project A]]": null }, "вид в строке не переехал");
  assert.deepEqual(plan.patch.pkm.prefixRules.checkboxByFieldValue.Project, { "Project Alpha": "[ ]", "Project A": null }, "чекбокс Value не переехал");
  assert.ok(!("tags" in plan.patch.pkm.fields), "Value-тег с тем же словом тронут");
  ok("Value из корня, его дитя, вид и чекбокс идут за заметкой; тег и чужое Value — нет");
}
{
  const plan = planLinkValueRename(cfg(), "Archive/Old.md", "Archive/Older.md");
  assert.equal(plan.patch.pkm.fields.links.fields[0].values[1].token, "Archive/Older", "Value с папкой не переименовано");
  const moved = planLinkValueRename(cfg(), "Project A.md", "Work/Project A.md");
  assert.equal(moved.patch.pkm.fields.links.fields[0].values[0].token, "Work/Project A", "переезд из корня в папку не дал пути");
  ok("Value с папкой — полным путём, переезд из корня — путём");
}
{
  assert.equal(planLinkValueRename(cfg(), "Notes/Project A.md", "Notes/Project Alpha.md"), null,
    "отрицательный контроль: заметка с тем же именем в папке не та, что у Value без папки");
  assert.equal(planLinkValueRename(cfg(), "Project A.png", "Project Alpha.png"), null, "картинка переименовала Value");
  assert.equal(planLinkValueRename(cfg(), "Nobody.md", "Somebody.md"), null, "чужая заметка дала патч");
  ok("отрицательные контроли: другая папка, не заметка, чужая заметка");
}

/*
 * Цена переименования Value в панели (его пункт 2026-09-27 к тесту 7).
 * Подделан только кэш ссылок Obsidian: две его таблицы и поиск заметки по
 * адресу — ровно то, что зовёт помощник.
 */
{
  const { linkValueRenameImpact } = require(path.join(__dirname, "..", "..", "src", "features", "link_value_rename.js"));
  const files = { "People/Man1.md": { path: "People/Man1.md", parent: { path: "People" } }, "People/Man2.md": { path: "People/Man2.md", parent: { path: "People" } } };
  const app = {
    metadataCache: {
      getFirstLinkpathDest: (t) => ({ Man1: files["People/Man1.md"], "People/Man1": files["People/Man1.md"] })[t] || null,
      resolvedLinks: { "a.md": { "People/Man1.md": 2 }, "b.md": { "People/Man1.md": 1, "x.md": 4 }, "c.md": {} },
      unresolvedLinks: { "a.md": { Ghost: 3 }, "d.md": { Ghost: 1 } },
    },
    vault: { getAbstractFileByPath: (p) => files[p] || null },
  };
  const hit = linkValueRenameImpact(app, "Man1", "[[Man3]]");
  assert.equal(hit.kind, "note");
  assert.equal(hit.newPath, "People/Man3.md", "новое имя без папки ушло из папки заметки");
  assert.deepEqual([hit.links, hit.notes], [3, 2], "ссылки посчитаны не по заметке Value");
  assert.equal(linkValueRenameImpact(app, "Man1", "Man2").kind, "clash", "занятое имя не узнано");
  assert.equal(linkValueRenameImpact(app, "[[People/Man1|Man1]]", "Archive/Man1").newPath, "Archive/Man1.md", "путь с папкой переписан");
  const ghost = linkValueRenameImpact(app, "Ghost", "Spirit");
  assert.deepEqual([ghost.kind, ghost.links, ghost.notes], ["none", 4, 2], "неразрешённые ссылки не посчитаны");
  assert.equal(linkValueRenameImpact(app, "Man1", "[[Man1]]"), null, "отрицательный контроль: правка написания — не переименование");
  ok("цена переименования Value: заметка, занятое имя, папка, заметки нет, написание");
}

console.log("\n" + passed + " проверок пройдено");
