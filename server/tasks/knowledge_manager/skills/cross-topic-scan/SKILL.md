# cross-topic-scan

Scan a topic group for claims that belong in another topic. Follow learning-model cross-course synthesis. Overnight Pass B consolidates **obvious sibling sprawl** toward one canonical topic.

## Rules

1. Only consider groups with **≥ 2** topics.
2. Candidates must be reusable knowledge (not session-private OD noise).
3. Emit `/platform(propose-knowledge-transfer, sourceTopic, targetTopic, claim, rationale, example?, evidence?)` only.
4. **Never** upsert the target topic. **Never** whitelist-pre-approve.
5. Prefer zero proposals over **weak or speculative** transfers — not over obvious sibling consolidation.
6. Overlapping HOWTO / same-skill / same-error claims across **sibling topics in this group** are **cross-topic consolidation**. Propose transfer toward the canonical target. Do **not** dismiss them as “same-topic ApplyPlan work.”
7. Canonical target (pick one per claim cluster): registry canonical if known; else shortest non-plural stem among siblings; else a focus-depth topic if any; else the shortest slug.
8. Prefer **one** consolidate proposal per overlapping claim cluster (source = thinner / duplicate sibling, target = canonical).
9. Cross-cutting lessons already re-homed by ApplyPlan `targetTopic` should not be duplicated as Pass B transfers unless ApplyPlan missed them and a peer still holds a near-duplicate.
10. Do **not** treat different domain kinds as siblings for merge or consolidation (e.g. holidays vs weather vs traffic) even if they share a geo prefix.
