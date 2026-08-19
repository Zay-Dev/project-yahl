import { runKnowledgeSearchAgent } from '../lib/knowledge-search-agent.mjs';

runKnowledgeSearchAgent().catch((error) => {
  console.error('[nixery-search-knowledge]', error);
  process.exit(1);
});
