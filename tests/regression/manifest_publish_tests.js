"use strict";

/**
 * Манифест готов к подаче в community review (PRD фаза 6, пункт 4; дефект A13).
 *
 * Проверка стоит не на «поля заполнены», а на том, **что человек увидит в
 * карточке плагина**. Это разные вещи, и разошлись бы они молча: пустая строка
 * в `authorUrl` выглядит в файле как заполненное поле, а Obsidian её не рисует
 * вовсе, потому что читает значение на истинность:
 *
 *   u.authorUrl ? k.createEl("a", {href: u.authorUrl, ...}) : k.appendText(w)
 *
 * (`app.js` 1.13.7, карточка плагина; У-44 — про то, что такие правила живут
 * только в коде платформы). То есть пустое поле и отсутствующее поле дают
 * человеку одно и то же, а на review отличаются: пустое — замечание.
 *
 * `fundingUrl` читается тем же способом и включает **кнопку** `Donate`:
 *
 *   u.fundingUrl && S.createEl("button", {text: q6.buttonDonate()})
 *
 * Поэтому плейсхолдер здесь запрещён отдельно: он не «поле на будущее», а
 * нерабочая кнопка на экране у каждого, кто откроет карточку.
 *
 * **Чтобы снять этот запрет, нужна настоящая ссылка от заказчика** (В-75).
 * Пин — утверждение о состоянии, и стареет он тише всего (У-71), поэтому
 * условие снятия написано здесь же: появилась ссылка — поле заводится вместе с
 * правкой этого файла, и `fundingUrl` переходит из «запрещён» в «обязан быть
 * непустым и не плейсхолдером».
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

/* 1. Ни одного поля со строкой-пустышкой. Именно этим `authorUrl` и был. */
for (const [key, value] of Object.entries(manifest)) {
  if (typeof value !== "string") continue;
  assert.notStrictEqual(
    value.trim(),
    "",
    "поле " + key + " в manifest.json пустое: Obsidian его не покажет, а review засчитает замечанием — заполните или уберите"
  );
}

/* 2. Поля, которые Obsidian превращает в ссылку или кнопку, не содержат
      заготовок. Список слов — то, чем такие заготовки обычно и выглядят. */
const PLACEHOLDERS = ["example.com", "your-", "yourname", "todo", "tbd", "changeme", "<", "placeholder"];
for (const key of ["authorUrl", "fundingUrl", "helpUrl"]) {
  if (!(key in manifest)) continue;
  const value = String(manifest[key]).toLowerCase();
  for (const bad of PLACEHOLDERS) {
    assert.ok(
      !value.includes(bad),
      "поле " + key + " похоже на плейсхолдер (" + bad + "): Obsidian покажет по нему нерабочую ссылку или кнопку"
    );
  }
  assert.match(
    String(manifest[key]),
    /^https:\/\/\S+$/,
    "поле " + key + " обязано быть настоящим https-адресом"
  );
}

/* 3. Кнопка `Donate` не заводится, пока ссылки нет.
      Снимается вместе с ответом на В-75 — тогда `fundingUrl` появляется, и
      пункт 2 выше начинает проверять его по-настоящему. */
assert.ok(
  !("fundingUrl" in manifest),
  "fundingUrl появился в манифесте: если это настоящая ссылка заказчика — уберите эту проверку и запишите решение, иначе Obsidian покажет нерабочую кнопку Donate"
);

/* 4. Обязательные поля на месте и непустые. */
for (const key of ["id", "name", "version", "minAppVersion", "description", "author"]) {
  assert.ok(
    typeof manifest[key] === "string" && manifest[key].trim() !== "",
    "в manifest.json нет обязательного поля " + key
  );
}

console.log("Manifest publish tests: OK (полей " + Object.keys(manifest).length + ", пустых нет, fundingUrl не заведён)");
