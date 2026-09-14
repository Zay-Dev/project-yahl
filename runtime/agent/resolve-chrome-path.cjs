const fs = require("node:fs");
const path = require("node:path");

const { chromium } = require("playwright");

const browsersRoot =
  process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() || "/opt/ms-playwright";

const findChrome = (dir) => {
  if (!fs.existsSync(dir)) return undefined;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = findChrome(full);
      if (nested) return nested;
      continue;
    }

    if (entry.isFile() && entry.name === "chrome") {
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {
        continue;
      }
    }
  }

  return undefined;
};

const onDisk = findChrome(browsersRoot);
const resolved = onDisk || chromium.executablePath();

process.stdout.write(resolved);
