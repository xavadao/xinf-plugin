---
name: xinf-x402
description: What x402 is on Xava Inference and how an agent that already has a wallet provider with spending policies (a hosted or custodial agent wallet) pays per image, video or audio call in USDC on Solana. Use when a media tool or endpoint answers 402 / payment required, when the user asks what x402 is or whether their agent can pay per call from a wallet, wants to pick a buyback token for x402 calls (X-Buyback-Token), or asks how to budget agent spending on media.
---

# x402 pay-per-call

x402 puts payment inside HTTP: the server answers `402 Payment Required` with an exact quote, the client's wallet signs a USDC transfer and the client retries the same request. On Xava Inference it pays for one media generation at a time in USDC on Solana, with no account: the wallet pays exactly the quote, which is the model's **list price** (no Elite price without an account).

## Is it for this agent?

Almost always, no: **sign in instead.** In Claude Code, Codex, Cursor and the other coding agents, the plugin connects to `/mcp/account`; the user signs in once in the browser (`/xinf:login`), and every tool, media included, is paid from the account balance within the daily spending cap they set at consent. That is the recommended path.

x402 is only for an agent that **already has a wallet provider with spending policies**: a hosted or custodial agent wallet, or a wallet service that signs on the agent's behalf and enforces per-payment and daily limits itself. The plugin never creates, stores, reads or asks for a private key, a wallet file or a seed phrase, and neither do you. If the agent has no such wallet provider, do not improvise one: tell the user to sign in (`/xinf:login`), or to use the device login if their tool cannot sign in by itself.

## Where it works

- Yes: `POST /v1/images/generations` and `POST /v1/media/generations` (video, audio), when **no credential** is sent; and the media tools on the open MCP endpoint `/mcp` (not `/mcp/account`, which always asks for sign-in).
- No: chat, embeddings and streaming need an account (sign in or an API key).
- Models billed by their output (price only known afterwards) cannot be prepaid: `400 x402_unsupported_model`. Use the account for those.

## The flow: quote, price, pay (must follow)

1. **Quote.** Send the request with no `Authorization` header. The answer is `402` with a `PAYMENT-REQUIRED` header (x402 v2, base64 JSON; the same JSON is the body). `accepts[0]` has `scheme: "exact"`, the Solana `network` (CAIP-2), the USDC `asset`, `amount` in USDC base units (6 decimals: `5000` = $0.005), `payTo`, `maxTimeoutSeconds: 60` and `extra.memo`, bound to this exact body and buyback token. Nothing is charged for a quote.
   ```bash
   curl -i "${XINF_BASE_URL:-https://zinf.ai}/v1/images/generations" \
     -H "Content-Type: application/json" \
     -d '{"model":"pruna/p-image","prompt":"a lighthouse at dusk"}'
   ```
2. **State the price** to the user in one line: model, what it makes, `$amount` USDC, the network (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` = devnet test USDC, `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` = mainnet, real money).
3. **Pay through the client's own wallet provider.** Hand the `accepts[0]` requirements to the wallet provider's x402 signer; its spending policy decides whether it signs. Retry the **identical** request (same body, same `X-Buyback-Token`) with the signed payment in `PAYMENT-SIGNATURE` (`X-PAYMENT` also works). Over MCP (`/mcp`), retry the same tool call with the signed payload in `_meta["x402/payment"]`.
4. **Read the receipt.** The server verifies and settles on-chain **before** running the model, then returns the result with `PAYMENT-RESPONSE` (the receipt, including the transaction signature) and `x-request-id`; over MCP the receipt is `_meta["x402/payment-response"]`. Media URLs carry `expires_at` and answer `410 Gone` 24 hours after creation, so download what the user wants to keep.
5. **Report**: the URLs or saved paths, the cost, the transaction and the request id.

## Budget rules (must follow)

- Before paying, state the price. **Never auto-pay above the user's cap without explicit confirmation.** The cap comes from the user and from the wallet provider's spending policy; the stricter one wins. No cap known means ask before every payment.
- Never ask for, read, print, create or store a private key, wallet file or seed phrase, and never suggest generating a wallet on this machine. Signing is the wallet provider's job.
- Price video before generating: seconds x resolution adds up. Start short and low resolution.
- Never retry a paid call in a loop. After a failure, read the error, fix the cause, and try at most once more. If a paid request fails, keep the request id and the transaction for support.
- Real money (mainnet) only when the user has said so.

## Errors

| message | what to do |
| --- | --- |
| `price changed` / payment does not match | the body or buyback token changed: quote again and restate the price |
| `not accepted (nothing settled)` | the wallet provider refused or the wallet lacks USDC; nothing was paid, tell the user |
| paid, but the request failed | keep the request id and transaction; the user contacts support |
| `400 invalid_buyback_token` / `x402_unsupported_model` | pick an eligible token / use the account for that model |

## The buyback token: `X-Buyback-Token`

x402 callers pay the list price; **0.5% of it buys back a token**, taken from our margin (never added to the price). The default is $XINF. To buy back another eligible Solana token, send `X-Buyback-Token: <mint>` (the body field `"buyback_token"` also works, the header wins; the MCP media tools take a `buyback_token` argument). The token must be eligible in our buyback index, else `400 invalid_buyback_token` before any quote. The token is bound into the quote (memo), so keep it the same between quote and pay. Models marked "No rewards" (zero margin) pay no buyback. Only set a token when the user asks for one.

## x402 or the account?

| x402 fits | sign in (the account) fits |
| --- | --- |
| an autonomous agent whose wallet provider already enforces spending policies | coding agents: Claude Code, Codex, Cursor and the rest |
| one-off media calls with no account at all | chat, embeddings, streaming, models billed by output |
| spend must be capped per call by construction | usage history, a daily cap per connected app, Reward Status (Elite prices) and the account's buyback token |

Signed in (or with `XINF_API_KEY`), the MCP media tools (`generate_image`, `generate_video`, `generate_audio`) charge the account balance and never ask for payment; use them.
