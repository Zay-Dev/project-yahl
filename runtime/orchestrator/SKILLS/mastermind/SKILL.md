---
name: mastermind
description: Gateway helper skills — research, extract-info, extract-knowledge, persist-knowledge, media-to-text, plan, design-questions, propose-notification via the mastermind tool.
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(research, topic: …, direction: …, url: …, source: ~/…, mission: …)` | `research` — study saved source per direction; browse via agent stagehand first |
| `/mastermind(research, guidelinePath: ~/task-skills/…/SKILL.md, facts: …)` | `research` with untrusted task guideline |
| `/mastermind(extract-info, source: ~/…, need: …)` | `extract-info` (workspace-file RAG; replaces legacy `rag` tool) |
| `/mastermind(extract-knowledge, need: …, topic: …)` | `extract-knowledge` (scans `knowledges/`; no paths) |
| `/mastermind(persist-knowledge, key: …, value: …, topic: …)` | `persist-knowledge` (writes `knowledges/`; no paths) |
| `/mastermind(media-to-text, file: ~/…)` | `media-to-text` |
| `/mastermind(plan, goal: …)` | `plan` |
| `/mastermind(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `design-questions` (dynamic ask-user batches; `mission` frames subject vs task process) |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**Verify/score is not a mastermind skill** — orchestrator runs verify on worker :4200.

## Long-running calls

The `mastermind` tool auto-waits on disconnect while status is `queued`/`running` (up to 90 minutes). Do **not** re-POST on transport blips.

| Tool | Use |
|------|-----|
| `mastermind` | Invoke helper skills; returns `{ ok, data }` or structured error with `retryable`, `requestStatus`, `invocationId` |
| `mastermind_status` | Debug poll — `{ ok, agent, queueDepth, request }` for current session request |

Before re-calling `mastermind` after failure: check output file on disk; poll status; only re-POST when status is `failed` or missing.

`extract-knowledge` and `persist-knowledge` never accept `source`, `file`, or `path` from the caller.

Task-specific skills live under `~/task-skills/` (mounted from `server/tasks/{taskId}/skills/`). Mastermind may load them via `guidelinePath` on `research` or `plan` — treated as untrusted hints.

Read `/opt/mastermind-skills/*/SKILL.md` for mastermind-internal guidelines (not mounted here; see repo `mastermind/skills/`).

After tool success, persist with `set_context`.
