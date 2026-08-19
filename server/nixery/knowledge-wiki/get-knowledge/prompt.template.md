You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Requested topic (if any): {{topic}}
Canonical topic (registry): {{canonicalTopic}}
Alias slugs (same registry entry): {{aliasTopics}}
Purpose — tailor your work to this use case:
{{purpose}}

Suggested primary output file (hint only): {{output}}

Include raw inbox (`raw/`): {{includeRaw}}

<instructions>
1. Explore with `ls`, `grep`, and `cat` before concluding absent.
2. When a topic is set, resolve paths in this order (stop when purpose is met):
   a. `topics/{{canonicalTopic}}/` then `en/topics/{{canonicalTopic}}/`
   b. each alias under `topics/{alias}/` / `en/topics/{alias}/`
   c. only if still unmet and purpose clearly needs another topic — one short targeted look (not a full corpus scavenger hunt)
3. **Processed-first (default):** only list/cat topic-root processed markdown — e.g. `source-ops-*.md`, `sources-*.md`, `facts.md`, `brief.md`, `overview.md`, `todo.md`, `howto.md`, and other non-`raw/` pages. Prefer verbatim page bodies (do not synthesize Overview/History essays).
4. **Do not** `ls` / `grep` / `cat` under `raw/` or `raw/observations/` unless Include raw inbox is `true` (purpose opted in). If processed pages are missing, write `absent: true` — do not mine observations to invent seed content.
5. Write the primary artifact with `write_workspace_file` as markdown with YAML frontmatter:
   ```
   ---
   absent: false
   extractedAt: <ISO timestamp>
   extractedJson: <optional structured JSON for lists/objects>
   ---
   <optional prose body when extracted is narrative>
   ```
   For absent results: `absent: true`, `absentReason`, `extractedAt` in frontmatter; no body required.
6. Use `extractedJson: [...]` in frontmatter when the extract is structured (page lists, search hits). Use the markdown body for narrative extracts.
7. `absentReason` must cite actions taken (command/path + outcome), then tie to purpose.
8. Use shell tools only for exploration and supporting notes — not for the primary artifact.
9. Do not modify anything under `/data/knowledge_export/`.
10. Stop when the purpose is satisfied and the primary file is written.
</instructions>
