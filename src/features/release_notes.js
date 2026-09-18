"use strict";

/**
 * Окно «что изменилось» после обновления плагина.
 *
 * **Его слово 2026-09-16 (Р14):** «хочу, чтобы при обновлении версии плагина в
 * obsidian появлялся changelog, где лаконично объясняется что изменилось».
 *
 * **Текст один, и дом у него один — `CHANGELOG.md`.** Собирать его из коммитов
 * значило бы завести второй рассказ о том же выпуске, и разошлись бы они в
 * первый же день. В релизе три файла, и `CHANGELOG.md` среди них нет, поэтому
 * разделы вкладываются в сборку шагом сборки — `build/gen_release_notes.js`.
 *
 * **Показывается один раз на версию.** Признак «уже показывали» — ключ в
 * состоянии плагина (`viewState.releaseNotesShownFor`), а не файл рядом с
 * плагином: файл переживает удаление плагина и лечится только руками. Тем же
 * ключом живёт уведомление о смене идентификаторов команд.
 *
 * **На свежей установке окно не открывается.** Человеку, поставившему плагин
 * впервые, рассказ о том, что изменилось **с прошлой версии**, читать не о
 * чем: прошлой версии у него не было. Признак свежей установки — конфиг,
 * который плагин только что создал сам; тогда версия просто запоминается.
 *
 * **Окно, а не `Notice`.** Текст многострочный, и уведомление Obsidian гасит
 * себя по времени: прочесть раздел в нём нельзя.
 */

const __releaseNotes = require("../generated/release_notes.json");
const __sharedUtils = require("../core/shared_utils.js");

const SHOWN_KEY = "viewState.releaseNotesShownFor";

/** Раздел заметок для этой версии; пусто — значит показывать нечего. */
function releaseNotesFor(version) {
  const v = String(version || "").trim();
  if (!v) return "";
  const notes = __releaseNotes && typeof __releaseNotes === "object" ? __releaseNotes : {};
  return String(notes[v] || "").trim();
}

/**
 * Показывать ли окно, и что в нём будет.
 *
 * Чистое решение, отдельно от отрисовки: у него три входа и ни одного обращения
 * к Obsidian, поэтому проверка спрашивает его прямо, а не через окно.
 *
 * `decision`:
 *   `show`        — версия сменилась, и раздел для неё есть;
 *   `remember`    — показывать нечего, но версию надо запомнить (свежая
 *                   установка или выпуск без раздела);
 *   `done`        — эту версию уже показывали;
 */
function planReleaseNotes(options) {
  const opts = options && typeof options === "object" ? options : {};
  const version = String(opts.version || "").trim();
  const shownFor = String(opts.shownFor || "").trim();
  const freshInstall = opts.freshInstall === true;
  if (!version) return { decision: "done", version: "", text: "" };
  if (shownFor === version) return { decision: "done", version, text: "" };
  const text = releaseNotesFor(version);
  if (freshInstall || !text) return { decision: "remember", version, text: "" };
  return { decision: "show", version, text };
}

/**
 * Отрисовка: заголовок, текст раздела и кнопка.
 *
 * **Разметку разбирает платформа** (замечание заказчика 2026-09-19, пункт 8:
 * «при обновлении плагина открывается changelog и он выглядит некрасиво»).
 * Раздел написан на markdown, и до этого дня он показывался как написан —
 * `### Changed` строкой, звёздочки вокруг слов, дефис вместо списка. Своего
 * разборщика здесь быть не должно: это третье объявление правила о чужой
 * разметке (У-96). Зовётся `MarkdownRenderer.render`, а жизненный цикл, ради
 * которого его прежде обходили, приезжает тем же швом — `Component` грузится
 * при открытии и выгружается при закрытии.
 *
 * `ui` — то, что даёт платформа: `Component` и `MarkdownRenderer`. Их
 * отсутствие — проба, а не отказ загрузки: текст показывается как написан, и
 * об этом говорится в журнал разработчика (правило отказов, вид второй).
 */
function openReleaseNotesModal(plugin, ModalClass, version, text, ui) {
  if (!plugin || !plugin.app || typeof ModalClass !== "function") {
    throw new Error("release_notes: Obsidian Modal unavailable");
  }
  const parts = ui && typeof ui === "object" ? ui : {};
  const ComponentClass = parts.Component;
  const Renderer = parts.MarkdownRenderer;
  const canRender = typeof ComponentClass === "function"
    && Renderer && typeof Renderer.render === "function";
  const app = plugin.app;
  class ReleaseNotesModal extends ModalClass {
    onOpen() {
      this.titleEl.setText("inlineOverhaul " + version + ": what changed");
      /* Вид — классами (Р7); правила лежат в `styles.css`, разделом «Окна
         плагина вне панели». `markdown-rendered` — имя платформы: под ним
         лежат её же правила для заголовков, списков и кода. */
      const body = this.contentEl.createDiv({ cls: "io-relnotes__text markdown-rendered" });
      if (canRender) {
        this.io_notes = new ComponentClass();
        this.io_notes.load();
        /* Путь пустой: относительных ссылок в разделе нет, а файла, от
           которого их считать, у окна тоже нет. */
        Promise.resolve(Renderer.render(app, text, body, "", this.io_notes))
          .catch((e) => console.error("[inline-overhaul][release-notes]", e));
      } else {
        console.error("[inline-overhaul][release-notes] MarkdownRenderer unavailable");
        const raw = body.createEl("pre", { cls: "io-relnotes__raw" });
        raw.setText(text);
      }
      const actions = this.contentEl.createDiv({ cls: "io-relnotes__actions" });
      const close = actions.createEl("button", { text: "Got it" });
      close.classList.add("mod-cta");
      close.addEventListener("click", () => this.close());
    }
    onClose() {
      if (this.io_notes) { this.io_notes.unload(); this.io_notes = null; }
      this.contentEl.empty();
    }
  }
  new ReleaseNotesModal(plugin.app).open();
}

/**
 * Шов загрузки: спросить решение, показать окно и запомнить версию.
 *
 * Отказ здесь громкий в журнал, а не человеку: окно — украшение поверх работы
 * плагина, и уронить загрузку ради него нельзя (правило отказов, вид второй).
 */
async function showReleaseNotesOnUpdate(plugin, deps) {
  const d = deps && typeof deps === "object" ? deps : {};
  try {
    const version = String(d.version || "").trim();
    const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
    const shownFor = String(__sharedUtils.readCfgPath(cfg, SHOWN_KEY) || "").trim();
    const plan = planReleaseNotes({
      version,
      shownFor,
      freshInstall: d.freshInstall === true,
    });
    if (plan.decision === "done") return plan;
    if (plan.decision === "show") {
      openReleaseNotesModal(plugin, d.Modal, plan.version, plan.text, d);
    }
    await plugin.store.patch(
      { viewState: { releaseNotesShownFor: plan.version } },
      "release-notes:shown",
      { undoable: false }
    );
    return plan;
  } catch (e) {
    console.error("[inline-overhaul][release-notes]", e);
    return { decision: "done", version: "", text: "" };
  }
}

module.exports = {
  SHOWN_KEY,
  releaseNotesFor,
  planReleaseNotes,
  openReleaseNotesModal,
  showReleaseNotesOnUpdate,
};
