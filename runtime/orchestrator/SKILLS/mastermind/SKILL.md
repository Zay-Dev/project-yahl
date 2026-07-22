---
name: mastermind
description: Gateway helper skills — topic policies, dispatch, notifications
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic. Mastermind is HTTP-only (no Cursor).

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(list-topic-policies)` | `list-topic-policies` (registry rows; no LLM) |
| `/mastermind(resolve-topic-policy, topic: …)` | `resolve-topic-policy` (registry refresh row + `refresh_skipped`; no LLM) |
| `/mastermind(patch-topic-policy, topic: …, …)` | `patch-topic-policy` (update refresh policy; no LLM) |
| `/mastermind(evaluate-knowledge-refresh)` | `evaluate-knowledge-refresh` (stale topics; no LLM) |
| `/mastermind(dispatch-task-run, taskId: …, …)` | `dispatch-task-run` (queue a task run; no LLM) |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**Moved to nixery** — use the **`nixery`** tool instead:

| Invocation | Def |
|------------|-----|
| `/nixery(resolve-topic, …)` | canonical topic slug |
| `/nixery(tidy-knowledge, …)` | wiki/export audit |
| `/nixery(knowledge-qa-review, …)` | corpus load → OpenAI checklist QA |
| `/nixery(research, …)` | study / synthesis markdown |
| `/nixery(extract-info, source: ~/…, need: …)` | workspace-file RAG |
| `/nixery(media-to-text, file: ~/…)` | media → plain text for text-only agents (Cursor CLI) |
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

| Tool | Use |
|------|-----|
| `mastermind` | Policy / dispatch / notification skills above |
| `nixery` | Inline nixery defs (resolve-topic, tidy, QA, upsert, dedup, research, media-to-text, …) |

Task-specific skills live under `~/task-skills/`. Load mission via `*load_task_mission(~/task-skills/task-mission/SKILL.md)` when needed.
