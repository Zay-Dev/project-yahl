import { chromium } from "playwright";

export const resolveChromiumExecutablePath = () => {
  const fromEnv = process.env.CHROME_PATH?.trim();

  if (fromEnv) return fromEnv;

  const bakedPath = process.env.STAGEHAND_CHROME_PATH?.trim();

  if (bakedPath) {
    process.env.CHROME_PATH = bakedPath;

    return bakedPath;
  }

  const path = chromium.executablePath();
  process.env.CHROME_PATH = path;

  return path;
};
