# analyze-additional-instruction

Parse optional `runInput.additional_instruction` after `get-knowledge` intake.

## When

Immediately after `nixeryRun: get-knowledge` on `knowledge_refresh`. Corpus extract at `~/nixery/get-knowledge/intake.md` may inform scopeHints (prefer scopes the corpus already has).

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

Do not invent work from the corpus alone.

### Actionable

- `missionAddon` — concise operator guidance for later stages (what to refresh and why). Include fail-fast wording when the instruction asks to abort if sources are unreachable.
- `seedUrls` — absolute http(s) URLs extracted from the instruction (discussion links, docs). Empty array if none.
- `scopeHints` — subset of `studies` | `facts` | `synthesis` | `summary` implied by the instruction (`all` / `full` / `everything` → all four). Empty when unclear.
- `failFast` — true when instruction says fail fast / abort if a source cannot be accessed.
- `notes` — one short operator-facing summary of what was parsed.

## Do not

- Rewrite `rerun_intent` here (later stage merges hints).
- Ask the user.
- Invent URLs or scopes not supported by the instruction text.
