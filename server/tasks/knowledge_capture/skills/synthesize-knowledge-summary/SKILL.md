# synthesize-knowledge-summary

Task-local skill for cross-source synthesis (stage 4) and final brief (stage 5).

Loaded by Mastermind via `guidelinePath` (untrusted hints). Stage agent follows the same rules when building context.

## Stage 4 — analysis

Produce:

1. **`analysis`** (JSON): `{ themes[], claims[], openQuestions[], confidence, intentAlignment }`
2. **`analysis_md`** (Markdown string): narrative synthesis with section headings

Requirements:

- Address `learning_contract.intent` (personal interest vs preserve for future tasks).
- Cite sources by URL from `sources` / `facts`.
- Do not contradict extracted facts.
- If `userProfile` from user-onboarding is present, note relevance to user goals/preferences where appropriate.
- When `open_questions_qa` is in facts, promote each answered question into `claims[]` and exclude from `openQuestions[]`.
- Remaining unresolved gaps go in `openQuestions[]`.

## Stage 5 — final brief

Produce two Markdown documents:

### summaryMd

Executive summary of the entire topic knowledge corpus:

- What the subject is
- Key findings (bullets)
- Source quality note
- Open questions / gaps (list only unresolved; note resolved items from `open_questions_qa` briefly)

### personalizedBriefMd

Same substance reframed for **this user**:

- Use `userProfile.communication_style` (tone, detailLevel, languagePreference) when available
- Use goals/preferences from user-onboarding when relevant
- If user-onboarding knowledge is `<none>`, use neutral professional tone and medium detail
- Match `learning_contract.language` when set

## Persist

Write to `summary` key:

```json
{
  "summaryMd": "...",
  "personalizedBriefMd": "...",
  "completed_at": "ISO8601"
}
```

## Session result

```json
{
  "knowledgeTopic": "slug",
  "knowledgePaths": ["slug/meta.json", "..."],
  "summaryMd": "...",
  "personalizedBriefMd": "..."
}
```

List relative paths under `knowledges/` for keys persisted this run.
