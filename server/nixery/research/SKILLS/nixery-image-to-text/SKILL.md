# nixery-image-to-text

Vision image-to-text via `/nixery(image-to-text, source: ~/path, background: …, userPrompt?: …)`.

Uses DeepSeek vision (`deepseek-v4-flash-vision-exp`). Supports JPEG, PNG, GIF, WebP.

## Tool call

```json
{
  "defId": "image-to-text",
  "args": {
    "source": "~/inbox-attachments/channel/msg/photo.jpg",
    "background": "WhatsApp inbox for channel acme; stacking into wiki",
    "userPrompt": "Focus on error text in the screenshot"
  }
}
```

- `source` — session path to the image (`~/…` or under `/session/`)
- `background` — situational context (bug report, info share, wiki stack, …)
- `userPrompt` — optional extra focus

## Result

Inline tool returns `{ ok, data: { ok, text, source } }`. Use `data.text` as the extracted description.

For text-file RAG, use `extract-info` instead.
