"""Заметка приёмки GIF в test-vault: копии GIF в test-vault/showcase-gif/ и `Showcase GIF.md` с предпросмотром.

Obsidian показывает картинку в заметке, только если файл внутри vault. Описания — из CATALOG.md.
Запуск из repo/: python tools/showcase_review_note.py. Перезаписывает заметку целиком — его ответы в ней перенести до запуска.
"""
import os, re, shutil

REPO = os.getcwd()
VAULT = os.path.join(os.path.dirname(REPO), 'test-vault')
SRC = os.path.join(REPO, 'docs', 'media', 'showcase')
DST = os.path.join(VAULT, 'showcase-gif')
os.makedirs(DST, exist_ok=True)

rows = []
for line in open(os.path.join(REPO, 'docs', 'dev', 'showcase', 'CATALOG.md'), encoding='utf8'):
    m = re.match(r'^\| \d+ \| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', line.strip())
    if m:
        rows.append([x.strip() for x in m.groups()])

SECTIONS = ['Navigation', 'Keyboard', 'Tags & PKM', 'Transform', 'Visual', 'General', 'Advanced']
def section(feature, gid):
    if gid == 'readme-hero':
        return 'Tags & PKM'
    for s in SECTIONS:
        if feature.startswith(s):
            return 'General и Advanced' if s in ('General', 'Advanced') else s
    return 'Прочее'

order = ['Navigation', 'Keyboard', 'Tags & PKM', 'Transform', 'Visual', 'General и Advanced']
groups = {k: [] for k in order}
missing = []
for gid, feature, shows, state in rows:
    gif = os.path.join(SRC, gid + '.gif')
    if not os.path.exists(gif):
        missing.append((gid, state))
        continue
    shutil.copyfile(gif, os.path.join(DST, gid + '.gif'))
    groups[section(feature, gid)].append((gid, feature, shows, state))

out = ['# Showcase GIF', '',
       '> [!info] Как отвечать',
       '> Под каждым GIF — галочка `ок` и строка `💬` для замечания к нему. Замечание ко всем GIF сразу пишите в раздел «Ко всем GIF» ниже — или под любым GIF, начав строку со слова `ВСЕМ`. Я разберу оба вида: общее применю ко всему каталогу, частное — к своему GIF.',
       '',
       '## Ко всем GIF',
       '- 💬 ',
       '']
n = 0
for sec in order:
    if not groups[sec]:
        continue
    out += ['---', '', '## ' + sec, '']
    for gid, feature, shows, state in groups[sec]:
        n += 1
        note = ''
        if ';' in state:
            note = state.split(';', 1)[1].strip()
        out += ['### %d. %s' % (n, gid),
                '- [ ] ок',
                '- 💬 ',
                '',
                '*%s* — %s%s' % (feature, shows, ('. ' + note[0].upper() + note[1:]) if note else ''),
                '',
                '![[showcase-gif/%s.gif|720]]' % gid,
                '']
if missing:
    out += ['---', '', '## Не записано', '']
    for gid, state in missing:
        out += ['- `%s` — %s' % (gid, state.replace('**', ''))]
    out.append('')
open(os.path.join(VAULT, 'Showcase GIF.md'), 'w', encoding='utf8', newline='\n').write('\n'.join(out))
print('GIF:', n, 'не записано:', [m[0] for m in missing])
