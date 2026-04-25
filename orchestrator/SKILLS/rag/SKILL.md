---
name: rag
description: USE FOR file-based RAG extraction on saved content. Trigger when content is too large to process in one pass and you need chunked extraction with stage writeback. Returns extracted result into stage context via context_key.
---

# RAG

Use this skill when you already have content saved to a local temp file and need structured extraction from large text.

Prefer this over manual chunk loops in stage logic.

## When To Use

- Large HTML/text files saved from browse/curl.
- A single `*extract` call would be too big for one pass.
- You need the orchestrator to chunk-read and aggregate extraction.

## Input Requirements

Prepare these values before calling `rag`:

- `lookingFor`: Non-empty extraction target description.
- `chunkSize`: Positive number, chunk size in bytes.
- `tmp_file_path`: Non-empty readable file path.
- `byteLength`: Positive file length in bytes.
- `context_key`: Non-empty stage key for writeback.

## Tool Call Envelope

Final `content` can be a single JSON object:

```json
{
  "type": "tool_call",
  "tool": "rag",
  "arguments": {
    "lookingFor": "news items with title, date, url",
    "chunkSize": 128000,
    "tmp_file_path": "~/tmp/abc123",
    "byteLength": 392100,
    "context_key": "website"
  }
}
```

Field names are strict. Keep exact casing and spelling, including `chunkSize`.

## What Happens After Call

1. Orchestrator validates the envelope and arguments.
2. Orchestrator computes chunk count with `ceil(byteLength / chunkSize)`.
3. It runs an internal ai.logic loop:
   - read chunk by byte range from `tmp_file_path`
   - run `*extract(looking_for, chunk_data)`
   - append each extraction into `result`
4. Orchestrator writes aggregated `result` into stage context at `context_key`.
5. The same stage is executed again with updated stage context.

## What To Expect

- `stage[context_key]` becomes available in the next run of the same stage.
- The value comes from aggregated extraction result.
- This call does not directly persist to global context.

If you also need cross-stage persistence, call `set_context` separately.

## Guardrails

- Do not emit `rag` with empty strings or non-positive numbers.
- Do not use `rag` when no temp file exists yet.
- Do not rename argument keys.

## Typical Flow

1. Save webpage/content to temp file.
2. Get file byte length.
3. Emit `rag` tool-call envelope.
4. Continue stage logic using `stage[context_key]` on rerun.
