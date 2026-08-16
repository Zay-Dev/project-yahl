# resolve-errors-with-knowledge

Use this flow for every concrete tool error: `ok:false`, rejected arguments, parse failure, empty extraction despite visible data, bind miss, or an equivalent evidenced failure.

## First action

Before further debugging, call the atomic resolver once for the same error signature in this stage:

```text
/nixery(resolve-error-with-knowledge,
  tool: …,
  cue: …,
  claim: …,
  example: … | quote: …,
  evidence: { … },
  confidence: observed,
  tags?: […],
  topic_hint?: …)
```

Use the actual tool result in `evidence`. `topic_hint` is optional and soft. The resolver persists the failure observation first, then searches read-only knowledge. Do not separately submit the same failure.

If the inline call returns `ok:false`, correct invalid arguments or retry a transient failure within the nixery retry budget. Do not continue to lookup until persistence succeeds.

## Result handling

- `status: "found"`: inspect `solution` and every `{ path, excerpt }` citation, apply the suggested path, and verify it against the current failure.
- `status: "not_found"`: investigate and verify a solution yourself.
- `status: "unavailable"`: the failure is already recorded, but lookup infrastructure failed; investigate as for `not_found`.

For `not_found` and `unavailable`, do not submit the failure again. For `found`, never treat the suggestion as proven until the current run verifies it.

If any path succeeds, immediately submit a second, separate HOWTO/TRICK observation through `submit-knowledge-observation`. Include the working arguments or workaround and successful evidence. Never merge the failure and success into one note.

Do not recursively invoke the resolver for an error caused by the resolver itself. Follow inline nixery soft-fail handling instead.
