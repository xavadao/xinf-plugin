---
description: Generate an image with Xava Inference and return its URL and cost.
argument-hint: "<prompt> [--model provider/model] [--size WxH]"
allowed-tools: mcp__plugin_xinf_xinf__list_models, mcp__plugin_xinf_xinf__get_model_pricing, mcp__plugin_xinf_xinf__generate_image
---

Load `xinf-media`. Treat `$ARGUMENTS` as the prompt, taking `--model`, `--size` and `--n` out of it if present.

1. If no model was given, call `list_models` with `type: "image"` and choose a fast, inexpensive general model; say which and why in one line.
2. Call `get_model_pricing` and state the price for this size and count.
3. Call `generate_image`. If it asks for sign-in or returns an x402 payment request, stop and suggest `/xinf:login` (it spends the account balance within the daily cap); never try to pay from this machine, and never pay above the user's cap without asking.
4. Return every URL with `cost_usd`, `request_id` and `expires_at`. Files are deleted after 24 hours, so offer to download them into the project with curl now (the user approves each download command).
