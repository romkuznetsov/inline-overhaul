---
type: note
category: test
date: 2026-03-29
project: PKM
tags:
  - baseline
  - regression
---

# PKM Baseline Golden Matrix v1

Набор эталонных кейсов для ручного/полуавтоматического regression smoke.

## A. Cursor policy

1. `text_end`, empty -> `cycle_type`
   - Input: ``
   - Expected line: `- [ ]  || #todo`
   - Expected cursor: `- [ ] (cursor) || #todo`

2. `text_end`, empty -> `cycle_context`
   - Input: ``
   - Expected line: `- #area-alpha || `
   - Expected cursor: `- #area-alpha || (cursor)`

3. `text_end`, text + right
   - Input: `- [ ] #area-alpha || 111 || #todo`
   - Action: `importance` (`cycle_field:importance`)
   - Expected line: `- [ ] #/1 #area-alpha || 111 || #todo`
   - Expected cursor: `- [ ] #/1 #area-alpha || 111(cursor) || #todo`

4. `current_position`, closest remap
   - Input: `- [ ] #area-alpha(cursor) 📅2026-03-29 || 111 || #todo`
   - Action: `importance` (`cycle_field:importance`)
   - Expected line: `- [ ] #/1 #area-alpha(cursor) 📅2026-03-29 || 111 || #todo`

5. `current_position`, cycle exit remap
   - Input: `- [ ] #area-gamma(cursor) 📅2026-03-29 || 111 || #todo`
   - Action: `category cycle exit`
   - Expected line: `- [ ] (cursor)📅2026-03-29 || 111 || #todo`

5.1 `line_end`, cursor goes to final line end
   - Input: `- [ ] #area-alpha || 111 || #todo`
   - Action: `importance` (`cycle_field:importance`)
   - Expected line: `- [ ] #/1 #area-alpha || 111 || #todo`
   - Expected cursor: `- [ ] #/1 #area-alpha || 111 || #todo(cursor)`

## B. Spacing and separators

6. Checkbox + right-only spacing
   - Input: ``
   - Action: right-panel type
   - Expected: `- [ ]  || #todo`

7. Empty text-slot canonical form
   - Input: `- [ ] #/1 #area-alpha || || #todo` (или intermediate variant)
   - Expected: `- [ ] #/1 #area-alpha ||  || #todo`

8. No condensed separators
   - Forbidden output examples: `- [ ] #/1 #area-alpha |||| #todo`, `- [ ] #/1 #area-alpha ||||#todo`

## C. Order and mixed token sorting

9. Combined + project + due + importance order
   - Input: `#/1 #area-alpha/area-alpha-child [[Project Alpha]] 📅2026-03-29 || 11`
   - Action: `importance cycle`
   - Expected: tokens remain in `Order` sequence without panel jump

10. Wikilink classified as project
    - Input contains `[[...]]` in mixed payload
    - Expected: position follows `project` key from `Order`

11. Combined token classified by parent
    - Input: `#area-alpha/area-alpha-child`
    - Expected sorting key: `category`

## D. TagWheel separate mode

12. Empty line, left panel separate apply
    - Control: `==#/1 area-alpha area-alpha-child Project Alpha **[📅2026-03-29]**==`
    - Expected line: `- #/1 #area-alpha #area-alpha-child [[Project Alpha]] 📅2026-03-29 ||`

13. Text line, left panel separate apply
    - Input: `111`
    - Control: `==#/1 idea idea-child Project Inbox **[📅2026-03-29]**== || 111`
    - Expected line: `- [I] #/1 #idea #idea-child [[Project Inbox]] 📅2026-03-29 || 111`

14. Separate subtags parity in right panel
    - Input: any line with right panel target
    - Expected: subtag placement equals left-panel logic, no fallback to old behavior

## E. TagWheel data retention

15. Left payload date preservation
    - Input: `- [ ] #/1 #area-alpha 📅2026-03-29 || 111 || #todo`
    - TagWheel left panel no-op/confirm
    - Expected: due date does not disappear

16. Left payload tag/wiki preservation
    - Input has tags/wikilinks before first separator
    - Expected: parse/hydrate/apply preserves these tokens

## F. Date actions

17. due_right cursor parity
    - Input: `- [ ] #area-alpha || 111`
    - Action: `due_right`
    - Expected: `- [ ] #area-alpha || 111 || 📅YYYY-MM-DD`
    - Cursor: in text-slot before `separator2`

18. due_left clear semantics
    - Input: line with `📅today` in left flow
    - Expected: clear when rule says exit/clear, without stale reinsert

19. No duplicate date on repeat
    - Input: line with existing due
    - Repeated action should mutate or clear, never duplicate marker

## G. Cycle-end behavior

20. keep-bullet on empty-like
    - Expected final: `- `

21. clear-prefix on empty-like
    - Expected final: `` (empty line)

22. clear-prefix text-only strip
    - From `- text` -> `text`

## H. Free constraints for future work

23. Baseline should not regress when adding free-roam
    - Existing non-free-roam behavior unchanged unless spec updated

24. Baseline should not regress when adding custom fields
    - Existing keys still honor current `Order` behavior

## Run protocol

- Для hotkey `importance` эталонный путь: `statusTags` с `Action type=cycle_field:importance`.

- Проверять каждый кейс в двух потоках:
  - hotkey flow
  - TagWheel flow
- Любое расхождение строки или курсора = fail baseline
