# MathGoal · Maç Ağı

## H2H factor

H2H is enabled by default and has a separate switch, strength and half-life controls. A dedicated tab shows each result, target-team orientation, date, age weight, same/reversed venue and exclusions. Public FotMob H2H records are kept separately from the team/player training universe, so old head-to-head fixtures do not silently expand short-form or player samples. Each side's H2H signal shrinks toward the existing team goal intensity with five pseudo-games; its final factor is capped0.90–1.10 and applied after the player composition factor. The strength setting is not an outcome probability. No independent H2H performance claim is made.

Use the newest10 competitive meetings within five years. One-year temporal half-life is configurable; matching hosting direction has weight1, reversed0.65, another tournament0.60. Exclude target/future/not-yet-completed, awarded, cancelled, friendlies, extra-time/penalty and unknown-score records. Three usable meetings, effective sample>=2 and weight sum>=0.25 are required; otherwise factors are neutral. Score orientation is always explicit. Historical diagnostics still assess the base team model, excluding current player scenarios and the H2H layer.

Example `https://www.fotmob.com/tr/matches/juventus-vs-lecce/38ed1f#5749716:tab=h2h` parses normally and opens the H2H tab after collection. Saved example `https://mathgoal.io/?match=5749716#h2h` uses8 eligible prior meetings; its source marks the target finished, so the display is retrospective and excludes the target result. Current source collection:581 fixtures,0 errors. Galatasaray–Fenerbahçe uses10 eligible meetings; the awarded2024 result is excluded. Existing saved analyses are enriched from their own cached target's H2H list without replacing the active match.

## Current player layer and 5/10-match selection

The default form window is now10 matches, with a persistent5/10 selector affecting team form, graph expansion, similarity candidates, statistics and CSV exports. The expanded example archive has733 matches and28,857 individual player-match records across70 available player metric keys. At depth2 the10-match network has87teams and154unique graph fixtures; player profiles use each network team's selected last5/10 completed games (2,031unique players in the initial10-match graph).

The Players view links team→player→actual match→opponent. Same-position analogues expose their underlying match scores. Osimhen687681 is the initial example. Minute-based rates use covered minutes; unknown statistics remain missing. The last-starting-XI reference is explicitly unconfirmed. The player layer compares projected composition with the historical minute mix, applies uncertainty shrinkage and caps goal-intensity factors to0.92–1.08; it does not add summed player xG onto team xG. Users can disable the layer or enter explicit hypothetical in/out scenarios. The additional heuristic is not independently calibrated; the historical test shown in the laboratory evaluates the team model only.

Player source pages are read through their public SSR `__NEXT_DATA__` JSON, with identity verification and a15-minute local cache. `/api/player?id=687681` returns the current full source snapshot for display/export (season stats, shots, traits, career, injuries, etc.). Current season/career aggregates never enter retrospective predictions. Match-derived player features obey the model's strict cutoff and completion guard.31 tests cover the combined model, missing/late data, per90 denominators, lineups, analogues, scenario factors and null results.

FotMob public JSON responses, last-five competitive-match profiles, a two-hop opponent network, pre-match similarity and a regularized Poisson/empirical score mixture. Turkish responsive UI; no external runtime dependencies.

## Run

Node.js 22 or newer:

```
npm start
# http://127.0.0.1:4173
npm test
npm run collect -- 5795493
node scripts/prepare.mjs
```

Upcoming match URLs are supported with or without `:tab=stats`, for example `https://www.fotmob.com/tr/matches/galatasaray-vs-fenerbahce/2hfnrt#5904782`. The shared URL parser accepts the fragment match ID, canonical `/match/<id>` URLs and numeric IDs. Upcoming matches use an explicit `analysisAt = min(kickoff, observedAt)` cutoff. FotMob's placeholder scores for unfinished matches are never retained as actual results; the result comparison card appears only after a confirmed finish. The current example is Galatasaray–Fenerbahçe: 282 past fixtures, 39 nodes / 47 games in the selected network. Thirteen tests cover model leakage, future observation cutoffs, URL variants and unfinished placeholder scores.

The page accepts a FotMob match URL or numeric ID. The same-origin Node endpoint collects/cache sources; only one collection runs at a time. The display uses a saved snapshot rather than a live feed. `data/cache` contains the original FotMob team, match and league responses. `/api/raw?id=<id>` returns a cached match response; the last five root-team match responses are also exported under `dist/data/details`.

## Observed scope

Initial target: Manchester United–AFC Bournemouth, 2026-10-25 14:00 UTC, FotMob5795493. 324 past fixtures,170 teams appearing in those fixtures,311 detailed matches,42 unique available match metrics. Recursive collection visits43 teams; the prediction-time completion guard yields321 eligible fixtures,42 graph nodes and49 unique graph games at depth2. Squad, player/season stats, transfers and history snapshots are exported for the two target teams but do not enter the past prediction.

All available keys in full match and first/second-half stats are retained, including raw display/total values. Physical metrics are not supplied for all competitions. Raw match responses expose playerStats, shotmap, lineups, momentum, match events, H2H and other fields when the source supplies them. This does not claim all seasons or every FotMob statistic globally were acquired.

## Leakage boundary and model

Exclude target/future/uncompleted/cancelled/friendly matches. Without a known finish timestamp, final stats become available only after kickoff+3h. All historical similarity candidates use their own strictly earlier last-five profiles; candidate match outcome/own stats never form their comparison vector. Fit opponent attack/defense with time decay, damping and five pseudo-games. Combine75% network with25% short form; mix normalized 0–8 Poisson scores with neighbor scores, reducing neighbor influence according to effective sample size. Missing values remain null. Fewer than3 past fixtures per root suppress prediction.

Initial most likely score0–1 has12.22% probability, with1/X/2 probabilities21.41/25.75/52.84%. This target already finished; actual result is separately hidden in the laboratory and excluded from training. Initial60-match walk-forward diagnostic: outcome accuracy53.33%, exact score6.67%, logloss1.0055 vs uniform1.0986. This is a selected-source internal diagnostic, not independent calibration or proven future performance.

## Season-to-date layer

Schema 6 adds 14 per-side season-to-date league features rebuilt from the archive as of each cutoff (points, goals, xG, finishing residuals, venue points, archive rank, shots, rest days, coverage); FotMob season tables and player season totals are never model inputs. The layer extends the 255-input GBDT to 269 inputs behind the same validation gate as the market network and is evaluated only in Obsidian / automatic mode. Details and measured examples: `docs/season-features.md`.Obsidian / automatic mode. Details and measured examples: .

## Collection cache

Finished fixtures whose cached FotMob response was written at least 48 hours after kickoff are reused instead of being re-downloaded when the 24-hour cache expires. The politeness pause now follows real requests only. `FOTMOB_SETTLED_CACHE=0` restores the old behaviour. Collection stages are timed in `data/collect-timing-<id>.json`. Measurements and the remaining training bottleneck: `docs/collection-cache.md`.

## Deployment

User-selected production domain: https://mathgoal.io . Docker service joins existing `coolify` proxy network. Old `/opt/mathgoal`, old container/image, cron config and logrotate config were explicitly authorized for permanent deletion without a new backup. Existing backups inside the old directory are included in that deletion. Other sites, databases, shared proxy and TLS storage are outside scope. `scripts/replace-remote.sh` is a one-time replacement script, not a routine update command. Production data lives in `/opt/mathgoal/app/data` and `/opt/mathgoal/app/dist/data`.

REA browser evidence: `data/rea-findings.json`; raw source hashes: `data/source-manifest.json`. The browser trace is partial due to event/network limits; source JSON extraction is independently recorded and validated by IDs/dates. No claim of complete network capture.
