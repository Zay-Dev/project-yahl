# cross-topic-scan

Scan a topic group for claims that belong in another topic. Follow learning-model cross-course synthesis.

## Rules

1. Only consider groups with **≥ 2** topics.
2. Candidates must be reusable knowledge (not session-private OD noise).
3. Emit `/platform(propose-knowledge-transfer, sourceTopic, targetTopic, claim, rationale, example?, evidence?)` only.
4. **Never** upsert the target topic. **Never** whitelist-pre-approve.
5. Prefer zero proposals over weak or speculative transfers.
6. If unsure whether a claim is cross-topic vs same-topic PLACE/HOWTO, leave it for same-topic ApplyPlan — do not transfer.
7. Cross-cutting lessons already re-homed by ApplyPlan `targetTopic` should not be duplicated as Pass B transfers unless ApplyPlan missed them and a peer topic exists.
