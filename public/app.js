/* ═══════════════════════════════════════════════════════
   Mathgoal Dashboard — Frontend Logic v2
   Uses all_columns.txt Turkish mapping
   ═══════════════════════════════════════════════════════ */

const API = "";
const state = { limit: 50, offset: 0, total: 0, selectedMatchId: null, allColumns: [] };

const $ = (id) => document.getElementById(id);
const el = {
  statMatches: $("statMatches"), statLeagues: $("statLeagues"),
  statCountries: $("statCountries"), statFirstDate: $("statFirstDate"),
  statLastDate: $("statLastDate"),
  fSearch: $("fSearch"), fCountry: $("fCountry"), fLeague: $("fLeague"),
  fSeason: $("fSeason"), fDateFrom: $("fDateFrom"), fDateTo: $("fDateTo"),
  fBookmaker: $("fBookmaker"), fOddsType: $("fOddsType"),
  btnApply: $("btnApply"), btnClear: $("btnClear"),
  matchesBody: $("matchesBody"),
  pageInfo: $("pageInfo"), btnPrev: $("btnPrev"), btnNext: $("btnNext"),
  statusText: $("statusText"),
  oddsPanel: $("oddsPanel"), oddsHome: $("oddsHome"), oddsScore: $("oddsScore"),
  oddsAway: $("oddsAway"), oddsInfo: $("oddsInfo"), oddsClose: $("oddsClose"),
  oddsCategoryTabs: $("oddsCategoryTabs"), oddsGrid: $("oddsGrid"),
};

// ─── Helpers ───
function setStatus(msg, type = "loading") {
  el.statusText.className = `status-${type}`;
  el.statusText.innerHTML = type === "loading" ? `<span class="spinner"></span>${msg}` : msg;
}
function fmtDate(v) { return v ? new Date(v).toLocaleDateString("tr-TR") : "-"; }
function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function msClass(r) {
  if (r === "MS 1") return "ms1"; if (r === "MS 0") return "ms0"; if (r === "MS 2") return "ms2"; return "";
}
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function fmtOdds(v) {
  if (v == null || v === "" || v === "-") return "-";
  const n = parseFloat(v); return isNaN(n) ? String(v) : n.toFixed(2);
}

// ─── Overview ───
async function loadOverview() {
  const d = await fetchJSON(`${API}/api/stats/overview`);
  el.statMatches.textContent = d.total_matches ?? 0;
  el.statLeagues.textContent = d.total_leagues ?? 0;
  el.statCountries.textContent = d.total_countries ?? 0;
  el.statFirstDate.textContent = fmtDate(d.first_match_date);
  el.statLastDate.textContent = fmtDate(d.last_match_date);
}

// ─── Build column categories ───
const CATEGORIES = {
  "1X2": ["AÇ 1", "1", "AÇ X", "X", "AÇ 2", "2"],
  "İY 1X2": ["AÇ İY 1", "İY 1", "AÇ İY X", "İY X", "AÇ İY 2", "İY 2"],
  "2Y 1X2": ["AÇ 2Y 1", "2Y 1", "AÇ 2Y X", "2Y X", "AÇ 2Y 2", "2Y 2"],
  "DNB": ["AÇ dnb 1", "dnb 1", "AÇ dnb 2", "dnb 2"],
  "Tek/Çift": ["AÇ Tek", "Tek", "AÇ Çift", "Çift"],
  "İY Tek/Çift": ["AÇ İY Tek", "İY Tek", "AÇ İY Çift", "İY Çift"],
  "2Y Tek/Çift": ["AÇ 2Y Tek", "2Y Tek", "AÇ 2Y Çift", "2Y Çift"],
  "KG Var/Yok": ["AÇ btts true", "btts true", "AÇ btts false", "btts false"],
  "İY KG": ["AÇ İY btts true", "İY btts true", "AÇ İY btts false", "İY btts false"],
  "2Y KG": ["AÇ 2Y btts true", "2Y btts true", "AÇ 2Y btts false", "2Y btts false"],
  "Çifte Şans": ["AÇ dc 1X", "dc 1X", "AÇ dc X2", "dc X2", "AÇ dc 12", "dc 12"],
  "İY Çifte Şans": ["AÇ İY dc 1X", "İY dc 1X", "AÇ İY dc X2", "İY dc X2", "AÇ İY dc 12", "İY dc 12"],
  "İY-MS": ["AÇ ht ft 1 1", "ht ft 1 1", "AÇ ht ft X 1", "ht ft X 1", "AÇ ht ft 2 1", "ht ft 2 1",
    "AÇ ht ft 1 X", "ht ft 1 X", "AÇ ht ft X X", "ht ft X X", "AÇ ht ft 2 X", "ht ft 2 X",
    "AÇ ht ft 1 2", "ht ft 1 2", "AÇ ht ft X 2", "ht ft X 2", "AÇ ht ft 2 2", "ht ft 2 2"],
};

// Dynamic categories (generated from all_columns.txt patterns)
function buildDynCategories(allCols) {
  // Over/Under (main)
  const ouMain = allCols.filter((c) => /^(AÇ )?\d+ \d+ (Üst|Alt)$/.test(c));
  if (ouMain.length) CATEGORIES["Alt/Üst"] = ouMain;
  // Over/Under HT
  const ouHT = allCols.filter((c) => /^(AÇ )?İY \d+ \d+ (Üst|Alt)$/.test(c));
  if (ouHT.length) CATEGORIES["İY Alt/Üst"] = ouHT;
  // Over/Under 2H
  const ou2H = allCols.filter((c) => /^(AÇ )?2Y \d+ \d+ (Üst|Alt)$/.test(c));
  if (ou2H.length) CATEGORIES["2Y Alt/Üst"] = ou2H;
  // Asian Handicap (main)
  const ahMain = allCols.filter((c) => /^(AÇ )?ah (minus )?\d+ \d+ [12]$/.test(c));
  if (ahMain.length) CATEGORIES["Asya Handikap"] = ahMain;
  // Asian Handicap HT
  const ahHT = allCols.filter((c) => /^(AÇ )?İY ah (minus )?\d+ \d+ [12]$/.test(c));
  if (ahHT.length) CATEGORIES["İY Asya H."] = ahHT;
  // European Handicap
  const eh = allCols.filter((c) => /^(AÇ )?(İY )?eh (minus|plus)\d+ [12X]$/.test(c));
  if (eh.length) CATEGORIES["Avrupa H."] = eh;
  // Correct Score Full Time
  const csFT = allCols.filter((c) => /^(AÇ )?full time \d+ \d+$/.test(c));
  if (csFT.length) CATEGORIES["Skor (MS)"] = csFT;
  // Correct Score HT
  const csHT = allCols.filter((c) => /^(AÇ )?İY \d+ \d+$/.test(c) && !/(Üst|Alt)/.test(c));
  if (csHT.length) CATEGORIES["Skor (İY)"] = csHT;
}

// ─── Match Table ───
async function loadMatches() {
  const filters = {};
  if (el.fSearch.value.trim()) filters.search = el.fSearch.value.trim();
  if (el.fCountry.value.trim()) filters.country = el.fCountry.value.trim();
  if (el.fLeague.value.trim()) filters.league = el.fLeague.value.trim();
  if (el.fSeason.value.trim()) filters.season = el.fSeason.value.trim();
  if (el.fDateFrom.value.trim()) filters.dateFrom = el.fDateFrom.value.trim();
  if (el.fDateTo.value.trim()) filters.dateTo = el.fDateTo.value.trim();
  if (el.fBookmaker.value) filters.bookmaker = el.fBookmaker.value;

  const params = new URLSearchParams({ limit: state.limit, offset: state.offset, ...filters });
  const data = await fetchJSON(`${API}/api/matches?${params}`);
  state.total = data.total || 0;

  const bookmaker = el.fBookmaker.value;
  const oddsType = el.fOddsType.value;
  const matchIds = (data.data || []).map((m) => m.match_id);

  // Fetch mapped odds for each visible match
  const oddsMap = {};
  if (matchIds.length) {
    await Promise.all(
      matchIds.map((id) =>
        fetchJSON(`${API}/api/matches/${id}/odds?bookmaker=${bookmaker}`)
          .then((d) => { oddsMap[id] = d.columns || {}; })
          .catch(() => { oddsMap[id] = {}; })
      )
    );
  }

  renderTable(data.data || [], oddsMap, oddsType);
  updatePagination();
}

function filterByOddsType(cols, oddsType) {
  if (oddsType === "all") return cols;
  const BASE = new Set([
    "ide", "TARİH", "GÜN", "SAAT", "HAFTA", "SEZON", "ÜLKE", "LİG",
    "EV SAHİBİ", "DEPLASMAN", "İY", "MS", "İY SONUCU", "MS SONUCU",
    "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK", "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST",
  ]);
  const result = {};
  for (const [k, v] of Object.entries(cols)) {
    if (BASE.has(k)) { result[k] = v; continue; }
    const isOpening = k.startsWith("AÇ ");
    if (oddsType === "opening" && isOpening) result[k] = v;
    else if (oddsType === "closing" && !isOpening) result[k] = v;
  }
  return result;
}

function renderTable(rows, oddsMap, oddsType) {
  if (!rows.length) {
    el.matchesBody.innerHTML = `<tr class="empty-row"><td colspan="12">Kayıt bulunamadı.</td></tr>`;
    return;
  }

  el.matchesBody.innerHTML = rows.map((r) => {
    const score = r.home_score != null ? `${r.home_score} - ${r.away_score}` : "-";
    const cols = filterByOddsType(oddsMap[r.match_id] || {}, oddsType);

    // For table summary: 1X2 and O/U 2.5
    const o1 = fmtOdds(cols["1"] || cols["AÇ 1"]);
    const oX = fmtOdds(cols["X"] || cols["AÇ X"]);
    const o2 = fmtOdds(cols["2"] || cols["AÇ 2"]);
    const ouOver = fmtOdds(cols["2 5 Üst"] || cols["AÇ 2 5 Üst"]);
    const ouUnder = fmtOdds(cols["2 5 Alt"] || cols["AÇ 2 5 Alt"]);
    const ouStr = ouOver !== "-" ? `${ouOver}/${ouUnder}` : "-";
    const iy = cols["İY"] || r.iy || "-";
    const sel = state.selectedMatchId === r.match_id ? " selected" : "";

    return `
      <tr data-id="${r.match_id}" class="${sel}" onclick="selectMatch('${r.match_id}')">
        <td class="text-dim">${fmtDate(r.match_date)}</td>
        <td class="text-dim">${esc(r.match_time || cols["SAAT"] || "-")}</td>
        <td class="text-dim">${esc(r.league || "")}</td>
        <td class="team-name">${esc(r.home_team)}</td>
        <td><span class="score">${esc(score)}</span></td>
        <td class="team-name">${esc(r.away_team)}</td>
        <td><span class="pill ${msClass(r.full_time_result)}">${esc(r.full_time_result || "-")}</span></td>
        <td class="text-dim">${esc(iy)}</td>
        <td class="odds-value">${o1}</td>
        <td class="odds-value">${oX}</td>
        <td class="odds-value">${o2}</td>
        <td class="text-dim">${ouStr}</td>
      </tr>`;
  }).join("");
}

function updatePagination() {
  const from = state.total === 0 ? 0 : state.offset + 1;
  const to = Math.min(state.offset + state.limit, state.total);
  el.pageInfo.textContent = `${from}-${to} / ${state.total}`;
  el.btnPrev.disabled = state.offset <= 0;
  el.btnNext.disabled = state.offset + state.limit >= state.total;
}

// ─── Odds Detail Panel ───
async function selectMatch(matchId) {
  state.selectedMatchId = matchId;
  document.querySelectorAll("tbody tr").forEach((tr) => {
    tr.classList.toggle("selected", tr.dataset.id === matchId);
  });

  const bookmaker = el.fBookmaker.value;
  const oddsType = el.fOddsType.value;
  setStatus("Oran detayları yükleniyor...", "loading");

  try {
    const [match, oddsData] = await Promise.all([
      fetchJSON(`${API}/api/matches/${matchId}`),
      fetchJSON(`${API}/api/matches/${matchId}/odds?bookmaker=${bookmaker}`),
    ]);

    const cols = filterByOddsType(oddsData.columns || {}, oddsType);
    const score = match.home_score != null ? `${match.home_score} - ${match.away_score}` : "vs";

    el.oddsHome.textContent = match.home_team;
    el.oddsScore.textContent = score;
    el.oddsAway.textContent = match.away_team;
    el.oddsInfo.textContent = `${fmtDate(match.match_date)} · ${match.league || ""} · ${bookmaker} · ${oddsType === "opening" ? "Açılış" : oddsType === "closing" ? "Kapanış" : "Tümü"
      }`;

    renderOddsPanel(cols);
    el.oddsPanel.classList.add("active");
    el.oddsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus(`${Object.keys(cols).length} oran yüklendi`, "ok");
  } catch (err) {
    setStatus(`Oran yüklenemedi: ${err.message}`, "err");
  }
}

function renderOddsPanel(cols) {
  // Build categories from data
  const catData = {};
  const catOrder = [
    "1X2", "İY 1X2", "2Y 1X2", "DNB", "Çifte Şans", "İY Çifte Şans",
    "Tek/Çift", "İY Tek/Çift", "2Y Tek/Çift",
    "KG Var/Yok", "İY KG", "2Y KG",
    "Alt/Üst", "İY Alt/Üst", "2Y Alt/Üst",
    "Asya Handikap", "İY Asya H.",
    "Avrupa H.",
    "İY-MS",
    "Skor (MS)", "Skor (İY)",
  ];

  for (const catName of catOrder) {
    const catCols = CATEGORIES[catName];
    if (!catCols) continue;

    const items = [];
    for (const col of catCols) {
      if (cols[col] != null && cols[col] !== "" && cols[col] !== "-") {
        items.push({ label: col, value: cols[col] });
      }
    }
    if (items.length) catData[catName] = items;
  }

  // Check for unmatched columns -> "Diğer"
  const assignedCols = new Set();
  Object.values(CATEGORIES).forEach((arr) => arr.forEach((c) => assignedCols.add(c)));
  const BASE_KEYS = new Set([
    "ide", "TARİH", "GÜN", "SAAT", "HAFTA", "SEZON", "ÜLKE", "LİG",
    "EV SAHİBİ", "DEPLASMAN", "İY", "MS", "İY SONUCU", "MS SONUCU",
    "İY-MS", "2.5 ALT ÜST", "3.5 ÜST", "KG VAR/YOK", "İY 0.5 ALT ÜST", "İY 1.5 ALT ÜST",
  ]);
  const other = [];
  for (const [k, v] of Object.entries(cols)) {
    if (!assignedCols.has(k) && !BASE_KEYS.has(k) && v != null && v !== "") {
      other.push({ label: k, value: v });
    }
  }
  if (other.length) catData["Diğer"] = other;

  // Render tabs
  const catNames = Object.keys(catData);
  el.oddsCategoryTabs.innerHTML = catNames
    .map((name, i) => {
      const count = catData[name].length;
      return `<button class="odds-cat-btn${i === 0 ? " active" : ""}" data-cat="${name}">${name} <span style="opacity:0.5;font-size:0.7rem">(${count})</span></button>`;
    })
    .join("");

  if (catNames.length) {
    renderCategoryCards(catData, catNames[0]);
  } else {
    el.oddsGrid.innerHTML = `<div style="color:var(--text-muted);padding:20px;">Bu bookmaker için oran verisi bulunamadı.</div>`;
  }

  // Tab click
  el.oddsCategoryTabs.querySelectorAll(".odds-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.oddsCategoryTabs.querySelectorAll(".odds-cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderCategoryCards(catData, btn.dataset.cat);
    });
  });
}

function renderCategoryCards(catData, catName) {
  const items = catData[catName] || [];
  if (!items.length) {
    el.oddsGrid.innerHTML = `<div style="color:var(--text-muted);padding:20px;">Veri yok.</div>`;
    return;
  }

  // Group into cards of 10
  const chunks = [];
  for (let i = 0; i < items.length; i += 10) chunks.push(items.slice(i, i + 10));

  el.oddsGrid.innerHTML = chunks.map((chunk, ci) => {
    const rows = chunk.map((item) => {
      const isOpening = item.label.startsWith("AÇ ");
      const tagClass = isOpening ? "tag-opening" : "tag-closing";
      const tagText = isOpening ? "AÇ" : "KP";
      return `
        <div class="odds-row">
          <span class="odds-label">
            <span class="odds-tag ${tagClass}">${tagText}</span>
            ${esc(item.label.replace(/^AÇ /, ""))}
          </span>
          <span class="odds-value">${fmtOdds(item.value)}</span>
        </div>`;
    }).join("");

    const title = chunks.length > 1 ? `${catName} (${ci + 1}/${chunks.length})` : catName;
    return `<div class="odds-card"><div class="odds-card-title">${title}</div>${rows}</div>`;
  }).join("");
}

// ─── Refresh ───
async function refreshAll() {
  setStatus("Veriler yükleniyor...", "loading");
  try {
    await Promise.all([loadOverview(), loadMatches()]);
    setStatus("Hazır", "ok");
  } catch (err) {
    setStatus(`Hata: ${err.message}`, "err");
  }
}

// ─── Events ───
el.btnApply.addEventListener("click", () => { state.offset = 0; state.selectedMatchId = null; el.oddsPanel.classList.remove("active"); refreshAll(); });
el.btnClear.addEventListener("click", () => {
  [el.fSearch, el.fCountry, el.fLeague, el.fSeason, el.fDateFrom, el.fDateTo].forEach((i) => (i.value = ""));
  state.offset = 0; state.selectedMatchId = null; el.oddsPanel.classList.remove("active"); refreshAll();
});
el.btnPrev.addEventListener("click", () => { state.offset = Math.max(0, state.offset - state.limit); refreshAll(); });
el.btnNext.addEventListener("click", () => { state.offset += state.limit; refreshAll(); });
el.oddsClose.addEventListener("click", () => {
  el.oddsPanel.classList.remove("active"); state.selectedMatchId = null;
  document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("selected"));
});
el.fBookmaker.addEventListener("change", () => { refreshAll(); if (state.selectedMatchId) selectMatch(state.selectedMatchId); });
el.fOddsType.addEventListener("change", () => { refreshAll(); if (state.selectedMatchId) selectMatch(state.selectedMatchId); });
document.querySelectorAll(".filter-group input").forEach((input) => {
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { state.offset = 0; refreshAll(); } });
});
window.selectMatch = selectMatch;

// ─── Init ───
(async () => {
  try {
    const colData = await fetchJSON(`${API}/api/columns`);
    state.allColumns = colData.columns || [];
    buildDynCategories(state.allColumns);
  } catch (e) {
    console.warn("all_columns yüklenemedi:", e);
  }
  refreshAll();
})();
