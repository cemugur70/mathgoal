# Learned score prediction from a recurring-market graph

Release: model 1.7.0, UI 2026-10-29.1, training schema 5. A full historical rebuild produced 4,192 form-window rows from 2,096 usable labelled fixtures (5- and 10-match windows). The source label corpus contains 3,272 fixtures; player history contains 4,727 fixtures. Not every source fixture has enough prior evidence to become a training sample.

## Graph construction

`market-network.mjs` compares the pre-match profiles of 20 core market propositions for both teams. Each proposition carries signed streak length, a smoothed historical frequency and coverage. Similarity uses coverage-weighted absolute differences: 35% streak and 65% frequency where the current streak is known, frequency alone otherwise. At least 12 of 40 team/market dimensions must be shared. The maximum distance is 0.32. Reversed venues incur 0.025 distance penalty, as do cross-league matches. This is a fixed similarity policy, not an outcome-trained confidence percentage.

The nearest 48 completed, available, strictly earlier fixtures form the local library. Personalization weights are similarity cubed × square-root coverage × 365-day recency decay. Each fixture connects to recurring-market state nodes defined by team perspective, event-present/absent/unknown streak bucket and historical-frequency quartile. The graph propagates mass through match → market-state → other matches for eight passes, with 35% restart toward the similarity weights. Dangling mass returns to that personalization. Outcomes do not choose edges or weights.

Only after the graph weights are fixed do known historical scores become training signals. Twelve features summarize direct and propagated goal residuals, win/draw/over/BTTS outcome frequencies, score concentration, weight-based effective sample size, similarity and missingness. Goal residuals compare `(goals+.5)/(pre-match baseline+.5)`, clip the log ratio and shrink by `ESS/(ESS+12)`. The effective sample size is a weight concentration measure, not a count of statistically independent fixtures or calibrated certainty.

The existing 243 inputs remain available. The graph adds 12, giving 255 GBDT inputs. Projection and substitution-phase simulation share the selected frozen trees and count distribution. Player-scenario recalculation preserves all market and graph features. The separate H2H projection adjustment remains later in the pipeline.

## Temporal evaluation and model selection

Graph anchors require verified pre-match profile timestamps, sufficient prior history and labels available before the query kickoff. The target, unfinished/unavailable labels, future features and conflicting duplicate fixtures are excluded. Mirrored scores are oriented consistently with mirrored teams.

The model comparison reuses the existing chronological 70/15/15 kickoff-group split and completion purges. Graph features are rolling pre-match features: an earlier validation/test fixture may enter a later fixture's history only after it is complete. This is also how ordinary last-match form works. Test labels cannot change training/validation graph features, hyperparameter selection or frozen trees. The final production refit occurs after the frozen test report and may use all labels known before the target.

The expanded model is compared to the strongest existing automatic reference on the same cohort. Automatic activation requires at least 0.003 validation paired-count NLL gain, no reduction in validation exact-score accuracy, at least 70 / 60% graph-covered training samples, and adequate target network support. Explicit `market-graph` mode can activate an accepted expanded GBDT experimentally; it cannot bypass target coverage or the raw-baseline acceptance gate. Test metrics never select a model.

Measured examples from the full rebuild:

| Fixture / form | Separate test | Reference exact score | Graph exact score | Reference score NLL | Graph score NLL |
|---|---:|---:|---:|---:|---:|
| Parma–Udinese 5749726 / 10 | 311 | 13.83% | 12.22% | 3.0949 | 3.1146 |
| Athletic–Getafe 5868102 / 5 | 121 | 15.70% | 17.36% | 3.0255 | 3.0162 |

Both examples fail the automatic validation gate and remain experimental when explicitly selected. The mixed test results do not establish a general improvement or guaranteed exact-score prediction. The target actual score is not forced into the forecast. Complete records are in `data/market-network-prediction-<id>-<window>.json`.

## Exploration

The `Pazar ağı` view renders a force-layout graph of the target, market states, historical matches and teams. It supports node selection, node dragging, pan/zoom, search, filters and an accessible node list. Details show actual historical outcomes, orientation, provenance and diffusion weight. To keep the view readable, at most 36 representative market-state nodes are drawn; diffusion uses every state in the selected local library. Visual filters do not change model inputs. A match's similarity or graph weight is not its score's probability.

## Updating from new results

After a successful collection, `collect.mjs` awaits `scripts/train.mjs`. The job exports retained historical sources, rebuilds base, player-graph, XI, market and market-network features in `data/training-candidate.json`, validates the completed schema and then atomically replaces the published training file. Private source exports are atomic too. A failed stage preserves the previous published artifact. The collection response reports success only after training-data publication; the browser invalidates its cached training promise before loading the new dataset.

This is event-driven updating when data is collected, not a scheduled live-result monitor. On each analysis, a worker fits both the existing and expanded GBDT using only labels available before that target, then the main thread applies the selection policy. No target outcomes are used for its own historical prediction. No external forecasts or unverified post-match injury snapshots are added as labels/features.

## Verification

196 tests passed, including normalized multihop weights, outcome-independent topology, mirrored score orientation, future/target exclusion, rolling held-out-label isolation, graph coverage gates, and the full collector-to-publication path. A deliberately failed graph-builder stage preserves the previous public artifact. Subsequent targeted collector/pipeline tests passed after atomic-source hardening.

Real-fixture checks (`scripts/check-market-network-prediction.mjs`) passed for both examples, including a 10,000-match simulation, shared projected/simulated base means, preservation of the 12 graph inputs across lineup reconstruction, and target-label invariance. Browser QA validates the interactive graph and model status separately.

Method background for personalized damped graph propagation: https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.link_analysis.pagerank_alg.pagerank.html . The app implements its own small bipartite iteration and does not add a NetworkX dependency.

## Production verification — 29 October 2026

MathGoal v1.7.0 / UI 2026-10-29.1 is deployed. Public model modules and the schema-5 training artifact match the locally verified hashes; the container is healthy. The removed source-comparison page still returns 404.

Live browser QA passed for Parma–Udinese: the graph displays 48 historical neighbors, 47.1 effective samples, 446 shared market states and 255 selected inputs. Selecting Udinese–Cagliari shows the oriented historical 0–1 score, date, similarity, diffusion weight and nine connections. A seeded 10,000-match simulation completed (seed 12345, modal score 1–1, 11.0%, mean goals 1.54–1.16). No application console errors were captured. The graph remains explicitly experimental. Screenshot: `screenshots/mathgoal-market-network-live.png`.
