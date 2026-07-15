# synthesize-knowledge-summary

Task-local skill for cross-source synthesis (stage 4) and final brief (stage 5).

Loaded by Mastermind via `guidelinePath` (untrusted hints). Stage agent follows the same rules when building context.

## Elaboration rules (required)

Write for **human readers** revisiting the topic in six months — not disposable one-paragraph summaries.

- Use section headings, bullets, and short paragraphs.
- Add wikilinks to related pages: `[[topics/{slug}/overview]]`, `[[topics/{slug}/studies/{study-slug}]]`.
- Merge new synthesis into existing Overview/Brief sections on refresh — do not replace wholesale unless the user chose full refresh.

## Stage 4 — analysis

Produce:

1. **`analysis`** (JSON): `{ themes[], claims[{ claim, sourceUrls[], trustTier }], openQuestions[], confidence, intentAlignment }`
2. **`analysis_md`** (Markdown): narrative synthesis with section headings

Requirements:

- Address `learning_contract.intent`.
- Cite sources by URL from `sources` / `facts`.
- Do not contradict extracted facts.
- If `userProfile` from user-onboarding is present, note relevance to user goals/preferences.
- When `open_questions_qa` is in facts, promote answered questions into `claims[]` as `{ claim, sourceUrls, trustTier }` objects.
- Remaining gaps go in `openQuestions[]`.

Persist via `upsert-knowledge-page`:

- `analysis` + `analysis_md` — narrative to `overview`/`facts`; structured JSON to `raw/analysis`
- `key_facts_md` — narrative bullets on `facts` page
- `facts` — narrative fallback on `facts`; `TFacts` JSON to `raw/facts`

## Stage 5 — final brief

Produce elaborated Markdown for **`brief`** (wiki page):

### summaryMd

Executive summary of the topic:

- What the subject is
- Key findings (bullets with wikilinks)
- Source quality note
- Open questions / gaps

### personalizedBriefMd

Same substance reframed for **this user** using onboarding profile when available.

## Persist

```json
{
  "summaryMd": "...",
  "personalizedBriefMd": "...",
  "completed_at": "ISO8601"
}
```

Upsert key `summary` → wiki page `brief`.

## Session result

```json
{
  "knowledgeTopic": "slug",
  "knowledgePaths": ["topics/slug/overview", "..."],
  "summaryMd": "...",
  "personalizedBriefMd": "..."
}
```

List wiki page paths persisted this run.
