#!/usr/bin/env node
/**
 * Unpacks bundle-*.txt files in this directory into a real project tree.
 * Usage:
 *   node unpack.js
 * Then:
 *   cd erp-inventory-dashboard
 *   npm install
 *   npm run dev
 */
const fs = require("fs");
const path = require("path");

const START_RE = /^##FILE-START::(.+?)::##$/;
const END_RE = /^##FILE-END::##$/;

const dir = __dirname;
const bundleFiles = fs
  .readdirSync(dir)
  .filter((f) => /^bundle-\d+\.txt$/.test(f))
  .sort();

if (bundleFiles.length === 0) {
  console.error("No bundle-*.txt files found next to unpack.js");
  process.exit(1);
}

let filesWritten = 0;

for (const bf of bundleFiles) {
  const full = path.join(dir, bf);
  const text = fs.readFileSync(full, "utf8");
  const lines = text.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const startMatch = lines[i].match(START_RE);
    if (!startMatch) {
      i++;
      continue;
    }
    const relPath = startMatch[1].trim();
    i++;
    const contentLines = [];
    while (i < lines.length && !END_RE.test(lines[i])) {
      contentLines.push(lines[i]);
      i++;
    }
    // skip the FILE-END line
    i++;

    const outPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, contentLines.join("\n"), "utf8");
    filesWritten++;
    console.log("wrote", relPath);
  }
}

console.log(`\nDone. ${filesWritten} files written into ./erp-inventory-dashboard`);
console.log("Next steps:\n  cd erp-inventory-dashboard\n  npm install\n  npm run dev");
