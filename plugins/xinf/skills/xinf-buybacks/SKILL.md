---
name: xinf-buybacks
description: Explain Xava Inference's buyback token (0.5% of every spend buys back $XINF or a token you pick), Reward Status (Noob and Elite), what $XINF is, where the margin goes, and how to read buybacks in usage. Use when the user asks about buybacks, the buyback token, X-Buyback-Token, Reward Status, Elite or Noob, $XINF, the xinf token, staking rewards, or "No rewards" models.
---

# Buybacks, Reward Status and $XINF

## List prices, no platform fee

Everyone pays each model's **list price** (the model maker's own published price). There is no platform fee on top. Our margin on a request is what it was charged minus what it actually cost us upstream; buybacks and Elite discounts come out of that margin, never on top of the price. A model with no margin is marked **"No rewards"**: it pays no buyback and has no Elite discount, and the customer simply pays list.

## The buyback token

Every account picks one buyback token: **$XINF by default**, or any eligible Solana token (a project's token, a DAO token, a memecoin). A share of every spend buys it back:

| Reward Status | $XINF | custom token |
| --- | --- | --- |
| Noob (default) | 0.5% | 0.5% |
| Elite | 2% | 1.5% |

- It is one account setting, changed in the dashboard Rewards page (`$XINF_BASE_URL/dashboard/rewards`). It cannot be changed through the API key or the MCP server; send the user there.
- x402 callers have no account, so they pick the token per call with the `X-Buyback-Token: <mint>` header (or `"buyback_token"` in the body; default $XINF) and get the base 0.5% at list price. See `xinf-x402`.
- A token must pass the eligibility checks in our buyback index (liquidity, a safe route, no freeze authority); an ineligible mint is refused with `400 invalid_buyback_token`.

## Reward Status: Noob and Elite

- Every account starts as **Noob**: list prices and the 0.5% buyback.
- **Elite**: link a wallet holding at least 1,337 XAVA on Avalanche (balance plus credited stake) or 1,337,000 $XINF on Solana. Elite accounts pay the **Elite price** on models with an Elite discount (set per model, never below our cost) and get the bigger buyback above.
- `get_model_pricing` returns both prices per unit (`list_usd`, `elite_usd`) and `elite_discount_percent`.

## How buybacks happen

- Buyback amounts accrue in USD per token and are bought in batches on-chain; every batch is published with its transaction on `$XINF_BASE_URL/buybacks`.
- Response headers show it per request: `x-xm-cost-usd` (charged), `x-xm-list-usd` (list price), `x-xm-buyback-usd` (bought back).
- `get_usage_summary` reports `xinf_buyback_usd` and `custom_buyback_usd`, in total and per model.

## $XINF and where the rest of the margin goes

- $XINF is the platform token; its page is `$XINF_BASE_URL/xinf`, and holder rewards (AI credits for $XINF holders, USDC for XAVA stakers) are explained at `$XINF_BASE_URL/rewards`.
- After the buyback, the remaining margin splits 50% to XAVA stakers (in USDC) and 50% to $XINF buybacks into the protocol lock. There is no team share.

## Privacy

Zero data retention: prompts and replies are never stored, and generated files (images, video, audio) are deleted 24 hours after creation.

Explain these mechanics plainly. Do not give investment advice, predict prices, or describe $XINF as a return on usage; if asked, say the user should make their own judgement.
