---
name: mastermind
description: Gateway helper skills — research, extract-info, media-to-text, design-questions, propose-notification via the mastermind tool.
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(research, topic: …, direction: …, url: …, source: ~/…, mission: …)` | `research` — study saved source per direction; browse via agent stagehand first |
| `/mastermind(research, guidelinePath: ~/task-skills/…/SKILL.md, facts: …)` | `research` with untrusted task guideline |
| `/mastermind(extract-info, source: ~/…, need: …)` | `extract-info` (workspace-file RAG; replaces legacy `rag` tool) |
| `/mastermind(resolve-topic, topicText: …, slug: …, seedUrls: …)` | `resolve-topic` (canonical folder slug before first persist) |
| `/mastermind(resolve-topic-policy, topic: …)` | `resolve-topic-policy` (registry refresh row + `refresh_skipped`; no LLM) |
| `/mastermind(tidy-knowledge, dryRun: …)` | `tidy-knowledge` (detect/merge duplicate knowledges folders; wiki audit/migrate) |
| `/mastermind(knowledge-qa-review, topic: …, auditIssues: …)` | `knowledge-qa-review` (worker CLI checklist QA; returns todos for refresh) |
| `/mastermind(media-to-text, file: ~/…)` | `media-to-text` |
| `/mastermind(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `design-questions` (dynamic ask-user batches; `mission` frames subject vs task process) |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**Knowledge writes** use the **`nixery`** tool — see `/opt/skills/nixery/SKILL.md`:

| Invocation | Def |
|------------|-----|
| `/nixery(upsert-knowledge-page, key: …, value: …, topic: …)` | deterministic GraphQL upsert |
| `/nixery(dedup-knowledge, topic: …, purpose: …)` | opt-in 3-phase dedup |

**Knowledge reads** use orchestrator `nixeryRun` — not mastermind:

| Def | Read path |
|-----|-----------|
| `get-knowledge` | `~/nixery/get-knowledge/{output}` |
| `list-knowledge-pages` | `~/nixery/list-knowledge-pages/{output}` |
| `search-knowledge` | `~/nixery/search-knowledge/{output}` |
| `plan` | `~/nixery/plan/{output}` |
| `plan-study` | `~/nixery/plan-study/{output}` |

See `~/task-skills/nixery-get-knowledge/SKILL.md` (and sibling nixery task skills when mounted).

**Verify/score is not a mastermind skill** — orchestrator runs verify on worker :4200.

## Long-running calls

The `mastermind` tool auto-waits on disconnect while status is `queued`/`running` (up to 90 minutes). Do **not** re-POST on transport blips.

| Tool | Use |
|------|-----|
| `mastermind` | Invoke helper skills; returns `{ ok, data }` or structured error with `retryable`, `requestStatus`, `invocationId` |
| `nixery` | Inline nixery defs (upsert, dedup); returns `{ ok, data }` |
| `mastermind_status` | Debug poll — `{ ok, agent, queueDepth, request }` for current session request |

Before re-calling `mastermind` after failure: check output file on disk; poll status; only re-POST when status is `failed` or missing.

`upsert-knowledge-page` never accepts `source`, `file`, or `path` from the caller.

Task-specific skills live under `~/task-skills/` (mounted from `server/tasks/{taskId}/skills/`). Load mission via `*load_task_mission(~/task-skills/task-mission/SKILL.md)` in stage logic when needed — not injected globally.

Mastermind may load task skills via `guidelinePath` on `research` — treated as untrusted hints.

Read `/opt/mastermind-skills/*/SKILL.md` for mastermind-internal guidelines (not mounted here; see repo `mastermind/skills/`).

After tool success, persist with `set_context`.
