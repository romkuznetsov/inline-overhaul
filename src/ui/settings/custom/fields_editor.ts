/**
 * Редактор Fields в новой панели (PRD 10.2, фаза 3b пункт 4).
 *
 * Здесь только подключение: вёрстка лежит в `fields_editor_view.ts`, записи —
 * в `fields_model.ts`, а этот файл сводит их с платформой. Разделение не
 * ради красоты: вёрстка обязана рисоваться на заглушке DOM (гейт Г16), а
 * `Modal` и `Notice` заглушке недоступны, поэтому окна открываются отсюда и
 * приходят в блок обратными вызовами.
 *
 * Старая доска (`fields_editor_legacy.js`) отсюда больше не зовётся: её
 * держит только старая панель, до её удаления в фазе 3c. Записи у обеих
 * общие — модель одна, — и разойтись им не на чем.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, rich, type El } from "./dom.ts";
import { inSettingsWindow } from "../settings_window.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import {
  renderFieldsEditor,
  FIELDS_HEIGHT_PATH,
  type FieldsViewState,
  type NewField,
} from "./fields_editor_view.ts";

/*
 * Помощники состояния дерева значений — **напрямую из модуля** (последний
 * пункт фазы 6, 2026-09-08).
 *
 * До этого их брал шов `fields_editor_legacy.js`: `globalThis`, `require` по
 * относительному пути и заглушка на случай отказа. Довод у шва был честный —
 * «у поиска есть откат на заглушку, и двух таких откатов быть не должно», —
 * но откат оказался лишним целиком: `globalThis.__inlineOrderDeepEditorState`
 * не ставил **никто**, а `require` стоял литералом и в бандле разрешался
 * всегда. То есть заглушка была недостижима, и её единственным делом было
 * прятать отказ загрузки, если бы он случился (У-90).
 */
import deepStateModule from "../../../core/order_deep_editor_state.js";
import linkRenameModule from "../../../features/link_value_rename.js";
import { sayIn } from "../texts_blocks.ts";
import { escapeScope } from "./char_picker.ts";
import { renderNewFieldForm } from "./new_field_dialog.ts";

/** То немногое от vault Obsidian, что спрашивает окно `Add a Field`. */
interface VaultFile { path: string; parent?: { path: string } | null; children?: unknown[] }
interface VaultLike { getAllLoadedFiles?: () => VaultFile[] }

const deepState = deepStateModule as unknown as DeepState;

/** Цена переименования Value-ссылки — ответ `linkValueRenameImpact`. */
interface LinkRenameImpact {
  kind: "note" | "clash" | "none";
  oldTarget: string;
  newTarget: string;
  file?: unknown;
  newPath?: string;
  links: number;
  notes: number;
}
const linkRename = linkRenameModule as unknown as {
  linkValueRenameImpact: (app: unknown, oldToken: string, nextToken: string) => LinkRenameImpact | null;
};

/** Как окно спрашивает свой текст (10.13.47). */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

/** Пути, на которых редактор перерисовывается целиком. */
const EDITOR_PATHS = [
  "features.pkm.enabled",
  "general.help.showTips",
  "advanced.showSettingIds",
  /* Высота таблицы: переключатель в шапке пишет её и ждёт пробуждения
     отсюда, а не зовёт перерисовку сам (У-22). Через тот же путь редактор
     узнаёт о восстановлении копии настроек. */
  FIELDS_HEIGHT_PATH,
] as const;

/* ---- окна платформы ---------------------------------------------------- */

interface ModalCtor {
  new (app: unknown): {
    contentEl: El;
    open(): void;
    close(): void;
    onOpen?(): void;
    onClose?(): void;
  };
}

/**
 * Окно «Add a Field» — главное сразу и живой предпросмотр (его заказ
 * 2026-09-27). Форма — `new_field_dialog.ts`; здесь окно платформы и то, что
 * форма спрашивает у vault: заметки, папки, есть ли заметка у Value.
 */
export function askNewFieldModal(
  Modal: ModalCtor,
  app: unknown,
  done: (answer: NewField | null) => void,
  say: Say,
  o: {
    showTips: boolean;
    showIds: boolean;
    ctx: SettingsCtx;
    blocks: ReadonlyArray<{ id: string; name: string }>;
    checkName: (name: string) => string;
    holdKeys?: (onEscape: () => void) => () => void;
  },
): void {
  let answered = false;
  const finish = (answer: NewField | null): void => {
    if (answered) return;
    answered = true;
    done(answer);
  };
  const vault = (app as { vault?: VaultLike }).vault;
  const cache = (app as { metadataCache?: { getFirstLinkpathDest?: (t: string, from: string) => unknown } }).metadataCache;
  const files = (): VaultFile[] => (vault && typeof vault.getAllLoadedFiles === "function" ? vault.getAllLoadedFiles() : []);

  class AddFieldModal extends Modal {
    drop: () => void = () => {};

    override onOpen(): void {
      this.drop = renderNewFieldForm(this.contentEl, {
        say, ctx: o.ctx, showTips: o.showTips, showIds: o.showIds, blocks: o.blocks, checkName: o.checkName,
        ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
        notes: () => files().filter(f => /\.md$/i.test(f.path)).map(f => f.path),
        folders: () => files().filter(f => Array.isArray(f.children) && f.path && f.path !== "/").map(f => f.path),
        noteExists: t => !!(cache && typeof cache.getFirstLinkpathDest === "function" && cache.getFirstLinkpathDest(t, "")),
        folderNotes: folder => files()
          .filter(f => /\.md$/i.test(f.path) && f.parent && f.parent.path === folder)
          .map(f => f.path.replace(/\.md$/i, "")),
        done: answer => { finish(answer); this.close(); },
      });
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой ответ. */
      finish(null);
      this.drop();
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new AddFieldModal(app).open());
}

/**
 * **Переименование Value-ссылки называет цену** — его пункт 2026-09-27 к тесту 7
 * цикла 97. Цену считает `linkValueRenameImpact` (платформа: кэш ссылок и
 * поиск заметки). Окна нет, когда ссылок на старое имя нет вовсе.
 *
 * **Окно открывается с первой буквы, а имя допечатывается в нём** — его
 * замечание к тесту 2 цикла 98 (2026-09-28): «если я не нажимаю enter (просто
 * изменяю значение в textbox), то уведомление не появляется». Стенд показал
 * хуже: закрыв настройки с набранным именем, он терял правку молча. Теперь
 * поле Value зовёт окно на первом же `input` (`live`), фокус и набранное
 * уходят в поле окна, цена пересчитывается на каждой букве — «занято» видно
 * до нажатия. `Enter` — главное действие окна, `Esc` — отказ.
 *
 * Дорога одна: при «Rename note and links» сперва пишется Value, потом
 * переименовывается заметка — `fileManager.renameFile`, и ссылки переписывает
 * сам Obsidian. Следствие «Value идёт за заметкой» (F16) находит Value уже
 * переименованным и второй записи не делает.
 *
 * Ответ — открылось ли окно: у `live` без ссылок окна нет, и поле остаётся
 * обычным полем до ухода фокуса.
 */
function askLinkValueRenameModal(
  Modal: ModalCtor,
  app: unknown,
  oldToken: string,
  nextToken: string,
  apply: (name: string) => void,
  revert: () => void,
  say: Say,
  notice: (text: string) => void,
  live = false,
): boolean {
  const impactOf = (name: string): LinkRenameImpact | null =>
    linkRename.linkValueRenameImpact(app, oldToken, name) as LinkRenameImpact | null;
  const first = impactOf(nextToken);
  if (!first || !first.links) {
    if (!live) apply(nextToken);
    return false;
  }
  const count = (n: number, one: string, many: string): string => say(n === 1 ? one : many, n);
  const vault = (app as { vault?: { getConfig?: (k: string) => unknown } }).vault;
  /* Проба: `getConfig` у vault внутренний, и «нет» — ответ, а не отказ. */
  const asksFirst = !!vault && typeof vault.getConfig === "function" && vault.getConfig("alwaysUpdateLinks") === false;

  let name = nextToken;
  let impact: LinkRenameImpact = first;
  let answered = false;
  const finish = (choice: "note" | "value" | null): void => {
    if (answered) return;
    answered = true;
    const next = name.trim();
    if (!choice || !next || next === oldToken) { revert(); return; }
    apply(next);
    if (choice !== "note" || !impact.file) return;
    const fm = (app as { fileManager?: { renameFile?: (f: unknown, p: string) => Promise<void> } }).fileManager;
    if (!fm || typeof fm.renameFile !== "function") return;
    fm.renameFile(impact.file, impact.newPath || "").catch((e: unknown) => {
      notice(say("LINK_RENAME_FAILED", String((e as { message?: string }) && (e as { message?: string }).message || e)));
    });
  };

  class LinkValueRenameModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      const title = el(box, "h4", "io-dlg__title", "");
      const input = box.createEl("input", {
        cls: "io-text io-text--mono io-dlg__name", type: "text", value: name,
        attr: { "aria-label": say("LINK_RENAME_NAME_ARIA", oldToken) },
      }) as unknown as El & { value: string; focus?: () => void; setSelectionRange?: (a: number, b: number) => void };
      const body = el(box, "div", "io-dlg__body");
      const foot = el(box, "div", "io-dlg__foot");
      let primary: "note" | "value" = "value";
      const draw = (): void => {
        const fresh = impactOf(name);
        if (fresh) impact = fresh;
        const kind = impact.kind;
        const same = !name.trim() || name.trim() === oldToken;
        const words = [oldToken, impact.oldTarget, impact.newTarget,
          count(impact.links, "LINK_RENAME_LINKS_ONE", "LINK_RENAME_LINKS_MANY"),
          count(impact.notes, "LINK_RENAME_NOTES_ONE", "LINK_RENAME_NOTES_MANY")] as const;
        title.textContent = say(kind === "note" ? "LINK_RENAME_TITLE" : kind === "clash" ? "LINK_RENAME_CLASH_TITLE" : "LINK_RENAME_NONE_TITLE");
        body.empty();
        rich(el(body, "p", "io-item__desc"),
          say(kind === "note" ? "LINK_RENAME_NOTE_BODY" : kind === "clash" ? "LINK_RENAME_CLASH_BODY" : "LINK_RENAME_NONE_BODY", ...words));
        if (kind === "note") {
          const warn = el(body, "div", "io-dlg__warn");
          rich(el(warn, "p", "io-item__desc"), say("LINK_RENAME_NOTE_ONLY", ...words));
          if (asksFirst) rich(el(warn, "p", "io-item__desc"), say("LINK_RENAME_ASKS_FIRST"));
        }
        foot.empty();
        const button = (text: string, cls: string, choice: "note" | "value" | null): void => {
          const b = foot.createEl("button", { cls, text, attr: { type: "button" } }) as unknown as El & { disabled: boolean };
          if (choice && same) b.disabled = true;
          b.addEventListener("click", (() => { finish(choice); this.close(); }) as never);
        };
        button(say("CANCEL"), "io-btn", null);
        if (kind === "note") {
          button(say("LINK_RENAME_VALUE"), "io-btn", "value");
          button(say("LINK_RENAME_BOTH"), "io-btn io-btn--cta", "note");
          primary = "note";
        } else {
          button(say("LINK_RENAME_VALUE_CTA"), "io-btn io-btn--cta", "value");
          primary = "value";
        }
      };
      input.addEventListener("input", (() => { name = String(input.value || ""); draw(); }) as never);
      input.addEventListener("keydown", ((e: { key?: string; preventDefault?: () => void }) => {
        if (!e || e.key !== "Enter") return;
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (!name.trim() || name.trim() === oldToken) return;
        finish(primary);
        this.close();
      }) as never);
      draw();
      /* Фокус — в поле имени, каретка в конец: набор продолжается здесь. */
      const focusName = (): void => {
        if (typeof input.focus === "function") input.focus();
        if (typeof input.setSelectionRange === "function") input.setSelectionRange(name.length, name.length);
      };
      focusName();
      setTimeout(focusName, 0);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — отказ: поле возвращается к прежнему Value. */
      finish(null);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new LinkValueRenameModal(app).open());
  return true;
}

/**
 * Подтверждение удаления Field. Удаление уносит с собой Values, цвета и
 * свойство заметки, и переспросить дешевле, чем восстанавливать.
 */
function confirmDeleteModal(
  Modal: ModalCtor,
  app: unknown,
  fieldName: string,
  done: (yes: boolean) => void,
  say: Say,
  /* Окно удаления custom block — то же окно со своими словами (PRD 10.13.260). */
  words?: { title: string; body: string },
): void {
  let answered = false;
  const finish = (yes: boolean): void => {
    if (answered) return;
    answered = true;
    done(yes);
  };

  class DeleteFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", "io-dlg__title", words ? words.title : say("DELETE_TITLE"));
      el(box, "p", "io-item__desc", words ? words.body : say("DELETE_BODY", fieldName));
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(false); this.close(); }) as never);
      const del = foot.createEl("button",
        { cls: "io-danger", text: say("DELETE_CONFIRM"), attr: { type: "button" } });
      del.addEventListener("click", (() => { finish(true); this.close(); }) as never);
    }

    override onClose(): void {
      finish(false);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new DeleteFieldModal(app).open());
}

/**
 * Окно «Rename Field»: новое имя и цена, которую за него платят.
 *
 * Решение заказчика 2026-08-31 по замечанию 1.4.1.2.2: переименовывать
 * системное имя можно, но молча — нельзя. Имя стоит в ваших заметках и в
 * идентификаторах команд Field, и после переименования старый тег в заметках
 * остаётся, а назначенный хоткей отвязывается: Obsidian держит хоткей за
 * идентификатором, а тот собран из имени.
 *
 * Поэтому окно не спрашивает «уверены?» — оно **перечисляет последствия**.
 */
function askRenameModal(
  Modal: ModalCtor,
  app: unknown,
  current: string,
  done: (next: string | null) => void,
  say: Say,
  /*
   * Имя custom block: окно то же, что у Field (PRD 10.13.260, пункт 1), но
   * цены у него нет — хоткей держится за `id` блока, а не за имя, и в
   * заметках блок своего имени не пишет.
   */
  block?: boolean,
): void {
  let answered = false;
  const finish = (next: string | null): void => {
    if (answered) return;
    answered = true;
    done(next);
  };

  class RenameFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", "io-dlg__title", say(block ? "RENAME_BLOCK_TITLE" : "RENAME_TITLE"));

      const row = el(box, "div", "io-item");
      const info = el(row, "div", "io-item__info");
      el(info, "div", "io-item__name", say("RENAME_LABEL"));
      el(info, "div", "io-item__desc", say(block ? "RENAME_BLOCK_HINT" : "RENAME_HINT"));
      const input = el(row, "div", "io-item__control").createEl("input", {
        cls: block ? "io-text" : "io-text io-text--mono",
        type: "text",
        value: current,
        attr: { "aria-label": say(block ? "RENAME_BLOCK_ARIA" : "RENAME_ARIA", current) },
      }) as El & { value: string };

      /* Цена названа до нажатия, а не после (З8 наоборот: это человеку). */
      if (!block) {
        const warn = el(box, "div", "io-dlg__warn");
        el(warn, "p", "io-item__desc", say("RENAME_WARNING"));
        const list = el(warn, "ul", "io-dlg__list");
        el(list, "li", "io-item__desc", say("RENAME_WARNING_NOTES"));
        el(list, "li", "io-item__desc", say("RENAME_WARNING_HOTKEY"));
      }

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const go = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: say("RENAME_CONFIRM"),
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      const same = (): boolean =>
        !String(input.value || "").trim() || String(input.value || "").trim() === current;
      go.disabled = same();
      input.addEventListener("input", (() => { go.disabled = same(); }) as never);
      go.addEventListener("click", (() => {
        if (same()) return;
        finish(String(input.value || "").trim());
        this.close();
      }) as never);
    }

    override onClose(): void {
      finish(null);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new RenameFieldModal(app).open());
}

/* ---- блок --------------------------------------------------------------- */

const VIEW_STATE = new WeakMap<object, FieldsViewState>();

export const fieldsEditor: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-fieldsblock");

  /*
   * Без платформы блок не рисуется, и это не пользовательская ситуация:
   * платформу передаёт либо плагин, либо проверка. Молча оставить пустое
   * место хуже, чем не показать блок вовсе.
   */
  if (!p) return () => { box.empty(); };

  const Modal = p.Modal as ModalCtor;
  const app = (p.plugin as { app?: unknown }).app;
  const notice = (text: string): void => {
    const N = p.Notice as new (message: string) => unknown;
    try { new N(text); } catch { console.error("inline-overhaul: " + text); }
  };

  /*
   * Выбранный Field — состояние вида, в конфиг не пишется (О0). Живёт у
   * платформы, а не у блока: пересборка вкладки (новый Field меняет список
   * `Left Block active Field` на той же вкладке) рисует блок заново, и
   * состояние в замыкании блока сбрасывало выбор к первому Field.
   */
  let state = VIEW_STATE.get(p);
  if (!state) { state = { selected: "" }; VIEW_STATE.set(p, state); }

  /*
   * Перерисовка идёт подменой узла, а не очисткой на месте. Причина из
   * практики: заказчик выключил модуль, отрисовка не удалась, и редактор
   * исчез до перезапуска Obsidian. Теперь неудачная попытка выбрасывается
   * целиком, а на экране остаётся то, что работало.
   */
  let mounted: El | null = null;
  let closeMounted: (() => void) | null = null;
  const draw = (): void => {
    /*
     * Скролл и фокус снимаются ДО подмены узла и возвращаются после неё
     * (дефект A8). Каждый контрол редактора зовёт `redraw`, и без этого
     * панель прыгала к началу на любое нажатие, а поле ввода теряло каретку
     * (замечание заказчика 2026-08-27).
     */
    const keep = keepView(box);
    const next = el(box, "div", "io-fieldsblock__mount");
    let close: () => void;
    try {
      /*
       * Модель собирается на каждой отрисовке: она снимает конфиг, а конфиг
       * между отрисовками меняется — и её же записями тоже.
       */
      const model = createFieldsModel({
        plugin: p.plugin as never,
        normalizePkmOrder: p.normalizePkmOrder as never,
        pkmOrderFields: p.pkmOrderFields,
        cfg: p.getConfig() as never,
        deepState,
      });
      const say = sayIn("field-editor", ctx);
      close = renderFieldsEditor(next, {
        model,
        ctx,
        state,
        enabled: Boolean(ctx.get("features.pkm.enabled")),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        redraw: () => { draw(); },
        ...(() => {
          /* Над окном настроек — область приложения: там живут хоткеи. */
          const holdKeys = escapeScope(p.Scope, app, app && (app as { scope?: unknown }).scope);
          return holdKeys ? { holdKeys } : {};
        })(),
        notice,
        askNewField: done => askNewFieldModal(Modal, app, done, say, {
          showTips: Boolean(ctx.get("general.help.showTips")),
          showIds: Boolean(ctx.get("advanced.showSettingIds")),
          ctx,
          blocks: model.listBlocks().map(b => ({ id: b.id, name: b.name })),
          checkName: n => model.fieldNameError(n),
          ...(() => {
            const holdKeys = escapeScope(p.Scope, app, app && (app as { scope?: unknown }).scope);
            return holdKeys ? { holdKeys } : {};
          })(),
        }),
        confirmDeleteField: (name, done) => confirmDeleteModal(Modal, app, name, done, say),
        askLinkValueRename: (oldToken, nextToken, apply, revert, live) =>
          askLinkValueRenameModal(Modal, app, oldToken, nextToken, apply, revert, say, notice, live),
        askRename: (name, done) => askRenameModal(Modal, app, name, done, say),
        askRenameBlock: (name, done) => askRenameModal(Modal, app, name, done, say, true),
        confirmDeleteBlock: (name, fields, done) => confirmDeleteModal(Modal, app, name, done, say, {
          title: say("DELETE_BLOCK_TITLE"),
          body: say("DELETE_BLOCK_BODY", name, fields.length, fields.join(", ")),
        }),
      });
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: редактор Fields не отрисовался", e);
      return;
    }
    if (closeMounted) closeMounted();
    if (mounted) mounted.remove();
    mounted = next;
    closeMounted = close;
    /* Только теперь: пока в дереве стоят оба поддерева, высота больше
       настоящей, и возвращённая прокрутка была бы не той. */
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(EDITOR_PATHS, draw);
  return () => {
    unwatch();
    if (closeMounted) closeMounted();
    closeMounted = null;
    mounted = null;
    box.empty();
  };
};
