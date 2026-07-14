---
name: mastermind
description: Gateway helper skills — topic registry, policies, notifications, tidy, QA
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(resolve-topic, topicText: …, slug: …, seedUrls: …)` | `resolve-topic` (canonical folder slug before first persist) |
| `/mastermind(resolve-topic-policy, topic: …)` | `resolve-topic-policy` (registry refresh row + `refresh_skipped`; no LLM) |
| `/mastermind(tidy-knowledge, dryRun: …)` | `tidy-knowledge` (detect/merge duplicate knowledges folders; wiki audit/migrate) |
| `/mastermind(knowledge-qa-review, topic: …, auditIssues: …)` | `knowledge-qa-review` (worker CLI checklist QA; returns todos for refresh) |
| `/mastermind(media-to-text, file: ~/…)` | `media-to-text` |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**LLM helpers moved to nixery** — use the **`nixery`** tool instead:

| Invocation | Def |
|------------|-----|
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

**Verify/score is not a mastermind skill** — orchestrator runs verify on worker :4200.

## Long-running calls

The `mastermind` tool auto-waits on disconnect while status is `queued`/`running` (up to 90 minutes). The `nixery` tool uses the same wait semantics for `research`.

| Tool | Use |
|------|-----|
| `mastermind` | Deterministic + platform skills above |
| `nixery` | Inline nixery defs (upsert, dedup, research, extract-info, design-questions) |

Task-specific skills live under `~/task-skills/`. Load mission via `*load_task_mission(~/task-skills/task-mission/SKILL.md)` when needed.
