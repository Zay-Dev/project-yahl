# plan-study

Build `study_plan` and `wiki_structure` via orchestrator `nixeryRun: plan-study`, then read `~/nixery/plan-study/plan.json`.

## Nixery stage

```yaml
- nixeryRun: plan-study
  nixeryInput:
    topic: knowledge_topic
    purpose: Build study plan and wiki structure for learning contract
    goal: build study plan and wiki structure for learning_contract
    learning_contract: learning_contract
    corpus_assessment: corpus_assessment
    mission: missionText
    output: plan.json
  logic: "(nixery)"
```

## Output shape (`plan.json`)

```json
{
  "study_plan": {
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
  },
  "wiki_structure": {
    "knowledgeType": "reference_docs",
    "rationale": "...",
    "pages": [
      {
        "path": "overview",
        "origin": "suggested",
        "action": "populate",
        "emphasis": "high"
      },
      {
        "path": "brief",
        "origin": "suggested",
        "action": "skip",
        "reason": "Internal corpus only"
      },
      {
        "path": "endpoint-catalog",
        "origin": "custom",
        "action": "populate",
        "title": "Endpoint catalog"
      }
    ],
    "studies": { "action": "populate", "expectedCount": 2 }
  }
}
```

Suggested wiki pages are starting points — the nixery agent may skip, defer, or add custom pages. `overview` with `action: populate` is required.

## study_plan rules

1. Include every `learning_contract.seedUrls` entry as `priority: required`.
2. Set `rounds` from depth: `overview` → 1–2, `deep_dive` → 2–3 (max 3 per YAHL loop cap).
3. Add discovered URLs only when `corpus_assessment.gaps` warrant and depth is `deep_dive`.
4. List `reuseExisting` when `corpus_assessment.sufficientFor` includes a `study_*` key with valid `studyMd`.
5. Fold scope into this plan — `researchQuestions`, `successCriteria`, `exclusions` replace a separate scope stage.
6. Reference `today` when noting recency; no project-specific path checklists.

## After plan-study

- Read `~/nixery/plan-study/plan.json`; parse `study_plan` and `wiki_structure`.
- Persist with `upsert-knowledge-page` keys `study_plan` and `wiki_structure`.
- Append persist `{ path }` entries to `knowledge_paths.persisted`.
- Downstream stages honor `wiki_structure.pages` where `action: populate`.
