// @ts-check
"use strict";

/**
 * Видимый текст по ключу каталога — для кода, который про панель не знает
 * (10.13.50). Одно объявление правила на всех, кто говорит человеку, включая
 * три движка под З3 (В-100, У-32, Б-11); кто зовёт — `grep say.js`, пин в
 * `tests/regression/runtime_notices_tests.js` (У-135).
 *
 * Шов — `globalThis.__inlineSay`, ставит слой настроек. Нет шва (панель не
 * загрузилась, `createSettingTab()` отдал `null`) — показывается английский
 * литерал с места вызова; тот же контракт, что у `PLAIN`.
 */

/**
 * @param {string} key      ключ каталога, собранный `noticeKey`, а не литерал
 * @param {string} english  что показать, если каталога нет
 * @param {...(string|number)} args  подстановки на места `{0}`, `{1}`, …
 */
function say(key, english, ...args) {
  /** @type {string} */
  let text = String(english == null ? "" : english);
  try {
    /* Шов на `globalThis` не объявлен типом нарочно — иначе шов объявлен дважды. */
    const ask = /** @type {any} */ (globalThis).__inlineSay;
    if (typeof ask === "function") {
      const said = ask(String(key), text);
      if (typeof said === "string" && said !== "") text = said;
    }
  } catch (_) {
    /* Перевод не достался — показываем английское, не падаем. */
  }
  /* Подстановка по номеру, не склейка: порядок слов в языках разный (10.13.46 Р2). */
  return args.reduce(
    /** @param {string} out */
    (out, value, i) => out.split("{" + i + "}").join(String(value == null ? "" : value)),
    text,
  );
}

/**
 * Ключ сообщения. Одно объявление на весь плагин (У-32, У-82): ключ, собранный
 * иначе, не найдётся в каталоге, и человек молча увидит английский.
 *
 * @param {string} area область, названная по тому, что человек видит
 * @param {string} name имя сообщения внутри области
 * @returns {string}
 */
function noticeKey(area, name) {
  return "notice." + area + "." + name;
}

module.exports = { say, noticeKey };
