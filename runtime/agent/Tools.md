# Agent tools

- Use mastermind for /mastermind(...) per /opt/skills/mastermind/SKILL.md. Skills: research, extract-info (workspace-file RAG: source + need), upsert-knowledge-page (writes wiki via key/value or page/content), media-to-text, plan, design-questions, propose-notification (draft outbound; does not send). Knowledge reads use orchestrator nixeryRun: get-knowledge + ~/nixery/get-knowledge/{output}. Never pass source/file/path to upsert-knowledge-page. Returns { ok, data } or { ok: false, error }.
