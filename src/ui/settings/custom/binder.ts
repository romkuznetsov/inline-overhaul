/**
 * Binder в новой панели (PRD 10.4, фаза 3c).
 *
 * Подключение: вёрстка в `binder_view.ts`, записи в `binder_model.ts`, а этот
 * файл сводит их с платформой. Разделение то же, что у редактора Fields и
 * Smart Rules, и по той же причине: вёрстка обязана рисоваться на заглушке
 * (гейт Г16), а `Modal` заглушке недоступен — окно «завести строку»
 * открывается отсюда.
 *
 * Две вещи берутся у тех, с кого начинается работа, а не считаются заново:
 *
 *   * **имена команд** — у реестра (`buildBinderCommandDefs`): по этому имени
 *     человек ищет команду в списке хоткеев, и разойтись с ним нельзя;
 *   * **идентификатор новой команды** — у `normalizeBinderRows` внутри
 *     `migrateConfig`: новая строка рождается без него, и он появляется на
 *     том же патче.
 *
 * Колонка `Hotkey` живёт на приватном API Obsidian (`custom/hotkeys.ts`,
 * К-2): при его отсутствии кнопка неактивна, а панель работает.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { createBinderModel, type BinderClash, type BinderDraft, type BinderRow } from "./binder_model.ts";
import { renderAddForm, renderBinder as drawBinder } from "./binder_view.ts";
import { sayIn } from "../texts_blocks.ts";
import { canOpenHotkeys, hotkeyOf, openHotkeys } from "./hotkeys.ts";

/* Реестр команд: тот же модуль, по которому плагин их регистрирует. */
import commandRegistry from "../../../features/command_registry.js";

interface RegistryApi {
  buildBinderCommandDefs: (cfg: unknown) => ReadonlyArray<{ id: string; name: string }>;
}

const registry = commandRegistry as unknown as RegistryApi;

/**
 * Ветка, которую блок показывает. Схема в неё пока не пишет, но подписка
 * объявляет зависимость: появится там контрол — блок обновится сам.
 */
const BINDER_PATHS = ["editor.binder.rows"] as const;

interface ModalCtor {
  new (app: unknown): {
    contentEl: El;
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
): void {
  let answered = false;
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
      renderAddForm(box, {
        add: draft => { finish(draft); this.close(); },
        cancel: () => { finish(null); this.close(); },
        duplicateOf,
        ...(say ? { say } : {}),
      });
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустая строка. */
      finish(null);
      this.contentEl.empty();
    }
  }

  new AddBinderRowModal(app).open();
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

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-binderblock__mount");
    try {
      const model = createBinderModel({
        plugin: plugin as never,
        commandDefs: cfg => registry.buildBinderCommandDefs(cfg),
      });

      /*
       * Запись и перерисовка. Перерисовка в `finally`: `setConfigPatch` после
       * самой записи делает многое, и исключение оттуда не должно оставлять
       * на экране прежнее — это уже стоило одного замечания заказчика.
       */
      const commit = (write: () => void): void => {
        try { write(); }
        catch (e) { console.error("inline-overhaul: запись строк Binder не удалась", e); }
        finally { draw(); }
      };

      drawBinder(next, {
        say: sayIn("binder-table", ctx),
        rows: model.listRows(),
        hotkeyOf: (row: BinderRow) => hotkeyOf(plugin, row.commandId),
        openHotkey: canOpen ? (row: BinderRow) => { openHotkeys(plugin, row.commandLabel); } : null,
        onDescription: (row, text) => commit(() => { model.setDescription(row.rowId, text); }),
        onRemove: row => commit(() => { model.remove(row.rowId); }),
        onMove: (from, to) => commit(() => { model.move(from, to); }),
        /*
         * Повтор ловится **в окне**, пока человек печатает: сообщение стоит
         * под тем полем, которое повторяется, и `Add` при этом недоступна
         * (C13, 2026-09-02). Всплывающее сообщение остаётся последней
         * преградой — на случай, если строка пришла не из окна.
         */
        onAdd: () => askAddModal(Modal, app, draft => {
          if (!draft) return;
          commit(() => {
            const res = model.add(draft);
            if (!res.ok && res.error) notice(res.error);
          });
        }, draft => model.duplicateOf(draft), sayIn("binder-table", ctx)),
      });
    } catch (e) {
      /* Неудачная попытка выбрасывается целиком, а на экране остаётся то, что
         работало: так же устроены редактор Fields и Smart Rules. */
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
    mounted = null;
    box.empty();
  };
};
