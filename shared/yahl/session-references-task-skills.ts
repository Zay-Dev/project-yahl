export type TSessionTaskSkillsRefInput = {
  parsedStages: Array<{ lines: string }>;
  taskYahl: string;
};

export const sessionReferencesTaskSkills = (session: TSessionTaskSkillsRefInput) =>
  session.taskYahl.includes('~/task-skills/')
  || session.parsedStages.some((stage) => stage.lines.includes('~/task-skills/'));
