# ask-user

Use this skill when the stage requires user decision before continuing.

## Purpose

- pause execution and ask one clear multiple-choice question
- collect deterministic answer ids for downstream context updates
- avoid guessing when user preference is required

## Stage registry

Stages may declare questions in YAML:

```yaml
askUser:
  - id: 1
    question: Choose pricing scope
logic: |
  scope = /ask-user(1);
```

- `question` is the required tool `title` and UI heading
- `/ask-user(<id>)` must match a registry entry
- server fills `answer` after the user responds

## Required tool

Call `ask_user` with this exact argument shape:

```json
{
  "version": "askUser.v1",
  "kind": "multipleChoice",
  "questionRef": "1",
  "title": "Choose pricing scope",
  "description": "Pick one scope before continuing.",
  "options": [
    { "id": "global", "label": "Global" },
    { "id": "apac", "label": "APAC" }
  ],
  "allowMultiple": false
}
```

## Rules

- always include `version`, `kind`, and `questionRef`
- `title` must exactly match the registered `question` for that ref
- only `kind: "multipleChoice"` is supported
- include at least 2 options
- never use empty `id` or `label`
- ask one question at a time (one registry id per tool call)
- keep title concise and action oriented

## Optional fields

- `description`
- `allowMultiple`
- `minChoices`
- `maxChoices`

## Runtime behavior

- orchestrator persists a checkpoint and stops the agent container
- web UI shows agent options plus a free-text counter-option
- after the user answers, a new orchestrator resumes the same stage
- inline `/ask-user(<id>)` is replaced with the selected answer value
- answer is also stored on `askUser[].answer` and in context as `ask_user_<id>_answer`
- on resume, the agent user prompt includes the ask-user question and answer (preset option or custom free-text)
- on resume, re-execute **full** `stage.logic` from the first line — do not end the stage until every `produceContextKeys` entry is written via `set_context`
- on resume, `context.context["ask_user_<id>_answer"]` is already set; stage logic may use `*answer_of(<id>)` to read it (see YAHL prompt)

## `*answer_of(<id>)`

Pseudo-op for resume-aware logic:

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
- option ids are scalars — resolve to typed objects with `*matches` when needed

## When to use

- choosing scope, strategy, output format, or trade-off preference
- resolving ambiguity that materially changes execution path

## When not to use

- when context already contains clear instruction
- for trivial decisions that can be inferred safely
