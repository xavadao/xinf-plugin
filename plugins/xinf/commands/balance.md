---
description: Show your Xava Inference credit balance.
allowed-tools: mcp__plugin_xinf_xinf__get_balance
---

Load `using-xinf`. Call `get_balance` and report `available_usd` and, if non-zero, `held_usd` (reserved by requests in flight). Include the `topup_url` when the available balance is under $5.

If the tool says an API key is needed, explain that balance belongs to an account and suggest `/xinf:setup`. Never print the key.
