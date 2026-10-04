# line-view — Visual → Inline appearance: Line view, Tag view

**Состояние: записан 2026-10-04; ждёт приёмки.**

Группы `Visual → Inline appearance → Line view` и `Tag view` в `docs/SETTINGS.md`. Показаны: `Tag bubble corners`, `Color the Block with Stripe` (с `Stripe opacity`), `Left Block text size` и `Right Block text size`, `Opacity of the Left Block` и `Opacity of the Right Block`. Не показаны: направление, цвет, высота и ширина полосы, ширина и высота пузыря, ширина пустого пузыря — оттенки тех же показов.

Заметка — `vault/Line view.md`. Нажатий нет: эффект виден сразу после выхода из настроек. Старт — стартовый набор, светлая тема, английский интерфейс.

## Что на экране

Пять этапов — полоса внизу GIF. Первый — вид по умолчанию; каждый следующий начинается заходом в настройки и сменой контрола, после выхода — та же заметка в новом виде. Настройки копятся: порядок — от формы к прозрачности, иначе поблёкшие Block прятали бы пузыри и полосу.

| Этап | Что показывается | Субтитр |
|---|---|---|
| 1 | Четыре строки с тегами слева, датой и ссылкой справа — в полную силу | `Default: tags, dates and links at full strength` |
| 2 | `Tag bubble corners` → 100: пузыри тегов стали квадратными | `Tag bubbles turn square` |
| 3 | `Color the Block with Stripe` → on, `Stripe opacity` → 35: за левым и правым Block — цветная полоса | `A Stripe runs behind each Block` |
| 4 | `Left Block text size` и `Right Block text size` → 70: оба Block мельче, свой текст прежний | `Both Blocks get smaller, your text stays` |
| 5 | `Opacity of the Left Block` и `Opacity of the Right Block` → 30: оба Block блёкнут, свой текст выделяется | `Both Blocks fade, your text stands out` |

Шаги записи — `steps/line-view.steps` (технические, не согласуются).
