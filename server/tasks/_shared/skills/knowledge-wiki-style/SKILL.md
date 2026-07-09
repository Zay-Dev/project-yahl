# knowledge-wiki-style

Shared wiki write contract for knowledge tasks (`knowledge_capture`, `knowledge_refresh`, `user_onboarding`).

Read this file from task-mission skills and Mastermind `guidelinePath` calls when persisting knowledge.

## Wiki pages (human + narrative RAG)

Under `topics/{slug}/`:

- `overview` — living narrative; merge sections on refresh
- `sources` — URLs, study plan, corpus assessment
- `studies/{id}` — per-source study markdown (`studyMd`)
- `facts` — cited claims and analysis themes (prose)
- `brief` — personalized summary for the user
- `todo` — refresh backlog written by `knowledge_tidy` QA; consumed by `knowledge_refresh`

Write for someone revisiting in six months: headings, bullets, short prose, wikilinks (`[[topics/{slug}/overview]]`).

**Never** put JSON-fence-only bodies on wiki pages.

## Raw references (agent machine store)

Under `topics/{slug}/raw/{key}/`:

- Structured JSON from stage profiles (`identity`, `goals`, `facts`, …)
- Q&A logs (`open_questions_qa`, `stage{N}_qa`)
- Study metadata (without full `studyMd` body)

Mastermind **dual-writes** on `upsert-knowledge-page` with `key` + `value`: narrative → wiki page; structured value → `raw/{key}`.

Overview may link to raw refs: `[[topics/{slug}/raw/open_questions_qa]]`.

## Agent API (unchanged)

- **Write:** `/mastermind(upsert-knowledge-page, topic: …, key: …, value: …)` — mastermind picks wiki + raw targets.
- **Read:** `/mastermind(get-knowledge, topic: …, need: …)` — agents pass `need` only; mastermind selects which wiki + raw pages to load.

## Refresh

Merge new content into existing overview sections unless the user chose full refresh.
