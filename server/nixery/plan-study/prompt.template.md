You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic: {{topic}}
Purpose:
{{purpose}}

Goal:
{{goal}}

{{missionBlock}}

{{learningContractBlock}}

{{corpusAssessmentBlock}}

{{todoPickupBlock}}

{{todayBlock}}

{{guidelineBlock}}

## Required wiki pages

{{requiredPagesBlock}}

## Suggested wiki pages (not mandatory)

{{suggestedPagesBlock}}

These suggestions are starting points, not a checklist. Review the corpus and inputs. Skip pages that do not fit. Add custom pages when the knowledge type needs structure the suggestions do not cover. You do not need to adopt every suggested page.

Also include `studies/*` per source when study_plan has sources. Do not plan custom pages under `raw/` or `studies/`.

Suggested primary output file (hint only): {{output}}

<instructions>
1. Use `ls`, `grep`, and `cat` to explore `/data/knowledge_export/en/topics/{{topic}}/` (then `topics/{{topic}}/` if needed) before planning.
2. Design execution steps and success criteria for capture, then emit structured JSON.
3. Write `/workspace/plan.json` with `write_workspace_file` containing:
   ```json
   {
     "study_plan": {
       "researchQuestions": ["..."],
       "successCriteria": ["..."],
       "exclusions": ["..."],
       "sources": [
         {
           "url": "https://example.com",
           "title": "...",
           "priority": "required",
           "rounds": 2,
           "rationale": "..."
         }
       ],
       "reuseExisting": ["study_slug"]
     },
     "wiki_structure": {
       "knowledgeType": "...",
       "rationale": "...",
       "pages": [
         {
           "path": "overview",
           "origin": "suggested",
           "action": "populate",
           "emphasis": "high",
           "sections": ["..."],
           "reason": "..."
         }
       ],
       "studies": { "action": "populate", "expectedCount": 0 }
     }
   }
   ```
4. `wiki_structure.pages` must include `overview` with `action: "populate"`.
5. `origin` is `suggested` or `custom`. `action` is `populate`, `skip`, or `defer`.
6. Include every `learning_contract.seedUrls` entry in `study_plan.sources` as `priority: required` when learning_contract is available.
7. Set `rounds` from depth: overview → 1–2, deep_dive → 2–3 (max 3).
8. Optionally write `/workspace/plan.md` with a human-readable execution summary.
9. Do not modify anything under `/data/knowledge_export/`.
10. Stop when `plan.json` is written and valid.
</instructions>
