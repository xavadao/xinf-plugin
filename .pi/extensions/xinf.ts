// Xava Inference for Pi: adds the `xinf` MCP server to ~/.pi/agent/mcp.json (preserving every other server) and loads
// the bundled MCP adapter. The key is referenced by env var name (XINF_API_KEY), never copied into the config.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mcpAdapter from "pi-mcp-adapter";

const DEFAULT_BASE_URL = "https://zinf.ai";

export function xinfServer(env: NodeJS.ProcessEnv = process.env) {
  const origin = (env.XINF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  // MCP sign-in: without a key the adapter signs in through the browser (`/mcp-auth xinf`)
  return {
    url: `${origin}/mcp/account`,
    ...(env.XINF_API_KEY ? { auth: "bearer", bearerTokenEnv: "XINF_API_KEY" } : { auth: "oauth" }),
    lifecycle: "lazy",
  };
}

export function ensureXinfConfig(env: NodeJS.ProcessEnv = process.env) {
  const agentDir = env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
  const configPath = path.join(agentDir, "mcp.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      throw new Error(`Cannot install the xinf MCP server into invalid Pi config ${configPath}: ${String(error)}`);
    }
  }
  const servers = (config.mcpServers && typeof config.mcpServers === "object")
    ? config.mcpServers as Record<string, unknown>
    : {};
  const next = { ...config, mcpServers: { ...servers, xinf: xinfServer(env) } };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (!fs.existsSync(configPath) || fs.readFileSync(configPath, "utf8") !== serialized) {
    fs.writeFileSync(configPath, serialized, { mode: 0o600 });
  }
}

export default function xinf(pi: ExtensionAPI) {
  ensureXinfConfig();
  mcpAdapter(pi);
}
