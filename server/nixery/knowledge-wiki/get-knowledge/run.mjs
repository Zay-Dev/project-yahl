import { runKnowledgeSearchAgent } from '../lib/knowledge-search-agent.mjs';
import { resolveTopicScopeValues } from '../lib/resolve-topic-scope.mjs';

const main = async () => {
  const agent = await runKnowledgeSearchAgent({
    beforeRender: async ({ inputValues }) => resolveTopicScopeValues(
      inputValues.topic,
      inputValues.purpose,
    ),
  });

  return agent;
};

main().catch((error) => {
  console.error('[nixery-get-knowledge]', error);
  process.exit(1);
});
