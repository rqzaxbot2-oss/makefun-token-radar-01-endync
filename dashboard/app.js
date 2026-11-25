(function (global) {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pick = (sels) => {
    for (const s of sels) {
      const el = $(s);
      if (el) return el;
    }
    return null;
  };

  const state = {
    raw: null,
    meta: {},
    rows: [],
    filtered: [],
    selectedSlug: null,
    filters: {
      search: "",
      category: "all",
      chain: "all",
      tier: "all",
      difficulty: "all",
      minTvl: 0,
      watchlistOnly: false,
      pointsOnly: false,
      quick: "all",
    },
    sort: { key: "impliedValue", dir: "desc" },
  };

  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const num = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  function fmtUsd(v) {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 1 : 2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function fmtPct(v) {
    const n = num(v, NaN);
    if (!Number.isFinite(n)) return "—";
    return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
  }

  function normalizeRow(r, idx) {
    const val = typeof r.valuation === "object" && r.valuation ? r.valuation : {};
    const farm = r.farmPlan || r.farm_plan || r.farming || r.farm || {};
    const chains = Array.isArray(r.chains)
      ? r.chains.filter(Boolean)
      : r.chain
        ? [String(r.chain)]
        : [];
    const impliedValue = num(
      r.impliedValue ??
        r.implied_value ??
        r.impliedFdv ??
        r.implied_fdv ??
        val.mid ??
        val.impliedFdv ??
        val.fdv ??
        r.fdv,
      0
    );
    const impliedLow = num(
      r.impliedValueLow ?? r.implied_fdv_low ?? r.fdvLow ?? val.low ?? impliedValue * 0.65,
      0
    );
    const impliedHigh = num(
      r.impliedValueHigh ?? r.implied_fdv_high ?? r.fdvHigh ?? val.high ?? impliedValue * 1.45,
      0
    );
    const tvl = num(r.tvl ?? r.tvlUsd ?? r.tvl_usd, 0);
    const score = num(
      r.score ?? r.radarScore ?? r.radar_score ?? r.compositeScore ?? r.launchScore ?? 0,
      0
    );
    const steps = Array.isArray(farm.steps) ? farm.steps : Array.isArray(r.steps) ? r.steps : [];
    const slug = String(r.slug || r.id || r.name || `protocol-${idx + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-");
    const tier = String(
      r.tier || r.confidenceTier || r.confidence_tier || r.confidence || (score >= 75 ? "High" : score >= 50 ? "Medium" : "Speculative")
    );
    const difficulty = String(
      farm.difficulty || farm.effort || r.farmDifficulty || r.difficulty || "Medium"
    );
    const watchlist = Boolean(
      r.watchlist ?? r.inWatchlist ?? r.isWatchlist ?? r.on_watchlist ?? r.is_watchlist
    );
    const hasPoints = Boolean(
      r.hasPoints ?? r.pointsProgram ?? r.has_points ?? r.points ?? farm.pointsProgram
    );
    const airdropValue = num(
      r.impliedAirdrop ?? r.implied_airdrop ?? r.airdropValue ?? val.airdropUsd ?? impliedValue * 0.1,
      0
    );
    const change7d = num(r.tvlChange7d ?? r.change_7d ?? r.change7d ?? NaN, NaN);
    const change30d = num(r.tvlChange30d ?? r.change_30d ?? r.change30d ?? NaN, NaN);
    const multiple = tvl > 0 ? impliedValue / tvl : num(val.multiple ?? r.fdvTvlMultiple, 0);

    return {
      raw: r,
      rank: num(r.rank, idx + 1),
      slug,
      name: String(r.name || r.slug || `Protocol ${idx + 1}`),
      category: String(r.category || "Uncategorized"),
      chains,
      primaryChain: chains[0] || "Multi-Chain",
      tvl,
      change7d,
      change30d,
      impliedValue,
      impliedLow,
      impliedHigh,
      airdropValue,
      multiple,
      score,
      tier,
      difficulty,
      watchlist,
      hasPoints,
      stepsCount: steps.length,
      farmSummary: String(farm.summary || farm.strategy || farm.headline || steps[0]?.title || steps[0] || ""),
      searchBlob: [
        r.name,
        r.slug,
        r.category,
        r.description,
        chains.join(" "),
        tier,
        difficulty,
        watchlist ? "watchlist" : "",
        hasPoints ? "points campaign" : "",
      ]
        .join(" ")
        .toLowerCase(),
    };
  }

  function extractPayload(data) {
    if (!data) return { rows: [], meta: {} };
    if (Array.isArray(data)) return { rows: data, meta: {} };
    const rows = data.rows || data.protocols || data.board || data.items || [];
    const meta = data.meta || data.summary || {
      generatedAt: data.generatedAt || data.generated_at || data.snapshotDate || data.snapshot_date,
      totalScanned: data.totalScanned || data.total_scanned,
      eligibleCount: data.eligibleCount || data.eligible_count || rows.length,
    };
    return { rows: Array.isArray(rows) ? rows : [], meta };
  }

  async function loadData() {
    const inline =
      global.BOARD_DATA ||
      global.__BOARD_DATA__ ||
      global.RADAR_DATA ||
      global.TOKEN_RADAR_DATA;
    if (inline) return extractPayload(inline);

    const scriptEl = pick(['script#board-data', 'script#radar-data', 'script[type="application/json"]']);
    if (scriptEl && scriptEl.textContent.trim()) {
      try {
        return extractPayload(JSON.parse(scriptEl.textContent));
      } catch (_) {}
    }

    for (const url of ["./board.json", "../board.json", "board.json"]) {
      try {
        const res = await fetch(url);
        if (res.ok) return extractPayload(await res.json());
      } catch (_) {}
    }
    return { rows: [], meta: {} };
  }

  function readUrlParams() {
    const params = new URLSearchParams(global.location.search);
    if (global.location.hash.includes("=")) {
      const hashParams = new URLSearchParams(global.location.hash.replace(/^#\/?/, ""));
      hashParams.forEach((v, k) => {
        if (!params.has(k)) params.set(k, v);
      });
    }
    const f = state.filters;
    if (params.get("q") || params.get("search")) f.search = params.get("q") || params.get("search");
    if (params.get("category")) f.category = params.get("category");
    if (params.get("chain")) f.chain = params.get("chain");
    if (params.get("tier")) f.tier = params.get("tier");
    if (params.get("difficulty")) f.difficulty = params.get("difficulty");
    if (params.get("minTvl")) f.minTvl = num(params.get("minTvl"), 0);
    if (params.get("watchlist") === "1" || params.get("watchlist") === "true") f.watchlistOnly = true;
    if (params.get("points") === "1" || params.get("points") === "true") f.pointsOnly = true;
    if (params.get("sort")) state.sort.key = params.get("sort");
    if (params.get("dir") === "asc" || params.get("dir") === "desc") state.sort.dir = params.get("dir");
    if (params.get("protocol") || params.get("slug")) {
      state.selectedSlug = (params.get("protocol") || params.get("slug")).toLowerCase();
    }
  }

  function populateSelect(el, counts, allLabel) {
    if (!el) return;
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    el.innerHTML =
      `<option value="all">${esc(allLabel)}</option>` +
      entries.map(([k, c]) => `<option value="${esc(k)}">${esc(k)} (${c})</option>`).join("");
  }

  function populateFilterOptions() {
    const cats = new Map();
    const chains = new Map();
    const tiers = new Map();
    const diffs = new Map();
    for (const r of state.rows) {
      cats.set(r.category, (cats.get(r.category) || 0) + 1);
      tiers.set(r.tier, (tiers.get(r.tier) || 0) + 1);
      diffs.set(r.difficulty, (diffs.get(r.difficulty) || 0) + 1);
      for (const c of r.chains) chains.set(c, (chains.get(c) || 0) + 1);
    }
    populateSelect(pick(["#filter-category", "#category-filter", '[data-filter="category"]']), cats, "All Categories");
    populateSelect(pick(["#filter-chain", "#chain-filter", '[data-filter="chain"]']), chains, "All Chains");
    populateSelect(pick(["#filter-tier", "#filter-confidence", '[data-filter="tier"]']), tiers, "All Tiers");
    populateSelect(pick(["#filter-difficulty", "#filter-risk", '[data-filter="difficulty"]']), diffs, "All Difficulties");
    syncFilterControls();
  }

  function syncFilterControls() {
    const f = state.filters;
    const setVal = (sels, v) => {
      const el = pick(sels);
      if (el) el.value = String(v);
    };
    const setChk = (sels, v) => {
      const el = pick(sels);
      if (el) {
        if (el.type === "checkbox") el.checked = Boolean(v);
        else el.classList.toggle("active", Boolean(v));
      }
    };
    setVal(["#search-input", "#filter-search", 'input[type="search"]', '[data-filter="search"]'], f.search);
    setVal(["#filter-category", "#category-filter", '[data-filter="category"]'], f.category);
    setVal(["#filter-chain", "#chain-filter", '[data-filter="chain"]'], f.chain);
    setVal(["#filter-tier", "#filter-confidence", '[data-filter="tier"]'], f.tier);
    setVal(["#filter-difficulty", "#filter-risk", '[data-filter="difficulty"]'], f.difficulty);
    setVal(["#filter-min-tvl", "#min-tvl", '[data-filter="minTvl"]'], f.minTvl);
    setChk(["#filter-watchlist", "#toggle-watchlist", '[data-filter="watchlist"]'], f.watchlistOnly);
    setChk(["#filter-points", "#toggle-points", '[data-filter="points"]'], f.pointsOnly);
    setVal(["#sort-select", "#filter-sort", "[data-sort-select]"], `${state.sort.key}:${state.sort.dir}`);
    $$("[data-quick-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.quickFilter === f.quick);
    });
  }

  function applyFiltersAndSort() {
    const f = state.filters;
    const q = f.search.trim().toLowerCase();
    const minTvl = num(f.minTvl, 0);

    const out = state.rows.filter((r) => {
      if (q && !r.searchBlob.includes(q)) return false;
      if (f.category !== "all" && r.category !== f.category) return false;
      if (f.chain !== "all" && !r.chains.includes(f.chain)) return false;
      if (f.tier !== "all" && r.tier !== f.tier) return false;
      if (f.difficulty !== "all" && r.difficulty !== f.difficulty) return false;
      if (minTvl > 0 && r.tvl < minTvl) return false;
      if (f.watchlistOnly && !r.watchlist) return false;
      if (f.pointsOnly && !r.hasPoints) return false;
      if (f.quick === "watchlist" && !r.watchlist) return false;
      if (f.quick === "points" && !r.hasPoints) return false;
      if (f.quick === "mega" && r.impliedValue < 1e9) return false;
      if (f.quick === "easy" && !/low|easy|beginner/i.test(r.difficulty)) return false;
      if (f.quick === "high-tvl" && r.tvl < 1e8) return false;
      return true;
    });

    const { key, dir } = state.sort;
    const mult = dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "string" || typeof bv === "string") {
        const cmp = String(av || "").localeCompare(String(bv || ""));
        return cmp !== 0 ? cmp * mult : a.rank - b.rank;
      }
      const na = Number.isFinite(av) ? av : -Infinity;
      const nb = Number.isFinite(bv) ? bv : -Infinity;
      return na !== nb ? (na - nb) * mult : a.rank - b.rank;
    });

    state.filtered = out;
    renderAll();
    document.dispatchEvent(new CustomEvent("radar:filter", { detail: { count: out.length, filters: { ...f } } }));
  }

  function renderKpis() {
    const rows = state.filtered;
    const all = state.rows;
    const totalTvl = rows.reduce((s, r) => s + r.tvl, 0);
    const totalImplied = rows.reduce((s, r) => s + r.impliedValue, 0);
    const totalAirdrop = rows.reduce((s, r) => s + r.airdropValue, 0);
    const watchlistCount = rows.filter((r) => r.watchlist).length;
    const pointsCount = rows.filter((r) => r.hasPoints).length;
    const avgScore = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;

    const setText = (sels, text) => {
      const el = pick(sels);
      if (el) el.textContent = text;
    };

    setText(["#kpi-count", "#kpi-total-protocols", '[data-kpi="count"]'], `${rows.length} / ${all.length}`);
    setText(["#kpi-tvl", "#kpi-total-tvl", '[data-kpi="tvl"]'], fmtUsd(totalTvl));
    setText(["#kpi-implied", "#kpi-total-implied", "#kpi-total-fdv", '[data-kpi="implied"]'], fmtUsd(totalImplied));
    setText(["#kpi-airdrop", "#kpi-total-airdrop", '[data-kpi="airdrop"]'], fmtUsd(totalAirdrop));
    setText(["#kpi-watchlist", '[data-kpi="watchlist"]'], `${watchlistCount}`);
    setText(["#kpi-points", '[data-kpi="points"]'], `${pointsCount}`);
    setText(["#kpi-score", "#kpi-avg-score", '[data-kpi="score"]'], avgScore.toFixed(1));
    setText(["#results-count", "#row-count", '[data-results-count]'], `Showing ${rows.length} of ${all.length} protocols`);

    const snap = state.meta.snapshotDate || state.meta.snapshot_date || state.meta.generatedAt || state.meta.generated_at;
    if (snap) setText(["#snapshot-date", "#meta-snapshot", '[data-meta="snapshot"]'], String(snap).slice(0, 10));
  }

  function renderActiveChips() {
    const host = pick(["#active-filters", ".active-filters"]);
    if (!host) return;
    const f = state.filters;
    const chips = [];
    if (f.search) chips.push(["search", `Search: "${f.search}"`]);
    if (f.category !== "all") chips.push(["category", `Category: ${f.category}`]);
    if (f.chain !== "all") chips.push(["chain", `Chain: ${f.chain}`]);
    if (f.tier !== "all") chips.push(["tier", `Tier: ${f.tier}`]);
    if (f.difficulty !== "all") chips.push(["difficulty", `Difficulty: ${f.difficulty}`]);
    if (num(f.minTvl, 0) > 0) chips.push(["minTvl", `TVL ≥ ${fmtUsd(f.minTvl)}`]);
    if (f.watchlistOnly) chips.push(["watchlistOnly", "Watchlist Only"]);
    if (f.pointsOnly) chips.push(["pointsOnly", "Points Active"]);
    if (f.quick !== "all") chips.push(["quick", `Preset: ${f.quick}`]);

    host.innerHTML = chips
      .map(
        ([k, label]) =>
          `<button type="button" class="filter-chip active" data-clear-filter="${esc(k)}">${esc(label)} <span aria-hidden="true">×</span></button>`
      )
      .join("");
  }

  function renderSortIndicators() {
    $$("th[data-sort]").forEach((th) => {
      const active = th.dataset.sort === state.sort.key;
      th.classList.toggle("sorted", active);
      th.classList.toggle("sort-asc", active && state.sort.dir === "asc");
      th.classList.toggle("sort-desc", active && state.sort.dir === "desc");
      th.setAttribute("aria-sort", active ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none");
    });
  }

  function renderTable() {
    const tbody = pick(["#board-tbody", "#protocol-tbody", "#radar-tbody", "#board-table tbody", "table tbody"]);
    const emptyEl = pick(["#empty-state", ".empty-state"]);
    if (!tbody) return;

    if (!state.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">No tokenless protocols match the active filters.</td></tr>`;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    const html = state.filtered
      .map((r) => {
        const selected = r.slug === state.selectedSlug;
        const deltaClass = Number.isFinite(r.change7d) ? (r.change7d >= 0 ? "pos" : "neg") : "muted";
        const tierClass = r.tier.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const diffClass = r.difficulty.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const chainTags = r.chains.slice(0, 2).map((c) => `<span class="tag chain-tag">${esc(c)}</span>`).join("") +
          (r.chains.length > 2 ? `<span class="tag chain-tag">+${r.chains.length - 2}</span>` : "");
        const badges =
          (r.watchlist ? `<span class="badge badge-watchlist" title="Watchlist">★</span>` : "") +
          (r.hasPoints ? `<span class="badge badge-points" title="Active Points">PTS</span>` : "");

        return `<tr class="board-row${selected ? " is-selected selected" : ""}" data-slug="${esc(r.slug)}" tabindex="0" role="button" aria-selected="${selected}">
          <td class="col-rank num">#${r.rank}</td>
          <td class="col-name">
            <div class="proto-title"><strong>${esc(r.name)}</strong>${badges}</div>
            <div class="proto-chains">${chainTags}</div>
          </td>
          <td class="col-category"><span class="tag cat-tag">${esc(r.category)}</span></td>
          <td class="col-tvl num">
            <div>${fmtUsd(r.tvl)}</div>
            <div class="sub ${deltaClass}">${Number.isFinite(r.change7d) ? `${fmtPct(r.change7d)} 7d` : "—"}</div>
          </td>
          <td class="col-implied num">
            <div class="implied-main">${fmtUsd(r.impliedValue)}</div>
            <div class="sub muted">${fmtUsd(r.impliedLow)}–${fmtUsd(r.impliedHigh)}</div>
          </td>
          <td class="col-airdrop num">
            <div>${fmtUsd(r.airdropValue)}</div>
            <div class="sub muted">${r.multiple > 0 ? `${r.multiple.toFixed(1)}x TVL` : "—"}</div>
          </td>
          <td class="col-score num">
            <div class="score-wrap">
              <span>${r.score.toFixed(0)}</span>
              <span class="score-bar"><i style="width:${Math.max(4, Math.min(100, r.score))}%"></i></span>
            </div>
            <span class="tier-pill tier-${esc(tierClass)}">${esc(r.tier)}</span>
          </td>
          <td class="col-farm">
            <span class="diff-pill diff-${esc(diffClass)}">${esc(r.difficulty)}</span>
            <div class="sub muted farm-preview">${esc(r.farmSummary || `${r.stepsCount} steps`)}</div>
          </td>
        </tr>`;
      })
      .join("");

    tbody.innerHTML = html;
  }

  function renderAll() {
    renderKpis();
    renderActiveChips();
    renderSortIndicators();
    renderTable();
  }

  function openDetailPanel(row) {
    const panel = pick(["#detail-panel", "#detail-drawer", "#detail-modal", "#detail-view", "#protocol-detail", ".detail-drawer", ".detail-panel"]);
    const backdrop = pick(["#detail-backdrop", "#drawer-backdrop", ".detail-backdrop"]);
    if (panel) {
      panel.classList.add("open", "is-open");
      panel.hidden = false;
      panel.setAttribute("aria-hidden", "false");
    }
    if (backdrop) {
      backdrop.classList.add("open", "is-open");
      backdrop.hidden = false;
    }

    const ctx = {
      row,
      raw: row.raw,
      allRows: state.rows,
      filteredRows: state.filtered,
      meta: state.meta,
      close: closeDetail,
      selectBySlug,
      formatUsd: fmtUsd,
      formatPct: fmtPct,
    };

    let handled = false;
    const detailApi = global.RadarDetail || global.DetailView || global.DetailDrawer || global.DetailPanel;
    if (detailApi) {
      if (typeof detailApi.open === "function") {
        detailApi.open(row.raw, ctx);
        handled = true;
      } else if (typeof detailApi.render === "function") {
        detailApi.render(row.raw, panel, ctx);
        handled = true;
      } else if (typeof detailApi.show === "function") {
        detailApi.show(row.raw, ctx);
        handled = true;
      }
    } else if (typeof global.renderProtocolDetail === "function") {
      global.renderProtocolDetail(row.raw, panel, ctx);
      handled = true;
    } else if (typeof global.renderDetail === "function") {
      global.renderDetail(row.raw, panel, ctx);
      handled = true;
    } else if (typeof global.openDetail === "function") {
      global.openDetail(row.raw, ctx);
      handled = true;
    }

    if (!handled && panel) {
      const body = pick(["#detail-body", "#detail-content", ".detail-body"]) || panel;
      const steps = row.raw.farmPlan?.steps || row.raw.farm_plan?.steps || row.raw.farming?.steps || [];
      body.innerHTML = `<div class="detail-fallback">
        <h2>${esc(row.name)} <span class="tag">${esc(row.category)}</span></h2>
        <p>Rank #${row.rank} · TVL ${fmtUsd(row.tvl)} · Implied FDV ${fmtUsd(row.impliedValue)} (${fmtUsd(row.impliedLow)}–${fmtUsd(row.impliedHigh)})</p>
        <h3>Farming Steps (${steps.length})</h3>
        <ol>${steps.map((s) => `<li>${esc(typeof s === "string" ? s : s.title || s.action || s.description || "")}</li>`).join("")}</ol>
      </div>`;
    }
  }

  function selectBySlug(slug, scrollIntoView = false) {
    if (!slug) return;
    const norm = String(slug).toLowerCase();
    const row = state.rows.find((r) => r.slug === norm || r.name.toLowerCase() === norm);
    if (!row) return;
    state.selectedSlug = row.slug;
    $$("tr.board-row").forEach((tr) => {
      const match = tr.dataset.slug === row.slug;
      tr.classList.toggle("is-selected", match);
      tr.classList.toggle("selected", match);
      tr.setAttribute("aria-selected", String(match));
      if (match && scrollIntoView) tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    openDetailPanel(row);
    document.dispatchEvent(new CustomEvent("radar:select", { detail: { row: row.raw, normalized: row } }));
  }

  function closeDetail() {
    state.selectedSlug = null;
    const panel = pick(["#detail-panel", "#detail-drawer", "#detail-modal", "#detail-view", "#protocol-detail", ".detail-drawer", ".detail-panel"]);
    const backdrop = pick(["#detail-backdrop", "#drawer-backdrop", ".detail-backdrop"]);
    if (panel) {
      panel.classList.remove("open", "is-open");
      panel.setAttribute("aria-hidden", "true");
    }
    if (backdrop) backdrop.classList.remove("open", "is-open");
    const detailApi = global.RadarDetail || global.DetailView || global.DetailDrawer || global.DetailPanel;
    if (detailApi && typeof detailApi.close === "function") {
      try { detailApi.close(); } catch (_) {}
    }
    $$("tr.board-row.is-selected, tr.board-row.selected").forEach((tr) => {
      tr.classList.remove("is-selected", "selected");
      tr.setAttribute("aria-selected", "false");
    });
  }

  function resetFilters() {
    state.filters = {
      search: "",
      category: "all",
      chain: "all",
      tier: "all",
      difficulty: "all",
      minTvl: 0,
      watchlistOnly: false,
      pointsOnly: false,
      quick: "all",
    };
    state.sort = { key: "impliedValue", dir: "desc" };
    syncFilterControls();
    applyFiltersAndSort();
  }

  function exportCsv() {
    const header = ["Rank", "Protocol", "Category", "Chains", "TVL_USD", "Implied_FDV_USD", "Implied_Airdrop_USD", "Score", "Tier", "Difficulty", "Watchlist", "Points"];
    const lines = [header.join(",")];
    for (const r of state.filtered) {
      const cells = [r.rank, r.name, r.category, r.chains.join("|"), Math.round(r.tvl), Math.round(r.impliedValue), Math.round(r.airdropValue), r.score.toFixed(1), r.tier, r.difficulty, r.watchlist, r.hasPoints];
      lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "token-launch-radar.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function bindEvents() {
    let searchTimer = null;
    const searchEl = pick(["#search-input", "#filter-search", 'input[type="search"]', '[data-filter="search"]']);
    if (searchEl) {
      searchEl.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.filters.search = searchEl.value;
          applyFiltersAndSort();
        }, 120);
      });
    }

    const bindSelect = (sels, key, numeric = false) => {
      const el = pick(sels);
      if (!el) return;
      el.addEventListener("change", () => {
        state.filters[key] = numeric ? num(el.value, 0) : el.value;
        applyFiltersAndSort();
      });
    };
    bindSelect(["#filter-category", "#category-filter", '[data-filter="category"]'], "category");
    bindSelect(["#filter-chain", "#chain-filter", '[data-filter="chain"]'], "chain");
    bindSelect(["#filter-tier", "#filter-confidence", '[data-filter="tier"]'], "tier");
    bindSelect(["#filter-difficulty", "#filter-risk", '[data-filter="difficulty"]'], "difficulty");
    bindSelect(["#filter-min-tvl", "#min-tvl", '[data-filter="minTvl"]'], "minTvl", true);

    const bindToggle = (sels, key) => {
      const el = pick(sels);
      if (!el) return;
      const evt = el.type === "checkbox" ? "change" : "click";
      el.addEventListener(evt, () => {
        state.filters[key] = el.type === "checkbox" ? el.checked : !state.filters[key];
        syncFilterControls();
        applyFiltersAndSort();
      });
    };
    bindToggle(["#filter-watchlist", "#toggle-watchlist", '[data-filter="watchlist"]'], "watchlistOnly");
    bindToggle(["#filter-points", "#toggle-points", '[data-filter="points"]'], "pointsOnly");

    const sortSel = pick(["#sort-select", "#filter-sort", "[data-sort-select]"]);
    if (sortSel) {
      sortSel.addEventListener("change", () => {
        const [k, d] = sortSel.value.split(":");
        state.sort.key = k || "impliedValue";
        state.sort.dir = d || "desc";
        applyFiltersAndSort();
      });
    }

    $$("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "desc" ? "asc" : "desc";
        else {
          state.sort.key = key;
          state.sort.dir = key === "rank" || key === "name" ? "asc" : "desc";
        }
        syncFilterControls();
        applyFiltersAndSort();
      });
    });

    $$("[data-quick-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = btn.dataset.quickFilter;
        state.filters.quick = state.filters.quick === q ? "all" : q;
        syncFilterControls();
        applyFiltersAndSort();
      });
    });

    const resetBtn = pick(["#reset-filters", "#clear-filters", "#btn-reset", '[data-action="reset-filters"]']);
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);

    const csvBtn = pick(["#export-csv", '[data-action="export-csv"]']);
    if (csvBtn) csvBtn.addEventListener("click", exportCsv);

    const closeBtn = pick(["#detail-close", "#close-detail", '[data-action="close-detail"]', ".detail-close"]);
    if (closeBtn) closeBtn.addEventListener("click", closeDetail);

    const backdrop = pick(["#detail-backdrop", "#drawer-backdrop", ".detail-backdrop"]);
    if (backdrop) backdrop.addEventListener("click", closeDetail);

    document.addEventListener("click", (e) => {
      const clearChip = e.target.closest("[data-clear-filter]");
      if (clearChip) {
        const k = clearChip.dataset.clearFilter;
        state.filters[k] = k === "minTvl" ? 0 : k.endsWith("Only") ? false : k === "search" ? "" : "all";
        syncFilterControls();
        applyFiltersAndSort();
        return;
      }
      const tr = e.target.closest("tr.board-row[data-slug]");
      if (tr) selectBySlug(tr.dataset.slug);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDetail();
        return;
      }
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
        if (searchEl) {
          e.preventDefault();
          searchEl.focus();
        }
        return;
      }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && state.filtered.length && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        const idx = state.filtered.findIndex((r) => r.slug === state.selectedSlug);
        const next = e.key === "ArrowDown" ? Math.min(state.filtered.length - 1, idx + 1) : Math.max(0, idx - 1);
        selectBySlug(state.filtered[next].slug, true);
      }
    });
  }

  async function init() {
    const payload = await loadData();
    state.raw = payload;
    state.meta = payload.meta || {};
    state.rows = payload.rows.map(normalizeRow);
    readUrlParams();
    populateFilterOptions();
    bindEvents();
    applyFiltersAndSort();
    if (state.selectedSlug) selectBySlug(state.selectedSlug, true);
    document.dispatchEvent(new CustomEvent("radar:ready", { detail: { count: state.rows.length, meta: state.meta } }));
  }

  global.RadarApp = {
    getState: () => ({ ...state, filters: { ...state.filters }, sort: { ...state.sort } }),
    getAllRows: () => state.rows.slice(),
    getFilteredRows: () => state.filtered.slice(),
    setFilter: (patch) => {
      Object.assign(state.filters, patch);
      syncFilterControls();
      applyFiltersAndSort();
    },
    setSort: (key, dir = "desc") => {
      state.sort = { key, dir };
      syncFilterControls();
      applyFiltersAndSort();
    },
    resetFilters,
    selectBySlug,
    closeDetail,
    exportCsv,
    formatUsd: fmtUsd,
    formatPct: fmtPct,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);