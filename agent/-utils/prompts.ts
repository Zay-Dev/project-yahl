import path from 'path';
import fs from 'fs/promises';

export const readFileUtf8 = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
};

export const readFolderUtf8 = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true,
    });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.resolve(dirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));

    const contents = await Promise.all(files.map(readFileUtf8));

    return contents.filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
};

export const decodeBase64 = (text: string) => {
  try {
    return Buffer.from(text, "base64").toString("utf-8").trim();
  } catch {
    return "";
  }
};