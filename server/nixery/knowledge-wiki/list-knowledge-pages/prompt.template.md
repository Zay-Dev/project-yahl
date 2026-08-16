You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic to list: {{topic}}
Suggested primary output file (hint only): {{output}}

<instructions>
1. List pages under the topic namespace. Try `ls /data/knowledge_export/en/topics/{{topic}}/` first, then `ls /data/knowledge_export/topics/{{topic}}/` if needed.
2. Use recursive `ls` / `grep` to discover `.md` files under the topic prefix.
3. Write the primary artifact with `write_workspace_file` as markdown with YAML frontmatter. Put page inventory in `extractedJson: [...]`.
4. When no pages exist, set `absent: true`, `absentReason`, and `extractedAt` in frontmatter.
5. Use shell only for exploration — not for the primary artifact.
6. Do not modify anything under `/data/knowledge_export/`.
7. Stop when the page inventory is written.
</instructions>
