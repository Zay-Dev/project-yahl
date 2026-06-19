---
name: mastermind
description: Gateway helper skills — research, extract-info, extract-knowledge, persist-knowledge, media-to-text, plan, propose-notification via the mastermind tool.
---

# mastermind (stage agent)

Use the **`mastermind`** API tool for `/mastermind(...)` in stage logic.

| Invocation | Tool skill |
|------------|------------|
| `/mastermind(research, topic: …)` | `research` |
| `/mastermind(extract-info, source: ~/…, need: …)` | `extract-info` (workspace-file RAG; replaces legacy `rag` tool) |
| `/mastermind(extract-knowledge, need: …, topic: …)` | `extract-knowledge` (scans `knowledges/`; no paths) |
| `/mastermind(persist-knowledge, key: …, value: …, topic: …)` | `persist-knowledge` (writes `knowledges/`; no paths) |
| `/mastermind(media-to-text, file: ~/…)` | `media-to-text` |
| `/mastermind(plan, goal: …)` | `plan` |
| `/mastermind(propose-notification, channel: …, direction: …, to: …, body: …)` | `propose-notification` (draft only; human approve → worker send) |

**Verify/score is not a mastermind skill** — use `verify: true` on the task stage instead.

`extract-knowledge` and `persist-knowledge` never accept `source`, `file`, or `path` from the caller.

Read `/opt/mastermind-skills/*/SKILL.md` for mastermind-internal guidelines (not mounted here; see repo `mastermind/skills/`).

After tool success, persist with `set_context`.
