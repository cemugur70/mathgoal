# Training publication repair — 29 October 2026

Milan–Bologna (5749720) collection saved its archive, but automatic training failed. Reproducing `scripts/train.mjs` in the production Node 22 container showed `FATAL ERROR: Reached heap limit` in `export-player-graph-source.mjs`. The container's default V8 heap limit was 549,453,824 bytes; no cgroup OOM kill occurred. The old published training artifact remained intact.

The exporter now reads selected top-level archive arrays one record at a time, skipping unrelated metadata. It also computes the canonical array hash incrementally and writes the final source JSON in bounded chunks before atomic rename. This removes whole-archive parsing and whole-source stringification peaks from the growing player-source merge, without discarding historical records or changing conflict/quality rules. No server memory limit was raised.

Regression coverage checks chunk boundaries, escaped strings, UTF-8, nested objects, skipped metadata, truncated input, the canonical SHA-256 hash, retained historical player records and publication preservation after a failed stage. All 197 tests passed (`data/training-memory-fix-tests.log`).

The corrected full pipeline completed in the production container: 4,114 labeled source matches, 5,723 player-source fixtures, 204,453 player records and 5,206 final schema-5 training rows. The new published artifact ID is `e131b3deb1c6fa918b47ba5dcc270862e198347e3939fa9a561e932348c39cab`, created at 2026-10-29T08:49:30.069Z. Milan–Bologna is present. All rows pass strict availability checks for base, player graph, XI, market and market-network evidence. The target's own result is still excluded from its prediction by the existing model policy.

The corrected scripts were baked into the production image, the service recreated successfully and health verified. Deployed script hashes match local files. The new dataset is stored in the persistent public-data volume.

Live browser verification after reload shows the new 5,206-row input, 2,588 eligible prior fixtures, 1,798 training / 341 validation / 387 test fixtures, and both target rows excluded. The Milan–Bologna overview renders its trained forecast without a collection error or captured application console errors. Screenshot: `screenshots/mathgoal-milan-training-repair-live.png`.
