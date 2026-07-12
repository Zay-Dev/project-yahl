You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic scope (if any): {{topic}}
Purpose — tailor your work to this use case:
{{purpose}}

Suggested primary output file (hint only): {{output}}

<instructions>
1. Use `ls`, `grep`, and `cat` to explore the export mirror before concluding. When topic is set, try `en/topics/{topic}/` first, then `topics/{topic}/` if needed.
2. Write workflow artifacts under `/workspace/` using `echo` and shell redirects. Use descriptive filenames.
3. When writing the primary JSON artifact, use envelope shape:
   `{ "absent": false, "extracted": "<content or structured summary>", "extractedAt": "<ISO timestamp>" }`
   Set `absent: true`, `extracted: null`, and `absentReason` only after exploration — never skip ls/grep/cat.
4. `absentReason` must cite actions taken (command/path + outcome), then tie to purpose:
   - Good: `ls en/topics/hk-weather/ → 3 files; grep -r preferred_hk_weather_region en/topics/hk-weather/ → no matches; no stored region preference for purpose`
   - Bad: `topic not found` (no actions cited)
5. You may add supporting markdown or notes alongside the primary file when helpful.
6. Do not modify anything under `/data/knowledge_export/`.
7. Stop when the purpose is satisfied and required files are written.
</instructions>
