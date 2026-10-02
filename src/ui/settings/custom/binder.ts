/**
 * Binder в новой панели (PRD 10.4, фаза 3c): вёрстка — `binder_view.ts`,
 * записи — `binder_model.ts`, здесь — шов с платформой. Вёрстка рисуется на
 * заглушке (гейт Г16), а `Modal` заглушке недоступен.
 *
 * Имена команд — у реестра (`buildBinderCommandDefs`), по ним человек ищет
 * хоткей; id новой команды выдаёт `normalizeBinderRows` в `migrateConfig`.
 * Колонка `Hotkey` — приватный API Obsidian (`custom/hotkeys.ts`, К-2): нет
 * его — кнопка неактивна.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { inSettingsWindow } from "../settings_window.ts";
import { keepView } from "./keepview.ts";
import { createBinderModel, type BinderClash, type BinderDraft, type BinderRow } from "./binder_model.ts";
import { renderAddForm, renderBinder as drawBinder } from "./binder_view.ts";
import { escapeScope } from "./char_picker.ts";
import { sayIn } from "../texts_blocks.ts";
import { canOpenHotkeys, hotkeyOf, openHotkeys } from "./hotkeys.ts";

/* Реестр команд — тот же, по которому плагин их регистрирует. */
import commandRegistry from "../../../features/command_registry.js";

interface RegistryApi {
  buildBinderCommandDefs: (cfg: unknown) => ReadonlyArray<{ id: string; name: string }>;
}

const registry = commandRegistry as unknown as RegistryApi;

/** Ветка блока. Схема в неё пока не пишет; подписка — на случай контрола. */
const BINDER_PATHS = ["editor.binder.rows"] as const;

interface ModalCtor {
  new (app: unknown): {
    contentEl: El;
    /** Область клавиш окна: над ней встаёт область выбиралки (`В-196`). */
    scope?: unknown;
    open(): void;
    close(): void;
    onOpen?(): void;
    onClose?(): void;
  };
}

/** Окно «завести строку»: три поля и кнопка, форма — в вёрстке. */
function askAddModal(
  Modal: ModalCtor,
  app: unknown,
  done: (draft: BinderDraft | null) => void,
  duplicateOf?: (draft: BinderDraft) => BinderClash | null,
  say?: (name: string, ...args: readonly (string | number)[]) => string,
  Scope?: unknown,
  tips?: { showTips: boolean; showIds: boolean },
): void {
  let answered = false;
  let dropForm: () => void = () => {};
  const finish = (draft: BinderDraft | null): void => {
    if (answered) return;
    answered = true;
    done(draft);
  };

  class AddBinderRowModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      const holdKeys = escapeScope(Scope, app, this.scope);
      dropForm = renderAddForm(box, {
        add: draft => { finish(draft); this.close(); },
        cancel: () => { finish(null); this.close(); },
        duplicateOf,
        ...(say ? { say } : {}),
        ...(holdKeys ? { holdKeys } : {}),
        ...(tips || {}),
      });
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустая строка. */
      finish(null);
      dropForm();
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new AddBinderRowModal(app).open());
}

export const binderTable: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-binderblock");

  /* Без платформы показывать нечего: строки лежат в конфиге. */
  if (!p) return () => { box.empty(); };

  const Modal = p.Modal as ModalCtor;
  const plugin = p.plugin;
  const app = (plugin as { app?: unknown }).app;
  const canOpen = canOpenHotkeys(plugin);
  /* Сообщение человеку — тем же способом, что у редактора Fields. */
  const notice = (text: string): void => {
    const N = p.Notice as new (message: string) => unknown;
    try { new N(text); } catch { console.error("inline-overhaul: " + text); }
  };

  let mounted: El | null = null;
  /*
   * Снятие открытых подсказок шапки: очистка блока убирает всё, что он завёл
   * (С5), а подсказка переживает узел замыканием.
   */
  let tipClosers: Array<() => void> = [];
  const dropTips = (): void => {
    for (const close of tipClosers) { try { close(); } catch { /* узла уже нет */ } }
    tipClosers = [];
  };

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    dropTips();
    const next = el(box, "div", "io-binderblock__mount");
    try {
      const model = createBinderModel({
        plugin: plugin as never,
        commandDefs: cfg => registry.buildBinderCommandDefs(cfg),
      });

      /*
       * Перерисовка в `finally`: исключение из `setConfigPatch` не должно
       * оставлять на экране прежнее.
       */
      const commit = (write: () => void): void => {
        try { write(); }
        catch (e) { console.error("inline-overhaul: запись строк Binder не удалась", e); }
        finally { draw(); }
      };

      drawBinder(next, {
        say: sayIn("binder-table", ctx),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        closers: tipClosers,
        rows: model.listRows(),
        hotkeyOf: (row: BinderRow) => hotkeyOf(plugin, row.commandId),
        openHotkey: canOpen ? (row: BinderRow) => { openHotkeys(plugin, row.commandLabel); } : null,
        onDescription: (row, text) => commit(() => { model.setDescription(row.rowId, text); }),
        onRemove: row => commit(() => { model.remove(row.rowId); }),
        onMove: (from, to) => commit(() => { model.move(from, to); }),
        /*
         * Повтор ловится в окне, под повторяющимся полем, и `Add` недоступна
         * (C13, 2026-09-02). Сообщение — последняя преграда для строки не из окна.
         */
        onAdd: () => askAddModal(Modal, app, draft => {
          if (!draft) return;
          commit(() => {
            const res = model.add(draft);
            if (!res.ok && res.error) notice(res.error);
          });
        }, draft => model.duplicateOf(draft), sayIn("binder-table", ctx), p.Scope, {
          showTips: Boolean(ctx.get("general.help.showTips")),
          showIds: Boolean(ctx.get("advanced.showSettingIds")),
        }),
      });
    } catch (e) {
      /* Неудачная попытка выбрасывается целиком, на экране остаётся рабочее —
         как у редактора Fields и Smart Rules. */
      next.remove();
      console.error("inline-overhaul: Binder не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(BINDER_PATHS, draw);
  return () => {
    unwatch();
    dropTips();
    mounted = null;
    box.empty();
  };
};
