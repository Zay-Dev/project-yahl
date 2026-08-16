# submit-knowledge-observation

Agent-facing write for general observations and verified success notes. Concrete tool failures go through `resolve-errors-with-knowledge`, which submits the failure before lookup. Do **not** call `upsert-knowledge-page` or `dedup-knowledge`.

When to submit → `~/task-skills/worth-persisting-knowledge/SKILL.md`.

## Contract

- Required: `cue`, `claim`, `evidence`, and **`example` or `quote`**
- `topic_hint` (or `topic`) is **optional soft hint** — omit or use a content-based slug; never force the task `knowledge_topic` for cross-cutting lessons. Wrong hint is OK; Knowledge Manager assigns the final topic
- `evidence` must be a **JSON object**, never prose (e.g. `{ "type": "tool_observation", "tool": "browser" }`)
- Do **not** pass free-text `observation` — that key is only for a nested observation object
- Optional: `confidence` (`observed` | `quoted` | `inferred`, default `observed`), `tags`
- PLACE notes: put `claimed_place` and `bound_poi` inside `evidence`
- Never pass `mode`, `section`, or a full wiki `##` body — Knowledge Manager decides apply shape **and** final topic
- `inferred` observations will not be promoted to HOWTO/facts by the manager without further evidence

## Examples (observation payloads after a lesson)

These JSON blocks show **how to shape a submit** after you learned something. They are **not** live tool/platform argument schemas — do not call tools by copying field lists from here.

### Failure observation (sole fail)

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "topic_hint": "browser-forms",
    "cue": "browser form-fill returned ok:false after Submit",
    "claim": "agent-mode fill reported ok:false even though fields appeared applied on the page",
    "example": "poll#3: Submit clicked; tool ok:false; page still showed filled fields",
    "evidence": {
      "type": "tool_observation",
      "tool": "browser",
      "at": "2026-08-03T12:00:00Z",
      "ok": false
    },
    "confidence": "observed",
    "tags": ["HOWTO"]
  }
}
```

### Separate success observation (after a prior failure)

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "topic_hint": "browser-forms",
    "cue": "independent extract after ok:false Submit",
    "claim": "when form-fill returns ok:false after Submit, read the result table with a separate extract instead of treating the page as failed",
    "example": "same poll#3: independent extract still read result rows after ok:false",
    "evidence": {
      "type": "tool_observation",
      "tool": "browser",
      "at": "2026-08-03T12:01:00Z",
      "ok": true
    },
    "confidence": "observed",
    "tags": ["HOWTO", "TRICK"]
  }
}
```

## Bad examples (rejected or not promoable)

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "cue": "threshold rule",
    "claim": "always use 120% threshold",
    "evidence": { "type": "guess" }
  }
}
```

Missing `example`/`quote` → rejected.

PLACE without `claimed_place` / `bound_poi` is accepted but overnight manager marks `needsValidation` and may research before ApplyPlan.

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "cue": "maybe SPA bug",
    "claim": "spinner forever means site is down forever",
    "example": "I assume this based on one miss",
    "evidence": { "type": "speculation" },
    "confidence": "inferred"
  }
}
```

Accepted as observation, but manager must not merge into HOWTO — only `todo` / pending Q&A.

## Result

`{ ok: true, path: "topics/…/raw/observations/YYYY-MM-DD/id", observationId, topic }`

`topic` is the soft landing slug (`topic_hint` or `inbox`). Final durable topic is Knowledge Manager–owned.
