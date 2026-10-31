# Poisson GBDT with starting-XI features

Release: model 1.5.0 / UI 2026-10-28.3. This is a dependency-free implementation of histogram CART boosting with a Poisson objective, Newton leaf updates, L2 regularization and a log team-goal offset. It is not the XGBoost library. The final goal correction is bounded to 0.5–2 times the team baseline.

## Inputs

The 123 numeric inputs comprise the existing 10 team and 12 player-network features plus 101 starting-XI inputs. Eleven slots, ordered by position then prior minutes then ID, each carry six channels, a missingness indicator and position. Six opponent-XI channel averages, six opponent missingness indicators and own history coverage complete the vector. IDs and names are not training features.

Each player's previous 5/10 appearances in the target competition provide 22 metrics: xG, goals, shots, shots on target, xGOT, xA, chances created, assists, completed passes, crosses, long balls, tackles, interceptions, defensive actions, clearances, blocks, duels, ground/aerial duels, dribbles, saves and goals prevented. Rates use the minutes in which that metric was observed, 120-day decay and exposure/(exposure+270) shrinkage. Six channels combine normalized metrics using fixed, disclosed weights in `starter-features.mjs`. Raw rate and coverage details remain visible; missing values are not observed zeroes.

Historical samples reconstruct the XI from the latest prior same-league starting XI, or prior participation minutes if unavailable. Target actual lineups and outcomes are excluded. A live confirmed/predicted lineup is eligible only with an eligible source record observed strictly before the analysis cutoff, while the target is unstarted and unfinished. Confirmed-live XI effects do not have a separate independent validation set. Inferred XIs do not guarantee injuries/transfers or the final team sheet.

## Training and selection

The schema-3 artifact contains 4,036 rows for two form windows. Every analysis excludes the target, unavailable labels, invalid feature timing and duplicate fixtures. League-specific training requires 180 eligible fixtures; otherwise a disclosed global pool is used. Kickoff groups are split 70/15/15 chronologically; labels crossing the next split boundary are purged. Histogram thresholds and tree structures use only training observations.

Three fixed configurations are searched: depth/minimum leaf/L2/rate = 2/30/10/.08, 2/60/30/.08, 3/40/30/.05. At most 64 trees are trained, validating every eight trees and stopping after 24 trees without improvement. Tree count, configuration and Poisson/negative-binomial shape are selected on validation paired count NLL. Test labels never select a model or parameter.

GBDT can activate only if it improves the raw baseline on validation. The user's explicit GBDT selection is labelled experimental when it does not also beat the existing learned model by at least 0.003 validation NLL without reducing exact-score accuracy. Automatic mode requires that stronger gate. The untouched test is reported for both models; it is not consulted by the gate. Production trees are refit on all eligible prior labels after freezing the test report, so the report does not measure the final refit itself.

Example internal comparison, Parma–Udinese 5749726, 10-match window: 2,018 eligible fixtures; 1,385 train / 270 validation / 291 test, after purges. GBDT selected 56 depth-3 trees and negative-binomial shape 30. Held-out exact-score accuracy: existing model 14.09%, GBDT 13.75%; paired NLL: 3.0942 vs 3.0999. GBDT is experimental here, and automatic mode retains the player-network model. These are internal historical measurements, not future or guaranteed exact-score performance.

## Shared inference

Projection uses the same tree inference as simulation. GBDT replaces the legacy extra player multiplier to avoid applying player strength twice. Existing H2H adjustment remains a separate projection layer. Simulations rebuild XI vectors for selected players and every substitution phase, evaluating the same frozen trees and comparing to the projected reference mean. The old heuristic phase multiplier is skipped for GBDT. Future/unknown bench performance stays missing. Actual post-kickoff lineups are explicitly scenarios, not a historical pre-match forecast. Scenario selection, substitutions, H2H and Monte Carlo sampling can make the two modal scores differ.

Training runs in a browser worker so controls remain responsive. Model reports include tree count, parameters, split ranges, feature gains and provenance. Split-gain importance is descriptive, not a causal player-goal attribution.

## Maintenance and verification

`npm run train` retains existing source fixtures, rebuilds the base/graph artifact and adds starter features. `node scripts/build-starter-training.mjs` enriches an existing schema-2 artifact without recollecting fixtures. Writes use a temporary file and atomic rename. Rebuilds must preserve strict as-of timing.

`npm test`: 183 tests passed, including nonlinear interaction learning, deterministic inference, matching selected learning rate, test-label isolation, target-label exclusion, missing/future XI neutralization, confirmed-lineup timing gates, simulation lineup reevaluation and the offline pipeline. Real-fixture checks: `node scripts/check-gbdt-prediction.mjs 5749726 10` and `node scripts/check-gbdt-prediction.mjs 5868102 5`; both passed. Browser QA covered player metric expansion, automatic/explicit model selection and a seeded 10,000-match simulation with no application console errors.

Method reference: https://xgboost.readthedocs.io/en/stable/tutorials/model.html (boosted-tree ensemble and regularized Newton split/leaf equations).
