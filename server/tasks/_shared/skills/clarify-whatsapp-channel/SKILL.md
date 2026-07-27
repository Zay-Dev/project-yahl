# clarify-whatsapp-channel

Ask for the WhatsApp channel to onboard and the platform agent identity.

## Questions

1. `channelRef` (required): phone number (e.g. 91234567 or +85291234567) or WhatsApp group id ending in `@g.us`
2. `displayName` (optional): human label for the channel (peer / group)
3. `agentPhone` (required if the platform WhatsApp number is not already stored): phone number the YAHL WhatsApp Web session is logged in as (the assistant / worker account)
4. `assistantName` (optional): display name for the platform assistant in wiki (default `YAHL`)
