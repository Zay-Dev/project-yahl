# plan-study

Build `study_plan` from `learning_contract`, `corpus_assessment`, and mission.

## Mastermind `plan` output shape

```json
{
  "researchQuestions": ["..."],
  "successCriteria": ["..."],
  "exclusions": ["..."],
  "sources": [
    {
      "url": "https://example.com/docs",
      "title": "Example docs",
      "priority": "required",
      "rounds": 2,
      "rationale": "Primary seed URL from learning_contract"
    }
  ],
  "reuseExisting": ["study_github_readme_develop"],
  "audience": "optional"
}
```

## Rules

1. Include every `learning_contract.seedUrls` entry as `priority: required`.
2. Set `rounds` from depth: `overview` → 1–2, `deep_dive` → 2–3 (max 3 per YAHL loop cap).
3. Add discovered URLs only when `corpus_assessment.gaps` warrant and depth is `deep_dive`.
4. List `reuseExisting` when `corpus_assessment.sufficientFor` includes a `study_*` key with valid `studyMd`.
5. Fold scope into this plan — `researchQuestions`, `successCriteria`, `exclusions` replace a separate scope stage.
6. Reference `today` when noting recency; no project-specific path checklists.

## After plan

- Parse plan into `study_plan` context key.
- Persist with `upsert-knowledge-page` key `study_plan`.
- Append persist `{ path }` to `knowledge_paths.persisted`.
