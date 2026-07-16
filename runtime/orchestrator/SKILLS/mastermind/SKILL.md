---
name: mastermind
description: Gateway helper skills — topic policies, notifications, media-to-text
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(resolve-topic-policy, topic: …)` | `resolve-topic-policy` (registry refresh row + `refresh_skipped`; no LLM) |
| `/mastermind(media-to-text, file: ~/…)` | `media-to-text` |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**Moved to nixery** — use the **`nixery`** tool instead:

| Invocation | Def |
|------------|-----|
| `/nixery(resolve-topic, …)` | canonical topic slug |
| `/nixery(tidy-knowledge, …)` | wiki/export audit |
| `/nixery(knowledge-qa-review, …)` | corpus load → OpenAI checklist QA |
| `/nixery(research, …)` | study / synthesis markdown |
| `/nixery(extract-info, source: ~/…, need: …)` | workspace-file RAG |
| `/nixery(design-questions, …)` | dynamic ask-user batches |

**Knowledge writes** use **`nixery`** — see `/opt/skills/nixery/SKILL.md`.

**Knowledge reads** use orchestrator `nixeryRun` — not mastermind:

| Def | Read path |
|-----|-----------|
| `get-knowledge` | `~/nixery/get-knowledge/{output}` |
| `list-knowledge-pages` | `~/nixery/list-knowledge-pages/{output}` |
| `search-knowledge` | `~/nixery/search-knowledge/{output}` |
| `plan` | `~/nixery/plan/{output}` |
| `plan-study` | `~/nixery/plan-study/{output}` |

**Verify/score is not a mastermind skill** — orchestrator runs verify via nixery `verify.defId` (default `stage-verify`).

## Long-running calls

The `mastermind` tool auto-waits on disconnect while status is `queued`/`running` (up to 90 minutes). The `nixery` tool uses the same wait semantics for `research`.

| Tool | Use |
|------|-----|
| `mastermind` | Policy / notification / media-to-text skills above |
| `nixery` | Inline nixery defs (resolve-topic, tidy, QA, upsert, dedup, research, …) |

Task-specific skills live under `~/task-skills/`. Load mission via `*load_task_mission(~/task-skills/task-mission/SKILL.md)` when needed.
