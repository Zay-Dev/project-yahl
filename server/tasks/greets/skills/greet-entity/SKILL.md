# greet-entity

Write greets + WhatsApp extract wiki pages for a greeted person or group.

Use **only**:

- `/nixery(upsert-greets-page, entity, page, content, …)` → `greets/{entity}/…`
- `/nixery(upsert-whatsapp-page, chatFolder, page, content, …)` → `whatsapp/{slug}/…`

Do **not** call `upsert-knowledge-page` (writes `topics/…`). If `upsert-greets-page` fails, report the error — do not invent a topics fallback.

## greets/{entity} — overview

- One H1 with display name or entity slug
- Sections: Who, Relationship / prefs (from summary), Context, Open questions
- Observation only — no invented private facts

## greets/{entity} — facts

- Bullet list: entity, displayName, summary, whatsapp slug path (`whatsapp/{slug}`)

## whatsapp/{slug} — overview

- Kind (DM/group), Identity, link to greets entity, Context, Open questions
- Identity must distinguish the **peer/channel** from the **platform agent** (YAHL WhatsApp session)
- Do not invent a third-party “bot” for automated messages the platform agent sends

## whatsapp/{slug} — facts

- Bullet list: chatId, folder/slug, wikiRoot, displayName, greetsEntity, onboardedAt when known
- Include a **Platform agent** section when platform has chatId:
  - assistant display name (e.g. YAHL)
  - agent WhatsApp chatId (`platform.chatId`)
  - optional `platform.lid` when known
  - note that messages from this identity (or marked `fromMe` / platform in inbox) are outbound from the YAHL assistant, not a third party
- When `platform` is `{}` (register skipped), omit the Platform agent section or note it as unknown
