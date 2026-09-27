---
name: xinf-media
description: Generate images, video, speech, music or sound with Xava Inference, through the xinf MCP tools or the /v1 endpoints, and hand back the media URLs. Use when the user asks to create, render or draw an image, logo, illustration, mockup or thumbnail, make a video clip or animation, turn text into speech or a voiceover, or generate music or sound effects.
---

# Generate images, video and audio

## 1. Choose and price

1. `list_models` with `type: "image"`, `"video"` or `"audio"`. Use `search` for a family the user named (`flux`, `veo`, `eleven`).
2. `get_model_pricing` on the choice. Units: per image (often per size tier), per second of video (per resolution), per 1K characters or per minute of audio.
3. Tell the user the expected cost before any call over about $0.10, and before every video. For a fast draft pick a cheap model; for a final render, the model the user asked for.

## 2. Call

| tool | required | useful optional | notes |
| --- | --- | --- | --- |
| `generate_image` | `model`, `prompt` | `size` (`1024x1024`), `n` (1-4), `params` | |
| `generate_video` | `model`, `prompt` | `duration` (s), `resolution` (`720p`, `1080p`), `params` | price = seconds x resolution rate |
| `generate_audio` | `model`, and `text` (speech) or `prompt` (music, sound) | `params` (voice, format...) | |

- Model-specific inputs (seed, aspect ratio, negative prompt, image-to-video source URL, voice id) go in `params` and pass through unchanged. Check the model's page (`$XINF_BASE_URL/models/<id>`) for what it accepts rather than guessing.
- Video: start with the shortest duration and lowest resolution to check the prompt, then scale up once the user likes it.
- Signed in (or with an API key) the call is paid from the balance (list price, or the Elite price for an Elite account), within the connection's daily cap, and the account's buyback token applies. If the tool asks for sign-in or returns an x402 quote, suggest `/xinf:login`; never try to pay the quote from this machine (see `xinf-x402`).

## 3. Return the result

- Results are same-origin URLs, `.../media/<id>`, and they are **deleted 24 hours after creation**: every result carries `expires_at` (unix seconds), and an expired URL answers `410 Gone`. Download what the user wants to keep right away. Give the user every URL with its expiry, plus `cost_usd` and `request_id`.
- To save locally: `curl -fsSL -o <name>.<ext> "<url>"`. Pick the extension from the content type (`image/png`, `video/mp4`, `audio/mpeg`). Put files where the user asked, or in the project's assets folder.
- Treat the URL as a capability: anyone with it can view the file. Do not post it publicly unless the user wants that.

## From code

```bash
# image (OpenAI images shape): returns {"expires_at", "data":[{"url", "expires_at"}]}
curl -s "$XINF_BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $XINF_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"black-forest-labs/flux-1-schnell","prompt":"a lighthouse at dusk","size":"1024x1024"}'

# video or audio: {"model", "input": {...}}, returns {"expires_at", "files":[{"url","content_type","bytes","expires_at"}]}
curl -s "$XINF_BASE_URL/v1/media/generations" \
  -H "Authorization: Bearer $XINF_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"<video model id>","input":{"prompt":"waves at night","duration":4,"resolution":"720p"}}'
```

The response headers carry `x-xm-cost-usd`, `x-xm-buyback-usd` and `x-request-id`. Long video jobs can take a minute or more; use a generous client timeout and do not resend while one is running.

## Failures

- `400` with `param`: an input the model does not take. Fix it; do not retry unchanged.
- `502 generation_failed` or `504 timeout`: you were not charged. Retry once, shorter or smaller, then stop.
- Content refused by the model: rephrase only if the user's intent is clearly legitimate; never work around a safety refusal.
