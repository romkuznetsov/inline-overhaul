// @ts-check
"use strict";

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50).
 *
 * Модуль спрашивает `globalThis.__inlineSay` через общий помощник: своей копии
 * этого правила заводить нельзя, из тройки таких копий уже вырос дефект Б-11.
 *
 * **Литеральный `require` без запасного пути** — правило модулей (У-89,
 * У-90, A33). До 2026-09-09 здесь стояла заглушка, и она **повторяла правило
 * подстановки `{0}`** — то есть была ещё одной той самой копией, о которой
 * предупреждает абзац выше. Таких копий было четыре, в четырёх файлах.
 */
const __sayModule = require("./say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

class ConfigStore {
  /**
   * @param {any} plugin точка входа плагина: отсюда берутся `loadData` и
   *   `saveData`, то есть граница с диском
   * @param {any} options умолчания, помощники и `Notice`; форма у них та,
   *   какую передаёт загрузка, и описана она там же
   */
  constructor(plugin, options) {
    this.plugin = plugin;
    this.defaults = options.defaults;
    this.undoLimit = options.undoLimit || 20;
    this.saveDebounceMs = options.saveDebounceMs || 250;
    this.cloneJson = options.cloneJson;
    this.isObj = options.isObj;
    this.deepMerge = options.deepMerge;
    this.migrateConfig = options.migrateConfig;
    this.Notice = options.Notice;
    /**
     * Спросить перед записью, писать ли. Отдаёт `false`, если на диске лежит
     * не наше и оно принято. Ставит загрузка; без неё запись идёт как шла.
     * @type {null | (() => Promise<boolean>)}
     */
    this.beforeWrite = typeof options.beforeWrite === "function" ? options.beforeWrite : null;
    this.config = this.cloneJson(this.defaults);
    /**
     * Что мы **сами** в последний раз положили в файл. Это и есть наш ответ на
     * вопрос «менял ли файл кто-то, кроме нас»: время файла принадлежит
     * файловой системе и переезжает вместе с копией (У-220), а содержимое —
     * нет. `null` значит «мы ещё не писали», и тогда судить не о чем.
     * @type {any}
     */
    this.lastWritten = null;
    /**
     * Писали ли мы в файл хоть раз за эту загрузку. Признак отдельный нарочно:
     * само значение бывает любым, `null` в том числе, и сравнивать его с
     * «ещё не писали» значило бы объявить два разных состояния одним.
     * @type {boolean}
     */
    this.hasWritten = false;
    /** @type {any[]} снимки конфига до правки; форма — само дерево настроек */
    this.undoStack = [];
    this.listeners = new Set();
    this.saveTimer = null;
    this.coalesceWindowMs = options.coalesceWindowMs || 400;
    /** @type {string|null} */
    this.lastUndoKey = null;
    /** @type {number|null} */
    this.lastUndoAt = null;
  }

  async init() {
    const raw = await this.plugin.loadData();
    this.config = this.migrateConfig(raw);
    await this.plugin.saveData(this.config);
    this.rememberWritten();
  }

  /** Запомнить, что теперь лежит в файле нашими руками. */
  rememberWritten() {
    this.lastWritten = this.getSnapshot();
    this.hasWritten = true;
  }

  getSnapshot() {
    return this.cloneJson(this.config);
  }

  /**
   * @param {(payload: any) => void} listener
   * @returns {() => void} отписка
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @param {string} [reason] почему конфиг изменился */
  emit(reason) {
    const payload = { reason: reason || "update", snapshot: this.getSnapshot() };
    for (const l of this.listeners) {
      try {
        l(payload);
      } catch (e) {
        console.error("[inline-overhaul] Config listener failed", e);
      }
    }
  }

  /**
   * Тот же самый конфиг, что лежит сейчас, или другой.
   *
   * Одно объявление на два вопроса: «эта запись ничего не меняет» у `update` и
   * «файл на диске уже равен памяти» у `adoptExternal`. Второй — это
   * отрицательный контроль Р-2: наша собственная запись, вернувшаяся сигналом
   * платформы, обязана не считаться внешней, и ловится она **содержимым**, а не
   * временем файла — его платформа сравнивает сама, и точность у него
   * файловой системы.
   *
   * Сравнение текстом, а не обходом: у конфига есть ветки, которые человек
   * правит руками, и порядок ключей в них — его. `JSON.stringify` на цикле
   * бросает, и тогда ответ «другой»: лучше лишняя перерисовка, чем потерянная.
   *
   * @param {any} candidate дерево настроек для сравнения
   * @returns {boolean}
   */
  sameAsCurrent(candidate) {
    try {
      return JSON.stringify(this.config) === JSON.stringify(candidate);
    } catch (_) {
      return false;
    }
  }

  /**
   * opts (PRD 5.5):
   *   undoable: false  - изменение не попадает в undo-стек (CS2);
   *   coalesceKey      - несколько записей с одним ключом внутри
   *                      coalesceWindowMs склеиваются в одну запись undo (CS3).
   *
   * Склейка нужна слайдерам: платформа зовёт запись на каждый шаг протяжки, и
   * без неё одна протяжка забивает весь стек, а «отменить» откатывает один
   * пиксель вместо жеста (дефект A6).
   *
   * @param {(cfg: any) => any} mutator получает снимок, возвращает новый конфиг
   * @param {string} [reason] причина записи: по ней узнают контрол
   * @param {{undoable?: boolean, coalesceKey?: string}} [opts]
   * @returns {boolean} изменилось ли что-нибудь
   */
  update(mutator, reason, opts) {
    const before = this.getSnapshot();
    const next = mutator(this.getSnapshot());
    if (!this.isObj(next)) return false;

    const migratedNext = this.migrateConfig(next);
    if (this.sameAsCurrent(migratedNext)) return false;

    const undoable = !opts || opts.undoable !== false;
    const key = opts && opts.coalesceKey ? String(opts.coalesceKey) : null;
    const now = Date.now();

    if (undoable) {
      const window = this.coalesceWindowMs || 400;
      const sameKeyRecently = key
        && this.lastUndoKey === key
        && this.lastUndoAt !== null
        && now - this.lastUndoAt < window
        && this.undoStack.length > 0;

      if (!sameKeyRecently) {
        this.undoStack.push(before);
        if (this.undoStack.length > this.undoLimit) this.undoStack.shift();
      }
      this.lastUndoKey = key;
      this.lastUndoAt = now;
    }

    this.config = migratedNext;
    this.emit(reason || "update");
    this.scheduleSave();
    return true;
  }

  /**
   * @param {any} patchObj кусок дерева настроек, который надо влить
   * @param {string} [reason]
   * @returns {boolean}
   */
  patch(patchObj, reason) {
    return this.update((/** @type {any} */ prev) => this.deepMerge(prev, patchObj), reason || "patch");
  }

  /**
   * Принять настройки, изменённые снаружи: Obsidian Sync, второй компьютер,
   * правка файла руками, перенос настроек между vault (Р-2).
   *
   * **Его слово — «диск сильнее»** (В-142, 2026-09-18). Окна с выбором «чьё
   * оставить» нет: то, что лежит на диске, побеждает то, что лежит в памяти.
   *
   * Три вещи, которые делает именно хранилище, и каждая нужна:
   *
   *   1. **Отложенная запись снимается.** Она несёт **прежний** конфиг, и
   *      ровно ею плагин затирал принесённое синхронизацией (разбор 4.2). Пока
   *      этот таймер жив, «диск сильнее» неправда.
   *   2. **Стек отмены очищается.** В нём лежат снимки того документа, которого
   *      больше нет: `Ctrl+Z` после внешней правки записал бы наше вчерашнее
   *      состояние поверх принесённого — то самое затирание, только руками
   *      человека. Ступени, которые нельзя выполнить, честнее убрать.
   *   3. **Своей записи не делается.** На диске уже лежит то, что мы приняли;
   *      запись подняла бы время файла и разбудила синхронизацию по кругу.
   *
   * Отвечает `true`, если что-то и правда изменилось: позвавший по этому
   * решает, говорить ли человеку и перерисовывать ли заметки.
   *
   * Нечитаемый файл сюда не доезжает: `isObj` отвечает «нет», и настройки
   * остаются прежними. Иначе `migrateConfig` собрал бы из `null` умолчания и
   * стёр бы человеку всё дерево настроек в ответ на недописанный синхронизацией
   * файл.
   *
   * @param {any} raw то, что лежит в `data.json` прямо сейчас
   * @returns {boolean} изменилось ли что-нибудь
   */
  adoptExternal(raw) {
    if (!this.isObj(raw)) return false;
    const next = this.migrateConfig(raw);
    if (this.sameAsCurrent(next)) return false;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.undoStack.length = 0;
    this.lastUndoKey = null;
    this.lastUndoAt = null;

    this.config = next;
    /* На диске теперь лежит ровно это, и наша следующая запись не должна
       принять свой же файл за чужой. */
    this.rememberWritten();
    this.emit("external");
    return true;
  }

  /**
   * Лежит ли в файле не то, что мы туда положили.
   *
   * Вопрос **о содержимом**, а не о времени: копирование файла переносит время
   * источника, и «файл новее нашей записи» на скопированном не выполняется
   * вовсе — именно так внешняя правка и осталась незамеченной 2026-09-18.
   *
   * Пока мы ни разу не писали, ответ «нет»: сравнивать не с чем.
   *
   * @param {any} raw то, что лежит в `data.json` прямо сейчас
   * @returns {boolean}
   */
  diskChangedUnderUs(raw) {
    if (!this.isObj(raw)) return false;
    if (!this.hasWritten) return false;
    try {
      return JSON.stringify(this.migrateConfig(raw)) !== JSON.stringify(this.lastWritten);
    } catch (_) {
      /* Проба: дерево с циклом не сериализуется. Ответ «нет» — запись пойдёт
         как шла, и это безопаснее, чем принять непрочитанное за чужое. */
      return false;
    }
  }

  /**
   * @param {string} [reason]
   * @returns {boolean} было ли что отменять
   */
  undo(reason) {
    this.lastUndoKey = null;
    this.lastUndoAt = null;
    if (!this.undoStack.length) return false;
    this.config = this.migrateConfig(this.undoStack.pop());
    this.emit(reason || "undo");
    this.scheduleSave();
    return true;
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        /*
         * Диск сильнее, и спрашивается это **перед** записью, а не только по
         * сигналу платформы: сигнала может не быть вовсе, если у принесённого
         * файла время старее нашей записи (копия переносит время источника).
         */
        if (this.beforeWrite && (await this.beforeWrite()) === false) return;
        await this.plugin.saveData(this.config);
        this.rememberWritten();
      } catch (e) {
        console.error("[inline-overhaul] Save failed", e);
        new this.Notice(__say(__noticeKey("plugin", "save-failed"), "Could not save settings"));
      }
    }, this.saveDebounceMs);
  }

  /**
   * Дописать отложенную запись прямо сейчас (CS7).
   *
   * **Зовётся выгрузкой плагина.** `scheduleSave` откладывает запись на
   * `saveDebounceMs`, а `unload()` тот же таймер снимает — то есть правка,
   * сделанная в последнюю четверть секунды, пропадала молча. Воспроизведено
   * 2026-09-18, разбор — `docs/dev/AUDIT_2026-09-18.md`, 4.1.
   *
   * **Ничего не отложено — ничего не пишем.** «Дописать» значит «дописать
   * отложенное», а не «записать ещё раз»: лишняя запись на каждой выгрузке
   * трогала бы время файла и будила синхронизацию на ровном месте. Отвечает
   * `false`, чтобы позвавший мог сказать, было ли что дописывать.
   *
   * **Взгляда на диск здесь нарочно нет.** Отложенное дописывается на выгрузке,
   * и лишнее чтение файла — это ровно тот риск, из-за которого правка пропадала
   * при выключении плагина (`Р-1`, 2026-09-18). Диск сильнее там, где есть
   * время спросить: в отложенной записи.
   */
  async flushNow() {
    if (!this.saveTimer) return false;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.plugin.saveData(this.config);
    this.rememberWritten();
    return true;
  }

  unload() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

module.exports = {
  ConfigStore,
};
