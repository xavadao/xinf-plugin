# Xava Inference plugin

`plugins/xinf/` is the canonical plugin bundle. Root client manifests must reference that directory instead of duplicating skills.

- Keep every MCP adapter pointed at the canonical origin in `package.json` (`xinf.baseUrl`) plus `/mcp`; change it only with `scripts/retarget.mjs`.
- Owner decision 105: the plugin never references, creates or reads a local private key, wallet file or seed phrase, and has no local x402 payer. Paths: sign in (`/mcp/account`, the account balance within the per-connection daily cap), the device login (`bin/xinf-login.mjs`, an account API key only, mode 600), or an API key in `XINF_API_KEY`. x402 is documented only as a protocol for agents that already have a wallet provider with spending policies; `scripts/validate.mjs` rejects local-key setup.
- The API key comes only from `XINF_API_KEY` or the device login's `~/.xinf/credentials`. Never commit a key (`xk_live_...` / `xk_test_...` with a real secret), `.env` or an auth store.
- Public copy names models by provider and name only. Never name the infrastructure the service runs on or any upstream supplier; `scripts/validate.mjs` enforces the word list.
- The brand is "Xava Inference" and the token is $XINF. Pricing copy: list prices, Reward Status (Noob, Elite), the buyback token (`X-Buyback-Token` for x402, 0.5% default); the old discount split (`X-Split`) is gone, do not reintroduce it.
- Skills must keep the x402 safety rule: never auto-pay above a user-set cap without confirmation.
- Run `pnpm test`, `pnpm validate` and `claude plugin validate .` before release.
