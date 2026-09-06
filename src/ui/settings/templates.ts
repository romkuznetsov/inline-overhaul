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
export function templatesEmptyChoice(folder: string): TemplateOption {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  return root
    ? { value: "", label: "No templates in " + root }
    : { value: "", label: "Set a Templates folder first" };
}

export function templateOptions(
  folder: string,
  notes: readonly string[],
): readonly TemplateOption[] {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  if (!root) return [templatesEmptyChoice(root)];
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
  if (!inside.length) return [templatesEmptyChoice(root)];
  return [{ value: "", label: "None" } as TemplateOption].concat(
    inside.map(p => ({ value: p, label: p.slice(prefix.length) })),
  );
}
