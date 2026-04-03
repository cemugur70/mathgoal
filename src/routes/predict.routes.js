/**
 * Predict API routes.
 * POST /predict       — single match prediction
 * POST /predict/bulk  — batch prediction (max 1000 matches)
 */

const express = require("express");
const { predictMatch } = require("../services/poisson.service");

const router = express.Router();

const MAX_BULK_SIZE = 1000;

/**
 * POST /predict
 * Single match Poisson prediction.
 */
router.post("/", (req, res) => {
  try {
    const data = predictMatch(req.body);
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /predict/bulk
 * Batch prediction — accepts { matches: [...] }, returns array of predictions.
 * Mirrors POISSON_LISTE!A3:AB1003 bulk output structure.
 */
router.post("/bulk", (req, res) => {
  try {
    const { matches } = req.body;

    if (!Array.isArray(matches) || matches.length === 0) {
      throw new Error("matches must be a non-empty array");
    }

    if (matches.length > MAX_BULK_SIZE) {
      throw new Error(`Maximum ${MAX_BULK_SIZE} matches per request`);
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < matches.length; i++) {
      try {
        results.push(predictMatch(matches[i]));
      } catch (err) {
        errors.push({ index: i, error: err.message });
        results.push(null);
      }
    }

    return res.json({
      ok: errors.length === 0,
      count: results.filter(Boolean).length,
      total: matches.length,
      errors: errors.length > 0 ? errors : undefined,
      data: results,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
