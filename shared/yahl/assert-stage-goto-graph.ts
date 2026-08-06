import type { TYahlStage } from './types';
import { parseStageGotoCommand } from './stage-goto';

export const assertDocumentStageIdsAndGoto = (stages: TYahlStage[]) => {
  const idToIndex = new Map<string, number>();

  stages.forEach((stage, index) => {
    if (!stage.id) {
      return;
    }

    const existing = idToIndex.get(stage.id);

    if (existing !== undefined) {
      throw new Error(
        `stages[${index}].id: duplicate id "${stage.id}" (also stages[${existing}])`,
      );
    }

    idToIndex.set(stage.id, index);
  });

  stages.forEach((stage, index) => {
    if (!stage.goto?.length) {
      return;
    }

    stage.goto.forEach((entry, gotoIndex) => {
      const targetId = parseStageGotoCommand(entry.command);

      if (!targetId) {
        throw new Error(
          `stages[${index}].goto[${gotoIndex}].command: must match /stage(<id>)`,
        );
      }

      if (!idToIndex.has(targetId)) {
        throw new Error(
          `stages[${index}].goto[${gotoIndex}].command: unknown stage id "${targetId}"`,
        );
      }

      if (stage.id && stage.id === targetId) {
        throw new Error(
          `stages[${index}].goto[${gotoIndex}].command: cannot target the same stage`,
        );
      }
    });
  });
};
