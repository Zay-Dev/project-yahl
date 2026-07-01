# ask-user

Use this skill when the stage requires user input before continuing.

## Purpose

- pause execution and collect one or more answers in a single batch
- support free text, radio multiple-choice, and checkbox multiple-choice
- store deterministic answer values for downstream context updates

## Required tool

Always call `ask_user` with **`askUserBatch.v1`** — even for a single question:

```json
{
  "version": "askUserBatch.v1",
  "batchId": "stage1_round1",
  "title": "Tell us about yourself",
  "description": "Answer all questions below",
  "questions": [
    {
      "questionRef": "preferred_name",
      "kind": "text",
      "title": "What should we call you?"
    },
    {
      "questionRef": "timezone",
      "kind": "multipleChoice",
      "allowMultiple": false,
      "title": "Your timezone",
      "options": [
        { "id": "hkt", "label": "Hong Kong (HKT)" },
        { "id": "utc", "label": "UTC" }
      ]
    },
    {
      "questionRef": "languages",
      "kind": "multipleChoice",
      "allowMultiple": true,
      "minChoices": 1,
      "title": "Languages you use",
      "options": [
        { "id": "en", "label": "English" },
        { "id": "zh", "label": "Chinese" }
      ]
    }
  ]
}
```

## Input modes

| Mode | Tool shape | Answer storage |
|------|------------|----------------|
| Free text | `kind: "text"` | `ask_user_<ref>_answer` = string |
| Radio MC | `kind: "multipleChoice"`, `allowMultiple: false` | one option id **or** free text |
| Checkbox MC | `kind: "multipleChoice"`, `allowMultiple: true` | `optionIds[]` **or** free text |

Multiple-choice questions always include a free-text counter-option in the web UI. Preset selections and free text are mutually exclusive.

## Rules

- always include `version`, `batchId`, `title`, and non-empty `questions`
- each `questionRef` must be unique within the batch
- do not re-ask a ref that already has an answer on the stage
- group independent questions in one batch; dependent questions go in a later round
- `multipleChoice` requires at least 2 options
- never use empty `id` or `label`

## Runtime behavior

- orchestrator upserts question refs onto `stage.askUser[]` at checkpoint time
- one checkpoint per batch — agent shuts down until all answers are submitted
- web UI shows a scrollable drawer; submit is disabled until every question is answered
- answers are stored as `ask_user_<ref>_answer` in context and on `askUser[].answer`
- on resume, re-execute **full** `stage.logic` from the first line
- on resume, do not call `ask_user` again for answered refs

## `*answer_of(<id>)`

```yahl
const prior = *answer_of(hk_region);
IF: prior;
  const choice = prior;
ELSE;
  const choice = /ask-user(hk_region);
END:
```

- reads `ask_user_<id>_answer` from Input `context.context`
- empty on first pass; populated after the user answers
- checkbox answers are `string[]`; radio preset ids are scalars

## When to use

- collecting user preferences, scope, or profile data
- resolving ambiguity that materially changes execution path

## When not to use

- when context or knowledge already contains clear instruction
- for trivial decisions that can be inferred safely
