---
name: research
description: Mastermind helper — study workspace sources and synthesize research from knowledges/.
---

# research

Use `/mastermind(research, topic: …)` in stage logic. Calls the `mastermind` tool with `skill: "research"`.

**Browse** URLs with agent `browser`/stagehand first; save excerpt under `~/sources/raw/`. Pass that path as `source`.

## Tool

```json
{
  "skill": "research",
  "args": {
    "topic": "study subject",
    "direction": "angle from learning_contract",
    "url": "https://…",
    "source": "~/sources/raw/example.md",
    "mission": "subject goal — not task mechanics",
    "facts": {}
  }
}
```

| Arg | Purpose |
|-----|---------|
| `topic` | What to produce |
| `direction` | How to study (from user/clarify) |
| `url` | Canonical source URL |
| `source` | Session workspace file with fetched excerpt |
| `mission` | Why — subject/user goal, not YAHL process |
| `guidelinePath` | Optional task-local SKILL via `~/task-skills/…` |

Returns Markdown: Summary, Key points, Quotes/data, Open questions, Source URL.

Write results to stage context via `set_context` after the tool returns. Persist study notes with `persist-knowledge` immediately — cap `studyMd` at 12KB per key.
