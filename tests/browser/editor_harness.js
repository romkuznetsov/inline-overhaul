"use strict";

/**
 * Сборка и открытие страницы редактора настоящим Chromium.
 *
 * Отдельно от `harness.js` нарочно: тот открывает **прототип**, файл без
 * сборки, а здесь надо собрать страницу из `src/**` — иначе в браузер не
 * попадёт ни одного нашего модуля.
 *
 * **Подмены здесь правят исходник, а не стили.** У панели дефект жил в
 * правилах CSS, и подменить их достаточно; у слоя редактора он живёт в коде,
 * считающем прямоугольники. Поэтому подмена — замена куска текста модуля
 * **при сборке страницы**: та же мутация, которой правка проверяется в Node,
 * только доведённая до браузера. Анкер, которого нет, роняет сборку: тихо
 * пропущенная подмена — это подмена, которой нет (A15).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
/*
 * Страница собирается **во временную папку машины**, а не в `dist/`: в `dist/`
 * лежит релиз, и там разрешены ровно три файла — это держит
 * `release_bundle_tests.js`, и держит верно. Первая версия гейта положила
 * страницу туда и уронила его.
 */
const outDir = path.join(os.tmpdir(), "inline-overhaul-editor-gate");

/**
 * Подмены: каждая возвращает слой в то состояние, из которого заказчик уже
 * приносил замечание по S7.
 *
 * `file` — путь от корня репозитория, `find` и `replace` — текст. Ровно одно
 * вхождение, иначе подмена не адресует предмет.
 */
const EDITOR_INJECTIONS = {
  /*
   * **Написанное в куске больше не мерится** — подложка возвращается на
   * вертикаль ряда. Ровно это и было до 2026-09-16, и ровно на это его второе
   * замечание `G4`: «сверху и снизу от values в технических блоках должно
   * оставаться одинаковое расстояние до границ полоски».
   *
   * Прежде эта подмена снимала вертикаль целиком (`box = null`), и предметом
   * её была первая половина того же правила — «вертикаль из измеренного, а не
   * из прямоугольника платформы» (2026-09-09, про ссылку). Обе половины
   * краснеют здесь: без меры куска подложка съезжает с написанного и на
   * строке со ссылкой, и на строке с уменьшенным `Tags text size`.
   */
  /*
   * **Подмена `vertical-measured` снята 2026-09-19, и вот чем это измерено.**
   *
   * Она снимала измерение написанного, и слой уходил на запасной путь — к
   * вертикали ряда. Пока значения в Block стояли `vertical-align: middle`, два
   * этих ответа расходились заметно. С этого дня значение стоит базовой линией
   * и поднимается на посчитанную величину (его слово: «при 100 текст в
   * left/right block должен быть таким же как в text block»), то есть наше
   * написанное совпало с написанным самой строки — и два ответа сошлись:
   * обмерено на всех строках страницы, промах 0,62 в верном состоянии против
   * 1,01 под подменой. Порог между такими числами был бы порогом на шум
   * машины (У-78), а зелёная подмена — хуже отсутствующей (правило 145).
   *
   * **Чем область закрыта вместо неё:** «написанное в Block на уровне текста
   * строки» (30 пар, промах 0) и «подложка серединой на написанном своего
   * ряда» с порогом 1,5 — на нём подмена `row-height-default` даёт 3,9…6,2, то
   * есть в четыре раза больше порога.
   */
  /*
   * Рост обратно односторонний, только к разделителю: «вне зависимости от
   * tags-block-fill-width в left block полоска начинается от начала первого
   * элемента».
   */
  "growth-onesided": {
    file: "src/ui/editor/decorations.js",
    find: "      const growLeft = span.zone === \"right\" ? (first ? padX : 0) : (first ? outward : 0);\n"
      + "      const growRight = span.zone === \"left\" ? (last ? padX : 0) : (last ? outward : 0);",
    replace: "      const growLeft = span.zone === \"right\" && first ? padX : 0;\n"
      + "      const growRight = span.zone === \"left\" && last ? padX : 0;",
  },
  /* Прижим к знаку начала строки снят: подложка заезжает на чекбокс. */
  "no-prefix-clamp": {
    file: "src/ui/editor/decorations.js",
    find: "    const outward = Math.min(padX, room);",
    replace: "    const outward = padX;",
  },
  /*
   * Середина подложки обратно от **умолчания** редактора, а не от высоты своей
   * строки. Ровно это и было до третьего захода по S7: «полоска выглядит
   * нецентрированной — она смещена выше (сверху строки она выглядит больше,
   * чем снизу строки)». Видно только на строке, которая выше умолчания, —
   * такая на странице есть, и её высоту гейт проверяет отдельно.
   */
  /*
   * **Пузырь снова берёт кегль строки, а не кегль тега** — состояние до
   * 2026-09-21, из которого пришло его замечание «в режиме редактирования тег
   * визуально больше, чем в просмотре». Всем прежним утверждениям страницы эта
   * подмена не видна: пузырь нарисован, цвет его, ящик на месте.
   */
  "bubble-takes-line-size": {
    file: "src/ui/editor/decorations.js",
    find: "      ? this.tagBasePx\n      : this.basePx;",
    replace: "      ? this.basePx\n      : this.basePx;",
  },
  "row-height-default": {
    file: "src/ui/editor/decorations.js",
    find: "  const rowH = ink ? ink.height : geom.rowH;",
    replace: "  const rowH = rows > 1 && geom.blockHeight > 0 ? geom.blockHeight / rows : geom.lineH;",
  },
  /*
   * **Здесь стояли две подмены про вертикаль по ящику строки** —
   * `heading-band-by-block` и `heading-band-by-border-box`, — и сняты они
   * правкой `G4` второго захода (2026-09-16). Вертикаль подложки больше не
   * считается от ящика строки: её задаёт написанное в самом куске, а ящик
   * строки остался запасным путём, на который гейт не заходит вовсе. Пин на
   * недостижимом пути зелен и не стережёт ничего (У-141).
   *
   * Их предмет стережёт `vertical-measured`: она снимает саму меру куска, и
   * подложка возвращается на ту вертикаль, из-за которой он и писал «полоска
   * смещена выше».
   */
  "heading-clamp-by-row": {
    file: "src/ui/editor/decorations.js",
    find: "  const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : clampRowH * rows);\n"
      + "  return { top: Math.max(blockTop, Math.min(top, blockBottom - height)), height };",
    replace: "  const rowsBottom = rowsTop + (Number(geom.rowsHeight) > 0 ? Number(geom.rowsHeight) : clampRowH * rows);\n"
      + "  return { top: Math.max(rowsTop, Math.min(top, rowsBottom - height)), height };",
  },
  /*
   * **Подмены `tail-row-invented` здесь больше нет, и это не потеря.**
   *
   * Она возвращала остаток строки **новой** зрительной строкой — состояние до
   * 2026-09-14, «артефакты right block в конце полоски». Предмет её ушёл
   * вместе с правилом (У-94, У-141): обход рядов останавливаться раньше конца
   * строки больше не умеет, потому что границу ряда называет один вопрос — тот
   * самый, каким её задаёт отрисовка, — и на последнем ряду он отвечает концом
   * строки. Дописывать стало нечего, и правила дописывания в продукте нет.
   */
  /*
   * Номер зрительной строки у куска перестаёт учитываться: подложки всех
   * кусков перенесённой строки встают на её первую строку. Это половина того,
   * на что он пожаловался 2026-09-13 («если строка становится длинной, то
   * полоска tags-block-fill начинает вести себя неадекватно»), и видно это
   * только на строке, которая и правда переносится.
   */
  "piece-row-ignored": {
    file: "src/ui/editor/decorations.js",
    find: "  const rowTop = ink ? ink.top : rowsTop + geom.rowH * (Number(piece.row) || 0);",
    replace: "  const rowTop = rowsTop;",
  },
  /*
   * Своё измерение рядов отключено: когда платформа не отвечает, где кончается
   * зрительная строка, резать становится нечем. Тогда кусок уходит одним, а
   * платформа рисует его выделением — во всю ширину окна. Ровно это заказчик
   * и увидел 2026-09-13 (10.13.103).
   */
  /*
   * **Ряды не режутся вовсе: кусок уходит одним, как до 2026-09-13.**
   *
   * Заведена 2026-09-13 как положительный контроль к утверждению «подложка не
   * доходит до правого края там, где написанное до края не дошло». У того
   * утверждения предмета не было ни одного: в здоровой странице до края не
   * доходит ни одна подложка (обмерено — 0 из 20 при крае 520), а подмена
   * `row-measure-off` его больше не даёт, потому что отказ измерения
   * подхватывает запасной путь. То есть утверждение было зелено от пустоты
   * (У-88), и восемь семейств шрифтов с семнадцатью ширинами ящика ничего не
   * меняли именно поэтому.
   *
   * Здесь отказывают **оба** пути разом, и кусок, пересекающий зрительные
   * строки, платформа рисует выделением — прямоугольником до правого края.
   * Это ровно то, что видел заказчик (10.13.103), и ровно то, о чём утверждение.
   */
  "rows-never-cut": {
    file: "src/ui/editor/decorations.js",
    find: "  const rows = [];\n  const at0 = Number.isFinite(Number(span.lineFrom))",
    replace: "  if (view) return null;\n  const rows = [];\n  const at0 = Number.isFinite(Number(span.lineFrom))",
  },
  /*
   * **Ответ платформы о границе ряда принимается на слово** — состояние до
   * 2026-09-14, вечер. Граница, названная платформой, и граница, по которой
   * платформа же рисует, расходятся на знак, и этого хватает: кусок становится
   * пересекающим ряды, и рисуется он выделением. Видно это только тогда, когда
   * платформа и правда промахнулась, — поэтому подмена работает в паре с
   * подделкой `__ioWrongRowBoundary` на странице.
   *
   * Прежняя подмена на этом месте — `row-measure-off` — отключала запасной
   * путь измерения рядов. Пути этого больше нет: он был вторым объявлением
   * того же правила и снят вместе с правкой (У-150), а вместе с ним ушёл и его
   * предмет (У-94).
   */
  "row-boundary-unchecked": {
    file: "src/ui/editor/decorations.js",
    find: "  if (Number.isFinite(head) && head > pos && head <= line.to\n"
      + "    && sameRow(blockFillRowTopAt(view, head, -2))\n"
      + "    && !sameRow(blockFillRowTopAt(view, head, 2))) {\n"
      + "    return head;\n"
      + "  }",
    replace: "  if (Number.isFinite(head) && head > pos && head <= line.to) return head;",
  },
  /*
   * Нажатие по подменённому значению снова гасится — ровно то состояние, в
   * котором он написал «не понимаю, как работает link-draggable, ничего не
   * меняется»: браузер не начинает перетаскивание после `preventDefault` на
   * `mousedown`.
   */
  "link-shown-swallows-mousedown": {
    file: "src/ui/editor/decorations.js",
    find: "    el.addEventListener(\"mousedown\", (ev) => { ev.stopPropagation(); });",
    replace: "    el.addEventListener(\"mousedown\", (ev) => { ev.preventDefault(); ev.stopPropagation(); });",
  },
  /*
   * Подменённое значение перестаёт быть атомарным: курсор снова идёт по
   * спрятанным знакам — ровно то, на что он пожаловался 2026-09-20 («приходится
   * нажать столько раз, сколько знаков в реальном значении»).
   */
  "link-shown-not-atomic": {
    file: "src/ui/editor/decorations.js",
    find: "              atomic: true,",
    replace: "              atomic: false,",
  },
  /*
   * Значение-ссылка со своим текстом обратно не рисуется: то состояние, в
   * котором `Show = custom` у ссылки не делал ничего (его заказ 2026-09-20,
   * пункт 14). Ломается **правило**, а не скорость: ветка замены не
   * исполняется вовсе (правило 144).
   */
  "link-shown-never": {
    file: "src/ui/editor/decorations.js",
    find: "        if (entry.kind === \"link\") {",
    replace: "        if (false) {",
  },
  /*
   * И обратная беда: ссылка заменяется **всегда**, даже при `default`. Так
   * человек терял бы переход по ссылке всюду, где у значения нет своего
   * текста.
   */
  "link-shown-always": {
    file: "src/ui/editor/decorations.js",
    find: "          const linkText = resolveEffectiveTagVisualMode(linkLook) === \"custom\"\n"
      + "            ? String(linkLook.customText || \"\").trim()\n"
      + "            : \"\";",
    replace: "          const linkText = String(linkLook.customText || \"\").trim() || token;",
  },
  /*
   * Знак заголовка обратно становится тегом: «`##` (уровень хедера) стал
   * пузырьком — этого не должно быть».
   */
  "heading-is-a-tag": {
    file: "src/core/editor_visuals_config.js",
    find: "  const headingLen = __sharedUtils.headingPrefixLength(src);",
    replace: "  const headingLen = 0;",
  },
  /*
   * Шкала высоты обратно упирается в потолок на середине: «tags-block-fill-height
   * изменяются только при значениях ползунка от 0 до 2 px, а при значениях от 3
   * до 5 высота как при 2px».
   */
  "height-scale-capped": {
    file: "src/core/editor_visuals_config.js",
    find: "  const pct = Math.max(0, Math.min(BLOCK_FILL_MAX_HEIGHT_PCT, Number(look && look.heightPct) || 0));",
    replace: "  const pct = Math.max(0, Math.min(40, Number(look && look.heightPct) || 0));",
  },
  /*
   * Прижим к плавающей кнопке снят: подложка правого блока снова заходит ей за
   * спину — то, о чём он написал вторым заходом («полоска захватывает
   * i2n-floating») и что решил третьим («прижать к кнопке, как прижата к
   * чекбоксу слева»).
   */
  "no-fly-clamp": {
    file: "src/ui/editor/decorations.js",
    find: "  if (!(buttonLine > 0)) return Infinity;\n  /* Кнопка стоит за концом строки: блок, кончающийся раньше, её не касается. */",
    replace: "  if (buttonLine >= 0) return Infinity;\n  /* Кнопка стоит за концом строки: блок, кончающийся раньше, её не касается. */",
  },
  /*
   * И обратная ошибка того же прижима: мера «ноль» вместо «мерить нечего».
   * Тогда наружный рост правого блока пропадает на **каждой** строке, а
   * зеркальность — его условие.
   */
  "fly-clamp-everywhere": {
    file: "src/ui/editor/decorations.js",
    find: "  if (span.to !== span.lineTo) return Infinity;",
    replace: "  if (span.to !== span.lineTo) return 0;\n  return 0;",
  },
  /*
   * Поле пузыря обратно целым числом точек: «tags-bubble-height при значении
   * ниже 40 % не меняется (т.е. при 20 % высота такая же как при 40 %)».
   */
  /*
   * Пузырь снова равняется базовой линией: «текст уменьшается, но остаётся
   * выровненным по нижней границе строки» (2026-09-16).
   */
  /*
   * Пузырь обратно по базовой линии. **Якорь взят с соседней строкой**: после
   * `G4` выравнивание по середине объявлено дважды — у пузыря и у значения,
   * которому пузырь не рисуется, — и короткий якорь перестал адресовать
   * предмет. Поймал это сам стенд: подмена требует ровно одного вхождения.
   */
  "bubble-baseline": {
    file: "styles.css",
    find: "  vertical-align: var(--io-tagbubble-rise, 0px);\n  border-radius: var(--io-tagbubble-radius);",
    replace: "  vertical-align: baseline;\n  border-radius: var(--io-tagbubble-radius);",
  },
  /*
   * **Подъём снят — вернулось `middle`**, то состояние, из которого пришло его
   * замечание 2026-09-19: «при 100 текст в left/right block должен быть таким
   * же как в text block». `middle` ставит середину ящика на середину высоты x,
   * и на сотне процентов промах 1,58 точки.
   */
  "bubble-middle": {
    file: "styles.css",
    find: "  vertical-align: var(--io-tagbubble-rise, 0px);\n  border-radius: var(--io-tagbubble-radius);",
    replace: "  vertical-align: middle;\n  border-radius: var(--io-tagbubble-radius);",
  },
  /*
   * **Подмены `blockvalue-baseline` здесь больше нет, и это не потеря.**
   *
   * Она возвращала ссылку и эмодзи-элемент в Block на базовую линию — то
   * состояние, из которого он принёс второе замечание `G4`. Пока вертикаль
   * подложки считалась по ряду, снятие правила стоило пяти точек. Теперь
   * подложка следует за самими значениями, и снятие двигает худший промах с
   * 1,2 до 1,95 на его настройках: порог между этими числами был бы порогом на
   * доли точки, а такой краснеет от смены шрифта на чужой машине (У-176).
   *
   * Само правило остаётся — оно и лучше на треть точки, и ставит значения на
   * одну линию с пузырями, — а стережёт весь механизм `vertical-measured`.
   */
  "bubble-pad-rounded": {
    file: "src/core/editor_visuals_config.js",
    find: "    verticalPaddingPx: Math.max(0, Math.round(3 * bubbleScaleY * 100) / 100),",
    replace: "    verticalPaddingPx: Math.max(0, Math.round(3 * bubbleScaleY)),",
  },
  /*
   * Прижим высоты к зрительной строке снят: «после высоты в 3px полоски на
   * разных строках начинают наезжать друг на друга».
   */
  "no-row-clamp": {
    file: "src/core/editor_visuals_config.js",
    find: "  return Math.max(1, Math.min(lineH, written + (room * pct) / 100));",
    replace: "  return Math.max(1, written + (room * pct) / 100);",
  },
  /* Шкала ширины обратно без перелома на середине: разделитель в подложку не
     входит ни при каком положении ползунка. */
  "width-no-midpoint": {
    file: "src/core/editor_visuals_config.js",
    find: "  if (pct <= 50) return (nearOk * pct) / 50;",
    replace: "  return (nearOk * pct) / 100;\n  if (pct <= 50) return (nearOk * pct) / 50;",
  },
  /*
   * Размеры `Inline appearance` обратно едут к пузырю в любой зоне: ровно так
   * и было до 2026-09-12, и заказчик увидел это так — «tags-text-size меняет
   * высоту… и тегов между сепараторами».
   */
  "middle-takes-sizing": {
    file: "src/ui/editor/decorations.js",
    find: "        const sizing = tagVisualSizingForZone(entry.zone, visuals);",
    replace: "        const sizing = { textSizePct: visuals.tagTextSizeLeftPct,"
      + " bubbleWidthPct: visuals.tagBubbleWidthPct,"
      + " bubbleHeightPct: visuals.tagBubbleHeightPct,"
      + " emptyBubblePct: visuals.emptyBubbleSizePct };",
  },
  /*
   * И обратная ошибка того же правила: размеры перестают доезжать **вообще
   * никуда**. Без этой подмены утверждение «в середине не выросло» было бы
   * зелёным и у слоя, который не рисует размеров ни в одном блоке.
   */
  "block-loses-sizing": {
    file: "src/core/editor_visuals_config.js",
    find: "  const inBlock = zone === \"left\" || zone === \"right\";",
    replace: "  const inBlock = false;",
  },
  /*
   * Тег без своего цвета обратно остаётся тегом темы: пузыря ему не рисуется,
   * и настройки размера до него не доезжают — ровно то, с чего началось
   * замечание 2026-09-12.
   */
  "plain-tag-no-bubble": {
    file: "src/ui/editor/decorations.js",
    find: "        const drawsOwnBubble = entry.kind !== \"link\"\n"
      + "          && (hasVisualOverride || (entry.kind === \"tag\" && ourLine));",
    replace: "        const drawsOwnBubble = entry.kind !== \"link\" && hasVisualOverride;",
  },
  /*
   * И та же правка, хватившая лишнего: пузырь рисуется тегу в **любой** строке,
   * в том числе в обычной заметке без разделителей. Ровно эту границу заказчик
   * назвал сам: «обычные заметки без разделителей плагин не трогает вовсе».
   */
  "plain-tag-any-line": {
    file: "src/ui/editor/decorations.js",
    find: "        const drawsOwnBubble = entry.kind !== \"link\"\n"
      + "          && (hasVisualOverride || (entry.kind === \"tag\" && ourLine));",
    replace: "        const drawsOwnBubble = entry.kind !== \"link\" && (hasVisualOverride || entry.kind === \"tag\");",
  },
  /*
   * Обратная ошибка того же правила: строкой плагина считается только та, где
   * есть **оба** разделителя. Тогда его собственная строка со скриншотом — с
   * одним `||` — снова остаётся без пузырей.
   */
  "our-line-needs-both": {
    file: "src/core/editor_visuals_config.js",
    find: "  return at.first >= 0 || at.last >= 0;",
    replace: "  return at.first >= 0 && at.last >= 0 && at.first !== at.last;",
  },
  /*
   * Заливка у пузыря без своего цвета потеряна: тег пропадает с глаз. Ровно
   * это и вышло у заказчика на первой версии правки, где заливка бралась из
   * `--tag-background`, а его тема объявляет её прозрачной.
   */
  "plain-tag-colorless": {
    file: "styles.css",
    find: "  background-color: var(--interactive-accent);",
    replace: "  background-color: transparent;",
  },
  /*
   * Оверлей скроллера: правило показа сломано. Перенос `display` из свойств
   * узла в класс (Р7) тем и опасен, что правило теперь живёт в другом файле, и
   * набор на заглушке DOM стилей не читает вовсе — эту половину видит только
   * браузер.
   */
  /*
   * Подменяется **имя класса в правиле**, а не его значение, и это не
   * придирка: коробка закреплена на экране (`position: fixed`), а браузер у
   * закреплённого узла приводит `display` к блоку сам. Первая версия этой
   * подмены ставила `display: inline` — применилась и не сдвинула измеряемое,
   * то есть была сломана сама (У-110). Опечатка в имени класса правило
   * отключает по-настоящему, и коробка остаётся спрятанной.
   */
  "scroller-shown-broken": {
    file: "styles.css",
    find: ".io-twscroller--shown { display: block; }",
    replace: ".io-twscroller--shows { display: block; }",
  },
  /* И вторая половина того же переноса: умолчание «взять у темы» уехало из
     кода в правило, и там его можно потерять. */
  "scroller-fill-lost": {
    file: "styles.css",
    find: "  background: var(--io-twscroller-fill, var(--background-primary));",
    replace: "  background: transparent;",
  },
};

function requireEsbuild() {
  try {
    return require("esbuild");
  } catch (_e) {
    console.error("сборщика в наборе нет: npm i");
    process.exit(2);
  }
  return null;
}

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

/** Подмена по имени, с проверкой, что она ещё адресует предмет. */
function injectionSpec(name, list) {
  if (!name) return null;
  const from = list || EDITOR_INJECTIONS;
  if (!Object.prototype.hasOwnProperty.call(from, name)) {
    throw new Error("нет подмены с именем " + name
      + "; есть: " + Object.keys(from).join(", "));
  }
  return from[name];
}

/** Один и тот же текстовый обмен, откуда бы файл ни читался. */
function applyInjection(name, spec, src) {
  const hits = src.split(spec.find).length - 1;
  if (hits !== 1) {
    throw new Error("подмена " + name + ": вхождений " + hits
      + ", а нужно ровно одно — она больше не адресует предмет");
  }
  return src.replace(spec.find, spec.replace);
}

/**
 * Плагин сборки, отдающий страницам то, что посчитано в Node.
 *
 * Нужен он одному: конфиг для проверки берётся из фикстуры **через
 * `migrateConfig`** (правило 2), а `migrateConfig` тянет за собой пол-ядра и
 * чтение файла. Считается он здесь, в Node, а страница получает готовый ответ
 * по имени `virtual:<что>`. Своей копии правил у страницы при этом нет: и
 * конфиг, и текст правил, и ключи рантайма сделаны теми же функциями, какими
 * их делает плагин.
 */
function virtualPlugin(modules) {
  if (!modules) return null;
  const names = Object.keys(modules);
  if (!names.length) return null;
  return {
    name: "io-virtual",
    setup(build) {
      build.onResolve({ filter: /^virtual:/ }, (args) => {
        if (!Object.prototype.hasOwnProperty.call(modules, args.path)) {
          throw new Error("страница просит " + args.path + ", а его никто не посчитал");
        }
        return { path: args.path, namespace: "io-virtual" };
      });
      build.onLoad({ filter: /.*/, namespace: "io-virtual" }, (args) => ({
        contents: "module.exports = " + JSON.stringify(modules[args.path]) + ";",
        loader: "js",
      }));
    },
  };
}

/** Плагин сборки, который правит текст модуля по имени подмены. */
function injectionPlugin(name, list) {
  const spec = injectionSpec(name, list);
  /* Лист стилей в сборку не идёт: его читает страница, и подменяется он там. */
  if (!spec || spec.file === "styles.css") return null;
  const target = path.join(root, spec.file);
  return {
    name: "io-injection",
    setup(build) {
      build.onLoad({ filter: /\.js$/ }, (args) => {
        if (args.namespace && args.namespace !== "file") return null;
        if (path.resolve(args.path) !== path.resolve(target)) return null;
        const src = fs.readFileSync(args.path, "utf8");
        return { contents: applyInjection(name, spec, src), loader: "js" };
      });
    },
  };
}

const PAGE_CSS = [
  "html, body { margin: 0; padding: 0; background: #ffffff; }",
  /*
   * **Переменные темы объявлены здесь числами.** В Obsidian их задаёт тема, и
   * без них каждое наше `var(--background-primary)` вычисляется в ничто: фон
   * коробки оверлея выходил прозрачным, и проверка «пустой цвет значит взять у
   * темы» оказалась бы зелёной от отсутствия предмета (У-88). Значения взяты
   * из `app.css` Obsidian 1.13.7, светлая тема.
   */
  ":root {"
    + " --background-primary: #ffffff;"
    + " --background-modifier-border: #e0e0e0;"
    + " --background-modifier-hover: #f2f2f2;"
    + " --text-normal: #222222;"
    + " --text-muted: #6e6e6e;"
    + " --text-faint: #999999;"
    + " --text-accent: #705dcf;"
    + " --text-on-accent: #ffffff;"
    + " --interactive-accent: #705dcf;"
    + " --font-text: sans-serif;"
    + " --font-monospace: monospace;"
    + " --radius-s: 4px;"
    + " --shadow-s: 0 1px 2px rgba(0,0,0,0.1);"
    /*
     * Переменные тега — те самые, которыми Obsidian рисует `.cm-hashtag`
     * (`app.css` 1.13.7, строка 2800). Наш пузырь берёт их у тега без своего
     * цвета, и без них «фон взят у темы» проверялось бы отсутствием предмета
     * (У-88): пустая переменная вычисляется в прозрачность.
     */
    /*
     * **`--tag-size` объявлена нарочно, и без неё проверять было бы нечего.**
     * Ею Obsidian рисует и `a.tag` в режиме просмотра, и `.cm-hashtag` в
     * редакторе; у неё умолчание `0.875em`, у его темы Minimal `0.8em`. Здесь
     * стоит его величина: предмет правила — «наш пузырь такого же кегля, как
     * тег платформы», и на равном кегле оно выполнялось бы само (У-147).
     */
    + " --tag-size: 0.8em;"
    + " --tag-background: rgba(112, 93, 207, 0.1);"
    + " --tag-background-hover: rgba(112, 93, 207, 0.2);"
    + " --tag-color: #705dcf;"
    + " --tag-weight: inherit;"
    + " --cursor-link: pointer;"
    + " }",
  /*
   * Ящик, который снаружи выглядит редактором заметки: правила плагина
   * адресуют именно эти два класса, и без них ни одно из них не применится.
   */
  /*
   * **`IO_GATE_WIDTH` — второй положительный контроль к машине.** Ширина
   * ящика вместе с шириной знака решает, где встанет перенос, а перенос
   * участвует в измерениях. Гейт обязан оставаться зелёным на любой
   * ширине, при которой строка ещё переносится:
   * `IO_GATE_WIDTH=470 npm run gate:browser`.
   */
  ".markdown-source-view.mod-cm6 { width: " + (Number(process.env.IO_GATE_WIDTH) || 520) + "px; }",
  /*
   * Начертание задано числами нарочно: «как у меня в Obsidian» — это
   * состояние чужой машины, а гейт обязан мерить одно и то же на любой.
   * Отношение междустрочия к кеглю взято близким к его теме (33 к 16 точкам),
   * потому что именно оно решает, сколько места у подложки над написанным.
   */
  /*
   * **`IO_GATE_FONT` — не настройка, а положительный контроль к машине.**
   * Ширина знака решает, где встанет перенос, а перенос участвует в
   * измерениях: ровно этим шаг упал в CI, оставаясь зелёным у меня (У-78).
   * Переменная подставляет другое семейство, и гейт обязан остаться
   * зелёным на каждом: `IO_GATE_FONT=serif npm run gate:browser`. Если
   * перестал — измерение снова прицепилось к шрифту машины.
   */
  ".cm-editor { font-size: 16px; font-family: " + (process.env.IO_GATE_FONT || "monospace") + "; }",
  /*
   * Междустрочие задаётся на `.cm-line`, а не на редакторе: своё правило
   * CodeMirror ставит именно туда, и с редактора оно не переопределяется —
   * первая версия этих стилей поставила `line-height` на `.cm-editor` и
   * получила прежнюю высоту строки до точки (У-110).
   */
  ".cm-content, .cm-line { line-height: 2 !important; }",
  ".cm-content { padding: 4px 8px; }",
  /*
   * ПОДДЕЛКА OBSIDIAN: строчный ящик ссылки выше ящика соседнего текста.
   * Величина обмерена по 18.png — пять точек, — и она меньше междустрочия,
   * то есть высоту самой строки ссылка не двигает. Ровно так ведёт себя
   * ссылка у заказчика: подложка стала выше, а строки остались на месте.
   */
  ".io-probe-link { font-size: 21px; }",
  /*
   * ПОДДЕЛКА OBSIDIAN: строка-заголовок. Подделаны два свойства, и оба
   * обмерены по его скриншотам 2026-09-13: кегль крупнее соседнего текста и
   * **отступ сверху**. Отступ тут не украшение — он и есть предмет: ящик
   * строки у заголовка выше написанного, и лишнее место лежит **над** буквами.
   * Подложка, поставленная по середине ящика, от этого уезжает вверх — на его
   * картинке на десять точек из сорока.
   *
   * **Отступ задан `padding`, и это не мой выбор, а правило Obsidian.** Первая
   * версия этой подделки написала `margin-top`, и разница между ними решает
   * весь дефект: `getBoundingClientRect` отдаёт ящик **границы**, поле снаружи
   * него, а отступ внутри. То есть на `margin` мера «по узлу строки» работала,
   * и гейт был зелёный, а у заказчика — `padding`, и та же мера не двигала
   * ничего. Ровно это он и написал следующим письмом: «полоса по прежнему
   * выше» (У-147: совпадающей стороной было моё же предположение о форме
   * отступа).
   *
   * **Числа не придуманы, а сняты с его связки** — лист `app.css` Obsidian
   * 1.13.7 и тема Minimal из его vault, открытые тем же Chromium:
   *
   *   * отступ — `padding-top: 14px`
   *     (`.cm-line.HyperMD-header { padding-top: calc(var(--p-spacing) / 2) }`
   *     темы при `--p-spacing: 1.75rem`);
   *   * кегль — `16.8px` (`--h2-size: 1.05em`), междустрочие — `1.2`
   *     (`--h2-line-height`), то есть написанное в заголовке **ниже** обычной
   *     строки: 20.16 против 24.
   *
   * Второе не украшение, а предмет: высота подложки одна на все строки (его
   * условие), и на такой строке она **выше** написанного. Прижим на этой
   * странице от этого работает по-настоящему, а не вхолостую.
   *
   * `!important` у междустрочия — потому что общее правило страницы задано с
   * ним же; это не выбор, а цена того правила.
   */
  /*
   * Два класса в образце — не украшение: своё `.cm-line { padding: … }`
   * CodeMirror вкладывает в страницу позже нашего листа, и при равной
   * силе выигрывает оно (У-67). Obsidian пишет то же самое и той же силой:
   * `.cm-s-obsidian .cm-line.HyperMD-header`.
   */
  ".cm-line.io-probe-heading { font-size: 16.8px; line-height: 1.2 !important;"
    + " font-weight: 600; padding-top: 14px; }",
].join("\n");

async function buildPage(injection, opts) {
  const entry = (opts && opts.entry) || "editor_page.js";
  const base = entry.replace(/\.js$/, "");
  const esbuild = requireEsbuild();
  fs.mkdirSync(outDir, { recursive: true });
  const plugins = [];
  const p = injectionPlugin(injection, opts && opts.injections);
  if (p) plugins.push(p);
  const v = virtualPlugin(opts && opts.virtual);
  if (v) plugins.push(v);
  const bundleFile = path.join(outDir, base + ".bundle.js");
  const built = await esbuild.build({
    entryPoints: [path.join(__dirname, entry)],
    bundle: true,
    format: "iife",
    outfile: bundleFile,
    platform: "browser",
    absWorkingDir: root,
    logLevel: "silent",
    /* Состав страницы нужен мере покрытия (`Р-7`), и только ей: см. ниже. */
    metafile: !!String(process.env.IO_COVERAGE_OUT || "").trim(),
    plugins,
  });
  writeBundleMap(built, bundleFile);
  /*
   * **Чужие правила по требованию.** `IO_GATE_EXTRA_CSS` — путь к файлу стилей,
   * который вкладывается в страницу ПЕРЕД нашими: так проверяется каскад
   * против настоящего `app.css` Obsidian при переносе оформления из свойств
   * узла в классы (правило каталога Р7). Перенос **опускает** специфичность,
   * и правило, которое прежде проигрывало инлайну, после переноса может
   * выиграть — вопрос не теоретический, и отвечает на него только каскад.
   *
   * В самом гейте этой переменной нет: `app.css` лежит в установке Obsidian на
   * машине человека, и гейт, зависящий от файла вне репозитория, зелен по
   * случайности (У-78).
   */
  const extra = String(process.env.IO_GATE_EXTRA_CSS || "").trim();
  const extraCss = extra && fs.existsSync(extra) ? fs.readFileSync(extra, "utf8") : "";
  if (extra && !extraCss) throw new Error("IO_GATE_EXTRA_CSS указывает на файл, которого нет: " + extra);
  const cssSpec = injectionSpec(injection, opts && opts.injections);
  let pluginCss = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
  if (cssSpec && cssSpec.file === "styles.css") {
    pluginCss = applyInjection(injection, cssSpec, pluginCss);
  }
  const html = [
    "<!doctype html><meta charset=utf-8>",
    extraCss ? "<style>" + extraCss + "</style>" : "",
    /* Свой лист плагина — тот самый файл, что Obsidian читает у человека. */
    "<style>", pluginCss, "</style>",
    "<style>", PAGE_CSS, "</style>",
    "<div class='markdown-source-view mod-cm6'><div id=host></div></div>",
    "<script src='" + base + ".bundle.js'></script>",
  ].join("\n");
  const page = path.join(outDir, base + ".html");
  fs.writeFileSync(page, html);
  return "file:///" + page.replace(/\\/g, "/");
}

/**
 * Карта страницы: какому файлу принадлежит каждый кусок собранного бандла
 * (`Р-7`).
 *
 * **Зачем она мере покрытия.** Покрытие браузера снимается с бандла, файлов
 * `src/**` в нём нет, и сложить две дороги надо чем-то одним. По **именам**
 * складывать нельзя: имена методов повторяются, и измерение это показало —
 * семь имён из двадцати имели в странице больше одного носителя, а спорили они
 * с самим CodeMirror (`toDOM`, `decorations`, `markers`, `clear`, `destroy`,
 * `sync`, `measure`). Кредит по имени записал бы нам исполнение чужого кода.
 *
 * **Складываем по месту.** esbuild помечает каждый модуль строкой-комментарием
 * с его путём, и путь этот — ровно ключ из `metafile.inputs`. Отсюда границы
 * кусков, а из них — владелец любого смещения в бандле. Совпадение с `inputs`
 * требуется точное: комментарий, похожий на пометку, но не названный сборщиком
 * входом, границей не считается.
 *
 * Пишется рядом с покрытием и только когда покрытие просят.
 */
function writeBundleMap(built, bundleFile) {
  const outPath = String(process.env.IO_COVERAGE_OUT || "").trim();
  if (!outPath) return;
  const meta = built && built.metafile;
  if (!meta || !meta.inputs) {
    console.error("[gate:browser] esbuild не отдал состав страницы — мера покрытия будет неполной");
    return;
  }
  try {
    const inputs = Object.keys(meta.inputs).map((p) => p.replace(/\\/g, "/"));
    const known = new Set(inputs);
    const text = fs.readFileSync(bundleFile, "utf8");
    const sections = [];
    const re = /(^|\n)[ \t]*\/\/ (\S+)[ \t]*(?=\n)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const rel = m[2].replace(/\\/g, "/");
      if (!known.has(rel)) continue;
      sections.push([m.index + (m[1] ? m[1].length : 0), rel]);
    }
    sections.sort((a, b) => a[0] - b[0]);
    if (!sections.length) {
      console.error("[gate:browser] в бандле не нашлось ни одной пометки модуля —"
        + " мера покрытия не сможет назвать владельца куска");
    }
    fs.mkdirSync(outPath, { recursive: true });
    const name = "browser-inputs-" + process.pid + "-" + Date.now() + ".json";
    fs.writeFileSync(path.join(outPath, name), JSON.stringify({
      bundle: path.basename(bundleFile),
      inputs,
      sections,
    }));
  } catch (e) {
    console.error("[gate:browser] карта страницы не записалась: " + String((e && e.message) || e));
  }
}

/**
 * Снять покрытие с браузерной дороги (`Р-7`).
 *
 * **Зачем.** `NODE_V8_COVERAGE` видит только то, что исполняет Node, а слой
 * оформления и сессия TagWheel исполняются **здесь**, в странице. Пока покрытие
 * снималось с одной дороги из двух, число неисполненных имён нельзя было ни во
 * что превратить: часть из них исполняет именно браузер
 * (`docs/dev/AUDIT_2026-09-18.md`, 4.8).
 *
 * **Складывается по именам, а не по процентам.** Страница — это бандл esbuild,
 * файлов `src/**` в ней нет: имя одно, файлов два (У-148 в сторону самой меры).
 * Ровно так же `coverage_map.js` уже считает `dist/main.js`.
 *
 * **Форма файла — та же, что пишет Node:** объект с полем `result`, внутри
 * записи V8. Поэтому оба покрытия ложатся в одну папку и читаются одним
 * инструментом.
 *
 * Включается переменной `IO_COVERAGE_OUT`; без неё гейт работает как работал и
 * ничего не пишет.
 */
function collectCoverage(browser, page, outPath) {
  const close = browser.close.bind(browser);
  let started = false;
  const start = page.coverage.startJSCoverage({ resetOnNavigation: false })
    .then(() => { started = true; })
    .catch((e) => {
      /* Громко: молчание здесь неотличимо от «покрытие снято и оно пустое». */
      console.error("[gate:browser] покрытие не включилось: " + String((e && e.message) || e));
    });
  browser.close = async () => {
    await start;
    if (started) {
      try {
        const entries = await page.coverage.stopJSCoverage();
        fs.mkdirSync(outPath, { recursive: true });
        const name = "browser-" + process.pid + "-" + Date.now() + ".json";
        fs.writeFileSync(path.join(outPath, name), JSON.stringify({ result: entries }));
      } catch (e) {
        console.error("[gate:browser] покрытие не записалось: " + String((e && e.message) || e));
      }
    }
    return close();
  };
}

async function openEditor(injection, opts) {
  const url = await buildPage(injection, opts);
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
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  /* Покрытие включается **до** перехода на страницу: всё, что исполняется при
     её загрузке, иначе прошло бы мимо меры. */
  const covOut = String(process.env.IO_COVERAGE_OUT || "").trim();
  if (covOut) collectCoverage(browser, page, covOut);
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String((e && e.message) || e)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console.error: " + m.text()); });
  /*
   * **Настройка, от которой зависит вопрос, приезжает строкой запроса.**
   *
   * Нужна она одному: «пузырь стоит серединой строки» видно только при
   * сравнении двух размеров текста, а размер в странице один на весь документ.
   * Подменой это не сделать: подмены гейт перебирает сам и ждёт от каждой
   * красного, а смена размера — не поломка. Собранный файл при этом один и
   * тот же, меняется только то, что страница у него спрашивает.
   */
  const query = String((opts && opts.query) || "").trim();
  await page.goto(query ? url + "?" + query : url);
  await page.waitForSelector(".cm-content");
  /*
   * Ждём **имя, которое ставит сама страница**, а не срок. Страница панели
   * поднимает рантайм и читает правила, и «подожди столько-то» здесь было бы
   * тем же, чем оно всегда бывает: зелёным на быстрой машине и красным на
   * чужой (У-78).
   */
  const ready = (opts && opts.ready) || "__ioEditorProbe";
  await page.waitForFunction((n) => typeof window[n] === "function", ready);
  return { browser, page, pageErrors };
}

module.exports = {
  root, outDir, EDITOR_INJECTIONS, buildPage, openEditor, injectionSpec, applyInjection,
};
