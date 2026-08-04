# submit-knowledge-observation

Agent-facing **only** knowledge write. Submit an atomic observation note. Do **not** call `upsert-knowledge-page`, `dedup-knowledge`, `tidy-knowledge`, or `knowledge-qa-review`.

## Contract

- Required: `topic_hint` (or `topic`), `cue`, `claim`, `evidence`, and **`example` or `quote`**
- Optional: `confidence` (`observed` | `quoted` | `inferred`, default `observed`), `tags`
- Never pass `mode`, `section`, or a full wiki `##` body — Knowledge Manager decides apply shape
- `inferred` observations will not be promoted to HOWTO/facts by the manager without further evidence

## Good example

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "topic_hint": "traffic-monitor",
    "cue": "HKeMobility form-fill ok:false after Search click",
    "claim": "agent-mode fill may report ok:false after From/To/Search already applied; read the result table with a separate extract",
    "example": "poll#3: POI clicks and Search succeeded on page; tool returned Thinking mode does not support this tool_choice; independent extract still read corridor ETA rows",
    "evidence": {
      "type": "tool_observation",
      "tool": "browser",
      "at": "2026-08-03T12:00:00Z"
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
    "topic_hint": "traffic-monitor",
    "cue": "ETA rule",
    "claim": "always use 120% threshold",
    "evidence": { "type": "guess" }
  }
}
```

Missing `example`/`quote` → rejected.

```json
{
  "defId": "submit-knowledge-observation",
  "args": {
    "topic_hint": "traffic-monitor",
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
