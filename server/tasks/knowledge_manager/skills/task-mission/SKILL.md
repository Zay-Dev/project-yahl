# task-mission

Multi-stage overnight Knowledge Manager.

## How to start

- Cron: `POST /api/platform/cron/jobs` with `taskPath: "knowledge_manager"` (see handbook/how-to-run.md).
- Manual / from another stage: `/mastermind(dispatch-task-run, taskId: knowledge_manager, runInput: {})`.

## Pass A — same-topic note-making

1. `list-manager-topics` → every topic (Focus changes depth only).
2. Per topic: `list-pending-observations` → optional `research` for doubtful PLACE/weak evidence → feedback via `submit-knowledge-observation` (quoted vs inferred) → `apply-manager-topic` (hone + ApplyPlan + consume).
3. Use unique per-topic nixery outputs (`intake-{topic}.json`, `research-{topic}.md`, `apply-{topic}.json`). Never fabricate a success review when apply gate is missing/`ok:false` — set `applyFailed` and fail verify.
4. Skip `apply-manager-topic` when depth is `light` and both observations and needsValidation are empty (`skippedEmpty: true`). Focus topics still run apply (hone/quiz).
5. Never invent PLACE facts in validate; never call `upsert-knowledge-page` from validate/feedback — ApplyPlan owns narrative writes.

## Pass B — cross-topic synthesis

1. `group-manager-topics` → topic groups.
2. Per group with ≥2 topics: scan peers; `/mastermind(propose-knowledge-transfer)` only.
3. Tail: `apply-approved-transfers` for human-approved proposals.

## Non-goals

- Silent cross-topic merge
- One-shot hand wiki edits
- Stage agents outside this task calling manager write defs
