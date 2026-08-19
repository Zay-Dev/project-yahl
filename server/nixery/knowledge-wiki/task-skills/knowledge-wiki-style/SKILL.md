# knowledge-wiki-style

Shared wiki contract for knowledge tasks. **Stage agents do not upsert narrative pages.**

## Agent path

Submit atomic observations only when **worth persisting** (see `~/task-skills/worth-persisting-knowledge/SKILL.md`):

`/nixery(submit-knowledge-observation, cue: …, claim: …, example|quote: …, evidence: …, topic_hint?: …)`

See `~/task-skills/submit-knowledge-observation/SKILL.md`.

- Soft `topic_hint` (optional) — content-based best effort; never force the task domain slug for cross-cutting lessons
- Knowledge Manager decides apply section **and** final topic

## Knowledge Manager path

Under `topics/{slug}/`, the manager (via `nixeryRun`, not agent inline tools) maintains:

- `overview` — living narrative
- `sources` — URLs, study plan
- `studies/{id}` — per-source study markdown
- `facts` — cited claims
- `brief` — short summary
- `todo` — refresh / research backlog
- `raw/observations/{YYYY-MM-DD}/{id}` — inbox from stage agents
- `raw/{key}` — machine raw twins when dual-written

Write for someone revisiting in six months: headings, bullets, short prose, wikilinks (`[[topics/{slug}/overview]]`).

**Never** put JSON-fence-only bodies on wiki pages.

## Reads

Preferred: orchestrator `nixeryRun: get-knowledge` + read `~/nixery/get-knowledge/{output}`.
