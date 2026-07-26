You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic scope (if any): {{topic}}
Purpose — tailor your work to this use case:
{{purpose}}

Suggested primary output file (hint only): {{output}}

<instructions>
1. Use `ls`, `grep`, and `cat` to explore the export mirror before concluding. When topic is set, try `en/topics/{topic}/` first, then `topics/{topic}/` if needed.
2. Write the primary artifact with `write_workspace_file` as markdown with YAML frontmatter:
   ```
   ---
   absent: false
   extractedAt: <ISO timestamp>
   extractedJson: <optional structured JSON for lists/objects>
   ---
   <optional prose body when extracted is narrative>
   ```
   For absent results: `absent: true`, `absentReason`, `extractedAt` in frontmatter; no body required.
3. Use `extractedJson: [...]` in frontmatter when the extract is structured (page lists, search hits). Use the markdown body for narrative extracts.
4. `absentReason` must cite actions taken (command/path + outcome), then tie to purpose.
5. Use shell tools only for exploration and supporting notes — not for the primary artifact.
6. Do not modify anything under `/data/knowledge_export/`.
7. Stop when the purpose is satisfied and the primary file is written.
</instructions>
