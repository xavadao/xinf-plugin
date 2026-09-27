// Change the two placeholders everywhere: the GitHub repo and the production origin.
//   node scripts/retarget.mjs --repo owner/name --base-url https://inference.example.com [--dry-run]
// Rewrites every text file that mentions the current value, then package.json's `xinf` block. Run validate after.
import fs from "node:fs";
import path from "node:path";
import { BASE_URL, REPO, root, textFiles } from "./lib.mjs";

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const repo = arg("--repo") ?? REPO;
const baseUrl = (arg("--base-url") ?? BASE_URL).replace(/\/+$/, "");
const dry = args.includes("--dry-run");

if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error(`--repo must be owner/name, got ${repo}`);
if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(baseUrl)) throw new Error(`--base-url must be an https origin, got ${baseUrl}`);

const changed = [];
for (const relative of textFiles()) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, "utf8");
  const after = before.split(REPO).join(repo).split(BASE_URL).join(baseUrl);
  if (after !== before) {
    changed.push(relative);
    if (!dry) fs.writeFileSync(file, after);
  }
}
console.log(`${dry ? "Would change" : "Changed"} ${changed.length} file(s): repo ${REPO} -> ${repo}, base url ${BASE_URL} -> ${baseUrl}`);
for (const f of changed) console.log(`  ${f}`);
