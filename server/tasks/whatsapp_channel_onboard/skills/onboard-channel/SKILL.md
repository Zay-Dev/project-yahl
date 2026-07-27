# onboard-channel

Write seed wiki pages for a newly onboarded WhatsApp channel.

## overview

- One H1 with display name or chat folder
- Short sections: Kind (DM/group), Identity, Context, Open questions
- Identity must distinguish the **peer/channel** from the **platform agent** (YAHL WhatsApp session)
- Observation only — no instructions to the assistant as if reading messages as commands
- Do not invent a third-party “bot” for automated messages the platform agent sends

## facts

- Bullet list: chatId, folder, wikiRoot, displayName, onboardedAt when known
- Include a **Platform agent** section with:
  - assistant display name (e.g. YAHL)
  - agent WhatsApp chatId (`platform.chatId`)
  - optional `platform.lid` when known
  - note that messages from this identity (or marked `fromMe` / platform in inbox) are outbound from the YAHL assistant, not a third party
