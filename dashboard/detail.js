(function (global) {
  "use strict";

  const STORAGE_PREFIX = "token-radar:farm-progress:";
  const CHAIN_COLORS = [
    "#38bdf8", "#818cf8", "#34d399", "#fbbf24",
    "#f472b6", "#fb923c", "#a78bfa", "#94a3b8"
  ];

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback !== undefined ? fallback : null);
  }

  function fmtUsd(v) {
    const n = num(v);
    if (n === null) return "—";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1e12) return sign + "$" + (abs / 1e12).toFixed(2) + "T";
    if (abs >= 1e9) return sign + "$" + (abs / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return sign + "$" + (abs / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return sign + "$" + (abs / 1e3).toFixed(1) + "K";
    return sign + "$" + Math.round(abs).toLocaleString("en-US");
  }

  function fmtPct(v, isRatio) {
    const n = num(v);
    if (n === null) return "—";
    const pct = isRatio ? n * 100 : n;
    return pct.toFixed(pct >= 10 || pct <= -10 ? 1 : 2) + "%";
  }

  function fmtDelta(v) {
    const n = num(v);
    if (n === null) return '<span class="delta neutral">—</span>';
    const cls = n > 0.05 ? "positive" : n < -0.05 ? "negative" : "neutral";
    const sign = n > 0 ? "+" : "";
    return '<span class="delta ' + cls + '">' + sign + n.toFixed(1) + "%</span>";
  }

  function fmtMult(v) {
    const n = num(v);
    return n === null ? "—" : n.toFixed(2) + "x";
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/[\s-]+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function hashHue(str) {
    let h = 2166136261;
    const s = String(str || "radar");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 360;
  }

  function loadChecked(key) {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_PREFIX + key);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveChecked(key, set) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(Array.from(set)));
      }
    } catch (_) {}
  }

  function normalizeChains(p) {
    const totalTvl = num(p.tvl ?? p.tvlUsd, 0) || 0;
    let items = [];
    if (Array.isArray(p.chainMix) && p.chainMix.length) {
      items = p.chainMix.map((c) => ({
        chain: c.chain || c.name || "Unknown",
        tvl: num(c.tvl ?? c.tvlUsd, 0) || 0,
        share: num(c.share ?? c.pct, null)
      }));
    } else if (p.chainTvls && typeof p.chainTvls === "object") {
      items = Object.entries(p.chainTvls)
        .filter(([k, v]) => !/-(borrowed|staking|pool2|vesting|offers)$/i.test(k) && k !== "borrowed" && k !== "staking" && num(v, 0) > 0)
        .map(([chain, tvl]) => ({ chain, tvl: num(tvl, 0) || 0, share: null }));
    } else if (Array.isArray(p.chains) && p.chains.length) {
      const equal = totalTvl > 0 ? totalTvl / p.chains.length : 0;
      items = p.chains.map((chain) => ({ chain: String(chain), tvl: equal, share: 100 / p.chains.length }));
    }
    items.sort((a, b) => b.tvl - a.tvl);
    const sum = items.reduce((acc, x) => acc + x.tvl, 0) || totalTvl || 1;
    items = items.map((x) => ({
      chain: x.chain,
      tvl: x.tvl,
      share: x.share !== null ? (x.share <= 1 ? x.share * 100 : x.share) : (x.tvl / sum) * 100
    }));
    if (items.length > 6) {
      const head = items.slice(0, 5);
      const tail = items.slice(5);
      head.push({
        chain: "Other (" + tail.length + ")",
        tvl: tail.reduce((a, x) => a + x.tvl, 0),
        share: tail.reduce((a, x) => a + x.share, 0)
      });
      return head;
    }
    return items;
  }

  function normalizeDrivers(p, val) {
    const raw = p.fdvDrivers || (val && val.drivers) || p.valuationDrivers || p.drivers;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((d) => {
        const weight = num(d.weight ?? d.share ?? d.score ?? d.impactPct, null);
        const mult = num(d.multiplier ?? d.factor, null);
        const valueUsd = num(d.contributionUsd ?? d.valueUsd ?? d.contribution, null);
        return {
          label: d.label || d.name || d.factorName || "Driver",
          detail: d.detail || d.note || d.description || d.reason || "",
          valueText: d.display || (valueUsd !== null ? fmtUsd(valueUsd) : mult !== null ? fmtMult(mult) : weight !== null ? fmtPct(weight, weight <= 1 && weight >= -1) : "Active"),
          barPct: Math.max(8, Math.min(100, Math.abs(weight !== null ? (weight <= 1 ? weight * 100 : weight) : mult !== null ? mult * 45 : 50))),
          tone: d.direction === "negative" || (mult !== null && mult < 1) || (weight !== null && weight < 0) ? "negative" : d.direction === "neutral" ? "neutral" : "positive"
        };
      });
    }
    const tvl = num(p.tvl ?? p.tvlUsd, 0) || 0;
    const baseFdv = num(val.base, 0) || 0;
    const mult = tvl > 0 && baseFdv > 0 ? baseFdv / tvl : num(val.tvlMultiple, 1.5);
    const ch7 = num(p.tvlChange7d ?? p.change_7d, 0) || 0;
    const chains = Array.isArray(p.chains) ? p.chains.length : 1;
    const raised = num(p.totalRaised ?? p.fundingUsd, 0) || 0;
    const derived = [
      { label: "TVL Base Scale", detail: fmtUsd(tvl) + " locked across protocol vaults", valueText: fmtUsd(tvl), barPct: Math.min(100, Math.max(18, Math.log10(Math.max(tvl, 1e4)) * 10)), tone: "positive" },
      { label: "Category FDV/TVL Multiple", detail: (p.category || "DeFi") + " peer valuation benchmark", valueText: fmtMult(mult), barPct: Math.min(100, Math.max(15, (mult || 1) * 28)), tone: mult >= 1 ? "positive" : "neutral" },
      { label: "7D TVL Momentum", detail: "Short-term capital inflow velocity", valueText: (ch7 >= 0 ? "+" : "") + ch7.toFixed(1) + "%", barPct: Math.min(100, Math.max(12, Math.abs(ch7) * 2.5)), tone: ch7 >= 0 ? "positive" : "negative" },
      { label: "Multi-Chain Footprint", detail: chains + (chains === 1 ? " chain deployed" : " chains deployed"), valueText: chains + " chains", barPct: Math.min(100, Math.max(15, chains * 14)), tone: chains > 1 ? "positive" : "neutral" }
    ];
    if (raised > 0) {
      derived.push({ label: "Venture Backing", detail: "Disclosed private fundraising floor", valueText: fmtUsd(raised), barPct: Math.min(100, Math.max(20, Math.log10(raised) * 11)), tone: "positive" });
    }
    return derived;
  }

  function normalizeRisks(p) {
    const raw = p.riskFlags || p.risks || p.flags || p.warnings || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => {
      if (typeof r === "string") {
        const low = /low|minor|info/i.test(r);
        const high = /high|critical|hack|exploit|unverified|wrapped|low tvl/i.test(r);
        return { severity: high ? "high" : low ? "low" : "medium", title: r, detail: "" };
      }
      const sev = String(r.severity || r.level || "medium").toLowerCase();
      return {
        severity: sev === "critical" || sev === "high" ? "high" : sev === "low" || sev === "info" ? "low" : "medium",
        title: r.title || r.label || r.code || r.name || "Risk Notice",
        detail: r.detail || r.description || r.message || ""
      };
    });
  }

  function normalizeFarm(p) {
    const fp = p.farmPlan || p.farmingPlan || p.farming || p.playbook || {};
    const rawSteps = Array.isArray(fp.steps) ? fp.steps : Array.isArray(p.farmSteps) ? p.farmSteps : Array.isArray(p.steps) ? p.steps : [];
    const steps = rawSteps.map((s, idx) => {
      if (typeof s === "string") {
        return { id: "step-" + (idx + 1), order: idx + 1, title: s, detail: "", chain: "", capital: "", effort: "", priority: "" };
      }
      return {
        id: s.id || "step-" + (idx + 1),
        order: num(s.order ?? s.step, idx + 1),
        title: s.title || s.action || s.name || ("Step " + (idx + 1)),
        detail: s.detail || s.description || s.instructions || s.rationale || "",
        chain: s.chain || s.network || "",
        capital: s.capital || s.minCapital || (s.minCapitalUsd ? fmtUsd(s.minCapitalUsd) : "") || s.cost || "",
        effort: s.effort || s.cadence || s.frequency || "",
        priority: s.priority || s.impact || "",
        tip: s.tip || s.note || ""
      };
    });
    return {
      summary: fp.summary || fp.strategy || fp.overview || "",
      difficulty: fp.difficulty || fp.complexity || "Medium",
      capital: fp.capitalRequired || (fp.minCapitalUsd ? fmtUsd(fp.minCapitalUsd) : null) || fp.recommendedCapital || "Flexible",
      cadence: fp.cadence || fp.timeHorizon || fp.frequency || "Weekly check-in",
      points: fp.pointsProgram || (p.hasPoints ? "Active Points Program" : null),
      gasCost: fp.estimatedCostUsd ? fmtUsd(fp.estimatedCostUsd) : (fp.gasEstimate || null),
      estYield: fp.estimatedRoi || fp.estAirdropYield || fp.yieldEstimate || null,
      tips: Array.isArray(fp.tips) ? fp.tips : Array.isArray(fp.notes) ? fp.notes : [],
      steps
    };
  }

  function normalizeProtocol(p) {
    const valObj = p.valuation && typeof p.valuation === "object" ? p.valuation : {};
    const base = num(p.impliedFdv ?? p.impliedValue ?? p.estimatedFdv ?? p.fdvBase ?? valObj.impliedFdv ?? valObj.base ?? p.fdv, 0) || 0;
    const low = num(p.fdvLow ?? p.fdvBear ?? valObj.low ?? valObj.bear ?? (p.fdvRange && p.fdvRange.low), base * 0.6);
    const high = num(p.fdvHigh ?? p.fdvBull ?? valObj.high ?? valObj.bull ?? (p.fdvRange && p.fdvRange.high), base * 1.65);
    const airdropPct = num(p.airdropPct ?? valObj.airdropPct ?? (p.farmPlan && p.farmPlan.expectedAirdropPct), 0.08);
    const airdropRatio = airdropPct > 1 ? airdropPct / 100 : airdropPct;
    const val = {
      bear: low,
      base,
      bull: high,
      airdropRatio,
      tvlMultiple: num(p.fdvTvlMultiple ?? valObj.tvlMultiple ?? (p.tvl > 0 ? base / p.tvl : null), null),
      methodology: valObj.methodology || p.valuationNote || ""
    };
    return {
      raw: p,
      id: String(p.slug || p.id || p.name || "protocol"),
      name: p.name || p.slug || "Unknown Protocol",
      rank: num(p.rank, null),
      category: p.category || "DeFi",
      subCategory: p.subCategory || p.subcategory || "",
      watchlist: Boolean(p.watchlist || p.inWatchlist || p.isWatchlist),
      tier: p.tier || p.grade || "",
      score: num(p.score ?? p.radarScore ?? p.launchScore ?? valObj.score, null),
      confidence: p.tokenlessConfidence || p.confidence || valObj.confidence || "High",
      tokenStatus: p.tokenStatus || p.tokenlessReason || "Confirmed tokenless (non-wrapped)",
      description: p.description || p.summary || p.thesis || "",
      tvl: num(p.tvl ?? p.tvlUsd, 0) || 0,
      ch1d: num(p.tvlChange1d ?? p.change_1d, null),
      ch7d: num(p.tvlChange7d ?? p.change_7d, null),
      ch30d: num(p.tvlChange30d ?? p.change_30d, null),
      fees30d: num(p.fees30d ?? p.revenue30d, null),
      raised: num(p.totalRaised ?? p.fundingUsd, null),
      riskLevel: String(p.riskLevel || (normalizeRisks(p).some((r) => r.severity === "high") ? "High" : normalizeRisks(p).length ? "Medium" : "Low")),
      url: p.url || "",
      twitter: p.twitter || "",
      val,
      chains: normalizeChains(p),
      drivers: normalizeDrivers(p, val),
      risks: normalizeRisks(p),
      farm: normalizeFarm(p)
    };
  }

  function buildCopyText(p, scenario) {
    const fdv = p.val[scenario] || p.val.base;
    const lines = [
      p.name + " (" + p.category + ") — Token Launch Radar",
      "Implied FDV (" + scenario.toUpperCase() + "): " + fmtUsd(fdv) + " | TVL: " + fmtUsd(p.tvl) + " | Est. Airdrop Pool: " + fmtUsd(fdv * p.val.airdropRatio),
      "Chains: " + p.chains.map((c) => c.chain + " (" + c.share.toFixed(0) + "%)").join(", "),
      "",
      "Farming Playbook (" + p.farm.difficulty + " | Capital: " + p.farm.capital + " | Cadence: " + p.farm.cadence + "):"
    ];
    p.farm.steps.forEach((s, i) => {
      lines.push((i + 1) + ". " + s.title + (s.detail ? " — " + s.detail : ""));
    });
    if (p.risks.length) {
      lines.push("", "Risk Flags: " + p.risks.map((r) => "[" + r.severity.toUpperCase() + "] " + r.title).join("; "));
    }
    return lines.join("\n");
  }

  function renderHtml(p, state, opts) {
    const scenario = state.scenario || "base";
    const activeFdv = p.val[scenario] || p.val.base;
    const airdropPool = activeFdv * p.val.airdropRatio;
    const mult = p.tvl > 0 ? activeFdv / p.tvl : p.val.tvlMultiple;
    const hue = hashHue(p.name);
    const checked = state.checked;
    const doneCount = p.farm.steps.filter((s) => checked.has(s.id)).length;
    const totalSteps = p.farm.steps.length;
    const progPct = totalSteps ? Math.round((doneCount / totalSteps) * 100) : 0;

    const badges = [
      p.rank ? '<span class="badge badge-rank">#' + esc(p.rank) + "</span>" : "",
      '<span class="badge badge-cat">' + esc(p.category) + (p.subCategory ? " · " + esc(p.subCategory) : "") + "</span>",
      p.watchlist ? '<span class="badge badge-watchlist">Watchlist</span>' : "",
      p.tier ? '<span class="badge badge-tier">Tier ' + esc(p.tier) + "</span>" : "",
      p.farm.points ? '<span class="badge badge-points">' + esc(p.farm.points) + "</span>" : ""
    ].filter(Boolean).join("");

    const navHtml = (opts && opts.showNav !== false)
      ? '<div class="detail-nav-actions">' +
          '<button type="button" class="detail-btn icon-btn" data-action="prev" title="Previous protocol" aria-label="Previous protocol">&#8592;</button>' +
          '<button type="button" class="detail-btn icon-btn" data-action="next" title="Next protocol" aria-label="Next protocol">&#8594;</button>' +
          '<button type="button" class="detail-btn icon-btn" data-action="close" title="Close detail" aria-label="Close detail">&times;</button>' +
        "</div>"
      : "";

    const scenariosHtml = ["bear", "base", "bull"].map((sc) => {
      const label = sc === "bear" ? "Bear" : sc === "bull" ? "Bull" : "Base";
      const active = sc === scenario ? " active" : "";
      return '<button type="button" class="scenario-pill' + active + '" data-action="scenario" data-scenario="' + sc + '">' +
        label + " <span>" + esc(fmtUsd(p.val[sc])) + "</span></button>";
    }).join("");

    const driversHtml = p.drivers.map((d) =>
      '<div class="driver-item tone-' + esc(d.tone) + '">' +
        '<div class="driver-row"><span class="driver-label">' + esc(d.label) + '</span><span class="driver-val">' + esc(d.valueText) + "</span></div>" +
        '<div class="driver-track"><div class="driver-fill tone-' + esc(d.tone) + '" style="width:' + d.barPct.toFixed(1) + '%"></div></div>' +
        (d.detail ? '<div class="driver-detail">' + esc(d.detail) + "</div>" : "") +
      "</div>"
    ).join("");

    const chainBarHtml = p.chains.map((c, idx) =>
      '<span class="chain-seg" style="width:' + Math.max(c.share, 2).toFixed(2) + "%;background:" + CHAIN_COLORS[idx % CHAIN_COLORS.length] + '" title="' + esc(c.chain + ": " + fmtUsd(c.tvl) + " (" + c.share.toFixed(1) + "%)") + '"></span>'
    ).join("");

    const chainListHtml = p.chains.length
      ? p.chains.map((c, idx) =>
          '<div class="chain-row">' +
            '<span class="chain-name"><i class="chain-dot" style="background:' + CHAIN_COLORS[idx % CHAIN_COLORS.length] + '"></i>' + esc(c.chain) + "</span>" +
            '<span class="chain-tvl">' + esc(fmtUsd(c.tvl)) + "</span>" +
            '<span class="chain-share">' + esc(c.share.toFixed(1)) + "%</span>" +
          "</div>"
        ).join("")
      : '<div class="empty-note">Single-chain or undisclosed chain breakdown.</div>';

    const risksHtml = p.risks.length
      ? p.risks.map((r) =>
          '<div class="risk-flag severity-' + esc(r.severity) + '">' +
            '<span class="risk-sev">' + esc(r.severity.toUpperCase()) + "</span>" +
            '<div class="risk-body"><div class="risk-title">' + esc(r.title) + "</div>" +
            (r.detail ? '<div class="risk-detail">' + esc(r.detail) + "</div>" : "") +
            "</div></div>"
        ).join("")
      : '<div class="risk-flag severity-low"><span class="risk-sev">CLEAR</span><div class="risk-body"><div class="risk-title">No elevated risk flags detected</div><div class="risk-detail">Passed tokenless, non-wrapped, and liquidity hygiene checks.</div></div></div>';

    const stepsHtml = p.farm.steps.length
      ? p.farm.steps.map((s) => {
          const isDone = checked.has(s.id);
          const meta = [
            s.chain ? '<span class="step-chip">' + esc(s.chain) + "</span>" : "",
            s.capital ? '<span class="step-chip">Capital: ' + esc(s.capital) + "</span>" : "",
            s.effort ? '<span class="step-chip">' + esc(s.effort) + "</span>" : "",
            s.priority ? '<span class="step-chip priority">' + esc(s.priority) + "</span>" : ""
          ].filter(Boolean).join("");
          return '<label class="farm-step' + (isDone ? " is-done" : "") + '" data-step-id="' + esc(s.id) + '">' +
            '<input type="checkbox" class="farm-check" data-action="toggle-step" data-step-id="' + esc(s.id) + '"' + (isDone ? " checked" : "") + " />" +
            '<span class="step-num">' + esc(s.order) + "</span>" +
            '<div class="step-body">' +
              '<div class="step-title">' + esc(s.title) + "</div>" +
              (s.detail ? '<div class="step-detail">' + esc(s.detail) + "</div>" : "") +
              (meta ? '<div class="step-meta">' + meta + "</div>" : "") +
              (s.tip ? '<div class="step-tip">Tip: ' + esc(s.tip) + "</div>" : "") +
            "</div></label>";
        }).join("")
      : '<div class="empty-note">Monitor protocol announcements and maintain on-chain activity on primary vaults.</div>';

    const tipsHtml = p.farm.tips.length
      ? '<ul class="farm-tips">' + p.farm.tips.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>"
      : "";

    return (
      '<article class="detail-view" data-protocol-id="' + esc(p.id) + '">' +
        '<header class="detail-header">' +
          '<div class="detail-title-group">' +
            '<div class="protocol-avatar" style="background:hsl(' + hue + ',58%,32%);border-color:hsl(' + hue + ',70%,55%)">' + esc(initials(p.name)) + "</div>" +
            '<div class="detail-heading">' +
              '<div class="detail-badges">' + badges + "</div>" +
              '<h2 class="detail-name">' + esc(p.name) + "</h2>" +
              (p.description ? '<p class="detail-desc">' + esc(p.description) + "</p>" : "") +
            "</div>" +
          "</div>" +
          navHtml +
        "</header>" +

        '<section class="detail-section valuation-section">' +
          '<div class="section-head"><h3>Implied Launch Valuation &amp; FDV Drivers</h3><div class="scenario-switch" role="group" aria-label="Valuation scenario">' + scenariosHtml + "</div></div>" +
          '<div class="detail-kpi-grid">' +
            '<div class="kpi-card highlight"><span class="kpi-label">Implied FDV (' + esc(scenario) + ')</span><strong class="kpi-val">' + esc(fmtUsd(activeFdv)) + "</strong></div>" +
            '<div class="kpi-card"><span class="kpi-label">Est. Airdrop Pool (' + esc((p.val.airdropRatio * 100).toFixed(0)) + '%)</span><strong class="kpi-val">' + esc(fmtUsd(airdropPool)) + "</strong></div>" +
            '<div class="kpi-card"><span class="kpi-label">Total Value Locked</span><strong class="kpi-val">' + esc(fmtUsd(p.tvl)) + '</strong><span class="kpi-sub">7D ' + fmtDelta(p.ch7d) + "</span></div>" +
            '<div class="kpi-card"><span class="kpi-label">FDV / TVL Multiple</span><strong class="kpi-val">' + esc(fmtMult(mult)) + "</strong>" + (p.score !== null ? '<span class="kpi-sub">Radar Score ' + esc(p.score.toFixed(1)) + "</span>" : "") + "</div>" +
          "</div>" +
          (p.val.methodology ? '<p class="valuation-note">' + esc(p.val.methodology) + "</p>" : "") +
          '<div class="drivers-list">' + driversHtml + "</div>" +
        "</section>" +

        '<div class="detail-two-col">' +
          '<section class="detail-section chain-section">' +
            '<div class="section-head"><h3>Chain Mix</h3><span class="section-meta">' + esc(p.chains.length) + " active</span></div>" +
            '<div class="chain-bar">' + chainBarHtml + "</div>" +
            '<div class="chain-list">' + chainListHtml + "</div>" +
          "</section>" +

          '<section class="detail-section risk-section">' +
            '<div class="section-head"><h3>Tokenless Verification &amp; Risk Flags</h3><span class="risk-pill level-' + esc(p.riskLevel.toLowerCase()) + '">' + esc(p.riskLevel) + " Risk</span></div>" +
            '<div class="token-verify-box"><span class="verify-label">Status:</span> <strong>' + esc(p.tokenStatus) + '</strong> <span class="verify-conf">(' + esc(p.confidence) + " confidence)</span></div>" +
            '<div class="risk-list">' + risksHtml + "</div>" +
          "</section>" +
        "</div>" +

        '<section class="detail-section farm-section">' +
          '<div class="section-head">' +
            '<div><h3>Step-by-Step Farming Playbook</h3>' + (p.farm.summary ? '<p class="farm-summary">' + esc(p.farm.summary) + "</p>" : "") + "</div>" +
            '<button type="button" class="detail-btn copy-btn" data-action="copy-plan">Copy Plan</button>' +
          "</div>" +
          '<div class="farm-meta-strip">' +
            '<div class="meta-pill"><span>Difficulty</span><strong>' + esc(p.farm.difficulty) + "</strong></div>" +
            '<div class="meta-pill"><span>Capital</span><strong>' + esc(p.farm.capital) + "</strong></div>" +
            '<div class="meta-pill"><span>Cadence</span><strong>' + esc(p.farm.cadence) + "</strong></div>" +
            (p.farm.gasCost ? '<div class="meta-pill"><span>Est. Gas</span><strong>' + esc(p.farm.gasCost) + "</strong></div>" : "") +
            (p.farm.estYield ? '<div class="meta-pill"><span>Est. Upside</span><strong>' + esc(p.farm.estYield) + "</strong></div>" : "") +
            '<div class="meta-pill"><span>Progress</span><strong>' + doneCount + "/" + totalSteps + " (" + progPct + "%)</strong></div>" +
          "</div>" +
          '<div class="farm-progress-track"><div class="farm-progress-fill" style="width:' + progPct + '%"></div></div>' +
          '<div class="farm-steps">' + stepsHtml + "</div>" +
          tipsHtml +
        "</section>" +
      "</article>"
    );
  }

  function resolveContainer(target) {
    if (typeof target === "string") return document.querySelector(target);
    if (target && target.nodeType === 1) return target;
    return document.getElementById("detail-panel") ||
      document.getElementById("protocol-detail") ||
      document.querySelector("[data-detail-panel]");
  }

  function copyToClipboard(text, btn) {
    const done = () => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    done();
  }

  const containerStates = new WeakMap();

  function bindEvents(container) {
    if (container.__detailBound) return;
    container.__detailBound = true;

    container.addEventListener("click", function (ev) {
      const st = containerStates.get(container);
      if (!st) return;
      const target = ev.target.closest("[data-action]");
      if (!target) return;
      const action = target.getAttribute("data-action");
      if (action === "scenario") {
        st.scenario = target.getAttribute("data-scenario") || "base";
        container.innerHTML = renderHtml(st.protocol, st, st.opts);
      } else if (action === "copy-plan") {
        copyToClipboard(buildCopyText(st.protocol, st.scenario), target);
      } else if (action === "close") {
        if (st.opts && typeof st.opts.onClose === "function") st.opts.onClose(st.protocol.raw);
        container.dispatchEvent(new CustomEvent("detail:close", { bubbles: true, detail: st.protocol.raw }));
      } else if (action === "prev" || action === "next") {
        const dir = action === "prev" ? -1 : 1;
        if (st.opts && typeof st.opts.onNavigate === "function") st.opts.onNavigate(dir, st.protocol.raw);
        container.dispatchEvent(new CustomEvent("detail:navigate", { bubbles: true, detail: { dir, protocol: st.protocol.raw } }));
      }
    });

    container.addEventListener("change", function (ev) {
      const st = containerStates.get(container);
      if (!st) return;
      const input = ev.target.closest('[data-action="toggle-step"]');
      if (!input) return;
      const stepId = input.getAttribute("data-step-id");
      if (!stepId) return;
      if (input.checked) st.checked.add(stepId);
      else st.checked.delete(stepId);
      saveChecked(st.protocol.id, st.checked);
      container.innerHTML = renderHtml(st.protocol, st, st.opts);
    });
  }

  function renderEmpty(target, summary) {
    const container = resolveContainer(target);
    if (!container) return;
    const count = summary && summary.count ? summary.count : null;
    container.innerHTML =
      '<div class="detail-empty">' +
        '<div class="detail-empty-icon">&#9678;</div>' +
        "<h3>Select a Protocol to Inspect</h3>" +
        "<p>Click any row on the Launch Radar board to examine implied FDV drivers, chain distribution, tokenless verification flags, and step-by-step farming guidance" +
        (count ? " across " + esc(count) + " tracked protocols." : ".") + "</p>" +
      "</div>";
  }

  function renderProtocolDetail(a, b, c) {
    let container, rawProtocol, opts;
    if (typeof a === "string" || (a && a.nodeType === 1)) {
      container = resolveContainer(a);
      rawProtocol = b;
      opts = c || {};
    } else {
      rawProtocol = a;
      container = resolveContainer(b);
      opts = c || {};
    }
    if (!container) return null;
    if (!rawProtocol) {
      renderEmpty(container, opts && opts.summary);
      return null;
    }
    const protocol = normalizeProtocol(rawProtocol);
    const state = {
      protocol,
      scenario: (opts && opts.scenario) || "base",
      checked: loadChecked(protocol.id),
      opts
    };
    containerStates.set(container, state);
    bindEvents(container);
    container.innerHTML = renderHtml(protocol, state, opts);
    container.scrollTop = 0;
    return protocol;
  }

  const api = {
    render: renderProtocolDetail,
    renderEmpty,
    normalizeProtocol,
    buildCopyText,
    fmtUsd,
    fmtPct,
    fmtMult
  };

  global.TokenRadarDetail = api;
  global.DetailPanel = api;
  global.renderProtocolDetail = renderProtocolDetail;
})(typeof window !== "undefined" ? window : globalThis);