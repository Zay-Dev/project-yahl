# nixery-get-knowledge

Shared contract for reading knowledge via orchestrator-direct `nixeryRun: get-knowledge` stages.

## When to use

- **Preferred:** `nixeryRun: get-knowledge` in YAHL — orchestrator starts an in-container agent; no mastermind round-trip.
- **Legacy (deprecated):** `/mastermind(get-knowledge, topic:, need:)` — do not add new usages.

## Stage shape

```yaml
- nixeryRun: get-knowledge
  nixeryInput:
    purpose: Natural-language extract intent (replaces mastermind `need:`)
    topic: knowledge_topic
    output: workflow.json
  contextKeys: [knowledge_topic]
  logic: "(nixery)"
```

- `purpose` — what to load and why; tailor in prose, not key lists.
- `topic` — optional wiki slug; literal or context key name.
- `output` — optional filename hint for the primary artifact under `~/nixery/get-knowledge/`.

## Output location

Session workflow dir: `~/nixery/get-knowledge/` (maps to `data/workspace/sessions/{id}/nixery/get-knowledge/`).

The in-container agent explores `/data/knowledge_export` with `ls`, `cat`, `grep`, `echo` and writes under `/workspace/`. Multiple `nixeryRun` stages in one session share this dir — use distinct `output` hints per stage.

## Read pattern

```javascript
const extractPath = '~/nixery/get-knowledge/workflow.json';
const extractFile = (*read(extractPath));
const extractRef = { absent: extractFile.absent ?? !extractFile.extracted, path: extractPath };
const extracted = extractRef.absent ? '<none>' : extractFile.extracted;
```

Recommended primary JSON envelope (agent-written):

```json
{
  "absent": false,
  "extracted": "...",
  "extractedAt": "2026-07-12T00:00:00.000Z"
}
```

The agent may write supporting files (notes, markdown) alongside the primary artifact.

## Mastermind `need` → nixery `purpose` (examples)

| Former `need` | Suggested `output` | `purpose` sketch |
|---------------|-------------------|------------------|
| all keys / corpus intake | `intake.json` / `corpus.json` | Summarize topic corpus for gap assessment and intake |
| todo | `todo.json` | Load todo list and pending expand_questions items |
| open_questions_qa | `open-questions.json` | Load open_questions_qa items |
| facts, study keys | `facts.json` | Facts, key_facts_md, and study_* content |
| analysis | `synthesis.json` | analysis and analysis_md |
| user-onboarding profile | `profile.json` | communication_style, preferences, goals, identity |
| summary bundle | `summary.json` | Summary corpus for final brief |

Prefer fewer, broader `purpose` values when one extract serves multiple downstream stages.
