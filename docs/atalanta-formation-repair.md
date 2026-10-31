# Atalanta official lineup validation

Fixture 5749722 failed because Atalanta's previous official XI (5749710) contains two players recorded with the usual role “defender”, six “midfielders” and two “forwards”. The raw official lineup records a 4-2-3-1: Raoul Bellanova and Davide Zappacosta occupy the fullback slots (position IDs 32 and 38), despite their usual midfield role. Counting usual roles as a tactical formation incorrectly rejected this XI.

Simulation preparation now attaches the strictly prior official starting XI as evidence, requiring eleven distinct recorded starters matching the starter feature builder's baseline. Validation accepts the same usual-role distribution as that verified official XI, including position-preserving replacements. This does not relabel players or change GBDT inputs. Formation minimums still apply to different manual role distributions. Exactly one keeper, eleven distinct eligible players, known roles and correct team membership remain mandatory. Target/future/unavailable/incomplete evidence cannot waive the minimums.

The UI explains the distinction between usual roles and official formation. All 202 tests pass. New regression coverage verifies a two-defender official role distribution, unchanged role labels, working simulation, rejection without source evidence, target/future/duplicate references, incompatible manual changes and unavailable players. No training-feature schema or learned parameters change, so a dataset rebuild is unnecessary.

The real-fixture checker passed with active 255-input Obsidian GBDT, unchanged Bellanova/Zappacosta role labels, the prior official XI and 10,000 simulations. Report: `data/atalanta-formation-verification.json`. UI release 2026-10-29.5 is deployed; production module hashes match local files and the service is healthy.

The same checker passed inside the production container against the current published artifact `aadcc649ee032c1497af2ec7666b2258bce020fd028c9794640518865aebc507`. It completes 10,000 simulations with the verified prior XI and 255 features. Production log: `data/atalanta-production-verification.log`.

Live browser verification also completes 10,000 iterations with active Obsidian GBDT and no captured application console errors. Screenshot: `screenshots/mathgoal-atalanta-formation-fixed-live.png`.
