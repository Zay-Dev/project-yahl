# nixery-research

Study workspace sources via `/nixery(research, topic: …, source: ~/…, mission: …)`.

## Tool call

```json
{
  "defId": "research",
  "args": {
    "topic": "study subject",
    "direction": "angle from learning_contract",
    "url": "https://…",
    "source": "~/nixery/study/topic/slug/raw.md",
    "mission": "subject goal",
    "guidelinePath": "~/task-skills/dialogue-round/SKILL.md",
    "outputPath": "~/nixery/study/topic/slug/round-1-research.md"
  }
}
```

## Result

Inline tool returns `{ ok, data: { ok, markdown, outputPath? } }`.

- Use `data.markdown` when writing via `→ path` in stage logic.
- Optional `outputPath` — def writes markdown to session file when set.

## Long-running

Research often takes 5–15 minutes. The `nixery` tool auto-waits up to 90 minutes.

Browse URLs with stagehand first; save excerpt under session workspace before calling research.
