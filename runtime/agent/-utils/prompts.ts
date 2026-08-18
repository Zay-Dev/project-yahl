import path from 'path';
import fs from 'fs/promises';

export const readFileUtf8 = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
};

export const listReadableUtf8Files = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    });
    const resolved = await Promise.all(entries.map(async (entry) => {
      const abs = path.resolve(dirPath, entry.name);

      try {
        const st = await fs.stat(abs);

        return st.isFile() ? abs : null;
      } catch {
        return null;
      }
    }));

    return resolved
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

export const readFolderUtf8 = async (dirPath: string) => {
  const files = await listReadableUtf8Files(dirPath);
  const contents = await Promise.all(files.map(readFileUtf8));

  return contents.filter(Boolean).join("\n\n");
};
