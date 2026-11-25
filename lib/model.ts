import { existsSync, readFileSync } from "node:fs";
import * as filtersMod from "./filters.ts";
import * as valuationMod from "./valuation.ts";
import * as farmingMod from "./farming.ts";

export interface RawProtocol {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  address: string;
  geckoId: string;
  cmcId: string;
  category: string;
  chain: string;
  chains: string[];
  tvl: number;
  mcap: number;
  fdv: number;
  change1d: number | null;
  change7d: number | null;
  fees24h: number;
  fees30d: number;
  revenue30d: number;
  volume24h: number;
  totalRaised: number;
  parentProtocol: string;
  url: string;
  twitter: string;
  description: string;
  audits: number;
  listedAt: number;
  raw: Record<string, unknown>;
}

export interface ParsedSnapshot {
  asOf: string;
  protocols: RawProtocol[];
  watchlist: string[];
  meta: Record<string, unknown>;
}

export interface PeerComp {
  slug: string;
  name: string;
  tvl: number;
  mcap: number;
  multiple: number;
}

export interface FarmStep {
  step: number;
  title: string;
  action: string;
  detail: string;
  chain: string;
}

export interface FarmPlan {
  summary: string;
  difficulty: "Low" | "Medium" | "High";
  capitalTier: string;
  riskLevel: "Low" | "Medium" | "High";
  estimatedEffort: string;
  sybilNotes: string;
  steps: FarmStep[];
}

export interface RadarRow {
  rank: number;
  id: string;
  slug: string;
  name: string;
  category: string;
  chain: string;
  chains: string[];
  tvl: number;
  change1d: number | null;
  change7d: number | null;
  fees24h: number;
  fees30d: number;
  revenue30d: number;
  volume24h: number;
  totalRaised: number;
  url: string;
  twitter: string;
  description: string;
  watchlisted: boolean;
  impliedValue: number;
  impliedFdv: number;
  impliedMcap: number;
  lowFdv: number;
  highFdv: number;
  airdropPoolUsd: number;
  peerMultiple: number;
  peerCount: number;
  confidence: "High" | "Medium" | "Low";
  score: number;
  tier: "S" | "A" | "B" | "C";
  valuationMethod: string;
  signals: string[];
  comps: PeerComp[];
  farmPlan: FarmPlan;
}

export interface RadarResult {
  asOf: string;
  rows: RadarRow[];
  summary: {
    totalProtocols: number;
    excludedWithToken: number;
    excludedDerivative: number;
    candidateCount: number;
    rowCount: number;
    watchlistTotal: number;
    watchlistCovered: number;
    totalImpliedFdv: number;
    medianImpliedFdv: number;
    categoriesCount: number;
    chainsCount: number;
  };
  watchlist: { total: number; covered: number; missing: string[]; slugs: string[] };
  categories: Array<{ category: string; count: number; totalTvl: number; totalImpliedFdv: number; medianMultiple: number }>;
  chains: Array<{ chain: string; count: number; totalTvl: number }>;
  exclusions: Array<{ slug: string; name: string; reason: string; tvl: number }>;
}

export interface BoardIssue extends RadarResult {
  schema: string;
  title: string;
  generatedAt: string;
}

const DEFAULT_AS_OF = "2025-01-01T00:00:00.000Z";
const EMPTY_TOKENS = new Set(["", "-", "--", "none", "null", "n/a", "na", "tbd", "tba", "unknown"]);
const EXCLUDED_CATS = new Set(["cex", "chain", "bridged tokens", "bridge assets", "wrapped tokens", "canonical bridge"]);
const WRAP_RE = /^(wrapped|staked|liquid staked|bridged)\s+[a-z0-9]{2,8}$/i;
const WRAP_SYM_RE = /\b(wbtc|weth|steth|wsteth|cbeth|reth|msol|jitosol|wbnb|wavax|stmatic|stsol)\b/i;
const CAT_MULT: Record<string, number> = {
  derivatives: 0.85, perps: 0.85, dexs: 0.55, dex: 0.55, lending: 0.38, bridge: 0.7,
  "cross chain": 0.7, yield: 0.32, "yield aggregator": 0.32, restaking: 0.28,
  "liquid staking": 0.28, "liquid restaking": 0.3, rwa: 0.35, cdp: 0.25,
  launchpad: 0.65, options: 0.75, "prediction market": 1.1, payments: 0.75,
};

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function slugify(v: string): string {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = num(v);
  return Number.isFinite(n) ? n : null;
}

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pickFn(mod: Record<string, unknown>, names: string[]): ((...args: unknown[]) => unknown) | null {
  for (const name of names) {
    const candidate = mod[name];
    if (typeof candidate === "function") return candidate as (...args: unknown[]) => unknown;
  }
  return null;
}

function indexAux(src: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  if (Array.isArray(src)) {
    for (const item of src) {
      const r = asRec(item);
      const k = slugify(str(r.slug) || str(r.name) || str(r.protocol) || str(r.id));
      if (k) out.set(k, r);
    }
  } else if (src && typeof src === "object") {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      const r = asRec(v);
      const key = slugify(k);
      if (key) out.set(key, Object.keys(r).length ? r : { value: num(v) });
    }
  }
  return out;
}

export function parseSnapshot(input: unknown): ParsedSnapshot {
  let raw: unknown = input;
  if (raw instanceof Uint8Array) raw = Buffer.from(raw).toString("utf8");
  if (typeof raw === "string") {
    const t = raw.trim();
    const text = !t.startsWith("{") && !t.startsWith("[") && existsSync(t) ? readFileSync(t, "utf8") : t;
    raw = JSON.parse(text);
  }
  const root = Array.isArray(raw) ? { protocols: raw } : asRec(raw);
  const meta = asRec(root.meta);
  const asOf = str(root.asOf || root.snapshotDate || root.generatedAt || root.capturedAt || meta.asOf || meta.generatedAt) || DEFAULT_AS_OF;
  const list = Array.isArray(root.protocols) ? root.protocols : Array.isArray(root.data) ? root.data : Array.isArray(root.items) ? root.items : [];
  const feeMap = indexAux(root.fees);
  const revMap = indexAux(root.revenue);
  const volMap = indexAux(root.volumes || root.dexs);
  const raiseMap = indexAux(root.raises);

  const rawWatch = Array.isArray(root.watchlist) ? root.watchlist : Array.isArray(meta.watchlist) ? meta.watchlist : [];
  const watchSet = new Set<string>();
  for (const w of rawWatch) {
    const s = typeof w === "string" ? slugify(w) : slugify(str(asRec(w).slug) || str(asRec(w).name) || str(asRec(w).id));
    if (s) watchSet.add(s);
  }

  const protocols: RawProtocol[] = [];
  for (let i = 0; i < list.length; i++) {
    const r = asRec(list[i]);
    const name = str(r.name) || str(r.slug);
    const slug = slugify(str(r.slug) || name || `protocol-${i}`);
    if (!name && !slug) continue;
    const rawChains = Array.isArray(r.chains) ? r.chains.map(str).filter(Boolean) : [];
    const primaryChain = str(r.chain) || rawChains[0] || "Multi-Chain";
    const chains = Array.from(new Set(rawChains.length ? rawChains : [primaryChain])).sort(cmpStr);
    const fRec = feeMap.get(slug) || {};
    const rRec = revMap.get(slug) || {};
    const vRec = volMap.get(slug) || {};
    const zRec = raiseMap.get(slug) || {};
    const raisedRaw = num(r.totalRaised || r.raised || zRec.totalRaised || zRec.amount || zRec.value);
    const totalRaised = raisedRaw > 0 && raisedRaw < 10_000 ? raisedRaw * 1_000_000 : raisedRaw;
    protocols.push({
      id: str(r.id) || slug,
      slug,
      name: name || slug,
      symbol: str(r.symbol),
      address: str(r.address),
      geckoId: str(r.gecko_id || r.geckoId),
      cmcId: str(r.cmcId || r.cmc_id),
      category: str(r.category) || "DeFi",
      chain: primaryChain,
      chains,
      tvl: Math.max(0, num(r.tvl)),
      mcap: Math.max(0, num(r.mcap)),
      fdv: Math.max(0, num(r.fdv)),
      change1d: optNum(r.change_1d ?? r.change1d),
      change7d: optNum(r.change_7d ?? r.change7d),
      fees24h: Math.max(0, num(r.fees24h ?? r.dailyFees ?? fRec.total24h ?? fRec.fees24h)),
      fees30d: Math.max(0, num(r.fees30d ?? fRec.total30d ?? fRec.fees30d ?? fRec.value)),
      revenue30d: Math.max(0, num(r.revenue30d ?? rRec.total30d ?? rRec.revenue30d ?? rRec.value)),
      volume24h: Math.max(0, num(r.volume24h ?? vRec.total24h ?? vRec.volume24h ?? vRec.value)),
      totalRaised: Math.max(0, totalRaised),
      parentProtocol: str(r.parentProtocol || r.parentProtocolId),
      url: str(r.url),
      twitter: str(r.twitter),
      description: str(r.description),
      audits: Math.max(0, Math.round(num(r.audits) || (Array.isArray(r.audit_links) ? r.audit_links.length : 0))),
      listedAt: Math.max(0, Math.round(num(r.listedAt))),
      raw: r,
    });
  }
  return { asOf, protocols, watchlist: Array.from(watchSet).sort(cmpStr), meta };
}

function hasLiveToken(p: RawProtocol): boolean {
  if (!EMPTY_TOKENS.has(p.geckoId.toLowerCase())) return true;
  if (!EMPTY_TOKENS.has(p.cmcId.toLowerCase())) return true;
  if (p.mcap > 0 || p.fdv > 0) return true;
  if (!EMPTY_TOKENS.has(p.address.toLowerCase())) return true;
  if (!EMPTY_TOKENS.has(p.symbol.toLowerCase())) return true;
  return false;
}

function classifyExclusion(p: RawProtocol, tokenedParents: Set<string>): string | null {
  const extFilter = pickFn(filtersMod as Record<string, unknown>, ["classifyProtocol", "evaluateProtocol", "checkEligibility"]);
  if (extFilter) {
    try {
      const res = asRec(extFilter(p.raw, p));
      if (typeof res.eligible === "boolean") return res.eligible ? null : str(res.reason) || "Excluded by filter";
    } catch { /* fallback below */ }
  }
  if (hasLiveToken(p)) return "tokened";
  if (p.parentProtocol && tokenedParents.has(slugify(p.parentProtocol.replace(/^parent#/, "")))) return "parent-tokened";
  if (EXCLUDED_CATS.has(p.category.toLowerCase())) return `category:${p.category}`;
  if (WRAP_RE.test(p.name) || (WRAP_SYM_RE.test(p.name) && p.chains.length <= 2)) return "wrapped-or-staked";
  const desc = p.description.toLowerCase();
  if (desc.includes("wrapped version of") || desc.includes("bridged representation of")) return "wrapped-or-staked";
  return null;
}

function defaultFarmPlan(p: RawProtocol): FarmPlan {
  const extFarm = pickFn(farmingMod as Record<string, unknown>, ["buildFarmPlan", "generateFarmPlan", "createFarmPlan", "getFarmPlan"]);
  if (extFarm) {
    try {
      const out = asRec(extFarm(p.raw, p));
      if (Array.isArray(out.steps) && out.steps.length >= 2) {
        const steps: FarmStep[] = out.steps.slice(0, 6).map((s, idx) => {
          const r = asRec(s);
          return {
            step: idx + 1,
            title: str(r.title) || `Step ${idx + 1}`,
            action: str(r.action || r.summary || r.title) || `Interact with ${p.name}`,
            detail: str(r.detail || r.description || r.action) || `Execute verified activity on ${p.chain}.`,
            chain: str(r.chain) || p.chain,
          };
        });
        const diff = str(out.difficulty);
        const risk = str(out.riskLevel || out.risk);
        return {
          summary: str(out.summary || out.strategy) || `Build recurring organic activity on ${p.name} (${p.chain}).`,
          difficulty: diff === "Low" || diff === "High" ? diff : "Medium",
          capitalTier: str(out.capitalTier || out.capital) || (p.tvl > 100_000_000 ? "$500+" : "$200+"),
          riskLevel: risk === "Low" || risk === "High" ? risk : "Medium",
          estimatedEffort: str(out.estimatedEffort || out.effort) || "15 min setup + weekly activity",
          sybilNotes: str(out.sybilNotes || out.sybil) || "Keep natural sizing, multi-week cadence, and avoid circular transfers.",
          steps,
        };
      }
    } catch { /* fallback below */ }
  }
  const cat = p.category.toLowerCase();
  const isPerps = cat.includes("deriv") || cat.includes("perp") || cat.includes("option");
  const isDex = cat.includes("dex");
  const isLend = cat.includes("lend") || cat.includes("cdp");
  const isBridge = cat.includes("bridge") || cat.includes("cross");
  const isStake = cat.includes("stak") || cat.includes("yield") || cat.includes("rwa");
  const verb = isPerps ? "Trade perpetual volume & provide vault liquidity" : isDex ? "Route swaps & provide active LP ranges" : isLend ? "Supply collateral & maintain healthy borrow usage" : isBridge ? "Bridge assets across multiple supported routes" : isStake ? "Deposit core assets into points-accruing vaults" : "Generate recurring on-chain usage across core features";
  const site = p.url || `official ${p.name} app`;
  return {
    summary: `${verb} on ${p.name} (${p.chain}) across distinct weeks to qualify for a retroactive token launch.`,
    difficulty: isPerps || isLend ? "Medium" : "Low",
    capitalTier: p.tvl > 250_000_000 ? "$1,000+" : p.tvl > 25_000_000 ? "$250+" : "$100+",
    riskLevel: p.audits > 0 && p.tvl > 50_000_000 ? "Low" : "Medium",
    estimatedEffort: "15 min initial setup + 10 min weekly",
    sybilNotes: "Use an aged primary wallet, vary trade sizes, hold positions >7 days, and avoid dust-only transactions.",
    steps: [
      { step: 1, title: "Verify & Fund Wallet", action: `Connect to ${site} on ${p.chain}`, detail: `Confirm official domain and fund gas plus working capital on ${p.chain}.`, chain: p.chain },
      { step: 2, title: "Core Protocol Position", action: verb, detail: `Deploy meaningful liquidity or volume on ${p.name} rather than a single minimal transaction.`, chain: p.chain },
      { step: 3, title: "Multi-Week Cadence", action: "Repeat activity across 4+ distinct weeks", detail: "Spread swaps, deposits, or rebalances over separate weeks to clear snapshot consistency filters.", chain: p.chain },
      { step: 4, title: "Track Points & Risk", action: "Monitor points dashboard and protocol health", detail: "Record wallet tier, check official announcements, and keep LTV or IL exposure within limits.", chain: p.chain },
    ],
  };
}

export function buildRadar(input: ParsedSnapshot | unknown, options?: { limit?: number; minRows?: number }): RadarResult {
  const snap = asRec(input).protocols && Array.isArray(asRec(input).protocols) && typeof asRec(input).asOf === "string"
    ? (input as ParsedSnapshot)
    : parseSnapshot(input);
  const limit = Math.max(100, options?.limit ?? 220);
  const minRows = Math.max(100, options?.minRows ?? 100);
  const watchSet = new Set(snap.watchlist);

  const tokenedParents = new Set<string>();
  const compsByCat = new Map<string, PeerComp[]>();
  const allComps: PeerComp[] = [];
  for (const p of snap.protocols) {
    if (hasLiveToken(p)) {
      tokenedParents.add(p.slug);
      tokenedParents.add(slugify(p.name));
      if (p.parentProtocol) tokenedParents.add(slugify(p.parentProtocol.replace(/^parent#/, "")));
      const val = p.fdv > 0 ? p.fdv : p.mcap;
      if (val >= 100_000 && p.tvl >= 100_000) {
        const mult = Math.min(8, Math.max(0.05, val / p.tvl));
        const comp: PeerComp = { slug: p.slug, name: p.name, tvl: Math.round(p.tvl), mcap: Math.round(val), multiple: Number(mult.toFixed(3)) };
        allComps.push(comp);
        const key = p.category.toLowerCase();
        const arr = compsByCat.get(key) || [];
        arr.push(comp);
        compsByCat.set(key, arr);
      }
    }
  }
  const globalMult = allComps.length ? Math.min(1.5, Math.max(0.2, median(allComps.map((c) => c.multiple)))) : 0.4;

  let excludedWithToken = 0;
  let excludedDerivative = 0;
  const exclusions: Array<{ slug: string; name: string; reason: string; tvl: number }> = [];
  const candidates: Array<{ p: RawProtocol; watchlisted: boolean }> = [];

  for (const p of snap.protocols) {
    const watchlisted = watchSet.has(p.slug) || watchSet.has(slugify(p.name)) || watchSet.has(slugify(p.id));
    const reason = classifyExclusion(p, tokenedParents);
    if (reason && !watchlisted) {
      if (reason === "tokened") excludedWithToken++;
      else excludedDerivative++;
      if (p.tvl >= 1_000_000) exclusions.push({ slug: p.slug, name: p.name, reason, tvl: Math.round(p.tvl) });
      continue;
    }
    candidates.push({ p, watchlisted });
  }
  exclusions.sort((a, b) => b.tvl - a.tvl || cmpStr(a.slug, b.slug));

  const extVal = pickFn(valuationMod as Record<string, unknown>, ["valueProtocol", "estimateValuation", "computeValuation", "valuateProtocol"]);
  const scored: RadarRow[] = candidates.map(({ p, watchlisted }) => {
    const catKey = p.category.toLowerCase();
    const peers = (compsByCat.get(catKey) || []).slice().sort((a, b) => Math.abs(a.tvl - p.tvl) - Math.abs(b.tvl - p.tvl) || cmpStr(a.slug, b.slug));
    const baseMult = peers.length >= 3 ? Math.min(2.5, Math.max(0.12, median(peers.map((c) => c.multiple)))) : (CAT_MULT[catKey] ?? globalMult);
    const annFees = p.fees30d > 0 ? p.fees30d * 12 : p.fees24h * 365;
    const annRev = p.revenue30d * 12;
    const tvlEst = p.tvl * baseMult;
    const feeEst = annRev > 0 ? annRev * 18 : annFees > 0 ? annFees * 10 : 0;
    const raiseEst = p.totalRaised > 0 ? p.totalRaised * 6 : 0;
    let blended = tvlEst;
    let method = peers.length >= 3 ? "Category Peer TVL Comps" : "Sector Baseline TVL Comps";
    if (feeEst > 0 && tvlEst > 0) { blended = tvlEst * 0.55 + feeEst * 0.45; method = "Blended TVL + Annualized Fee Comps"; }
    else if (feeEst > 0) { blended = feeEst; method = "Annualized Fee Multiple"; }
    if (raiseEst > 0) { blended = blended > 0 ? blended * 0.78 + raiseEst * 0.22 : raiseEst; method += " + Raise Anchor"; }

    const momBoost = p.change7d !== null ? Math.min(0.18, Math.max(-0.15, p.change7d / 100)) : 0;
    const chainBoost = Math.min(0.15, (p.chains.length - 1) * 0.04);
    const auditBoost = p.audits > 0 ? 0.06 : 0;
    let impliedFdv = Math.max(2_500_000, Math.round(blended * (1 + momBoost + chainBoost + auditBoost)));
    let score = Math.min(99, Math.max(12, Math.round(Math.log10(Math.max(1, impliedFdv)) * 10.2 + (p.fees30d > 0 ? 8 : 0) + (p.totalRaised > 0 ? 6 : 0) + (watchlisted ? 4 : 0) + (p.audits > 0 ? 3 : 0))));

    if (extVal) {
      try {
        const res = asRec(extVal(p.raw, p, { peerMultiple: baseMult, peers }));
        const extFdv = num(res.impliedFdv ?? res.impliedValue ?? res.fdv);
        if (extFdv >= 1_000_000) impliedFdv = Math.round(extFdv);
        const extScore = num(res.score);
        if (extScore > 0 && extScore <= 100) score = Math.round(extScore);
      } catch { /* keep deterministic model */ }
    }

    const signals: string[] = [];
    if (p.tvl >= 100_000_000) signals.push("Top-tier TVL scale");
    if (annFees >= 1_000_000) signals.push("Strong organic fee capture");
    if (p.totalRaised >= 5_000_000) signals.push("Backed by venture funding");
    if (p.chains.length >= 3) signals.push(`Multi-chain footprint (${p.chains.length} chains)`);
    if (p.change7d !== null && p.change7d >= 10) signals.push(`Positive 7d TVL momentum (+${p.change7d.toFixed(1)}%)`);
    if (watchlisted) signals.push("Priority watchlist target");
    if (!signals.length) signals.push("Confirmed tokenless DeFi protocol");

    const tier: "S" | "A" | "B" | "C" = impliedFdv >= 500_000_000 ? "S" : impliedFdv >= 150_000_000 ? "A" : impliedFdv >= 40_000_000 ? "B" : "C";
    const confidence: "High" | "Medium" | "Low" = peers.length >= 4 && (p.fees30d > 0 || p.totalRaised > 0) ? "High" : p.tvl >= 5_000_000 ? "Medium" : "Low";

    return {
      rank: 0,
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chain: p.chain,
      chains: p.chains,
      tvl: Math.round(p.tvl),
      change1d: p.change1d !== null ? Number(p.change1d.toFixed(2)) : null,
      change7d: p.change7d !== null ? Number(p.change7d.toFixed(2)) : null,
      fees24h: Math.round(p.fees24h),
      fees30d: Math.round(p.fees30d),
      revenue30d: Math.round(p.revenue30d),
      volume24h: Math.round(p.volume24h),
      totalRaised: Math.round(p.totalRaised),
      url: p.url,
      twitter: p.twitter,
      description: p.description,
      watchlisted,
      impliedValue: impliedFdv,
      impliedFdv,
      impliedMcap: Math.round(impliedFdv * 0.15),
      lowFdv: Math.round(impliedFdv * 0.6),
      highFdv: Math.round(impliedFdv * 1.65),
      airdropPoolUsd: Math.round(impliedFdv * 0.07),
      peerMultiple: Number(baseMult.toFixed(3)),
      peerCount: peers.length,
      confidence,
      score,
      tier,
      valuationMethod: method,
      signals,
      comps: (peers.length ? peers : allComps).slice(0, 3),
      farmPlan: defaultFarmPlan(p),
    };
  });

  scored.sort((a, b) => b.impliedFdv - a.impliedFdv || b.score - a.score || b.tvl - a.tvl || cmpStr(a.slug, b.slug));
  const keepCount = Math.max(minRows, limit);
  const selected: RadarRow[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    if (selected.length < keepCount || row.watchlisted) {
      if (!seen.has(row.slug)) { seen.add(row.slug); selected.push(row); }
    }
  }
  selected.sort((a, b) => b.impliedFdv - a.impliedFdv || b.score - a.score || b.tvl - a.tvl || cmpStr(a.slug, b.slug));
  selected.forEach((r, idx) => { r.rank = idx + 1; });

  const catAgg = new Map<string, { count: number; totalTvl: number; totalImpliedFdv: number; mults: number[] }>();
  const chainAgg = new Map<string, { count: number; totalTvl: number }>();
  const coveredSlugs = new Set<string>();
  for (const r of selected) {
    if (r.watchlisted) { coveredSlugs.add(r.slug); coveredSlugs.add(slugify(r.name)); coveredSlugs.add(slugify(r.id)); }
    const c = catAgg.get(r.category) || { count: 0, totalTvl: 0, totalImpliedFdv: 0, mults: [] };
    c.count++; c.totalTvl += r.tvl; c.totalImpliedFdv += r.impliedFdv; c.mults.push(r.peerMultiple);
    catAgg.set(r.category, c);
    const ch = chainAgg.get(r.chain) || { count: 0, totalTvl: 0 };
    ch.count++; ch.totalTvl += r.tvl;
    chainAgg.set(r.chain, ch);
  }
  const missingWatch = snap.watchlist.filter((w) => !coveredSlugs.has(w));
  const categories = Array.from(catAgg.entries())
    .map(([category, v]) => ({ category, count: v.count, totalTvl: v.totalTvl, totalImpliedFdv: v.totalImpliedFdv, medianMultiple: Number(median(v.mults).toFixed(3)) }))
    .sort((a, b) => b.totalImpliedFdv - a.totalImpliedFdv || cmpStr(a.category, b.category));
  const chains = Array.from(chainAgg.entries())
    .map(([chain, v]) => ({ chain, count: v.count, totalTvl: v.totalTvl }))
    .sort((a, b) => b.totalTvl - a.totalTvl || cmpStr(a.chain, b.chain));
  const totalImpliedFdv = selected.reduce((acc, r) => acc + r.impliedFdv, 0);

  return {
    asOf: snap.asOf,
    rows: selected,
    summary: {
      totalProtocols: snap.protocols.length,
      excludedWithToken,
      excludedDerivative,
      candidateCount: scored.length,
      rowCount: selected.length,
      watchlistTotal: snap.watchlist.length,
      watchlistCovered: snap.watchlist.length - missingWatch.length,
      totalImpliedFdv,
      medianImpliedFdv: Math.round(median(selected.map((r) => r.impliedFdv))),
      categoriesCount: categories.length,
      chainsCount: chains.length,
    },
    watchlist: { total: snap.watchlist.length, covered: snap.watchlist.length - missingWatch.length, missing: missingWatch, slugs: snap.watchlist },
    categories,
    chains,
    exclusions: exclusions.slice(0, 40),
  };
}

export function boardIssue(radar: RadarResult, title = "Token Launch Radar"): BoardIssue {
  return {
    schema: "token-radar/1",
    title,
    generatedAt: radar.asOf,
    ...radar,
  };
}

export function dataScript(payload: unknown, globalName?: string): string {
  const safeJson = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  if (globalName) return `window[${JSON.stringify(globalName)}] = ${safeJson};\n`;
  return `(function(){var d=${safeJson};window.__RADAR_DATA__=d;window.BOARD_DATA=d;})();\n`;
}