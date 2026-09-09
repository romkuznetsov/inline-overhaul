/**
 * Шаблоны заметок: список для выпадающих списков панели (замечания заказчика
 * 1.6.2.4 и 1.6.6.2).
 *
 * **Правило одно и живёт в одном месте.** Шаблоны берутся **только** из папки,
 * которую человек назначил в `Templates folder`. Это правило нужно и строке
 * `Default template`, и полю `Use template` внутри Smart Rules; два списка,
 * собранные по отдельности, разошлись бы на первой же правке — а разойтись им
 * значит предложить шаблон, которого движок не найдёт.
 *
 * **Пустой список обязан объясниться.** Папка не назначена — в списке одна
 * строка, которая говорит, чего не хватает, а не пустота, из которой ничего не
 * следует (требование заказчика 1.6.2.4).
 */

/** Строка выпадающего списка: что запишется и что человек читает. */
export interface TemplateOption {
  value: string;
  label: string;
}

/**
 * Как список спрашивает свой текст (10.13.46). Имя — из таблицы окон: строки
 * «шаблонов нет» человек читает, значит они переводятся вместе с панелью.
 * Нет резолвера — ответом идёт английское, как и было.
 */
export type SayTemplate = (name: string, english: string) => string;

const PLAIN: SayTemplate = (_name: string, english: string) => english;

/**
 * Шаблоны из назначенной папки.
 *
 * `folder` — то, что стоит в `Templates folder`; `notes` — пути заметок vault.
 * Возвращается список, готовый к показу: с первой строкой про пустой выбор или
 * с объяснением, почему выбирать нечего.
 */
/**
 * Что показать, когда выбирать нечего. Два случая, и это разные случаи:
 * папку не назначили — и папку назначили, а шаблонов в ней нет. Ответ на них
 * один на всю панель: `Default template` и `Use template` внутри Smart Rules
 * обязаны говорить одно и то же (замечания 1.6.2.4 и 1.6.6.2).
 */
export function templatesEmptyChoice(folder: string, say?: SayTemplate): TemplateOption {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  const t = say || PLAIN;
  return root
    ? { value: "", label: t("NO_TEMPLATES", "No templates in") + " " + root }
    : { value: "", label: t("NO_TEMPLATE_FOLDER", "Set a Templates folder first") };
}

/**
 * Как шаблон назван на экране: путь внутри назначенной папки.
 *
 * **Одно объявление на всю панель.** Имя шаблона показывают три места:
 * выпадающий список `Default template`, список `Use template` внутри Smart
 * Rules и сводка свёрнутой карточки правила. Первое считало имя этим
 * правилом, второе и третье писали путь целиком — и заказчик увидел ровно
 * расхождение: «в свёрнутом состоянии используемый шаблон отображается как
 * `Template: 111/template.md` — показывай только название заметки»
 * (замечание по S6, 2026-09-09).
 *
 * Путь **внутри** папки, а не одно имя файла: два `task.md` в разных
 * подпапках шаблонной папки иначе выглядели бы одинаково. У заказчика
 * шаблоны лежат в самой папке, и для него это и есть имя заметки.
 *
 * Шаблон вне назначенной папки остаётся со своим путём целиком — и это не
 * оплошность, а ответ: значит, он лежит не там, откуда панель их предлагает.
 */
export function templateLabel(folder: string, path: string): string {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  const p = String(path || "").trim();
  if (!root || !p) return p;
  const prefix = root + "/";
  return p.startsWith(prefix) ? p.slice(prefix.length) : p;
}

export function templateOptions(
  folder: string,
  notes: readonly string[],
  say?: SayTemplate,
): readonly TemplateOption[] {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  if (!root) return [templatesEmptyChoice(root, say)];
  const prefix = root + "/";
  /*
   * Вложенные папки внутри шаблонной тоже считаются: человек, разложивший
   * шаблоны по подпапкам, не ждёт, что половина исчезнет. Подпись при этом —
   * путь внутри папки, чтобы два `task.md` в разных подпапках различались.
   */
  const inside = notes
    .map(p => String(p || ""))
    .filter(p => p.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b));
  if (!inside.length) return [templatesEmptyChoice(root, say)];
  return [{ value: "", label: (say || PLAIN)("WORD_NONE", "None") } as TemplateOption].concat(
    inside.map(p => ({ value: p, label: templateLabel(root, p) })),
  );
}
