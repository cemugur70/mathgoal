/* ═══════════════════════════════════════════════════════
   Mathgoal Dashboard — Frontend Logic v3
   Tabs: Matches + Statistics
   Advanced column/odds filters
   ═══════════════════════════════════════════════════════ */

const API = "";
const state = {
  limit: 100,
  pageIndex: 0,
  currentPageCount: 0,
  hasMoreMatches: false,
  nextMatchesCursor: null,
  matchCursorStack: [null],
  selectedMatchId: null,
  allColumns: [],
  activeTab: "matchesTab",
  overviewCacheKey: "",
  overviewCacheData: null,
  currentRows: [],
  matchDetailCache: new Map(),
  matchDetailRequestId: 0,
};

const $ = (id) => document.getElementById(id);
const el = {
  statMatches: $("statMatches"), statLeagues: $("statLeagues"),
  statCountries: $("statCountries"), statFirstDate: $("statFirstDate"),
  statLastDate: $("statLastDate"), statOdds: $("statOdds"),
  fSearch: $("fSearch"), fCountry: $("fCountry"), fLeague: $("fLeague"),
  fSeason: $("fSeason"), fDateFrom: $("fDateFrom"), fDateTo: $("fDateTo"),
  fBookmaker: $("fBookmaker"), fOddsType: $("fOddsType"), fResult: $("fResult"),
  btnApply: $("btnApply"), btnClear: $("btnClear"),
  matchesBody: $("matchesBody"),
  pageInfo: $("pageInfo"), btnPrev: $("btnPrev"), btnNext: $("btnNext"),
  statusText: $("statusText"),
  oddsPanel: $("oddsPanel"), oddsHome: $("oddsHome"), oddsScore: $("oddsScore"),
  oddsAway: $("oddsAway"), oddsInfo: $("oddsInfo"), oddsClose: $("oddsClose"),
  oddsCategoryTabs: $("oddsCategoryTabs"), oddsGrid: $("oddsGrid"),
  advToggle: $("advToggle"), advFilters: $("advFilters"), advFiltersGrid: $("advFiltersGrid"),
  statsGrid: $("statsGrid"), statsTotalMatches: $("statsTotalMatches"),
  statsTotalBadge: $("statsTotalBadge"), statsBookmaker: $("statsBookmaker"),
  fUpcomingOnly: $("fUpcomingOnly"),
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

function resetMatchPagination() {
  state.pageIndex = 0;
  state.currentPageCount = 0;
  state.hasMoreMatches = false;
  state.nextMatchesCursor = null;
  state.matchCursorStack = [null];
  state.currentRows = [];
}

function getCurrentMatchCursor() {
  return state.matchCursorStack[state.pageIndex] || null;
}

function clearSelectedMatch() {
  state.selectedMatchId = null;
  state.matchDetailRequestId += 1;
  el.oddsPanel.classList.remove("active");
  document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("selected"));
}

// ─── Tab Navigation ───
document.querySelectorAll(".main-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".main-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const tab = document.getElementById(btn.dataset.tab);
    if (tab) tab.classList.add("active");
    state.activeTab = btn.dataset.tab;
    if (state.activeTab === "statsTab") loadMarketStats();
  });
});

// ─── Advanced Filters Toggle ───
el.advToggle.addEventListener("click", () => {
  const isOpen = el.advFilters.classList.toggle("open");
  el.advToggle.classList.toggle("open", isOpen);
  el.advToggle.setAttribute("aria-expanded", String(isOpen));
});

// ─── Build Advanced Odds Filters ───
const ADV_ODDS_FILTERS = [
  // MS 1X2
  { id: "odds_1", label: "1 (Ev Kazanır)" },
  { id: "odds_x", label: "X (Beraberlik)" },
  { id: "odds_2", label: "2 (Dep. Kazanır)" },
  
  // IY 1X2
  { id: "odds_iy_1", label: "İY 1" },
  { id: "odds_iy_x", label: "İY X" },
  { id: "odds_iy_2", label: "İY 2" },

  // 2Y 1X2
  { id: "odds_2y_1", label: "2Y 1" },
  { id: "odds_2y_x", label: "2Y X" },
  { id: "odds_2y_2", label: "2Y 2" },

  // Çifte Şans
  { id: "odds_dc_1x", label: "Çifte Şans 1X" },
  { id: "odds_dc_12", label: "Çifte Şans 12" },
  { id: "odds_dc_x2", label: "Çifte Şans X2" },

  // İY Çifte Şans
  { id: "odds_iy_dc_1x", label: "İY Çifte Şans 1X" },
  { id: "odds_iy_dc_12", label: "İY Çifte Şans 12" },
  { id: "odds_iy_dc_x2", label: "İY Çifte Şans X2" },

  // DNB (Beraberlikte İade)
  { id: "odds_dnb_1", label: "DNB 1 (Beraberlikte İade)" },
  { id: "odds_dnb_2", label: "DNB 2 (Beraberlikte İade)" },

  // BTTS (Karşılıklı Gol)
  { id: "odds_btts_yes", label: "KG VAR" },
  { id: "odds_btts_no", label: "KG YOK" },
  { id: "odds_iy_btts_yes", label: "İY KG VAR" },
  { id: "odds_iy_btts_no", label: "İY KG YOK" },

  // Tek/Çift
  { id: "odds_odd", label: "Tek" },
  { id: "odds_even", label: "Çift" },
  { id: "odds_iy_odd", label: "İY Tek" },
  { id: "odds_iy_even", label: "İY Çift" },

  // Alt/Üst
  { id: "odds_ou05_over", label: "0.5 Üst" },
  { id: "odds_ou05_under", label: "0.5 Alt" },
  { id: "odds_ou15_over", label: "1.5 Üst" },
  { id: "odds_ou15_under", label: "1.5 Alt" },
  { id: "odds_ou25_over", label: "2.5 Üst" },
  { id: "odds_ou25_under", label: "2.5 Alt" },
  { id: "odds_ou35_over", label: "3.5 Üst" },
  { id: "odds_ou35_under", label: "3.5 Alt" },
  { id: "odds_ou45_over", label: "4.5 Üst" },
  { id: "odds_ou45_under", label: "4.5 Alt" },

  // Asya Handikap (AH)
  { id: "odds_ah_minus_15_1", label: "AH -1.5 (1)" },
  { id: "odds_ah_minus_15_2", label: "AH -1.5 (2)" },
  { id: "odds_ah_minus_10_1", label: "AH -1.0 (1)" },
  { id: "odds_ah_minus_10_2", label: "AH -1.0 (2)" },
  { id: "odds_ah_minus_05_1", label: "AH -0.5 (1)" },
  { id: "odds_ah_minus_05_2", label: "AH -0.5 (2)" },
  { id: "odds_ah_00_1", label: "AH 0.0 (1)" },
  { id: "odds_ah_00_2", label: "AH 0.0 (2)" },
  { id: "odds_ah_plus_05_1", label: "AH +0.5 (1)" },
  { id: "odds_ah_plus_05_2", label: "AH +0.5 (2)" },
  { id: "odds_ah_plus_10_1", label: "AH +1.0 (1)" },
  { id: "odds_ah_plus_10_2", label: "AH +1.0 (2)" },
  { id: "odds_ah_plus_15_1", label: "AH +1.5 (1)" },
  { id: "odds_ah_plus_15_2", label: "AH +1.5 (2)" },

  // Avrupa Handikap (EH)
  { id: "odds_eh_minus_1_1", label: "EH -1 (1)" },
  { id: "odds_eh_minus_1_x", label: "EH -1 (X)" },
  { id: "odds_eh_minus_1_2", label: "EH -1 (2)" },
  { id: "odds_eh_plus_1_1", label: "EH +1 (1)" },
  { id: "odds_eh_plus_1_x", label: "EH +1 (X)" },
  { id: "odds_eh_plus_1_2", label: "EH +1 (2)" },

  // İY Alt/Üst
  { id: "odds_iy_ou05_over", label: "İY 0.5 Üst" },
  { id: "odds_iy_ou05_under", label: "İY 0.5 Alt" },
  { id: "odds_iy_ou15_over", label: "İY 1.5 Üst" },
  { id: "odds_iy_ou15_under", label: "İY 1.5 Alt" },
  { id: "odds_iy_ou25_over", label: "İY 2.5 Üst" },
  { id: "odds_iy_ou25_under", label: "İY 2.5 Alt" },
];

function buildAdvFilters() {
  const groups = {
    "Maç & Taraf Seçimi": [],
    "İlk / İkinci Yarı": [],
    "Alt / Üst Gol": [],
    "Handikap (AH & EH)": [],
    "Geniş Marketler": [],
  };

  ADV_ODDS_FILTERS.forEach(f => {
    if (f.id.startsWith("odds_ah_") || f.id.startsWith("odds_eh_")) groups["Handikap (AH & EH)"].push(f);
    else if (f.id.includes("ou")) groups["Alt / Üst Gol"].push(f);
    else if (f.id.startsWith("odds_iy_") || f.id.startsWith("odds_2y_")) groups["İlk / İkinci Yarı"].push(f);
    else if (f.id.includes("btts") || f.id.includes("odd") || f.id.includes("even")) groups["Geniş Marketler"].push(f);
    else groups["Maç & Taraf Seçimi"].push(f);
  });

  let html = "";
  for (const [groupName, filters] of Object.entries(groups)) {
    if (filters.length === 0) continue;
    
    const itemsHtml = filters.map(f => {
      const inputHtml = `<div style="display:flex; align-items:center; background:var(--bg-2); border:1px solid var(--border); border-radius:6px; overflow:hidden; transition:border-color 0.2s;">
             <input type="text" placeholder="-" id="${f.id}_minus" style="flex:1; min-width:0; padding:8px 4px; background:transparent; border:none; border-right:1px solid rgba(255,255,255,0.05); color:#fca5a5; font-size:0.8rem; outline:none; text-align:center;" title="Alt Sapma (Eksi)" inputmode="decimal" />
             <input type="text" placeholder="Merkez" id="${f.id}" style="flex:1.4; min-width:0; padding:8px 4px; background:transparent; border:none; color:var(--accent); font-weight:700; font-size:0.85rem; outline:none; text-align:center;" title="Merkez Değer" inputmode="decimal" />
             <input type="text" placeholder="+" id="${f.id}_plus" style="flex:1; min-width:0; padding:8px 4px; background:transparent; border:none; border-left:1px solid rgba(255,255,255,0.05); color:#6ee7b7; font-size:0.8rem; outline:none; text-align:center;" title="Üst Sapma (Artı)" inputmode="decimal" />
           </div>`;

      return `
        <div class="adv-filter-item">
          <label style="font-size: 0.72rem; color: var(--text-dim); display:block; margin-bottom: 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.label}</label>
          ${inputHtml}
        </div>
      `;
    }).join("");

    html += `
      <div style="background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 16px;">
        <h4 style="margin: 0 0 14px 0; font-size: 0.85rem; color: var(--accent); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent);"></div>
          ${groupName}
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }
  
  el.advFiltersGrid.style.display = "grid";
  el.advFiltersGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(350px, 1fr))";
  el.advFiltersGrid.style.gap = "20px";
  el.advFiltersGrid.innerHTML = html;
}
buildAdvFilters();

function getAdvFilters() {
  const filters = {};
  
  // Helper to parse localized numbers (e.g. "40,5" -> 40.5)
  const parseLocalFloat = (str) => {
    if (!str) return NaN;
    return parseFloat(str.toString().replace(/,/g, '.'));
  };

  ADV_ODDS_FILTERS.forEach(f => {
    const elId = document.getElementById(f.id);
    if (!elId || !elId.value) return;

    const val = parseLocalFloat(elId.value);
    if (!isNaN(val)) {
      const minusEl = document.getElementById(f.id + "_minus");
      const plusEl = document.getElementById(f.id + "_plus");
      
      const minusVal = parseLocalFloat(minusEl?.value);
      const plusVal = parseLocalFloat(plusEl?.value);
      
      const m = !isNaN(minusVal) ? Math.abs(minusVal) : 0;
      const p = !isNaN(plusVal) ? Math.abs(plusVal) : 0;
      
      if (m === 0 && p === 0) {
        filters[f.id] = val;
      } else {
        filters[`${f.id}_min`] = Number((val - m).toFixed(2));
        filters[`${f.id}_max`] = Number((val + p).toFixed(2));
      }
    }
  });
  return filters;
}

// Map adv filter IDs to Turkish column names
const ADV_COLUMN_MAP = {
  odds_1: ["1", "AÇ 1"],
  odds_x: ["X", "AÇ X"],
  odds_2: ["2", "AÇ 2"],
  odds_ou25_over: ["2 5 Üst", "AÇ 2 5 Üst"],
  odds_ou25_under: ["2 5 Alt", "AÇ 2 5 Alt"],
  odds_btts_yes: ["btts true", "AÇ btts true"],
  odds_btts_no: ["btts false", "AÇ btts false"],
  odds_dc_1x: ["dc 1X", "AÇ dc 1X"],
  odds_dc_x2: ["dc X2", "AÇ dc X2"],
  odds_dc_12: ["dc 12", "AÇ dc 12"],
  odds_iy_1: ["İY 1", "AÇ İY 1"],
  odds_iy_x: ["İY X", "AÇ İY X"],
  odds_iy_2: ["İY 2", "AÇ İY 2"],
  odds_ou15_over: ["1 5 Üst", "AÇ 1 5 Üst"],
  odds_ou35_over: ["3 5 Üst", "AÇ 3 5 Üst"],
};

function matchesAdvFilters(cols, advFilters) {
  for (const [filterId, range] of Object.entries(advFilters)) {
    const colNames = ADV_COLUMN_MAP[filterId];
    if (!colNames) continue;
    let val = null;
    for (const cn of colNames) {
      if (cols[cn] != null && cols[cn] !== "" && cols[cn] !== "-") {
        val = parseFloat(cols[cn]);
        break;
      }
    }
    if (val == null || isNaN(val)) return false;
    if (range.min != null && val < range.min) return false;
    if (range.max != null && val > range.max) return false;
  }
  return true;
}

// ─── Load Filter Options ───
async function loadFilterOptions() {
  try {
    const data = await fetchJSON(`${API}/api/filters/options`);
    if (data.countries) {
      const current = el.fCountry.value;
      el.fCountry.innerHTML = '<option value="">Tümü</option>' +
        data.countries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      el.fCountry.value = current;
    }
    if (data.leagues) {
      const current = el.fLeague.value;
      el.fLeague.innerHTML = '<option value="">Tümü</option>' +
        data.leagues.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
      el.fLeague.value = current;
    }
    if (data.seasons) {
      const current = el.fSeason.value;
      el.fSeason.innerHTML = '<option value="">Tümü</option>' +
        data.seasons.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
      el.fSeason.value = current;
    }
  } catch (e) { console.warn("Filter options yüklenemedi:", e); }
}

// ─── Overview ───
function applyOverview(d) {
  el.statMatches.textContent = (d.total_matches ?? 0).toLocaleString("tr-TR");
  el.statLeagues.textContent = (d.total_leagues ?? 0).toLocaleString("tr-TR");
  el.statCountries.textContent = d.total_countries ?? 0;
  el.statFirstDate.textContent = fmtDate(d.first_match_date);
  el.statLastDate.textContent = fmtDate(d.last_match_date);
  el.statOdds.textContent = (d.total_odds ?? 0).toLocaleString("tr-TR");
}

function getOverviewFilters() {
  const filters = getBaseFilters();
  delete filters.order;
  return filters;
}

async function loadOverview() {
  const filters = getOverviewFilters();
  const params = new URLSearchParams(filters);
  const cacheKey = params.toString();

  if (state.overviewCacheKey === cacheKey && state.overviewCacheData) {
    applyOverview(state.overviewCacheData);
    return state.overviewCacheData;
  }

  const data = await fetchJSON(`${API}/api/stats/overview?${params}`);
  state.overviewCacheKey = cacheKey;
  state.overviewCacheData = data;
  applyOverview(data);
  return data;
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

function buildDynCategories(allCols) {
  const ouMain = allCols.filter((c) => /^(AÇ )?\d+ \d+ (Üst|Alt)$/.test(c));
  if (ouMain.length) CATEGORIES["Alt/Üst"] = ouMain;
  const ouHT = allCols.filter((c) => /^(AÇ )?İY \d+ \d+ (Üst|Alt)$/.test(c));
  if (ouHT.length) CATEGORIES["İY Alt/Üst"] = ouHT;
  const ou2H = allCols.filter((c) => /^(AÇ )?2Y \d+ \d+ (Üst|Alt)$/.test(c));
  if (ou2H.length) CATEGORIES["2Y Alt/Üst"] = ou2H;
  const ahMain = allCols.filter((c) => /^(AÇ )?ah (minus )?\d+ \d+ [12]$/.test(c));
  if (ahMain.length) CATEGORIES["Asya Handikap"] = ahMain;
  const ahHT = allCols.filter((c) => /^(AÇ )?İY ah (minus )?\d+ \d+ [12]$/.test(c));
  if (ahHT.length) CATEGORIES["İY Asya H."] = ahHT;
  const eh = allCols.filter((c) => /^(AÇ )?(İY )?eh (minus|plus)\d+ [12X]$/.test(c));
  if (eh.length) CATEGORIES["Avrupa H."] = eh;
  const csFT = allCols.filter((c) => /^(AÇ )?full time \d+ \d+$/.test(c));
  if (csFT.length) CATEGORIES["Skor (MS)"] = csFT;
  const csHT = allCols.filter((c) => /^(AÇ )?İY \d+ \d+$/.test(c) && !/(Üst|Alt)/.test(c));
  if (csHT.length) CATEGORIES["Skor (İY)"] = csHT;
}

// ─── Gather active filters ───
function getBaseFilters() {
  const filters = {};
  if (el.fSearch.value.trim()) filters.search = el.fSearch.value.trim();
  if (el.fCountry.value) filters.country = el.fCountry.value;
  if (el.fLeague.value) filters.league = el.fLeague.value;
  if (el.fSeason.value) filters.season = el.fSeason.value;
  if (el.fDateFrom.value.trim()) filters.dateFrom = el.fDateFrom.value.trim();
  if (el.fDateTo.value.trim()) filters.dateTo = el.fDateTo.value.trim();
  if (el.fBookmaker.value) filters.bookmaker = el.fBookmaker.value;
  if (el.fResult.value) filters.result = el.fResult.value;
  if (state.order) filters.order = state.order;
  if (el.fUpcomingOnly.checked) filters.upcomingOnly = true;

  // Add exact odds filters
  const advFilters = getAdvFilters();
  Object.assign(filters, advFilters);

  return filters;
}

// ─── Match Table ───
async function loadMatches() {
  const filters = getBaseFilters();
  const cursor = getCurrentMatchCursor();
  const paramsObject = { limit: state.limit, ...filters };
  if (cursor && cursor.id) {
    paramsObject.cursorDate = cursor.date;
    paramsObject.cursorTime = cursor.time;
    paramsObject.cursorId = cursor.id;
  }

  const params = new URLSearchParams(paramsObject);
  const data = await fetchJSON(`${API}/api/matches?${params}`);

  const oddsType = el.fOddsType.value;
  const rows = data.data || [];
  state.currentRows = rows;
  state.currentPageCount = data.page_count || rows.length;
  state.hasMoreMatches = Boolean(data.has_more);
  state.nextMatchesCursor = data.next_cursor || null;

  renderTable(rows, oddsType);
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

function pickSummaryOdds(row, oddsType) {
  if (oddsType === "opening") {
    return {
      odds1: row.opening_odds_1,
      oddsX: row.opening_odds_x,
      odds2: row.opening_odds_2,
      ouOver: row.opening_odds_ou25_over,
      ouUnder: row.opening_odds_ou25_under,
    };
  }

  if (oddsType === "closing") {
    return {
      odds1: row.closing_odds_1,
      oddsX: row.closing_odds_x,
      odds2: row.closing_odds_2,
      ouOver: row.closing_odds_ou25_over,
      ouUnder: row.closing_odds_ou25_under,
    };
  }

  return {
    odds1: row.closing_odds_1 ?? row.opening_odds_1,
    oddsX: row.closing_odds_x ?? row.opening_odds_x,
    odds2: row.closing_odds_2 ?? row.opening_odds_2,
    ouOver: row.closing_odds_ou25_over ?? row.opening_odds_ou25_over,
    ouUnder: row.closing_odds_ou25_under ?? row.opening_odds_ou25_under,
  };
}

function renderTable(rows, oddsType) {
  if (!rows.length) {
    el.matchesBody.innerHTML = `<tr class="empty-row"><td colspan="12">
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
        <span style="font-size:2rem; opacity:0.5;">🔍</span>
        <span>Aramanıza uygun kayıt bulunamadı. Lütfen filtreleri değiştirerek tekrar deneyin.</span>
      </div>
    </td></tr>`;
    return;
  }

  el.matchesBody.innerHTML = rows.map((r) => {
    const score = r.home_score != null ? `${r.home_score} - ${r.away_score}` : "-";
    const summaryOdds = pickSummaryOdds(r, oddsType);

    const o1 = fmtOdds(summaryOdds.odds1);
    const oX = fmtOdds(summaryOdds.oddsX);
    const o2 = fmtOdds(summaryOdds.odds2);
    const ouOver = fmtOdds(summaryOdds.ouOver);
    const ouUnder = fmtOdds(summaryOdds.ouUnder);
    const ouStr = ouOver !== "-" ? `${ouOver}/${ouUnder}` : "-";
    const iy = r.iy || "-";
    const sel = state.selectedMatchId === r.match_id ? " selected" : "";

    return `
      <tr data-id="${r.match_id}" class="${sel}" onclick="selectMatch('${r.match_id}')">
        <td class="text-dim">${fmtDate(r.match_date)}</td>
        <td class="text-dim">${esc(r.match_time_display || r.match_time || "-")}</td>
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
  if (!state.currentPageCount) {
    el.pageInfo.textContent = "0 kayıt";
  } else {
    const from = state.pageIndex * state.limit + 1;
    const to = state.pageIndex * state.limit + state.currentPageCount;
    const moreSuffix = state.hasMoreMatches ? "+" : "";
    el.pageInfo.textContent = `Sayfa ${state.pageIndex + 1} · ${from}-${to}${moreSuffix}`;
  }
  el.btnPrev.disabled = state.pageIndex === 0;
  el.btnNext.disabled = !state.hasMoreMatches || !state.nextMatchesCursor;
}

// ─── Odds Detail Panel ───
async function selectMatch(matchId) {
  state.selectedMatchId = matchId;
  const requestId = ++state.matchDetailRequestId;
  document.querySelectorAll("tbody tr").forEach((tr) => {
    tr.classList.toggle("selected", tr.dataset.id === matchId);
  });

  const bookmaker = el.fBookmaker.value;
  const oddsType = el.fOddsType.value;
  setStatus("Oran detayları yükleniyor...", "loading");

  try {
    const cacheKey = `${matchId}::${bookmaker}`;
    let detailData = state.matchDetailCache.get(cacheKey);
    if (!detailData) {
      const [match, oddsData] = await Promise.all([
        fetchJSON(`${API}/api/matches/${matchId}`),
        fetchJSON(`${API}/api/matches/${matchId}/odds?bookmaker=${bookmaker}`),
      ]);
      detailData = { match, oddsData };
      state.matchDetailCache.set(cacheKey, detailData);
    }

    if (requestId !== state.matchDetailRequestId || state.selectedMatchId !== matchId) {
      return;
    }

    const { match, oddsData } = detailData;

    const cols = filterByOddsType(oddsData.columns || {}, oddsType);
    const score = match.home_score != null ? `${match.home_score} - ${match.away_score}` : "vs";

    el.oddsHome.textContent = match.home_team;
    el.oddsScore.textContent = score;
    el.oddsAway.textContent = match.away_team;
    el.oddsInfo.textContent = `${fmtDate(match.match_date)} · ${match.league || ""} · ${bookmaker} · ${oddsType === "opening" ? "Açılış" : oddsType === "closing" ? "Kapanış" : "Tümü"}`;

    renderOddsPanel(cols);
    el.oddsPanel.classList.add("active");
    el.oddsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setStatus(`${Object.keys(cols).length} oran yüklendi`, "ok");
  } catch (err) {
    setStatus(`Oran yüklenemedi: ${err.message}`, "err");
  }
}

function renderOddsPanel(cols) {
  const catData = {};
  const catOrder = [
    "1X2", "İY 1X2", "2Y 1X2", "DNB", "Çifte Şans", "İY Çifte Şans",
    "Tek/Çift", "İY Tek/Çift", "2Y Tek/Çift",
    "KG Var/Yok", "İY KG", "2Y KG",
    "Alt/Üst", "İY Alt/Üst", "2Y Alt/Üst",
    "Asya Handikap", "İY Asya H.", "Avrupa H.", "İY-MS",
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

  const catNames = Object.keys(catData);
  el.oddsCategoryTabs.innerHTML = catNames
    .map((name, i) => {
      const count = catData[name].length;
      return `<button class="odds-cat-btn${i === 0 ? " active" : ""}" data-cat="${name}">${name} <span style="opacity:0.5;font-size:0.7rem">(${count})</span></button>`;
    }).join("");

  if (catNames.length) {
    renderCategoryCards(catData, catNames[0]);
  } else {
    el.oddsGrid.innerHTML = `<div style="color:var(--text-muted);padding:20px;">Bu bookmaker için oran verisi bulunamadı.</div>`;
  }

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

// ─── Market Statistics ───
const STAT_ICONS = {
  "Maç Sonucu": "🎯", "Çifte Şans": "🔀", "KG VAR/YOK (BTTS)": "⚽",
  "Alt/Üst 2.5": "📈", "Alt/Üst 1.5": "📊", "Alt/Üst 3.5": "📉",
  "Alt/Üst 0.5": "🔢", "Tek/Çift": "🎲", "Gol Ortalamaları": "📐",
  "Ev Sahibi Gol": "🏠", "Deplasman Gol": "✈️",
};
const STAT_COLORS = ["green", "blue", "red", "yellow", "purple", "green", "blue", "red"];

async function loadMarketStats() {
  const filters = getBaseFilters();
  const params = new URLSearchParams(filters);

  el.statsGrid.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);"><span class="spinner"></span> İstatistikler yükleniyor...</div>`;

  try {
    const data = await fetchJSON(`${API}/api/stats/markets?${params}`);
    const markets = data.markets || {};
    const total = data.total_matches || 0;

    el.statsTotalMatches.textContent = total.toLocaleString("tr-TR");
    el.statsBookmaker.textContent = `📋 ${data.bookmaker || "bet365"}`;

    if (!total) {
      el.statsGrid.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);">Bu filtreler için veri bulunamadı.</div>`;
      return;
    }

    let html = "";
    let colorIdx = 0;

    for (const [marketName, marketData] of Object.entries(markets)) {
      const icon = STAT_ICONS[marketName] || "📋";
      let rowsHtml = "";

      for (const [label, stat] of Object.entries(marketData)) {
        if (stat.value !== undefined) {
          // Averages (no bar)
          rowsHtml += `
            <div class="stat-row">
              <span class="stat-label">${esc(label)}</span>
              <span class="stat-value-big">${stat.value ?? "-"}</span>
            </div>`;
        } else {
          const pct = stat.pct || 0;
          const count = stat.count || 0;
          const color = STAT_COLORS[colorIdx % STAT_COLORS.length];
          const pctColor = pct >= 60 ? "var(--green)" : pct >= 40 ? "var(--accent)" : pct >= 20 ? "var(--yellow)" : "var(--red)";
          rowsHtml += `
            <div class="stat-row">
              <span class="stat-label">${esc(label)}</span>
              <div class="stat-bar-wrap">
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill ${color}" style="width: ${pct}%"></div>
                </div>
              </div>
              <span class="stat-pct" style="color:${pctColor}">%${pct}</span>
              <span class="stat-count">${count.toLocaleString("tr-TR")}</span>
            </div>`;
        }
      }

      html += `
        <div class="stat-card">
          <div class="stat-card-title"><span class="icon">${icon}</span> ${esc(marketName)}</div>
          ${rowsHtml}
        </div>`;
      colorIdx++;
    }

    el.statsGrid.innerHTML = html;
  } catch (err) {
    el.statsGrid.innerHTML = `<div style="padding:40px; text-align:center; color:var(--red);">Hata: ${esc(err.message)}</div>`;
  }
}

// ─── Refresh ───
async function refreshAll() {
  setStatus("Veriler yükleniyor...", "loading");
  const originalApplyText = el.btnApply.innerHTML;
  el.btnApply.disabled = true;
  el.btnApply.innerHTML = `<span class="spinner"></span> Yükleniyor...`;
  try {
    await loadOverview();
    if (state.activeTab === "matchesTab") {
      await loadMatches();
    } else if (state.activeTab === "statsTab") {
      await loadMarketStats();
    }
    setStatus("Hazır", "ok");
  } catch (err) {
    setStatus(`Hata: ${err.message}`, "err");
  } finally {
    el.btnApply.disabled = false;
    el.btnApply.innerHTML = originalApplyText;
  }
}

// ─── Events ───
el.btnApply.addEventListener("click", () => {
  resetMatchPagination();
  state.order = "desc"; // Reset order when user manually clicks Filtrele
  clearSelectedMatch();
  refreshAll();
});
el.btnClear.addEventListener("click", () => {
  [el.fSearch, el.fDateFrom, el.fDateTo].forEach((i) => (i.value = ""));
  el.fCountry.value = ""; el.fLeague.value = ""; el.fSeason.value = "";
  el.fResult.value = "";
  const fSelect = document.getElementById("fixtureSelect");
  if (fSelect) fSelect.value = "";
  // Clear advanced filters
  ADV_ODDS_FILTERS.forEach(f => {
    const elId = document.getElementById(f.id);
    if (elId) elId.value = "";
    const minusId = document.getElementById(f.id + "_minus");
    const plusId = document.getElementById(f.id + "_plus");
    if (minusId) minusId.value = "";
    if (plusId) plusId.value = "";
  });
  resetMatchPagination();
  state.order = "desc";
  clearSelectedMatch();
  refreshAll();
});

const fixtureSelect = document.getElementById("fixtureSelect");
if (fixtureSelect) {
  const getLocalDateStr = (dateObj) => {
    const offset = dateObj.getTimezoneOffset();
    const localD = new Date(dateObj.getTime() - (offset * 60 * 1000));
    return localD.toISOString().split("T")[0];
  };

  const populateFixtureDates = () => {
    fixtureSelect.innerHTML = `<option value="">📆 Fikstür Seç</option><option value="all">Tüm Liste (7 Gün)</option>`;
    const todayRaw = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayRaw);
      d.setDate(d.getDate() + i);
      const val = getLocalDateStr(d);
      const params = { day: '2-digit', month: '2-digit', year: 'numeric' };
      let label = d.toLocaleDateString("tr-TR", params);
      if (i === 0) label = `Bugün (${label})`;
      else if (i === 1) label = `Yarın (${label})`;
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      fixtureSelect.appendChild(opt);
    }
  };
  populateFixtureDates();

  fixtureSelect.addEventListener("change", () => {
    const val = fixtureSelect.value;
    if (!val) return; // if they select the empty placeholder

    // Switch to Matches tab automatically
    document.querySelectorAll(".main-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    const tabBtn = document.getElementById("tabMatchesBtn");
    const tabDiv = document.getElementById("matchesTab");
    if (tabBtn) tabBtn.classList.add("active");
    if (tabDiv) tabDiv.classList.add("active");
    state.activeTab = "matchesTab";

    if (val === "all") {
       const today = new Date();
       const next7 = new Date(); next7.setDate(today.getDate() + 7);
       el.fDateFrom.value = getLocalDateStr(today);
       el.fDateTo.value = getLocalDateStr(next7);
    } else {
       el.fDateFrom.value = val;
       el.fDateTo.value = val;
    }

    if (el.fUpcomingOnly) el.fUpcomingOnly.checked = true;

    state.order = "asc"; // ASC order for fixtures
    resetMatchPagination();
    clearSelectedMatch();
    refreshAll();
  });
}

el.btnPrev.addEventListener("click", () => {
  if (state.pageIndex === 0) return;
  state.pageIndex -= 1;
  clearSelectedMatch();
  refreshAll();
});
el.btnNext.addEventListener("click", () => {
  if (!state.nextMatchesCursor) return;
  state.pageIndex += 1;
  state.matchCursorStack[state.pageIndex] = state.nextMatchesCursor;
  clearSelectedMatch();
  refreshAll();
});
el.oddsClose.addEventListener("click", () => {
  clearSelectedMatch();
});
el.fBookmaker.addEventListener("change", async () => {
  const selectedMatchId = state.selectedMatchId;
  resetMatchPagination();
  clearSelectedMatch();
  await refreshAll();
  if (selectedMatchId && state.activeTab === "matchesTab") {
    selectMatch(selectedMatchId);
  }
});
el.fOddsType.addEventListener("change", () => {
  if (state.activeTab === "matchesTab") {
    renderTable(state.currentRows, el.fOddsType.value);
    updatePagination();
    if (state.selectedMatchId) {
      selectMatch(state.selectedMatchId);
    }
  }
});
document.querySelectorAll(".filter-group input").forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      resetMatchPagination();
      clearSelectedMatch();
      refreshAll();
    }
  });
});
window.selectMatch = selectMatch;

document.querySelectorAll(".main-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "statsTab" && state.activeTab !== "statsTab") {
      state.activeTab = "statsTab";
      loadMarketStats();
    } else if (btn.dataset.tab === "matchesTab" && state.activeTab !== "matchesTab") {
      state.activeTab = "matchesTab";
      
      // Auto-clear filters to show 'eski maclar' (past matches) and reset ordering
      if (el.fDateFrom) el.fDateFrom.value = "";
      if (el.fDateTo) el.fDateTo.value = "";
      if (el.fUpcomingOnly) el.fUpcomingOnly.checked = false;
      const fts = document.getElementById("fixtureSelect");
      if (fts) fts.value = "";
      
      state.order = "desc";
      resetMatchPagination();
      clearSelectedMatch();
      refreshAll();
    }
  });
});

// ─── Init ───
(async () => {
  try {
    const colData = await fetchJSON(`${API}/api/columns`);
    state.allColumns = colData.columns || [];
    buildDynCategories(state.allColumns);
  } catch (e) {
    console.warn("all_columns yüklenemedi:", e);
  }
  await loadFilterOptions();
  refreshAll();
})();
