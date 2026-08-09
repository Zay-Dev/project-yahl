# nixery (YAHL)

Plug-and-play defs for `/nixery(defId, …)`. The set of defs can change — treat `/opt/skills/nixery/SKILL.md` as the current catalog snapshot, not a guarantee.

## Model

- **Inline** (`nixery` tool): stage agents call defs with `output.inlineTool: true` (or manager bypass where allowed).
- **Orchestrator `nixeryRun`**: non-inline defs (e.g. knowledge reads). After the stage, read `~/nixery/{defId}/{output}` when the task/stage expects it.
- If a `defId` is missing, not inline-enabled, or forbidden for this task: fix args, pick another path from the skill, or skip — do not invent defs.

## Soft-fail then abandon

Inline `{ ok: false, error }` (bad args or transient infra such as registry pull blips) soft-fails up to `YAHL_NIXERY_INLINE_RETRY_MAX` (default **3**). While `retryRemaining > 0`, fix args and retry. After the budget: `{ ok: false, abandoned: true }` — **continue the stage** (skip that call / move on). Soft-fail never aborts the stage; orchestrator `nixeryRun` stages remain hard failures.

Def YAML `output.retry` (default **3**) controls container re-runs after validation failure (separate from inline soft-fail).

## Policy pointers

- Knowledge writes and tool-error recovery → sibling `knowledge-persist.md` and `~/task-skills/resolve-errors-with-knowledge` when present.
- Current call shapes, allowlists, and helper catalog → `/opt/skills/nixery/SKILL.md`.

## Breaking changes

Before any **breaking change** to stage procedure (sleep/wait protocol, window length, adaptive thresholds, editing `SKILL.yahl` / task-skills), read the nixery skill and call the current catalog’s consult def if it exists. If that call returns `agree: false`, follow `alternatives` — do not proceed.
