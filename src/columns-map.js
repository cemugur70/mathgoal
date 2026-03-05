/**
 * Maps English raw_data keys from the scraper to Turkish column names
 * defined in all_columns.txt.
 *
 * Pattern:
 *   Raw data key:  bet365_home  ->  Turkish column: "1"
 *   Raw data key:  opening_bet365_home  ->  Turkish column: "AÇ 1"
 */

const fs = require("node:fs");
const path = require("node:path");

// Load all_columns.txt
const ALL_COLUMNS_FILE = path.resolve(__dirname, "..", "all_columns.txt");
let ALL_COLUMNS = [];
try {
    ALL_COLUMNS = fs
        .readFileSync(ALL_COLUMNS_FILE, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
} catch (e) {
    console.warn("all_columns.txt yüklenemedi:", e.message);
}

/**
 * Build a mapping from English raw_data keys to Turkish column names.
 * We strip the bookmaker prefix and "opening_" prefix, then map the
 * remaining suffix to the corresponding Turkish column.
 */

// English suffix -> Turkish column name
const SUFFIX_MAP = {
    // 1X2
    home: "1", draw: "X", away: "2",
    // Half-time 1X2
    first_half_home: "İY 1", first_half_draw: "İY X", first_half_away: "İY 2",
    // Second half 1X2
    second_half_home: "2Y 1", second_half_draw: "2Y X", second_half_away: "2Y 2",
    // Draw No Bet
    dnb_home: "dnb 1", dnb_away: "dnb 2",
    draw_no_bet_home: "dnb 1", draw_no_bet_away: "dnb 2",
    // Odd/Even
    odd: "Tek", even: "Çift",
    first_half_odd: "İY Tek", first_half_even: "İY Çift",
    second_half_odd: "2Y Tek", second_half_even: "2Y Çift",
    // BTTS
    yes: "btts true", no: "btts false",
    btts_yes: "btts true", btts_no: "btts false",
    first_half_yes: "İY btts true", first_half_no: "İY btts false",
    first_half_btts_yes: "İY btts true", first_half_btts_no: "İY btts false",
    second_half_yes: "2Y btts true", second_half_no: "2Y btts false",
    second_half_btts_yes: "2Y btts true", second_half_btts_no: "2Y btts false",
    // Double Chance
    home_draw_odds: "dc 1X", home_away_odds: "dc 12", away_draw_odds: "dc X2",
    home_draw: "dc 1X", home_away: "dc 12", away_draw: "dc X2",
    first_half_home_draw_odds: "İY dc 1X", first_half_home_away_odds: "İY dc 12", first_half_away_draw_odds: "İY dc X2",
    first_half_home_draw: "İY dc 1X", first_half_home_away: "İY dc 12", first_half_away_draw: "İY dc X2",
};

// Over/Under patterns (e.g., 0_5_over -> "0 5 Üst")
function overUnderKey(line) {
    // Match: 0_5_over, 2_5_under, first_half_1_5_over, second_half_0_5_under
    const m = line.match(
        /^(first_half_|second_half_)?(\d+)_(\d+)_(over|under)$/
    );
    if (!m) return null;
    const prefix = m[1] === "first_half_" ? "İY " : m[1] === "second_half_" ? "2Y " : "";
    const num = `${m[2]} ${m[3]}`;
    const dir = m[4] === "over" ? "Üst" : "Alt";
    return `${prefix}${num} ${dir}`;
}

// Asian Handicap patterns (e.g., ah_0_0_home -> "ah 0 0 1")
function asianHandicapKey(line) {
    const m = line.match(
        /^(first_half_|second_half_)?ah_(minus_)?(\d+)_(\d+)_(home|away)$/
    );
    if (!m) return null;
    const prefix = m[1] === "first_half_" ? "İY " : m[1] === "second_half_" ? "2Y " : "";
    const minus = m[2] ? "minus " : "";
    const num = `${m[3]} ${m[4]}`;
    const side = m[5] === "home" ? "1" : "2";
    return `${prefix}ah ${minus}${num} ${side}`;
}

// European Handicap patterns
function europeanHandicapKey(line) {
    const m = line.match(
        /^(first_half_|second_half_)?eh_(minus|plus)(\d+)_(home|draw|away|1|2|X)$/i
    );
    if (!m) return null;
    const prefix = m[1] === "first_half_" ? "İY " : m[1] === "second_half_" ? "2Y " : "";
    const sign = m[2] === "minus" ? "minus" : "plus";
    const num = m[3];
    const sideMap = { home: "1", "1": "1", draw: "X", X: "X", away: "2", "2": "2" };
    const side = sideMap[m[4]] || m[4];
    return `${prefix}eh ${sign}${num} ${side}`;
}

// Half-time/Full-time (e.g., ht_ft_1_1 -> "ht ft 1 1")
function htFtKey(line) {
    const m = line.match(/^ht_ft_([12X])_([12X])$/i);
    if (!m) return null;
    return `ht ft ${m[1]} ${m[2]}`;
}

// Correct score (e.g., correct_score_1_0 -> "full time 1 0", first_half_correct_score_0_0 -> "İY 0 0")
function correctScoreKey(line) {
    const m = line.match(
        /^(first_half_|second_half_)?(?:correct_score_|cs_)?(\d+)_(\d+)$/
    );
    if (!m) return null;
    if (m[1] === "first_half_") return `İY ${m[2]} ${m[3]}`;
    if (m[1] === "second_half_") return `2Y ${m[2]} ${m[3]}`;
    return `full time ${m[2]} ${m[3]}`;
}

// 3-way over/under (3_0_over -> "3 0 Üst")
function threeWayOUKey(line) {
    const m = line.match(/^(\d+)_(\d+)_(over|under)$/);
    if (!m) return null;
    return `${m[1]} ${m[2]} ${m[3] === "over" ? "Üst" : "Alt"}`;
}

/**
 * Transform a raw_data dict:
 * - Strip bookmaker prefix from each key
 * - Map opening_ prefix to "AÇ " prefix
 * - Apply suffix mapping
 *
 * Returns a dict keyed by all_columns.txt Turkish names.
 */
function mapRawToColumns(rawData, bookmaker) {
    if (!rawData || typeof rawData !== "object") return {};

    const bm = bookmaker || "";
    const bmLow = bm.toLowerCase();
    const result = {};

    // Copy base fields directly
    const BASE_KEYS = new Set([
        "ide", "TARİH", "GÜN", "SAAT", "HAFTA", "SEZON", "ÜLKE", "LİG",
        "EV SAHİBİ", "DEPLASMAN", "İY", "MS", "İY SONUCU", "MS SONUCU",
        "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK",
        "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST",
    ]);

    for (const [key, val] of Object.entries(rawData)) {
        if (val == null || val === "" || val === "-") continue;

        // Pass through base keys
        if (BASE_KEYS.has(key)) {
            result[key] = val;
            continue;
        }

        // Determine if opening
        let cleanKey = key;
        let isOpening = false;
        if (cleanKey.startsWith("opening_")) {
            cleanKey = cleanKey.slice(8);
            isOpening = true;
        }

        // Strip bookmaker prefix
        if (cleanKey.startsWith(`${bm}_`)) {
            cleanKey = cleanKey.slice(bm.length + 1);
        } else if (cleanKey.startsWith(`${bmLow}_`)) {
            cleanKey = cleanKey.slice(bmLow.length + 1);
        } else {
            // Not from this bookmaker, skip
            continue;
        }

        // Map suffix to Turkish
        let turCol = SUFFIX_MAP[cleanKey];
        if (!turCol) turCol = overUnderKey(cleanKey);
        if (!turCol) turCol = asianHandicapKey(cleanKey);
        if (!turCol) turCol = europeanHandicapKey(cleanKey);
        if (!turCol) turCol = htFtKey(cleanKey);
        if (!turCol) turCol = correctScoreKey(cleanKey);
        if (!turCol) turCol = threeWayOUKey(cleanKey);

        if (turCol) {
            const finalCol = isOpening ? `AÇ ${turCol}` : turCol;
            result[finalCol] = val;
        }
    }

    return result;
}

module.exports = { ALL_COLUMNS, mapRawToColumns };
