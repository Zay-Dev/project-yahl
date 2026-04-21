import path from "path";
import fs from "fs/promises";

const TAB_SIZE = 2 as const;
const END_LINE_WITH = ';' as const;

const base = path.resolve(import.meta.dirname || process.cwd());
const myBase = path.resolve(base, "orchestrator");

const main = async () => {
  const report_news = await fs.readFile(
    path.resolve(myBase, "SKILLS/report_news/SKILL.yahl"),
    "utf-8",
  );

  const ai_logic = report_news
    .match(/```ai\.logic\n(.*)\n```/s)?.[0]
    ?.replace(/^```ai\.logic\n/, '')
    ?.replace(/\n```$/, '');

  if (!ai_logic) {
    console.error("No ai.logic found in report_news");
    return;
  }

  _iterate(ai_logic);
};

const _iterate = (text: string, tabIndex = 0) => {
  const stages = _getStages(text, tabIndex);
  // stages.forEach((text, i) => console.log({ i, text }));

  if (stages.length <= 0) return;

  for (const stage of stages) {
    // const stages = _getStages(stage, tabIndex + 1);

    console.log(`exec: ${stage}`);
    // if (stages.length === 1) {
    // } else {
    //   stages.forEach(stage => _iterate(stage, tabIndex + 1));
    //   // console.log({ stage, stages, length: stages.length });
    // }
  }
};

const _getStages = (text: string, tabIndex = 0) => {
  type TStage = {
    lines: string[];
    closed: boolean;
  };

  const stages: TStage[] = [];
  const tabSize = tabIndex * TAB_SIZE;

  for (const line of text.split('\n')) {
    const numberOfWhitespaces = (line.match(/^[\s]+/)?.[0] || '').length;
    const isOpenOrClose = numberOfWhitespaces <= tabSize;

    if (isOpenOrClose) {
      const lastStage = stages.at(-1);

      if (!lastStage || !!lastStage?.closed) {
        if (!line) continue;

        stages.push({
          lines: [],
          closed: false,
        });
      }
    }

    const currentStage = stages.at(-1)!;

    currentStage.lines.push(line);
    currentStage.closed = isOpenOrClose &&
      line.endsWith(END_LINE_WITH);
  }

  return stages.map(({ lines }) => lines.join('\n'));
};

main();