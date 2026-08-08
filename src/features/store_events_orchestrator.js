"use strict";

function registerStoreEvents(ctx) {
  let pendingRender = false;
  let pendingBlurHandler = null;

  const isEditableSettingsElement = (el) => {
    if (!el || typeof el !== "object") return false;
    const tag = String(el.tagName || "").toUpperCase();
    const editable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
    if (!editable) return false;
    try {
      return !!(el.closest && (el.closest(".vertical-tab-content") || el.closest(".mod-settings")));
    } catch (_) {
      return false;
    }
  };

  const renderNow = () => {
    ctx.renderSettingsTab();
    ctx.scheduleGeneratedRulesSync();
  };

  const flushPendingOnBlur = () => {
    if (!pendingRender) return;
    pendingRender = false;
    renderNow();
  };

  ctx.setUnsubscribe(
    ctx.subscribeStore(() => {
      const ae = typeof document !== "undefined" ? document.activeElement : null;
      if (isEditableSettingsElement(ae)) {
        pendingRender = true;
        if (pendingBlurHandler) {
          try { ae.removeEventListener("blur", pendingBlurHandler); } catch (_) {}
        }
        pendingBlurHandler = () => flushPendingOnBlur();
        try { ae.addEventListener("blur", pendingBlurHandler, { once: true }); } catch (_) {}
        return;
      }
      renderNow();
    })
  );

  ctx.registerCleanup(() => {
    const unsubscribe = ctx.getUnsubscribe();
    if (unsubscribe) unsubscribe();
    const timer = ctx.getRulesTimer();
    if (timer) {
      clearTimeout(timer);
      ctx.setRulesTimer(null);
    }
  });
}

module.exports = {
  registerStoreEvents,
};
