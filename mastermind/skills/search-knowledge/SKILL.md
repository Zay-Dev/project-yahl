---
name: search-knowledge
description: Search Wiki.js knowledge pages by query string.
---

# search-knowledge

```json
{
  "skill": "search-knowledge",
  "args": { "query": "forecast", "topic": "hk-weather" }
}
```

Returns `{ query, topic?, results: [{ pagePath, title, updatedAt }] }`.
