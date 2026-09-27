---
description: Sign in to Xava Inference from this AI tool with the browser (no API key to paste), or with the device login.
argument-hint: "[device]"
---

Load `using-xinf` and help the user sign in. The MCP server is `<origin>/mcp/account` (`${user_config.base_url}` in Claude Code, default https://zinf.ai): it answers an unauthenticated connection with HTTP 401, which makes the AI tool open the browser. The user signs in on our site, reads the consent screen ("Allow <app> to use your Xava Inference account"), picks a daily spending cap (default $5 a day) and clicks Allow. The tool then receives a token by itself. The connection shows up in the dashboard under API keys > Connected apps, where the cap can be changed and the app disconnected.

Never ask the user to paste a key or token into this chat, never read or print `~/.xinf/credentials`, and never echo a secret. The user runs the commands that create secrets.

**Browser sign-in (preferred), per tool.** Tell the user the one step for the tool they are in:

- Claude Code: run `/mcp`, pick `plugin:xinf:xinf`, choose Authenticate; or, in a terminal, `claude mcp login plugin:xinf:xinf` (it opens the browser). (Without the plugin: `claude mcp add --transport http xinf <origin>/mcp/account && claude mcp login xinf`.) The origin is the plugin's `base_url` option (`/config`).
- Claude Desktop or claude.ai: Settings > Connectors > Add custom connector, URL `<origin>/mcp/account`, then Connect.
- Codex: `codex mcp login xinf` (a fresh `codex mcp add xinf --url <origin>/mcp/account` starts it by itself).
- Gemini CLI: it asks on start ("Authentication required for MCP Server: xinf ... continue?"): Enter. Later, or if dismissed: `/mcp auth xinf`.
- Cursor: in a terminal `cursor-agent mcp login xinf` (also `agent mcp login xinf`); in the app, Settings > MCP, click "Needs login" next to `xinf`. Not configured yet: `curl -fsSL https://raw.githubusercontent.com/xavadao/xinf-plugin/main/scripts/add-mcp.mjs | node --input-type=module - cursor`.
- OpenCode: `opencode mcp auth xinf` (the installer puts the server in `~/.config/opencode/opencode.json`).
- Pi: `/mcp-auth xinf` (or `pi "/mcp-auth xinf"` from a terminal).
- Kimi Code: `/mcp-config login plugin-xinf:xinf` (installed as a plugin) or `/mcp-config login xinf` (added to `~/.kimi-code/mcp.json`); Kimi must be signed in, the login runs through its model.
- Cline: MCP Servers panel > `xinf` > Authenticate.
- Windsurf: sign in to `xinf` from its MCP servers panel; if it offers no sign-in, use the device login below.

**Device login (any tool, and `$ARGUMENTS` = device).** For tools that cannot sign in themselves, or headless machines:

1. The user runs, in their own terminal (Node 18 or later; from a clone of the plugin repository, or download the one file first):
   `node bin/xinf-login.mjs` (add `--base-url https://zinf.dev` for staging)
   or `curl -fsSLo xinf-login.mjs https://raw.githubusercontent.com/xavadao/xinf-plugin/main/bin/xinf-login.mjs && node xinf-login.mjs`
2. It opens the browser at `/login/device` with a code. The user checks the code matches, picks the daily cap and clicks Allow.
3. It saves an API key for the account (scoped to this connection and its daily cap) to `~/.xinf/credentials` (only the user can read it) and prints the line to load it. It is an account key, revocable in the dashboard under API keys > Connected apps, never a wallet key:
   `export XINF_API_KEY="$(sed -n 's/^XINF_API_KEY=//p' ~/.xinf/credentials)"`
   Claude Code picks the file up by itself (the plugin's header helper reads it). Codex reads `XINF_AUTHORIZATION` instead: `export XINF_AUTHORIZATION="Bearer $XINF_API_KEY"`.
4. Restart the AI tool.

Finish by running the `get_balance` tool (or `/xinf:balance`) to confirm the account is connected. Images, video and audio are then paid from the balance, within the daily cap.
