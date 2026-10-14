import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mcpConfig, skillsConfig } from "../clients/deepseek/index.mjs";
import { main as addMcp, targets } from "../scripts/add-mcp.mjs";
import { BASE_URL, MCP_URL, root } from "../scripts/lib.mjs";

test("Oh My Pi configuration overrides the plugin server, preserves other servers and persists the site", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-omp-"));
  try {
    const file = targets("omp", { HOME: home }).files[0];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ mcpServers: { other: { url: "https://other.example/mcp" } }, disabledServers: ["other"] }));
    assert.equal(addMcp(["omp", "--base-url", "https://staging.example/"], { HOME: home }), 0);
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(config.mcpServers["xinf:xinf"], { type: "http", url: "https://staging.example/mcp/account" });
    assert.equal(config.mcpServers.other.url, "https://other.example/mcp");
    assert.deepEqual(config.disabledServers, ["other"]);
    assert.equal(targets("omp", { HOME: home, OMP_PROFILE: "work", PI_CODING_AGENT_DIR: "/ignored" }).files[0], path.join(home, ".omp/profiles/work/agent/mcp.json"));
    assert.equal(targets("omp", { HOME: home, PI_CODING_AGENT_DIR: path.join(home, "custom") }).files[0], path.join(home, "custom/mcp.json"));
    assert.equal(targets("omp", { HOME: home, OMP_PROFILE: "default", PI_PROFILE: "work" }).files[0], file);
    assert.throws(() => targets("omp", { HOME: home, OMP_PROFILE: "../escape" }), /Invalid/);
    fs.writeFileSync(file, "not json");
    assert.throws(() => addMcp(["omp"], { HOME: home }), /not valid JSON/);
    assert.equal(fs.readFileSync(file, "utf8"), "not json");
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("DeepSeek uses only account credentials for their issuing origin and the canonical skills", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-dsh-"));
  try {
    assert.throws(() => mcpConfig({}, home), /Sign in/);
    assert.equal(mcpConfig({ XINF_API_KEY: "test-key" }, home).url, MCP_URL);
    fs.mkdirSync(path.join(home, ".xinf"));
    const credentials = path.join(home, ".xinf/credentials");
    fs.writeFileSync(credentials, "XINF_API_KEY=device-key\nXINF_BASE_URL=https://staging.example\n");
    assert.deepEqual(mcpConfig({}, home), { serverName: "xinf", transport: "streamable-http", url: "https://staging.example/mcp/account", headers: { Authorization: "Bearer device-key" } });
    assert.throws(() => mcpConfig({ XINF_BASE_URL: "https://another.example" }, home), /Sign in/);
    assert.equal(mcpConfig({ XINF_BASE_URL: "http://localhost:8791/", XINF_API_KEY: "explicit-key" }, home).headers.Authorization, "Bearer explicit-key");
    for (const origin of ["http://remote.example", "https://user@host.example", "https://host.example/path", "https://host.example?query=1"]) {
      assert.throws(() => mcpConfig({ XINF_BASE_URL: origin, XINF_API_KEY: "explicit-key" }, home), /HTTPS origin/);
    }
    fs.writeFileSync(credentials, "XINF_API_KEY=production-key\n");
    assert.equal(mcpConfig({}, home).url, `${BASE_URL}/mcp/account`);
    assert.equal(path.resolve(skillsConfig.bundledSkillDir), path.join(root, "plugins/xinf/skills"));
    assert.equal(skillsConfig.includeDefaultRoots, false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
