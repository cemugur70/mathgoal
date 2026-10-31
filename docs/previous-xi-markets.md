# Previous-XI, player contribution and recurring-market model

Release: model 1.6.0, UI 2026-10-28.4. Training schema 4, 4,036 rows, 243 GBDT features. Player source: 4,727 fixtures. Features, lineups, histories and labels retain the existing strict as-of cutoff and target exclusion.

## Starting XI and availability

The default XI is the team's immediately preceding completed official fixture across competitions, including cups. The target match's actual/predicted XI never replaces it. Selection requires that fixture's statistics to have been available before the analysis cutoff. Unknown completion times use kickoff plus three hours. Friendlies, cancelled, awarded, unfinished and target matches are excluded.

An incomplete previous XI remains visibly incomplete. A minutes-ranked invented XI is not substituted. The bench pool retains previous-match participants; older history-only players remain disabled until the user explicitly assumes they can play. Zero-minute roster membership does not create a statistical appearance or zero-valued player metrics.

Automatic absences require a matching source record marked eligible for pre-match use, observed strictly before the cutoff while the target was unstarted and unfinished. Post-cutoff injury lists are shown as excluded. Users may explicitly mark a player out or available in a scenario; this is labelled a user assumption. Future injury snapshots never enter historical training. Historical injury availability records are not present in the training corpus, so injury counterfactuals are not separately validated causal effects.

Unavailable previous starters are replaced by an eligible same-position prior-match candidate with observed history. Initial selection uses prior participation and role signals. When GBDT is active, candidates with at least two matches / 90 minutes are evaluated through the frozen trees, greedily choosing the highest own expected goals minus opponent expected goals at each replacement. This is a deterministic one-pass search, not a proof of a globally optimal team. If no suitable candidate is observed, the slot remains incomplete and simulation requires an explicit lineup correction.

## Player contribution mathematics

For a fixed lineup and an eligible same-position comparison:

- Attack contribution = own expected goals with player − own expected goals with comparison player.
- Defense contribution = opponent expected goals with comparison player − opponent expected goals with player.
- Net goal contribution = attack contribution + defense contribution.
- Win-probability contribution = win probability with player − win probability with comparison player, displayed as percentage points.

The comparison uses the same GBDT trees, distribution shape, team/network inputs, market features and other player identities. For an injured previous starter, the actual selected replacement is the comparison. Active starters compare against the strongest credible eligible bench candidate. Bench/history candidates compare with an appropriate selected same-position player, with history-only hypotheticals explicitly labelled. Missing player history or a missing credible comparison produces an unknown contribution, not zero.

Joint absence effect compares the complete healthy previous XI with the selected replacement XI. These effects are already present in the feature vector; no extra penalty or legacy player multiplier is added. Contributions are nonlinear model sensitivities, not observed causal player values. Individual effects need not sum to the joint effect. Zero or negative contributions are allowed. H2H is a separate later projection adjustment.

Simulation begins from the same previous-XI/absence policy. Every substitution phase rebuilds starter features while preserving all market-feature values. The same trees are evaluated again, without applying the older heuristic phase multiplier. Manual availability controls update the main analysis and simulation defaults. A simulated lineup change itself is an explicit scenario and does not overwrite the main forecast.

## Repeated statistics and markets

The `Seriler ve pazarlar` view covers 151 explicit propositions: match/team goals, result/double chance, clean sheets, BTTS, parity, exact scores, European handicap, corners, yellow/red cards, shots, shots on target, fouls and offsides. Custom Asian handicap and total lines accept quarter steps, with full/half win, full push and full/half loss separated. No bookmaker odds, expected profit or ROI is inferred.

Each team uses up to 60 prior archived fixtures, independent of the selected 5/10 player-form window. Streaks are consecutive from the latest fixture, stopping at an opposite outcome or unknown metric. Unknown fixtures are never silently skipped to extend a run. A run reaching the archive boundary is marked at least (≥). Because historical archive completeness is not fully proven, these are archive streaks, not certified uninterrupted real-world streaks. New collections request up to 60 target-team fixtures rather than 20.

Observed frequency uses at most 30 recent fixtures and preserves its numerator/known denominator. Twenty core propositions supply signed capped streak length, Beta(2,2)-smoothed frequency and metric coverage for both teams: 20 × 3 × 2 = 120 additional features. Together with 10 team, 12 player-network and 101 XI features, GBDT has 243 inputs. A long run does not mechanically force continuation or reversal; any score effect is learned from strictly earlier samples through the trees.

Score-related market probabilities come from the selected goal-score grid, or from the completed simulation histogram in simulation results. Statistical markets use a separate unvalidated independent Poisson count model only when each team's own/against history has at least five observed records. Means blend recency-weighted own production with opponent concession. They are clearly distinguished from score-model probabilities and observed frequencies. Yellow-card counts do not infer red-card or bookmaker card-point settlement rules.

Half-time/full-time, half-goal, first/last-goal/time, player cards/assists/shots, combined-market dependency and odds-value markets lack a separately validated data/model pipeline and remain explicitly unsupported. No probability is fabricated for them. Generic settlement calculations do not replace a bookmaker's period, extra-time or card-point rules.

## Validation and runtime

Schema-4 enrichment is generated by `scripts/build-starter-training.mjs`, also invoked by `npm run train`. It retains source hashes, starter/market policies, feature timestamps and atomic publication. The existing chronological train/validation/test split and completion purges are reused. Hyperparameters and count-distribution shape are selected on validation only; test labels cannot select a model. A final all-prior refit occurs after the frozen test report.

Parma–Udinese 5749726, 10-match form: 2,018 eligible fixtures, 1,385 train / 270 validation / 291 test after purges. This run selected 16 trees with NB shape 30. Test exact-score accuracy: reference 14.09%, expanded GBDT 13.40%. Paired count NLL: 3.0942 versus 3.1151. The expanded GBDT does not beat the reference here; explicit GBDT remains labelled experimental, while automatic mode retains the stronger validated reference. This internal comparison is not independent future-performance evidence.

192 tests pass, including previous cup XI selection, no invented XI, source-timing/target/future exclusion, absence overrides, nonlinear counterfactuals, preservation of market features in simulation, long runs beyond 10 matches, unknown-metric run interruption, Asian quarter-line settlement, probability complements and held-out-label isolation. Real-fixture checks also confirm shared projection/simulation means and target-label invariance. Browser QA covers availability changes, same-position replacement, seeded 10,000-match simulation, contribution display, market filtering and quarter-line calculation.

The second real-fixture check, Athletic–Getafe 5868102 with five-match form, also passed: same-league scope, 808 eligible / 121 test fixtures, 24 trees. Automatic mode selected GBDT using validation (NLL 2.8581 → 2.8462; exact score 14.17% → 15.00%). Held-out NLL improved 3.0416 → 3.0255 and 1X2 accuracy 47.93% → 51.24%, while exact-score accuracy fell 17.36% → 15.70%. The mixed test outcomes are retained; test results were not used to change the selection.

Production health reports 1.6.0 / 2026-10-28.4. Deployed source and training hashes matched local validated files. Live browser QA verified the previous Parma XI, explicit hypothetical Diego Carlos-out → Abdoulaye Ndiaye replacement, counterfactual contribution and a seeded 10,000-match simulation without application console errors. This test was a user scenario, not a claim that Carlos is injured. The previously removed source-comparison page remains 404.

Training runs in a worker. Stable historical count projections are cached separately from player scenarios; recalculation yields to the UI so availability selections finish promptly before model/render work.
