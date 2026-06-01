interface Stage {
  lines: string;
  sourceStartLine: number;
  temperature?: number;
  type: "loop" | "plain";
}

const _extractYahlBlocks = (rawCode: string): string[] => {
  const lines = rawCode.split(/\r?\n/);
  const blocks: string[] = [];
  
  let currentBlock: string[] = [];
  let baseIndent = -1;
  let bracketDepth = 0; // 追蹤未閉合的括號 (), [], {}

  for (let line of lines) {
    if (line.trim() === '') continue;

    const currentIndent = line.match(/^(\s*)/)?.[0].length || 0;
    
    // 計算當前行括號的開閉數量
    const openBrackets = (line.match(/[\{\[\(]/g) || []).length;
    const closeBrackets = (line.match(/[\}\]\)]/g) || []).length;

    if (baseIndent === -1) {
      baseIndent = currentIndent;
      currentBlock.push(line);
    } else if (currentIndent > baseIndent || bracketDepth > 0) {
      // 只要縮排比較深，或者還有括號沒閉合，就視為同一個 block
      currentBlock.push(line);
    } else {
      // 縮排恢復，且括號完全閉合，代表前一個 block 結束
      blocks.push(currentBlock.join('\n'));
      baseIndent = currentIndent;
      currentBlock = [line];
    }

    // 更新括號深度
    bracketDepth += (openBrackets - closeBrackets);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks;
}

const _isLoopStage = (block: string) =>
  !!block.match(/^\s*for each\s+(\w+)\s+of\s+(\[.*\])/i) &&
  !!["{", "}"].find((char) => block.trim().endsWith(char));


export const yahlToStages = (value: string): Stage[] => {
  const blocks = _extractYahlBlocks(value);
  const stages: Stage[] = [];

  for (const block of blocks) {
    const temperature = (() => {
      const match = block.match(/@temperature\s*\(\s*(\d+\.\d+)\s*\)\s*/)?.[1];

      return match ? Number(match) : undefined;
    })();

    stages.push({
      temperature,
      lines: block,
      sourceStartLine: 0,
      type: _isLoopStage(block) ? "loop" : "plain",
    });
  }

  return stages;
};
  
export const extractYahl = (value: string) => {
  const INDEX_OF = '```ai.logic' as const;
  const LAST_INDEX_OF = '```' as const;

  const indexOf = value.indexOf(INDEX_OF);
  const lastIndexOf = value.lastIndexOf(LAST_INDEX_OF);

  return value.substring(
    indexOf >= 0 ? indexOf + INDEX_OF.length : 0,
    lastIndexOf >= 0 ? lastIndexOf : value.length,
  );
}