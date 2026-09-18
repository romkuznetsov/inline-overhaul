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

/**
 * Полный рассказ о выпусках — там, где он и накапливается.
 *
 * **Адрес объявлен один раз** и читается обоими местами, которым он нужен:
 * ссылкой в самом окне и кнопкой `Changelog` в панели. Второй литерал того же
 * адреса разошёлся бы с первым при первом же переезде репозитория, и заметил
 * бы это человек, а не проверка.
 */
const CHANGELOG_URL = "https://github.com/romkuznetsov/inline-overhaul/blob/main/CHANGELOG.md";

/**
 * Сколько выпусков окно показывает за раз.
 *
 * **Его слово 2026-09-19:** «лучше N версий с последнего обновления плагина
 * (т.е. если последнее обновление было 2 релиза назад, то в этом чейнджлоге
 * должны показываться изменения в этих двух версиях)». Предел нужен другой
 * половине того же письма — «текста много»: человек, обновившийся через
 * десять выпусков, получил бы простыню. Дальше — ссылка на полный рассказ.
 */
const MAX_SECTIONS = 5;

/** Раздел заметок для этой версии; пусто — значит показывать нечего. */
function releaseNotesFor(version) {
  const v = String(version || "").trim();
  if (!v) return "";
  const notes = __releaseNotes && typeof __releaseNotes === "object" ? __releaseNotes : {};
  return String(notes[v] || "").trim();
}

/**
 * Сравнение версий: числа по частям, предвыпуск слабее выпуска.
 *
 * Свой разбор здесь потому, что сравнивать надо **ровно наши** номера, а их
 * форма задана `docs/VERSIONING.md`: три числа и, у бет, хвост через дефис.
 * Ответ — знак, как у любого сравнителя.
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
  /* Хвоста нет — это выпуск, и он старше любой своей беты. */
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
 * Выпуски, о которых человеку ещё не рассказывали: строго после `shownFor` и
 * не новее нынешней версии, новые сверху.
 *
 * **Прежней версии можно не знать** — человек мог не обновляться с тех пор,
 * как окна не было вовсе. Тогда рассказывается про одну нынешнюю: показать
 * всю историю значило бы встретить его той самой простынёй, на которую он
 * пожаловался.
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

/**
 * Разделы в один текст для окна.
 *
 * Один выпуск — без заголовка с номером: его уже сказал заголовок окна.
 * Несколько — каждый под своим номером, иначе человек не поймёт, где кончается
 * один выпуск и начинается другой.
 */
function buildReleaseNotesText(sections) {
  const list = Array.isArray(sections) ? sections.filter((s) => s && s.text) : [];
  if (!list.length) return "";
  if (list.length === 1) return String(list[0].text).trim();
  return list
    .map((s) => "## " + String(s.version).trim() + "\n\n" + String(s.text).trim())
    .join("\n\n");
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
  /*
   * Рассказ собирается по **всем** пропущенным выпускам — его слово
   * 2026-09-19. Раздел нынешней версии в этом наборе есть всегда: без него
   * решение было бы `remember` строкой выше.
   */
  const sections = releaseNotesSince(shownFor, version);
  return { decision: "show", version, text: buildReleaseNotesText(sections), sections };
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
      /*
       * **Ссылка на полный рассказ** — его слово 2026-09-19: «в плагине должна
       * быть ссылка на changelog.md в репозитории github». Настоящая ссылка, а
       * не строка markdown внутри текста: текст приходит из `CHANGELOG.md`, и
       * дописывать в него ссылку на него же значило бы править чужой дом.
       */
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
