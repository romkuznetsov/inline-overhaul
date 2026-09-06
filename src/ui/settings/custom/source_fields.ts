/**
 * `Which Fields stay on the line` — какие Values остаются на исходной строке
 * после `inline2note` (замечание заказчика 1.6.5.1, решение 2026-09-01).
 *
 * **Настройка не новая, новый только контрол.** Движок читает
 * `transform.inline2note.sourceProcessing.cleanupFieldIds` с самого начала:
 * `applySourceCleanupByFieldIds` убирает со строки Values всех Fields, **кроме**
 * перечисленных. Контрола к ней не было ни в новой панели, ни в старой — ключ
 * можно было задать только заметкой конфигурации или руками. Заказчик помнил
 * поведение и не мог найти настройку; он был прав, а З2 нарушен: настройку
 * потеряли при переносе, а не убрали решением.
 *
 * **Отмечено — значит остаётся.** Имя ключа говорит обратное («cleanup»), но
 * движок именно так его и читает, а имя ключа менять нельзя (З1). Поэтому
 * подпись контрола говорит правду, а не повторяет ключ.
 *
 * Пусто — не ошибка, а умолчание: со строки уходят все Values, и получается
 * первый из двух примеров заказчика.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { realFields } from "./preview_data.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/** Путь ключа. Он же причина записи: по ней сверяются карты записей (М-4). */
export const KEEP_PATH = "transform.inline2note.sourceProcessing.cleanupFieldIds";

/*
 * Пустые состояния: приглашение, а не пустое место (ПЗ2), и умолчание,
 * которое означает вполне определённое. Слова живут в каталоге (10.13.47).
 */
const T = BLOCK_TEXTS["source-fields"];

export const NO_FIELDS = T.NO_FIELDS;
export const NONE_KEPT = T.NONE_KEPT;

/** Отмеченные Fields из конфига, без выдумок про их порядок. */
export function keptIds(ctx: SettingsCtx): readonly string[] {
  const raw = ctx.get(KEEP_PATH);
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x || "").trim()).filter(Boolean);
}

export const sourceFields: CustomRender = (host: El, ctx: SettingsCtx) => {
  const say = sayIn("source-fields", ctx);
  const box = el(host, "div", "io-keepfields");
  let mounted: El | null = null;

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-keepfields__mount");
    try {
      fill(next);
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: список Fields исходной строки не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  const fill = (mount: El): void => {
    /*
     * Fields читаются тем же чтением, что и предпросмотры: второй разбор того
     * же формата разошёлся бы с первым (П11).
     */
    const fields = realFields(ctx);
    const kept = new Set(keptIds(ctx));
    const enabled = Boolean(ctx.get("transform.inline2note.enabled"));

    if (!fields.length) {
      el(mount, "div", "io-side__empty", NO_FIELDS);
      return;
    }

    const list = el(mount, "div", "io-keepfields__list");
    for (const f of fields) {
      const row = el(list, "label", "io-keepfields__row");
      const input = row.createEl("input", {
        cls: "io-toggle io-toggle--check",
        type: "checkbox",
        attr: { "aria-label": say("KEEP_ONE", f.name || f.id) },
      }) as El & { checked: boolean; disabled: boolean };
      input.checked = kept.has(f.id);
      input.disabled = !enabled;
      input.addEventListener("change", (() => {
        if (!enabled) return;
        const now = new Set(keptIds(ctx));
        if (input.checked) now.add(f.id);
        else now.delete(f.id);
        /*
         * Пишется список в порядке Fields, а не в порядке нажатий: иначе одно
         * и то же множество давало бы разный конфиг, и «сброс группы» считал
         * бы настройку изменённой на ровном месте.
         */
        const ordered = fields.map(x => x.id).filter(id => now.has(id));
        void ctx.set(KEEP_PATH, ordered);
        draw();
      }) as never);
      el(row, "span", "io-keepfields__name", f.name || f.id);
      el(row, "span", "io-keepfields__kind", f.kind === "link" ? "link" : f.kind);
    }

    /* Ни одного отмеченного — сказать, что это значит, а не молчать. */
    if (!kept.size) el(mount, "p", "io-preview__note", NONE_KEPT);

    const actions = el(mount, "div", "io-rowactions");
    const all = btn(actions, "io-btn io-btn--sm", {
      text: say("KEEP_ALL"),
      label: say("KEEP_ALL_DESC"),
    });
    all.disabled = !enabled || kept.size === fields.length;
    all.addEventListener("click", (() => {
      if (!enabled) return;
      void ctx.set(KEEP_PATH, fields.map(f => f.id));
      draw();
    }) as never);
    const none = btn(actions, "io-btn io-btn--sm", {
      text: say("KEEP_NONE"),
      label: say("KEEP_NONE_DESC"),
    });
    none.disabled = !enabled || kept.size === 0;
    none.addEventListener("click", (() => {
      if (!enabled) return;
      void ctx.set(KEEP_PATH, []);
      draw();
    }) as never);
  };

  draw();
  /*
   * Список зависит и от Fields, и от самой настройки: Field, заведённый на
   * соседней вкладке, обязан появиться здесь без перехода по вкладкам —
   * это тот же дефект 1.4.1.1.3, только в другом блоке.
   */
  const stop = ctx.watch([KEEP_PATH, "pkm.fields", "transform.inline2note.enabled"], draw);
  return () => {
    stop();
    box.empty();
  };
};
