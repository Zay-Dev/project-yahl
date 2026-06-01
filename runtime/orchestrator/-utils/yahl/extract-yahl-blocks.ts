export const extractYahlBlocks = (rawCode: string): string[] => {
  const lines = rawCode.split(/\r?\n/);
  const blocks: string[] = [];

  let currentBlock: string[] = [];
  let baseIndent = -1;
  let bracketDepth = 0;

  for (const line of lines) {
    if (line.trim() === "") continue;

    const currentIndent = line.match(/^(\s*)/)?.[0].length || 0;

    const openBrackets = (line.match(/[\{\[\(]/g) || []).length;
    const closeBrackets = (line.match(/[\}\]\)]/g) || []).length;

    if (baseIndent === -1) {
      baseIndent = currentIndent;
      currentBlock.push(line);
    } else if (currentIndent > baseIndent || bracketDepth > 0) {
      currentBlock.push(line);
    } else {
      blocks.push(currentBlock.join("\n"));
      baseIndent = currentIndent;
      currentBlock = [line];
    }

    bracketDepth += openBrackets - closeBrackets;
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks;
};
