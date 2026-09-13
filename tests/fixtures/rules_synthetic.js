"use strict";

/**
 * Правила TagWheel для проверок: вымышленные, от vault не зависят.
 *
 * **Почему объект, а не заметка.** До 2026-09-13 эта фикстура была
 * `InlineOverhaul_Generated_RULES_TagWheel.md` — служебным файлом правил,
 * который движки разбирали `parseRulesFromMarkdown`. Шагом третьим снятия
 * файла (PRD 10.13.52, П-8) разбор ушёл из продукта, и фикстура переехала в ту
 * форму, в какой правила приезжают к движку теперь: значением ключа
 * `Rules data`. **Значения не менялись ни одного** — это тот же разбор той же
 * заметки, снятый прогоном в день переезда.
 *
 * **Чего эта фикстура не проверяет** (У-147): у неё `separator1` равен
 * `separator2`, а имя поля элемента (`due`) не равно его ключу Order
 * (`date_due`). Всё, что на совпадающих формах неразличимо, спрашивается у
 * второй фикстуры — `rules_owner_shape.js`.
 *
 * **И чего не проверяет ни одна из двух:** обе описывают правила напрямую, а у
 * человека они собираются из настроек (`buildRulesForEngines`). Ход «конфиг →
 * правила» держат `rules_from_settings_tests.ts` и стенды на его `data.json`
 * (`tools/line_matrix.js`).
 */

const SYNTHETIC_RULES = {
  "meta": {
    "schemaVersion": 2,
    "name": "SyntheticTagWheelFixture"
  },
  "io": {
    "separator1": "::",
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
    "estimatedCycle": [
      "00:15",
      "00:30",
      "01:00"
    ],
    "typeCheckboxByValue": {
      "todo": "[ ]",
      "note": "[N]",
      "idea": "[I]",
      "open": "[?]",
      "source": "[S]"
    },
    "prefixRules": {
      "resolver": "priority-first",
      "priorityTargets": [
        "priority",
        "context",
        "nestedContext",
        "type",
        "modal",
        "project",
        "client",
        "client_sub",
        "client1",
        "client1_sub"
      ],
      "checkboxByFieldValue": {
        "type": {
          "todo": "[ ]",
          "note": "[N]",
          "idea": "[I]",
          "open": "[?]",
          "source": "[S]"
        },
        "context": {
          "area-alpha": "[a]",
          "area-beta": "[b]",
          "area-gamma": "[c]"
        }
      },
      "priorityMode": "by-checkbox-list",
      "priorityCheckboxes": [
        "[ ]",
        "[a]",
        "[b]",
        "[c]",
        "[I]",
        "[N]",
        "[?]",
        "[S]"
      ],
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
    "activationFocus": {
      "left": {
        "defaultFieldId": "priority"
      },
      "right": {
        "defaultFieldId": "timeNow"
      }
    },
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
        "id": "priority",
        "orderKey": "",
        "prefix": "",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "priority",
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
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "type",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "todo",
            "token": "todo",
            "allowedParentValues": null
          },
          {
            "id": "idea",
            "token": "idea",
            "allowedParentValues": null
          },
          {
            "id": "note",
            "token": "note",
            "allowedParentValues": null
          },
          {
            "id": "open",
            "token": "open",
            "allowedParentValues": null
          },
          {
            "id": "source",
            "token": "source",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "modal",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "type",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": [
          "todo",
          "open"
        ],
        "kind": "",
        "marker": "",
        "placeholder": "modal",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "idea-child",
            "token": "idea-child",
            "allowedParentValues": [
              "idea"
            ]
          },
          {
            "id": "note-child",
            "token": "note-child",
            "allowedParentValues": [
              "note"
            ]
          }
        ]
      },
      {
        "id": "context",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "context",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "area-alpha",
            "token": "area-alpha",
            "allowedParentValues": null
          },
          {
            "id": "area-beta",
            "token": "area-beta",
            "allowedParentValues": null
          },
          {
            "id": "area-gamma",
            "token": "area-gamma",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "nestedContext",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "context",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "nestedContext",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "area-alpha-child",
            "token": "area-alpha-child",
            "allowedParentValues": [
              "area-alpha"
            ]
          },
          {
            "id": "area-beta-child",
            "token": "area-beta-child",
            "allowedParentValues": [
              "area-beta"
            ]
          }
        ]
      },
      {
        "id": "project",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "projects",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "project",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "client",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "client",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "tenant-alpha",
            "token": "tenant-alpha",
            "allowedParentValues": null
          },
          {
            "id": "tenant-beta",
            "token": "tenant-beta",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "client_sub",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "client",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "client_sub",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "tenant-alpha-child",
            "token": "tenant-alpha-child",
            "allowedParentValues": [
              "tenant-alpha"
            ]
          }
        ]
      },
      {
        "id": "client1",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "client1",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "account-alpha",
            "token": "account-alpha",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "client1_sub",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "client1",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "client1_sub",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "topic",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "topic",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "topic-alpha",
            "token": "topic-alpha",
            "allowedParentValues": null
          },
          {
            "id": "topic-beta",
            "token": "topic-beta",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "topic_sub",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "topic",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "topic_sub",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "topic-alpha-child",
            "token": "topic-alpha-child",
            "allowedParentValues": [
              "topic-alpha"
            ]
          },
          {
            "id": "topic-beta-child",
            "token": "topic-beta-child",
            "allowedParentValues": [
              "topic-beta"
            ]
          }
        ]
      },
      {
        "id": "clients",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "wikilinks:clients",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "",
        "marker": "",
        "placeholder": "clients",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          },
          {
            "id": "EntityAlpha",
            "token": "EntityAlpha",
            "allowedParentValues": null
          },
          {
            "id": "EntityBeta",
            "token": "EntityBeta",
            "allowedParentValues": null
          }
        ]
      }
    ]
  },
  "rightMode": {
    "fields": [
      {
        "id": "timeNow",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "nowTime",
        "marker": "🕒",
        "placeholder": "timeNow",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "estimated",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "estimatedCycle",
        "marker": "⌛",
        "placeholder": "estimated",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "start",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "dateOffset",
        "marker": "🛫",
        "placeholder": "start",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      },
      {
        "id": "due",
        "orderKey": "",
        "prefix": "#",
        "dependsOn": "",
        "source": "",
        "enabled": true,
        "enabledForParentValues": null,
        "disabledForParentValues": null,
        "kind": "dateOffset",
        "marker": "📅",
        "placeholder": "due",
        "values": [
          {
            "id": "",
            "token": "",
            "allowedParentValues": null
          }
        ]
      }
    ]
  },
  "projects": {
    "output": "wikilink",
    "filterKeys": [
      "context",
      "nestedContext"
    ],
    "includeDefaultsWhenFiltered": false,
    "defaults": [
      "[[Project Inbox]]"
    ],
    "byContext": {
      "area-alpha": {
        "branch": [
          "[[Project Alpha]]"
        ],
        "leaf": {
          "area-alpha-child": [
            "[[Project Alpha Child]]"
          ]
        }
      },
      "area-beta": {
        "branch": [
          "[[Project Beta]]"
        ],
        "leaf": {
          "area-beta-child": [
            "[[Project Beta Child]]"
          ]
        }
      }
    }
  },
  "colors": {}
};

module.exports = SYNTHETIC_RULES;
