import { runKnowledgeSearchAgent } from '../_shared/knowledge-search-agent.mjs';

runKnowledgeSearchAgent().catch((error) => {
  console.error('[nixery-get-knowledge]', error);
  process.exit(1);
});
