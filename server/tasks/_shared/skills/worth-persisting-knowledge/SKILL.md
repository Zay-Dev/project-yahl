# worth-persisting-knowledge

When to submit observations. Tasks do **not** prescribe checklists (no “always persist PLACE”, no “always emit SUMMARY”). Knowledge Manager owns apply shape **and** final topic.

Observation examples in other skills are **claim shapes after learning** — not live API/tool argument schemas.

## Submit when

Novel **and** evidenced. Prefer zero submits for weak PLACE / domain noise.

Worth persisting (tag when clear; tags are hints only):

| Kind | Examples |
|------|----------|
| Domain HOWTO / TRICK / Q&A / ops-log | Provider steps, SKIP/FAIL, reusable tricks |
| PLACE identity | OD bind, claimed_place + bound_poi in evidence |
| Tool / platform lessons | Any tool: browser, nixery, platform, run_bash, … — failure modes and working paths |
| Research / probe fails | Why a source failed; equal weight to success tips |
| Cross-cutting skills | Anything reusable outside this task’s domain wiki |

### Observed failures (any tool)

A concrete tool failure **is** an observation (`confidence: observed`): `ok:false`, rejected args, bind miss, extract empty when UI showed data, etc. Submit it — do not wait for a later success. Prefer zero does **not** apply here.

### Fail then succeed (any tool)

If you later find a working path after that failure, submit a **second**, separate observation (HOWTO/TRICK) for the working args / workaround. Do **not** fold failure and success into one note.

## Do not

- Skip tool/platform lessons because the task domain is traffic (or similar)
- Suppress evidenced tool failures under “prefer zero submits”
- Force `topic_hint` to the task’s `knowledge_topic` for cross-cutting claims
- Invent mandatory end-of-run SUMMARY (or similar) submits
- Call `upsert-knowledge-page` — use `submit-knowledge-observation` only
- Treat observation JSON examples as the live schema for calling tools

## Soft topic_hint

Best-effort content slug, or omit (lands in `inbox`). Wrong hint is OK — Knowledge Manager re-homes by content.

See `~/task-skills/submit-knowledge-observation/SKILL.md` and `~/task-skills/knowledge-wiki-style/SKILL.md`.
