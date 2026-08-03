# knowledge-wiki-style

Shared wiki write contract for knowledge tasks (`knowledge_capture`, `knowledge_refresh`, `user_onboarding`).

Read this file from task-mission skills and nixery `research` `guidelinePath` calls when persisting knowledge.

## Wiki pages (human + narrative RAG)

Under `topics/{slug}/`:

- `overview` — living narrative; merge sections on refresh
- `sources` — URLs, study plan, corpus assessment
- `studies/{id}` — per-source study markdown (`studyMd`)
- `facts` — cited claims and analysis themes (prose)
- `brief` — personalized summary for the user
- `todo` — refresh backlog written by nixery `knowledge-qa-review` / tidy flows; consumed by `knowledge_refresh`

Write for someone revisiting in six months: headings, bullets, short prose, wikilinks (`[[topics/{slug}/overview]]`).

**Never** put JSON-fence-only bodies on wiki pages.

## Raw references (agent machine store)

Under `topics/{slug}/raw/{key}/`:

- Structured JSON from stage profiles (`identity`, `goals`, `facts`, …)
- Q&A logs (`open_questions_qa`, `stage{N}_qa`)
- Study metadata (without full `studyMd` body)

Nixery **dual-writes** on `upsert-knowledge-page` with `key` + `value`: narrative → wiki page; structured value → `raw/{key}`.

Known keys in the static map are **suggestions**; unknown keys soft-default to a slug page. Prefer documented keys for knowledge tasks. Topics and `##` sections are open — any page/section is allowed.

## Agent API

- **Write (key suggestion):** `/nixery(upsert-knowledge-page, topic: …, key: …, value: …, mode?: …)` — nixery may dual-write wiki + raw; caller `mode` is honored for narrative pages.
- **Write (open page/section):** `/nixery(upsert-knowledge-page, topic: …, page: …, content: …, section?: …, mode?: …)` — any page under the topic; optional `section` (or `page: "foo#Section"`) targets a `##` heading; `append` stacks inside that section or at page end.
- **Read (preferred):** `nixeryRun: get-knowledge` + read `~/nixery/get-knowledge/{output}` — see `~/task-skills/nixery-get-knowledge/SKILL.md` when mounted via `_shared`.
- **Read (legacy):** `/mastermind(get-knowledge, topic: …, need: …)` — deprecated; do not add new usages.

## Refresh

Merge new content into existing overview sections unless the user chose full refresh.
