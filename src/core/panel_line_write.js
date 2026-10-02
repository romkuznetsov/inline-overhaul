"use strict";

/**
 * Запись вида панели без удаления из строки человека: удаление схлопывает
 * чужие ступени отмены (У-160, У-97). Полоса встаёт рядом (решение
 * 2026-09-13, мера — `tools/undo_bench.js`): чего нет в строке — вставляется,
 * чего нет в виде — прячется. Что показать, решает `renderControlLine`.
 *
 * Два свойства проверяются здесь же: без спрятанного — вид движка, без
 * вставленного — строка человека знак в знак. Не сошлось — `null`, зовущий
 * пишет по-старому (У-96).
 */

const __sharedUtils = require("./shared_utils.js");

/**
 * Строка словами (слово с пробелами перед ним). Не по знакам: знаковое
 * сравнение сводит `||` полосы и `|` значения и рвёт вставку. Ссылка `[[…]]` —
 * одно слово и с пробелом внутри (BUGHUNT F4); граница — `lineWords`.
 */
function splitWords(text) {
  return __sharedUtils.lineWordsWithSpace(text);
}

/**
 * Наибольшая общая подпоследовательность слов; сетка O(n·m) — узкое место на
 * длинной строке (`Р-12`). Совпавшие начало и конец отрезаются до сетки: это
 * не теряет ни одной оптимальной пары (расхождение с полной сеткой измерено,
 * ноль).
 */
function commonPairs(a, b) {
  const n = a.length;
  const m = b.length;

  let head = 0;
  while (head < n && head < m && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < n - head && tail < m - head && a[n - 1 - tail] === b[m - 1 - tail]) tail += 1;

  const pairs = [];
  for (let k = 0; k < head; k++) pairs.push([k, k]);

  const ni = n - tail - head;
  const mi = m - tail - head;
  if (ni > 0 && mi > 0) {
    const grid = [];
    for (let i = 0; i <= ni; i++) grid.push(new Array(mi + 1).fill(0));
    for (let i = ni - 1; i >= 0; i--) {
      for (let j = mi - 1; j >= 0; j--) {
        grid[i][j] = a[head + i] === b[head + j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < ni && j < mi) {
      if (a[head + i] === b[head + j]) { pairs.push([head + i, head + j]); i += 1; j += 1; }
      else if (grid[i + 1][j] >= grid[i][j + 1]) i += 1;
      else j += 1;
    }
  }

  for (let k = 0; k < tail; k++) pairs.push([n - tail + k, m - tail + k]);
  return pairs;
}

/** Собрать строку, выбросив перечисленные отрезки. */
function withoutRanges(text, ranges) {
  let out = "";
  let at = 0;
  for (const [from, to] of ranges) {
    out += text.slice(at, from);
    at = to;
  }
  return out + text.slice(at);
}

/**
 * План записи: что написать и что спрятать. Вставку снимать ровно этими
 * отрезками, а не различием строк: различие уносит и чужой токен.
 *
 * @param {string} originalLine строка человека, как она лежит в заметке
 * @param {string} controlLine вид панели, как его нарисовал движок
 * @returns {{text: string, hidden: Array<Array<number>>, inserted: Array<Array<number>>}|null}
 *   план либо `null`, если свойства не сошлись — тогда зовущий пишет по-старому
 */
function planPanelLineWrite(originalLine, controlLine) {
  const src = String(originalLine == null ? "" : originalLine);
  const view = String(controlLine == null ? "" : controlLine);
  if (!view) return null;

  const a = splitWords(src);
  const b = splitWords(view);
  const pairs = commonPairs(a, b);

  let text = "";
  const hidden = [];
  const inserted = [];
  let ai = 0;
  let bi = 0;
  const push = (list, from, to) => {
    if (to <= from) return;
    const last = list.length ? list[list.length - 1] : null;
    if (last && last[1] === from) last[1] = to;
    else list.push([from, to]);
  };
  const takeFromSrc = (untilWord) => {
    while (ai < untilWord) {
      const at = text.length;
      text += a[ai];
      push(hidden, at, text.length);
      ai += 1;
    }
  };
  const takeFromView = (untilWord) => {
    while (bi < untilWord) {
      const at = text.length;
      text += b[bi];
      push(inserted, at, text.length);
      bi += 1;
    }
  };

  for (const pair of pairs) {
    takeFromSrc(pair[0]);
    takeFromView(pair[1]);
    text += a[ai];
    ai += 1;
    bi += 1;
  }
  takeFromSrc(a.length);
  takeFromView(b.length);

  /* Граница вставки не режет чужую ступень: вставка начинается на пробеле
     человека (`- ` списка). Сдвиг вправо, пока знак отрезка равен знаку за
     ним, результата не меняет и уводит границу на наш пробел. */
  for (const range of inserted) {
    while (range[1] < text.length && text[range[0]] === text[range[1]]
      && /\s/.test(text[range[0]])) {
      range[0] += 1;
      range[1] += 1;
    }
  }

  if (withoutRanges(text, hidden) !== view) return null;
  if (withoutRanges(text, inserted) !== src) return null;

  /* Вставки в столбцах строки человека: снять прежние точными отрезками,
     поставить новые — различие двух видов унесло бы значение человека. */
  const insertAt = [];
  let before = 0;
  let cut = 0;
  for (const range of inserted) {
    before = range[0] - cut;
    insertAt.push([before, text.slice(range[0], range[1])]);
    cut += range[1] - range[0];
  }
  return { text, hidden, inserted, insertAt };
}

module.exports = { planPanelLineWrite, splitWords, withoutRanges };
