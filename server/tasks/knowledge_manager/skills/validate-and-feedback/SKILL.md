# validate-and-feedback

Per-topic research validation before ApplyPlan. Follow [knowledge-learning-model](../../../../../docs/knowledge-learning-model.md).

## When to research

Run `research` when intake `needsValidation` is non-empty.

Light topics with empty inbox and no validation flags → skip research; the topic loop also skips `apply-manager-topic` when light + empty (see task-mission).

Build the research `need` from the doubtful cues/claims. Optionally sketch steps in reasoning before calling research — there is no separate plan nixery in this loop.

## Research need

Scope one claim at a time. Example: `Where is Maple Court relative to River Station? Prefer official map / registry sources. Do not invent.`

## Names from sources

Prefer official names exactly as cited. Do **not** invent alternate spellings or characters for the same entity.

## Feedback observation contract

After research, submit via `/nixery(submit-knowledge-observation, …)` into the **same topic**:

| Field | Rule |
|-------|------|
| `confidence` | `quoted` when citing a concrete source URL/title/snippet; `inferred` when only model synthesis (→ todo, not PLACE/HOWTO) |
| `tags` | Include `PLACE` for location/entity identity; never invent HOWTO from weak geography research |
| `evidence` | `{ kind: 'manager_validation', tool: 'research', sources: [...], at: ISO }` |
| `example` or `quote` | Required — paste the supporting line from research |

Do **not** call `upsert-knowledge-page` / `dedup-knowledge` / `replace_section` here. ApplyPlan in `apply-manager-topic` decides merge / replace_section / discard / todo.

## Conflicting entity bindings

When research shows two entities were incorrectly equated:

- Claim: correct identity + counterexample (`A ≠ B`)
- Tag: `PLACE` when location/entity identity
- Confidence: `quoted` if sourced
- ApplyPlan should merge counterexample / replace bad binding — not keep both as equal facts
