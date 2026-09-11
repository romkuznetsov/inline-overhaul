"use strict";

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50).
 *
 * Модуль спрашивает `globalThis.__inlineSay` через общий помощник: своей копии
 * этого правила заводить нельзя, из тройки таких копий уже вырос дефект Б-11.
 *
 * **Литеральный `require` без запасного пути** — правило модулей (У-89,
 * У-90, A33). До 2026-09-09 здесь стояла заглушка, и она **повторяла правило
 * подстановки `{0}`** — то есть была ещё одной той самой копией, о которой
 * предупреждает абзац выше. Таких копий было четыре, в четырёх файлах.
 */
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

function scheduleGeneratedRulesSync(ctx) {
  const cfg = ctx.getConfig();
  if (!(cfg && cfg.pkm)) return;
  const activeTimer = ctx.getTimer();
  if (activeTimer) clearTimeout(activeTimer);
  const timer = setTimeout(() => {
    ctx.setTimer(null);
    ctx.ensureGeneratedRulesNow("store:update").catch((e) => {
      ctx.onError(e);
    });
  }, ctx.delayMs);
  ctx.setTimer(timer);
}

/**
 * Что уже лежит в файле, или `null`, если прочитать нечем и незачем.
 *
 * Отказ чтения — это не отказ записи: файла может не быть вовсе (первый
 * запуск), у адаптера может не быть `read` (обвязка проверок), диск может
 * ответить ошибкой. Во всех трёх случаях ответ один — «сравнивать не с чем»,
 * и дальше идёт обычная запись. Молчать тут можно именно потому, что молчание
 * ничего не отменяет: хуже, чем было, не станет.
 */
async function readCurrent(ctx, path) {
  if (typeof ctx.readText !== "function") return null;
  try {
    const text = await ctx.readText(path);
    return typeof text === "string" ? text : null;
  } catch (_) {
    return null;
  }
}

async function ensureGeneratedRulesNow(ctx, reason) {
  const cfg = ctx.getConfig();
  if (!(cfg && cfg.pkm)) return;
  const genPath = String((cfg.advanced && cfg.advanced.generatedRulesPath) || ctx.defaultGeneratedRulesPath || "").trim();
  if (!genPath) throw new Error("Generated rules path is empty");
  const md = ctx.buildRulesMarkdown(cfg);
  /*
   * **Не писать то, что уже написано** (Д-1 разбора готовности, 2026-09-08).
   *
   * Запись зовётся в `onload` безусловно, то есть при каждом запуске Obsidian.
   * Пока в файле стояло время сборки, содержимое всегда было новым и сравнение
   * не имело смысла; времени там больше нет, и теперь у одного и того же
   * конфига один и тот же файл. Значит запись при старте — это запись
   * **без изменения**, и её видит вся синхронизация человека.
   *
   * Сравнивается содержимое целиком, а не его длина или отметка времени:
   * длина совпадает у разных файлов, а отметку времени мы и снимаем.
   */
  const current = await readCurrent(ctx, genPath);
  if (current === md) {
    /*
     * Ручную пересборку человек позвал сам, и молчание она читается как
     * «не сработало». Сообщение остаётся — оно про «правила на месте», а не
     * про то, что диск изменился.
     */
    if (reason === "manual") ctx.notice(__say(__noticeKey("plugin", "rules-updated"), "Rules file updated"));
    return;
  }
  await ctx.writeText(genPath, md);
  if (reason === "manual") ctx.notice(__say(__noticeKey("plugin", "rules-updated"), "Rules file updated"));
}

module.exports = {
  scheduleGeneratedRulesSync,
  ensureGeneratedRulesNow,
};
