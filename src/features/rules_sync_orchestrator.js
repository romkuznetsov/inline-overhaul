"use strict";

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50).
 *
 * Модуль спрашивает `globalThis.__inlineSay` через общий помощник: своей копии
 * этого правила заводить нельзя, из тройки таких копий уже вырос дефект Б-11.
 */
const __say = (() => {
  try {
    const mod = require("../core/say.js");
    if (mod && typeof mod.say === "function") return mod.say;
  } catch (_) {}
  return (key, english, ...args) => args.reduce(
    (out, value, i) => out.split("{" + i + "}").join(String(value == null ? "" : value)),
    String(english == null ? "" : english),
  );
})();

/** Ключ сообщения. Строит его одна функция, и её зовут оба конца (У-82). */
function __noticeKey(area, name) {
  return "notice." + area + "." + name;
}

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

async function ensureGeneratedRulesNow(ctx, reason) {
  const cfg = ctx.getConfig();
  if (!(cfg && cfg.pkm)) return;
  const genPath = String((cfg.advanced && cfg.advanced.generatedRulesPath) || ctx.defaultGeneratedRulesPath || "").trim();
  if (!genPath) throw new Error("Generated rules path is empty");
  const md = ctx.buildRulesMarkdown(cfg);
  await ctx.writeText(genPath, md);
  if (reason === "manual") ctx.notice(__say(__noticeKey("plugin", "rules-updated"), "Rules file updated"));
}

module.exports = {
  scheduleGeneratedRulesSync,
  ensureGeneratedRulesNow,
};
