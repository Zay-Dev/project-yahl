import type { LoopKnowledge, LoopKnowledgeUpdate } from "./orchestrator-types";

export const normalizeIssueKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const parseKnowledgeUpdate = (value: unknown): LoopKnowledgeUpdate | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const issue = typeof record.issue === "string" ? record.issue.trim() : "";
  if (!issue) return null;

  return {
    issue,
    note: typeof record.note === "string" ? record.note.trim() : undefined,
    solution: typeof record.solution === "string" ? record.solution.trim() : undefined,
    solved: typeof record.solved === "boolean" ? record.solved : undefined,
  };
};

export const appendKnowledgeNote = (knowledge: LoopKnowledge, note: string) => {
  const normalized = note.trim();
  if (!normalized) return;

  const last = knowledge.notes.at(-1);
  if (last === normalized) return;

  knowledge.notes.push(normalized);
  if (knowledge.notes.length > 24) {
    knowledge.notes = knowledge.notes.slice(-24);
  }
};

export const applyKnowledgeUpdate = (
  knowledge: LoopKnowledge,
  update: LoopKnowledgeUpdate,
) => {
  const issueKey = normalizeIssueKey(update.issue);
  const currentIssue = knowledge.issues[issueKey] || {
    count: 0,
    lastSolution: "",
    solved: false,
  };

  const nextCount = currentIssue.count + 1;
  const nextSolved = update.solved === true;
  const nextSolution = update.solution || currentIssue.lastSolution;

  knowledge.issues[issueKey] = {
    count: nextCount,
    lastSolution: nextSolution,
    solved: nextSolved,
  };

  const statusText = nextSolved ? "resolved" : "unresolved";
  const summary = `[knowledge] issue="${issueKey}" count=${nextCount} status=${statusText}`;
  console.log(summary);

  if (update.solution) {
    const solutionNote = `[knowledge] solution updated for "${issueKey}": ${update.solution}`;
    console.log(solutionNote);
    appendKnowledgeNote(knowledge, solutionNote);
  }

  if (update.note) {
    appendKnowledgeNote(knowledge, `[knowledge] ${update.note}`);
  }

  if (!nextSolved && nextCount >= 3) {
    throw new Error(`Loop unresolved issue after 3 attempts: ${issueKey} (${nextCount})`);
  }
};
