Topic: {{topic}}

Purpose: {{purpose}}

Cycle: {{cycle}}

Applied this cycle:

{{appliedJson}}

Re-explore `/data/knowledge_export/en/topics/{{topic}}/` and assess remaining duplicate/stacked sections.

Write `/workspace/dedup-review.json`:

```json
{
  "ok": false,
  "summary": "...",
  "remainingIssues": [],
  "followUpItems": [],
  "cycle": {{cycle}},
  "maxCycles": {{maxCycles}}
}
```

Set `ok: true` only when no follow-up work remains. Non-empty `followUpItems` re-enters execute on the next cycle.
