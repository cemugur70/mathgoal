/* ═══════════════════════════════════════════════════════
   Mathgoal Dashboard — Frontend Logic
   ═══════════════════════════════════════════════════════ */

const API = "";  // same origin
const state = { limit: 50, offset: 0, total: 0, selectedMatchId: null };

// ─── DOM References ──────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  // Stats
  statMatches: $("statMatches"),
  statLeagues: $("statLeagues"),
  statCountries: $("statCountries"),
  statFirstDate: $("statFirstDate"),
  statLastDate: $("statLastDate"),
  // Filters
  fSearch: $("fSearch"),
  fCountry: $("fCountry"),
  fLeague: $("fLeague"),
  fSeason: $("fSeason"),
  fDateFrom: $("fDateFrom"),
  fDateTo: $("fDateTo"),
  fBookmaker: $("fBookmaker"),
  fOddsType: $("fOddsType"),
  btnApply: $("btnApply"),
  btnClear: $("btnClear"),
  // Table
  matchesBody: $("matchesBody"),
  // Pagination
  pageInfo: $("pageInfo"),
  btnPrev: $("btnPrev"),
  btnNext: $("btnNext"),
  statusText: $("statusText"),
  // Odds Panel
  oddsPanel: $("oddsPanel"),
  oddsHome: $("oddsHome"),
  oddsScore: $("oddsScore"),
  oddsAway: $("oddsAway"),
  oddsInfo: $("oddsInfo"),
  oddsClose: $("oddsClose"),
  oddsCategoryTabs: $("oddsCategoryTabs"),
  oddsGrid: $("oddsGrid"),
};

// ─── Helpers ─────────────────────────────────────────
function setStatus(msg, type = "loading") {
  el.statusText.className = `status-${type}`;
  el.statusText.innerHTML = type === "loading" ? `<span class="spinner"></span>${msg}` : msg;
}

function fmtDate(v) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("tr-TR");
}

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function msClass(r) {
  if (r === "MS 1") return "ms1";
  if (r === "MS 0") return "ms0";
  if (r === "MS 2") return "ms2";
  return "";
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getFilters() {
  return {
    search: el.fSearch.value.trim(),
    country: el.fCountry.value.trim(),
    league: el.fLeague.value.trim(),
    season: el.fSeason.value.trim(),
    dateFrom: el.fDateFrom.value.trim(),
    dateTo: el.fDateTo.value.trim(),
  };
}

// ─── Overview ────────────────────────────────────────
async function loadOverview() {
  const d = await fetchJSON(`${API}/api/stats/overview`);
  el.statMatches.textContent = d.total_matches ?? 0;
  el.statLeagues.textContent = d.total_leagues ?? 0;
  el.statCountries.textContent = d.total_countries ?? 0;
  el.statFirstDate.textContent = fmtDate(d.first_match_date);
  el.statLastDate.textContent = fmtDate(d.last_match_date);
}

// ─── Match Table ─────────────────────────────────────
async function loadMatches() {
  const filters = getFilters();
  const params = new URLSearchParams({
    limit: String(state.limit),
    offset: String(state.offset),
  });
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  const data = await fetchJSON(`${API}/api/matches?${params}`);
  state.total = data.total || 0;

  // Also load mini-odds for each match from the selected bookmaker
  const bookmaker = el.fBookmaker.value;
  const matchIds = (data.data || []).map((m) => m.match_id);
  const oddsMap = {};

  // Fetch odds for visible matches in parallel (batched)
  if (matchIds.length) {
    const promises = matchIds.map((id) =>
      fetchJSON(`${API}/api/matches/${id}/all-columns?bookmaker=${bookmaker}`)
        .then((d) => { oddsMap[id] = d.raw_data || {}; })
        .catch(() => { oddsMap[id] = {}; })
    );
    await Promise.all(promises);
  }

  renderTable(data.data || [], oddsMap);
  updatePagination();
}

function renderTable(rows, oddsMap) {
  if (!rows.length) {
    el.matchesBody.innerHTML = `<tr class="empty-row"><td colspan="12">Kayıt bulunamadı.</td></tr>`;
    return;
  }

  const oddsType = el.fOddsType.value; // "all", "opening", "closing"
  const bookmaker = el.fBookmaker.value;

  el.matchesBody.innerHTML = rows
    .map((r) => {
      const score = r.home_score != null ? `${r.home_score} - ${r.away_score}` : "-";
      const rd = typeof oddsMap[r.match_id] === "string"
        ? JSON.parse(oddsMap[r.match_id])
        : (oddsMap[r.match_id] || {});

      // Extract 1X2 and O/U odds
      const odds1x2 = extractOdds1x2(rd, bookmaker, oddsType);
      const oddsOU = extractOddsOU(rd, bookmaker, oddsType);
      const iy = rd["İY"] || "-";
      const selected = state.selectedMatchId === r.match_id ? " selected" : "";

      return `
        <tr data-id="${r.match_id}" class="${selected}" onclick="selectMatch('${r.match_id}')">
          <td class="text-dim">${fmtDate(r.match_date)}</td>
          <td class="text-dim">${esc(r.match_time || "-")}</td>
          <td class="text-dim">${esc(r.league || "-")}</td>
          <td class="team-name">${esc(r.home_team)}</td>
          <td><span class="score">${esc(score)}</span></td>
          <td class="team-name">${esc(r.away_team)}</td>
          <td><span class="pill ${msClass(r.full_time_result)}">${esc(r.full_time_result || "-")}</span></td>
          <td class="text-dim">${esc(iy)}</td>
          <td class="odds-value">${odds1x2.home}</td>
          <td class="odds-value">${odds1x2.draw}</td>
          <td class="odds-value">${odds1x2.away}</td>
          <td class="text-dim">${oddsOU}</td>
        </tr>`;
    })
    .join("");
}

function extractOdds1x2(rd, bookmaker, oddsType) {
  const bmLower = bookmaker.toLowerCase();
  let home = "-", draw = "-", away = "-";

  // Closing odds keys
  const cHome = findKey(rd, [`${bookmaker}_home`, `${bmLower}_home`]);
  const cDraw = findKey(rd, [`${bookmaker}_draw`, `${bmLower}_draw`]);
  const cAway = findKey(rd, [`${bookmaker}_away`, `${bmLower}_away`]);

  // Opening odds keys
  const oHome = findKey(rd, [`opening_${bookmaker}_home`, `opening_${bmLower}_home`]);
  const oDraw = findKey(rd, [`opening_${bookmaker}_draw`, `opening_${bmLower}_draw`]);
  const oAway = findKey(rd, [`opening_${bookmaker}_away`, `opening_${bmLower}_away`]);

  if (oddsType === "opening") {
    home = fmtOdds(rd[oHome]);
    draw = fmtOdds(rd[oDraw]);
    away = fmtOdds(rd[oAway]);
  } else if (oddsType === "closing") {
    home = fmtOdds(rd[cHome]);
    draw = fmtOdds(rd[cDraw]);
    away = fmtOdds(rd[cAway]);
  } else {
    // Both: show closing (or opening if closing missing)
    home = fmtOdds(rd[cHome] || rd[oHome]);
    draw = fmtOdds(rd[cDraw] || rd[oDraw]);
    away = fmtOdds(rd[cAway] || rd[oAway]);
  }

  return { home, draw, away };
}

function extractOddsOU(rd, bookmaker, oddsType) {
  const bmLower = bookmaker.toLowerCase();
  const prefix = oddsType === "opening" ? "opening_" : "";
  const cOver = findKey(rd, [`${prefix}${bookmaker}_2_5_over`, `${prefix}${bmLower}_2_5_over`]);
  const cUnder = findKey(rd, [`${prefix}${bookmaker}_2_5_under`, `${prefix}${bmLower}_2_5_under`]);

  if (oddsType === "all") {
    const co = findKey(rd, [`${bookmaker}_2_5_over`, `${bmLower}_2_5_over`]);
    const cu = findKey(rd, [`${bookmaker}_2_5_under`, `${bmLower}_2_5_under`]);
    const oo = findKey(rd, [`opening_${bookmaker}_2_5_over`, `opening_${bmLower}_2_5_over`]);
    const ou = findKey(rd, [`opening_${bookmaker}_2_5_under`, `opening_${bmLower}_2_5_under`]);
    const ov = fmtOdds(rd[co] || rd[oo]);
    const un = fmtOdds(rd[cu] || rd[ou]);
    return ov !== "-" ? `${ov}/${un}` : "-";
  }

  const ov = fmtOdds(rd[cOver]);
  const un = fmtOdds(rd[cUnder]);
  return ov !== "-" ? `${ov}/${un}` : "-";
}

function findKey(obj, candidates) {
  for (const k of candidates) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return k;
  }
  return candidates[0];
}

function fmtOdds(v) {
  if (v == null || v === "" || v === "-") return "-";
  const n = parseFloat(v);
  return isNaN(n) ? String(v) : n.toFixed(2);
}

function updatePagination() {
  const from = state.total === 0 ? 0 : state.offset + 1;
  const to = Math.min(state.offset + state.limit, state.total);
  el.pageInfo.textContent = `${from}-${to} / ${state.total}`;
  el.btnPrev.disabled = state.offset <= 0;
  el.btnNext.disabled = state.offset + state.limit >= state.total;
}

// ─── Odds Detail Panel ───────────────────────────────
async function selectMatch(matchId) {
  state.selectedMatchId = matchId;
  // Highlight row
  document.querySelectorAll("tbody tr").forEach((tr) => {
    tr.classList.toggle("selected", tr.dataset.id === matchId);
  });

  const bookmaker = el.fBookmaker.value;
  const oddsType = el.fOddsType.value;

  setStatus("Oran detayları yükleniyor...", "loading");

  try {
    // Get match info
    const match = await fetchJSON(`${API}/api/matches/${matchId}`);
    const oddsData = await fetchJSON(`${API}/api/matches/${matchId}/all-columns?bookmaker=${bookmaker}`);
    let rd = oddsData.raw_data || {};
    if (typeof rd === "string") rd = JSON.parse(rd);

    const score = match.home_score != null ? `${match.home_score} - ${match.away_score}` : "vs";
    el.oddsHome.textContent = match.home_team;
    el.oddsScore.textContent = score;
    el.oddsAway.textContent = match.away_team;
    el.oddsInfo.textContent = `${fmtDate(match.match_date)} · ${match.league || ""} · ${bookmaker}`;

    renderOddsPanel(rd, bookmaker, oddsType);
    el.oddsPanel.classList.add("active");
    el.oddsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus("Hazır", "ok");
  } catch (err) {
    setStatus(`Oran yüklenemedi: ${err.message}`, "err");
  }
}

function renderOddsPanel(rd, bookmaker, oddsType) {
  const categories = classifyOdds(rd, bookmaker, oddsType);

  // Render tabs
  const catNames = Object.keys(categories);
  el.oddsCategoryTabs.innerHTML = catNames
    .map((name, i) => `<button class="odds-cat-btn${i === 0 ? " active" : ""}" data-cat="${name}">${name}</button>`)
    .join("");

  // Render first category
  if (catNames.length) {
    renderOddsCategory(categories, catNames[0]);
  } else {
    el.oddsGrid.innerHTML = `<div style="color:var(--text-muted);padding:20px;">Bu bookmaker için oran verisi bulunamadı.</div>`;
  }

  // Tab click handlers
  el.oddsCategoryTabs.querySelectorAll(".odds-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.oddsCategoryTabs.querySelectorAll(".odds-cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderOddsCategory(categories, btn.dataset.cat);
    });
  });
}

function classifyOdds(rd, bookmaker, oddsType) {
  const bm = bookmaker;
  const bmLow = bookmaker.toLowerCase();
  const cats = {};

  // Iterate all keys and classify
  for (const [key, val] of Object.entries(rd)) {
    if (val == null || val === "" || val === "-") continue;

    // Skip base info keys
    if (
      ["ide", "bookmaker", "MATCH_ID", "TARİH", "GÜN", "AY", "YIL", "GÜN_ADI",
        "SAAT", "HAFTA", "SEZON", "ÜLKE", "LİG", "EV SAHİBİ", "DEPLASMAN",
        "İY", "MS", "İY SONUCU", "MS SONUCU", "İY-MS", "2.5 ALT ÜST",
        "3.5 ÜST", "KG VAR/YOK", "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST"].includes(key)
    ) continue;

    // Check if this key belongs to the bookmaker
    const keyLow = key.toLowerCase();
    if (!keyLow.includes(bmLow) && !keyLow.includes(bm.toLowerCase())) continue;

    const isOpening = key.startsWith("opening_");

    // Filter by odds type
    if (oddsType === "opening" && !isOpening) continue;
    if (oddsType === "closing" && isOpening) continue;

    // Classify by market
    const cleanKey = key
      .replace(/^opening_/, "")
      .replace(new RegExp(`^${bm}_`, "i"), "")
      .replace(new RegExp(`^${bmLow}_`, "i"), "");

    let category = "Diğer";
    let label = cleanKey;

    if (/^(home|draw|away)$/i.test(cleanKey)) {
      category = "1X2";
      label = cleanKey === "home" ? "1 (Ev)" : cleanKey === "draw" ? "X (Beraberlik)" : "2 (Deplasman)";
    } else if (/^(first_half_home|first_half_draw|first_half_away)$/i.test(cleanKey)) {
      category = "İY 1X2";
      label = cleanKey.replace("first_half_", "").replace("home", "1 (Ev)").replace("draw", "X").replace("away", "2 (Dep)");
    } else if (/^(second_half_home|second_half_draw|second_half_away)$/i.test(cleanKey)) {
      category = "2Y 1X2";
      label = cleanKey.replace("second_half_", "").replace("home", "1 (Ev)").replace("draw", "X").replace("away", "2 (Dep)");
    } else if (/\d+_\d+_(over|under)$/i.test(cleanKey) && /first_half/i.test(cleanKey)) {
      category = "İY Alt/Üst";
      label = cleanKey.replace("first_half_", "").replace("_", ".").replace("_over", " Üst").replace("_under", " Alt");
    } else if (/\d+_\d+_(over|under)$/i.test(cleanKey) && !/first_half|second_half/i.test(cleanKey)) {
      category = "Alt/Üst";
      label = cleanKey.replace("_", ".").replace("_over", " Üst").replace("_under", " Alt");
    } else if (/^ah_/i.test(cleanKey)) {
      category = "Asya Handikap";
      label = cleanKey.replace("ah_", "AH ").replace(/_/g, ".").replace(".home", " Ev").replace(".away", " Dep");
    } else if (/home_draw|home_away|away_draw|draw_no_bet/i.test(cleanKey)) {
      category = "Çifte Şans / DNB";
      label = cleanKey.replace(/_/g, " ").replace("odds", "").trim();
    } else if (/^(yes|no)$/i.test(cleanKey)) {
      category = "KG Var/Yok";
      label = cleanKey === "yes" ? "KG Var" : "KG Yok";
    } else if (/^(odd|even)$/i.test(cleanKey)) {
      category = "Tek/Çift";
      label = cleanKey === "odd" ? "Tek" : "Çift";
    } else if (/(first_half.*home_draw|first_half.*away_draw|first_half.*home_away)/i.test(cleanKey)) {
      category = "İY Çifte Şans";
      label = cleanKey.replace(/_/g, " ").replace("first half ", "").replace("odds", "").trim();
    } else if (/correct_score|cs_/i.test(cleanKey)) {
      category = "Skor Tahmini";
      label = cleanKey.replace("correct_score_", "").replace("cs_", "").replace(/_/g, ":");
    } else if (/european|eh_/i.test(cleanKey)) {
      category = "Avrupa Handikap";
      label = cleanKey.replace("european_", "").replace("eh_", "EH ").replace(/_/g, " ");
    } else if (/ht_ft|half_full/i.test(cleanKey)) {
      category = "İY-MS";
      label = cleanKey.replace(/_/g, " ");
    } else if (/\+\d|\-\d/i.test(cleanKey) || /handicap/i.test(cleanKey)) {
      category = "Asya Handikap";
      label = cleanKey.replace(/_/g, " ");
    }

    const tag = isOpening ? "Açılış" : "Kapanış";
    if (!cats[category]) cats[category] = [];
    cats[category].push({ label, value: val, tag, isOpening });
  }

  // Sort categories
  const order = ["1X2", "Alt/Üst", "KG Var/Yok", "Asya Handikap", "Çifte Şans / DNB", "Tek/Çift", "İY 1X2", "İY Alt/Üst", "2Y 1X2", "İY Çifte Şans", "Avrupa Handikap", "Skor Tahmini", "İY-MS", "Diğer"];
  const sorted = {};
  for (const cat of order) {
    if (cats[cat]) sorted[cat] = cats[cat];
  }
  // Add any remaining
  for (const cat of Object.keys(cats)) {
    if (!sorted[cat]) sorted[cat] = cats[cat];
  }
  return sorted;
}

function renderOddsCategory(categories, catName) {
  const items = categories[catName] || [];
  if (!items.length) {
    el.oddsGrid.innerHTML = `<div style="color:var(--text-muted);padding:20px;">Bu kategoride oran bulunamadı.</div>`;
    return;
  }

  // Group items into cards of max 8 items
  const chunkSize = 8;
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  el.oddsGrid.innerHTML = chunks
    .map((chunk, ci) => {
      const rows = chunk
        .map((item) => {
          const tagHtml = item.tag
            ? `<span class="odds-tag ${item.isOpening ? "tag-opening" : "tag-closing"}">${item.tag}</span>`
            : "";
          return `
            <div class="odds-row">
              <span class="odds-label">${esc(item.label)} ${tagHtml}</span>
              <span class="odds-value">${fmtOdds(item.value)}</span>
            </div>`;
        })
        .join("");

      const title = chunks.length > 1 ? `${catName} (${ci + 1}/${chunks.length})` : catName;
      return `
        <div class="odds-card">
          <div class="odds-card-title">${title}</div>
          ${rows}
        </div>`;
    })
    .join("");
}

// ─── Refresh All ─────────────────────────────────────
async function refreshAll() {
  setStatus("Veriler yükleniyor...", "loading");
  try {
    await Promise.all([loadOverview(), loadMatches()]);
    setStatus("Hazır", "ok");
  } catch (err) {
    setStatus(`Hata: ${err.message}`, "err");
  }
}

// ─── Events ──────────────────────────────────────────
el.btnApply.addEventListener("click", () => {
  state.offset = 0;
  state.selectedMatchId = null;
  el.oddsPanel.classList.remove("active");
  refreshAll();
});

el.btnClear.addEventListener("click", () => {
  el.fSearch.value = "";
  el.fCountry.value = "";
  el.fLeague.value = "";
  el.fSeason.value = "";
  el.fDateFrom.value = "";
  el.fDateTo.value = "";
  state.offset = 0;
  state.selectedMatchId = null;
  el.oddsPanel.classList.remove("active");
  refreshAll();
});

el.btnPrev.addEventListener("click", () => {
  state.offset = Math.max(0, state.offset - state.limit);
  refreshAll();
});

el.btnNext.addEventListener("click", () => {
  state.offset += state.limit;
  refreshAll();
});

el.oddsClose.addEventListener("click", () => {
  el.oddsPanel.classList.remove("active");
  state.selectedMatchId = null;
  document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("selected"));
});

// Re-render odds when bookmaker or odds type changes
el.fBookmaker.addEventListener("change", () => {
  refreshAll();
  if (state.selectedMatchId) selectMatch(state.selectedMatchId);
});

el.fOddsType.addEventListener("change", () => {
  refreshAll();
  if (state.selectedMatchId) selectMatch(state.selectedMatchId);
});

// Enter key on filters
document.querySelectorAll(".filter-group input").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { state.offset = 0; refreshAll(); }
  });
});

// Make selectMatch globally accessible
window.selectMatch = selectMatch;

// ─── Init ────────────────────────────────────────────
refreshAll();
