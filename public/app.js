const state = {
  limit: 50,
  offset: 0,
  total: 0,
};

const elements = {
  totalMatches: document.getElementById("totalMatches"),
  totalLeagues: document.getElementById("totalLeagues"),
  totalCountries: document.getElementById("totalCountries"),
  firstDate: document.getElementById("firstDate"),
  lastDate: document.getElementById("lastDate"),
  tableBody: document.getElementById("matchesTableBody"),
  status: document.getElementById("status"),
  paginationInfo: document.getElementById("paginationInfo"),
  search: document.getElementById("search"),
  country: document.getElementById("country"),
  league: document.getElementById("league"),
  season: document.getElementById("season"),
  dateFrom: document.getElementById("dateFrom"),
  dateTo: document.getElementById("dateTo"),
  applyFilters: document.getElementById("applyFilters"),
  clearFilters: document.getElementById("clearFilters"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", Boolean(isError));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resultClass(result) {
  if (result === "MS 1") return "ms1";
  if (result === "MS 0") return "ms0";
  if (result === "MS 2") return "ms2";
  return "";
}

function currentFilters() {
  return {
    search: elements.search.value.trim(),
    country: elements.country.value.trim(),
    league: elements.league.value.trim(),
    season: elements.season.value.trim(),
    dateFrom: elements.dateFrom.value.trim(),
    dateTo: elements.dateTo.value.trim(),
  };
}

function renderRows(rows) {
  if (!rows.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="muted">Kayit bulunamadi.</td>
      </tr>
    `;
    return;
  }

  const html = rows
    .map((row) => {
      const score =
        row.home_score === null || row.away_score === null
          ? "-"
          : `${row.home_score} - ${row.away_score}`;
      return `
        <tr>
          <td>${escapeHtml(row.match_id)}</td>
          <td>${formatDate(row.match_date)}</td>
          <td>${escapeHtml(row.match_time || "-")}</td>
          <td>${escapeHtml(row.country || "-")}</td>
          <td>${escapeHtml(row.league || "-")}</td>
          <td>${escapeHtml(row.season || "-")}</td>
          <td>${escapeHtml(row.home_team)}</td>
          <td>${escapeHtml(score)}</td>
          <td>${escapeHtml(row.away_team)}</td>
          <td><span class="pill ${resultClass(row.full_time_result)}">${escapeHtml(
            row.full_time_result || "-",
          )}</span></td>
          <td>${formatDateTime(row.scraped_at)}</td>
        </tr>
      `;
    })
    .join("");
  elements.tableBody.innerHTML = html;
}

function updatePaginationInfo() {
  const from = state.total === 0 ? 0 : state.offset + 1;
  const to = Math.min(state.offset + state.limit, state.total);
  elements.paginationInfo.textContent = `${from}-${to} / ${state.total}`;
  elements.prevPage.disabled = state.offset <= 0;
  elements.nextPage.disabled = state.offset + state.limit >= state.total;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

async function loadOverview() {
  const overview = await fetchJson("/api/stats/overview");
  elements.totalMatches.textContent = overview.total_matches ?? 0;
  elements.totalLeagues.textContent = overview.total_leagues ?? 0;
  elements.totalCountries.textContent = overview.total_countries ?? 0;
  elements.firstDate.textContent = formatDate(overview.first_match_date);
  elements.lastDate.textContent = formatDate(overview.last_match_date);
}

async function loadMatches() {
  const filters = currentFilters();
  const params = new URLSearchParams({
    limit: String(state.limit),
    offset: String(state.offset),
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const data = await fetchJson(`/api/matches?${params.toString()}`);
  state.total = data.total || 0;
  renderRows(Array.isArray(data.data) ? data.data : []);
  updatePaginationInfo();
}

async function refreshAll() {
  setStatus("Veriler yukleniyor...");
  try {
    await Promise.all([loadOverview(), loadMatches()]);
    setStatus("Hazir");
  } catch (error) {
    setStatus(`Hata: ${error.message}`, true);
  }
}

elements.applyFilters.addEventListener("click", async () => {
  state.offset = 0;
  await refreshAll();
});

elements.clearFilters.addEventListener("click", async () => {
  elements.search.value = "";
  elements.country.value = "";
  elements.league.value = "";
  elements.season.value = "";
  elements.dateFrom.value = "";
  elements.dateTo.value = "";
  state.offset = 0;
  await refreshAll();
});

elements.prevPage.addEventListener("click", async () => {
  state.offset = Math.max(0, state.offset - state.limit);
  await refreshAll();
});

elements.nextPage.addEventListener("click", async () => {
  state.offset += state.limit;
  await refreshAll();
});

refreshAll();
