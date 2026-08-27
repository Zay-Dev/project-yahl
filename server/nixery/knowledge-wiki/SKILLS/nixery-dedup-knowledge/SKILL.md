---
name: nixery-dedup-knowledge
description: Within-topic 3-phase knowledge dedup via orchestrator nixery def
---

# nixery-dedup-knowledge

Use `/nixery(dedup-knowledge, topic: …, purpose: …)` for within-topic page maintenance — collapse duplicate H2 / near-duplicate HOWTO blocks.

Overnight Knowledge Manager runs this **after** `apply-approved-transfers` on topics that had a successful apply and/or received an approved transfer. Soft-fail: missing/`ok:false` gate must not fail the overnight run.

Do **not** call from validate/feedback stages.

## Phases

1. **Plan** (thinking) → `dedup-todo.json`
2. **Execute** (flash) → `dedup-applied.json`
3. **Review** (thinking) → `dedup-review.json`

Non-empty `followUpItems` re-enters execute until clear or max cycles (default 3).

## Dry run

`/nixery(dedup-knowledge, topic: …, purpose: …, dryRun: true)` — plan + review only.

## Result

Read `~/nixery/dedup-knowledge/dedup-review.json` (or the `output` gate filename) for terminal status.
