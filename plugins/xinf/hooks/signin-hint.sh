#!/bin/sh
# SessionStart hook (Claude Code). Prints one sign-in line, only while Claude Code itself lists this plugin's MCP
# server as needing sign-in, and nothing once it is signed in.
#
# Claude Code does not open the browser by itself when an MCP server answers 401: it marks the server "needs
# authentication" and records it in its needs-auth cache. That cache is the cheapest honest signal: no network call
# (a request without a token always gets 401, so it cannot tell signed-in from signed-out), no token or keychain read.
# The entry disappears as soon as the sign-in completes, which makes this hook silent from then on.
#
# Never blocks (no network, exits 0 on every path), never reads or prints a secret (it only checks that a key file
# exists, and matches a server name in the cache).

# A key (API key or the device login's account key) is sent by the header helper instead of OAuth: nothing to say.
[ -n "${XINF_API_KEY:-}" ] && exit 0
[ -s "$HOME/.xinf/credentials" ] && exit 0

cache="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/mcp-needs-auth-cache.json"
[ -r "$cache" ] || exit 0
grep -q '"plugin:xinf:xinf"' "$cache" 2>/dev/null || exit 0

line='Sign in to Xava Inference: run /mcp, pick plugin:xinf:xinf, choose Authenticate (your browser opens; click Allow). Or in a terminal: claude mcp login plugin:xinf:xinf'
ctx='The xinf MCP server (Xava Inference) is not signed in yet, so its tools are unavailable. If the user asks for Xava Inference, tell them to run /mcp, pick plugin:xinf:xinf and choose Authenticate, or run claude mcp login plugin:xinf:xinf in a terminal. Never ask for a key in chat.'
printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$line" "$ctx"
exit 0
