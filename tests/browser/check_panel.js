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
 * **Исключений больше нет, и это не послабление, а закрытый вопрос.**
 * Одно было: подсказка шапки списка Fields лежала в колонке `flex: 0 0 188px`
 * и раскрывалась на 188 точек — та самая, в которую унесён смысл подписей
 * `Left Block` и `Right Block`. Чинилось это не шириной, а устройством, и
 * заказчик выбрал устройство: у колонок появилась общая строка шапки
 * (сетка вместо флекса, В-92, 2026-09-08), и подсказка раскрывается под ней во
 * всю ширину редактора. Список исключений оставлен пустым намеренно — он не
 * про то одно, а про класс: следующее объявится с причиной и датой.
 */
const MIN_CONTAINER_WIDTH = 300;
const NARROW_OK = {};

(async () => {
  const { browser, page, pageErrors } = await openPrototype();
  try {
    const css = injectionCss(injection);
    if (css) await page.addStyleTag({ content: css });

    const tabs = await page.$$eval(".io-tabs .io-tab", (els) => els.length);
    if (tabs < 7) bad("вкладок в прототипе " + tabs + ", а их семь: страница не отрисовалась");

    const totals = { tips: 0, heads: 0, values: 0, narrowAllowed: 0, unlocked: 0, steps: 0,
      band: null };

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

        const out = { tab: tabName, tips: [], heads: [], values: [], unlocked: 0, steps: 0,
          bandBefore: -1, bandOn: false, bandAfter: -1, bandOnEmpty: -1, bandBack: -1 };

        /*
         * Строка, которая появляется только в одном состоянии, под браузер не
         * попадала вовсе: гейт открывает панель с умолчаниями. Список ступеней
         * `Ctrl+A` виден только при `Custom` (З-3) — значит режим переключается
         * до замеров, и всё, что открылось, меряется наравне с остальным.
         *
         * Отбор — по значению, которого больше нет ни у одного списка. Что
         * переключение состоялось, говорит `steps` ниже: подмена, которая
         * ничего не сдвинула, читается как «проверка слепа» (У-110).
         */
        for (const sel of Array.from(document.querySelectorAll("select"))) {
          const values = Array.from(sel.options || []).map(function (o) { return o.value; });
          if (values.indexOf("word-line-tree-header-note") < 0) continue;
          sel.value = "custom";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          out.unlocked++;
        }
        if (out.unlocked) out.steps = document.querySelectorAll(".io-keepfields__row").length;

        /*
         * Заливка Left и Right Block (З-7). Тумблер выключен по умолчанию, то
         * есть подложки на панели нет вовсе — и проверять было бы нечего.
         * Поэтому он включается, и меряется **вычисленный фон** обеих сторон
         * предпросмотра: то самое, чего не видит заглушка DOM.
         *
         * `bandOff` снимается ДО включения: без него «фон появился» нечем
         * отличить от «фон был всегда» (У-110).
         */
        /*
         * Тумблер ищется заново перед каждым нажатием. Панель перерисовывает
         * содержимое целиком, и узел, найденный до перерисовки, к странице уже
         * не относится: нажатие по нему меняет отсоединённый флажок и ничего
         * не делает с экраном. Первая версия этой проверки так и не выключила
         * подложку обратно и объявила это дефектом.
         */
        const findBandToggle = () => Array.from(document.querySelectorAll("input[type=checkbox]"))
          .find((el) => {
            const item = el.closest(".io-item");
            const name = item ? item.querySelector(".io-item__name") : null;
            return !!name && (name.textContent || "").trim() === "Color the Blocks";
          });
        const bandToggle = findBandToggle();
        if (bandToggle) {
          const sides = () => Array.from(document.querySelectorAll(
            ".io-line__side--left, .io-line__side--right"));
          const painted = () => sides().filter((el) => {
            const bg = parseColor(getComputedStyle(el).backgroundColor);
            return !!bg && bg.a > 0.001;
          }).length;
          /*
           * Пустой стороны в предпросмотрах нет ни одной, и искать её негде:
           * все примеры со значениями. Поэтому предмет **создаётся** — пустая
           * сторона кладётся в ту же строку, — и у браузера спрашивается её
           * вычисленный фон. Иначе правило «пустой блок без подложки»
           * проверялось бы отсутствием предмета (У-88).
           */
          const emptyPainted = () => {
            const line = document.querySelector(".io-line--blockfill");
            if (!line) return -1;
            const probe = document.createElement("span");
            probe.className = "io-line__side io-line__side--left";
            line.appendChild(probe);
            const bg = parseColor(getComputedStyle(probe).backgroundColor);
            probe.remove();
            return bg && bg.a > 0.001 ? 1 : 0;
          };

          /*
           * **На сколько подложка выходит за написанное** (замечание по S7).
           * Спрашивается у браузера то, чего не видит ни заглушка, ни глаз на
           * скриншоте: расстояние от края подложки до первого написанного в
           * ней знака. Ноль здесь и есть тот дефект, с которым он пришёл:
           * подложка ровно по пузырю тега, а у пузыря свой непрозрачный цвет.
           */
          const reach = () => {
            const side = document.querySelector(
              ".io-line--blockfill .io-line__side--left");
            const first = side ? side.firstElementChild : null;
            const last = side ? side.lastElementChild : null;
            if (!side || !first || !last) return null;
            const a = side.getBoundingClientRect();
            const f = first.getBoundingClientRect();
            const l = last.getBoundingClientRect();
            return {
              /*
               * `x` — в сторону разделителя, `outer` — наружу. У левого блока
               * разделитель справа: спрашивается расстояние от правого края
               * подложки до правого края её последнего значения. Прежде тут
               * мерилось расстояние слева, и с односторонним ростом эта
               * величина обязана стать нулём — она и есть его замечание
               * «полоска захватывает i2n-floating».
               */
              x: Math.round((a.right - l.right) * 100) / 100,
              outer: Math.round((f.left - a.left) * 100) / 100,
              y: Math.round((f.top - a.top) * 100) / 100,
            };
          };
          /*
           * И вторая половина того же: подложка обязана вырасти, **не**
           * раздвинув строку. В заметке её рисует слой, вёрстки он не
           * касается вовсе, — значит и здесь высота строки от включения
           * меняться не должна. Иначе предпросмотр обещал бы то, чего в
           * заметке нет: ровно так уже разошлись эти два места.
           */
          const lineHeights = () => Array.from(document.querySelectorAll(".io-line"))
            .map((el) => Math.round(el.getBoundingClientRect().height * 100) / 100);

          out.lineHeightsOff = lineHeights();
          out.bandBefore = painted();
          if (!bandToggle.checked) bandToggle.click();
          const bandOnNode = findBandToggle();
          out.bandOn = !!bandOnNode && bandOnNode.checked === true;
          out.bandAfter = painted();
          out.bandOnEmpty = emptyPainted();
          out.bandReach = reach();
          out.lineHeightsOn = lineHeights();
          /*
           * **Три ориентира шкалы, измеренные браузером** (его слова
           * 2026-09-09): ноль — по написанному, середина — до разделителя и
           * зеркально с другой стороны, сотня — включая разделитель. Одного
           * положения тут мало: проверка, смотревшая в одну точку, была
           * зелёной и при одностороннем росте (У-110).
           *
           * Ползунок ищется заново перед каждым положением: панель
           * перерисовывает содержимое целиком, и узел, найденный до неё, к
           * странице больше не относится (У-114).
           */
          const findWidthSlider = () => Array.from(document.querySelectorAll("input[type=range]"))
            .find((el) => {
              const item = el.closest(".io-item");
              const name = item ? item.querySelector(".io-item__name") : null;
              return !!name && (name.textContent || "").trim() === "Band width";
            });
          const setWidth = (pct) => {
            const s = findWidthSlider();
            if (!s) return false;
            s.value = String(pct);
            s.dispatchEvent(new Event("input", { bubbles: true }));
            s.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          };
          /* Меры, от которых считается шкала: промежуток строки и ширина
             разделителя — спрашиваются у браузера, а не пишутся числом. */
          out.bandGap = (() => {
            const line = document.querySelector(".io-line--blockfill");
            if (!line) return -1;
            const v = parseFloat(getComputedStyle(line).getPropertyValue("--io-line-gap"));
            return Number.isFinite(v) ? v : -1;
          })();
          out.bandSepWidth = (() => {
            const sep = document.querySelector(".io-line--blockfill .io-line__sep");
            return sep ? Math.round(sep.getBoundingClientRect().width * 100) / 100 : -1;
          })();
          /*
           * **Высоты двух сторон** (замечание по S7, 2026-09-09, третий заход:
           * «в io-tip-tag-preview высота полоски различается для left и right
           * blocks»). Мерится сама подложка и **самое высокое, что в ней
           * лежит**: без второго числа «высоты равны» выполнялось бы и на
           * строке, где слева и справа лежит одно и то же, — то есть
           * отсутствием предмета (У-113).
           */
          out.bandSides = (() => {
            const line = document.querySelector(".io-line--blockfill");
            if (!line) return null;
            const left = line.querySelector(".io-line__side--left");
            const right = line.querySelector(".io-line__side--right");
            if (!left || !right) return null;
            const tallest = (side) => Array.from(side.children).reduce(
              (h, el) => Math.max(h, el.getBoundingClientRect().height), 0);
            const round = (n) => Math.round(n * 100) / 100;
            return {
              align: getComputedStyle(left).alignSelf + "/" + getComputedStyle(right).alignSelf,
              leftPad: getComputedStyle(left).paddingTop + "+" + getComputedStyle(left).paddingBottom,
              rightPad: getComputedStyle(right).paddingTop + "+" + getComputedStyle(right).paddingBottom,
              left: round(left.getBoundingClientRect().height),
              right: round(right.getBoundingClientRect().height),
              leftInside: round(tallest(left)),
              rightInside: round(tallest(right)),
            };
          })();
          out.bandReachAt = {};
          for (const pct of [0, 50, 100]) {
            if (setWidth(pct)) out.bandReachAt[pct] = reach();
          }
          if (bandOnNode && bandOnNode.checked) {
            const back = findBandToggle();
            if (back && back.checked) back.click();
          }
          out.bandBack = painted();
        }

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

      totals.unlocked += found.unlocked;
      if (found.bandBefore >= 0) totals.band = found;
      if (found.unlocked) totals.steps = found.steps;
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
    /*
     * И контроль на переключение режима: список ступеней ровно один, и в нём
     * пять строк. Ноль тут значит не «нечего проверять», а «переключение не
     * состоялось» — тогда подсказка нового блока не открывалась ни разу, и
     * зелёный цвет выше получен от отсутствия предмета.
     */
    if (totals.unlocked !== 1) {
      bad("положительный контроль: списков режимов `Ctrl+A` найдено " + totals.unlocked
        + ", а он один — переключить на `Custom` не удалось");
    }
    if (totals.steps !== 5) {
      bad("положительный контроль: ступеней `Ctrl+A` открылось " + totals.steps
        + ", а их пять — блок не отрисовался, и мерить было нечего");
    }
    /*
     * Заливка блоков (З-7). Три вопроса, и все три — про вычисленный фон:
     * появился ли он от тумблера, не остался ли он у пустой стороны и ушёл ли
     * обратно. Первый без второго был бы зелен и у подложки поверх всего.
     */
    if (!totals.band) {
      bad("тумблер заливки блоков не найден — проверять было нечего");
    } else {
      const b = totals.band;
      if (!b.bandOn) bad("тумблер заливки блоков не включился");
      if (b.bandBefore !== 0) {
        bad("до включения закрашенных сторон " + b.bandBefore
          + ", а должно быть ноль: тумблер выключен по умолчанию");
      }
      if (b.bandAfter < 2) {
        bad("после включения закрашенных сторон " + b.bandAfter
          + ", а их две — подложка не появилась");
      }
      if (b.bandOnEmpty < 0) {
        bad("пустую сторону некуда было положить: строки с подложкой на панели нет");
      }
      /*
       * **Подложка обязана выходить за написанное** (замечание по S7). Тот
       * самый дефект, с которым он пришёл: она ложилась ровно по пузырю тега,
       * а у пузыря свой непрозрачный цвет — блок из одного тега подложки не
       * показывал вовсе.
       */
      if (!b.bandReach) {
        bad("подложку не с чем сравнить: строки с подложкой и написанным в ней нет");
      } else if (!(b.bandReach.y > 0)) {
        bad("подложка не выходит за написанное по вертикали (" + b.bandReach.y
          + " точек) — под пузырём тега её не видно вовсе");
      }
      /*
       * **Три ориентира шкалы `Band width`**, и каждый — его словами
       * (2026-09-09): «при минимальном значении полоска … от начала
       * первого элемента до конца последнего, при среднем положении —
       * до сепаратора (и зеркально с другой стороны), а при максимальном
       * — включала separator».
       */
      /* Обе стороны — одной высоты, и в них лежит разное. */
      if (!b.bandSides) {
        bad("строку предпросмотра с подложкой нечем обмерить по высоте сторон");
      } else {
        const s = b.bandSides;
        if (Math.abs(s.left - s.right) >= 0.6) {
          bad("высота подложки слева и справа разошлась: " + s.left + " и " + s.right
            + " (внутри " + s.leftInside + " и " + s.rightInside + ", align " + s.align
            + ", поля " + s.leftPad + "/" + s.rightPad + ")"
            + " — в заметке высоту решают настройки, а не содержимое");
        }
        if (Math.abs(s.leftInside - s.rightInside) < 0.6) {
          bad("положительный контроль: в левом и правом блоке предпросмотра лежит"
            + " одинаково высокое (" + s.leftInside + " и " + s.rightInside
            + ") — «высоты равны» выполняется отсутствием предмета");
        }
      }
      const at = b.bandReachAt || {};
      const gap = Number(b.bandGap);
      if (!at["0"] || !at["50"] || !at["100"]) {
        bad("ползунок `Band width` не найден — три ориентира шкалы не измерены");
      } else if (!(gap > 0)) {
        bad("промежуток строки предпросмотра не измерен (" + b.bandGap
          + ") — шкалу не с чем сравнивать");
      } else {
        const zero = at["0"];
        const mid = at["50"];
        const full = at["100"];
        if (Math.abs(zero.x) >= 0.6 || Math.abs(zero.outer) >= 0.6) {
          bad("на нуле подложка не лежит по написанному: к разделителю "
            + zero.x + ", наружу " + zero.outer);
        }
        if (Math.abs(mid.x - gap) >= 1) {
          bad("в середине шкалы подложка не доходит до разделителя: " + mid.x
            + " точек при промежутке " + gap);
        }
        /* Зеркальность: два края ОДНОГО блока, а не два блока. */
        if (Math.abs(mid.outer - mid.x) >= 1) {
          bad("в середине шкалы рост не зеркален: к разделителю " + mid.x
            + ", наружу " + mid.outer);
        }
        if (!(full.x > mid.x + 0.5)) {
          bad("вторая половина шкалы ничего не делает: на середине " + mid.x
            + ", на сотне " + full.x + " — разделитель в подложку не вошёл");
        }
        /*
         * И единственное исключение его же словами: «полоска в left block не
         * должна наезжать на префикс (буллит, чекбокс)» — то есть на
         * сотне наружный рост прижат к промежутку, а рост к разделителю
         * нет.
         */
        if (full.outer >= gap + 0.6) {
          bad("на сотне подложка левого блока заезжает на знак начала строки: наружу "
            + full.outer + " точек при промежутке " + gap);
        }
        if (!(full.outer < full.x - 0.5)) {
          bad("на сотне наружный рост не прижат вовсе: наружу " + full.outer
            + ", к разделителю " + full.x + " — прижим к префиксу не сработал");
        }
      }
      /*
       * И она обязана вырасти, **не** раздвинув строку: в заметке её рисует
       * слой, вёрстки он не касается вовсе. Разошлись эти два места ровно
       * здесь — в панели подложка была больше написанного, в заметке ровно по
       * нему, и заказчик увидел разницу.
       */
      if (String(b.lineHeightsOff) !== String(b.lineHeightsOn)) {
        bad("включение подложки изменило высоту строк предпросмотра: было "
          + b.lineHeightsOff + ", стало " + b.lineHeightsOn
          + " — в заметке слой вёрстку не двигает, и панель не должна");
      }
      if (!Array.isArray(b.lineHeightsOff) || b.lineHeightsOff.length < 3) {
        bad("строк предпросмотра для сверки высоты найдено "
          + (Array.isArray(b.lineHeightsOff) ? b.lineHeightsOff.length : "ни одной"));
      }
      if (b.bandOnEmpty !== 0) {
        bad("подложку получила пустая сторона (" + b.bandOnEmpty
          + "), а условие заказчика — не появляться там, где значений нет");
      }
      if (b.bandBack !== 0) {
        bad("после выключения закрашенных сторон " + b.bandBack + ", а должно быть ноль");
      }
    }
    /* И контроль на сам список исключений: он пуст, и пустым обязан остаться. */
    if (!injection && totals.narrowAllowed !== 0) {
      bad("объявленных узких подсказок " + totals.narrowAllowed + ", а список пуст с "
        + "ответа на В-92: появилось новое исключение без причины и даты");
    }

    if (pageErrors.length) bad("страница ругается: " + pageErrors.slice(0, 3).join(" ;; "));

    console.log("  подсказок " + totals.tips + ", шапок " + totals.heads
      + ", подписей слайдеров " + totals.values
      + ", объявленных узких " + totals.narrowAllowed
      + ", ступеней `Ctrl+A` " + totals.steps
      + ", закрашенных блоков " + (totals.band ? totals.band.bandAfter : "-")
      + (injection ? " | подмена: " + injection : ""));
  } finally {
    await browser.close();
  }

  process.exit(failed ? 1 : 0);
})();
