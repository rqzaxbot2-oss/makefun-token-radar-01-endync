const state = {
  board: null,
  filter: { q: "", category: "", minValue: 0, hasFarm: false, sort: "value" },
  route: "board",
  selected: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  if (abs >= 1) return "$" + n.toFixed(0);
  return "$" + n.toFixed(2);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return { route: "board" };
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) return { route: "detail", id: decodeURIComponent(parts.slice(1).join("/")) };
  if (parts[0] === "filter") return { route: "filter" };
  return { route: "board" };
}

function setHash(h) {
  if (location.hash !== h) location.hash = h;
}

async function loadBoard() {
  const candidates = ["../board.json", "board.json", "./board.json"];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.rows)) return data;
    } catch (_) { /* try next */ }
  }
  return null;
}

function rowValue(r) {
  return r.impliedValueUsd != null ? r.impliedValueUsd : (r.implied_value_usd != null ? r.implied_value_usd : 0);
}

function rowName(r) {
  return r.name || r.protocol || r.slug || "Unknown";
}

function rowCategory(r) {
  return r.category || "Uncategorized";
}

function rowTvl(r) {
  return r.tvlUsd != null ? r.tvlUsd : (r.tvl != null ? r.tvl : 0);
}

function farmSteps(r) {
  const plan = r.farmPlan || r.farm_plan;
  if (!plan) return [];
  if (Array.isArray(plan)) return plan.map((s) => (typeof s === "string" ? s : (s.step || s.action || JSON.stringify(s))));
  if (Array.isArray(plan.steps)) return plan.steps.map((s) => (typeof s === "string" ? s : (s.step || s.action || JSON.stringify(s))));
  if (typeof plan === "string") return plan.split(/\n+/).filter(Boolean);
  return [];
}

function farmSummary(r) {
  const plan = r.farmPlan || r.farm_plan;
  if (!plan) return "No plan";
  if (typeof plan === "string") return plan;
  if (plan.summary) return plan.summary;
  const steps = farmSteps(r);
  return steps.length ? steps[0] : "Plan available";
}

function filteredRows() {
  if (!state.board) return [];
  const f = state.filter;
  const q = f.q.trim().toLowerCase();
  let rows = state.board.rows.filter((r) => {
    if (q) {
      const hay = (rowName(r) + " " + rowCategory(r) + " " + (r.chains || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.category && rowCategory(r) !== f.category) return false;
    if (f.minValue && rowValue(r) < f.minValue) return false;
    if (f.hasFarm && farmSteps(r).length === 0) return false;
    return true;
  });
  const sorters = {
    value: (a, b) => rowValue(b) - rowValue(a),
    tvl: (a, b) => rowTvl(b) - rowTvl(a),
    name: (a, b) => rowName(a).localeCompare(rowName(b)),
    category: (a, b) => rowCategory(a).localeCompare(rowCategory(b)) || rowValue(b) - rowValue(a),
  };
  rows.sort(sorters[f.sort] || sorters.value);
  return rows;
}

function categories() {
  if (!state.board) return [];
  const set = new Set(state.board.rows.map(rowCategory));
  return Array.from(set).sort();
}

function statCards() {
  const rows = state.board ? state.board.rows : [];
  const total = rows.reduce((a, r) => a + rowValue(r), 0);
  const withFarm = rows.filter((r) => farmSteps(r).length > 0).length;
  const top = rows.slice().sort((a, b) => rowValue(b) - rowValue(a))[0];
  return `
    <div class="stats">
      <div class="stat"><span class="stat-label">Protocols</span><span class="stat-value">${rows.length}</span></div>
      <div class="stat"><span class="stat-label">Total implied value</span><span class="stat-value">${fmtUsd(total)}</span></div>
      <div class="stat"><span class="stat-label">With farm plan</span><span class="stat-value">${withFarm}</span></div>
      <div class="stat"><span class="stat-label">Top pick</span><span class="stat-value">${top ? esc(rowName(top)) : "—"}</span></div>
    </div>`;
}

function controls() {
  const f = state.filter;
  const cats = categories();
  return `
    <div class="controls">
      <input id="q" type="search" placeholder="Search protocol, category, chain…" value="${esc(f.q)}" />
      <select id="category">
        <option value="">All categories</option>
        ${cats.map((c) => `<option value="${esc(c)}" ${f.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      <select id="minValue">
        ${[0, 1e6, 1e7, 1e8, 1e9].map((v) => `<option value="${v}" ${f.minValue === v ? "selected" : ""}>${v === 0 ? "Any value" : "≥ " + fmtUsd(v)}</option>`).join("")}
      </select>
      <label class="check"><input id="hasFarm" type="checkbox" ${f.hasFarm ? "checked" : ""} /> Has farm plan</label>
      <select id="sort">
        <option value="value" ${f.sort === "value" ? "selected" : ""}>Sort: implied value</option>
        <option value="tvl" ${f.sort === "tvl" ? "selected" : ""}>Sort: TVL</option>
        <option value="name" ${f.sort === "name" ? "selected" : ""}>Sort: name</option>
        <option value="category" ${f.sort === "category" ? "selected" : ""}>Sort: category</option>
      </select>
    </div>`;
}

function boardTable(rows) {
  if (!rows.length) return `<p class="empty">No protocols match the current filters.</p>`;
  const max = rows.reduce((m, r) => Math.max(m, rowValue(r)), 1);
  return `
    <div class="table-wrap">
      <table class="board">
        <thead><tr>
          <th>#</th><th>Protocol</th><th>Category</th><th>TVL</th><th>Implied value</th><th>Signal</th><th>Farm</th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const v = rowValue(r);
            const pct = Math.max(2, Math.round((v / max) * 100));
            const id = r.slug || slug(rowName(r));
            return `<tr data-id="${esc(id)}">
              <td class="rank">${i + 1}</td>
              <td class="name"><a href="#/p/${encodeURIComponent(id)}">${esc(rowName(r))}</a>
                <div class="chains">${(r.chains || []).slice(0, 4).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div></td>
              <td><span class="cat">${esc(rowCategory(r))}</span></td>
              <td class="num">${fmtUsd(rowTvl(r))}</td>
              <td class="num strong">${fmtUsd(v)}</td>
              <td class="bar-cell"><div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div></td>
              <td class="farm">${esc(farmSummary(r)).slice(0, 90)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderBoard() {
  const rows = filteredRows();
  return `
    <header class="top">
      <h1>Token Launch Radar</h1>
      <p class="sub">Protocols DefiLlama tracks that still have no token — ranked by what a launch would be worth.</p>
      <nav class="tabs">
        <a href="#/board" class="${state.route === "board" ? "active" : ""}">Board</a>
        <a href="#/filter" class="${state.route === "filter" ? "active" : ""}">Filtered view</a>
      </nav>
    </header>
    ${statCards()}
    ${controls()}
    <p class="count">${rows.length} of ${state.board ? state.board.rows.length : 0} protocols</p>
    ${boardTable(rows)}`;
}

function renderDetail(id) {
  const rows = state.board ? state.board.rows : [];
  const r = rows.find((x) => (x.slug || slug(rowName(x))) === id) || rows.find((x) => slug(rowName(x)) === id);
  if (!r) {
    return `<header class="top"><h1>Protocol not found</h1><p class="sub">No protocol matches “${esc(id)}”.</p>
      <nav class="tabs"><a href="#/board">← Back to board</a></nav></header>`;
  }
  const steps = farmSteps(r);
  const plan = r.farmPlan || r.farm_plan || {};
  const notes = plan.notes || r.notes || "";
  const why = r.rationale || r.why || plan.rationale || "";
  return `
    <header class="top">
      <nav class="tabs"><a href="#/board">← Back to board</a></nav>
      <h1>${esc(rowName(r))}</h1>
      <p class="sub"><span class="cat">${esc(rowCategory(r))}</span>
        ${(r.chains || []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</p>
    </header>
    <div class="detail-grid">
      <section class="card">
        <h2>Launch value</h2>
        <div class="big">${fmtUsd(rowValue(r))}</div>
        <dl class="kv">
          <dt>TVL</dt><dd>${fmtUsd(rowTvl(r))}</dd>
          <dt>Category</dt><dd>${esc(rowCategory(r))}</dd>
          <dt>Token status</dt><dd>${esc(r.tokenStatus || r.token_status || "No token")}</dd>
          <dt>Chains</dt><dd>${(r.chains || []).join(", ") || "—"}</dd>
        </dl>
      </section>
      <section class="card">
        <h2>Why it ranks here</h2>
        <p>${esc(why || "Ranked by implied launch value derived from TVL, category comparables and tokenless status.")}</p>
        ${notes ? `<p class="notes">${esc(notes)}</p>` : ""}
      </section>
    </div>
    <section class="card">
      <h2>How to farm it</h2>
      ${steps.length ? `<ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : `<p class="empty">No farm plan recorded for this protocol.</p>`}
    </section>`;
}

function renderFilterView() {
  const rows = filteredRows();
  return `
    <header class="top">
      <h1>Filtered view</h1>
      <p class="sub">Narrow the watchlist by category, value and farm availability.</p>
      <nav class="tabs">
        <a href="#/board">Board</a>
        <a href="#/filter" class="active">Filtered view</a>
      </nav>
    </header>
    ${controls()}
    <p class="count">${rows.length} matching protocols</p>
    ${boardTable(rows)}`;
}

function render() {
  const app = $("#app");
  if (!app) return;
  if (!state.board) {
    app.innerHTML = `<div class="loading">Loading board…</div>`;
    return;
  }
  const r = parseHash();
  state.route = r.route;
  if (r.route === "detail") app.innerHTML = renderDetail(r.id);
  else if (r.route === "filter") app.innerHTML = renderFilterView();
  else app.innerHTML = renderBoard();
  bindControls();
}

function bindControls() {
  const q = $("#q");
  if (q) q.addEventListener("input", (e) => { state.filter.q = e.target.value; rerenderList(); });
  const cat = $("#category");
  if (cat) cat.addEventListener("change", (e) => { state.filter.category = e.target.value; rerenderList(); });
  const mv = $("#minValue");
  if (mv) mv.addEventListener("change", (e) => { state.filter.minValue = Number(e.target.value); rerenderList(); });
  const hf = $("#hasFarm");
  if (hf) hf.addEventListener("change", (e) => { state.filter.hasFarm = e.target.checked; rerenderList(); });
  const sort = $("#sort");
  if (sort) sort.addEventListener("change", (e) => { state.filter.sort = e.target.value; rerenderList(); });
}

function rerenderList() {
  const rows = filteredRows();
  const app = $("#app");
  if (!app) return;
  const tableHost = $(".table-wrap, .empty");
  if (tableHost) {
    const tmp = document.createElement("div");
    tmp.innerHTML = boardTable(rows);
    tableHost.replaceWith(tmp.firstElementChild);
  }
  const count = $(".count");
  if (count && state.board) count.textContent = `${rows.length} of ${state.board.rows.length} protocols`;
}

window.addEventListener("hashchange", render);

document.addEventListener("DOMContentLoaded", async () => {
  state.board = await loadBoard();
  if (!state.board) {
    const app = $("#app");
    if (app) app.innerHTML = `<div class="loading">Could not load board.json. Serve the dashboard from the repository root or alongside board.json.</div>`;
    return;
  }
  render();
});