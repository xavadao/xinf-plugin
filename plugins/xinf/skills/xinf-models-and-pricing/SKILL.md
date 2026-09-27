---
name: xinf-models-and-pricing
description: Compare Xava Inference models by list price, Elite price and capability, and choose a cost-effective model. Use when the user asks which model is cheapest or best value, what a model costs, how much a job will cost, what the Elite price or "No rewards" means, or wants an estimate before a large batch.
---

# Models and pricing

## One price for everyone: the list price

- **List price**: the model maker's own published price per unit. It is what every Noob account and every x402 caller pays. There is no platform fee on top.
- **Elite price**: accounts with Elite Reward Status (see `xinf-buybacks`) pay the list price minus the model's Elite discount, where the model has one. It never goes below our cost.
- `list_models` shows the list price per unit (with the Elite price in brackets); `get_model_pricing` returns both per unit (`list_usd`, `elite_usd`) and `elite_discount_percent`. `GET /v1/models` has the same in `x_pricing`, plus `rewards_status`.
- **"No rewards"** models (`rewards_status: "no_rewards"`) earn us no margin: no Elite discount and no buyback. They cost list for everyone.
- Prices can change. Quote the model's own numbers, fetched now, never a remembered or site-wide figure.

## Units

| type | usual unit |
| --- | --- |
| text | per 1M input tokens and per 1M output tokens (some have context tiers) |
| image | per image, often per size tier (`output_images:1k`, `:2k`) |
| video | per second, per resolution |
| audio | per 1K characters (speech), per minute (transcription), per track or second (music) |
| embeddings | per 1M input tokens |

## Estimating a job

- Text: `(input_tokens / 1e6) x input price + (output_tokens / 1e6) x output price`. Estimate about 4 characters per token for English. Output usually dominates for reasoning models.
- Media: count x unit price at the chosen size, seconds or length. For an exact media price without spending anything, send that exact request to the endpoint with no credential: the `402` answer quotes its precise list price and nothing is charged (see `xinf-x402`).
- State the estimate with its assumptions, and the total for the whole batch.

## Choosing cost-effectively

1. Filter by what the task truly needs: context length, vision, tool calls, image size, video resolution, voice language.
2. Among the models that fit, compare the price the user pays (list, or Elite for an Elite account) on the unit that dominates the job (output tokens for long answers, input tokens for long documents, seconds for video).
3. Prefer a smaller or faster model for classification, extraction, routing and drafts; reserve frontier models for hard reasoning, long code changes and final renders.
4. For media, draft with a cheap model and re-render the chosen prompt with the premium one.
5. Offer two options when they differ meaningfully: the cheapest that fits, and the best quality within the user's budget, each with its price.

For a full recommendation, delegate to the `model-picker` subagent with the task, constraints and budget.
