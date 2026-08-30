# route-analysis

## Place bind

Prefer `origin_resolved` / `destination_resolved` for browser bind. Reject autocomplete that changes district/landmark. Estate ≠ nearby transit hub unless PLACE has `verified_proxy`. Notify/day-page titles use `origin_display` / `destination_display` when set.

## Abnormal

Match routes by `label` / `via`. Abnormal when ETA **> 120%** of prior, new incident, incident cleared, or primary worse than same-day baseline.

## Day page shape

```markdown
## HH:MM {tz_label}

- Origin: …
- Destination: …
- <label>: N min — status
  - Path: A → B → C
- Recommended: …
```

Origin line before Destination — never swap. Pass display labels into format helpers. Times use `timezone` wall clock.
