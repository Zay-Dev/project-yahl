export const KNOWLEDGE_WRITE_DEFS = [
  'upsert-knowledge-page',
  'dedup-knowledge',
  'resolve-topic',
  'upsert-greets-page',
  'upsert-whatsapp-page',
  'apply-manager-topic',
  'apply-approved-transfers',
] as const;

export type TKnowledgeWriteDef = (typeof KNOWLEDGE_WRITE_DEFS)[number];

export const KNOWLEDGE_MANAGER_TASK_IDS = [
  'knowledge_manager',
  'knowledge_refresh',
  'greets',
  'whatsapp_wiki_stack',
] as const;

export type TKnowledgeManagerTaskId = (typeof KNOWLEDGE_MANAGER_TASK_IDS)[number];

export const isKnowledgeWriteDef = (defId: string): boolean =>
  (KNOWLEDGE_WRITE_DEFS as readonly string[]).includes(defId.trim());

export const isKnowledgeManagerTask = (taskId: string): boolean =>
  (KNOWLEDGE_MANAGER_TASK_IDS as readonly string[]).includes(taskId.trim());

export const assertKnowledgeWriteAllowed = (params: {
  defId: string;
  taskId: string | null | undefined;
}): void => {
  if (!isKnowledgeWriteDef(params.defId)) {
    return;
  }

  const taskId = params.taskId?.trim() ?? '';

  if (!taskId || !isKnowledgeManagerTask(taskId)) {
    throw new Error('knowledge_write_forbidden');
  }
};

export const GREETS_WRITE_DEFS = ['upsert-greets-page'] as const;
export const WHATSAPP_WRITE_DEFS = ['upsert-whatsapp-page'] as const;

export const assertNamespaceWriteAllowed = (params: {
  defId: string;
  taskId: string | null | undefined;
}): void => {
  const defId = params.defId.trim();
  const taskId = params.taskId?.trim() ?? '';

  if ((GREETS_WRITE_DEFS as readonly string[]).includes(defId) && taskId !== 'greets' && taskId !== 'knowledge_manager') {
    throw new Error('knowledge_write_forbidden');
  }

  if ((WHATSAPP_WRITE_DEFS as readonly string[]).includes(defId) && taskId !== 'whatsapp_wiki_stack' && taskId !== 'knowledge_manager') {
    throw new Error('knowledge_write_forbidden');
  }

  if (
    defId !== 'upsert-greets-page'
    && defId !== 'upsert-whatsapp-page'
    && isKnowledgeWriteDef(defId)
  ) {
    if (taskId !== 'knowledge_manager' && taskId !== 'knowledge_refresh') {
      throw new Error('knowledge_write_forbidden');
    }
  }
};
