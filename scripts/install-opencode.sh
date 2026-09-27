#!/bin/sh
# Install the Xava Inference plugin for OpenCode (global). Re-running updates it.
#   curl -fsSL https://raw.githubusercontent.com/xavadao/xinf-plugin/main/scripts/install-opencode.sh | sh
#   ... | XINF_BASE_URL=https://zinf.dev sh      (another origin, e.g. staging)
# Then: opencode mcp auth xinf (opens the browser sign-in).
set -eu

config_root="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
plugin_root="$config_root/xinf-plugin"
source_url="${XINF_PLUGIN_SOURCE:-https://github.com/xavadao/xinf-plugin.git}"
ref="${XINF_PLUGIN_REF:-main}"
origin="$(printf '%s' "${XINF_BASE_URL:-https://zinf.ai}" | sed 's#/*$##')"

if [ -d "$plugin_root/.git" ]; then
  git -C "$plugin_root" pull --ff-only
else
  git clone --depth 1 --branch "$ref" "$source_url" "$plugin_root"
fi

mkdir -p "$config_root/plugins"
cp "$plugin_root/.opencode/plugins/xinf.js" "$config_root/plugins/xinf.js"

# The MCP server also goes into the global opencode.json: `opencode mcp auth` and `opencode mcp list` read the config
# files without running plugins, so a server added only by the plugin is invisible to them. Other entries are kept.
config="$config_root/opencode.json"
if [ ! -e "$config" ] && [ ! -e "$config_root/opencode.jsonc" ]; then
  printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": {\n    "xinf": { "type": "remote", "url": "%s/mcp/account", "enabled": true }\n  }\n}\n' "$origin" > "$config"
elif [ -e "$config" ] && command -v node >/dev/null 2>&1; then
  XINF_CONFIG="$config" XINF_ORIGIN="$origin" node -e '
    const fs = require("fs"); const f = process.env.XINF_CONFIG;
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    c.mcp = { ...(c.mcp || {}), xinf: { ...((c.mcp || {}).xinf || {}), type: "remote", url: process.env.XINF_ORIGIN + "/mcp/account", enabled: true } };
    fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
  '
else
  printf 'Add this to the "mcp" block of your OpenCode config (%s):\n  "xinf": { "type": "remote", "url": "%s/mcp/account", "enabled": true }\n' "$config_root" "$origin"
fi

printf '%s\n' "Xava Inference installed for OpenCode ($origin)."
if [ -z "${XINF_API_KEY:-}" ]; then
  printf '%s\n' 'Sign in with: opencode mcp auth xinf (opens the browser; the account balance, within the daily cap you pick).'
fi
