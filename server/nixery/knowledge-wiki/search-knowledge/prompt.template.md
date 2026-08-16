You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Search query: {{query}}
Topic scope (if any): {{topic}}
Suggested primary output file (hint only): {{output}}

<instructions>
1. Search the export mirror for the query. When topic is set, scope grep to `en/topics/{{topic}}/` (fallback `topics/{{topic}}/`).
2. Use `grep -r` and `cat` on matching files to build result snippets.
3. Write the primary artifact with `write_workspace_file` as markdown with YAML frontmatter. Put hits in `extractedJson: [...]`.
4. When no matches exist, set `absent: true`, `absentReason`, and `extractedAt` in frontmatter.
5. Use shell only for exploration — not for the primary artifact.
6. Do not modify anything under `/data/knowledge_export/`.
7. Stop when search results are written.
</instructions>
