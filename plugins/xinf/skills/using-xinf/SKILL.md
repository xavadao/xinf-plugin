---
name: using-xinf
description: Use Xava Inference (xinf) to call any text, image, video, audio or embedding model through one account, signed in from the agent or with an OpenAI-compatible key. Use when the user wants to call, try or switch to a model other than the current one, write code against an OpenAI-compatible base URL, sign in or check an XINF_API_KEY, check their balance, or debug an xinf error (401, 402, 404, 429, 503).
---

# Use Xava Inference

Xava Inference sells inference for models from many providers at the model makers' list prices (Elite prices for Elite Reward Status), on one key and one prepaid balance, with zero data retention: prompts and replies are never stored, and generated files are deleted after 24 hours. It talks to you through the `xinf` MCP server and to code through an OpenAI-compatible API.

## Pick a model

1. Call `list_models` with `type` (`text`, `image`, `video`, `audio`, `embeddings`) and, if the user named one, `provider` or `search`. Ids are `provider/model`, for example `openai/gpt-5.4` or `black-forest-labs/flux-1-schnell`.
2. Call `get_model_pricing` on the candidate before anything that could cost more than a few cents. Video is priced per second and per resolution; image models often have per-size tiers.
3. If the user has not named a model, choose by fit first and price second. For a real comparison, load `xinf-models-and-pricing` or hand the task to the `model-picker` subagent.

Never invent a model id. If `list_models` does not return it, it is not available.

## Call it

- **Text:** `chat` with `model` and `prompt` (or `messages`, `system`, `max_tokens`, `temperature`). Non-streaming. Needs the account (signed in, or a key).
- **Image, video, audio:** load `xinf-media`.
- Every result carries `cost_usd` and a `request_id`. Mention the cost when it is more than a cent.

## In the user's code

Use the OpenAI-compatible API with the same model ids:

```bash
OPENAI_BASE_URL=${XINF_BASE_URL:-https://zinf.ai}/v1
OPENAI_API_KEY=$XINF_API_KEY
```

| what | endpoint |
| --- | --- |
| catalog with prices | `GET /v1/models`, `GET /v1/models/{provider}/{model}` |
| chat (streaming works) | `POST /v1/chat/completions` (also `/v1/responses`, `/v1/messages`) |
| images | `POST /v1/images/generations` |
| video and audio | `POST /v1/media/generations` with `{"model", "input": {...}}` |
| embeddings | `POST /v1/embeddings` |

Read the key from the environment in code (`process.env.XINF_API_KEY`, `os.environ["XINF_API_KEY"]`). Never paste a key into source, a commit, a log or a chat reply. The full reference for agents is at `$XINF_BASE_URL/llms-full.txt` and `$XINF_BASE_URL/openapi.json`.

## Sign-in and keys

- **Sign in (preferred).** The `xinf` MCP server is `/mcp/account`. Signed out, it answers 401 and the agent opens the browser: the user signs in, sees "Allow <app> to use your Xava Inference account", picks a daily spending cap (default $5 a day) and clicks Allow. Every tool, media included, then spends the account balance within that cap (`402 spending_cap_reached` once today's cap is used). The user changes the cap or revokes the app in the dashboard under API keys > Connected apps. `/xinf:login` walks through it.
- **Device login**, for tools that cannot sign in themselves: the user runs `node bin/xinf-login.mjs`, approves in the browser, and it saves an **API key for the account** (with the daily cap they picked) to `~/.xinf/credentials`, readable only by them. It is an account key, revocable in the dashboard, never a wallet key.
- **API key**: `XINF_API_KEY` can also hold a key (`xk_live_...`) created in the dashboard; the MCP server gets it as `Authorization: Bearer`. Keys are shown once.
- `list_models` and `get_model_pricing` work without any credential. `chat`, `get_balance`, `get_usage_summary` and the media tools need the account: if one says sign-in is needed, run or suggest `/xinf:login`.
- Never create, read or store a private key, wallet file or seed phrase. x402 (load `xinf-x402`) is only for agents that already have a wallet provider with spending policies; coding agents sign in.
- `XINF_BASE_URL` overrides the origin (for example `http://localhost:8791` against a local server).

## Balance

`get_balance` returns `available_usd`, `held_usd` (reserved by in-flight requests) and a `topup_url`. Check it before a batch of expensive calls. Credit is prepaid; top up by card or USDC on Solana at the dashboard.

## Errors

Errors use OpenAI's shape. Always quote the `request_id` when reporting one.

| status | code | what to do |
| --- | --- | --- |
| 400 | `invalid_request`, `invalid_buyback_token`, `unsupported_model` | fix the parameter named in `param`; do not retry unchanged |
| 401 | `missing_api_key`, `invalid_api_key` | not signed in, or the key is wrong or revoked: `/xinf:login` |
| 402 | `insufficient_balance` | tell the user and give the top-up link |
| 402 | `spending_cap_reached` | this connection's daily cap is used up: the user raises it in the dashboard (API keys > Connected apps) or waits for tomorrow (UTC) |
| 402 | (media tool, no credential) payment required | an x402 quote: do not pay it yourself; suggest `/xinf:login` (load `xinf-x402` only if this agent has a wallet provider with spending policies) |
| 404 | `model_not_found` | re-run `list_models`; the id is wrong or unlisted |
| 429 | `rate_limit_exceeded` | wait for `Retry-After`, then retry once |
| 503 | `no_capacity` | wait for `Retry-After`, or offer a comparable model |
| 504 / 502 | `timeout`, `generation_failed` | not charged; retry once, then try a shorter or smaller job |

## Related skills

- `xinf-media`: images, video and audio.
- `xinf-x402`: what x402 is, for agents that already have a wallet provider with spending policies.
- `xinf-models-and-pricing`: list price, Elite price, "No rewards" models, cost-effective choices.
- `xinf-buybacks`: the buyback token, Reward Status (Noob, Elite) and $XINF.
