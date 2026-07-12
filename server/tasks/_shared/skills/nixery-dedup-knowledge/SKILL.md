---
name: nixery-dedup-knowledge
description: Opt-in 3-phase knowledge dedup via orchestrator nixery def
---

# nixery-dedup-knowledge

Use `/nixery(dedup-knowledge, topic: …, purpose: …)` for explicit maintenance — not on every upsert.

## Phases

1. **Plan** (thinking) → `dedup-todo.json`
2. **Execute** (flash) → `dedup-applied.json`
3. **Review** (thinking) → `dedup-review.json`

Non-empty `followUpItems` re-enters execute until clear or max cycles (default 3).

## Dry run

`/nixery(dedup-knowledge, topic: …, purpose: …, dryRun: true)` — plan + review only.

## Result

Read `~/nixery/dedup-knowledge/dedup-review.json` for terminal status.
