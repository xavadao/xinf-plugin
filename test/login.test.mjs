// MCP sign-in fallback: bin/xinf-login.mjs (device login) against a mock server. The key lands in
// ~/.xinf/credentials with mode 600 and is never printed; the Claude Code headers helper sends it only when present.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readJson, root } from "../scripts/lib.mjs";

const KEY = `xak_${"a".repeat(12)}_${"S".repeat(43)}`;

test("xinf-login: device code -> pending -> key saved 0600, never printed", async () => {
  let polls = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/oauth/device") {
        assert.match(body, /client_name=/);
        return res.end(JSON.stringify({ device_code: "dc", user_code: "BCDF-GHJK", verification_uri: "x", verification_uri_complete: "x?code=BCDF-GHJK", expires_in: 30, interval: 1 }));
      }
      assert.match(body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code/);
      if (++polls < 2) { res.statusCode = 400; return res.end(JSON.stringify({ error: "authorization_pending" })); }
      res.end(JSON.stringify({ access_token: KEY, token_type: "Bearer", scope: "inference account:read" }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "xinf-login-"));
  try {
    const out = await new Promise((resolve) => {
      const p = spawn(process.execPath, [path.join(root, "bin/xinf-login.mjs"), "--base-url", `http://127.0.0.1:${server.address().port}`, "--no-browser"], { env: { ...process.env, HOME: home, USERPROFILE: home } });
      let text = "";
      p.stdout.on("data", (d) => (text += d));
      p.stderr.on("data", (d) => (text += d));
      p.on("close", (code) => resolve({ code, text }));
    });
    assert.equal(out.code, 0, out.text);
    assert.ok(!out.text.includes(KEY), "the key must never be printed");
    assert.match(out.text, /BCDF-GHJK/);
    assert.match(out.text, /export XINF_API_KEY="\$\(sed -n/);
    const file = path.join(home, ".xinf", "credentials");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(`^XINF_API_KEY=${KEY}$`, "m"));
    // the Claude Code headers helper: the credentials file when the env var is unset, {} with neither
    const helper = readJson("plugins/xinf/.mcp.json").mcpServers.xinf.headersHelper;
    const run = (env) => JSON.parse(spawnSync("sh", ["-c", helper], { env, encoding: "utf8" }).stdout);
    assert.deepEqual(run({ PATH: process.env.PATH, HOME: home }), { Authorization: `Bearer ${KEY}` });
    assert.deepEqual(run({ PATH: process.env.PATH, HOME: path.join(home, "nope") }), {});
    assert.deepEqual(run({ PATH: process.env.PATH, HOME: home, XINF_API_KEY: "xk_live_x" }), { Authorization: "Bearer xk_live_x" });
  } finally {
    server.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
