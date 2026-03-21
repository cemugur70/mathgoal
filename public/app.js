/* ═══════════════════════════════════════════════════════
   Mathgoal Dashboard — Frontend Logic v3
   Tabs: Matches + Statistics
   Advanced column/odds filters
   ═══════════════════════════════════════════════════════ */

const API = "";
const state = { limit: 50, offset: 0, total: 0, selectedMatchId: null, allColumns: [], activeTab: "matchesTab" };

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
  fUpcomingOnly: $("fUpcomingOnly"), fGroupLeague: $("fGroupLeague"),
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
  { id: "odds_1", label: "1 (Ev Kazanır)" },
  { id: "odds_x", label: "X (Beraberlik)" },
  { id: "odds_2", label: "2 (Dep. Kazanır)" },
  { id: "odds_ou25_over", label: "2.5 Üst" },
  { id: "odds_ou25_under", label: "2.5 Alt" },
  { id: "odds_btts_yes", label: "KG VAR" },
  { id: "odds_btts_no", label: "KG YOK" },
  { id: "odds_dc_1x", label: "Çifte Şans 1X" },
  { id: "odds_dc_x2", label: "Çifte Şans X2" },
  { id: "odds_dc_12", label: "Çifte Şans 12" },
  { id: "odds_iy_1", label: "İY 1" },
  { id: "odds_iy_x", label: "İY X" },
  { id: "odds_iy_2", label: "İY 2" },
  { id: "odds_ou15_over", label: "1.5 Üst" },
  { id: "odds_ou35_over", label: "3.5 Üst" },
  { id: "cpr_home", label: "CPR Home %" },
  { id: "cpr_draw", label: "CPR Draw %" },
  { id: "cpr_away", label: "CPR Away %" },
  { id: "cpr_tahmin", label: "CPR Tahmin (1,X,2)" },
  { id: "cpr_guven", label: "Güven %" },
  { id: "cpr_cs", label: "Çifte Şans (1X,X2,12)" },
  { id: "cpr_skor", label: "Tahmini Skor (Örn: 2-1)" }
];

function buildAdvFilters() {
  el.advFiltersGrid.innerHTML = ADV_ODDS_FILTERS.map(f => {
    const isText = ["cpr_tahmin", "cpr_cs", "cpr_skor"].includes(f.id);
    return `
      <div class="adv-filter-item">
        <label>${f.label}</label>
        <div class="adv-range" style="grid-template-columns: 1fr;">
          <input type="${isText ? 'text' : 'number'}" ${!isText ? 'step="0.01"' : ''} placeholder="Tam Değer" id="${f.id}" style="width: 100%;" />
        </div>
      </div>
    `;
  }).join("");
}
buildAdvFilters();

function getAdvFilters() {
  const filters = {};
  ADV_ODDS_FILTERS.forEach(f => {
    const elId = document.getElementById(f.id);
    const val = elId ? parseFloat(elId.value) : NaN;
    if (!isNaN(val)) filters[f.id] = val;
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
async function loadOverview() {
  const filters = getBaseFilters();
  const params = new URLSearchParams(filters);
  const d = await fetchJSON(`${API}/api/stats/overview?${params}`);
  el.statMatches.textContent = (d.total_matches ?? 0).toLocaleString("tr-TR");
  el.statLeagues.textContent = (d.total_leagues ?? 0).toLocaleString("tr-TR");
  el.statCountries.textContent = d.total_countries ?? 0;
  el.statFirstDate.textContent = fmtDate(d.first_match_date);
  el.statLastDate.textContent = fmtDate(d.last_match_date);
  el.statOdds.textContent = (d.total_odds ?? 0).toLocaleString("tr-TR");
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
  ADV_ODDS_FILTERS.forEach(f => {
    const elId = document.getElementById(f.id);
    if (elId && elId.value) filters[f.id] = elId.value;
  });

  return filters;
}

// ─── Match Table ───
async function loadMatches() {
  const filters = getBaseFilters();

  const params = new URLSearchParams({ limit: state.limit, offset: state.offset, ...filters });
  const data = await fetchJSON(`${API}/api/matches?${params}`);

  const bookmaker = el.fBookmaker.value;
  const oddsType = el.fOddsType.value;
  let rows = data.data || [];
  const matchIds = rows.map((m) => m.match_id);

  // Fetch mapped odds for each visible match (only for display, not filtering)
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

  state.total = data.total || 0;

  renderTable(rows, oddsMap, oddsType);
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
    const cols = filterByOddsType(oddsMap[r.match_id] || {}, oddsType);

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

// ─── Analysis (Rating) ───
async function loadAnalysis() {
  const filters = getBaseFilters();
  const params = new URLSearchParams({ limit: state.limit, offset: state.offset, ...filters });

  const analysisBody = $("analysisBody");
  analysisBody.innerHTML = `<tr class="empty-row"><td colspan="14"><span class="spinner"></span> Analiz verileri hesaplanıyor...</td></tr>`;

  try {
    const data = await fetchJSON(`${API}/api/analysis?${params}`);
    state.total = data.total || 0;
    renderAnalysisTable(data.data || []);
    updatePagination();
  } catch (err) {
    analysisBody.innerHTML = `<tr class="empty-row"><td colspan="14" style="color:var(--red);">Hata: ${esc(err.message)}</td></tr>`;
  }
}

function renderAnalysisTable(rows) {
  const tbody = $("analysisBody");
  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="16">
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
        <span style="font-size:2rem; opacity:0.5;">🔍</span>
        <span>Aramanıza uygun analiz verisi bulunamadı.</span>
      </div>
    </td></tr>`;
    return;
  }

  let sortedRows = rows;
  const groupLeague = el.fGroupLeague && el.fGroupLeague.checked;
  
  if (groupLeague) {
    sortedRows = [...rows].sort((a, b) => {
      const l1 = (a.league || "").trim().toLowerCase();
      const l2 = (b.league || "").trim().toLowerCase();
      if (l1 < l2) return -1;
      if (l1 > l2) return 1;
      return new Date(a.match_date) - new Date(b.match_date);
    });
  }

  let html = "";
  let lastLeague = null;

  sortedRows.forEach((r) => {
    if (groupLeague) {
      const currentLeague = (r.league || "Diğer Ligler").trim();
      if (currentLeague !== lastLeague) {
        html += `<tr class="league-header-row" style="background:var(--bg-2);"><td colspan="16" style="text-align:left; padding:12px 14px; color:var(--accent); font-size:1.05rem; font-weight:700; border-top:2px solid var(--border-hl);">${esc(currentLeague)} - ${esc(r.country || "")}</td></tr>`;
        lastLeague = currentLeague;
      }
    }

    const score = r.home_score != null ? `${r.home_score} - ${r.away_score}` : "-";
    
    const cpr = r.cpr || {};
    const probH = cpr.probHome != null ? (cpr.probHome * 100).toFixed(1) + "%" : "-";
    const probD = cpr.probDraw != null ? (cpr.probDraw * 100).toFixed(1) + "%" : "-";
    const probA = cpr.probAway != null ? (cpr.probAway * 100).toFixed(1) + "%" : "-";
    
    const tahmin = cpr.prediction || "-";
    const guven = cpr.confidence != null ? (cpr.confidence * 100).toFixed(1) + "%" : "-";
    const doubleChance = cpr.doubleChance || "-";
    const tahminSkor = cpr.predictedScore || "-";
    const top3 = cpr.top3Scores ? cpr.top3Scores.join(", ") : "-";

    const selClass = state.selectedMatchId === r.match_id ? " selected" : "";
    html += `
      <tr data-id="${r.match_id}" class="${selClass}" onclick="selectMatch('${r.match_id}')">
        <td class="text-dim">${fmtDate(r.match_date)}</td>
        <td class="text-dim">${esc(r.league || "")}</td>
        <td class="team-name">${esc(r.home_team)}</td>
        <td class="team-name">${esc(r.away_team)}</td>
        <td class="odds-value click-filter" onclick="applyFilter(event, 'odds_1', this.innerText)">${r.odds_1 ? parseFloat(r.odds_1).toFixed(2) : "-"}</td>
        <td class="odds-value click-filter" onclick="applyFilter(event, 'odds_x', this.innerText)">${r.odds_x ? parseFloat(r.odds_x).toFixed(2) : "-"}</td>
        <td class="odds-value click-filter" onclick="applyFilter(event, 'odds_2', this.innerText)">${r.odds_2 ? parseFloat(r.odds_2).toFixed(2) : "-"}</td>
        <td class="click-filter" style="color: var(--accent); font-weight: 700;" onclick="applyFilter(event, 'cpr_home', this.innerText)">${probH}</td>
        <td class="click-filter" style="color: var(--accent); font-weight: 700;" onclick="applyFilter(event, 'cpr_draw', this.innerText)">${probD}</td>
        <td class="click-filter" style="color: var(--accent); font-weight: 700;" onclick="applyFilter(event, 'cpr_away', this.innerText)">${probA}</td>
        <td class="click-filter" style="color: var(--green); font-weight: 800;" onclick="applyFilter(event, 'cpr_tahmin', this.innerText)">${tahmin}</td>
        <td class="click-filter" style="color: var(--yellow); font-weight: 700;" onclick="applyFilter(event, 'cpr_guven', this.innerText)">${guven}</td>
        <td class="click-filter" style="color: var(--purple); font-weight: 700;" onclick="applyFilter(event, 'cpr_cs', this.innerText)">${doubleChance}</td>
        <td class="click-filter" style="color: var(--accent); font-weight: 700;" onclick="applyFilter(event, 'cpr_skor', this.innerText)">${tahminSkor}</td>
        <td class="text-dim">${top3}</td>
        <td><span class="score">${esc(score)}</span></td>
      </tr>`;
  });

  tbody.innerHTML = html;
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
    } else if (state.activeTab === "analysisTab") {
      await loadAnalysis();
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
  state.offset = 0; state.selectedMatchId = null;
  state.order = "desc"; // Reset order when user manually clicks Filtrele
  el.oddsPanel.classList.remove("active");
  refreshAll();
});
el.btnClear.addEventListener("click", () => {
  [el.fSearch, el.fDateFrom, el.fDateTo].forEach((i) => (i.value = ""));
  el.fCountry.value = ""; el.fLeague.value = ""; el.fSeason.value = "";
  el.fResult.value = "";
  // Clear advanced filters
  ADV_ODDS_FILTERS.forEach(f => {
    const elId = document.getElementById(f.id);
    if (elId) elId.value = "";
  });
  state.offset = 0; state.selectedMatchId = null;
  state.order = "desc";
  el.oddsPanel.classList.remove("active");
  refreshAll();
});

const btnUpcoming = document.getElementById("btnUpcoming");
if (btnUpcoming) {
  btnUpcoming.addEventListener("click", () => {
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    el.fDateFrom.value = today.toISOString().split("T")[0];
    el.fDateTo.value = next7Days.toISOString().split("T")[0];
    
    // Switch to Analysis tab automatically for better UX
    document.querySelectorAll(".main-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    const tabBtn = document.getElementById("tabAnalysisBtn");
    const tabDiv = document.getElementById("analysisTab");
    if (tabBtn) tabBtn.classList.add("active");
    if (tabDiv) tabDiv.classList.add("active");
    state.activeTab = "analysisTab";
    
    // Automatically turn on upcoming mode and group by league
    if (el.fUpcomingOnly) el.fUpcomingOnly.checked = true;
    if (el.fGroupLeague) el.fGroupLeague.checked = true;

    state.order = "asc"; // ASC order for fixtures
    state.offset = 0; state.selectedMatchId = null;
    el.oddsPanel.classList.remove("active");
    refreshAll();
  });
}

el.btnPrev.addEventListener("click", () => { state.offset = Math.max(0, state.offset - state.limit); refreshAll(); });
el.btnNext.addEventListener("click", () => { state.offset += state.limit; refreshAll(); });
el.oddsClose.addEventListener("click", () => {
  el.oddsPanel.classList.remove("active"); state.selectedMatchId = null;
  document.querySelectorAll("tbody tr").forEach((tr) => tr.classList.remove("selected"));
});
el.fBookmaker.addEventListener("change", () => { refreshAll(); if (state.selectedMatchId && state.activeTab === 'matchesTab') selectMatch(state.selectedMatchId); });
el.fOddsType.addEventListener("change", () => { refreshAll(); if (state.selectedMatchId && state.activeTab === 'matchesTab') selectMatch(state.selectedMatchId); });
document.querySelectorAll(".filter-group input").forEach((input) => {
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { state.offset = 0; refreshAll(); } });
});
window.selectMatch = selectMatch;

window.applyFilter = function(e, filterId, value) {
  e.stopPropagation(); // prevent selectMatch from triggering
  if (!value || value === "-" || String(value).trim() === "") return;
  
  const input = document.getElementById(filterId);
  if (!input) return;

  // Clean value (e.g. "45.2%" -> "45.2")
  let cleanValue = String(value).replace("%", "").trim();
  input.value = cleanValue;

  // Visual feedback highlighting the target input
  input.style.transition = "background-color 0.2s, color 0.2s";
  input.style.backgroundColor = "var(--green)";
  input.style.color = "#000";
  setTimeout(() => {
    input.style.backgroundColor = "";
    input.style.color = "";
  }, 1000);

  // Open advanced filters if not already open
  if (!el.advFilters.classList.contains("open")) {
    el.advToggle.click();
  }
};
document.querySelectorAll(".main-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "analysisTab" && state.activeTab !== "analysisTab") {
      state.activeTab = "analysisTab";
      loadAnalysis();
    } else if (btn.dataset.tab === "statsTab" && state.activeTab !== "statsTab") {
      state.activeTab = "statsTab";
      loadMarketStats();
    } else if (btn.dataset.tab === "matchesTab" && state.activeTab !== "matchesTab") {
      state.activeTab = "matchesTab";
      loadMatches();
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
