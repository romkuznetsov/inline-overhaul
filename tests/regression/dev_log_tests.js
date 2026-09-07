"use strict";

/**
 * Журнал разработчика: поведение, а не текст (кусок четвёртый разбора
 * `main.js`, 2026-09-07).
 *
 * **Чего здесь не было до сегодня.** Журнал жил семнадцатью методами класса
 * плагина и держался **девятью пинами по тексту** `main.js`: «в файле есть
 * метод с таким-то заголовком». Ни один из них не спрашивал, что журнал
 * пишет: ни имени файла, ни поворота прежней записи, ни обрезки по времени.
 * Переезд без такой проверки был бы переездом наугад, поэтому она заведена
 * тем же заходом.
 *
 * **Что подделано и почему.** Только адаптер vault: `read`, `write`, `list`,
 * `mkdir`, `remove` — граница с миром, которой в Node нет. Всё остальное
 * настоящее: сам модуль, его состояние на объекте плагина, его порядок
 * записи. Плагин здесь — объект с `app.vault.adapter` и `getConfig()`, то
 * есть ровно то, что модуль у него и спрашивает (У-1).
 */

const path = require("path");
const devLog = require(path.join(__dirname, "..", "..", "src", "core", "dev_log.js"));

function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
}

function assertTrue(value, name) {
  if (!value) throw new Error(`${name}: expected truthy`);
}

/** Адаптер vault, подделанный ровно настолько, чтобы помнить, что записали. */
function makeAdapter(initial) {
  const files = new Map(Object.entries(initial || {}));
  const dirs = [];
  return {
    files,
    dirs,
    async exists(p) { return files.has(String(p)) || dirs.includes(String(p)); },
    async mkdir(p) { dirs.push(String(p)); },
    async read(p) {
      if (!files.has(String(p))) throw new Error("нет файла: " + p);
      return files.get(String(p));
    },
    async write(p, data) { files.set(String(p), String(data)); },
    async remove(p) { files.delete(String(p)); },
    async list(dir) {
      const prefix = String(dir || "").replace(/^\/$/, "");
      const out = [];
      for (const key of files.keys()) {
        if (!prefix || key.startsWith(prefix + "/")) out.push(key);
        else if (!prefix && !key.includes("/")) out.push(key);
      }
      return { files: out, folders: [] };
    },
  };
}

function makePlugin(devMode, adapter) {
  return {
    app: { vault: { adapter } },
    _devLogWriteQueue: Promise.resolve(),
    getConfig() { return { advanced: { devMode } }; },
  };
}

async function testSessionRotatesPreviousRecordAndWritesBoth() {
  /*
   * Прежняя запись уже лежит в vault — с пометкой `new` и своим временем.
   * Начало новой сессии обязано увести её в `old` и завести новый файл: это
   * то, ради чего у файлов вообще есть роль в имени.
   */
  const adapter = makeAdapter({
    "logs/InlineOverhaul_DevLog.new.20260101-101010.md": "# InlineOverhaul Dev Log (Human)\nстарое\n",
  });
  const plugin = makePlugin({ enabled: true, aiLog: true, logPath: "logs/InlineOverhaul_DevLog" }, adapter);

  await devLog.startSession(plugin, plugin.getConfig());

  const paths = Array.from(adapter.files.keys()).sort();
  const oldOne = paths.filter((p) => /\.old\./.test(p));
  const newMd = paths.filter((p) => /\.new\..*\.md$/.test(p));
  const newAi = paths.filter((p) => /\.new\..*\.ndjson$/.test(p));
  assertEq(oldOne.length, 1, "прежняя запись уехала в `old`: " + paths.join(", "));
  assertEq(adapter.files.get(oldOne[0]), "# InlineOverhaul Dev Log (Human)\nстарое\n",
    "и уехала целиком, а не пустой");
  assertEq(newMd.length, 1, "человеческая запись одна: " + paths.join(", "));
  assertEq(newAi.length, 1, "и машинная одна: " + paths.join(", "));
  assertTrue(String(adapter.files.get(newMd[0])).startsWith("# InlineOverhaul Dev Log (Human)"),
    "у человеческой записи своя шапка: " + adapter.files.get(newMd[0]));
  assertTrue(String(newMd[0]).startsWith("logs/"), "запись легла в папку из настройки: " + newMd[0]);
  assertTrue(adapter.dirs.includes("logs"), "папку создали до записи: " + adapter.dirs.join(", "));

  /* Событие человека доезжает до файла обеими записями. */
  devLog.event(plugin, "pkm.run.result", {
    command: "tagWheel", changed: true, durationMs: 12,
    beforeLine: "- 1", afterLine: "- [ ] #todo :: 1",
  }, "info", plugin.getConfig());
  await plugin._devLogWriteQueue;

  const human = String(adapter.files.get(newMd[0]));
  assertTrue(human.includes("- event: pkm.run.result"), "событие записано человеческой строкой: " + human);
  assertTrue(human.includes("- before: - 1"), "и в нём видно, чем строка была: " + human);
  assertTrue(human.includes("- after: - [ ] #todo :: 1"), "и чем стала: " + human);

  const ai = String(adapter.files.get(newAi[0]));
  const rows = ai.split("\n").filter(Boolean).map((r) => JSON.parse(r));
  assertTrue(rows.length >= 2, "в машинной записи и начало сессии, и событие: " + ai);
  assertEq(rows[rows.length - 1].event, "pkm.run.result", "последнее событие — то, что послали");
  assertEq(rows[rows.length - 1].payload.command, "tagWheel", "и его содержимое цело");
  assertTrue(String(rows[0].sessionId || "").length > 0, "у сессии есть свой номер");
  assertTrue(rows[rows.length - 1].seq > rows[0].seq, "номер события растёт");
  console.log("  ok начало сессии поворачивает прежнюю запись и заводит обе новые");
}

async function testDisabledDevModeWritesNothing() {
  /*
   * Положительный контроль к проверке выше: при выключенном режиме не
   * появляется ни файла, ни строки. Без него обе проверки были бы зелёными от
   * того, что мерить нечего (У-88).
   */
  const adapter = makeAdapter({});
  const plugin = makePlugin({ enabled: false, aiLog: true, logPath: "logs/InlineOverhaul_DevLog" }, adapter);
  await devLog.startSession(plugin, plugin.getConfig());
  devLog.event(plugin, "pkm.run.result", { command: "tagWheel" }, "info", plugin.getConfig());
  await plugin._devLogWriteQueue;
  assertEq(adapter.files.size, 0, "выключенный режим не пишет ничего: " + Array.from(adapter.files.keys()).join(", "));

  /* И машинная запись отдельно: режим включён, а машинный журнал выключен. */
  const adapter2 = makeAdapter({});
  const plugin2 = makePlugin({ enabled: true, aiLog: false, logPath: "InlineOverhaul_DevLog" }, adapter2);
  await devLog.startSession(plugin2, plugin2.getConfig());
  devLog.event(plugin2, "pkm.run.result", { command: "fieldNext" }, "info", plugin2.getConfig());
  await plugin2._devLogWriteQueue;
  const kinds = Array.from(adapter2.files.keys());
  assertEq(kinds.filter((p) => /\.ndjson$/.test(p)).length, 0,
    "машинной записи нет, когда её не просили: " + kinds.join(", "));
  assertEq(kinds.filter((p) => /\.md$/.test(p)).length, 1,
    "а человеческая одна: " + kinds.join(", "));
  console.log("  ok выключенное не пишет: ни режим целиком, ни машинная запись");
}

/**
 * Режим выключили **после** начала сессии.
 *
 * Мимо этого случая проверка выше проходит: при выключенном режиме сессия и не
 * начинается, активного пути нет, и запись останавливается в самом низу — то
 * есть охрана в `event` там недостижима, и мутация её не краснеет (У-88). А
 * случай настоящий: человек может выключить `Developer mode` при открытом
 * журнале, и с этой минуты в файл не должно попадать ничего.
 */
async function testDevModeTurnedOffMidSessionStopsWriting() {
  const adapter = makeAdapter({});
  const devMode = { enabled: true, aiLog: false, logPath: "InlineOverhaul_DevLog" };
  const plugin = makePlugin(devMode, adapter);
  await devLog.startSession(plugin, plugin.getConfig());
  const logPath = Array.from(adapter.files.keys())[0];
  assertTrue(logPath, "положительный контроль: запись началась");

  devLog.event(plugin, "pkm.run.result", { command: "до выключения" }, "info", plugin.getConfig());
  await plugin._devLogWriteQueue;
  assertTrue(String(adapter.files.get(logPath)).includes("до выключения"),
    "пока режим включён, событие пишется: " + adapter.files.get(logPath));

  /* Человек выключил режим — тот же объект конфига, что читает плагин. */
  devMode.enabled = false;
  devLog.event(plugin, "pkm.run.result", { command: "после выключения" }, "info", plugin.getConfig());
  await plugin._devLogWriteQueue;
  assertTrue(!String(adapter.files.get(logPath)).includes("после выключения"),
    "после выключения не пишется ничего: " + adapter.files.get(logPath));
  console.log("  ok режим выключили посреди сессии — запись остановилась");
}

function testTrimsByTimeAndCount() {
  /*
   * Обрезка — чистая работа с текстом, и спрашивается она сразу двумя
   * способами: старое по времени уходит, а новое остаётся; и число записей
   * не больше предела.
   */
  const now = new Date();
  const old = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const fresh = new Date(now.getTime() - 60 * 1000).toISOString();

  const ai = [
    JSON.stringify({ ts: old, event: "старое" }),
    JSON.stringify({ ts: fresh, event: "свежее" }),
  ].join("\n") + "\n";
  const trimmedAi = devLog.trimAiLogContent(ai, { retentionMinutes: 45, maxRecords: 1200 });
  assertTrue(!trimmedAi.includes("старое"), "запись старше окна ушла: " + trimmedAi);
  assertTrue(trimmedAi.includes("свежее"), "свежая осталась: " + trimmedAi);

  const many = Array.from({ length: 5 }, (_, i) => JSON.stringify({ ts: fresh, event: "e" + i })).join("\n") + "\n";
  const limited = devLog.trimAiLogContent(many, { retentionMinutes: 45, maxRecords: 2 });
  assertEq(limited.split("\n").filter(Boolean).length, 2, "число записей обрезано до предела: " + limited);
  assertTrue(limited.includes("e4"), "и остались последние, а не первые: " + limited);

  const human = "# InlineOverhaul Dev Log (Human)\n"
    + `### ${old}\n- event: старое\n`
    + `### ${fresh}\n- event: свежее\n`;
  const trimmedHuman = devLog.trimHumanLogContent(human, { retentionMinutes: 20, maxRecords: 300 });
  assertTrue(trimmedHuman.startsWith("# InlineOverhaul Dev Log (Human)"), "шапка человеческой записи цела");
  assertTrue(!trimmedHuman.includes("старое"), "старый кусок ушёл: " + trimmedHuman);
  assertTrue(trimmedHuman.includes("свежее"), "свежий остался: " + trimmedHuman);
  console.log("  ok обрезка по времени и по числу записей, обе записи");
}

function testLogPathShapes() {
  /* Путь человек пишет как хочет: с расширением, без него и папкой. */
  const withExt = devLog.logPathParts({ logPath: "logs/Отладка.md" }, "md");
  assertEq(withExt.dir, "logs", "папка вынута из пути");
  assertEq(withExt.baseName, "Отладка", "расширение снято с имени");
  assertEq(withExt.ext, "md", "расширение — человеческое");

  /*
   * **Правило «имя по умолчанию» объявлено здесь дважды, и это найдено
   * мутацией.** В `logPathParts` есть ветка `maybeDir`, дописывающая имя к
   * пути, кончающемуся косой, — и есть запасное `|| "InlineOverhaul_DevLog"`
   * у самого имени. Снятие ветки эту проверку не краснит: результат тот же,
   * потому что второе объявление доделывает работу первого. Оставлено как
   * есть — кусок четвёртый переезжает код, а не правит его, — и записано
   * отчётом в PRD, раздел 11.
   */
  const asDir = devLog.logPathParts({ logPath: "logs/" }, "ndjson");
  assertEq(asDir.dir, "logs", "путь с косой на конце — это папка");
  assertEq(asDir.baseName, "InlineOverhaul_DevLog", "и имя берётся умолчанием");
  assertEq(asDir.ext, "ndjson", "расширение — машинное");

  const withRole = devLog.logPathParts({ logPath: "InlineOverhaul_DevLog.old.20260101-101010.md" }, "md");
  assertEq(withRole.baseName, "InlineOverhaul_DevLog", "роль и время из имени снимаются");
  assertEq(devLog.logFilePath({ dir: "logs", baseName: "X", ext: "md" }, "old", "20260101-101010"),
    "logs/X.old.20260101-101010.md", "имя файла собирается из роли и времени");
  assertEq(devLog.parentDirPath("a/b/c.md"), "a/b", "родительская папка считается по пути");
  console.log("  ok три написания пути записи и сборка имени файла");
}

async function run() {
  await testSessionRotatesPreviousRecordAndWritesBoth();
  await testDisabledDevModeWritesNothing();
  await testDevModeTurnedOffMidSessionStopsWriting();
  testTrimsByTimeAndCount();
  testLogPathShapes();
  console.log("Dev log behavior tests: OK");
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
