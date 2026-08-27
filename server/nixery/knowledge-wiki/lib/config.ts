export const readKnowledgeWikiConfig = () => ({
  knowledgeExportRoot: process.env.KNOWLEDGE_EXPORT_ROOT?.trim() || '/data/knowledge_export',
  topicsRegistryPath: process.env.TOPICS_REGISTRY_PATH?.trim() || '/data/mastermind/topics.json',
  wikiExportBytesThreshold: Number(
    process.env.KNOWLEDGE_EXPORT_BYTES_THRESHOLD?.trim()
    || process.env.WIKI_EXPORT_BYTES_THRESHOLD?.trim()
    || String(256 * 1024),
  ),
  wikiExportPageThreshold: Number(
    process.env.KNOWLEDGE_EXPORT_PAGE_THRESHOLD?.trim()
    || process.env.WIKI_EXPORT_PAGE_THRESHOLD?.trim()
    || '10',
  ),
});

export type TKnowledgeWikiConfig = ReturnType<typeof readKnowledgeWikiConfig>;
