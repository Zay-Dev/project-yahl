export const readKnowledgeWikiConfig = () => ({
  knowledgeExportRoot: process.env.KNOWLEDGE_EXPORT_ROOT?.trim() || '/data/knowledge_export',
  topicsRegistryPath: process.env.TOPICS_REGISTRY_PATH?.trim() || '/data/mastermind/topics.json',
  wikiApiToken: process.env.WIKI_API_TOKEN?.trim() ?? '',
  wikiExportBytesThreshold: Number(process.env.WIKI_EXPORT_BYTES_THRESHOLD?.trim() || String(256 * 1024)),
  wikiExportPageThreshold: Number(process.env.WIKI_EXPORT_PAGE_THRESHOLD?.trim() || '10'),
  wikiGraphqlUrl: (process.env.WIKI_GRAPHQL_URL?.trim() || 'http://wiki:3000/graphql').replace(/\/+$/, ''),
});

export type TKnowledgeWikiConfig = ReturnType<typeof readKnowledgeWikiConfig>;
