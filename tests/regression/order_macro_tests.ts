/**
 * Имя Field, которое видит человек, доезжает до живого Field из порядка.
 *
 * **Зачем отдельная проверка.** `ensureBehaviorModesFromOrder` собирает живые
 * Fields из порядка и ставит каждому `placeholder` — имя, которым Field
 * зовётся дальше. Заход 6 ревизии (2026-09-11) подменил в ней подпись Field на
 * ключ, и **все 66 файлов набора остались зелёными**: функция выполнялась
 * четырьмя файлами, а на её вывод не смотрел никто.
 *
 * **Предмет — расхождение подписи и ключа.** Все чтения подписи написаны с
 * запасным путём `labels[key] || key`, и фикстура, где подпись равна ключу,
 * неотличима от фикстуры без подписи вовсе (У-47). Поэтому здесь они разные
 * нарочно: ключ `at`, имя `Meeting`.
 *
 * **Конфиг приходит через `migrateConfig`**, а не пишется тут руками
 * (правило 2, У-2): сырую форму продукт не видит никогда, и фикстура, минующая
 * нормализацию, проверяла бы функцию, которой в продукте нет (У-55). Первая
 * версия этой проверки как раз её и миновала — и немедленно разошлась с
 * продуктом на первом же утверждении.
 *
 * **Чего эта проверка не покрывает, и это сказано вслух.** Вторая такая же
 * ветка — `placeholder` у Field типа wikilink — образца не получила: через
 * нормализацию Field, объявленный ссылкой, приезжает тегом, и до ветки
 * wikilink фикстура не доходит. Ветка названа в отчёте захода 6 (PRD 15.7);
 * снимется это тем, что появится законный способ получить такой Field.
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const I = loadPluginInternals() as Any;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/** Конфиг с тремя Fields; у каждого имя отличается от ключа. */
function migrated(): Any {
  return I.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: {
          left: ["imp"],
          right: ["project", "at"],
          labels: { imp: "Importance", project: "Client", at: "Meeting" },
          types: { imp: "tag", project: "link", at: "element" },
          active: { imp: "yes", project: "yes", at: "yes" },
          enabled: { imp: true, project: true, at: true },
        },
        leftMode: { fields: [{ id: "imp", orderKey: "imp", prefix: "#", values: [{ token: "#/1" }] }] },
        rightMode: { fields: [{ id: "project", orderKey: "project", values: [] }] },
        elements: { fields: ["at"], byField: { at: { emoji: "⏰", format: "hh:mm" } } },
      },
    },
  });
}

/* ---- живые Fields собрались ------------------------------------------- */
{
  const fields = migrated().pkm.fields;
  const all: Any[] = []
    .concat((fields.tags && fields.tags.fields) || [])
    .concat((fields.links && fields.links.fields) || []);

  /* Контроль до вывода: собирать было из чего (У-88). */
  assert.ok(all.length >= 3,
    "положительный контроль: живых Fields собралось " + all.length
    + " — утверждения ниже мерили бы пустоту");
  ok("живые Fields собраны из порядка: " + all.length);

  const at = all.find(f => String(f && f.id) === "at");
  assert.ok(at, "Field-элемент не собрался вовсе: " + JSON.stringify(all.map(f => f.id)));

  /*
   * Главное утверждение захода: `placeholder` — это **имя, которое дал
   * человек**, а не ключ. На равных именах эти два случая неразличимы, и
   * подмена подписи ключом проходила незамеченной.
   */
  assert.equal(String(at.placeholder), "Meeting",
    "Field-элемент назвался ключом вместо своего имени: переименование Field"
    + " перестанет доезжать до движка. Собрано: " + JSON.stringify(at));
  ok("имя Field, которое дал человек, доезжает до живого Field, а не его ключ");
}

/* ---- и подписи целиком уезжают движку --------------------------------- */
{
  const dumped = JSON.parse(String(I.serializePkmOrderForMacro(migrated()))) as Any;
  assert.ok(dumped && typeof dumped === "object" && Object.keys(dumped).length > 5,
    "положительный контроль: выгрузка порядка пуста — сверять не с чем");
  assert.equal(String(dumped.labels && dumped.labels.at), "Meeting",
    "подпись Field не уехала в выгрузку порядка: " + JSON.stringify(dumped.labels));
  assert.equal(String(dumped.labels && dumped.labels.project), "Client",
    "подпись Field не уехала в выгрузку порядка: " + JSON.stringify(dumped.labels));
  ok("выгрузка порядка несёт имена Fields, а не только их ключи");
}

console.log("\n" + passed + " проверок пройдено");
