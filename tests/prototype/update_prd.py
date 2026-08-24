# -*- coding: utf-8 -*-
"""Перегенерация сгенерированных частей PRD из прототипа.

Опись версии 1 для сверки лежит в tests/prototype/v1_inventory.tsv:
PRD 1.1 её не содержит, а сверка должна оставаться воспроизводимой.

Раздел 9 (сверка) и Приложение B (опись) выводятся из
docs/prototype/settings_prototype.html и руками не правятся. Скрипт
пересобирает их на месте, чтобы после правки прототипа документ не
расходился с панелью.

    python tests/prototype/update_prd.py

Запускать из корня репозитория. Требует node в PATH.
"""
import io, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRD = os.path.join(ROOT, "docs", "PRD_Settings_Overhaul_v1.md")
PROTO = os.path.join(ROOT, "docs", "prototype", "settings_prototype.html")
TESTS = os.path.join(ROOT, "tests", "prototype")

def node(script, *args):
    out = subprocess.run([sys.executable and "node", os.path.join(TESTS, script)] + list(args),
                         cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        sys.exit(script + " упал:\n" + (out.stdout or "") + (out.stderr or ""))
    return out.stdout.strip()

tmp = tempfile.mkdtemp()
inv_path = os.path.join(tmp, "inventory.md")
rec_path = os.path.join(tmp, "reconcile.md")
print(node("dump_schema.js", PROTO, inv_path))
print(node("reconcile.js", "-", PROTO, rec_path))   # опись v1 берётся из v1_inventory.tsv

inventory = io.open(inv_path, encoding="utf-8").read().rstrip("\n")
reconcile = io.open(rec_path, encoding="utf-8").read().rstrip("\n")
reconcile = reconcile[reconcile.index("| итог |"):]

s = io.open(PRD, encoding="utf-8").read()

# ---- раздел 9: таблица сверки, текст раздела остаётся на месте --------
head = s.index("| итог | v1 |")
tail = s.index("---\n\n## 10. ", head)
s = s[:head] + reconcile + "\n\n" + s[tail:]

# ---- приложение B: целиком ------------------------------------------
b = s.index("## Приложение B. Опись целевого состояния")
s = s[:b] + ("## Приложение B. Опись целевого состояния\n\n"
             "Сгенерировано из `docs/prototype/settings_prototype.html` командой:\n\n"
             "```\npython tests/prototype/update_prd.py\n```\n\n"
             "Руками не правится. При изменении прототипа опись перегенерируется, "
             "и её diff показывает, что именно изменилось в текстах.\n\n") + inventory + "\n"

io.open(PRD, "w", encoding="utf-8", newline="\n").write(s)
print("PRD обновлён: " + str(len(s.split(chr(10)))) + " строк")
