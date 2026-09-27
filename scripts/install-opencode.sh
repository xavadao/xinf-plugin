#!/bin/sh
# Install the Xava Inference plugin for OpenCode (global). Re-running updates it.
set -eu

config_root="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
plugin_root="$config_root/xinf-plugin"
source_url="${XINF_PLUGIN_SOURCE:-https://github.com/xavadao/xinf-plugin.git}"
ref="${XINF_PLUGIN_REF:-main}"

if [ -d "$plugin_root/.git" ]; then
  git -C "$plugin_root" pull --ff-only
else
  git clone --depth 1 --branch "$ref" "$source_url" "$plugin_root"
fi

mkdir -p "$config_root/plugins"
cp "$plugin_root/.opencode/plugins/xinf.js" "$config_root/plugins/xinf.js"

printf '%s\n' 'Xava Inference installed for OpenCode.'
if [ -z "${XINF_API_KEY:-}" ]; then
  printf '%s\n' 'Sign in with: opencode mcp auth xinf (the account balance, within the daily cap you pick). Catalog and pricing work without signing in.'
fi
