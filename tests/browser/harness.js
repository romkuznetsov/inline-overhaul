"use strict";

/**
 * Браузер в наборе (PRD 15.4, решение заказчика 2026-09-08).
 *
 * **Зачем.** Заглушка DOM строит дерево и не считает ни одного пикселя. За
 * одну неделю через неё прошли и были найдены **только глазами заказчика**:
 * шесть подсказок в скрытом узле (A44), подсказки шириной с колонку вместо
 * ширины строки (A45), шапки таблиц серым по серому, знак `%`, уехавший на
 * вторую строку. Каждый раз дерево было верным, а экран — нет.
 *
 * **Что здесь можно, а что нельзя.** Настоящим браузером открывается
 * **прототип**: он нормативен по виду панели (Р8), и это наш HTML с нашим CSS.
 * Панель плагина в браузер не поднять — её рисует Obsidian по декларациям, и
 * платформы тут нет. Значит правила вида проверяются на прототипе, а панель
 * по-прежнему сверяется с прототипом гейтами.
 *
 * **Почему шаг отдельный, а не внутри `npm test`.** Chromium — 115 МБ в кеше
 * машины, и без него шаг не запускается вовсе. Тихо пропущенная проверка — это
 * проверка, которой нет (A15), поэтому пропуска здесь не бывает: нет браузера
 * — шаг падает и говорит, чем его поставить. В CI шаг пока не включён
 * (решение заказчика 2026-09-08).
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

function prototypeUrl() {
  const file = path.join(root, "docs", "prototype", "settings_prototype.html");
  if (!fs.existsSync(file)) throw new Error("прототип не найден: " + file);
  return "file:///" + file.replace(/\\/g, "/");
}

/**
 * Браузер берётся здесь и только здесь: если его нет, надо сказать человеку,
 * чем он ставится, а не падать стеком `MODULE_NOT_FOUND`.
 */
function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_e) {
    console.error("браузера в наборе нет. Поставьте его двумя командами:");
    console.error("  npm i -D playwright");
    console.error("  npx playwright install chromium");
    process.exit(2);
  }
  return null;
}

async function openPrototype(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const { chromium } = requirePlaywright();
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error("Chromium не запустился. Поставьте сборку браузера:");
    console.error("  npx playwright install chromium");
    console.error(String((e && e.message) || e));
    process.exit(2);
  }
  const page = await browser.newPage({ viewport: { width: o.width || 900, height: o.height || 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String((e && e.message) || e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console.error: " + m.text()); });
  await page.goto(prototypeUrl());
  await page.waitForSelector(".io-tabs .io-tab");
  return { browser, page, pageErrors };
}

/**
 * Подмена вида, которой проверка проверяется сама (У-88).
 *
 * Каждая запись возвращает панель в то состояние, из которого заказчик уже
 * приносил замечание. Гейт гоняет свои проверки дважды: на нынешнем виде они
 * обязаны пройти, на каждой подмене — упасть. Проверка, которая не краснеет ни
 * на одной подмене, не проверяет ничего.
 */
const INJECTIONS = {
  /* A45: подсказка шириной с имя настройки, а не с блок. */
  "tip-narrow": ".io-tip { width: 90px !important; max-width: 90px !important; }",
  /* A44: подсказка создана, но лежит в спрятанном узле. */
  "tip-hidden": ".io-tip { display: none !important; }",
  /* Шапки таблиц серым по серому. */
  "head-lowcontrast": ".io-tablehead, .io-fields__colhead, .io-vals__head, .io-cmd__head "
    + "{ color: rgba(120,120,128,0.65) !important; background: rgb(150,150,158) !important; }",
  /*
   * Знак процента, уехавший на вторую строку.
   *
   * `min-width` тут обязателен: первая версия этой подмены ставила только
   * `width: 12px`, а у подписи стоит `min-width: 56px`, и она сильнее любой
   * ширины. Подмена применилась и не подменила ничего — проверка осталась
   * зелёной по верной причине. Признак: подмена «сработала», а измеренная
   * величина совпадает с прежней до точки.
   */
  "value-wrap": ".io-value { min-width: 12px !important; width: 12px !important;"
    + " white-space: normal !important; word-break: break-all !important; }",
  /*
   * Заливка блоков (З-7). Две подмены на две половины проверки: подложка,
   * которая есть всегда, и подложка, которой нет никогда. Одной было бы мало —
   * «появилась от тумблера» и «ушла вместе с ним» это разные утверждения.
   */
  "band-always": ".io-line__side--left, .io-line__side--right"
    + " { background-color: rgba(255, 0, 0, 0.5) !important; }",
  "band-none": ".io-line--blockfill .io-line__side--left,"
    + " .io-line--blockfill .io-line__side--right { background-color: transparent !important; }",
  /*
   * Подложка ровно по написанному — тот дефект, с которым заказчик пришёл по
   * S7: под пузырём тега её не видно вовсе, потому что у пузыря свой
   * непрозрачный цвет.
   */
  "band-flat": ".io-line--blockfill .io-line__side--left,"
    + " .io-line--blockfill .io-line__side--right"
    + " { padding: 0 !important; margin: 0 !important; }",
  /*
   * Высота стороны обратно от её содержимого: справа дата и ссылка, слева
   * пузырь — и подложки выходят разной высоты. Ровно это он и увидел в
   * предпросмотре подсказки третьим заходом по S7.
   */
  "band-sides-differ": ".io-line--blockfill { align-items: center !important; }",
  /*
   * Подложка выросла и **раздвинула строку**: поля без парных отрицательных
   * отступов. Так и было в прототипе до 2026-09-09 — и именно поэтому в панели
   * подложка выглядела больше написанного, а в заметке лежала ровно по нему.
   */
  "band-pushes": ".io-line--blockfill .io-line__side--left,"
    + " .io-line--blockfill .io-line__side--right { margin: 0 !important; }",
  /*
   * Рост **односторонний**, только к разделителю. Так и было до 2026-09-09, и
   * заказчик пришёл с этим вторым заходом: «вне зависимости от
   * tags-block-fill-width в left block полоска начинается от начала первого
   * элемента… а слева должна отступать на такое же расстояние, как у правой
   * границы этого block».
   */
  "band-onesided": ".io-line--blockfill .io-line__side--left:not(:empty)"
    + " { padding-left: 0 !important; margin-left: 0 !important; }",
  /*
   * Наружный рост левого блока **не прижат** к знаку начала строки: подложка
   * заезжает на буллит и чекбокс. Единственное исключение, которое он назвал
   * зеркальности, — ровно это.
   */
  "band-onto-prefix": ".io-line--blockfill .io-line__side--left:not(:empty)"
    + " { padding-left: var(--io-blockfill-padx, 3px) !important;"
    + " margin-left: calc(-1 * var(--io-blockfill-padx, 3px)) !important; }",
};

function injectionCss(name) {
  if (!name) return "";
  if (!Object.prototype.hasOwnProperty.call(INJECTIONS, name)) {
    throw new Error("нет подмены с именем " + name + "; есть: " + Object.keys(INJECTIONS).join(", "));
  }
  return INJECTIONS[name];
}

module.exports = { root, prototypeUrl, openPrototype, INJECTIONS, injectionCss };
