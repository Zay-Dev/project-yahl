# ask-user

Use this skill when the stage requires user decision before continuing.

## Purpose

- pause execution and ask one clear multiple-choice question
- collect deterministic answer ids for downstream context updates
- avoid guessing when user preference is required

## Required tool

Call `ask_user` with this exact argument shape:

```json
{
  "version": "askUser.v1",
  "kind": "multipleChoice",
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

- always include `version` and `kind`
- only `kind: "multipleChoice"` is supported
- include at least 2 options
- never use empty `id` or `label`
- ask one question at a time
- keep title concise and action oriented

## Optional fields

- `description`
- `allowMultiple`
- `minChoices`
- `maxChoices`

## Invalid examples

- missing `version`
- options length `< 2`
- blank option id/label
- non-multiple-choice kinds

## When to use

- choosing scope, strategy, output format, or trade-off preference
- resolving ambiguity that materially changes execution path

## When not to use

- when context already contains clear instruction
- for trivial decisions that can be inferred safely
