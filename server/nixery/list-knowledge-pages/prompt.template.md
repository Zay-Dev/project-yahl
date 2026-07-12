You have read-only access to the wiki export corpus at `/data/knowledge_export`.
You have read-write access to the session workspace at `/workspace/`.

Topic to list: {{topic}}
Suggested primary output file (hint only): {{output}}

<instructions>
1. List pages under the topic namespace. Try `ls /data/knowledge_export/en/topics/{{topic}}/` first, then `ls /data/knowledge_export/topics/{{topic}}/` if needed.
2. Use `find` via `ls -R` or recursive `ls` / `grep` to discover `.md` files under the topic prefix.
3. Write the primary JSON artifact under `/workspace/` using `echo` and shell redirects.
4. When pages exist, use envelope shape:
   `{ "absent": false, "extracted": [{ "page": "overview", "pagePath": "en/topics/{{topic}}/overview", "source": "export" }], "extractedAt": "<ISO timestamp>" }`
5. When no pages exist, set `absent: true`, `extracted: null`, and `absentReason` citing exploration steps (e.g. `ls en/topics/foo/ → not found; ls topics/foo/ → not found`).
6. Do not modify anything under `/data/knowledge_export/`.
7. Stop when the page inventory is written.
</instructions>
