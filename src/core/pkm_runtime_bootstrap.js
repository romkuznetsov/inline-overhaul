"use strict";

/*
 * Загрузчик, у которого не осталось загрузки: модули приезжают литеральным
 * `require` (У-89), а здесь живёт то, что загрузкой не было никогда, —
 * разрешение конфига порядка Field.
 *
 * Что ушло вместе с мостом модулей: `loadSharedModule` — общая обёртка «позови
 * мост, проверь годность, положи в `globalThis`», и `loadVaultModuleBridgeShared`
 * — прогрев самого моста. Обе умели вернуть `null`, и на этом `null` плагин
 * работал наполовину и молчал (У-90).
 *
 * `normalizeOrderKeyFallback` тоже снята. Она была умолчанием на случай, если
 * `pkm_v2/field_model.js` не приедет, — то есть вторым объявлением правила
 * нормализации ключа (У-32). Модуль лежит в бандле и приезжает всегда.
 */

const __sharedUtils = require("./shared_utils.js");

/*
 * **Нормализатора ключа Order здесь больше нет, и шва под него тоже**
 * (10.13.168). Было: `loadOrderKeyNormalizer` брал довод, иначе брал
 * `pkm_v2/field_model.js`, клал результат на `globalThis` и больше не
 * пересчитывал — то есть побеждал позвавший первым. Довод приезжал сюда через
 * пять слоёв, и все они, вместе с этим, вели в один дом —
 * `normalizeOrderKey` в `shared_utils.js`. Потребители спрашивают дом сами,
 * и порядок загрузки на ответ больше не влияет ничем.
 *
 * **И запасного хода «прочитать порядок из `data.json`» здесь больше нет**
 * (ревизия 2026-09-18, `docs/AUDIT_2026-09-18.md` 4.4 и Р-5). Он не мог
 * сработать ни при каком условии, и причин тому было три сразу:
 *
 *   - путь `.obsidian/plugins/inline-overhaul/data.json` стоял **литералом**,
 *     а папку настроек человек вправе увести в свою — её имя знает
 *     `vault.configDir`, и два других места плагина спрашивают именно его;
 *   - до этой папки `vault` не достаёт вовсе: `.obsidian/**` Obsidian не
 *     индексирует, и поэтому каталоги текстов читаются адаптером. То есть
 *     `getAbstractFileByPath` отвечал `null` всегда, а тело хода за первой
 *     строкой было недостижимо;
 *   - пробой со счётчиком: на 2759 вызовах `resolveOrderConfig` (весь набор,
 *     обе дороги обхода строки, стенд отмены и две сессии панели на его
 *     `data.json`) в запасной ход не зашло **ни одного**.
 *
 * Снятие поэтому ничего не меняет: и раньше, и теперь ответ собирает
 * `parseOrderConfig(rawSettings, normalizeKey)`. Починить путь было бы, наоборот,
 * изменением поведения — ход ожил бы там, где его никто не просил.
 *
 * Довод «приложение» у `resolveOrderConfig` остался: его передают пять
 * звавших через прослойку, и менять их подписи — отдельная работа, а не эта.
 */
async function resolveOrderConfig(app_, settings, options) {
  const opts = options && typeof options === "object" ? options : {};
  const key = String(opts.orderConfigKey || "").trim();
  if (!key) throw new Error("pkm_runtime_bootstrap: orderConfigKey is required");
  const parseOrderConfig = typeof opts.parseOrderConfig === "function" ? opts.parseOrderConfig : null;
  /* Дом один — `normalizeOrderKey` в `shared_utils.js` (10.13.168). Здесь
     стояло безымянное тело того же правила запасным ходом: довод давали все
     звавшие, и ни один прогон в него не заходил. */
  const normalizeKey = typeof opts.normalizeKey === "function" ? opts.normalizeKey : __sharedUtils.normalizeOrderKey;
  if (!parseOrderConfig) throw new Error("pkm_runtime_bootstrap: parseOrderConfig is required");
  const rawSettings = settings && Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : undefined;
  /*
   * Развилки здесь больше нет, и это не упрощение ради красоты: со снятием
   * запасного хода обе её ветви стали одним и тем же вызовом. Признак
   * «порядок в настройках есть» разводил их ровно затем, чтобы настройки
   * побеждали `data.json`, — побеждать стало некого.
   */
  return parseOrderConfig(rawSettings, normalizeKey);
}

module.exports = {
  resolveOrderConfig,
};
