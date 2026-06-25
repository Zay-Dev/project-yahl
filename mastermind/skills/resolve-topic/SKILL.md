---
name: resolve-topic
description: Resolve a learning topic slug to the canonical knowledges folder — Mastermind picks the path.
---

# resolve-topic

Use `/mastermind(resolve-topic, topicText: …, slug: …, seedUrls: …)` before the first `persist-knowledge` in a knowledge capture run.

Mastermind scans `data/mastermind/knowledges/` and the topic registry internally. **Do not pass `path`.**

## Tool

```json
{
  "skill": "resolve-topic",
  "args": {
    "topicText": "the project yahl (develop branch)",
    "slug": "project-yahl-develop-branch",
    "seedUrls": ["https://github.com/Zay-Dev/project-yahl"]
  }
}
```

Returns `{ canonical, matchedBy, aliases?, suggestMerge? }`. Always set `knowledge_topic` to `canonical`.
