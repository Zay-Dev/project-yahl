---
name: propose-knowledge-transfer
description: Create a pending cross-topic knowledge apply proposal and notify SYSTEM_ADMIN — does not write the target topic.
---

# propose-knowledge-transfer

Use `/mastermind(propose-knowledge-transfer, sourceTopic: …, targetTopic: …, claim: …, rationale: …, example?: …, evidence?: …)` from Knowledge Manager only.

Creates a `knowledge_transfer` platform proposal (`pending`). Never whitelist-pre-approves. Notifies `SYSTEM_ADMIN_EMAIL` when configured. Humans approve at `/platform/approvals`. Manager applies only after `approved`.

```json
{
  "skill": "propose-knowledge-transfer",
  "args": {
    "sourceTopic": "traffic-monitor",
    "targetTopic": "hk-weather",
    "claim": "…",
    "example": "…",
    "rationale": "why this also applies to target",
    "evidence": { "observationIds": ["…"] }
  }
}
```

Returns `{ proposalId }`.
