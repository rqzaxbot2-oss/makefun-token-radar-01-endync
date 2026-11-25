(function () {
  "use strict";

  const STORAGE_KEY = "token_radar_farm_checks_v1";

  const q = (sels, root = document) => {
    for (const s of sels) {
      const el = root.querySelector(s);
      if (el) return el;
    }
    return null;
  };
  const qa = (sels, root = document) => {
    for (const s of sels) {
      const list = root.querySelectorAll(s);
      if (list.length) return Array.from(list);
    }
    return [];
  };
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const num = (...vals) => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    }
    return null;
  };

  const fmtUsd = (n, empty = "—") => {
    if (n === null || n === undefined || !Number.isFinite(n)) return empty;
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  const fmtPct = (n, signed = true) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return "—";
    const s = signed && n > 0 ? "+" : "";
    return `${s}${n.toFixed(1)}%`;
  };

  const tierSlug = (t) => String(t || "C").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveChecks(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }

  function normalizeFarm(raw) {
    const f = raw.farmPlan || raw.farmingPlan || raw.farming || raw.farm || raw.playbook || {};
    const rawSteps = Array.isArray(f) ? f : Array.isArray(f.steps) ? f.steps : Array.isArray(raw.farmSteps) ? raw.farmSteps : [];
    const steps = rawSteps.map((s, i) => {
      if (typeof s === "string") return { title: `Step ${i + 1}`, action: s, detail: "", effort: "" };
      return {
        title: s.title || s.step || s.name || `Step ${i + 1}`,
        action: s.action || s.description || s.instruction || s.text || "",
        detail: s.detail || s.rationale || s.tip || s.notes || "",
        effort: s.effort || s.cost || s.priority || "",
      };
    });
    return {
      summary: (typeof f === "object" && !Array.isArray(f) && (f.summary || f.strategy || f.overview)) || raw.farmSummary || "",
      difficulty: (typeof f === "object" && !Array.isArray(f) && (f.difficulty || f.effort)) || raw.farmDifficulty || "Medium",
      capital: (typeof f === "object" && !Array.isArray(f) && (f.capitalRequired || f.minCapital || f.capital)) || "",
      risk: (typeof f === "object" && !Array.isArray(f) && (f.riskLevel || f.risk)) || "",
      timeline: (typeof f === "object" && !Array.isArray(f) && (f.timeline || f.cadence || f.frequency)) || "",
      points: (typeof f === "object" && !Array.isArray(f) && (f.pointsProgram || f.points || f.hasPoints)) || false,
      tips: Array.isArray(f.tips) ? f.tips : Array.isArray(f.notes) ? f.notes : [],
      risks: Array.isArray(f.risks) ? f.risks : Array.isArray(f.warnings) ? f.warnings : [],
      steps,
    };
  }

  function normalizeRow(r, idx) {
    const v = r.valuation || r.impliedValuation || {};
    const m = r.metrics || {};
    const chains = Array.isArray(r.chains) && r.chains.length
      ? r.chains.map(String)
      : r.chain ? [String(r.chain)] : ["Multi-Chain"];
    const impliedFdv = num(
      r.impliedValue, r.implied_value, r.impliedFdv, r.implied_fdv, r.estimatedFdv,
      v.impliedFdv, v.impliedValue, v.mid, v.base, v.fdv, 0
    );
    const fdvLow = num(r.fdvLow, r.impliedLow, r.valuationLow, v.low, v.bear, impliedFdv ? impliedFdv * 0.65 : null);
    const fdvHigh = num(r.fdvHigh, r.impliedHigh, r.valuationHigh, v.high, v.bull, impliedFdv ? impliedFdv * 1.5 : null);
    const tvl = num(r.tvl, r.tvlUsd, m.tvl, 0);
    const airdropPool = num(
      r.airdropValue, r.impliedAirdrop, r.estimatedAirdrop, r.airdropPool,
      v.airdropPool, v.airdropValue, v.estimatedAirdrop, impliedFdv ? impliedFdv * 0.08 : null
    );
    const score = num(r.score, r.radarScore, r.launchScore, r.convictionScore, r.totalScore, v.score, 0);
    const rawProb = num(r.launchProbability, r.tokenProbability, r.probability, r.confidence, v.probability);
    const probability = rawProb !== null ? (rawProb <= 1 ? rawProb * 100 : rawProb) : null;
    const tier = String(r.tier || r.convictionTier || r.grade || r.conviction || (score >= 80 ? "S" : score >= 65 ? "A" : score >= 45 ? "B" : "C"));
    const slug = String(r.slug || r.id || (r.name || `protocol-${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    const farm = normalizeFarm(r);
    return {
      rank: num(r.rank, idx + 1),
      slug,
      name: String(r.name || r.protocol || slug),
      category: String(r.category || r.sector || "DeFi"),
      chains,
      primaryChain: chains[0],
      tvl,
      change1d: num(r.change_1d, r.change1d, m.change1d),
      change7d: num(r.change_7d, r.change7d, r.tvlChange7d, m.change7d),
      change30d: num(r.change_1m, r.change30d, r.tvlChange30d, r.growth30d, m.change30d),
      impliedFdv,
      fdvLow,
      fdvHigh,
      airdropPool,
      fdvTvl: num(r.fdvToTvl, r.multiple, v.multiple, v.fdvTvl, tvl > 0 ? impliedFdv / tvl : null),
      score,
      tier,
      tierKey: tierSlug(tier),
      watchlist: Boolean(r.watchlist || r.isWatchlist || r.onWatchlist || r.inWatchlist),
      raised: num(r.totalRaised, r.raised, r.funding, m.raised),
      feesAnn: num(r.annualizedFees, r.feesAnn, r.fees365d, m.annualizedFees),
      revAnn: num(r.annualizedRevenue, r.revAnn, r.revenue365d, m.annualizedRevenue),
      probability,
      description: String(r.description || r.summary || r.about || ""),
      rationale: String(r.rationale || r.thesis || r.valuationThesis || r.whyNoToken || v.rationale || ""),
      signals: Array.isArray(r.signals) ? r.signals : Array.isArray(r.catalysts) ? r.catalysts : Array.isArray(r.tags) ? r.tags : [],
      comps: Array.isArray(r.comps) ? r.comps : Array.isArray(r.peers) ? r.peers : Array.isArray(v.comps) ? v.comps : [],
      breakdown: r.scoreBreakdown || r.breakdown || v.breakdown || null,
      url: r.url || r.website || "",
      twitter: r.twitter || "",
      farm,
      searchHaystack: [
        r.name, slug, r.category, chains.join(" "), tier, r.description, r.rationale,
        farm.summary, farm.difficulty, farm.steps.map((s) => `${s.title} ${s.action}`).join(" "),
      ].join(" ").toLowerCase(),
    };
  }

  function loadPayload() {
    const raw =
      window.BOARD_DATA ||
      window.TOKEN_RADAR_DATA ||
      window.RADAR_DATA ||
      window.DASHBOARD_DATA ||
      window.__BOARD_DATA__ ||
      window.DATA ||
      null;
    if (!raw) return { rows: [], meta: {} };
    const arr = Array.isArray(raw) ? raw : raw.rows || raw.protocols || raw.board || raw.entries || raw.items || [];
    const rows = arr.map(normalizeRow);
    return { rows, meta: Array.isArray(raw) ? {} : raw.meta || raw.summary || raw };
  }

  const state = {
    rows: [],
    filtered: [],
    meta: {},
    selectedSlug: null,
    columns: [],
    checks: loadChecks(),
    filters: { search: "", category: "ALL", chain: "ALL", tier: "ALL", watchlist: false, difficulty: "ALL" },
    sort: { key: "rank", dir: "asc" },
  };

  const els = {};

  function resolveColumn(th) {
    const k = String(th.dataset.col || th.dataset.sort || th.textContent || "").trim().toLowerCase();
    if (k === "#" || k.includes("rank")) return { key: "rank", sort: "rank" };
    if (k.includes("protocol") || k.includes("name") || k.includes("project")) return { key: "protocol", sort: "name" };
    if (k.includes("cat") || k.includes("sector")) return { key: "category", sort: "category" };
    if (k.includes("chain") || k.includes("net") || k.includes("eco")) return { key: "chains", sort: "primaryChain" };
    if (k.includes("tvl") && !k.includes("fdv") && !k.includes("mult")) return { key: "tvl", sort: "tvl" };
    if (k.includes("7d") || k.includes("30d") || k.includes("grow") || k.includes("chg") || k.includes("change")) return { key: "growth", sort: "change30d" };
    if (k.includes("airdrop") || k.includes("drop") || k.includes("pool") || k.includes("reward")) return { key: "airdrop", sort: "airdropPool" };
    if (k.includes("implied") || k.includes("fdv") || k.includes("val")) return { key: "impliedFdv", sort: "impliedFdv" };
    if (k.includes("prob") || k.includes("odds") || k.includes("conf")) return { key: "probability", sort: "probability" };
    if (k.includes("raise") || k.includes("fund")) return { key: "raised", sort: "raised" };
    if (k.includes("score") || k.includes("radar")) return { key: "score", sort: "score" };
    if (k.includes("tier") || k.includes("grade") || k.includes("conv")) return { key: "tier", sort: "tier" };
    if (k.includes("farm") || k.includes("effort") || k.includes("plan") || k.includes("action")) return { key: "farm", sort: "farmSteps" };
    return { key: "text", sort: null };
  }

  function renderCell(row, colKey) {
    const chg = row.change30d !== null ? row.change30d : row.change7d;
    const chgCls = chg === null ? "muted" : chg >= 0 ? "pos" : "neg";
    switch (colKey) {
      case "rank":
        return `<td class="col-rank num"><span class="rank-num">${row.rank}</span></td>`;
      case "protocol":
        return `<td class="col-protocol"><div class="proto-cell"><span class="proto-name">${esc(row.name)}</span>${row.watchlist ? `<span class="badge badge-watch" title="Watchlist">★</span>` : ""}${row.farm.points ? `<span class="badge badge-pts" title="Points Program">PTS</span>` : ""}</div><div class="proto-sub">${esc(row.category)} · ${esc(row.primaryChain)}${row.chains.length > 1 ? ` +${row.chains.length - 1}` : ""}</div></td>`;
      case "category":
        return `<td class="col-category"><span class="pill pill-cat">${esc(row.category)}</span></td>`;
      case "chains":
        return `<td class="col-chains"><div class="chain-list">${row.chains.slice(0, 2).map((c) => `<span class="pill pill-chain">${esc(c)}</span>`).join("")}${row.chains.length > 2 ? `<span class="pill pill-more">+${row.chains.length - 2}</span>` : ""}</div></td>`;
      case "tvl":
        return `<td class="col-tvl num">${fmtUsd(row.tvl)}</td>`;
      case "growth":
        return `<td class="col-growth num ${chgCls}">${fmtPct(chg)}</td>`;
      case "impliedFdv":
        return `<td class="col-fdv num"><div class="fdv-main">${fmtUsd(row.impliedFdv)}</div>${row.fdvLow && row.fdvHigh ? `<div class="fdv-range">${fmtUsd(row.fdvLow)}–${fmtUsd(row.fdvHigh)}</div>` : ""}</td>`;
      case "airdrop":
        return `<td class="col-airdrop num">${fmtUsd(row.airdropPool)}</td>`;
      case "probability":
        return `<td class="col-prob num">${row.probability !== null ? `${row.probability.toFixed(0)}%` : "—"}</td>`;
      case "raised":
        return `<td class="col-raised num">${fmtUsd(row.raised)}</td>`;
      case "score": {
        const pct = Math.max(0, Math.min(100, row.score || 0));
        return `<td class="col-score num"><div class="score-wrap"><span>${row.score.toFixed(1)}</span><div class="score-bar"><i style="width:${pct}%"></i></div></div></td>`;
      }
      case "tier":
        return `<td class="col-tier"><span class="tier-badge tier-${esc(row.tierKey.toLowerCase())}">${esc(row.tier)}</span></td>`;
      case "farm":
        return `<td class="col-farm"><span class="pill pill-farm">${esc(row.farm.difficulty)} · ${row.farm.steps.length} steps</span></td>`;
      default:
        return `<td>—</td>`;
    }
  }

  function populateSelect(selectEl, values, allLabel) {
    if (!selectEl || selectEl.tagName !== "SELECT") return;
    const prev = selectEl.value || "ALL";
    if (selectEl.options.length <= 1) {
      selectEl.innerHTML = `<option value="ALL">${esc(allLabel)}</option>` +
        values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      selectEl.value = prev;
    }
  }

  function updateStats() {
    const list = state.filtered;
    const totalFdv = list.reduce((a, r) => a + (r.impliedFdv || 0), 0);
    const totalTvl = list.reduce((a, r) => a + (r.tvl || 0), 0);
    const totalAirdrop = list.reduce((a, r) => a + (r.airdropPool || 0), 0);
    const watchCount = list.filter((r) => r.watchlist).length;
    const setText = (sels, val) => { const el = q(sels); if (el) el.textContent = val; };

    setText(["#stat-total", "#kpi-total", "[data-stat='total']"], String(list.length));
    setText(["#stat-fdv", "#kpi-fdv", "#stat-implied-value", "[data-stat='fdv']", "[data-stat='implied']"], fmtUsd(totalFdv));
    setText(["#stat-tvl", "#kpi-tvl", "[data-stat='tvl']"], fmtUsd(totalTvl));
    setText(["#stat-airdrop", "#kpi-airdrop", "[data-stat='airdrop']"], fmtUsd(totalAirdrop));
    setText(["#stat-watchlist", "#kpi-watchlist", "[data-stat='watchlist']"], `${watchCount} / ${state.rows.filter((r) => r.watchlist).length}`);
    setText(["#result-count", "#filtered-count", "#table-count", ".result-count"], `Showing ${list.length} of ${state.rows.length} protocols`);
  }

  function renderActiveFilters() {
    if (!els.activeFilters) return;
    const f = state.filters;
    const chips = [];
    if (f.search) chips.push({ key: "search", label: `Search: "${f.search}"` });
    if (f.category !== "ALL") chips.push({ key: "category", label: `Category: ${f.category}` });
    if (f.chain !== "ALL") chips.push({ key: "chain", label: `Chain: ${f.chain}` });
    if (f.tier !== "ALL") chips.push({ key: "tier", label: `Tier: ${f.tier}` });
    if (f.difficulty !== "ALL") chips.push({ key: "difficulty", label: `Effort: ${f.difficulty}` });
    if (f.watchlist) chips.push({ key: "watchlist", label: "Watchlist Only" });
    els.activeFilters.innerHTML = chips.map((c) =>
      `<button type="button" class="filter-chip" data-clear="${esc(c.key)}">${esc(c.label)} <span aria-hidden="true">×</span></button>`
    ).join("");
    els.activeFilters.hidden = chips.length === 0;
  }

  function sortVal(row, key) {
    if (key === "farmSteps") return row.farm.steps.length;
    if (key === "tier") {
      const order = { S: 5, TIER1: 5, A: 4, TIER2: 4, B: 3, TIER3: 3, C: 2, D: 1 };
      return order[row.tierKey] || 0;
    }
    return row[key];
  }

  function applyFilters() {
    const f = state.filters;
    const term = f.search.trim().toLowerCase();
    const tKey = tierSlug(f.tier);

    state.filtered = state.rows.filter((r) => {
      if (term && !r.searchHaystack.includes(term)) return false;
      if (f.category !== "ALL" && r.category.toLowerCase() !== f.category.toLowerCase()) return false;
      if (f.chain !== "ALL" && !r.chains.some((c) => c.toLowerCase() === f.chain.toLowerCase())) return false;
      if (f.tier !== "ALL" && r.tierKey !== tKey && !r.tierKey.startsWith(tKey)) return false;
      if (f.difficulty !== "ALL" && r.farm.difficulty.toLowerCase() !== f.difficulty.toLowerCase()) return false;
      if (f.watchlist && !r.watchlist) return false;
      return true;
    });

    const { key, dir } = state.sort;
    const mult = dir === "asc" ? 1 : -1;
    state.filtered.sort((a, b) => {
      const va = sortVal(a, key);
      const vb = sortVal(b, key);
      if (va === vb) return (b.impliedFdv - a.impliedFdv) || a.name.localeCompare(b.name);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb)) * mult;
      return (va - vb) * mult;
    });

    updateStats();
    renderActiveFilters();
    renderTable();
    syncSortHeaders();
  }

  function syncSortHeaders() {
    for (const th of els.headers) {
      const s = th.dataset.resolvedSort;
      th.classList.remove("sort-asc", "sort-desc");
      th.removeAttribute("aria-sort");
      if (s && s === state.sort.key) {
        th.classList.add(state.sort.dir === "asc" ? "sort-asc" : "sort-desc");
        th.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      }
    }
  }

  function renderTable() {
    if (!els.tbody) return;
    if (!state.filtered.length) {
      els.tbody.innerHTML = `<tr class="empty-row"><td colspan="${Math.max(1, state.columns.length)}">No protocols match the current filters.</td></tr>`;
      if (els.emptyState) els.emptyState.hidden = false;
      return;
    }
    if (els.emptyState) els.emptyState.hidden = true;
    els.tbody.innerHTML = state.filtered.map((row) => {
      const active = row.slug === state.selectedSlug ? " is-selected selected" : "";
      const watch = row.watchlist ? " is-watchlist" : "";
      return `<tr class="protocol-row${active}${watch}" data-slug="${esc(row.slug)}" tabindex="0">${state.columns.map((c) => renderCell(row, c.key)).join("")}</tr>`;
    }).join("");
  }

  function renderDetailHtml(row) {
    const checked = state.checks[row.slug] || {};
    const doneCount = row.farm.steps.filter((_, i) => checked[i]).length;
    const totalSteps = row.farm.steps.length;
    const progPct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;
    const rangeSpan = row.fdvLow && row.fdvHigh && row.fdvHigh > row.fdvLow
      ? Math.max(5, Math.min(95, ((row.impliedFdv - row.fdvLow) / (row.fdvHigh - row.fdvLow)) * 100))
      : 50;

    const breakdownEntries = row.breakdown && typeof row.breakdown === "object"
      ? Object.entries(row.breakdown).filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      : [];

    return `
      <div class="detail-header-block">
        <div class="detail-badges">
          <span class="tier-badge tier-${esc(row.tierKey.toLowerCase())}">Tier ${esc(row.tier)}</span>
          <span class="pill pill-cat">${esc(row.category)}</span>
          ${row.watchlist ? `<span class="badge badge-watch">★ Watchlist</span>` : ""}
          ${row.farm.points ? `<span class="badge badge-pts">Points Active</span>` : ""}
          <span class="pill">Rank #${row.rank}</span>
        </div>
        <h2 class="detail-title">${esc(row.name)}</h2>
        ${row.description ? `<p class="detail-desc">${esc(row.description)}</p>` : ""}
        <div class="chain-list">${row.chains.map((c) => `<span class="pill pill-chain">${esc(c)}</span>`).join("")}</div>
      </div>

      <div class="detail-metrics-grid">
        <div class="metric-card accent"><span class="metric-label">Implied Launch FDV</span><strong class="metric-val">${fmtUsd(row.impliedFdv)}</strong><span class="metric-sub">${row.fdvLow && row.fdvHigh ? `${fmtUsd(row.fdvLow)} – ${fmtUsd(row.fdvHigh)}` : "Base estimate"}</span></div>
        <div class="metric-card"><span class="metric-label">Est. Airdrop Pool</span><strong class="metric-val">${fmtUsd(row.airdropPool)}</strong><span class="metric-sub">${row.impliedFdv && row.airdropPool ? `${((row.airdropPool / row.impliedFdv) * 100).toFixed(1)}% of FDV` : "Community alloc"}</span></div>
        <div class="metric-card"><span class="metric-label">Total Value Locked</span><strong class="metric-val">${fmtUsd(row.tvl)}</strong><span class="metric-sub">30d: ${fmtPct(row.change30d)} · 7d: ${fmtPct(row.change7d)}</span></div>
        <div class="metric-card"><span class="metric-label">Radar Score</span><strong class="metric-val">${row.score.toFixed(1)} / 100</strong><span class="metric-sub">${row.probability !== null ? `Launch odds: ${row.probability.toFixed(0)}%` : `FDV/TVL: ${row.fdvTvl ? row.fdvTvl.toFixed(2) + "x" : "—"}`}</span></div>
        ${row.raised ? `<div class="metric-card"><span class="metric-label">Funding Raised</span><strong class="metric-val">${fmtUsd(row.raised)}</strong><span class="metric-sub">Reported VC backing</span></div>` : ""}
        ${row.feesAnn || row.revAnn ? `<div class="metric-card"><span class="metric-label">Annualized Fees / Rev</span><strong class="metric-val">${fmtUsd(row.feesAnn || row.revAnn)}</strong><span class="metric-sub">${row.revAnn ? `Rev: ${fmtUsd(row.revAnn)}` : "Protocol fees"}</span></div>` : ""}
      </div>

      ${row.fdvLow && row.fdvHigh ? `
      <div class="detail-section">
        <h3>Valuation Range</h3>
        <div class="range-bar-wrap">
          <div class="range-labels"><span>Bear ${fmtUsd(row.fdvLow)}</span><span>Base ${fmtUsd(row.impliedFdv)}</span><span>Bull ${fmtUsd(row.fdvHigh)}</span></div>
          <div class="range-track"><span class="range-pin" style="left:${rangeSpan}%"></span></div>
        </div>
      </div>` : ""}

      ${row.rationale || row.signals.length ? `
      <div class="detail-section">
        <h3>Token Launch Thesis & Signals</h3>
        ${row.rationale ? `<p class="detail-rationale">${esc(row.rationale)}</p>` : ""}
        ${row.signals.length ? `<div class="signal-list">${row.signals.map((s) => `<span class="pill pill-signal">${esc(typeof s === "string" ? s : s.label || s.name || "")}</span>`).join("")}</div>` : ""}
      </div>` : ""}

      ${breakdownEntries.length ? `
      <div class="detail-section">
        <h3>Score Breakdown</h3>
        <div class="breakdown-list">${breakdownEntries.map(([k, val]) => {
          const pct = Math.max(0, Math.min(100, val <= 1 ? val * 100 : val));
          return `<div class="breakdown-row"><span>${esc(k.replace(/([A-Z])/g, " $1"))}</span><div class="score-bar"><i style="width:${pct}%"></i></div><strong>${val <= 1 ? (val * 100).toFixed(0) : val.toFixed(1)}</strong></div>`;
        }).join("")}</div>
      </div>` : ""}

      ${row.comps.length ? `
      <div class="detail-section">
        <h3>Comparable Launches</h3>
        <div class="comp-list">${row.comps.slice(0, 5).map((c) => `<span class="pill pill-comp">${esc(typeof c === "string" ? c : `${c.name || c.protocol || "Peer"}${c.fdv ? " (" + fmtUsd(c.fdv) + ")" : ""}`)}</span>`).join("")}</div>
      </div>` : ""}

      <div class="detail-section farm-section">
        <div class="farm-head">
          <h3>Farming Playbook</h3>
          <button type="button" class="btn-copy-plan" data-copy-plan="${esc(row.slug)}">Copy Plan</button>
        </div>
        ${row.farm.summary ? `<p class="farm-summary">${esc(row.farm.summary)}</p>` : ""}
        <div class="farm-meta">
          <span class="pill">Difficulty: ${esc(row.farm.difficulty)}</span>
          ${row.farm.capital ? `<span class="pill">Capital: ${esc(row.farm.capital)}</span>` : ""}
          ${row.farm.risk ? `<span class="pill">Risk: ${esc(row.farm.risk)}</span>` : ""}
          ${row.farm.timeline ? `<span class="pill">Cadence: ${esc(row.farm.timeline)}</span>` : ""}
        </div>
        <div class="farm-progress">
          <span>Checklist Progress: <strong>${doneCount} / ${totalSteps}</strong></span>
          <div class="score-bar"><i style="width:${progPct}%"></i></div>
        </div>
        <ol class="farm-steps">${row.farm.steps.map((s, i) => `
          <li class="farm-step${checked[i] ? " is-done" : ""}">
            <label class="step-label">
              <input type="checkbox" class="step-check" data-slug="${esc(row.slug)}" data-step="${i}" ${checked[i] ? "checked" : ""}>
              <div class="step-body">
                <div class="step-title"><strong>${esc(s.title)}</strong>${s.effort ? `<span class="pill pill-effort">${esc(s.effort)}</span>` : ""}</div>
                ${s.action ? `<p class="step-action">${esc(s.action)}</p>` : ""}
                ${s.detail ? `<p class="step-detail">${esc(s.detail)}</p>` : ""}
              </div>
            </label>
          </li>`).join("")}
        </ol>
        ${row.farm.risks.length ? `<div class="farm-callout"><strong>Key Risks:</strong><ul>${row.farm.risks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      </div>`;
  }

  function openDetail(slug) {
    const row = state.rows.find((r) => r.slug === slug);
    if (!row) return;
    state.selectedSlug = slug;
    const target = els.detailBody || els.detailPanel;
    if (target) target.innerHTML = renderDetailHtml(row);
    if (els.detailPanel) {
      els.detailPanel.hidden = false;
      els.detailPanel.classList.remove("hidden", "is-hidden");
      els.detailPanel.classList.add("open", "is-open", "active", "visible");
      els.detailPanel.setAttribute("aria-hidden", "false");
    }
    if (els.backdrop) {
      els.backdrop.hidden = false;
      els.backdrop.classList.add("open", "is-open", "active", "visible");
    }
    renderTable();
  }

  function closeDetail() {
    state.selectedSlug = null;
    if (els.detailPanel) {
      els.detailPanel.classList.remove("open", "is-open", "active", "visible");
      els.detailPanel.setAttribute("aria-hidden", "true");
      if (!els.detailPanel.classList.contains("detail-static")) els.detailPanel.hidden = true;
    }
    if (els.backdrop) {
      els.backdrop.classList.remove("open", "is-open", "active", "visible");
      els.backdrop.hidden = true;
    }
    renderTable();
  }

  function copyFarmPlan(slug, btn) {
    const row = state.rows.find((r) => r.slug === slug);
    if (!row) return;
    const text = [
      `${row.name} — Token Launch Radar Farming Plan`,
      `Category: ${row.category} | Chains: ${row.chains.join(", ")} | Tier: ${row.tier}`,
      `Implied FDV: ${fmtUsd(row.impliedFdv)} | Est. Airdrop: ${fmtUsd(row.airdropPool)} | TVL: ${fmtUsd(row.tvl)}`,
      "",
      ...row.farm.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.action}${s.detail ? ` (${s.detail})` : ""}`),
    ].join("\n");
    const done = () => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      done();
    }
  }

  function syncControls() {
    if (els.search) els.search.value = state.filters.search;
    if (els.category) els.category.value = state.filters.category;
    if (els.chain) els.chain.value = state.filters.chain;
    if (els.tier) els.tier.value = state.filters.tier;
    if (els.difficulty) els.difficulty.value = state.filters.difficulty;
    if (els.watchlist) {
      if (els.watchlist.type === "checkbox") els.watchlist.checked = state.filters.watchlist;
      else {
        els.watchlist.classList.toggle("active", state.filters.watchlist);
        els.watchlist.setAttribute("aria-pressed", String(state.filters.watchlist));
      }
    }
    for (const btn of els.tierBtns) {
      const t = btn.dataset.tier || "ALL";
      const on = tierSlug(t) === tierSlug(state.filters.tier) || (t === "ALL" && state.filters.tier === "ALL");
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
  }

  function resetFilters() {
    state.filters = { search: "", category: "ALL", chain: "ALL", tier: "ALL", watchlist: false, difficulty: "ALL" };
    syncControls();
    applyFilters();
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (window.location.hash && window.location.hash.includes("=")) {
      const h = new URLSearchParams(window.location.hash.slice(1));
      h.forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
    }
    if (params.get("q") || params.get("search")) state.filters.search = params.get("q") || params.get("search");
    if (params.get("category")) state.filters.category = params.get("category");
    if (params.get("chain")) state.filters.chain = params.get("chain");
    if (params.get("tier")) state.filters.tier = params.get("tier");
    if (params.get("difficulty")) state.filters.difficulty = params.get("difficulty");
    if (params.get("watchlist") === "1" || params.get("watchlist") === "true") state.filters.watchlist = true;
    if (params.get("sort")) state.sort.key = params.get("sort");
    if (params.get("dir") === "asc" || params.get("dir") === "desc") state.sort.dir = params.get("dir");
    return params.get("protocol") || params.get("detail") || params.get("slug");
  }

  function bindEvents() {
    if (els.search) {
      els.search.addEventListener("input", (e) => {
        state.filters.search = e.target.value;
        applyFilters();
      });
    }
    if (els.category) els.category.addEventListener("change", (e) => { state.filters.category = e.target.value; applyFilters(); });
    if (els.chain) els.chain.addEventListener("change", (e) => { state.filters.chain = e.target.value; applyFilters(); });
    if (els.tier) els.tier.addEventListener("change", (e) => { state.filters.tier = e.target.value; syncControls(); applyFilters(); });
    if (els.difficulty) els.difficulty.addEventListener("change", (e) => { state.filters.difficulty = e.target.value; applyFilters(); });
    if (els.watchlist) {
      const ev = els.watchlist.type === "checkbox" ? "change" : "click";
      els.watchlist.addEventListener(ev, () => {
        state.filters.watchlist = els.watchlist.type === "checkbox" ? els.watchlist.checked : !state.filters.watchlist;
        syncControls();
        applyFilters();
      });
    }
    for (const btn of els.tierBtns) {
      btn.addEventListener("click", () => {
        const t = btn.dataset.tier || "ALL";
        state.filters.tier = state.filters.tier === t && t !== "ALL" ? "ALL" : t;
        syncControls();
        applyFilters();
      });
    }
    if (els.sortSelect) {
      els.sortSelect.addEventListener("change", (e) => {
        const [k, d] = String(e.target.value).split(":");
        state.sort.key = k || "impliedFdv";
        state.sort.dir = d || (k === "rank" || k === "name" ? "asc" : "desc");
        applyFilters();
      });
    }
    if (els.resetBtn) els.resetBtn.addEventListener("click", resetFilters);
    if (els.activeFilters) {
      els.activeFilters.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-clear]");
        if (!btn) return;
        const k = btn.dataset.clear;
        state.filters[k] = k === "watchlist" ? false : k === "search" ? "" : "ALL";
        syncControls();
        applyFilters();
      });
    }
    for (const th of els.headers) {
      const sortKey = th.dataset.resolvedSort;
      if (!sortKey) continue;
      th.classList.add("sortable");
      th.addEventListener("click", () => {
        if (state.sort.key === sortKey) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else {
          state.sort.key = sortKey;
          state.sort.dir = sortKey === "rank" || sortKey === "name" ? "asc" : "desc";
        }
        applyFilters();
      });
    }
    if (els.tbody) {
      els.tbody.addEventListener("click", (e) => {
        const tr = e.target.closest("tr[data-slug]");
        if (tr) openDetail(tr.dataset.slug);
      });
      els.tbody.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          const tr = e.target.closest("tr[data-slug]");
          if (tr) { e.preventDefault(); openDetail(tr.dataset.slug); }
        }
      });
    }
    if (els.detailPanel) {
      els.detailPanel.addEventListener("change", (e) => {
        const cb = e.target.closest(".step-check");
        if (!cb) return;
        const slug = cb.dataset.slug;
        const step = Number(cb.dataset.step);
        state.checks[slug] = state.checks[slug] || {};
        state.checks[slug][step] = cb.checked;
        saveChecks(state.checks);
        openDetail(slug);
      });
      els.detailPanel.addEventListener("click", (e) => {
        const copyBtn = e.target.closest("[data-copy-plan]");
        if (copyBtn) copyFarmPlan(copyBtn.dataset.copyPlan, copyBtn);
        if (e.target.closest("#detail-close, #close-detail, .detail-close, [data-action='close-detail']")) closeDetail();
      });
    }
    if (els.closeBtn) els.closeBtn.addEventListener("click", closeDetail);
    if (els.backdrop) els.backdrop.addEventListener("click", closeDetail);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.selectedSlug) closeDetail();
      if (e.key === "/" && els.search && document.activeElement !== els.search && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        els.search.focus();
      }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && state.selectedSlug && state.filtered.length) {
        const idx = state.filtered.findIndex((r) => r.slug === state.selectedSlug);
        if (idx !== -1) {
          const next = state.filtered[idx + (e.key === "ArrowDown" ? 1 : -1)];
          if (next) { e.preventDefault(); openDetail(next.slug); }
        }
      }
    });
  }

  function init() {
    const payload = loadPayload();
    state.rows = payload.rows;
    state.meta = payload.meta;

    els.tbody = q(["#board-body", "#radar-body", "#protocol-tbody", "table tbody"]);
    els.headers = qa(["#board-table thead th", "#radar-table thead th", "table thead th"]);
    els.search = q(["#search-input", "#search", "input[type='search']", "[data-filter='search']"]);
    els.category = q(["#category-filter", "#filter-category", "[data-filter='category']"]);
    els.chain = q(["#chain-filter", "#filter-chain", "[data-filter='chain']"]);
    els.tier = q(["#tier-filter", "#filter-tier", "select[data-filter='tier']"]);
    els.difficulty = q(["#difficulty-filter", "#filter-difficulty", "[data-filter='difficulty']"]);
    els.watchlist = q(["#watchlist-filter", "#watchlist-only", "#filter-watchlist", "[data-filter='watchlist']"]);
    els.tierBtns = qa(["button[data-tier]", ".tier-btn[data-tier]", ".tier-pill[data-tier]"]);
    els.sortSelect = q(["#sort-select", "#sort-by", "[data-filter='sort']"]);
    els.resetBtn = q(["#reset-filters", "#clear-filters", "[data-action='reset']"]);
    els.activeFilters = q(["#active-filters", ".active-filters"]);
    els.emptyState = q(["#empty-state", ".empty-state"]);
    els.detailPanel = q(["#detail-panel", "#detail-drawer", "#detail-modal", "#protocol-detail", ".detail-panel"]);
    els.detailBody = q(["#detail-content", "#detail-body", ".detail-body", ".detail-content"]);
    els.closeBtn = q(["#detail-close", "#close-detail", ".detail-close", "[data-action='close-detail']"]);
    els.backdrop = q(["#detail-backdrop", "#modal-backdrop", ".modal-backdrop"]);

    state.columns = els.headers.length
      ? els.headers.map((th) => {
          const col = resolveColumn(th);
          if (col.sort) th.dataset.resolvedSort = col.sort;
          return col;
        })
      : ["rank", "protocol", "category", "chains", "tvl", "growth", "impliedFdv", "airdrop", "score", "tier", "farm"].map((k) => ({ key: k, sort: k }));

    const categories = Array.from(new Set(state.rows.map((r) => r.category))).sort();
    const chains = Array.from(new Set(state.rows.flatMap((r) => r.chains))).sort();
    const tiers = Array.from(new Set(state.rows.map((r) => r.tier)));
    const diffs = Array.from(new Set(state.rows.map((r) => r.farm.difficulty))).sort();
    populateSelect(els.category, categories, "All Categories");
    populateSelect(els.chain, chains, "All Chains");
    populateSelect(els.tier, tiers, "All Tiers");
    populateSelect(els.difficulty, diffs, "All Efforts");

    const initialSlug = readUrlParams();
    syncControls();
    bindEvents();
    applyFilters();
    if (initialSlug) openDetail(initialSlug);

    window.TokenRadarApp = {
      openDetail,
      closeDetail,
      resetFilters,
      setFilters(patch) {
        Object.assign(state.filters, patch || {});
        syncControls();
        applyFilters();
      },
      getState: () => ({ filters: { ...state.filters }, sort: { ...state.sort }, total: state.rows.length, shown: state.filtered.length, selectedSlug: state.selectedSlug }),
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();