---
name: google-maps-directions
description: >
  Budget fallback for live private-car multi-route driving ETAs via Google Maps
  directions. Not the preferred city-local traffic source — use when explore
  research hits turn or wall-clock budget.
---

# google-maps-directions — Google Maps driving ETAs (fallback)

**Role:** global budget fallback for live private-car multi-route travel times. Prefer a city-local live map or transport-department source when one works. This skill does **not** block persisting howto / prevent notes into knowledge (`source-ops-*`) when used.

Use the `browser` tool via `/stagehand(...)` — do not curl the Maps SPA.

## Template URL

```text
https://www.google.com/maps/dir/{origin}/{destination}/
```

Always keep `{origin}` / `{destination}` placeholders in saved `traffic_source.url`. Never persist a concrete prior A→B pair.

## Bind OD (mandatory)

Before every `goto`, bind context origin/destination with **deterministic** encoding — never hand-type percent-escapes:

```bash
node -e 'const o=process.argv[1],d=process.argv[2],t=process.argv[3]; console.log(t.replaceAll("{origin}",encodeURIComponent(o)).replaceAll("{destination}",encodeURIComponent(d)))' -- "$ORIGIN" "$DESTINATION" "$TEMPLATE"
```

Prefer English place names in the URL when non-Latin geocoding is ambiguous; keep local-script names for labels / day-page text.

Use the short canonical directions URL only — never paste SPA `data=!…` address-bar URLs into `goto`.

## Fetch howto

1. `/stagehand(goto, <bound_url>)`.
2. Confirm driving / private-car mode (not transit / walking / cycling).
3. Check origin/destination chips (or equivalent). If they do **not** match context OD (or the English equivalents you encoded), treat as fetch failure — do not thrash encodings.
4. Capture up to **3** fastest routes: iconic `label` / optional `via`, integer `eta_min`, optional `distance_km`, `status`.
5. Capture short `incident_note` when the UI shows crash / closure / major disruption (`''` if none).
6. At most **2** browser attempts (initial + one retry). Do not invent ETAs.

## YAHL mapping

| YAHL | Meaning |
|------|---------|
| `/google-maps-directions(origin, destination)` | Build placeholder source + bind OD + fetch routes per this skill |
| `*fetch_driving_routes(..., source: google_maps_fallback)` | Same fetch path when explore stage applies this skill |

Produce / normalize:

```text
url: https://www.google.com/maps/dir/{origin}/{destination}/
kind: browser
howto_md: inline core steps from this skill (stable re-fetch only)
is_fallback: true
```

## Prevent (do not)

- Hand-typed percent-encoding or LLM-invented escape sequences
- SPA `data=!…` / sessionful address-bar URLs in `goto`
- Reusing a concrete prior A→B Maps URL from knowledge
- More than 2 browser attempts per poll/probe
- Opening alternate tabs (runtime has a single page)
- Inventing route ETAs on blank page / timeout / OD mismatch
- Treating this fallback as a permanent recommended city source (`is_fallback` stays true so the next run keeps researching)

## Knowledge persistence

When this skill is used, still upsert **novel** ops notes (howto tricks and prevent items learned for this city/OD) to `source-ops-{city_slug}`. `is_fallback` only means “keep researching next run”; it must **not** suppress Maps learning writes.
