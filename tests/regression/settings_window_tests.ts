/**
 * Окна и уведомления панели встают в окно панели (BUGHUNT 2026-09-26, корень R2).
 *
 * `Modal` и `Notice` Obsidian ставят себя в `activeWindow`; окно настроек 1.13
 * — отдельное, и там, где фокус последним был в главном окне, «Add a Field»
 * открывался за настройками. Шов — `inSettingsWindow` (`settings_window.ts`).
 *
 * Две половины (правило 33):
 *   1. поведение шва на подделанных окнах: внутри — окно панели, после —
 *      прежнее, и при броске тоже; панель закрыта — окно не трогается;
 *   2. сплошной обход по **форме**: каждое открытие окна (`new …(app).open()`)
 *      и каждое `new Notice(` в слое настроек стоит внутри шва. Список мест не
 *      ведётся (правило 36); контроль — строки-примеры в обе стороны.
 *
 * Настоящее окно — `node tools/obsidian_bench.js clean-settings`: там шов
 * проверен в Obsidian, и сборка `0.10.0` краснеет.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inSettingsWindow, rememberSettingsRoot, settingsWindow } from "../../src/ui/settings/settings_window.ts";

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/* 1. Шов. */
{
  const g = globalThis as unknown as { activeWindow?: unknown; activeDocument?: unknown };
  const main = { document: { name: "main" } };
  const popout = { document: { name: "popout" } };
  g.activeWindow = main;
  g.activeDocument = main.document;
  rememberSettingsRoot({ isConnected: true, ownerDocument: { defaultView: popout } as never });
  assert.equal(settingsWindow(), popout);
  let inside: unknown = null;
  inSettingsWindow(() => { inside = g.activeWindow; });
  assert.equal(inside, popout, "внутри шва активное окно — не окно панели");
  assert.equal(g.activeWindow, main, "после шва активное окно не вернулось");
  assert.throws(() => inSettingsWindow(() => { throw new Error("x"); }));
  assert.equal(g.activeWindow, main, "бросок внутри шва оставил чужое активное окно");
  rememberSettingsRoot({ isConnected: false, ownerDocument: { defaultView: popout } as never });
  inSettingsWindow(() => { inside = g.activeWindow; });
  assert.equal(inside, main, "отрицательный контроль: закрытая панель сменила окно");
  ok("шов ставит окно панели на время вызова и возвращает прежнее");
}

/* 2. Обход слоя настроек по форме. */
{
  const OPEN = /new\s+\w+\s*\(\s*app\s*\)\s*\.open\s*\(\s*\)/;
  const NOTICE = /new\s+Notice\s*\(/;
  const guarded = (line: string): boolean => /inSettingsWindow\s*\(/.test(line);
  const offends = (line: string): boolean => (OPEN.test(line) || NOTICE.test(line)) && !guarded(line);
  /* Контроль образца (правило 125): что он обязан найти и что — нет. */
  assert.ok(offends("  new AddFieldModal(app).open();"));
  assert.ok(offends("        notify: (m) => { new Notice(m); },"));
  assert.ok(!offends("  inSettingsWindow(() => new AddFieldModal(app).open());"));
  assert.ok(!offends("    s.open();"), "открытие самих настроек — не окно панели");
  const root = path.resolve(import.meta.dirname, "..", "..", "src", "ui", "settings");
  const bad: string[] = [];
  let seen = 0;
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.ts$/.test(name)) continue;
      fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
        if (OPEN.test(line) || NOTICE.test(line)) seen++;
        if (offends(line)) bad.push(path.relative(root, p) + ":" + (i + 1));
      });
    }
  };
  walk(root);
  assert.ok(seen >= 10, "обход нашёл открытий окон слишком мало — образец ослеп: " + seen);
  assert.deepEqual(bad, [], "окно или уведомление панели мимо inSettingsWindow");
  ok("все " + seen + " окон и уведомлений слоя настроек идут через шов");
}

console.log(passed + " проверок пройдено");
