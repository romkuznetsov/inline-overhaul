"use strict";

/**
 * Четыре правила вида, каждое из которых нашёл заказчик глазами (PRD 15.4).
 *
 * Спрашиваются **вычисленные величины**, а не дерево: видит ли браузер
 * открытую подсказку, во всю ли ширину своего блока она встала, какой контраст
 * у текста шапки против той заливки, что под ним получилась, и в одну ли
 * строку встала подпись слайдера. На все семь вкладок.
 *
 * Запуск: `node tests/browser/check_panel.js [имя-подмены]`. С подменой
 * проверка обязана **упасть** — так видно, что она способна покраснеть (У-88).
 * Список подмен — `harness.js`, гоняет их `run_all.js`.
 */

const { openPrototype, injectionCss } = require("./harness.js");

const injection = process.argv[2] || "";
let failed = 0;
const bad = (m) => { console.log("  FAIL " + m); failed++; };

/**
 * Порог контраста — 4.5:1, требование WCAG AA для обычного текста. Названо
 * числом нарочно: «серым по серому» заказчик присылал дважды, и словом
 * «читается» это не проверить.
 */
const MIN_CONTRAST = 4.5;

/**
 * Подсказка занимает свой контейнер целиком — это правило заказчика, и он его
 * принял галочкой на строке `T1` 2026-09-08.
 */
const MIN_SHARE_OF_CONTAINER = 0.9;

/**
 * И второе правило, без которого первое пусто: контейнер не бывает уже 300
 * точек. Ширина 188 — это его же скриншот `15.png`, где тело подсказки встало
 * столбиком по два слова.
 *
 * **Одно объявленное исключение, и это не лазейка, а открытый вопрос.**
 * Подсказка шапки списка Fields лежит в колонке `flex: 0 0 188px` и раскрыта
 * на 188 точек — измерено, а не предположено. Причём именно в неё прошлая
 * сессия унесла смысл подписей `Left Block` и `Right Block` (строка `T2`,
 * заказчик её принял), а объяснение рядом с кодом уверяло, что подсказка «во
 * всю ширину». Чинится это не шириной, а устройством: у двух колонок нет общей
 * строки шапки, и `flex-wrap` здесь уже трижды не сработал (см. комментарий
 * `.io-fields` в `styles.css`). Поэтому — вопрос В-92, а исключение снимается
 * вместе с его ответом.
 */
const MIN_CONTAINER_WIDTH = 300;
const NARROW_OK = {
  "the Fields list": { width: 188, why: "В-92, колонка списка Fields шириной 188 точек" },
};

(async () => {
  const { browser, page, pageErrors } = await openPrototype();
  try {
    const css = injectionCss(injection);
    if (css) await page.addStyleTag({ content: css });

    const tabs = await page.$$eval(".io-tabs .io-tab", (els) => els.length);
    if (tabs < 7) bad("вкладок в прототипе " + tabs + ", а их семь: страница не отрисовалась");

    const totals = { tips: 0, heads: 0, values: 0, narrowAllowed: 0 };

    for (let i = 0; i < tabs; i++) {
      const found = await page.evaluate((idx) => {
        /* ---- помощники живут внутри страницы: тут есть getComputedStyle ---- */
        function parseColor(str) {
          const s = String(str || "").trim();
          const m = s.match(/^rgba?\(([^)]+)\)$/i);
          if (m) {
            const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
          }
          /*
           * `color(srgb 0.42 0.36 0.81 / 0.2)` — так браузер отдаёт цвет,
           * собранный из переменной темы прозрачной долей (`color-mix`).
           * Без этой ветки заливка шапок читалась бы как «цвет неизвестен», и
           * проверка контраста молча мерила бы белое по белому.
           */
          const c = s.match(/^color\(srgb\s+([^)]+)\)$/i);
          if (c) {
            const p = c[1].split(/[\s/]+/).filter(Boolean).map(Number);
            return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
          }
          return null;
        }
        /* Заливка под узлом: своя, а под её прозрачностью — родительская. */
        function effectiveBg(el) {
          let out = { r: 255, g: 255, b: 255, a: 1 };
          const chain = [];
          for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
          chain.reverse();
          for (const n of chain) {
            const c = parseColor(getComputedStyle(n).backgroundColor);
            if (!c || !c.a) continue;
            out = {
              r: c.r * c.a + out.r * (1 - c.a),
              g: c.g * c.a + out.g * (1 - c.a),
              b: c.b * c.a + out.b * (1 - c.a),
              a: 1,
            };
          }
          return out;
        }
        function lum(c) {
          const f = (v) => {
            const x = v / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        }
        function contrast(fg, bg) {
          const a = lum(fg), b = lum(bg);
          const hi = Math.max(a, b), lo = Math.min(a, b);
          return (hi + 0.05) / (lo + 0.05);
        }
        function visible(el) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && el.offsetParent !== null;
        }

        const tab = document.querySelectorAll(".io-tabs .io-tab")[idx];
        const tabName = tab ? (tab.textContent || "").trim().replace(/\d+$/, "") : "?";
        if (tab) tab.click();

        const out = { tab: tabName, tips: [], heads: [], values: [] };

        /* ---- 1. Подсказки: видны и во всю ширину своего блока ---- */
        const helps = Array.from(document.querySelectorAll(".io-help"));
        for (let h = 0; h < helps.length; h++) {
          const btn = helps[h];
          const owner = btn.closest(".io-item") || btn.closest(".io-group") || btn.parentElement;
          if (!owner) continue;
          btn.click();
          const tip = owner.querySelector(".io-tip");
          const aria = String(btn.getAttribute("aria-label") || "").replace(/^More about\s+/, "");
          if (!tip) { out.tips.push({ aria, missing: true }); continue; }
          const box = tip.parentElement || owner;
          const tw = tip.getBoundingClientRect().width;
          const bw = box.getBoundingClientRect().width;
          out.tips.push({
            aria,
            vis: visible(tip),
            w: Math.round(tw),
            box: Math.round(bw),
            share: bw > 0 ? tw / bw : 0,
          });
          btn.click();
        }

        /* ---- 2. Шапки таблиц: контраст против получившейся заливки ---- */
        const heads = Array.from(document.querySelectorAll(
          ".io-tablehead, .io-fields__colhead, .io-vals__head, .io-cmd__head"));
        for (const el of heads) {
          const fg = parseColor(getComputedStyle(el).color);
          if (!fg) continue;
          out.heads.push({
            cls: String(el.className || "").split(/\s+/)[0],
            ratio: Math.round(contrast(fg, effectiveBg(el)) * 100) / 100,
          });
        }

        /* ---- 3. Подпись слайдера: одна строка, знак не уезжает ---- */
        for (const el of Array.from(document.querySelectorAll(".io-value"))) {
          const r = el.getBoundingClientRect();
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
          out.values.push({
            text: (el.textContent || "").trim(),
            lines: Math.max(1, Math.round(r.height / lh)),
            /*
             * Переполнение спрашивается по **высоте**, а не по ширине: текст,
             * который перенёсся, по ширине укладывается — он для этого и
             * перенёсся. Первая версия мерила ширину и подмену не поймала.
             */
            overflow: el.scrollHeight > el.clientHeight + 1 || r.height > lh * 1.5,
          });
        }

        return out;
      }, i);

      for (const t of found.tips) {
        totals.tips++;
        if (t.missing) { bad(found.tab + ": «?» нажат, а подсказки в блоке нет — «" + t.aria + "»"); continue; }
        if (!t.vis) bad(found.tab + ": подсказка создана, но браузер её не видит — «" + t.aria + "»");
        if (t.share < MIN_SHARE_OF_CONTAINER) {
          bad(found.tab + ": подсказка «" + t.aria + "» шириной " + t.w + " из " + t.box
            + " точек своего блока (" + Math.round(t.share * 100) + "%)");
        }
        if (t.box < MIN_CONTAINER_WIDTH) {
          const allow = NARROW_OK[t.aria];
          if (allow && t.box === allow.width) {
            totals.narrowAllowed++;
          } else {
            bad(found.tab + ": подсказка «" + t.aria + "» раскрыта в " + t.box
              + " точек — текст встанет столбиком (нужно от " + MIN_CONTAINER_WIDTH + ")");
          }
        }
      }
      for (const h of found.heads) {
        totals.heads++;
        if (h.ratio < MIN_CONTRAST) {
          bad(found.tab + ": шапка " + h.cls + " — контраст " + h.ratio + ":1, нужно " + MIN_CONTRAST + ":1");
        }
      }
      for (const v of found.values) {
        totals.values++;
        if (v.lines > 1) bad(found.tab + ": подпись слайдера «" + v.text + "» встала в " + v.lines + " строки");
        if (v.overflow) bad(found.tab + ": подпись слайдера «" + v.text + "» переполняет свою строку");
      }
    }

    /*
     * Положительный контроль (У-88): пусто выполняет любое «не больше чем»
     * лучше всех. Числа тут — не «должно быть столько», а «предмет найден».
     */
    if (totals.tips < 40) bad("положительный контроль: подсказок проверено " + totals.tips + ", а их десятки");
    if (totals.heads < 5) bad("положительный контроль: шапок таблиц проверено " + totals.heads);
    if (totals.values < 5) bad("положительный контроль: подписей слайдеров проверено " + totals.values);
    /* И контроль на само исключение: перестало быть нужным — снимите его. */
    if (!injection && totals.narrowAllowed !== 1) {
      bad("объявленных узких подсказок " + totals.narrowAllowed + ", а объявлена одна (В-92): "
        + "исключение либо устарело, либо появилось второе");
    }

    if (pageErrors.length) bad("страница ругается: " + pageErrors.slice(0, 3).join(" ;; "));

    console.log("  подсказок " + totals.tips + ", шапок " + totals.heads
      + ", подписей слайдеров " + totals.values
      + ", объявленных узких " + totals.narrowAllowed
      + (injection ? " | подмена: " + injection : ""));
  } finally {
    await browser.close();
  }

  process.exit(failed ? 1 : 0);
})();
