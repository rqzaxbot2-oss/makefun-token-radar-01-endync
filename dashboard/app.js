(() => {
  'use strict';

  const state = {
    all: [],
    filtered: [],
    selected: null,
    checkedSteps: Object.create(null),
    filters: { q: '', category: '', chain: '', tier: '', watchlist: false },
    sort: { key: 'impliedFdv', dir: 'desc' },
    meta: {},
  };

  const pick = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const num = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  const fmtUsd = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const fmtPct = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  };

  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');

  function normalizeFarm(raw) {
    const f = raw.farmPlan || raw.farmingPlan || raw.farming || raw.farm || {};
    const rawSteps = Array.isArray(f) ? f : Array.isArray(f.steps) ? f.steps : Array.isArray(f.actions) ? f.actions : [];
    const steps = rawSteps.map((s, i) => {
      if (typeof s === 'string') return { title: `Step ${i + 1}`, detail: s, priority: 'Core' };
      return {
        title: s.title || s.name || s.action || `Step ${i + 1}`,
        detail: s.detail || s.description || s.instructions || s.rationale || s.action || '',
        priority: s.priority || s.phase || s.effort || 'Core',
      };
    });
    return {
      summary: typeof f === 'string' ? f : f.summary || f.strategy || f.overview || 'Provide organic liquidity and consistent protocol activity.',
      difficulty: f.difficulty || f.effort || 'Medium',
      risk: f.riskLevel || f.risk || 'Moderate',
      minCapital: f.minCapital ?? f.recommendedCapital ?? f.capitalUsd ?? null,
      timeline: f.timeline || f.cadence || f.horizon || '3–6 months',
      risks: Array.isArray(f.risks) ? f.risks : Array.isArray(f.warnings) ? f.warnings : [],
      steps: steps.length ? steps : [{ title: 'Core Usage', detail: 'Interact with core pools/vaults across multiple weeks.', priority: 'Core' }],
    };
  }

  function normalizeRow(raw, idx) {
    const v = raw.valuation && typeof raw.valuation === 'object' ? raw.valuation : {};
    const tvl = num(raw.tvl ?? raw.tvlUsd ?? raw.currentTvl ?? raw.metrics?.tvl, 0);
    const impliedFdv = num(
      raw.impliedValue ?? raw.impliedFdv ?? raw.impliedValuation ?? raw.estimatedFdv ?? raw.fdv ?? v.mid ?? v.base ?? v.impliedFdv,
      0
    );
    const fdvLow = num(raw.impliedFdvLow ?? raw.fdvLow ?? v.low ?? v.conservative, impliedFdv * 0.65);
    const fdvHigh = num(raw.impliedFdvHigh ?? raw.fdvHigh ?? v.high ?? v.bull, impliedFdv * 1.45);
    const airdropValue = num(raw.impliedAirdrop ?? raw.airdropValue ?? raw.estimatedAirdrop ?? v.airdropPool ?? v.airdropValue, impliedFdv * 0.08);
    const score = num(raw.score ?? raw.radarScore ?? raw.launchScore ?? raw.compositeScore ?? raw.confidenceScore, 0);
    const chains = Array.isArray(raw.chains) && raw.chains.length
      ? raw.chains.map(String)
      : raw.chain ? [String(raw.chain)] : ['Multi-chain'];
    const name = String(raw.name || raw.protocol || raw.slug || `Protocol ${idx + 1}`);
    const slug = String(raw.slug || raw.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const tier = String(raw.tier || raw.conviction || raw.grade || (score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 50 ? 'B' : 'C'));
    const c7 = raw.change7d ?? raw.change_7d ?? raw.tvlChange7d ?? raw.metrics?.change7d;
    const c30 = raw.change30d ?? raw.change_1m ?? raw.tvlChange30d ?? raw.metrics?.change30d;
    const signals = Array.isArray(raw.signals) ? raw.signals : Array.isArray(raw.catalysts) ? raw.catalysts : Array.isArray(raw.tags) ? raw.tags : [];
    const comps = Array.isArray(raw.comps) ? raw.comps : Array.isArray(raw.comparables) ? raw.comparables : Array.isArray(v.comps) ? v.comps : [];
    return {
      rank: num(raw.rank, idx + 1),
      slug,
      name,
      category: String(raw.category || 'DeFi'),
      chains,
      primaryChain: chains[0],
      tvl,
      change7d: c7 != null && Number.isFinite(Number(c7)) ? Number(c7) : null,
      change30d: c30 != null && Number.isFinite(Number(c30)) ? Number(c30) : null,
      impliedFdv,
      fdvLow,
      fdvHigh,
      airdropValue,
      multiple: num(raw.multiple ?? v.multiple ?? v.fdvTvlMultiple, tvl > 0 ? impliedFdv / tvl : 0),
      score,
      tier,
      watchlist: Boolean(raw.watchlist ?? raw.inWatchlist ?? raw.isWatchlist ?? raw.onWatchlist),
      description: String(raw.description || raw.thesis || raw.rationale || raw.summary || ''),
      methodology: String(raw.methodology || v.methodology || v.rationale || ''),
      signals: signals.map((s) => (typeof s === 'string' ? s : s.label || s.name || '')).filter(Boolean),
      comps,
      url: safeUrl(raw.url || raw.website),
      twitter: raw.twitter ? String(raw.twitter) : '',
      farm: normalizeFarm(raw),
      searchText: `${name} ${slug} ${raw.category || ''} ${chains.join(' ')} ${signals.join(' ')}`.toLowerCase(),
    };
  }

  async function loadBoardData() {
    const inline = window.__BOARD_DATA__ || window.BOARD_DATA || window.TOKEN_RADAR_DATA || window.RADAR_DATA || window.__DATA__;
    if (inline) return inline;
    const scriptEl = document.getElementById('board-data') || document.querySelector('script[type="application/json"][data-board]');
    if (scriptEl && scriptEl.textContent.trim()) {
      try { return JSON.parse(scriptEl.textContent); } catch (_) { /* continue */ }
    }
    for (const path of ['./board.json', 'board.json', '../board.json']) {
      try {
        const res = await fetch(path);
        if (res.ok) return await res.json();
      } catch (_) { /* offline file:// fallback */ }
    }
    return { rows: [] };
  }

  function extractRows(payload) {
    if (Array.isArray(payload)) return { rows: payload, meta: {} };
    const rows = payload?.rows || payload?.board || payload?.protocols || payload?.items || payload?.entries || [];
    return { rows: Array.isArray(rows) ? rows : [], meta: payload?.meta || payload?.summary || {} };
  }

  function inferColKey(th) {
    const k = `${th.dataset.col || ''} ${th.dataset.sort || ''} ${th.textContent || ''}`.toLowerCase();
    if (/rank|#/.test(k)) return 'rank';
    if (/protocol|name|project/.test(k)) return 'protocol';
    if (/cat|sector/.test(k)) return 'category';
    if (/chain|network/.test(k)) return 'chain';
    if (/airdrop|pool|reward/.test(k)) return 'airdrop';
    if (/implied|fdv|val/.test(k)) return 'impliedFdv';
    if (/tvl/.test(k)) return 'tvl';
    if (/score|signal|conf|conv|rating/.test(k)) return 'score';
    if (/tier|grade/.test(k)) return 'tier';
    if (/farm|plan|action|step|detail/.test(k)) return 'farm';
    return 'protocol';
  }

  function getTableColumns() {
    const ths = Array.from(document.querySelectorAll('table thead th'));
    if (!ths.length) return ['rank', 'protocol', 'category', 'tvl', 'impliedFdv', 'airdrop', 'score', 'farm'];
    return ths.map(inferColKey);
  }

  function renderCell(col, r) {
    const tierCls = `tier-${esc(r.tier.toLowerCase().replace(/[^a-z0-9]/g, ''))}`;
    switch (col) {
      case 'rank':
        return `<td class="num col-rank">#${r.rank}</td>`;
      case 'protocol':
        return `<td class="col-protocol"><div class="proto-cell"><span class="proto-name">${esc(r.name)}</span>${r.watchlist ? '<span class="badge badge-watch">Watchlist</span>' : ''}</div><div class="proto-sub">${esc(r.chains.slice(0, 3).join(', '))}${r.chains.length > 3 ? ` +${r.chains.length - 3}` : ''}</div></td>`;
      case 'category':
        return `<td class="col-category"><span class="pill">${esc(r.category)}</span></td>`;
      case 'chain':
        return `<td class="col-chain">${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ` +${r.chains.length - 2}` : ''}</td>`;
      case 'tvl':
        return `<td class="num col-tvl"><div>${fmtUsd(r.tvl)}</div>${r.change7d != null ? `<div class="delta ${r.change7d >= 0 ? 'pos' : 'neg'}">${fmtPct(r.change7d)}</div>` : ''}</td>`;
      case 'impliedFdv':
        return `<td class="num col-implied"><div class="val-strong">${fmtUsd(r.impliedFdv)}</div><div class="val-sub">${fmtUsd(r.fdvLow)}–${fmtUsd(r.fdvHigh)}</div></td>`;
      case 'airdrop':
        return `<td class="num col-airdrop">${fmtUsd(r.airdropValue)}</td>`;
      case 'score':
        return `<td class="num col-score"><span class="score-badge ${tierCls}">${r.score.toFixed(1)}</span></td>`;
      case 'tier':
        return `<td class="col-tier"><span class="badge ${tierCls}">${esc(r.tier)}</span></td>`;
      case 'farm':
        return `<td class="col-farm"><button type="button" class="btn-detail" data-open="${esc(r.slug)}">${r.farm.steps.length} steps</button></td>`;
      default:
        return `<td>${esc(r.name)}</td>`;
    }
  }

  function applyFilters() {
    const { q, category, chain, tier, watchlist } = state.filters;
    const term = q.trim().toLowerCase();
    const list = state.all.filter((r) => {
      if (watchlist && !r.watchlist) return false;
      if (category && r.category !== category) return false;
      if (chain && !r.chains.includes(chain)) return false;
      if (tier && r.tier !== tier) return false;
      if (term && !r.searchText.includes(term)) return false;
      return true;
    });
    const { key, dir } = state.sort;
    const mult = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      let d = 0;
      if (typeof av === 'string' && typeof bv === 'string') d = av.localeCompare(bv);
      else d = num(av, 0) - num(bv, 0);
      if (d !== 0) return d * mult;
      return a.rank - b.rank || a.slug.localeCompare(b.slug);
    });
    state.filtered = list;
  }

  function renderKpis() {
    const rows = state.filtered;
    const totalTvl = rows.reduce((s, r) => s + r.tvl, 0);
    const totalFdv = rows.reduce((s, r) => s + r.impliedFdv, 0);
    const totalDrop = rows.reduce((s, r) => s + r.airdropValue, 0);
    const watchCount = rows.filter((r) => r.watchlist).length;
    const setText = (sels, val) => {
      const el = pick(sels);
      if (el) el.textContent = val;
    };
    setText(['#stat-total', '#kpi-total', '#total-protocols', '[data-kpi="total"]'], String(rows.length));
    setText(['#stat-tvl', '#kpi-tvl', '#total-tvl', '[data-kpi="tvl"]'], fmtUsd(totalTvl));
    setText(['#stat-fdv', '#stat-implied', '#kpi-fdv', '#kpi-implied', '#total-implied', '[data-kpi="implied"]'], fmtUsd(totalFdv));
    setText(['#stat-airdrop', '#kpi-airdrop', '#total-airdrop', '[data-kpi="airdrop"]'], fmtUsd(totalDrop));
    setText(['#stat-watchlist', '#kpi-watchlist', '#watchlist-count', '[data-kpi="watchlist"]'], String(watchCount));
    setText(['#results-count', '#shown-count', '#filter-count', '#table-count'], `${rows.length} / ${state.all.length} protocols`);
  }

  function renderTable() {
    const tbody = pick(['#board-body', '#table-body', '#protocols-body', '#radar-tbody', 'table tbody']);
    if (!tbody) return;
    const cols = getTableColumns();
    if (!state.filtered.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols.length}">No protocols match the current filters.</td></tr>`;
      return;
    }
    tbody.innerHTML = state.filtered
      .map((r) => {
        const cls = ['board-row', r.watchlist ? 'is-watchlist' : '', state.selected === r.slug ? 'is-selected' : ''].filter(Boolean).join(' ');
        return `<tr class="${cls}" data-slug="${esc(r.slug)}" tabindex="0">${cols.map((c) => renderCell(c, r)).join('')}</tr>`;
      })
      .join('');
    document.querySelectorAll('table thead th[data-sort]').forEach((th) => {
      const active = th.dataset.sort === state.sort.key;
      th.classList.toggle('sort-asc', active && state.sort.dir === 'asc');
      th.classList.toggle('sort-desc', active && state.sort.dir === 'desc');
      th.setAttribute('aria-sort', active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function renderBarSvg(el, items, accent) {
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="chart-empty">No data</div>';
      return;
    }
    const max = Math.max(...items.map((i) => i.value), 1);
    const rowH = 26;
    const h = items.length * rowH + 12;
    const bars = items
      .map((item, i) => {
        const y = i * rowH + 6;
        const w = Math.max(4, Math.round((item.value / max) * 230));
        const label = item.label.length > 16 ? `${item.label.slice(0, 15)}…` : item.label;
        const clickAttr = item.slug ? ` data-open="${esc(item.slug)}" style="cursor:pointer"` : '';
        return `<g class="chart-bar"${clickAttr}><text x="0" y="${y + 14}" fill="currentColor" font-size="11" opacity="0.85">${esc(label)}</text><rect x="122" y="${y + 3}" width="${w}" height="15" rx="4" fill="${item.highlight ? '#f59e0b' : accent}" opacity="0.9"/><text x="${128 + w}" y="${y + 14}" fill="currentColor" font-size="11" opacity="0.8">${esc(item.text)}</text></g>`;
      })
      .join('');
    el.innerHTML = `<svg viewBox="0 0 430 ${h}" width="100%" height="${h}" role="img" aria-label="Distribution chart">${bars}</svg>`;
  }

  function renderCharts() {
    const byCat = new Map();
    const byChain = new Map();
    for (const r of state.filtered) {
      byCat.set(r.category, (byCat.get(r.category) || 0) + r.impliedFdv);
      byChain.set(r.primaryChain, (byChain.get(r.primaryChain) || 0) + r.impliedFdv);
    }
    const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => ({ label: k, value: v, text: fmtUsd(v) }));
    const topChains = [...byChain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => ({ label: k, value: v, text: fmtUsd(v) }));
    const topVal = state.filtered.slice(0, 8).map((r) => ({ label: r.name, value: r.impliedFdv, text: fmtUsd(r.impliedFdv), slug: r.slug, highlight: r.watchlist }));

    renderBarSvg(pick(['#category-chart', '#chart-categories', '#chart-category', '[data-chart="category"]']), topCats, '#38bdf8');
    renderBarSvg(pick(['#chain-chart', '#chart-chains', '#chart-chain', '[data-chart="chain"]']), topChains, '#818cf8');
    renderBarSvg(pick(['#valuation-chart', '#chart-valuation', '#chart-distribution', '#chart-top', '[data-chart="valuation"]']), topVal, '#34d399');
  }

  function buildDetailHtml(r) {
    const span = Math.max(r.fdvHigh - r.fdvLow, 1);
    const pct = Math.min(96, Math.max(4, Math.round(((r.impliedFdv - r.fdvLow) / span) * 100)));
    const stepsHtml = r.farm.steps
      .map((s, idx) => {
        const key = `${r.slug}:${idx}`;
        const done = Boolean(state.checkedSteps[key]);
        return `<li class="farm-step${done ? ' is-done' : ''}"><label class="step-check"><input type="checkbox" data-step-key="${esc(key)}"${done ? ' checked' : ''}/><span class="step-num">${idx + 1}</span><span class="step-body"><strong>${esc(s.title)}</strong><span class="step-tag">${esc(s.priority)}</span><p>${esc(s.detail)}</p></span></label></li>`;
      })
      .join('');
    const signalsHtml = r.signals.length ? `<div class="detail-chips">${r.signals.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}</div>` : '';
    const compsHtml = r.comps.length
      ? `<div class="detail-section"><h4>Comparable Launches</h4><div class="detail-chips">${r.comps.map((c) => `<span class="pill">${esc(typeof c === 'string' ? c : `${c.name || c.protocol || 'Comp'} ${c.multiple ? `${Number(c.multiple).toFixed(1)}x` : ''}`)}</span>`).join('')}</div></div>`
      : '';
    const risksHtml = r.farm.risks.length
      ? `<div class="detail-risks"><strong>Key Risks:</strong> ${r.farm.risks.map((x) => esc(typeof x === 'string' ? x : x.label || x.detail || '')).join(' · ')}</div>`
      : '';
    return `
      <div class="detail-header">
        <div>
          <div class="detail-badges">
            <span class="pill">${esc(r.category)}</span>
            <span class="badge tier-${esc(r.tier.toLowerCase())}">Tier ${esc(r.tier)} · ${r.score.toFixed(1)}</span>
            ${r.watchlist ? '<span class="badge badge-watch">Watchlist</span>' : ''}
          </div>
          <h2 class="detail-title">${esc(r.name)}</h2>
          <div class="detail-chains">${r.chains.map((c) => `<span class="chain-tag">${esc(c)}</span>`).join('')}</div>
        </div>
        <button type="button" class="detail-close-btn" data-action="close-detail" aria-label="Close detail">&times;</button>
      </div>
      <div class="detail-metrics">
        <div class="metric-card"><span>Current TVL</span><strong>${fmtUsd(r.tvl)}</strong><small>${r.change7d != null ? `7d ${fmtPct(r.change7d)}` : 'Snapshot'}</small></div>
        <div class="metric-card"><span>Implied FDV</span><strong>${fmtUsd(r.impliedFdv)}</strong><small>${r.multiple > 0 ? `${r.multiple.toFixed(2)}x TVL` : 'Model est.'}</small></div>
        <div class="metric-card"><span>Est. Airdrop Pool</span><strong>${fmtUsd(r.airdropValue)}</strong><small>${r.impliedFdv > 0 ? `${((r.airdropValue / r.impliedFdv) * 100).toFixed(1)}% supply` : ''}</small></div>
        <div class="metric-card"><span>Radar Rank</span><strong>#${r.rank}</strong><small>of ${state.all.length}</small></div>
      </div>
      <div class="detail-range">
        <div class="range-labels"><span>Bear ${fmtUsd(r.fdvLow)}</span><strong>Base ${fmtUsd(r.impliedFdv)}</strong><span>Bull ${fmtUsd(r.fdvHigh)}</span></div>
        <div class="range-track"><div class="range-marker" style="left:${pct}%"></div></div>
      </div>
      ${r.description ? `<p class="detail-desc">${esc(r.description)}</p>` : ''}
      ${r.methodology ? `<p class="detail-method"><strong>Valuation basis:</strong> ${esc(r.methodology)}</p>` : ''}
      ${signalsHtml}
      ${compsHtml}
      <div class="detail-section farm-section">
        <div class="farm-head">
          <h3>Farming Plan</h3>
          <div class="farm-meta"><span>Difficulty: <b>${esc(r.farm.difficulty)}</b></span><span>Risk: <b>${esc(r.farm.risk)}</b></span><span>Horizon: <b>${esc(r.farm.timeline)}</b></span>${r.farm.minCapital ? `<span>Min Capital: <b>${fmtUsd(r.farm.minCapital)}</b></span>` : ''}</div>
        </div>
        <p class="farm-summary">${esc(r.farm.summary)}</p>
        <ol class="farm-steps">${stepsHtml}</ol>
        ${risksHtml}
      </div>
      ${r.url ? `<div class="detail-links"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Official Site ↗</a></div>` : ''}
    `;
  }

  function ensureDetailPanel() {
    let panel = pick(['#detail-panel', '#detail-drawer', '#detail-modal', '#protocol-detail', '#detail-view', '[data-view="detail"]']);
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'detail-panel';
      panel.className = 'detail-drawer';
      panel.innerHTML = '<div id="detail-content"></div>';
      document.body.appendChild(panel);
    }
    return panel;
  }

  function openDetail(slug) {
    const r = state.all.find((x) => x.slug === slug);
    if (!r) return;
    state.selected = r.slug;
    const panel = ensureDetailPanel();
    const target = panel.querySelector('#detail-content, #detail-body, #protocol-detail-body, [data-detail-body]') || panel;
    target.innerHTML = buildDetailHtml(r);
    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('open', 'is-open', 'active', 'visible');
    const backdrop = pick(['#detail-backdrop', '#modal-backdrop', '.drawer-backdrop']);
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add('open', 'is-open', 'active', 'visible');
    }
    renderTable();
  }

  function closeDetail() {
    state.selected = null;
    const panel = pick(['#detail-panel', '#detail-drawer', '#detail-modal', '#protocol-detail', '#detail-view', '[data-view="detail"]']);
    if (panel) {
      panel.classList.remove('open', 'is-open', 'active', 'visible');
      panel.setAttribute('aria-hidden', 'true');
      if (panel.dataset.modal !== 'inline') panel.hidden = true;
    }
    const backdrop = pick(['#detail-backdrop', '#modal-backdrop', '.drawer-backdrop']);
    if (backdrop) {
      backdrop.classList.remove('open', 'is-open', 'active', 'visible');
      backdrop.hidden = true;
    }
    renderTable();
  }

  function populateSelects() {
    const fill = (sels, values, allLabel) => {
      const el = pick(sels);
      if (!el || el.tagName !== 'SELECT') return;
      const cur = el.value;
      el.innerHTML = `<option value="">${allLabel}</option>${values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
      if (values.includes(cur)) el.value = cur;
    };
    const cats = [...new Set(state.all.map((r) => r.category))].sort();
    const chains = [...new Set(state.all.flatMap((r) => r.chains))].sort();
    const tiers = [...new Set(state.all.map((r) => r.tier))].sort();
    fill(['#category-filter', '#filter-category', '#category-select', 'select[name="category"]', '[data-filter="category"]'], cats, 'All Categories');
    fill(['#chain-filter', '#filter-chain', '#chain-select', 'select[name="chain"]', '[data-filter="chain"]'], chains, 'All Chains');
    fill(['#tier-filter', '#filter-tier', '#confidence-filter', '[data-filter="tier"]'], tiers, 'All Tiers');
  }

  function syncControlsFromState() {
    const setVal = (sels, v) => { const el = pick(sels); if (el) el.value = v; };
    setVal(['#search-input', '#search', '#filter-search', 'input[type="search"]', '[data-filter="search"]'], state.filters.q);
    setVal(['#category-filter', '#filter-category', '#category-select', 'select[name="category"]', '[data-filter="category"]'], state.filters.category);
    setVal(['#chain-filter', '#filter-chain', '#chain-select', 'select[name="chain"]', '[data-filter="chain"]'], state.filters.chain);
    setVal(['#tier-filter', '#filter-tier', '#confidence-filter', '[data-filter="tier"]'], state.filters.tier);
    const wl = pick(['#watchlist-only', '#filter-watchlist', '#watchlist-toggle', '#watchlist-filter', '[data-filter="watchlist"]']);
    if (wl) {
      if (wl.type === 'checkbox') wl.checked = state.filters.watchlist;
      else wl.classList.toggle('active', state.filters.watchlist);
    }
  }

  function readUrlState() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('q')) state.filters.q = p.get('q');
    if (p.get('category')) state.filters.category = p.get('category');
    if (p.get('chain')) state.filters.chain = p.get('chain');
    if (p.get('tier')) state.filters.tier = p.get('tier');
    if (p.get('watchlist') === '1' || p.get('watchlist') === 'true') state.filters.watchlist = true;
    if (p.get('sort')) state.sort.key = p.get('sort');
    if (p.get('dir') === 'asc' || p.get('dir') === 'desc') state.sort.dir = p.get('dir');
    const hashSlug = window.location.hash.startsWith('#protocol/') ? window.location.hash.slice(10) : '';
    return p.get('protocol') || p.get('detail') || hashSlug || '';
  }

  function refresh() {
    applyFilters();
    renderKpis();
    renderTable();
    renderCharts();
  }

  function bindEvents() {
    const search = pick(['#search-input', '#search', '#filter-search', 'input[type="search"]', '[data-filter="search"]']);
    if (search) search.addEventListener('input', (e) => { state.filters.q = e.target.value; refresh(); });

    const bindSel = (sels, key) => {
      const el = pick(sels);
      if (el) el.addEventListener('change', (e) => { state.filters[key] = e.target.value; refresh(); });
    };
    bindSel(['#category-filter', '#filter-category', '#category-select', 'select[name="category"]', '[data-filter="category"]'], 'category');
    bindSel(['#chain-filter', '#filter-chain', '#chain-select', 'select[name="chain"]', '[data-filter="chain"]'], 'chain');
    bindSel(['#tier-filter', '#filter-tier', '#confidence-filter', '[data-filter="tier"]'], 'tier');

    const sortSel = pick(['#sort-select', '#sort-by', '#filter-sort', 'select[name="sort"]', '[data-filter="sort"]']);
    if (sortSel) {
      sortSel.addEventListener('change', (e) => {
        const [k, d] = String(e.target.value).split(':');
        state.sort.key = k || 'impliedFdv';
        state.sort.dir = d || (k === 'rank' || k === 'name' ? 'asc' : 'desc');
        refresh();
      });
    }

    const wl = pick(['#watchlist-only', '#filter-watchlist', '#watchlist-toggle', '#watchlist-filter', '[data-filter="watchlist"]']);
    if (wl) {
      wl.addEventListener(wl.type === 'checkbox' ? 'change' : 'click', () => {
        state.filters.watchlist = wl.type === 'checkbox' ? wl.checked : !state.filters.watchlist;
        wl.classList.toggle('active', state.filters.watchlist);
        wl.setAttribute('aria-pressed', String(state.filters.watchlist));
        refresh();
      });
    }

    const reset = pick(['#reset-filters', '#clear-filters', '#btn-reset', '[data-action="reset"]']);
    if (reset) {
      reset.addEventListener('click', () => {
        state.filters = { q: '', category: '', chain: '', tier: '', watchlist: false };
        syncControlsFromState();
        refresh();
      });
    }

    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-action="close-detail"], #detail-close, #close-detail, .modal-close, .drawer-close, #detail-backdrop, #modal-backdrop');
      if (closeBtn) { closeDetail(); return; }

      const openEl = e.target.closest('[data-open]');
      if (openEl) { openDetail(openEl.dataset.open); return; }

      const row = e.target.closest('tr[data-slug]');
      if (row) { openDetail(row.dataset.slug); return; }

      const th = e.target.closest('th[data-sort]');
      if (th) {
        const key = th.dataset.sort;
        state.sort.dir = state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc';
        state.sort.key = key;
        refresh();
      }
    });

    document.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-step-key]');
      if (!cb) return;
      state.checkedSteps[cb.dataset.stepKey] = cb.checked;
      cb.closest('.farm-step')?.classList.toggle('is-done', cb.checked);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        const inp = pick(['#search-input', '#search', '#filter-search', 'input[type="search"]']);
        if (inp) { e.preventDefault(); inp.focus(); }
      }
      if (e.key === 'Enter' && document.activeElement?.matches('tr[data-slug]')) {
        openDetail(document.activeElement.dataset.slug);
      }
    });
  }

  async function init() {
    const payload = await loadBoardData();
    const { rows, meta } = extractRows(payload);
    state.meta = meta;
    state.all = rows.map(normalizeRow);
    populateSelects();
    const initialProtocol = readUrlState();
    syncControlsFromState();
    bindEvents();
    refresh();
    if (initialProtocol) openDetail(initialProtocol);
  }

  window.TokenRadarApp = {
    openDetail,
    closeDetail,
    setFilter(patch) { Object.assign(state.filters, patch); syncControlsFromState(); refresh(); },
    getState: () => ({ ...state, filters: { ...state.filters }, sort: { ...state.sort } }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();