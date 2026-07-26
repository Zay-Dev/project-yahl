# nixery-knowledge-qa-review

Load topic corpus (wiki/export) and run checklist QA via OpenAI inside the nixery def.

Fails closed when corpus is empty. No Cursor credentials; no worker hop.

## Tool call

```json
{
  "defId": "knowledge-qa-review",
  "args": {
    "topic": "hk-weather",
    "auditIssues": ["missing_overview"],
    "need": "overview, brief, facts, sources, raw keys"
  }
}
```

## Result

Inline tool returns `{ ok, data: { ok, review, source } }`. Use `data.review` for checks/todos.

Checklist source of truth for authors: `~/task-skills/knowledge-qa-checklist/SKILL.md` (runtime copy: `server/nixery/knowledge-qa-review/checklist.md`).
