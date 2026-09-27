#!/usr/bin/env node
// xinf-login: sign in to Xava Inference from a terminal, for AI tools that cannot run the MCP browser sign-in
// themselves. No dependencies, no npx: Node 18+ only.
//
//   node bin/xinf-login.mjs [--base-url https://zinf.ai] [--name "my laptop"] [--no-browser]
//
// 1. asks the server for a device code (POST /oauth/device)
// 2. opens <origin>/login/device?code=XXXX-XXXX in the browser: sign in, check the code, pick a daily cap, Allow
// 3. polls until approved, then writes an API key for the account (scoped to this connection and its daily cap) to
//    ~/.xinf/credentials (mode 600). It is an account key, never a wallet key.
// 4. prints the line that loads it into XINF_API_KEY. The key itself is never printed, so it never lands in a
//    terminal log, a CI log or an agent transcript. Revoke it any time in the dashboard: API keys > Connected apps.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_BASE_URL = "https://zinf.ai";

function args(argv) {
  const out = { baseUrl: process.env.XINF_BASE_URL || DEFAULT_BASE_URL, name: `xinf-login on ${os.hostname()}`, browser: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a.startsWith("--base-url=")) out.baseUrl = a.slice(11);
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--no-browser") out.browser = false;
    else if (a === "-h" || a === "--help") out.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  out.baseUrl = String(out.baseUrl || "").replace(/\/+$/, "");
  if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(out.baseUrl)) throw new Error(`base URL must be https (or http://localhost): ${out.baseUrl}`);
  return out;
}

function openBrowser(url) {
  const [cmd, argv] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    const p = spawn(cmd, argv, { stdio: "ignore", detached: true });
    p.on("error", () => {});
    p.unref();
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams(body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export function credentialsPath(home = os.homedir()) {
  return path.join(home, ".xinf", "credentials");
}

/** Write (or replace) the credentials file, owner-only. Other XINF_* lines in it are kept. */
export function saveCredentials(file, key, baseUrl) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let keep = [];
  try {
    keep = fs.readFileSync(file, "utf8").split("\n").filter((l) => l && !/^(#|XINF_API_KEY=|XINF_BASE_URL=)/.test(l));
  } catch {}
  const lines = [
    `# Xava Inference account API key (this connection only, daily cap) from xinf-login (${new Date().toISOString().slice(0, 10)}). Revoke: ${baseUrl}/dashboard/keys#apps`,
    `XINF_API_KEY=${key}`,
    ...(baseUrl !== DEFAULT_BASE_URL ? [`XINF_BASE_URL=${baseUrl}`] : []),
    ...keep,
  ];
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${lines.join("\n")}\n`, { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.help) {
    console.log("Usage: node xinf-login.mjs [--base-url URL] [--name NAME] [--no-browser]\nSigns in through the browser and saves an API key for your account (revocable in the dashboard) to ~/.xinf/credentials (mode 600).");
    return;
  }
  const start = await post(`${o.baseUrl}/oauth/device`, { client_name: o.name.slice(0, 80) });
  if (start.status !== 200 || !start.json.device_code) throw new Error(`could not start the login (HTTP ${start.status}) at ${o.baseUrl}`);
  const { device_code, user_code, verification_uri_complete, verification_uri } = start.json;
  let interval = Math.max(1, Number(start.json.interval) || 5) * 1000;
  const deadline = Date.now() + (Number(start.json.expires_in) || 600) * 1000;
  console.log(`\nConfirm this code in your browser: ${user_code}\n  ${verification_uri_complete || verification_uri}\n`);
  if (o.browser) openBrowser(verification_uri_complete || verification_uri);
  process.stdout.write("Waiting for approval");
  while (Date.now() < deadline) {
    await sleep(interval);
    const r = await post(`${o.baseUrl}/oauth/token`, { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code });
    if (r.status === 200 && r.json.access_token) {
      const file = credentialsPath();
      saveCredentials(file, r.json.access_token, o.baseUrl);
      const shown = file.startsWith(os.homedir()) ? `~${file.slice(os.homedir().length)}` : file;
      console.log(`\n\nSigned in. API key for your account saved to ${shown} (only you can read it).`);
      console.log("Load it into your shell (add this line to ~/.zshrc or ~/.bashrc to keep it):\n");
      console.log(`  export XINF_API_KEY="$(sed -n 's/^XINF_API_KEY=//p' ${shown})"`);
      if (o.baseUrl !== DEFAULT_BASE_URL) console.log(`  export XINF_BASE_URL=${o.baseUrl}`);
      console.log("\nThen restart your AI tool. Change its daily cap or revoke it in the dashboard: API keys > Connected apps.");
      return;
    }
    const e = r.json.error;
    if (e === "authorization_pending") process.stdout.write(".");
    else if (e === "slow_down") interval += 5000;
    else if (e === "access_denied") throw new Error("the login was denied in the browser");
    else if (e === "expired_token") break;
    else throw new Error(`login failed: ${e || `HTTP ${r.status}`}`);
  }
  throw new Error("the code expired before it was approved; run xinf-login again");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("xinf-login.mjs")) {
  main().catch((e) => {
    console.error(`\nxinf-login: ${e.message}`);
    process.exit(1);
  });
}
