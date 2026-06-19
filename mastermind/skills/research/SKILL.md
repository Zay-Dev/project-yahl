---
name: research
description: Mastermind helper — synthesize research from knowledges/ and workspace sources.
---

# research

Use `/mastermind(research, topic: …)` in stage logic. Calls the `mastermind` tool with `skill: "research"`.

## Tool

```json
{
  "skill": "research",
  "args": { "topic": "your subject", "depth": "summary" }
}
```

Write results to stage context via `set_context` after the tool returns.
