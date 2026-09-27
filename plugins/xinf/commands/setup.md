---
description: Set up Xava Inference: sign in from this AI tool (recommended), the device login, or an API key.
argument-hint: "[signin|device|key]"
---

Load `using-xinf` and walk the user through setup. Recommend signing in unless `$ARGUMENTS` asks for another path. All three connect the same account: one balance, usage history, Reward Status and the account's buyback token.

Never ask the user to paste a key or token into this chat, never read or print `~/.xinf/credentials`, and never echo a secret. Never create, read or store a private key, wallet file or seed phrase: this plugin does not use one.

**Sign in (recommended)**

Run `/xinf:login`: the tool opens the browser, the user signs in (Google, X, email, passkey or a Solana wallet in the browser), picks a daily spending cap (default $5 a day) and clicks Allow. Every tool, images, video and audio included, then spends the account balance within that cap. The connection shows up in the dashboard under API keys > Connected apps, where the cap is changed or the app revoked. Top up by card or USDC at `${XINF_BASE_URL:-https://zinf.ai}/dashboard`.

**Device login (tools that cannot sign in themselves)**

`/xinf:login device`: the user runs `node bin/xinf-login.mjs` in their own terminal, approves in the browser, and it saves an API key for the account (with the daily cap they picked) to `~/.xinf/credentials`, readable only by them. It is an account key, revocable any time in the dashboard (API keys > Connected apps), not a wallet key.

**API key (your own code, CI)**

1. Create a key in the dashboard at `${XINF_BASE_URL:-https://zinf.ai}/dashboard/keys`. The key is shown once.
2. The user adds it to the shell profile (`~/.zshrc`, `~/.bashrc`) or a secret manager that exports it:
   `export XINF_API_KEY=xk_live_...`
3. Optional, for staging or a local server: in Claude Code set the plugin's `base_url` option (`/config`, or reinstall with `--config base_url=https://zinf.dev`); elsewhere `export XINF_BASE_URL=https://zinf.dev` (or `http://localhost:8791`).
4. Restart the coding agent so the MCP server picks up the header.

For code, the same key works with any OpenAI SDK: `OPENAI_BASE_URL=$XINF_BASE_URL/v1`, `OPENAI_API_KEY=$XINF_API_KEY`.

Optional for any path: pick a buyback token and link a wallet for Elite Reward Status on the dashboard Rewards page (`/dashboard/rewards`); see `xinf-buybacks`.

**x402?** Pay-per-call with x402 is for agents that already have a wallet provider with spending policies (a hosted or custodial agent wallet); there is nothing to set up in this plugin for it. Load `xinf-x402` if the user asks.

Finish by running `get_balance` (or `/xinf:balance`) to confirm the account is connected, and check which variables are set (names only, never values), for example `printenv | cut -d= -f1 | grep '^XINF_'`.
