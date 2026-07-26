export type TKnowledgeQaTodoKind =
  | 'expand_questions'
  | 'plan_study'
  | 'elaborate_section'
  | 'research_source';

export type TKnowledgeQaTodoPriority = 'high' | 'medium' | 'low';

export type TKnowledgeQaTodo = {
  detail?: string;
  id: string;
  kind: TKnowledgeQaTodoKind;
  priority: TKnowledgeQaTodoPriority;
  summary: string;
};

export type TKnowledgeQaCheck = {
  id: string;
  note?: string;
  pass: boolean;
};

export type TKnowledgeQaReviewResponse = {
  checks: TKnowledgeQaCheck[];
  summary?: string;
  todos: TKnowledgeQaTodo[];
  topic: string;
};

export type TKnowledgeQaReviewRequest = {
  auditIssues?: string[];
  corpusMd: string;
  invocationId?: string;
  requestId: string;
  sessionId: string;
  topic: string;
};
