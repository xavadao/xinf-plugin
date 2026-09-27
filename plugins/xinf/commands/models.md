---
description: List Xava Inference models with their list price (and Elite price), optionally filtered.
argument-hint: "[text|image|video|audio|embeddings] [search]"
allowed-tools: mcp__plugin_xinf_xinf__list_models, mcp__plugin_xinf_xinf__get_model_pricing
---

Load `xinf-models-and-pricing`. Call `list_models`: if `$ARGUMENTS` starts with a type (`text`, `image`, `video`, `audio`, `embeddings`) pass it as `type`, and pass any remaining words as `search`. With no arguments, list a few models per type.

Show a compact table: model id, name, the unit that matters, list price, Elite price (only where it differs), and "No rewards" where the model is marked so. Sort by list price. Say how many matched in total, and offer `get_model_pricing` for any one of them. Never invent a model that the tool did not return.
