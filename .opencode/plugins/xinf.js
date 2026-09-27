// Xava Inference for OpenCode: registers the canonical skills, the `xinf` remote MCP server and, when a key is set,
// an OpenAI-compatible `xinf` model provider. The key is read from XINF_API_KEY at startup and never written to disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://zinf.ai";

const adapterDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(adapterDir, "../..");
const managedRoot = path.resolve(adapterDir, "../xinf-plugin");
const pluginRoot = fs.existsSync(path.join(projectRoot, "plugins/xinf/skills")) ? projectRoot : managedRoot;
const skillsDir = path.join(pluginRoot, "plugins/xinf/skills");
let bootstrap;

function readBootstrap() {
  if (bootstrap !== undefined) return bootstrap;
  const file = path.join(skillsDir, "using-xinf/SKILL.md");
  bootstrap = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  return bootstrap;
}

export function baseUrl(env = process.env) {
  return (env.XINF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export const XinfPlugin = async () => ({
  config: async (config) => {
    const origin = baseUrl();
    const key = process.env.XINF_API_KEY;
    config.skills ??= {};
    config.skills.paths ??= [];
    if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);
    config.mcp ??= {};
    // MCP sign-in: /mcp/account refuses a keyless connection with 401, so OpenCode offers `opencode mcp auth xinf`
    // (browser sign-in). With XINF_API_KEY set, the key is sent instead.
    config.mcp.xinf = {
      type: "remote",
      url: `${origin}/mcp/account`,
      enabled: true,
      ...(key ? { headers: { Authorization: `Bearer ${key}` } } : {}),
    };
    if (key) {
      config.provider ??= {};
      config.provider.xinf ??= {
        npm: "@ai-sdk/openai-compatible",
        name: "Xava Inference",
        options: { baseURL: `${origin}/v1`, apiKey: "{env:XINF_API_KEY}" },
        models: { "anthropic/claude-sonnet-5": {}, "openai/gpt-5.4": {} },
      };
    }
  },
  "experimental.chat.messages.transform": async (_input, output) => {
    const content = readBootstrap();
    const firstUser = output.messages.find((message) => message.info.role === "user");
    if (!content || !firstUser?.parts?.length) return;
    if (firstUser.parts.some((part) => part.type === "text" && part.text.includes("<XINF_PLUGIN>"))) return;
    const ref = firstUser.parts[0];
    firstUser.parts.unshift({ ...ref, type: "text", text: `<XINF_PLUGIN>\n${content}\n</XINF_PLUGIN>` });
  },
});
