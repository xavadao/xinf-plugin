// Shared by validate.mjs, retarget.mjs and the tests: the repo root, the two placeholders, and the file walk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
/** The GitHub `owner/name` the plugin is published at, and the production origin. Change both with retarget.mjs. */
export const REPO = pkg.xinf.repo;
export const BASE_URL = pkg.xinf.baseUrl;
/** The MCP endpoint the plugin connects to: /mcp/account refuses a keyless connection with 401 so every client starts
 *  the browser sign-in (MCP OAuth). The keyless catalog + x402 endpoint is /mcp. */
export const MCP_URL = `${BASE_URL}/mcp/account`;

const SKIP_DIRS = new Set([".git", "node_modules"]);
const TEXT = /\.(json|md|mjs|js|ts|sh|yaml|yml|toml|example|txt)$|^(LICENSE|NOTICE|\.gitignore|\.env\.example)$/;

/** Every committed-looking text file, relative to root. */
export function textFiles(dir = root) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...textFiles(full));
    else if (TEXT.test(entry.name)) out.push(path.relative(root, full));
  }
  return out.sort();
}

export const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
export const readJson = (relative) => JSON.parse(read(relative));

/**
 * Words public copy must never contain (the service never names the infrastructure it runs on or its upstream
 * suppliers). Built from fragments so this file itself stays clean under its own scan.
 */
export const FORBIDDEN = new RegExp(
  [
    ["cloud", "flare"].join(""),
    ["workers", "[\\s-]?", "ai"].join(""),
    ["ai", "[\\s-]?", "gateway"].join(""),
    ["@", "cf/"].join(""),
    ["\\bneu", "rons?\\b"].join(""),
    ["\\bthe ", "edge\\b"].join(""),
    ["edge ", "network"].join(""),
    ["unified ", "billing"].join(""),
    ["wran", "gler"].join(""),
  ].join("|"),
  "i",
);

/** Secret shapes. Placeholders such as `xk_live_...` do not match. */
export const SECRETS = [
  ["API key", /\bxk_(?:live|test)_[A-Za-z0-9]{6,}_[A-Za-z0-9_-]{8,}/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Solana keypair array", /\[\s*(?:\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/],
  ["base58 secret key", /(?<![A-Za-z0-9])[1-9A-HJ-NP-Za-km-z]{86,88}(?![A-Za-z0-9])/],
  ["provider secret", /\b(?:sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/],
  ["literal bearer token", /Bearer\s+(?!\$|xk_live_\.\.\.|<)[A-Za-z0-9._-]{20,}/],
];

/**
 * Owner decision 105: the plugin never references, creates or reads a local private key. These are the shapes of local
 * wallet setup (the removed local x402 payer, generating or funding a wallet on this machine, signing from key bytes).
 * Built from fragments so this file stays clean under its own scan.
 */
export const LOCAL_KEY_SETUP = [
  ["the removed local x402 payer's variables", new RegExp(["XINF_", "X402_"].join(""))],
  ["the removed local x402 payer CLI", new RegExp(["xinf-x402 (?:quote|pay|session|--help)|bin/xinf-", "x402"].join(""))],
  ["generating a local wallet", new RegExp(["solana-", "keygen|keypair\\.json|\\.config/", "solana"].join(""), "i")],
  ["signing from local key bytes", new RegExp(["createKeyPairSigner", "From(?:Bytes|PrivateKeyBytes)|walletSecret", "Bytes"].join(""))],
  ["funding a local wallet", new RegExp(["fund (?:a|the|your) ", "wallet|faucet\\.", "circle"].join(""), "i")],
];
