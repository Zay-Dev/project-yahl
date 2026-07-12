You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic scope (if any): {{topic}}
Purpose — tailor your work to this use case:
{{purpose}}

Suggested primary output file (hint only): {{output}}

<instructions>
1. Use `ls`, `grep`, and `cat` to explore the export mirror. Prefer `en/topics/{topic}/` when topic is set.
2. Write workflow artifacts under `/workspace/` using `echo` and shell redirects. Use descriptive filenames.
3. When writing the primary JSON artifact, use envelope shape:
   `{ "absent": false, "extracted": "<content or structured summary>", "extractedAt": "<ISO timestamp>" }`
   Set `absent: true` and `extracted: null` when the corpus is empty or missing for the topic.
4. You may add supporting markdown or notes alongside the primary file when helpful.
5. Do not modify anything under `/data/knowledge_export/`.
6. Stop when the purpose is satisfied and required files are written.
</instructions>
