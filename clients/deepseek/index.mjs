// DeepSeek Harness bundle: reuse its MCP client and skill loader with our canonical skills.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "xinf";
export const inject = ["tools", "skills"];
export const DEFAULT_BASE_URL = "https://xavainf.com";

/** Device credentials are sent only to the origin that issued them. Never evaluate the file as shell code. */
export function mcpConfig(env = process.env, home = os.homedir()) {
  let saved = {};
  try {
    saved = Object.fromEntries(fs.readFileSync(path.join(home, ".xinf/credentials"), "utf8")
      .split("\n").filter((line) => /^XINF_(API_KEY|BASE_URL)=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const origin = (env.XINF_BASE_URL || saved.XINF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("XINF_BASE_URL must be an HTTPS origin (or local HTTP).");
  }
  const savedOrigin = (saved.XINF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const key = env.XINF_API_KEY || (savedOrigin === origin ? saved.XINF_API_KEY : undefined);
  if (!key) throw new Error("Sign in with xinf-login for this origin, or set XINF_API_KEY, then restart DeepSeek Harness.");
  return { serverName: "xinf", transport: "streamable-http", url: `${origin}/mcp/account`, headers: { Authorization: `Bearer ${key}` } };
}

export const skillsConfig = {
  providerName: "xinf",
  includeDefaultRoots: false,
  bundledSkillDir: fileURLToPath(new URL("../../plugins/xinf/skills/", import.meta.url)),
  watch: false,
};

export async function apply(ctx) {
  const config = mcpConfig();
  const [mcp, skills] = await Promise.all([
    import("@deepseek-ai/dsh-mcp-client"),
    import("@deepseek-ai/dsh-skill-filesystem"),
  ]);
  await ctx.plugin(skills, skillsConfig).await();
  await ctx.plugin(mcp, config).await();
}
