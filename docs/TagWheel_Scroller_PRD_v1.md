# PRD: TagWheel Overlay Scroller (v1)

## 1) Overview

### Feature name
TagWheel Overlay Scroller

### Goal
Add an optional visual scroller for the active TagWheel field that is rendered as an overlay above editor text (no document reflow), while preserving existing TagWheel business behavior.

### Problem statement
Current TagWheel interaction updates values correctly but does not expose nearby field values during cycling. Users need a visible "revolver drum" style preview for the active field to improve predictability and speed.

### Success criteria
- OFF mode is behaviorally identical to current plugin behavior.
- ON mode adds only visual overlay behavior.
- Overlay follows active field, does not shift line layout, and updates instantly on field/value changes.

## 2) Scope

### In scope
- New settings for scroller enablement, direction, and size.
- Overlay rendering anchored to active TagWheel token (`**[active]**`).
- Ring-based value window visualization for active field.
- Keyboard-only interaction (existing TagWheel keymap).
- Lifecycle-safe create/update/destroy of overlay.

### Out of scope
- Any changes to TagWheel value cycle business logic.
- Mouse interaction/click-to-select.
- Animations/transitions.
- Changes to output line finalization rules.

## 3) User stories

1. As a TagWheel user, when I enable scroller, I want to see nearby values for the active field while cycling up/down.
2. As a TagWheel user, when I move between fields, I want the scroller to move to the newly active field immediately.
3. As a TagWheel user, I want the scroller to stay visually above text and never push other note lines.
4. As a power user, I want direction and visible window size settings to control scroller presentation.

## 4) Functional requirements

### FR-1: Feature flag
- Add `pkm.behavior.tagWheelScroller.enabled` (`boolean`, default `false`).
- When `false`, no overlay is created and behavior is identical to baseline.

### FR-2: Direction mode
- Add `pkm.behavior.tagWheelScroller.direction` (`"up" | "down" | "full"`, default `"full"`).
- `up`: render only increase side above active slot.
- `down`: render only decrease side below active slot.
- `full`: render both sides.

### FR-3: Visible size
- Add `pkm.behavior.tagWheelScroller.size` (`number`, default `3`, clamped `1..20`).
- Defines count of visible elements per side window.

### FR-4: Anchor and positioning
- Overlay must be anchored to currently active TagWheel field token (`**[active]**`) in control line.
- On active field switch (`ArrowLeft`, `ArrowRight`, `Tab`) overlay must instantly re-anchor.

### FR-5: Value source and labels
- Scroller values must come from the same active-field value resolution path as current TagWheel rendering.
- Label shown in scroller must match what TagWheel currently displays for that field/value.
- Empty/default value must be represented as `-`.

### FR-6: Ring behavior visualization
- Scroller list must behave as circular sequence aligned with current increase/decrease semantics.
- On each value change (`ArrowUp` / `ArrowDown`), visible window shifts synchronously.

### FR-7: Cursor invariants
- Cursor remains on current TagWheel line at all times during active TagWheel session.
- Scroller movement must not change cursor line.

### FR-8: Overlay layout invariants
- Overlay must be rendered out-of-flow (above text), without changing editor line heights or moving surrounding lines.
- Overlay should avoid visual collisions by viewport-aware placement.

### FR-9: Width policy
- Scroller width policy: `min-width = max(active field visual width, longest visible item width)`.
- If viewport constraints prevent full width, apply safe clamp without document reflow.

### FR-10: Settings UI placement
- Add controls in `Settings -> Visual`.
- Group labels:
  - Header: `TagWheel`
  - Subheader: `Scroller`
- Controls (EN only):
  - `TagWheel scroller` (ON/OFF)
  - `Scroller direction` (up/down/full)
  - `Scroller size` (N)

### FR-11: Lifecycle safety
- Create overlay on TagWheel activation when enabled.
- Update overlay on handled TagWheel key events affecting field/value/mode.
- Destroy overlay on apply/cancel/error/deactivation/plugin unload/editor context switch.

### FR-12: Fail-safe behavior
- Overlay failure must not break TagWheel cycle/apply flow.
- On overlay runtime error, disable overlay instance for that session and continue TagWheel logic.

## 5) Non-functional requirements

### NFR-1: Performance
- No perceivable lag during sustained `ArrowUp/ArrowDown` cycling.
- Position updates should be lightweight and deterministic.

### NFR-2: Stability
- No leaked DOM overlays after session end.
- No stale overlay across note/leaf switches.

### NFR-3: Compatibility
- Must preserve current saved config compatibility through migration defaults.
- Must preserve compile/startup safety constraints (no new dangerous top-level loader regressions).

### NFR-4: Theming
- Use Obsidian CSS variables where possible; avoid hardcoded theme-breaking palette assumptions.

## 6) Edge behavior policy

### Viewport edges
Use least-surprising strategy:
1. Try requested direction placement.
2. If overflow is severe, auto-flip (`up <-> down`).
3. If still overflow, clamp position/size to remain visible.

### Large field catalogs
- If field contains many values and size is small, only window subset is shown.
- `-` (default) is included in ring sequence but may be outside visible window.

## 7) Acceptance criteria

1. OFF mode produces identical behavior and output to baseline.
2. ON mode shows overlay anchored to active field and never reflows document lines.
3. Direction modes (`up/down/full`) affect only visualization, not cycle mechanics.
4. `size` limits visible window per spec and ring shift remains synchronized.
5. Default value is rendered as `-` when visible.
6. Cursor stays on active TagWheel line throughout the session.
7. Overlay follows active field instantly on field switch.
8. Overlay width follows policy `max(field width, longest visible item)` with safe viewport clamp.
9. Overlay is reliably destroyed on apply/cancel/error/session end.

## 8) Test plan

### Automated checks
- `node --check` for all touched runtime/UI/core files.
- `node tests/regression/bootstrap_loader_tests.js`.
- `node tests/TagWheel/tagwheel_tests.js`.
- `node tests/TriggerWheel/triggerwheel_tests.js`.

### Manual matrix (Obsidian)
- OFF parity baseline.
- ON with `direction=up`, `down`, `full`.
- `size` boundary cases (`1`, default `3`, high clamp).
- Active field switch via left/right and `Tab`.
- Long line + editor scroll behavior.
- Leaf/note switch while TagWheel active.
- Apply (`Enter`) and cancel (`Escape`) cleanup.

## 9) Risks and mitigations

### Risk: Active token geometry extraction instability
- Mitigation: fallback anchor to control-line cursor coordinates if token-range geometry not available.

### Risk: Overlay persistence/leaks
- Mitigation: centralize destroy path and invoke from all TagWheel exits.

### Risk: Regressions in TagWheel logic
- Mitigation: isolate overlay as visual adapter layer only; no modifications to cycle semantics.

## 10) Implementation boundaries

- Universal behavior logic remains in shared/core pathways; no duplicated domain behavior in adapter files.
- No hardcoded canonical domain/order key fallback additions.
- Keep patch cycles small: config -> runtime pass-through -> overlay render -> settings -> tests/docs.

## 11) Definition of done

- All functional requirements implemented.
- All acceptance criteria validated.
- Mandatory checks green.
- `WORK_TODO.md`, `DEV_LOG.md`, and `TESTING.md` updated per project contract.
- Documentation updated in plugin docs.
