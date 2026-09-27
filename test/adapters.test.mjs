import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { XinfPlugin, baseUrl } from "../.opencode/plugins/xinf.js";
import { main as addMcp, targets } from "../scripts/add-mcp.mjs";
import { BASE_URL, FORBIDDEN, LOCAL_KEY_SETUP, MCP_URL, REPO, SECRETS, pkg, read, readJson, root, textFiles } from "../scripts/lib.mjs";

const withEnv = async (vars, fn) => {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
};

test("validate.mjs passes on the repo", () => {
  const out = execFileSync(process.execPath, ["scripts/validate.mjs"], { cwd: root, encoding: "utf8" });
  assert.match(out, /Validated xinf plugin/);
});

test("validate.mjs rejects a secret, a supplier name and a drifted url", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-validate-"));
  try {
    fs.cpSync(root, tmp, { recursive: true, filter: (src) => !/node_modules|\.git$/.test(src) });
    const skill = path.join(tmp, "plugins/xinf/skills/using-xinf/SKILL.md");
    fs.appendFileSync(skill, `\nkey: xk_live_ab12cd34_${"Z".repeat(24)}\nServed on ${["Cloud", "flare"].join("")}.\n`);
    const cursor = path.join(tmp, ".cursor-plugin/plugin.json");
    fs.writeFileSync(cursor, fs.readFileSync(cursor, "utf8").replace(MCP_URL, "https://elsewhere.example/mcp"));
    const r = spawnSync(process.execPath, ["scripts/validate.mjs"], { cwd: tmp, encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /API key/);
    assert.match(r.stderr, /upstream supplier/);
    assert.match(r.stderr, /\.cursor-plugin\/plugin\.json MCP url/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("secret patterns ignore placeholders but catch real shapes", () => {
  const hits = (s) => SECRETS.filter(([, re]) => re.test(s)).map(([w]) => w);
  assert.deepEqual(hits("OPENAI_API_KEY=xk_live_..."), []);
  assert.deepEqual(hits('"Authorization": "Bearer ${XINF_API_KEY:-}"'), []);
  assert.deepEqual(hits('"Authorization": "Bearer xk_live_..."'), []);
  assert.ok(hits(`xk_live_ab12cd34_${"q".repeat(30)}`).includes("API key"));
  assert.ok(hits(`[${Array(64).fill(7).join(",")}]`).includes("Solana keypair array"));
  assert.ok(FORBIDDEN.test(["workers", " ai"].join("")));
  assert.ok(!FORBIDDEN.test("hedge fund knowledge"));
});

test("OpenCode adapter registers skills and the MCP server, keyless and keyed", async () => {
  await withEnv({ XINF_API_KEY: undefined, XINF_BASE_URL: undefined }, async () => {
    const config = {};
    await (await XinfPlugin({})).config(config);
    assert.ok(config.skills.paths.some((p) => p.endsWith("plugins/xinf/skills")));
    assert.deepEqual(config.mcp.xinf, { type: "remote", url: MCP_URL, enabled: true });
    assert.equal(config.provider, undefined);
  });
  await withEnv({ XINF_API_KEY: "xk_test_dummy", XINF_BASE_URL: "http://localhost:8791/" }, async () => {
    const config = {};
    await (await XinfPlugin({})).config(config);
    assert.equal(config.mcp.xinf.url, "http://localhost:8791/mcp/account");
    assert.equal(config.mcp.xinf.headers.Authorization, "Bearer xk_test_dummy");
    assert.equal(config.provider.xinf.options.baseURL, "http://localhost:8791/v1");
    assert.equal(config.provider.xinf.options.apiKey, "{env:XINF_API_KEY}");
  });
  assert.equal(baseUrl({}), BASE_URL);
  // a server already in opencode.json (written by the installer, maybe another origin) is kept; the key is added only
  // when that server is on XINF_BASE_URL's origin (a cloned project's opencode.json must not receive the key)
  await withEnv({ XINF_API_KEY: "xk_test_dummy", XINF_BASE_URL: "https://staging.example" }, async () => {
    const config = { mcp: { xinf: { type: "remote", url: "https://staging.example/mcp/account", enabled: true } } };
    await (await XinfPlugin({})).config(config);
    assert.equal(config.mcp.xinf.url, "https://staging.example/mcp/account");
    assert.equal(config.mcp.xinf.headers.Authorization, "Bearer xk_test_dummy");
  });
  await withEnv({ XINF_API_KEY: "xk_test_dummy", XINF_BASE_URL: undefined }, async () => {
    const config = { mcp: { xinf: { type: "remote", url: "https://evil.example/mcp/account", enabled: true } } };
    await (await XinfPlugin({})).config(config);
    assert.equal(config.mcp.xinf.url, "https://evil.example/mcp/account");
    assert.equal(config.mcp.xinf.headers?.Authorization, undefined);
  });
});

test("OpenCode installer writes the MCP server into opencode.json (the `opencode mcp` commands skip plugins), keeping other entries", () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-oc-"));
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-oc-src-"));
  try {
    // a throwaway git repo holding the adapter, as the clone source
    fs.mkdirSync(path.join(src, ".opencode/plugins"), { recursive: true });
    fs.copyFileSync(path.join(root, ".opencode/plugins/xinf.js"), path.join(src, ".opencode/plugins/xinf.js"));
    const git = (...a) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: src });
    git("init", "-q", "-b", "main"); git("add", "."); git("commit", "-qm", "x");
    const run = (extra) => spawnSync("sh", [path.join(root, "scripts/install-opencode.sh")], { env: { PATH: process.env.PATH, HOME: cfg, XDG_CONFIG_HOME: cfg, XINF_PLUGIN_SOURCE: src, ...extra }, encoding: "utf8" });
    let r = run({ XINF_BASE_URL: "https://staging.example/" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /opencode mcp auth xinf/);
    const file = path.join(cfg, "opencode/opencode.json");
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).mcp.xinf, { type: "remote", url: "https://staging.example/mcp/account", enabled: true });
    fs.writeFileSync(file, JSON.stringify({ theme: "x", mcp: { other: { type: "remote", url: "https://o.example/mcp" } } }));
    r = run({});
    assert.equal(r.status, 0, r.stderr);
    const merged = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(merged.theme, "x");
    assert.equal(merged.mcp.other.url, "https://o.example/mcp");
    assert.equal(merged.mcp.xinf.url, MCP_URL);
    assert.ok(fs.existsSync(path.join(cfg, "opencode/plugins/xinf.js")));
  } finally {
    fs.rmSync(cfg, { recursive: true, force: true });
    fs.rmSync(src, { recursive: true, force: true });
  }
});

test("OpenCode bootstrap is injected once", async () => {
  const hooks = await XinfPlugin({});
  const output = { messages: [{ info: { role: "user" }, parts: [{ type: "text", text: "hi" }] }] };
  await hooks["experimental.chat.messages.transform"]({}, output);
  await hooks["experimental.chat.messages.transform"]({}, output);
  const tagged = output.messages[0].parts.filter((p) => p.text.includes("<XINF_PLUGIN>"));
  assert.equal(tagged.length, 1);
  assert.match(tagged[0].text, /name: using-xinf/);
});

test("OpenCode installer clones the canonical repo and copies the adapter", () => {
  const installer = read("scripts/install-opencode.sh");
  assert.ok(installer.includes(`https://github.com/${REPO}.git`));
  assert.match(installer, /cp "\$plugin_root\/\.opencode\/plugins\/xinf\.js"/);
  assert.ok(fs.statSync(path.join(root, "scripts/install-opencode.sh")).mode & 0o111);
});

test("Pi adapter preserves other servers and references the key by name only", () => {
  const source = read(".pi/extensions/xinf.ts");
  assert.match(source, /\.\.\.config, mcpServers: \{ \.\.\.servers, xinf: xinfServer\(env, servers\.xinf\) \}/);
  // the origin sticks: XINF_BASE_URL once, later starts without it keep that origin
  assert.match(source, /if \(env\.XINF_BASE_URL\) return/);
  assert.ok(source.includes('url.replace(/\\/mcp\\/account$/, "")'), "keeps the origin already in mcp.json");
  assert.match(source, /bearerTokenEnv: "XINF_API_KEY"/);
  assert.ok(!/process\.env\.XINF_API_KEY\s*[,}]/.test(source), "the key value must never be written");
});

test("README exposes one pasteable bootstrap command per client", () => {
  const readme = read("README.md");
  // each row: | client | `one command` | what is left (the browser sign-in starts right after the command) |
  const clients = { "Claude Code terminal": "claude mcp login", "Codex terminal": "codex mcp login", "Cursor terminal": "- cursor --login", "Cursor chat": "/add-plugin", "Kimi chat": "/plugins install", "Gemini terminal": "&& gemini`", "OpenCode terminal": "opencode mcp auth xinf", "Pi terminal": "pi \"/mcp-auth xinf\"" };
  for (const [client, signin] of Object.entries(clients)) {
    const row = readme.split("\n").find((line) => line.startsWith(`| ${client} |`));
    assert.ok(row, `missing bootstrap row for ${client}`);
    const paste = row.split(" | ")[1];
    assert.equal((paste.match(/`/g) ?? []).length, 2, `${client} bootstrap must be one inline command`);
    assert.ok(paste.includes(REPO), `${client} must use ${REPO}`);
    assert.ok(paste.includes(signin), `${client} bootstrap must start the sign-in (${signin})`);
  }
  for (const client of ["Cline", "Windsurf", "Any OpenAI SDK"]) assert.ok(readme.includes(`| ${client} |`), `missing ${client}`);
  assert.match(readme, /claude plugin install xinf@xinf/);
  assert.match(readme, /codex plugin add xinf@xinf/);
});

test("every MCP adapter uses the canonical origin and the XINF_API_KEY bearer", () => {
  assert.equal(readJson("plugins/xinf/.mcp.json").mcpServers.xinf.url, "${user_config.base_url}/mcp/account");
  assert.equal(readJson("plugins/xinf/.claude-plugin/plugin.json").userConfig.base_url.default, BASE_URL);
  assert.equal(readJson(".mcp.json").mcpServers.xinf.url, `\${XINF_BASE_URL:-${BASE_URL}}/mcp/account`);
  assert.equal(readJson("plugins/xinf/.mcp.json").mcpServers.xinf.headers, undefined);
  assert.deepEqual(readJson("plugins/xinf/.codex-plugin/plugin.json").mcpServers.xinf.env_http_headers, { Authorization: "XINF_AUTHORIZATION" });
  assert.deepEqual(readJson(".cursor-plugin/plugin.json").mcpServers.xinf, { url: MCP_URL });
  assert.equal(readJson("kimi.plugin.json").mcpServers.xinf.auth, "oauth");
  assert.deepEqual(readJson("gemini-extension.json").mcpServers.xinf, { type: "http", url: `\${XINF_BASE_URL:-${BASE_URL}}/mcp/account`, oauth: { enabled: true } });
  assert.equal(readJson("gemini-extension.json").settings, undefined);
  assert.deepEqual(readJson("clients/windsurf/mcp_config.json").mcpServers.xinf, { serverUrl: MCP_URL });
  assert.equal(readJson(".mcp.json").mcpServers.xinf.headersHelper, readJson("plugins/xinf/.mcp.json").mcpServers.xinf.headersHelper);
  assert.equal(read("kimi.plugin.json"), read(".kimi-plugin/plugin.json"));
});

test("skills carry the rules that matter", () => {
  const skill = (name) => read(`plugins/xinf/skills/${name}/SKILL.md`);
  const x402 = skill("xinf-x402");
  for (const re of [/402/, /PAYMENT-REQUIRED/, /PAYMENT-SIGNATURE/, /PAYMENT-RESPONSE/, /USDC/, /Solana/, /X-Buyback-Token/, /0\.5%/, /list price/, /24 hours/,
    /Never auto-pay above the user's cap without explicit confirmation/, /x402 or the account\?/, /_meta\["x402\/payment"\]/,
    /wallet provider with spending policies/, /\/xinf:login/]) assert.match(x402, re);
  const using = skill("using-xinf");
  for (const s of ["list_models", "get_model_pricing", "get_balance", "/v1/chat/completions", "insufficient_balance", "XINF_API_KEY"]) assert.ok(using.includes(s), `using-xinf lacks ${s}`);
  assert.match(skill("xinf-media"), /generate_video/);
  assert.match(skill("xinf-media"), /\/media\/<id>/);
  assert.match(skill("xinf-models-and-pricing"), /Elite price/);
  assert.match(skill("xinf-models-and-pricing"), /No rewards/);
  assert.match(skill("xinf-buybacks"), /Noob/);
  assert.match(skill("xinf-buybacks"), /Elite/);
  assert.match(skill("xinf-media"), /24 hours/);
  assert.match(skill("xinf-buybacks"), /\$XINF/);
  assert.match(skill("xinf-buybacks"), /not give investment advice|Do not give investment advice/);
});

test("commands and the model-picker reference real tools", () => {
  const tools = ["list_models", "get_model_pricing", "chat", "generate_image", "generate_video", "generate_audio", "get_balance", "get_usage_summary"];
  for (const file of [...fs.readdirSync(path.join(root, "plugins/xinf/commands")).map((f) => `plugins/xinf/commands/${f}`), "plugins/xinf/agents/model-picker.md"]) {
    for (const m of read(file).matchAll(/mcp__plugin_xinf_xinf__([a-z_]+)/g)) assert.ok(tools.includes(m[1]), `${file}: unknown tool ${m[1]}`);
  }
  const picker = read("plugins/xinf/agents/model-picker.md");
  assert.ok(!/__(chat|generate_)/.test(picker), "model-picker must not have paid tools");
  const setup = read("plugins/xinf/commands/setup.md");
  for (const s of ["/xinf:login", "xinf-login.mjs", "API key for the account", "revocable", "XINF_API_KEY", "wallet provider with spending policies"]) assert.ok(setup.includes(s), `setup lacks ${s}`);
});

test("retarget rewrites both placeholders everywhere (dry run lists them)", () => {
  const out = execFileSync(process.execPath, ["scripts/retarget.mjs", "--dry-run", "--repo", "acme/xinf", "--base-url", "https://api.acme.example"], { cwd: root, encoding: "utf8" });
  for (const f of ["README.md", "plugins/xinf/.claude-plugin/plugin.json", ".mcp.json", ".cursor-plugin/plugin.json", "scripts/install-opencode.sh", "package.json"]) assert.ok(out.includes(f), `retarget misses ${f}`);
  const files = textFiles();
  assert.ok(files.includes("plugins/xinf/skills/xinf-x402/SKILL.md"));
});

test("the retired discount split is gone from every skill, command and doc", () => {
  const files = [
    "README.md", "AGENTS.md", "GEMINI.md",
    ...fs.readdirSync(path.join(root, "plugins/xinf/commands")).map((f) => `plugins/xinf/commands/${f}`),
    ...fs.readdirSync(path.join(root, "plugins/xinf/skills")).flatMap((d) => [`plugins/xinf/skills/${d}/SKILL.md`, `plugins/xinf/skills/${d}/agents/openai.yaml`]),
    "plugins/xinf/agents/model-picker.md",
  ];
  for (const f of files) {
    const src = read(f).replace(/the old discount split \(`X-Split`\) is gone, do not reintroduce it/, "");
    assert.ok(!/X-Split|discount split|liquidity book|your price|below list/i.test(src), `${f} still has split/discount language`);
  }
});

test("decision 105: no local private keys, no local x402 payer, anywhere", () => {
  const oldCli = ["xinf-", "x402"].join("");
  assert.equal(pkg.bin[oldCli], undefined);
  assert.equal(pkg.bin["xinf-login"], "bin/xinf-login.mjs");
  assert.ok(!fs.existsSync(path.join(root, `bin/${oldCli}.mjs`)));
  for (const d of ["@x402/fetch", "@x402/core", "@x402/svm", "@solana/kit", "undici"]) assert.equal(pkg.dependencies[d], undefined, `${d} must be gone`);
  for (const f of textFiles()) {
    const src = read(f);
    for (const [what, re] of LOCAL_KEY_SETUP) assert.ok(!re.test(src), `${f} references ${what}`);
  }
  // the scan catches the old setup
  const hits = (src) => LOCAL_KEY_SETUP.filter(([, re]) => re.test(src)).map(([w]) => w);
  assert.equal(hits(["export XINF_X402", "_KEYPAIR=~/.config/sol", "ana/a.json"].join("")).length, 2);
  assert.equal(hits(["solana-key", "gen new"].join("")).length, 1);
  // the device login stores only an account API key and says so
  const login = read("bin/xinf-login.mjs");
  assert.match(login, /API key for (the|your) account/);
  assert.match(login, /never a wallet key/);
  assert.ok(!/@solana|@x402|secretKey|privateKey/.test(login));
});

test("the SessionStart sign-in hint speaks only while Claude Code lists the server as needing sign-in", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-hint-"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-home-"));
  const run = (extra = {}) => {
    const env = { PATH: process.env.PATH, HOME: home, CLAUDE_CONFIG_DIR: dir, ...extra };
    const r = spawnSync("sh", [path.join(root, "plugins/xinf/hooks/signin-hint.sh")], { env, encoding: "utf8" });
    assert.equal(r.status, 0);
    return r.stdout;
  };
  assert.equal(run(), "", "no cache: silent");
  fs.writeFileSync(path.join(dir, "mcp-needs-auth-cache.json"), JSON.stringify({ "plugin:other:x": { timestamp: 1 } }));
  assert.equal(run(), "", "another server needs auth: silent");
  fs.writeFileSync(path.join(dir, "mcp-needs-auth-cache.json"), JSON.stringify({ "plugin:xinf:xinf": { timestamp: 1 } }));
  const out = JSON.parse(run());
  assert.match(out.systemMessage, /^Sign in to Xava Inference: run \/mcp, pick plugin:xinf:xinf, choose Authenticate/);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(run({ XINF_API_KEY: "xk_test_dummy" }), "", "a key is set: silent");
  fs.mkdirSync(path.join(home, ".xinf"));
  fs.writeFileSync(path.join(home, ".xinf/credentials"), "XINF_API_KEY=dummy\n");
  assert.equal(run(), "", "device login key saved: silent");
});

test("add-mcp adds the sign-in server to Cursor / Windsurf / Cline / Kimi configs, keeping other entries, with no key", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-add-"));
  const log = console.log;
  console.log = () => {};
  try {
    const env = { HOME: home };
    const cursor = path.join(home, ".cursor/mcp.json");
    fs.mkdirSync(path.dirname(cursor), { recursive: true });
    fs.writeFileSync(cursor, JSON.stringify({ mcpServers: { other: { url: "https://o.example/mcp" } }, extra: 1 }));
    assert.equal(addMcp(["cursor", "--base-url", "https://staging.example/"], env), 0);
    const c = JSON.parse(fs.readFileSync(cursor, "utf8"));
    assert.deepEqual(c.mcpServers.xinf, { url: "https://staging.example/mcp/account" });
    assert.equal(c.mcpServers.other.url, "https://o.example/mcp");
    assert.equal(c.extra, 1);
    assert.equal(addMcp(["windsurf"], env), 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".codeium/windsurf/mcp_config.json"), "utf8")).mcpServers.xinf, { serverUrl: MCP_URL });
    assert.equal(addMcp(["kimi"], { ...env, XINF_BASE_URL: "https://staging.example" }), 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".kimi-code/mcp.json"), "utf8")).mcpServers.xinf, { url: "https://staging.example/mcp/account" });
    const cline = targets("cline", env, "darwin");
    assert.match(cline.files[0], /Library\/Application Support\/Code\/User\/globalStorage\/saoudrizwan\.claude-dev\/settings\/cline_mcp_settings\.json$/);
    assert.deepEqual(cline.entry(MCP_URL), readJson("clients/cline/cline_mcp_settings.json").mcpServers.xinf);
    assert.equal(addMcp(["nope"], env), 2);
    // --login runs the Cursor CLI's own login when it is installed, and only then
    const bin = path.join(home, "bin");
    fs.mkdirSync(bin);
    const calls = [];
    const fake = (cmd, args) => { calls.push([cmd, ...args]); return { status: 0 }; };
    assert.equal(addMcp(["cursor", "--login"], { ...env, PATH: bin }, fake), 0);
    assert.equal(calls.length, 0, "no Cursor CLI on PATH: no login run");
    fs.writeFileSync(path.join(bin, "cursor-agent"), "#!/bin/sh\n", { mode: 0o755 });
    assert.equal(addMcp(["cursor", "--base-url", "https://staging.example", "--login"], { ...env, PATH: bin }, fake), 0);
    assert.deepEqual(calls, [["cursor-agent", "mcp", "login", "xinf"]]);
    fs.writeFileSync(cursor, "{ not json");
    assert.throws(() => addMcp(["cursor"], env), /not valid JSON/);
  } finally {
    console.log = log;
    fs.rmSync(home, { recursive: true, force: true });
  }
  assert.ok(read("scripts/add-mcp.mjs").includes(`"${BASE_URL}"`));
});
