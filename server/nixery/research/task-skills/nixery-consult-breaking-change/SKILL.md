# nixery-consult-breaking-change

Ask before breaking stage procedure. Deterministic — no LLM.

## Tool call

```json
{
  "defId": "consult-breaking-change",
  "args": {
    "proposedChange": "chunk sleep 300 into six sleep 50 calls",
    "reason": "run_bash timed out at 60s",
    "context": "monitor-loop adaptive sleep"
  }
}
```

## Result

`{ agree: boolean, reasons: string[], alternatives: string[] }`

- If `agree: false`, follow `alternatives` — do not apply the proposed change.
- Default is disagree for sleep-protocol rewrites, editing `SKILL.yaml` / `SKILL.yml` / task skills, or changing window/thresholds without an operator task edit.
- Agree only for narrow reversible ops (single transient retry, typo/path fix).
