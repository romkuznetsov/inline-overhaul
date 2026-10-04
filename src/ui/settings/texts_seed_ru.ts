/**
 * Русский каталог — плейсхолдер (PRD 10.13.38): строк ровно столько, чтобы
 * переключение было видно сразу; остальное уступает английскому (Я4,
 * `reportCatalog`). Из них собирается файл, который дописывает человек.
 */

import { LANGUAGE_NAME_KEY } from "./texts.ts";

export const RU_SEED: Readonly<Record<string, string>> = {
  [LANGUAGE_NAME_KEY]: "Русский",
  "tab.general.label": "Общее",
  "tab.keyboard.label": "Клавиатура",
  "tab.navigation.label": "Навигация",
  "tab.pkm.label": "Теги и PKM",
  "tab.visual.label": "Вид",
  "tab.transform.label": "Превращение",
  "tab.advanced.label": "Дополнительно",
  "help.ui-language.name": "Язык",
  "help.ui-language.desc": "Панели и сообщений плагина",
};
