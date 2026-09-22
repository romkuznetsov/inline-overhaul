/**
 * Тон видимых текстов панели — по бренд-буку (`references/voice.md`, `В-198`).
 *
 * Его выбор 2026-09-23: панель по бренд-буку, и третий пункт — тон. Правило
 * бренд-бука: второе лицо, настоящее время, «не „A Field can be added“ и не
 * „you will see“», и без восклицательных знаков. 22 строки из 1 571 были
 * переписаны тем же заходом; этот сторож держит ноль.
 *
 * **Чем меряется.** Весь каталог панели — `panelCatalog(SCHEMA, TABS)`, то же,
 * что уходит в файл языка, — с разметкой, снятой до проверки: `<code>!</code>`
 * восклицанием не считается.
 *
 * **Контроли.** Положительный — образцы, на которых признак обязан сработать;
 * отрицательный — законные обороты, которые он путать не должен («can happen»,
 * «you can set»): без них признак, написанный шире правила, краснел бы на
 * правильном тексте (У-204).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const imp = (p: string) => import(pathToFileURL(path.join(root, p)).href);
const { SCHEMA, TABS } = await imp("src/ui/settings/schema/index.ts");
const { panelCatalog } = await imp("src/ui/settings/texts_panel.ts");

/* Содержимое `<code>` — синтаксис, а не речь: `<code>!</code>` не восклицание. */
const plain = (t: string): string => t.replace(/<code>[\s\S]*?<\/code>/g, "").replace(/<[^>]+>/g, "");
const BANG = /!(\s|$)/;
const PASSIVE = /\b(can be|will be|is being|are being|should be)\b/i;
const FUTURE = /\byou will\b/i;
const offends = (t: string): string => {
  const p = plain(t);
  if (BANG.test(p)) return "восклицание";
  if (PASSIVE.test(p)) return "пассив";
  if (FUTURE.test(p)) return "«you will»";
  return "";
};

for (const bad of ["Try it now!", "A Field can be added here", "you will see it below"]) {
  assert.ok(offends(bad), "положительный контроль: признак не узнал «" + bad + "»");
}
for (const good of ["Two things can happen to it", "Under Fields you can set a Value", "Press <code>!</code> to open", "Where you see it"]) {
  assert.equal(offends(good), "", "отрицательный контроль: признак назвал законное «" + good + "»");
}

const list = panelCatalog(SCHEMA, TABS) as ReadonlyArray<{ key: string; text?: string }>;
assert.ok(list.length > 1000, "каталог панели почти пуст — мерить нечего: " + list.length);
const found = list
  .map(e => [String(e.key), offends(String(e.text || ""))] as const)
  .filter(([, why]) => why);
assert.deepEqual(found, [], "видимые тексты панели расходятся с тоном бренд-бука: " + JSON.stringify(found));
console.log("  ok тон панели по бренд-буку: " + list.length + " строк, расхождений 0");
