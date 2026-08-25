# task-mission

Multi-stage overnight Knowledge Manager.

## How to start

- Cron: `POST /api/platform/cron/jobs` with `taskPath: "knowledge_manager"` and `runInput.knowledge_manager_instruction` (see handbook/how-to-run.md).
- Manual / from another stage: `/platform(dispatch-task-run, taskId: knowledge_manager, runInput: { knowledge_manager_instruction: "…" })`.
- Optional this-run mission addon: `runInput.additional_instruction` (does not replace `knowledge_manager_instruction`).

## Pass A — same-topic note-making

1. `list-manager-topics` → every topic (Focus in `knowledge_manager_instruction` changes depth only; optional `additional_instruction` adds mission text). Alias slugs are omitted (merged siblings are not first-class).
2. Per topic: `list-pending-observations` → optional `research` for doubtful PLACE/weak evidence → feedback via `submit-knowledge-observation` (quoted vs inferred) → `apply-manager-topic` (hone + ApplyPlan + consume). ApplyPlan may set `targetTopic` to re-home cross-cutting notes by content — do not force task domain slugs for cross-cutting lessons.
3. Use unique per-topic nixery outputs (`intake-{topic}.json`, `research-{topic}.md`, `apply-{topic}.json`). Never fabricate a success review when apply gate is missing/`ok:false` — set `applyFailed` and fail verify. Stage-verify judges **reviews_acc in context only** (do not require gate file paths in the rubric).
4. Skip `apply-manager-topic` when depth is `light` and both observations and needsValidation are empty (`skippedEmpty: true`). Focus topics still run apply (hone/quiz).
5. Never invent PLACE facts in validate; never call `upsert-knowledge-page` from validate/feedback — ApplyPlan owns narrative writes.

## Pass B — merge obvious sibling topics, then propose residual transfers

1. `group-manager-topics` → topic groups (shared slug prefix + plural-stem merge). Multi-topic groups include `canonical` (shortest non-plural stem). **Domain kinds are not merged across families** — e.g. `*-holidays` stays separate from `*-weather` / `*-traffic` even when they share a geo prefix like `hk-`. Affinity pairs that do not share a prefix (e.g. `notifications` with `platform-*`) are **not** auto-grouped — merge them explicitly with `/nixery(merge-topic)` when they are obvious siblings.
2. Per group with ≥2 topics: for each non-canonical member, `/nixery(merge-topic, sourceTopic, targetTopic: canonical)` — registry `addAlias` + delete source wiki tree (no stub folder). Soft-fail per merge; record in `merges_acc`. Do **not** call `merge-topic` across different domain kinds (holidays vs weather vs traffic vs platform).
3. Per remaining multi-topic group: scan peers per `cross-topic-scan`; `/platform(propose-knowledge-transfer)` only for non-obvious cross-cutting claims.
4. Tail: `apply-approved-transfers` for human-approved proposals (returns `targetTopics`).

## Within-topic dedup (after merge)

1. Build `dedup_topics` = successful Pass A applies ∪ transfer `targetTopics` ∪ merge canonicals.
2. Per topic: `/nixery(dedup-knowledge, topic: …, purpose: …, output: dedup-{topic}.json)` — collapse duplicate H2 / near-duplicate HOWTO blocks.
3. Soft-fail: record `dedupOk` on the matching review; do not fail the overnight run solely on dedup gate missing/`ok:false`.
4. Validate/feedback stages must never call `dedup-knowledge`.

## Non-goals

- Silent cross-topic merge from **non-manager** tasks (KM overnight merge of obvious siblings is allowed)
- One-shot hand wiki edits
- Stage agents outside this task calling manager write defs
