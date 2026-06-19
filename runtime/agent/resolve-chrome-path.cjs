const { chromium } = require("playwright");

process.stdout.write(chromium.executablePath());
