// Validate the plugin: manifests agree with each other and with package.json, every adapter points at the canonical
// bundle and origin, skills/commands/agents have frontmatter, and nothing committed carries a secret or names the
// infrastructure or upstream suppliers. Exits 1 with every problem listed.
import fs from "node:fs";
import path from "node:path";
import { BASE_URL, FORBIDDEN, LOCAL_KEY_SETUP, MCP_URL, REPO, SECRETS, pkg, read, readJson, root, textFiles } from "./lib.mjs";

const errors = [];
const check = (ok, message) => { if (!ok) errors.push(message); };
const exists = (relative) => fs.existsSync(path.join(root, relative));

export const REQUIRED = [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/plugin.json",
  ".kimi-plugin/plugin.json",
  ".mcp.json",
  ".opencode/plugins/xinf.js",
  ".pi/extensions/xinf.ts",
  "AGENTS.md",
  "GEMINI.md",
  "README.md",
  "LICENSE",
  "gemini-extension.json",
  "kimi.plugin.json",
  "opencode.json",
  "clients/cline/cline_mcp_settings.json",
  "clients/windsurf/mcp_config.json",
  "clients/openai-sdk/.env.example",
  "scripts/install-opencode.sh",
  "plugins/xinf/.claude-plugin/plugin.json",
  "plugins/xinf/.codex-plugin/plugin.json",
  "plugins/xinf/.mcp.json",
  "plugins/xinf/hooks/hooks.json",
  "plugins/xinf/hooks/signin-hint.sh",
];
export const SKILLS = ["using-xinf", "xinf-buybacks", "xinf-media", "xinf-models-and-pricing", "xinf-x402"];
export const COMMANDS = ["balance", "generate-image", "login", "models", "setup", "usage"];
export const AGENTS = ["model-picker"];

for (const relative of REQUIRED) check(exists(relative), `missing ${relative}`);
const json = (relative) => {
  try { return readJson(relative); } catch (e) { errors.push(`${relative}: invalid JSON (${e.message})`); return {}; }
};
for (const relative of textFiles().filter((f) => f.endsWith(".json"))) json(relative);

// ---- versions and names ----
const versioned = [
  ".cursor-plugin/plugin.json", ".kimi-plugin/plugin.json", "gemini-extension.json", "kimi.plugin.json",
  "plugins/xinf/.claude-plugin/plugin.json",
];
for (const relative of versioned) {
  const m = json(relative);
  check(m.version === pkg.version, `${relative} version ${m.version} != package.json ${pkg.version}`);
  check(m.name === "xinf", `${relative} name must be "xinf"`);
}
const codex = json("plugins/xinf/.codex-plugin/plugin.json");
check(codex.name === "xinf", "codex manifest name must be xinf");
check(String(codex.version).split("+")[0] === pkg.version, "codex manifest base version drifted from package.json");
check(codex.skills === "./skills/", "codex manifest must point at ./skills/");
check(codex.mcpServers?.xinf?.url === MCP_URL, `codex MCP url must be ${MCP_URL}`);
// the header only when XINF_AUTHORIZATION is set ("Bearer <key>"); unset = Codex signs in with OAuth
check(codex.mcpServers?.xinf?.env_http_headers?.Authorization === "XINF_AUTHORIZATION", "codex MCP must send XINF_AUTHORIZATION only when set (env_http_headers)");
check(!codex.mcpServers?.xinf?.bearer_token_env_var, "codex MCP must not use bearer_token_env_var (it fails when unset and disables OAuth)");

const claudeMarket = json(".claude-plugin/marketplace.json");
const entry = claudeMarket.plugins?.find((p) => p.name === "xinf");
check(claudeMarket.name === "xinf", "Claude marketplace name must be xinf (install id xinf@xinf)");
check(entry?.source === "./plugins/xinf", "Claude marketplace must point at ./plugins/xinf");
check(entry?.version === pkg.version, "Claude marketplace version drifted from package.json");
const codexMarket = json(".agents/plugins/marketplace.json");
check(codexMarket.name === "xinf", "Codex marketplace name must be xinf");
check(codexMarket.plugins?.[0]?.source?.path === "./plugins/xinf", "Codex marketplace must point at ./plugins/xinf");

// ---- adapters point at the canonical bundle ----
for (const relative of [".cursor-plugin/plugin.json", "kimi.plugin.json"]) {
  const m = json(relative);
  check(m.skills === "./plugins/xinf/skills/", `${relative} must use ./plugins/xinf/skills/`);
  check(m.commands === "./plugins/xinf/commands/", `${relative} must use ./plugins/xinf/commands/`);
}
check(read("kimi.plugin.json") === read(".kimi-plugin/plugin.json"), "Kimi manifests drifted");
// the root .mcp.json is the project config for a clone of this repo (no plugin userConfig there): same server and
// helper, origin from XINF_BASE_URL
const rootMcp = json(".mcp.json").mcpServers?.xinf ?? {};
check(rootMcp.url === `\${XINF_BASE_URL:-${BASE_URL}}/mcp/account`, "root .mcp.json url must default XINF_BASE_URL to the base url");
check(rootMcp.headersHelper === json("plugins/xinf/.mcp.json").mcpServers?.xinf?.headersHelper, "root and canonical .mcp.json headersHelper drifted");
check(json("opencode.json").plugin?.includes("./.opencode/plugins/xinf.js"), "opencode.json must load the adapter");
check(/@\.\/plugins\/xinf\/skills\/using-xinf\/SKILL\.md/.test(read("GEMINI.md")), "GEMINI.md must load using-xinf");
check(json("package.json").pi?.skills?.includes("./plugins/xinf/skills"), "package.json pi.skills must be the bundle");

// ---- MCP urls: every adapter uses the canonical origin ----
const canonical = json("plugins/xinf/.mcp.json").mcpServers?.xinf ?? {};
check(canonical.type === "http", "canonical MCP must be type http");
// the origin is the plugin's base_url option: the site's install command passes its own origin with
// `claude plugin install xinf@xinf --config base_url=<origin>`; the default is production
check(canonical.url === "${user_config.base_url}/mcp/account", "canonical MCP url must be ${user_config.base_url}/mcp/account");
const claudeManifest = json("plugins/xinf/.claude-plugin/plugin.json");
check(claudeManifest.userConfig?.base_url?.default === BASE_URL, `plugin.json userConfig.base_url must default to ${BASE_URL}`);
check(claudeManifest.userConfig?.base_url?.type === "string" && !claudeManifest.userConfig?.base_url?.sensitive, "userConfig.base_url must be a non-sensitive string");
// the sign-in reminder: exec form (no shell parsing), short timeout, reads no network
const hooks = json("plugins/xinf/hooks/hooks.json").hooks?.SessionStart?.[0]?.hooks?.[0] ?? {};
check(hooks.command === "sh" && hooks.args?.[0] === "${CLAUDE_PLUGIN_ROOT}/hooks/signin-hint.sh" && hooks.timeout <= 10, "SessionStart hook must run hooks/signin-hint.sh in exec form with a short timeout");
const hint = read("plugins/xinf/hooks/signin-hint.sh");
check(!/\b(curl|wget|nc|security|cat)\b/.test(hint.replace(/^#.*$/gm, "")), "signin-hint.sh must not make network calls or read credential stores");
check(/plugin:xinf:xinf/.test(hint) && /mcp-needs-auth-cache\.json/.test(hint), "signin-hint.sh must key on Claude Code's needs-auth cache entry for plugin:xinf:xinf");
// a static Authorization header turns off Claude Code's OAuth: the helper sends one only when a key exists
check(!canonical.headers?.Authorization, "canonical MCP must not send a static Authorization header (it blocks the browser sign-in)");
check(/XINF_API_KEY/.test(canonical.headersHelper ?? "") && /\.xinf\/credentials/.test(canonical.headersHelper ?? ""), "canonical MCP headersHelper must read XINF_API_KEY or ~/.xinf/credentials");
const mcpUrls = {
  ".cursor-plugin/plugin.json": (m) => m.mcpServers?.xinf?.url,
  "kimi.plugin.json": (m) => m.mcpServers?.xinf?.url,
  "gemini-extension.json": (m) => m.mcpServers?.xinf?.httpUrl,
  "clients/cline/cline_mcp_settings.json": (m) => m.mcpServers?.xinf?.url,
  "clients/windsurf/mcp_config.json": (m) => m.mcpServers?.xinf?.serverUrl,
};
for (const [relative, get] of Object.entries(mcpUrls)) check(get(json(relative)) === MCP_URL, `${relative} MCP url must be ${MCP_URL}`);
for (const relative of [".opencode/plugins/xinf.js", ".pi/extensions/xinf.ts"]) {
  check(read(relative).includes(`"${BASE_URL}"`), `${relative} must default to ${BASE_URL}`);
}
// any absolute url to our origin or GitHub must be the canonical one
for (const relative of textFiles()) {
  const src = read(relative);
  for (const m of src.matchAll(/(?:raw\.githubusercontent|github)\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)/g)) {
    if (m[1] === "actions") continue;
    const repo = `${m[1]}/${m[2].replace(/\.git$/, "").replace(/[.)]+$/, "")}`;
    check(repo === REPO, `${relative}: GitHub path ${repo} is not ${REPO}`);
  }
}

// ---- skills, commands, agents ----
function frontmatter(relative) {
  const src = read(relative);
  if (!src.startsWith("---\n")) return null;
  const end = src.indexOf("\n---", 4);
  if (end < 0) return null;
  const fields = {};
  for (const line of src.slice(4, end).split("\n")) {
    const m = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return { fields, body: src.slice(end + 4) };
}
const dirs = (relative) => fs.readdirSync(path.join(root, relative), { withFileTypes: true });
const skillDirs = dirs("plugins/xinf/skills").filter((d) => d.isDirectory()).map((d) => d.name).sort();
check(JSON.stringify(skillDirs) === JSON.stringify(SKILLS), `skills are ${skillDirs.join(", ")}; expected ${SKILLS.join(", ")}`);
for (const name of skillDirs) {
  const relative = `plugins/xinf/skills/${name}/SKILL.md`;
  if (!exists(relative)) { errors.push(`missing ${relative}`); continue; }
  const fm = frontmatter(relative);
  check(fm, `${relative} must start with closed YAML frontmatter`);
  if (!fm) continue;
  check(fm.fields.name === name, `${relative} frontmatter name must be ${name}`);
  const d = fm.fields.description ?? "";
  check(d.length >= 80 && d.length <= 1024, `${relative} description must be 80-1024 chars (is ${d.length})`);
  check(/\bUse when\b/.test(d), `${relative} description must say when to use it ("Use when ...")`);
  check(fm.body.trim().length > 200, `${relative} has no body`);
  check(!/\[TODO|TBD\b/.test(fm.body), `${relative} contains a TODO`);
  check(exists(`plugins/xinf/skills/${name}/agents/openai.yaml`), `missing ${name}/agents/openai.yaml`);
}
const commands = dirs("plugins/xinf/commands").map((d) => d.name.replace(/\.md$/, "")).sort();
check(JSON.stringify(commands) === JSON.stringify(COMMANDS), `commands are ${commands.join(", ")}; expected ${COMMANDS.join(", ")}`);
for (const name of commands) {
  const fm = frontmatter(`plugins/xinf/commands/${name}.md`);
  check(fm?.fields.description, `command ${name} needs a description`);
}
const agents = dirs("plugins/xinf/agents").map((d) => d.name.replace(/\.md$/, "")).sort();
check(JSON.stringify(agents) === JSON.stringify(AGENTS), `agents are ${agents.join(", ")}; expected ${AGENTS.join(", ")}`);
for (const name of agents) {
  const fm = frontmatter(`plugins/xinf/agents/${name}.md`);
  check(fm?.fields.name === name && fm.fields.description, `agent ${name} needs name and description`);
}
// every skill a file names must exist
for (const relative of textFiles().filter((f) => f.endsWith(".md"))) {
  for (const m of read(relative).matchAll(/`((?:using-)?xinf(?:-[a-z0-9]+)+|using-xinf)`/g)) {
    if (/^xinf-(plugin|darwin)/.test(m[1])) continue;
    check(SKILLS.includes(m[1]), `${relative} names unknown skill ${m[1]}`);
  }
}

// ---- no secrets, no forbidden words, no retired names ----
const RETIRED = new RegExp(["\\$XA", "VA\\b"].join(""));
for (const relative of textFiles()) {
  const src = read(relative);
  for (const [what, re] of SECRETS) check(!re.test(src), `${relative} looks like it contains a ${what}`);
  const hit = src.match(FORBIDDEN);
  check(!hit, `${relative} names the infrastructure or an upstream supplier ("${hit?.[0]}")`);
  check(!RETIRED.test(src), `${relative} uses the retired ticker (use $XINF)`);
  // owner decision 105: no local private keys, no local x402 payer
  for (const [what, re] of LOCAL_KEY_SETUP) check(!re.test(src), `${relative} references ${what} (decision 105: no local private keys)`);
}
const oldCli = ["xinf-", "x402"].join("");
check(!exists(`bin/${oldCli}.mjs`) && !pkg.bin?.[oldCli], "the local x402 payer is gone (decision 105)");
for (const d of ["@x402/fetch", "@x402/core", "@x402/svm", "@solana/kit"]) check(!pkg.dependencies?.[d], `package.json must not depend on ${d} (decision 105: no local signing)`);
check(!exists(".env"), ".env must not be committed");

if (errors.length) {
  console.error(`Validation failed with ${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Validated xinf plugin ${pkg.version}: ${skillDirs.length} skills, ${commands.length} commands, ${agents.length} agent, MCP ${MCP_URL}, repo ${REPO}.`);
