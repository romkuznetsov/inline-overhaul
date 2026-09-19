"use strict";

/**
 * Автоматическая копия `data.json` — его заказ З-11, 2026-09-19.
 *
 * **Его слово:** «для безопасности нужно добавить возможность откатa data.json
 * на предыдущий вариант (до изменения) — делать автоматический backup настроек
 * перед изменением… Нужно добавить контрол в settings-backup `Autosave` =
 * on/off… Этот бэкап должен быть максимальный (т.е. все хоткеи и вкладки). В
 * бэкапе под хедером комментария (над json block) должны добавляться детали —
 * что изменилось. В названии заметки бэкапа должна быть приставка
 * `_autosave`… Может быть сделать так, чтобы при on при каждом открытии
 * плагина выполнялся быстрый чек на соответствие текущего data.json и json
 * codeblock в последнем md autosave — при расхождении создаёт новый md
 * autosave — с комментарием что изменилось».
 *
 * **Момент съёма выбрал он** (`В-147`, 2026-09-19): при открытии плагина, если
 * файл разошёлся с последней автокопией. Цена этому выбору — одна заметка на
 * сессию Obsidian (23 КБ на его настройках) против двадцати заметок и 454 КБ
 * при копии на каждую правку.
 *
 * **Что этот момент ловит.** Файл, пришедший снаружи: синхронизация, второе
 * устройство, копия из другого vault — ровно тот случай, ради которого он
 * просил (его замечание `C1`). И каждая сессия начинается со снимка «как было
 * до сегодняшних правок». Откат на один шаг внутри сессии остаётся за командой
 * `Undo last settings change` — это разные вопросы, и слитые в один они дали бы
 * ту самую простыню из заметок.
 *
 * **Дом правил — `settings_backup.js`:** имя с приставкой, разбор заметки,
 * список «что изменилось» и отбор устаревших копий живут там же, где всё
 * остальное про копии. Здесь только шов с миром — vault и журнал.
 *
 * **Отказ громкий в журнал, а не человеку** (правило отказов, вид второй):
 * копия — страховка поверх работы плагина, и уронить загрузку она не имеет
 * права. Человек, у которого автокопия не снялась, узнает об этом из журнала
 * разработчика, потому что `Notice` при каждом запуске Obsidian он выключит
 * первым делом.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __backup = require("./settings_backup.js");
/* Видимый текст по ключу каталога: свой литерал здесь был бы вторым домом. */
const __changeWords = require("./settings_change_words.js");
const __sayModule = require("../core/say.js");
const __say = __sayModule.say;
const __noticeKey = __sayModule.noticeKey;

/** Путь тумблера. Умолчание — в схеме панели, выводимой из прототипа. */
const AUTOSAVE_KEY = "advanced.backups.autosave";

/**
 * Сколько автокопий держать.
 *
 * Названо здесь и **печатается в отчёте**: при одной заметке на сессию это два
 * с половиной месяца работы, и предел нужен затем, чтобы папка копий не росла
 * бесконечно. Контролом это не сделано нарочно — он не просил числа, а лишняя
 * строка в панели стоит дороже, чем разумное умолчание (У-156).
 */
const AUTOSAVE_KEEP = 10;

/** Сколько строк «что изменилось» попадает в заметку; остаток — числом. */
const AUTOSAVE_DETAIL_LINES = 20;

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/** Включена ли автокопия. Ответ «нет» — это ответ, а не отказ. */
function autosaveEnabled(cfg) {
  return readCfgPath(cfg, AUTOSAVE_KEY) === true;
}

/**
 * Та часть конфига, которая и есть **настройки**.
 *
 * **Его замечание 2026-09-19, второй заход:** «сейчас autosave слишком
 * чувствительный — он делает автосохранение, даже если изменилась активная
 * панель в настройках `ui.activeSettingsTab` — это лишнее, должно
 * автосохраняться только при изменении настроек (изменение значений
 * контролов)». Он прав, и причина измерима: `selectParts` отбирает **не**
 * ветки вкладок, а «всё, кроме чужих вкладок и локального для устройства», —
 * то есть верхняя ветка `ui`, которой нет ни в одной вкладке, проходила
 * насквозь. Каждое переключение вкладки панели меняло сравниваемое, и копия
 * снималась на ровном месте.
 *
 * **Отбор написан свойством, а не списком имён** (У-201): берутся ровно те
 * ветки, которые названы вкладками (`PART_BRANCHES`), и ничего больше. Новая
 * ветка состояния панели, заведённая когда-нибудь потом, в сравнение не
 * попадёт сама собой — её просто нет в списке вкладок.
 *
 * Заметка при этом по-прежнему пишется полной (`selectParts` со всеми
 * частями): в неё `ui` попадает и возвращается при восстановлении, как
 * возвращался всегда. Сравнение и содержимое — два разных вопроса.
 */
function comparableConfig(cfg) {
  const src = isObj(cfg) ? cfg : {};
  const out = {};
  for (const key of Object.keys(__backup.PART_BRANCHES)) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return JSON.parse(JSON.stringify(out));
}

/**
 * Снять копию, если нынешние настройки разошлись с последней автокопией.
 *
 * `deps` — шов с vault: `list`, `read`, `create`, `ensureFolder`, `remove`.
 * Отсутствие шва — не отказ загрузки, а «делать нечего»: так же устроены все
 * остальные пробы платформы.
 *
 * Ответ говорит, что случилось: `off` — тумблер выключен, `no-vault` — шва
 * нет, `same` — файл совпал с последней копией, `saved` — копия снята,
 * `failed` — не получилось (и об этом уже сказано в журнал).
 */
async function autosaveOnLoad(plugin, deps) {
  const d = isObj(deps) ? deps : {};
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  if (!autosaveEnabled(cfg)) return { decision: "off" };
  if (typeof d.list !== "function" || typeof d.create !== "function") {
    console.error("[inline-overhaul][autosave] нет шва к vault: копия не снята");
    return { decision: "no-vault" };
  }
  try {
    const folder = __backup.backupFolder(cfg);
    const found = await d.list(folder);
    const paths = (Array.isArray(found) ? found : [])
      .map((x) => (typeof x === "string" ? x : String((x && x.path) || "")))
      .filter(__backup.isAutosavePath)
      .sort();
    const now = comparableConfig(cfg);
    let previous = null;
    const newest = paths.length ? paths[paths.length - 1] : "";
    if (newest && typeof d.read === "function") {
      try {
        previous = __backup.parseBackupNote(await d.read(newest));
      } catch (e) {
        /*
         * Прежняя копия не прочиталась — заметку правил человек, или она
         * оборвана. Это **повод снять новую**, а не отказ: сравнивать не с
         * чем, значит нынешнее состояние не сохранено нигде.
         */
        console.error("[inline-overhaul][autosave] последняя копия не прочиталась: " + newest, e);
        previous = null;
      }
    }
    if (previous && JSON.stringify(comparableConfig(previous)) === JSON.stringify(now)) {
      return { decision: "same", newest, kept: paths.length };
    }
    /*
     * **Словами человека, а не путями** — его слово 2026-09-19: «должно быть
     * понятно — указывай название настроек и что конкретно произошло».
     * Имена берутся из схемы панели, перестановки Fields разбираются отдельно.
     */
    const details = previous
      ? __changeWords.describeConfigChange(comparableConfig(previous), now, AUTOSAVE_DETAIL_LINES)
      : ["first autosave in this folder, so there is nothing to compare with"];
    const when = d.now instanceof Date ? d.now : new Date();
    const path = __backup.autosavePath(folder, when);
    if (typeof d.ensureFolder === "function") await d.ensureFolder(folder);
    let hotkeys = {};
    if (typeof d.hotkeys === "function") {
      try {
        hotkeys = d.hotkeys() || {};
      } catch (e) {
        /* Копия настроек главное: хоткеи не прочитались — заметка всё равно
           пишется, и об этом сказано в журнал. */
        console.error("[inline-overhaul][autosave] хоткеи для копии не прочитались", e);
      }
    }
    await d.create(path, __backup.buildBackupNote({
      config: cfg,
      /* Копия **максимальная** — его слово: все вкладки и хоткеи. */
      parts: __backup.allPartIds(),
      hotkeyScope: "own",
      hotkeys,
      pluginVersion: String((plugin && plugin.manifest && plugin.manifest.version) || ""),
      savedAt: when,
      comment: "Saved by Autosave, because the settings on disk were not the ones in the last autosave",
      details,
    }));
    /* Старые копии снимаются тем же заходом: предел объявлен один раз. */
    let removed = [];
    if (typeof d.remove === "function") {
      removed = __backup.pickStaleAutosaves(paths.concat([path]), AUTOSAVE_KEEP);
      for (const stale of removed) {
        try {
          await d.remove(stale);
        } catch (e) {
          /* Не снялась — не беда: предел мягкий, а заметка человека дороже. */
          console.error("[inline-overhaul][autosave] старая копия не снялась: " + stale, e);
        }
      }
    }
    /*
     * **Человеку сказать — его слово 2026-09-19:** «хочу, чтобы при создании
     * autosave об этом возникало уведомление — сейчас всё происходит молча».
     * Копию он не заказывал нажатием, но сам включил тумблер и вправе видеть,
     * что механизм сработал; это первый вид отказа наоборот — «получилось, и
     * вот где лежит».
     */
    if (typeof d.notify === "function") {
      d.notify(__say(__noticeKey("plugin", "autosave-saved"),
        "Settings autosaved to {0}", path));
    }
    return { decision: "saved", path, details, removed, kept: paths.length + 1 - removed.length };
  } catch (e) {
    console.error("[inline-overhaul][autosave]", e);
    return { decision: "failed" };
  }
}

module.exports = {
  AUTOSAVE_KEY,
  AUTOSAVE_KEEP,
  AUTOSAVE_DETAIL_LINES,
  autosaveEnabled,
  comparableConfig,
  autosaveOnLoad,
};
