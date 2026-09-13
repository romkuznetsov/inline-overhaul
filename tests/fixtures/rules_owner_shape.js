"use strict";

/**
 * Вторая фикстура правил: формы, которые есть у заказчика в vault.
 *
 * Заведена нарочно — у первой (`rules_synthetic.js`) три формы совпадают с
 * теми, на которых дефект неразличим (У-147):
 *
 * | Форма | Первая фикстура | Здесь | Что это ловит |
 * |---|---|---|---|
 * | разделители | `::` и `::` — совпадают | `\|\|` и `::` | правило, верное при совпадающих разделителях и неверное при разных |
 * | элемент | поле зовут `due`, ключ Order — `date_due` | имя поля равно ключу Order | плагин пишет правила так, и только так элемент виден в Block по Order |
 * | значение важности | `#/1` | `#/1` — та же форма | косая черта сразу за приставкой: родителя в таком токене нет |
 * | формат элемента | `YYYY-MM-DD` — одно слово | `YYYY-MM-DD hh:mm` — два | значение из двух слов: вторую половину теряли (10.13.71) |
 * | предусловие | только у дочерних Field (`*_sub`) | у `Project` — своё место в Block и предусловие | Field, который панель прячет, а команда ставила: правило Н21 было объявлено в документе и на пути команд не спрошено ни разу |
 *
 * Значения вымышленные и от vault не зависят. Форма — та, в какой правила
 * приезжают к движку ключом `Rules data`; прежняя заметка `owner_shape_rules.md`
 * снята вместе с разбором файла (PRD 10.13.52, П-8, шаг третий).
 */

const OWNER_SHAPE_RULES = {
  "meta": {
    "schemaVersion": 2,
    "name": "OwnerShapeRulesFixture"
  },
  "io": {
    "separator1": "||",
    "separator2": "::"
  },
  "inlineLayout": {},
  "behavior": {
    "defaultMode": "left",
    "startModeInputKey": "startMode",
    "startSettingInputKey": "startSetting",
    "startSettings": {
      "default": "left",
      "profiles": {
        "left": {
          "startMode": "left"
        },
        "right": {
          "startMode": "right"
        }
      }
    },
    "forceSeparatorWhenTags": true,
    "skipDisabledFieldsOnNavigate": true,
    "subtagFormat": "separate",
    "prefixRules": {
      "resolver": "priority-first",
      "priorityTargets": [
        "Importance",
        "Category",
        "type"
      ],
      "checkboxByFieldValue": {
        "type": {
          "#todo": "[ ]",
          "#note": "[N]"
        }
      },
      "priorityMode": "by-section",
      "fieldsOrderMode": "manual",
      "tagSubtagPriority": "subtag-over-tag"
    },
    "keymap": {
      "nextField": "ArrowRight",
      "prevField": "ArrowLeft",
      "valueUp": "ArrowUp",
      "valueDown": "ArrowDown",
      "switchMode": "Tab",
      "apply": "Enter",
      "cancel": "Escape"
    }
  },
  "ui": {
    "placeholderStyle": "code",
    "activePanel": {
      "enabled": true,
      "useHighlight": true,
      "showMarkers": false,
      "prefix": "{TW}",
      "suffix": "{/TW}"
    },
    "leftGroups": [],
    "rightGroups": []
  },
  "leftMode": {
    "fields": [
      {
        "id": "Category",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "Cat",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "#work",
            "token": "#work",
            "allowedParentValues": null
          },
          {
            "id": "#home",
            "token": "#home",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "Importance",
        "orderKey": "",
        "prefix": "",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "Imp",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "#/1",
            "token": "#/1",
            "allowedParentValues": null
          },
          {
            "id": "#/2",
            "token": "#/2",
            "allowedParentValues": null
          },
          {
            "id": "#/3",
            "token": "#/3",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "type",
        "orderKey": "",
        "prefix": "",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "Type",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "#todo",
            "token": "#todo",
            "allowedParentValues": null
          },
          {
            "id": "#note",
            "token": "#note",
            "allowedParentValues": null
          }
        ]
      }
    ]
  },
  "rightMode": {
    "fields": [
      {
        "id": "date_due",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "genericElement",
        "marker": "📅",
        "placeholder": "Due",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "Project",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "Category",
        "source": "wikilinks:Project",
        "enabled": true,
        "enabledForParentValues": [
          "#work"
        ],
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "Project",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "alpha",
            "token": "alpha",
            "allowedParentValues": null
          },
          {
            "id": "beta",
            "token": "beta",
            "allowedParentValues": null
          }
        ]
      }
    ]
  },
  "projects": {
    "output": "wikilink",
    "filterKeys": [],
    "includeDefaultsWhenFiltered": false,
    "defaults": [],
    "byContext": {},
    "items": [],
    "rules": [],
    "catalog": []
  },
  "colors": {}
};

module.exports = OWNER_SHAPE_RULES;
