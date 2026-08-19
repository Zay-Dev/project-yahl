---
name: analyze-additional-instruction
description: Parse optional runInput.additional_instruction for YAHL tasks
---

# analyze-additional-instruction

Parse optional `runInput.additional_instruction` (this-run free-text override). Durable task config stays elsewhere — this key never writes the durable Knowledge Manager instruction file.

## Output — `instruction_followup`

Always set via `set_context` as one of:

```typescript
type TInstructionFollowup =
  | {
      actionable: true;
      missionAddon: string;
      seedUrls: string[];
      scopeHints: string[];
      failFast: boolean;
      notes: string;
    }
  | { actionable: false; reason: string };
```

### Non-actionable

Use when `additional_instruction` is missing, empty, or whitespace-only:

```json
{ "actionable": false, "reason": "No additional_instruction provided" }
```

### Actionable

- `missionAddon` — concise operator guidance for later stages.
- `seedUrls` — absolute http(s) URLs from the instruction. Empty array if none.
- `scopeHints` — optional hints (task-defined). Empty when unclear.
- `failFast` — true when instruction says fail fast / abort if a source cannot be accessed.
- `notes` — one short operator-facing summary of what was parsed.

## Do not

- Ask the user.
- Invent URLs or scopes not supported by the instruction text.
- Persist this text into durable wiki / KM instruction storage.
