# clarify-topic-minimal

Minimal ask-user batch before full clarify on knowledge_capture. Resolves topic slug early so `get-knowledge` can detect an existing corpus.

## Fixed batch spec

Emit `ask_user` with `version: "askUserBatch.v1"`:

| questionRef | kind | title | notes |
|-------------|------|-------|-------|
| `topic` | text | What subject should we learn about? | Required unless seed URLs alone define the subject |
| `seed_urls` | text | Seed URLs (one per line, optional) | placeholder: https://… |

## Build partial contract

After answers, normalize:

```json
{
  "topic": "string from topic answer",
  "seedUrls": ["url", "..."]
}
```

Call `*build_learning_contract_partial(topicAnswers)` — intent/depth may be empty until full clarify or corpus load.

## Resolve topic

```text
const proposed_topic = *slugify_learning_topic({ topic, seedUrls });
const resolvedTopic = /mastermind(resolve-topic, topicText: topic, seedUrls, slug: proposed_topic);
const knowledge_topic = resolvedTopic.canonical;
```

Then run `get-knowledge` for `knowledge_topic` before deciding rerun gate vs full clarify.

## When full clarify runs

- First run (extract absent)
- Rerun with `proceed_mode === full_refresh`
- Rerun with `update_scope` includes `clarify`
- Corpus exists but `learning_contract` cannot be loaded from extract

Use `~/task-skills/clarify-intake/SKILL.md` for the full batch after rerun gate when needed.
