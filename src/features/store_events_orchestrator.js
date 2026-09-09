"use strict";

function registerStoreEvents(ctx) {
  let pendingRender = false;
  let pendingBlurHandler = null;

  /**
   * Перевесить ожидание ухода фокуса на другой обработчик (Д-4, У-32).
   *
   * Снятие и постановка были двумя объявлениями одного правила, и каждое несло
   * свой пустой `catch`. Правило одно: узел, на котором стоит фокус, может уже
   * не быть в дереве — панель перерисовывает содержимое целиком (У-114), и
   * тогда ждать ухода фокуса уже нечего, он ушёл вместе с узлом.
   *
   * Отдаётся тот обработчик, который и правда ждёт, — или `null`, если ждать
   * не получилось: вернуть его вслепую значило бы считать, что подписка есть,
   * когда её нет.
   */
  const swapBlurWatch = (node, previous, next) => {
    if (previous) {
      try {
        node.removeEventListener("blur", previous);
      } catch (_) {
        /* Уборка: снимаем подписку с узла, которого может уже не быть. Цель
           достигнута в любом случае: старый обработчик больше не ждёт. */
      }
    }
    try {
      node.addEventListener("blur", next, { once: true });
      return next;
    } catch (_) {
      /* Проба: узла может уже не быть в дереве, и тогда ухода фокуса с него не
         будет вовсе. Ответ «нет» — это ответ, и он отдаётся наружу. */
      return null;
    }
  };

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
        pendingBlurHandler = swapBlurWatch(ae, pendingBlurHandler, () => flushPendingOnBlur());
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
