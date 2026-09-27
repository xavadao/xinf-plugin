# Xava Inference plugin

Give your coding agent every model. The plugin connects your agent to the Xava Inference MCP server at `https://zinf.ai/mcp/account`: text, image, video, audio and embedding models from many providers on one account, at the model makers' list prices (Elite prices with Elite Reward Status). Sign in once from your agent and it spends your balance within the daily cap you set. Zero data retention: prompts and replies are never stored, and generated files are deleted 24 hours after creation.

## One-command bootstrap

Paste the command for your client as one line. The Claude Code and Codex lines end by opening your browser to [sign in](#sign-in): sign in, pick a daily cap, click Allow, done. The other clients show their sign-in prompt after installing (`/xinf:login` walks you through it). Without signing in, the catalog and pricing tools still work.

| Client | Paste once |
| --- | --- |
| Claude Code terminal | `claude plugin marketplace add xavadao/xinf-plugin && claude plugin install xinf@xinf --config base_url=https://zinf.ai && claude mcp login plugin:xinf:xinf` |
| Codex terminal | `codex plugin marketplace add xavadao/xinf-plugin && codex plugin add xinf@xinf && codex mcp login xinf` |
| Cursor chat | `/add-plugin https://github.com/xavadao/xinf-plugin` |
| Kimi chat | `/plugins install https://github.com/xavadao/xinf-plugin` |
| Gemini terminal | `gemini extensions install https://github.com/xavadao/xinf-plugin --consent` |
| OpenCode terminal | `curl -fsSL https://raw.githubusercontent.com/xavadao/xinf-plugin/main/scripts/install-opencode.sh \| sh` |
| Pi terminal | `pi install git:github.com/xavadao/xinf-plugin@v0.1.0` |

Clients without plugins take an MCP config block:

| Client | Config |
| --- | --- |
| Cline | [`clients/cline/cline_mcp_settings.json`](clients/cline/cline_mcp_settings.json): MCP Servers > Configure, paste, then Authenticate (browser sign-in) |
| Windsurf | [`clients/windsurf/mcp_config.json`](clients/windsurf/mcp_config.json): merge into `~/.codeium/windsurf/mcp_config.json` (newer builds: `~/.config/devin/mcp_config.json`) |
| Any OpenAI SDK | [`clients/openai-sdk/.env.example`](clients/openai-sdk/.env.example): `OPENAI_BASE_URL` + `OPENAI_API_KEY` |

No key is needed: see [Sign in](#sign-in). A key, when you prefer one, is read from the `XINF_API_KEY` environment variable; nothing here stores it. Claude Code takes the origin as the plugin's `base_url` option (`--config base_url=https://zinf.dev` at install, or `/config` later; the default is production); the install commands on the site's /agents page already pass that site's own origin. OpenCode, Pi and a clone of this repository read `XINF_BASE_URL` instead, for example `http://localhost:8791`. Codex sends the header only when `XINF_AUTHORIZATION` is set (`export XINF_AUTHORIZATION="Bearer $XINF_API_KEY"`), and signs in with the browser otherwise.

## Sign in

After installing, sign in with your browser: no key to create or paste. The plugin connects to `https://zinf.ai/mcp/account`, which answers an unauthenticated connection with HTTP 401 and the MCP authorization metadata, so the tool opens our sign-in page (Google, X, email, passkey or a Solana wallet), then a consent screen: "Allow <app> to use your Xava Inference account", the permissions, and a daily spending cap (default $5 a day). Click Allow and the tool gets its own token, refreshed automatically. Every signed-in tool is listed in the dashboard under API keys > Connected apps, where you change its cap or revoke it. `/xinf:login` walks you through it.

| Client | After installing (or adding the server URL above) |
| --- | --- |
| Claude Code | automatic: the install ends with `claude mcp login plugin:xinf:xinf`, which opens the browser. Later: `/mcp`, pick `plugin:xinf:xinf`, Authenticate. MCP only: `claude mcp add --transport http xinf https://zinf.ai/mcp/account && claude mcp login xinf` |
| Claude Desktop, claude.ai | Settings > Connectors > Add custom connector, URL `https://zinf.ai/mcp/account`, Connect |
| Cursor | Settings > MCP: `xinf` shows "Needs login", click it (CLI: `agent mcp login xinf`) |
| Codex | automatic: the install ends with `codex mcp login xinf` (a fresh `codex mcp add xinf --url https://zinf.ai/mcp/account` also opens the browser by itself) |
| Gemini CLI | opens the browser when it first connects; otherwise `/mcp auth xinf` |
| OpenCode | `opencode mcp auth xinf` |
| Cline | MCP Servers > `xinf` > Authenticate |
| Kimi | `kimi mcp auth xinf` (the plugin sets `"auth": "oauth"`; by hand: `kimi mcp add --transport http --auth oauth xinf https://zinf.ai/mcp/account`) |
| Pi | `/mcp-auth xinf` |
| Windsurf | device login (below), then `XINF_API_KEY` in the environment: its MCP sign-in is not confirmed with us yet |

**Device login**, for any tool that cannot sign in itself or a machine without a browser: `node bin/xinf-login.mjs` (Node 18+, no dependencies; `--base-url` for another origin). It shows a code, opens `/login/device`, and after you pick the daily cap and click Allow it writes an API key for your account, scoped to that connection and cap, to `~/.xinf/credentials` (mode 600, only you can read it). It is an account key, revocable any time in the dashboard under API keys > Connected apps, never a wallet key. It never prints the key; it prints the line that loads it: `export XINF_API_KEY="$(sed -n 's/^XINF_API_KEY=//p' ~/.xinf/credentials)"`. Claude Code reads that file by itself.

**Claude Code sign-in reminder.** Claude Code does not open the browser by itself when a server needs sign-in; it shows "MCP server needs authentication · run /mcp". The plugin's SessionStart hook (`plugins/xinf/hooks/signin-hint.sh`) adds one specific line, "Sign in to Xava Inference: run /mcp, pick plugin:xinf:xinf, choose Authenticate", only while Claude Code's own needs-auth list names this server, and says nothing once signed in or when a key is set. It makes no network call and reads no token.

**How the header is sent.** Each manifest sends `Authorization` only when you have a key, so the browser sign-in takes over otherwise: Claude Code uses a `headersHelper` that prints the header from `XINF_API_KEY` or `~/.xinf/credentials` and `{}` when neither exists (a static header would turn its sign-in off); Codex uses `env_http_headers` (skipped when `XINF_AUTHORIZATION` is unset); OpenCode and Pi add the header only when `XINF_API_KEY` is set (Pi otherwise uses `"auth": "oauth"`); Cursor, Cline and Kimi use sign-in only. Gemini and Windsurf send `Bearer ${XINF_API_KEY}`, which is `Bearer ` when unset: the server treats an empty bearer, or an unexpanded `${...}` placeholder, as no credential and answers with the sign-in challenge.

`https://zinf.ai/mcp` (without `/account`) stays open without a credential for the catalog tools and x402 media (see [x402](#x402)): only the account tools (`chat`, `get_balance`, `get_usage_summary`) answer 401 there.

## Use Claude Code with your Xava key

No plugin needed: point the agent itself at Xava Inference and every request runs on our models at list price, from your balance. Use a dashboard key or the device login's (`XINF_API_KEY`).

```sh
# Claude Code (Anthropic Messages API)
export ANTHROPIC_BASE_URL=https://zinf.ai        # staging: https://zinf.dev
export ANTHROPIC_AUTH_TOKEN=$XINF_API_KEY        # or ANTHROPIC_API_KEY
export ANTHROPIC_MODEL=claude-sonnet-4-6         # optional; Claude Code's own ids (dated, -latest) all map to our catalog
claude
```

```toml
# Codex (OpenAI Responses API), ~/.codex/config.toml, then: codex --profile xinf
[model_providers.xinf]
name = "Xava Inference"
base_url = "https://zinf.ai/v1"
env_key = "XINF_API_KEY"
wire_api = "responses"

[profiles.xinf]
model_provider = "xinf"
model = "openai/gpt-5.4-mini"
```

```sh
# Gemini CLI (Gemini API); choose "Use Gemini API key" at the sign-in prompt
export GOOGLE_GEMINI_BASE_URL=https://zinf.ai
export GEMINI_API_KEY=$XINF_API_KEY
gemini -m gemini-2.5-flash
```

Streaming, tool use, images and PDFs, thinking and prompt caching work as they do natively. Token-count endpoints return free estimates. Details: `https://zinf.ai/docs/agents#native`.

## What you get

| | |
| --- | --- |
| MCP tools | `list_models`, `get_model_pricing` (no sign-in), `chat`, `get_balance`, `get_usage_summary`, `generate_image`, `generate_video`, `generate_audio` (signed in or a key: paid from the balance within the daily cap) |
| Skills | `using-xinf` (pick a model, base URL, keys, balance, errors), `xinf-x402` (what x402 is, for agents that already have a wallet provider with spending policies; quote, price, `X-Buyback-Token`), `xinf-media` (images, video, audio, their URLs and 24 h expiry), `xinf-models-and-pricing` (list price, Elite price, "No rewards" models), `xinf-buybacks` (the buyback token, Reward Status Noob/Elite, $XINF) |
| Commands | `/xinf:login`, `/xinf:setup`, `/xinf:models`, `/xinf:balance`, `/xinf:generate-image`, `/xinf:usage` |
| Subagent | `model-picker`: recommends a model for a task by price and capability, read-only |
| CLI | `bin/xinf-login.mjs` (bin name xinf-login): the device login; stores only an account API key, never a wallet key |

## x402

x402 is a protocol for paying per HTTP request: a media endpoint called without a credential answers `402 Payment Required` with a `PAYMENT-REQUIRED` header holding the exact USDC amount for that request (the model's list price, on Solana), and the client retries the identical request with a signed payment in `PAYMENT-SIGNATURE` (`X-PAYMENT` also works); the result carries a `PAYMENT-RESPONSE` receipt. It works on `POST /v1/images/generations`, `POST /v1/media/generations` and the media tools of the open `/mcp` endpoint (retry with `_meta["x402/payment"]`, receipt in `_meta["x402/payment-response"]`). 0.5% of each payment buys back $XINF, or the eligible token named in `X-Buyback-Token`, out of our margin.

It is meant for agents that **already have a wallet provider with spending policies**, such as a hosted or custodial agent wallet that signs within per-payment and daily limits. This plugin never creates, stores or reads a private key or wallet file, and has no local payer. Coding agents should sign in instead: the account covers media too, within the daily cap. The `xinf-x402` skill documents the flow and budget rules.

## Repository layout

- `plugins/xinf/` is the canonical bundle (Claude Code and Codex): `.mcp.json`, `skills/`, `commands/`, `agents/`.
- Root manifests adapt that bundle for Cursor, Kimi, Gemini, OpenCode and Pi; `clients/` holds config blocks for MCP-only clients.
- `scripts/validate.mjs` checks manifest consistency, skill frontmatter, and that no secret or upstream supplier name is committed.
- `bin/xinf-login.mjs` is the device login (bin name xinf-login), exposed through `package.json` `bin`; its test is `test/login.test.mjs`.
- `package.json` `xinf.repo` and `xinf.baseUrl` are the two placeholders. Change them everywhere with `node scripts/retarget.mjs --repo <owner/name> --base-url <https://origin>`.

## Development

```bash
pnpm install
pnpm test           # adapters + device login (mock server, no network)
pnpm validate
claude plugin validate .
```

Against a local server (`pnpm --filter @xava/web dev` in the site repo, port 8791), install from this checkout:

```bash
claude plugin marketplace add "$PWD" && claude plugin install xinf@xinf --config base_url=http://localhost:8791 && claude mcp login plugin:xinf:xinf
```

`claude --plugin-dir ./plugins/xinf` loads it for one session instead; it then uses the `base_url` default (production) unless you set it in `/config`.
