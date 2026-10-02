/**
 * Шаблоны заметок для выпадающих списков панели (1.6.2.4, 1.6.6.2). Только из
 * `Templates folder` — одно правило для `Default template` и `Use template`
 * Smart Rules, иначе панель предложит шаблон, которого движок не найдёт.
 * Пустой список объясняется строкой (1.6.2.4).
 */

/* Тот же экземпляр модуля, что у движка `Inline to note` (У-89): нужен ради правила «чей шаблон». */
import transformFeature from "../../features/transform_feature.js";

/** Строка выпадающего списка: что запишется и что человек читает. */
export interface TemplateOption {
  value: string;
  label: string;
}

/**
 * Как список спрашивает свой текст (10.13.46): строки переводятся с панелью.
 * Нет резолвера — английское.
 */
export type SayTemplate = (name: string, english: string) => string;

const PLAIN: SayTemplate = (_name: string, english: string) => english;

/**
 * Шаблоны из назначенной папки, готовые к показу: с первой строкой пустого
 * выбора или с объяснением, почему выбирать нечего.
 */
/**
 * Выбирать нечего: папка не назначена или в ней нет шаблонов. Один ответ на
 * `Default template` и `Use template` (1.6.2.4, 1.6.6.2).
 */
export function templatesEmptyChoice(folder: string, say?: SayTemplate): TemplateOption {
  const root = String(folder || "").trim().replace(/\/+$/, "");
  const t = say || PLAIN;
  return root
    ? { value: "", label: t("NO_TEMPLATES", "No templates in") + " " + root }
    : { value: "", label: t("NO_TEMPLATE_FOLDER", "Set a Templates folder first") };
}

/**
 * Имя шаблона на экране — путь внутри назначенной папки (два `task.md` в
 * подпапках различаются). Одно объявление для трёх мест: `Default template`,
 * `Use template` и сводка свёрнутой карточки (замечание по S6, 2026-09-09).
 * Шаблон вне папки — с полным путём: он лежит не там.
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
  /*
   * Подпапки считаются. Принадлежность решает `templateBelongsToFolder` в
   * `transform_feature.js`, а не своя приставка: папку пишут с `/` впереди,
   * с неразрывным пробелом (В-127).
   */
  const inside = notes
    .map(p => String(p || ""))
    .filter(p => transformFeature.templateBelongsToFolder(p, root))
    .sort((a, b) => a.localeCompare(b));
  if (!inside.length) return [templatesEmptyChoice(root, say)];
  return [{ value: "", label: (say || PLAIN)("WORD_NONE", "None") } as TemplateOption].concat(
    inside.map(p => ({ value: p, label: templateLabel(root, p) })),
  );
}
