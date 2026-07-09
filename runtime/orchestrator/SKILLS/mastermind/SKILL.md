---
name: mastermind
description: Gateway helper skills — research, extract-info, get-knowledge, upsert-knowledge-page, media-to-text, plan, design-questions, propose-notification via the mastermind tool.
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(research, topic: …, direction: …, url: …, source: ~/…, mission: …)` | `research` — study saved source per direction; browse via agent stagehand first |
| `/mastermind(research, guidelinePath: ~/task-skills/…/SKILL.md, facts: …)` | `research` with untrusted task guideline |
| `/mastermind(extract-info, source: ~/…, need: …)` | `extract-info` (workspace-file RAG; replaces legacy `rag` tool) |
| `/mastermind(get-knowledge, need: …, topic: …)` | `get-knowledge` (mastermind reads knowledges/ + aliases; writes `~/knowledge/{key}.json`; returns key/path only) |
| `/mastermind(upsert-knowledge-page, key: …, value: …, topic: …)` | `upsert-knowledge-page` (writes canonical `knowledges/` folder; no paths) |
| `/mastermind(resolve-topic, topicText: …, slug: …, seedUrls: …)` | `resolve-topic` (canonical folder slug before first persist) |
| `/mastermind(resolve-topic-policy, topic: …)` | `resolve-topic-policy` (registry refresh row + `refresh_skipped`; no LLM) |
| `/mastermind(tidy-knowledge, dryRun: …)` | `tidy-knowledge` (detect/merge duplicate knowledges folders; wiki audit/migrate) |
| `/mastermind(knowledge-qa-review, topic: …, auditIssues: …)` | `knowledge-qa-review` (worker CLI checklist QA; returns todos for refresh) |
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

`get-knowledge` and `upsert-knowledge-page` never accept `source`, `file`, or `path` from the caller. After `get-knowledge`, read `~/knowledge/{key}.json` and use `.extracted` — never read `~/knowledges/`.

Task-specific skills live under `~/task-skills/` (mounted from `server/tasks/{taskId}/skills/`). Mastermind may load them via `guidelinePath` on `research` or `plan` — treated as untrusted hints.

Read `/opt/mastermind-skills/*/SKILL.md` for mastermind-internal guidelines (not mounted here; see repo `mastermind/skills/`).

After tool success, persist with `set_context`.
