"use strict";

/**
 * Документ, читаемый целиком до первого действия, и то, что из него уехало
 * (`Р-10`).
 *
 * **Его слово 2026-09-18 (В-146): «ок, главное, чтобы работало надёжно и
 * эффективно».** Разрешение с условием, и условие задаёт приёмку: критерий не
 * «стало короче», а «работает надёжно». Отсюда три требования, и все три
 * спрашиваются здесь.
 *
 *   1. **Ничего не выброшено — всё переехало.** У каждого переезда две стороны,
 *      и спрашиваются обе: в `CLAUDE.md` предмета больше нет **и** в новом файле
 *      он есть. Одна сторона зеленела бы сама: запрет молчит именно тогда, когда
 *      искать стало нечего (У-94).
 *   2. **Каждая ссылка проверяется, а не предполагается.** Правило, уехавшее в
 *      файл, которого нет, — это правило, которого нет. Обход сплошной по тексту,
 *      а не список имён рядом (У-111), и у него положительный контроль: путей он
 *      обязан найти много, иначе проверяет пустоту.
 *   3. **Объём называет прогон, а не документ.** Число в тексте стареет от
 *      первой же правки (У-145), поэтому оно печатается здесь.
 *
 * **Чего эта проверка не делает.** Она не сторожит размер порогом: порог на
 * растущем числе — это порог на чужой машине, и снимать его пришлось бы каждую
 * сессию. Она печатает число и следит за тем, чтобы у переехавшего был **один**
 * дом и живая ссылка.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const claude = read("CLAUDE.md");

/* ---------- 1. у переехавшего один дом, и обе стороны спрошены ---------- */

/**
 * `gone` — образец, которого в `CLAUDE.md` быть не должно; `home` — файл, где
 * предмет теперь живёт, и образец, которым он там узнаётся.
 */
const MOVED = [
  {
    what: "таблица исключений к З3",
    gone: /^\s*\|\s*\d+\s*\|\s*20\d\d-\d\d-\d\d/m,
    home: "docs/dev/Z3_EXCEPTIONS.md",
    there: /^\|\s*130\s*\|\s*2026-09-18/m,
  },
  {
    what: "подробности седьмого шага",
    gone: /Ставится шаг двумя командами/,
    home: "docs/dev/BROWSER_GATE.md",
    there: /Ставится шаг двумя командами/,
  },
  {
    what: "указатели на архив",
    gone: /^\| `docs\/(dev\/)?archive\/(?!INDEX)/m,
    home: "docs/dev/archive/INDEX.md",
    there: /^\| `docs\/dev\/archive\/OWNER_REMARKS_session1\.md`/m,
  },
];

for (const m of MOVED) {
  assert.ok(!m.gone.test(claude),
    m.what + ": копия вернулась в CLAUDE.md — у предмета должен быть один дом (У-32)");
  const there = read(m.home);
  assert.ok(m.there.test(there),
    m.what + ": в " + m.home + " предмета нет — значит он не переехал, а пропал");
  assert.ok(claude.indexOf(m.home) >= 0,
    m.what + ": в CLAUDE.md нет ссылки на " + m.home + " — правило уехало в файл, о котором не сказано");
  /*
   * Триггер, а не просто ссылка: файл, о котором не сказано **когда** его
   * открывать, читается «когда-нибудь», то есть никогда. Так уже сделано с
   * `docs/dev/SESSION_END.md`, и это единственное, что отличает переезд от потери.
   */
  assert.ok(there.indexOf("Когда открывать") >= 0,
    m.home + ": в файле не сказано, по какому событию его открывать");
}

/* ---------- 2. каждая ссылка ведёт в существующий файл ---------- */

/*
 * **Что считается адресом, решает свойство, а не список примеров** (У-201).
 * Первая версия этого обхода брала всё, что похоже на путь, и назвала мёртвыми
 * четыре живые ссылки: `test-vault/Test.md` (это vault заказчика, он лежит
 * рядом с репозиторием, а не внутри), `custom/dom.ts` и `custom/keepview.ts`
 * (документ называет их коротко, от папки слоя настроек) и
 * `build/release_entry.js` (файл снят, и документ говорит именно об этом).
 * Поймал её положительный контроль — прогон на известном ответе: ссылки в
 * `CLAUDE.md` были в порядке, а обход нашёл четыре «поломки».
 *
 * Свойство: первый кусок пути — **папка верхнего уровня самого репозитория**, и
 * список их читается с диска, а не пишется рядом (У-111). Шаблоны (`src/**`,
 * `<версия>`, `%APPDATA%`) адресами не являются и пропускаются.
 */
const TOP = new Set(fs.readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "node_modules" && !d.name.startsWith("."))
  .map((d) => d.name));

/**
 * Снятое, о котором документ говорит нарочно. Список именной и с причиной:
 * молчаливое исключение — тот самый способ, каким «проверено автоматически»
 * превращается в «проверено ничего».
 */
const GONE_ON_PURPOSE = {};

const pathRe = /`([A-Za-z0-9_][A-Za-z0-9_./-]*\/[A-Za-z0-9_./-]+\.[a-z]{2,4})`/g;
const seen = new Set();
const missing = [];
for (let m = pathRe.exec(claude); m; m = pathRe.exec(claude)) {
  const rel = m[1];
  if (rel.indexOf("*") >= 0 || rel.indexOf("<") >= 0) continue;
  if (!TOP.has(rel.split("/")[0])) continue;
  if (seen.has(rel)) continue;
  seen.add(rel);
  if (GONE_ON_PURPOSE[rel]) continue;
  if (!fs.existsSync(path.join(root, rel))) missing.push(rel);
}

/*
 * Отрицательный контроль к списку исключений: снятое обязано и правда
 * отсутствовать. Иначе строка в списке переживёт возвращение файла и будет
 * молчать о нём.
 */
for (const rel of Object.keys(GONE_ON_PURPOSE)) {
  assert.ok(!fs.existsSync(path.join(root, rel)),
    rel + " снова существует — снимите его из списка снятого нарочно");
  assert.ok(seen.has(rel),
    rel + " в CLAUDE.md больше не назван — снимите его из списка снятого нарочно");
}

assert.ok(seen.size > 40,
  "обход нашёл всего " + seen.size + " путей — он проверяет не то (положительный контроль)");
assert.deepStrictEqual(missing, [],
  "CLAUDE.md ссылается на файлы, которых нет: " + missing.join(", "));

/* ---------- 3. каждая ссылка на урок разрешается ---------- */

/*
 * `CLAUDE.md` держит правило одной строкой и ссылается номером в `LESSONS.md`.
 * Ссылка, которая никуда не ведёт, — это правило без истории: следующая сессия
 * прочтёт «почему» и не найдёт его. Проверяется по заголовкам книги уроков, а
 * не по тому, что номер выглядит номером.
 */
const lessons = read("docs/dev/LESSONS.md");
const haveLessons = new Set(
  [...lessons.matchAll(/^### (У-\d+)\./gm)].map((m) => m[1]));
const usedLessons = new Set(
  [...claude.matchAll(/У-(\d+)/g)].map((m) => "У-" + m[1]));

assert.ok(haveLessons.size > 100,
  "контроль: заголовков уроков нашлось " + haveLessons.size + " — образец их не находит");
assert.ok(usedLessons.size > 50,
  "контроль: ссылок на уроки нашлось " + usedLessons.size + " — образец их не находит");

const brokenLessons = [...usedLessons].filter((u) => !haveLessons.has(u));
assert.deepStrictEqual(brokenLessons, [],
  "в CLAUDE.md есть ссылки на уроки, которых нет в docs/dev/LESSONS.md: " + brokenLessons.join(", "));

/*
 * **Книга уроков держит одну копию себя** (У-252, 2026-09-21).
 *
 * Она росла двумя копиями: первой лежал устаревший снимок на сто уроков
 * короче, и дописывали всегда его — урок прошлой сессии попал ровно туда, то
 * есть в половину, которую никто не открывает. Снаружи это неотличимо от
 * порядка: ссылка из `CLAUDE.md` разрешалась (номер-то в файле есть), объём
 * рос как положено, и ни один прогон не краснел.
 *
 * Спрашивается свойство, а не размер: заголовок файла один, и номер урока не
 * повторяется. Второе сильнее первого — оно ловит и половинную копию, у
 * которой своего заголовка нет.
 */
const lessonHeads = [...lessons.matchAll(/^# Уроки:/gm)].length;
assert.strictEqual(lessonHeads, 1,
  "в docs/dev/LESSONS.md заголовков файла " + lessonHeads + ": книга держит копию себя");

const lessonNumbers = [...lessons.matchAll(/^### (У-\d+)\./gm)].map((m) => m[1]);
const twice = lessonNumbers.filter((u, i) => lessonNumbers.indexOf(u) !== i);
assert.deepStrictEqual([...new Set(twice)], [],
  "номер урока объявлен дважды — значит часть книги лежит копией: " + [...new Set(twice)].join(", "));

/* ---------- 4. в `docs/` только то, на что смотрит человек ---------- */

/*
 * Его пункт о виде репозитория 2026-09-20: «много лишнего в `docs` — там файлы,
 * которые не нужны для пользователя». Рабочие документы уехали в `docs/dev/`, и
 * правило это держится **списком того, что осталось**, а не списком уехавшего:
 * иначе следующий заведённый документ лёг бы в `docs/` молча.
 *
 * Оставшееся названо поимённо вместе с причиной — у каждого есть читатель
 * снаружи:
 *   `SHOWCASE.md` и `media/` — на них ведёт `README.md`;
 *   `COMMAND_IDS_V1_V2.md` — на него ведут `README.md`, руководство и
 *   уведомление самого плагина о переименовании команд;
 *   `prototype/` — нормативен (Р8), и на него ссылается половина кода;
 *   `TUTORIAL.md` и `SETTINGS.md` — учебник и справочник панели, заведены
 *   2026-09-20 по бренд-буку; на оба ведёт таблица «Where to go next» в `README.md`;
 *   `brand/` — знак и социальное превью; шапка `README.md` берёт картинку
 *   оттуда, и без неё первый экран пуст;
 *   `dev/` — всё остальное.
 */
const DOCS_FOR_PEOPLE = new Set([
  "dev", "media", "prototype", "SHOWCASE.md", "COMMAND_IDS_V1_V2.md",
  "TUTORIAL.md", "SETTINGS.md", "brand",
]);
const docsEntries = fs.readdirSync(path.join(root, "docs"));
assert.ok(docsEntries.length >= 4,
  "контроль: в docs/ нашлось " + docsEntries.length + " записей — обход смотрит не туда");
const strangers = docsEntries.filter((name) => !DOCS_FOR_PEOPLE.has(name));
assert.deepStrictEqual(strangers, [],
  "эти файлы в `docs/` человеку не нужны — их место в `docs/dev/`: " + strangers.join(", "));
assert.ok(fs.existsSync(path.join(root, "docs", "dev", "PRD_Settings_Overhaul_v1.md")),
  "контроль: `docs/dev/` пуст — значит правило проверяется на пустоте");

/* ---------- 5. объём называет прогон ---------- */

const sizes = [
  ["CLAUDE.md", claude.length],
  ["docs/dev/Z3_EXCEPTIONS.md", read("docs/dev/Z3_EXCEPTIONS.md").length],
  ["docs/dev/BROWSER_GATE.md", read("docs/dev/BROWSER_GATE.md").length],
  ["docs/dev/archive/INDEX.md", read("docs/dev/archive/INDEX.md").length],
];

console.log("ok: читается целиком каждую сессию — " + claude.length + " знаков; "
  + "по событию: " + sizes.slice(1).map((s) => s[0] + " " + s[1]).join(", "));
console.log("ok: путей в CLAUDE.md " + seen.size + ", все ведут в существующие файлы; "
  + "ссылок на уроки " + usedLessons.size + " из " + haveLessons.size + ", все разрешаются; "
  + "переездов с двусторонней сверкой " + MOVED.length);
