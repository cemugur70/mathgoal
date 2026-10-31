# Reproducible simulations across model changes

Previously, every new analysis object rebuilt the simulation panel with `newSeed()`. Switching from Obsidian GBDT to another model and back therefore changed the sample match even when the final model and data were identical. The simulation engine itself was seeded and deterministic; the UI discarded that seed. Custom XI selections were also reset during this rebuild.

`simulation-session.mjs` now keeps the seed and manually selected XI by fixture, form window and team identity, independently of model selection. The initial seed is derived deterministically from that identity, so a fresh page has the same default seed. A manually entered seed or “Yeni tohum” replaces the session seed; model changes do not. Sessions are bounded to 20 contexts and do not cache model predictions.

Retained XI selections are validated against current eligibility and formation requirements. If new availability makes them invalid, current default lineups are restored with a visible notice, while preserving the seed. “Başlangıç kadrosuna dön” clears custom selections. Updated data, a different model, formation or player scenario can still legitimately change forecasts; returning to the same inputs repeats the complete simulation, including the first sample's events.

All 200 tests pass. Regression checks cover A → B → A model changes with a custom XI and 10,000 simulations, fresh-session default seeds, fixture isolation, invalid seeds and updated player availability.

Browser QA on Parma–Udinese used seed 12345 and the actual model selector: Obsidian → GBDT → Obsidian. Before and after, projection text, simulated modal score, sample score (2–1), complete replay event text and seed were identical. The same live check on Milan–Bologna also reproduced the complete result (modal 1–1 at 11.8%, sample 1–0). No application console errors were captured. The 5,206-row training artifact was retained.

UI release 2026-10-29.3 also disables the simulation button while a replacement analysis is being prepared, preventing a click from starting a job with the previous model's input. Superseded jobs remain cancelled. The button is recreated in the enabled state once the new analysis is rendered.
