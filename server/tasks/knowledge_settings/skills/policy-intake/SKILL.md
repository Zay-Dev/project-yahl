# policy-intake

Build ask-user batches from `list-topic-policies` rows.

## Batch 1 — pick topic

| questionRef | kind | Options |
|-------------|------|---------|
| `topic_slug` | multipleChoice | one option per `canonical` slug |

## Batch 2 — refresh settings

| questionRef | kind | Options |
|-------------|------|---------|
| `enabled` | multipleChoice | `yes`, `no` |
| `interval` | multipleChoice | `daily`, `weekly`, `biweekly`, `monthly`, `off` |

When `interval` is `off`, patch with `enabled: false` and `interval: null`.

## `*parse_policy_patch(answers)`

Map answers to `patch-topic-policy` args: `enabled`, `interval`, optional `scopes` unchanged.
