---
description: Summarise Xava Inference spend, requests, savings and buybacks.
argument-hint: "[days, default 7]"
allowed-tools: mcp__plugin_xinf_xinf__get_usage_summary
---

Load `using-xinf`. Call `get_usage_summary` with `days` set to `$ARGUMENTS` when it is a number from 1 to 90, else 7.

Report requests, spend, what the same usage costs at list, the saving, and buybacks (`xava_buyback_usd` is the $XINF share; `custom_buyback_usd` the custom token). Then the top models by spend as a short table. If a key is needed, suggest `/xinf:setup`.
