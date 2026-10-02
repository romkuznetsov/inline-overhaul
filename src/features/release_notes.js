"use strict";

/**
 * Окно «что изменилось» после обновления плагина (Р14).
 *
 * Текст один — `CHANGELOG.md`; в релизе его нет, разделы вкладывает в сборку
 * `build/gen_release_notes.js`. Один раз на версию: признак —
 * `viewState.releaseNotesShownFor` в состоянии плагина, а не файл (файл
 * переживает удаление плагина). На свежей установке (конфиг только что создан
 * плагином) окно не открывается — версия запоминается. Окно, а не `Notice`:
 * уведомление гаснет по времени.
 */

const __releaseNotes = require("../generated/release_notes.json");
const __sharedUtils = require("../core/shared_utils.js");

const SHOWN_KEY = "viewState.releaseNotesShownFor";

/** Полный рассказ о выпусках; адрес объявлен один раз — для окна и кнопки `Changelog` в панели. */
const CHANGELOG_URL = "https://github.com/romkuznetsov/inline-overhaul/blob/main/CHANGELOG.md";

/** Сколько выпусков окно показывает за раз (2026-09-19); дальше — ссылка на полный рассказ. */
const MAX_SECTIONS = 5;

/** Раздел заметок для этой версии; пусто — значит показывать нечего. */
function releaseNotesFor(version) {
  const v = String(version || "").trim();
  if (!v) return "";
  const notes = __releaseNotes && typeof __releaseNotes === "object" ? __releaseNotes : {};
  return String(notes[v] || "").trim();
}

/**
 * Сравнение версий: числа по частям, предвыпуск слабее выпуска. Форма номеров —
 * `docs/dev/VERSIONING.md`. Ответ — знак.
 */
function compareVersions(a, b) {
  const split = (v) => {
    const s = String(v || "").trim();
    const dash = s.indexOf("-");
    const head = dash === -1 ? s : s.slice(0, dash);
    const tail = dash === -1 ? "" : s.slice(dash + 1);
    const nums = head.split(".").map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
    while (nums.length < 3) nums.push(0);
    return { nums, tail };
  };
  const left = split(a);
  const right = split(b);
  for (let i = 0; i < 3; i++) {
    if (left.nums[i] !== right.nums[i]) return left.nums[i] < right.nums[i] ? -1 : 1;
  }
  /* Хвоста нет — выпуск, он старше любой своей беты. */
  if (left.tail === right.tail) return 0;
  if (!left.tail) return 1;
  if (!right.tail) return -1;
  return left.tail < right.tail ? -1 : 1;
}

/** Есть ли у нас раздел про эту версию — по номеру, а не по порядку в файле. */
function knownVersions() {
  const notes = __releaseNotes && typeof __releaseNotes === "object" ? __releaseNotes : {};
  return Object.keys(notes)
    .filter((v) => String(notes[v] || "").trim())
    .sort((a, b) => compareVersions(b, a));
}

/**
 * Выпуски строго после `shownFor` и не новее нынешней, новые сверху. Прежняя
 * версия неизвестна — только нынешняя, не вся история.
 */
function releaseNotesSince(shownFor, version) {
  const now = String(version || "").trim();
  if (!now) return [];
  const from = String(shownFor || "").trim();
  const mine = releaseNotesFor(now);
  const one = mine ? [{ version: now, text: mine }] : [];
  if (!from || compareVersions(from, now) >= 0) return one;
  const picked = knownVersions()
    .filter((v) => compareVersions(v, from) > 0 && compareVersions(v, now) <= 0)
    .slice(0, MAX_SECTIONS)
    .map((v) => ({ version: v, text: releaseNotesFor(v) }));
  return picked.length ? picked : one;
}

/** Разделы в один текст. Один выпуск — без заголовка с номером (его говорит окно). */
function buildReleaseNotesText(sections) {
  const list = Array.isArray(sections) ? sections.filter((s) => s && s.text) : [];
  if (!list.length) return "";
  if (list.length === 1) return String(list[0].text).trim();
  return list
    .map((s) => "## " + String(s.version).trim() + "\n\n" + String(s.text).trim())
    .join("\n\n");
}

/**
 * Показывать ли окно и что в нём. Чистое решение без Obsidian — проверяется прямо.
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
  /* Все пропущенные выпуски (2026-09-19); раздел нынешней есть всегда — иначе было бы `remember`. */
  const sections = releaseNotesSince(shownFor, version);
  return { decision: "show", version, text: buildReleaseNotesText(sections), sections };
}

/**
 * Отрисовка: заголовок, текст раздела, кнопка. Markdown разбирает платформа —
 * `MarkdownRenderer.render`, своего разборщика быть не должно (2026-09-19 п. 8,
 * У-96); `Component` грузится при открытии и выгружается при закрытии.
 *
 * `ui` — `Component` и `MarkdownRenderer` платформы. Их нет — текст как
 * написан, сообщение в журнал (правило отказов, вид второй).
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
      /* Вид — классами (Р7), правила в `styles.css` («Окна плагина вне панели»);
         `markdown-rendered` — класс платформы с её правилами разметки. */
      const body = this.contentEl.createDiv({ cls: "io-relnotes__text markdown-rendered" });
      if (canRender) {
        this.io_notes = new ComponentClass();
        this.io_notes.load();
        /* Путь пустой: относительных ссылок в разделе нет, файла у окна тоже. */
        Promise.resolve(Renderer.render(app, text, body, "", this.io_notes))
          .catch((e) => console.error("[inline-overhaul][release-notes]", e));
      } else {
        console.error("[inline-overhaul][release-notes] MarkdownRenderer unavailable");
        const raw = body.createEl("pre", { cls: "io-relnotes__raw" });
        raw.setText(text);
      }
      /* Ссылка на полный рассказ (2026-09-19) — узлом, а не дописью в текст из `CHANGELOG.md`. */
      const more = this.contentEl.createDiv({ cls: "io-relnotes__more" });
      const link = more.createEl("a", { text: "Full changelog on GitHub" });
      link.setAttribute("href", CHANGELOG_URL);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
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
 * Шов загрузки: решение, окно, запомнить версию. Отказ — в журнал, загрузку
 * не роняет (правило отказов, вид второй).
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
  CHANGELOG_URL,
  MAX_SECTIONS,
  compareVersions,
  knownVersions,
  releaseNotesSince,
  buildReleaseNotesText,
  releaseNotesFor,
  planReleaseNotes,
  openReleaseNotesModal,
  showReleaseNotesOnUpdate,
};
