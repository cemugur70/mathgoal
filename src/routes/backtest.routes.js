/**
 * Backtest API route.
 * POST /backtest — compare model predictions against Excel benchmark rows.
 */

const express = require("express");
const { runBacktest } = require("../services/backtest.service");

const router = express.Router();

router.post("/", (req, res) => {
  try {
    const { benchmarkRows, tolerance = 0.005, fields } = req.body;

    const data = runBacktest({
      benchmarkRows,
      tolerance,
      fields,
    });

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
