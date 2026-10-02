"use strict";

/**
 * Окно отладки полос тегов в консоли: `globalThis.__ioStripDebug` — что движок
 * посчитал для строки. Срезы последнего пакета, который кладёт `decorations.js`
 * в `plugin._lastStripDebugBatch`; своего здесь не считается (У-32). Глобаль —
 * единственный путь из консоли; ставится один раз при загрузке.
 */

function publish(plugin) {
  try {
    globalThis.__ioStripDebug = {
      dumpLatest() {
        const batch = plugin._lastStripDebugBatch || null;
        console.log("[io-strip-debug] latest", batch);
        return batch;
      },
      scanVisible() {
        const batch = plugin._lastStripDebugBatch || {};
        const rows = Array.isArray(batch.rows) ? batch.rows : [];
        const mapped = rows.map((r) => ({
          lineNo: r.lineNo,
          mode: r.mode,
          classes: r.classes,
          style: r.style,
          ownToken: r.ownToken,
          ownColor: r.ownColor,
          inheritColor: r.inheritColor,
        }));
        console.table(mapped);
        return mapped;
      },
      dumpLine(lineNo) {
        const ln = Number(lineNo || 0);
        const batch = plugin._lastStripDebugBatch || {};
        const rows = Array.isArray(batch.rows) ? batch.rows : [];
        const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
        console.log("[io-strip-debug] line", ln, row);
        return row;
      },
      dumpGeometry(lineNo) {
        const ln = Number(lineNo || 0);
        const batch = plugin._lastStripDebugBatch || {};
        const rows = Array.isArray(batch.rows) ? batch.rows : [];
        const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
        if (!row) {
          console.log("[io-strip-debug] geometry", ln, null);
          return null;
        }
        const payload = {
          lineNo: row.lineNo,
          mode: row.mode,
          laneCount: row.laneCount,
          laneLefts: row.laneLefts,
          gutterInset: row.gutterInset,
          thickness: row.style,
        };
        console.log("[io-strip-debug] geometry", payload);
        return payload;
      },
      dumpMixed(lineNo) {
        const ln = Number(lineNo || 0);
        const batch = plugin._lastStripDebugBatch || {};
        const rows = Array.isArray(batch.rows) ? batch.rows : [];
        const row = rows.find((r) => Number(r.lineNo || 0) === ln) || null;
        if (!row) {
          console.log("[io-strip-debug] mixed", ln, null);
          return null;
        }
        const payload = {
          lineNo: row.lineNo,
          mode: row.mode,
          ownToken: row.ownToken,
          ownColor: row.ownColor,
          inheritColor: row.inheritColor,
          classes: row.classes,
          style: row.style,
        };
        console.log("[io-strip-debug] mixed", payload);
        return payload;
      },
      css() {
        const styleEl = plugin._stripLineStyleEl || null;
        const payload = {
          attached: !!(styleEl && styleEl.parentNode),
          textLength: styleEl && styleEl.textContent ? String(styleEl.textContent).length : 0,
          selectorCount: styleEl && styleEl.sheet && styleEl.sheet.cssRules ? styleEl.sheet.cssRules.length : 0,
        };
        console.log("[io-strip-debug] css", payload);
        return payload;
      },
    };
  } catch (e) {
    /* Сломалось невидимое — в журнал; загрузку из-за отладки не роняем. */
    console.error("[inline-overhaul][strip-debug] окно отладки полос не встало: "
      + String((e && e.message) || e || ""));
  }
}

module.exports = {
  publish,
};
