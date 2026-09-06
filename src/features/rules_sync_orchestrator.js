"use strict";

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
  if (reason === "manual") ctx.notice("InlineOverhaul: generated rules updated");
}

module.exports = {
  scheduleGeneratedRulesSync,
  ensureGeneratedRulesNow,
};
