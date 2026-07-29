# clarify-greets

Ask for who to greet and whether to enable WhatsApp inbox capture.

## Questions

1. `channelRef` (required): phone number (e.g. 91234567 or +85291234567) or WhatsApp group id ending in `@g.us`
2. `summary` (required): who they are / relationship / prefs — e.g. `user's phone number`, `my primary phone number`, `Mary, my wife, prefer zh-tw`, `John Doe, my colleague, engineer, prefer concise message`
3. `displayName` (optional): short label for the entity
4. `register_channel` (optional): `true` (default) to write `channels.json` for inbox capture; `false` to skip registry this run
5. `agentPhone` (required if registering and platform WhatsApp number is not already stored): phone the YAHL WhatsApp Web session is logged in as
6. `assistantName` (optional): display name for the platform assistant in wiki (default `YAHL`)
