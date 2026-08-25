# stack-channel

Merge a pending WhatsApp inbox window into wiki pages.

## Before writing

1. Call `/nixery(get-whatsapp-page, …)` for `overview` and `facts` (facts may be absent).
2. Read those markdown artifacts plus the inbox window markdown.
3. Scan the inbox markdown for attachment markers:
   - `kind=image` with a `path=~/…`: call `/nixery(image-to-text, source: path, background: "WhatsApp inbox for channel {folder}; stacking into wiki", userPrompt: caption or "Describe and extract text for wiki stacking")`. Fold `data.text` into the window context.
   - Other kinds (document, audio, video, unknown): note filename/mime as present but unparsed — do not invent content.
4. Do **not** fetch prior digests for the merge.

## overview

Living cumulative summary — merge new durable signals into the existing page, then upsert with `mode: replace`. Never rewrite from the current window alone. Never claim “first ever” / “no prior context” when existing overview or facts are present.

Keep concise (~4–6k chars soft budget). If the existing overview is already large, compress while merging (drop stale open questions, collapse one-offs into topics) rather than appending forever.

Include: identity, participants, recurring topics, durable facts, open questions. **Not** a message log — window detail goes to the digest. Image-derived facts belong here only when durable; otherwise keep them in the digest.

### Platform agent (required)

- Read existing `facts` / overview for **Platform agent** identity (assistant name, agent chatId / lid).
- Inbox markdown may label senders as `{assistantName} (platform)` or mark `fromMe`.
- Those messages are the **YAHL platform assistant** (outbound from the logged-in WhatsApp session) — never invent a third-party “Traffic bot” or similar from content style.
- Preserve a Participants row for the platform agent; map matching LIDs / chatIds to that name.

## digests/{yyyy-mm-dd-HH}

One digest per stack run window: bullet summary of new messages, notable quotes (short), image-to-text summaries, unparsed attachment notes, and new facts. Use the current time in Asia/Hong_Kong for the page segment when possible. Label platform outbound as the assistant name from facts, not as a separate bot. Digests are the unbounded archive; overview stays bounded.
