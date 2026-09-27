#!/usr/bin/env node
// Add the Xava Inference MCP server (sign-in endpoint <origin>/mcp/account, no key) to a client's MCP config file,
// keeping every other entry. No dependencies; Node 18+.
//   curl -fsSL https://raw.githubusercontent.com/xavadao/xinf-plugin/main/scripts/add-mcp.mjs | node - cursor
//   node scripts/add-mcp.mjs <cursor|windsurf|cline|kimi> [--base-url https://zinf.dev]   (or XINF_BASE_URL)
// Then the client signs in with the browser: Cursor CLI `cursor-agent mcp login xinf`, Cursor / Windsurf / Cline:
// click the server's login button, Kimi Code: `/mcp-config login xinf`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_BASE_URL = "https://zinf.ai";

/** Where each client keeps its user-level MCP config, and the entry it expects. */
export function targets(client, env = process.env, platform = process.platform) {
  const home = env.HOME || os.homedir();
  const vscodeUser = platform === "darwin" ? path.join(home, "Library/Application Support/Code/User")
    : platform === "win32" ? path.join(env.APPDATA || path.join(home, "AppData/Roaming"), "Code/User")
    : path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "Code/User");
  switch (client) {
    case "cursor":
      return { files: [path.join(home, ".cursor/mcp.json")], entry: (url) => ({ url }), next: "Cursor: Settings > MCP, click \"Needs login\" next to xinf. Cursor CLI: cursor-agent mcp login xinf" };
    case "windsurf": {
      // Windsurf; newer builds (Devin Desktop) read ~/.config/devin/mcp_config.json
      const devin = path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "devin/mcp_config.json");
      const files = [path.join(home, ".codeium/windsurf/mcp_config.json")];
      if (fs.existsSync(path.dirname(devin))) files.push(devin);
      return { files, entry: (url) => ({ serverUrl: url }), next: "Windsurf: open Cascade > MCP servers, refresh, and sign in to xinf in the browser" };
    }
    case "cline":
      return { files: [path.join(vscodeUser, "globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json")], entry: (url) => ({ type: "streamableHttp", url }), next: "Cline: MCP Servers panel, click Authenticate next to xinf" };
    case "kimi":
      return { files: [path.join(env.KIMI_CODE_HOME || path.join(home, ".kimi-code"), "mcp.json")], entry: (url) => ({ url }), next: "Kimi Code: start a new session (/new), then /mcp-config login xinf" };
    default:
      return null;
  }
}

export function addServer(file, entry) {
  let config = {};
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, "utf8");
    if (text.trim()) {
      try {
        config = JSON.parse(text);
      } catch (error) {
        throw new Error(`${file} is not valid JSON (${error.message}); add the xinf entry by hand: ${JSON.stringify(entry)}`);
      }
    }
  }
  const servers = config.mcpServers && typeof config.mcpServers === "object" ? config.mcpServers : {};
  const next = { ...config, mcpServers: { ...servers, xinf: entry } };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const client = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--base-url");
  const i = argv.indexOf("--base-url");
  const origin = (i >= 0 ? argv[i + 1] : env.XINF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const t = targets(client, env);
  if (!t) {
    console.error("usage: add-mcp.mjs <cursor|windsurf|cline|kimi> [--base-url https://origin]");
    return 2;
  }
  if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
    console.error(`--base-url must be an origin such as ${DEFAULT_BASE_URL}`);
    return 2;
  }
  const url = `${origin}/mcp/account`;
  for (const file of t.files) {
    addServer(file, t.entry(url));
    console.log(`Added xinf (${url}) to ${file}`);
  }
  console.log(`Next, sign in with the browser. ${t.next}`);
  return 0;
}

const invoked = process.argv[1] && (process.argv[1] === "-" || /add-mcp\.mjs$/.test(process.argv[1]) || !process.argv[1].endsWith(".mjs"));
if (invoked) process.exitCode = main();
