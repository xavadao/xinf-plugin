# Xava Inference

Read and follow `@./plugins/xinf/skills/using-xinf/SKILL.md` before calling any `xinf` MCP tool. Load the narrower skill it names before acting:

- `@./plugins/xinf/skills/xinf-media/SKILL.md` for images, video and audio.
- `@./plugins/xinf/skills/xinf-x402/SKILL.md` if the user asks about x402 (only for agents that already have a wallet provider with spending policies; otherwise sign in).
- `@./plugins/xinf/skills/xinf-models-and-pricing/SKILL.md` to compare or choose models.
- `@./plugins/xinf/skills/xinf-buybacks/SKILL.md` for the buyback token, Reward Status and $XINF.

Sign in with `/mcp auth xinf`. Never print, log or commit the value of `XINF_API_KEY`. Never create, read or store a private key, wallet file or seed phrase. Never pay for an x402 call above the user's budget cap without asking first.
