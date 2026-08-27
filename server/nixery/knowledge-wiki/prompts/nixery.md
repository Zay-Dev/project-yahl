# nixery (YAHL)

Plug-and-play defs for `/nixery(defId, …)`. The set of defs can change — treat `/opt/skills/nixery/SKILL.md` as the current catalog snapshot, not a guarantee. That directory is catalog-only; do not `find` ability `index.yml` trees or other sessions.

## Model

- **Inline** (`nixery` tool): stage agents may call any installed ability mid-logic.
- **Orchestrator `nixeryRun`**: agent-free stage that runs one ability; following stages read `~/nixery/{defId}/{output}` when the task expects it.
- If a `defId` is missing or forbidden for this task: fix args, pick another path from the skill, or skip — do not invent defs.

## Soft-fail (unified)

Each `runNixeryDef` call retries by **call site**: inline defaults to **1** attempt (`output.retry` overrides); `nixeryRun` defaults to **10** (override in the def `index.yml`). On validation failure or gate `{ ok: false }`, the orchestrator rewrites `input.json` with:

```json
"nixeryRetry": {
  "attempt": 0,
  "maxAttempts": 10,
  "isFinalAttempt": false,
  "feedback": "<error text>"
}
```

In-container LLM agents append `feedback` as a **user** message and re-run. Pure Node defs ignore it safely.

After the attempt budget is exhausted:

- **Inline**: tool result `{ ok: false, error, abandoned: true }` — **continue the stage** (skip that call / move on). Soft-fail never aborts the stage.
- **`nixeryRun`**: hard failure.

Pre-run failures only (invalid `/nixery` argv, unknown def, namespace gate) still use a thin stage soft-fail budget (`YAHL_NIXERY_INLINE_RETRY_MAX`, default **1**).

## Policy pointers

- Knowledge writes and tool-error recovery → sibling `knowledge-persist.md` and `/opt/skills/resolve-errors-with-knowledge` when present.
- Current call shapes and helper catalog → `/opt/skills/nixery/SKILL.md` (read that file; do not hunt host paths).

## Breaking changes

Before any **breaking change** to stage procedure (sleep/wait protocol, window length, adaptive thresholds, editing `SKILL.yaml` / `SKILL.yml` / task-skills), read the nixery skill and call the current catalog’s consult def if it exists. If that call returns `agree: false`, follow `alternatives` — do not proceed.
