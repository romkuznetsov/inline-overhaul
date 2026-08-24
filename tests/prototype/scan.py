# -*- coding: utf-8 -*-
"""List references to commands, keys and other settings that are still
written as plain text in the schema."""
import io, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

src = io.open(sys.argv[1], encoding="utf-8").read()
js = re.search(r"<script>(.*?)</script>", src, re.S).group(1)
a = js.index("const SCHEMA = [")
b = js.index("];", js.index('id: "diagnostics"'))
schema = js[a:b]

TERMS = ["Ctrl/Cmd", "Move left", "Move right", "Move line up", "Move line down",
         "Jump back", "Jump next", "TagWheel", "Number of bars", "Values per side",
         "Field order", "Prefix order", "Cycle order", "Placement modes", "Fields",
         "Hotkeys", "Transform", "Binder", "Show", "empty", "Position", "Behavior",
         "Strict", "Insert only", "Free"]

found = []
for m in re.finditer(r"(intro|tip|desc)\s*:\s*\"((?:[^\"\\]|\\.)*)\"", schema):
    kind, text = m.group(1), m.group(2)
    for t in TERMS:
        for occ in re.finditer(re.escape(t), text):
            i = occ.start()
            before = text[max(0, i - 8):i]
            if "<code>" in before or "<b>" in before:
                continue
            found.append((kind, t, text[max(0, i - 30):i + len(t) + 26]))
            break

seen = set()
for kind, term, ctx in found:
    key = (kind, term, ctx)
    if key in seen:
        continue
    seen.add(key)
    print(kind.ljust(5) + " | " + term.ljust(15) + " | ..." + ctx.replace("\\n", " ") + "...")
print("\n" + str(len(seen)) + " plain references")
