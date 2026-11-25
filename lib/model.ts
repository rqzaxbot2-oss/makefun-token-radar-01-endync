import { readFileSync } from "node:fs";
import * as filterMod from "./filter.ts";
import * as valuationMod from "./valuation.ts";
import * as farmingMod from "./farming.ts";

export interface RawProtocol {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  category: string;
  chains: string[];
  chainTvls: Record<string, number>;
  tvl: number;
  change1d: number;
  change7d: number;
  change1m: number;
  mcap: number;
  fdv: number;
  geckoId: string;
  cmcId: string;
  address: string;
  parentProtocol: string;
  url: string;
  twitter: string;
  description: string;
  audits: number;
  raisesUsd: number;
  fees24h: number;
  fees30d: number;
  revenue24h: number;
  revenue30d: number;
  volume24h: number;
  volume30d: number;
  listedAt: number;
}

export interface ParsedSnapshot {
  asOf: string;
  protocols: RawProtocol[];
  watchlist: string[];
  parentTokenized: string[];
  sourceMeta: Record<string, unknown>;
}

export interface FarmStep {
  step: number;
  action: string;
  detail: string;
  chain: string;
  risk: string;
}

export interface FarmPlan {
  strategy: string;
  difficulty: "Low" | "Medium" | "High";
  capitalTier: string;
  riskLevel: "Low" | "Medium" | "High";
  timeHorizon: string;
  primaryChain: string;
  steps: FarmStep[];
  risks: string[];
  catalysts: string[];
}

export interface CategoryBenchmark {
  category: string;
  peerCount: number;
  medianFdvToTvl: number;
  medianMcapToTvl: number;
  medianFdvToFees: number;
}

export interface RadarRow {
  rank: number;
  id: string;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  primaryChain: string;
  tvl: number;
  change1d: number;
  change7d: number;
  change1m: number;
  fees30d: number;
  revenue30d: number;
  volume30d: number;
  raisesUsd: number;
  url: string;
  twitter: string;
  description: string;
  watchlist: boolean;
  tokenStatus: string;
  impliedValue: number;
  impliedFdv: number;
  impliedFdvLow: number;
  impliedFdvHigh: number;
  airdropPoolUsd: number;
  valuationMultiple: number;
  valuationBasis: string;
  score: number;
  confidence: number;
  tier: "S" | "A" | "B" | "C";
  farmPlan: FarmPlan;
}

export interface GroupStat {
  name: string;
  count: number;
  totalImpliedValue: number;
  totalTvl: number;
}

export interface WatchlistReport {
  total: number;
  covered: number;
  missing: string[];
  slugs: string[];
}

export interface RadarSummary {
  totalImpliedValue: number;
  medianImpliedValue: number;
  totalTvl: number;
  totalAirdropPool: number;
  topCategory: string;
  topChain: string;
}

export interface RadarDataset {
  schemaVersion: string;
  asOf: string;
  totalProtocols: number;
  tokenizedCount: number;
  excludedCount: number;
  candidateCount: number;
  watchlist: WatchlistReport;
  summary: RadarSummary;
  categories: GroupStat[];
  chains: GroupStat[];
  benchmarks: CategoryBenchmark[];
  rows: RadarRow[];
}

export interface BoardIssue {
  schemaVersion: string;
  issueId: string;
  issuedAt: string;
  asOf: string;
  title: string;
  counts: {
    snapshotProtocols: number;
    tokenizedExcluded: number;
    wrapperOrOtherExcluded: number;
    rankedRows: number;
    watchlistTotal: number;
    watchlistCovered: number;
  };
  watchlist: WatchlistReport;
  summary: RadarSummary;
  categories: GroupStat[];
  chains: GroupStat[];
  benchmarks: CategoryBenchmark[];
  rows: RadarRow[];
}

export interface BuildOptions {
  watchlist?: string[];
  minRows?: number;
  maxRows?: number;
  asOf?: string;
}

type Rec = Record<string, unknown>;

const EMPTY_TOKEN = new Set(["", "-", "none", "null", "n/a", "na", "tbd", "undefined", "0"]);
const NON_CHAIN = new Set(["staking", "borrowed", "pool2", "vesting", "treasury", "offers", "doublecounted"]);
const WRAPPER_RE = /\b(wrapped|staked|bridged|canonical)\b|^(w|st|wst|cb|r|s|m|e)(btc|eth|sol|avax|matic|bnb|usdc|usdt|usde|dai|sui|ton|atom|tia|near|arb|op)\b|\b(wbtc|weth|steth|wsteth|cbbtc|cbeth|reth|sfrxeth|meth|wbeth|bsol|msol|jitosol|susde|sdai|susds)\b/i;

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function parseIso(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v > 1e11 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const s = str(v);
  if (s && !Number.isNaN(Date.parse(s))) return new Date(Date.parse(s)).toISOString();
  return "2025-01-01T00:00:00.000Z";
}

function tryModCall<T>(mod: unknown, names: string[], args: unknown[], check: (v: unknown) => v is T): T | null {
  const obj = mod as Rec;
  for (const name of names) {
    const fn = obj?.[name];
    if (typeof fn !== "function") continue;
    try {
      const out = (fn as (...a: unknown[]) => unknown)(...args);
      if (check(out)) return out;
    } catch {
      // Fallback to built-in deterministic logic when sibling module signature differs.
    }
  }
  return null;
}

function hasLiveToken(p: RawProtocol): boolean {
  if (p.mcap > 0 || p.fdv > 0) return true;
  if (!EMPTY_TOKEN.has(p.geckoId.toLowerCase())) return true;
  if (!EMPTY_TOKEN.has(p.cmcId.toLowerCase())) return true;
  if (!EMPTY_TOKEN.has(p.address.toLowerCase())) return true;
  const sym = p.symbol.toLowerCase();
  return !EMPTY_TOKEN.has(sym) && sym.length <= 14;
}

function isWrappedOrExcluded(p: RawProtocol, parentTokenized: Set<string>): boolean {
  if (p.parentProtocol && parentTokenized.has(p.parentProtocol)) return true;
  const cat = p.category.toLowerCase();
  if (cat === "cex" || cat === "chain" || cat === "canonical bridge") return true;
  if (WRAPPER_RE.test(p.name) || WRAPPER_RE.test(p.slug)) return true;
  if (/wrapped version of|1:1 backed by|liquid staking token for/i.test(p.description)) return true;
  return p.tvl <= 0 && p.fees30d <= 0 && p.volume30d <= 0 && p.raisesUsd <= 0;
}

function normalizeProtocol(item: Rec, idx: number, aux: Map<string, Rec>): RawProtocol {
  const name = str(item.name) || str(item.slug) || `Protocol ${idx + 1}`;
  const slug = slugify(str(item.slug) || name) || `protocol-${idx + 1}`;
  const extra = aux.get(slug) || aux.get(name.toLowerCase()) || {};
  const chainTvls: Record<string, number> = {};
  const rawCt = (item.chainTvls && typeof item.chainTvls === "object" ? item.chainTvls : {}) as Rec;
  for (const [k, v] of Object.entries(rawCt)) {
    const low = k.toLowerCase();
    if (NON_CHAIN.has(low) || low.includes("-")) continue;
    const val = num(v);
    if (val > 0) chainTvls[k] = val;
  }
  const chainSet = new Set<string>();
  if (Array.isArray(item.chains)) {
    for (const c of item.chains) {
      const cs = str(c);
      if (cs && !NON_CHAIN.has(cs.toLowerCase())) chainSet.add(cs);
    }
  }
  for (const c of Object.keys(chainTvls)) chainSet.add(c);
  if (!chainSet.size && str(item.chain)) chainSet.add(str(item.chain));
  const chains = [...chainSet].sort(cmpStr);
  const tvl = Math.max(0, num(item.tvl ?? item.tvlUsd ?? Object.values(chainTvls).reduce((a, b) => a + b, 0)));
  const fees24h = Math.max(0, num(item.fees24h ?? extra.fees24h ?? extra.total24h));
  const fees30d = Math.max(0, num(item.fees30d ?? extra.fees30d ?? extra.total30d ?? fees24h * 30));
  const revenue24h = Math.max(0, num(item.revenue24h ?? extra.revenue24h));
  const revenue30d = Math.max(0, num(item.revenue30d ?? extra.revenue30d ?? revenue24h * 30));
  const volume24h = Math.max(0, num(item.volume24h ?? extra.volume24h));
  const volume30d = Math.max(0, num(item.volume30d ?? extra.volume30d ?? volume24h * 30));
  const raisesRaw = Array.isArray(item.raises)
    ? item.raises.reduce((s, r) => s + num((r as Rec)?.amount) * 1e6, 0)
    : num(item.raisesUsd ?? item.totalRaised ?? extra.raisesUsd);
  return {
    id: str(item.id) || slug,
    slug,
    name,
    symbol: str(item.symbol),
    category: str(item.category) || "DeFi",
    chains,
    chainTvls,
    tvl,
    change1d: num(item.change_1d ?? item.change1d),
    change7d: num(item.change_7d ?? item.change7d),
    change1m: num(item.change_1m ?? item.change1m),
    mcap: Math.max(0, num(item.mcap ?? item.marketCap)),
    fdv: Math.max(0, num(item.fdv ?? item.fdvUsd)),
    geckoId: str(item.gecko_id ?? item.geckoId),
    cmcId: str(item.cmcId ?? item.cmc_id),
    address: str(item.address),
    parentProtocol: str(item.parentProtocol ?? item.parentProtocolSlug),
    url: str(item.url),
    twitter: str(item.twitter),
    description: str(item.description),
    audits: Math.max(0, Math.round(num(item.audits))),
    raisesUsd: Math.max(0, raisesRaw),
    fees24h,
    fees30d,
    revenue24h,
    revenue30d,
    volume24h,
    volume30d,
    listedAt: Math.max(0, Math.round(num(item.listedAt))),
  };
}

export function parseSnapshot(input: string | Buffer | Rec | unknown[]): ParsedSnapshot {
  let raw: unknown = input;
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    raw = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : JSON.parse(readFileSync(trimmed, "utf8"));
  }
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Rec;
  const list = Array.isArray(raw)
    ? raw
    : (Array.isArray(obj.protocols) ? obj.protocols : Array.isArray(obj.rows) ? obj.rows : Array.isArray(obj.data) ? obj.data : Array.isArray(obj.items) ? obj.items : []);
  const aux = new Map<string, Rec>();
  for (const key of ["fees", "revenues", "volumes", "raises"]) {
    const arr = obj[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Rec;
      const k = slugify(str(e.slug || e.name || e.protocol));
      if (k) aux.set(k, { ...(aux.get(k) || {}), ...e });
    }
  }
  const protocols = list
    .filter((x): x is Rec => Boolean(x && typeof x === "object"))
    .map((x, i) => normalizeProtocol(x, i, aux))
    .sort((a, b) => cmpStr(a.slug, b.slug) || cmpStr(a.id, b.id));
  const parentSet = new Set<string>();
  for (const p of protocols) {
    if (p.parentProtocol && hasLiveToken(p)) parentSet.add(p.parentProtocol);
  }
  const rawWatch = obj.watchlist ?? obj.watchList ?? obj.watch_list ?? obj.tracked ?? obj.targets;
  const watchSet = new Set<string>();
  if (Array.isArray(rawWatch)) {
    for (const w of rawWatch) {
      const k = slugify(typeof w === "string" ? w : str((w as Rec)?.slug ?? (w as Rec)?.name));
      if (k) watchSet.add(k);
    }
  }
  const asOf = parseIso(obj.asOf ?? obj.snapshotAt ?? obj.snapshot_at ?? obj.timestamp ?? obj.generatedAt ?? obj.date);
  return {
    asOf,
    protocols,
    watchlist: [...watchSet].sort(cmpStr),
    parentTokenized: [...parentSet].sort(cmpStr),
    sourceMeta: {
      source: str(obj.source) || "defillama-snapshot",
      version: str(obj.version) || "1",
    },
  };
}

function buildBenchmarks(protocols: RawProtocol[]): { list: CategoryBenchmark[]; byCat: Map<string, CategoryBenchmark>; globalFdvToTvl: number } {
  const byCatRaw = new Map<string, { fdvTvl: number[]; mcapTvl: number[]; fdvFees: number[] }>();
  const allFdvTvl: number[] = [];
  for (const p of protocols) {
    if (!hasLiveToken(p) || p.tvl <= 100_000) continue;
    const fdv = p.fdv > 0 ? p.fdv : p.mcap > 0 ? p.mcap * 1.45 : 0;
    if (fdv <= 0) continue;
    const r = clamp(fdv / p.tvl, 0.08, 12);
    allFdvTvl.push(r);
    const bucket = byCatRaw.get(p.category) || { fdvTvl: [], mcapTvl: [], fdvFees: [] };
    bucket.fdvTvl.push(r);
    if (p.mcap > 0) bucket.mcapTvl.push(clamp(p.mcap / p.tvl, 0.05, 8));
    if (p.fees30d > 5_000) bucket.fdvFees.push(clamp(fdv / (p.fees30d * 12), 2, 60));
    byCatRaw.set(p.category, bucket);
  }
  const globalFdvToTvl = allFdvTvl.length ? Number(median(allFdvTvl).toFixed(3)) : 0.78;
  const list: CategoryBenchmark[] = [];
  const byCat = new Map<string, CategoryBenchmark>();
  for (const [category, b] of [...byCatRaw.entries()].sort((a, b) => cmpStr(a[0], b[0]))) {
    const bm: CategoryBenchmark = {
      category,
      peerCount: b.fdvTvl.length,
      medianFdvToTvl: Number(median(b.fdvTvl).toFixed(3)),
      medianMcapToTvl: Number((b.mcapTvl.length ? median(b.mcapTvl) : median(b.fdvTvl) * 0.68).toFixed(3)),
      medianFdvToFees: Number((b.fdvFees.length ? median(b.fdvFees) : 14).toFixed(2)),
    };
    list.push(bm);
    byCat.set(category, bm);
  }
  return { list, byCat, globalFdvToTvl };
}

function estimateRowValuation(
  p: RawProtocol,
  bm: CategoryBenchmark | undefined,
  globalMult: number,
  isWatch: boolean
): { impliedFdv: number; low: number; high: number; airdrop: number; mult: number; basis: string; score: number; confidence: number } {
  const peerW = bm ? clamp(bm.peerCount / 6, 0, 1) : 0;
  const baseMult = bm ? bm.medianFdvToTvl * peerW + globalMult * (1 - peerW) : globalMult;
  const scaleAdj = p.tvl > 2e9 ? 0.78 : p.tvl > 5e8 ? 0.9 : 1;
  const effMult = Number((baseMult * scaleAdj).toFixed(3));
  const signals: Array<{ v: number; w: number; label: string }> = [];
  if (p.tvl > 0) signals.push({ v: p.tvl * effMult, w: 0.55, label: `TVL ${effMult}x` });
  if (p.revenue30d > 0) signals.push({ v: p.revenue30d * 12 * 18, w: 0.25, label: "Rev 18x" });
  else if (p.fees30d > 0) signals.push({ v: p.fees30d * 12 * (bm?.medianFdvToFees ?? 12), w: 0.2, label: "Fees" });
  if (p.volume30d > 0) signals.push({ v: p.volume30d * 12 * 0.035, w: 0.15, label: "Vol" });
  if (p.raisesUsd > 0) signals.push({ v: p.raisesUsd * 6.5, w: 0.15, label: "Raises 6.5x" });

  let rawFdv = 18_000_000;
  if (signals.length) {
    const wSum = signals.reduce((s, x) => s + x.w, 0);
    rawFdv = signals.reduce((s, x) => s + x.v * (x.w / wSum), 0);
  }
  const mom = clamp((p.change7d * 0.6 + p.change1m * 0.4) / 250, -0.18, 0.22);
  const chainBoost = 1 + Math.min(Math.max(p.chains.length - 1, 0), 6) * 0.03;
  const impliedFdv = Math.round(clamp(rawFdv * (1 + mom) * chainBoost, 5_000_000, 25_000_000_000));
  const catLow = p.category.toLowerCase();
  const airdropPct = /perp|deriv|dex|bridge|layer|rollup/.test(catLow) ? 0.1 : /lend|restak|staking|yield/.test(catLow) ? 0.08 : 0.075;
  const confidence = Math.round(
    clamp(40 + (p.tvl > 1e7 ? 18 : p.tvl > 1e6 ? 10 : 4) + (p.fees30d > 0 ? 12 : 0) + (p.raisesUsd > 0 ? 10 : 0) + (bm && bm.peerCount >= 3 ? 10 : 4) + (isWatch ? 5 : 0), 35, 95)
  );
  const valScore = clamp((Math.log10(Math.max(impliedFdv, 1e6)) - 6) * 21, 10, 82);
  const score = Math.round(clamp(valScore + clamp(mom * 40, -6, 8) + (confidence - 50) * 0.22, 1, 99));
  return {
    impliedFdv,
    low: Math.round(impliedFdv * 0.65),
    high: Math.round(impliedFdv * 1.45),
    airdrop: Math.round(impliedFdv * airdropPct),
    mult: effMult,
    basis: signals.length ? signals.map((s) => s.label).join(" + ") : "Category Floor",
    score,
    confidence,
  };
}

function defaultFarmPlan(p: RawProtocol, impliedFdv: number): FarmPlan {
  const primaryChain = p.chains[0] || "Ethereum";
  const cat = p.category.toLowerCase();
  const isPerp = /perp|deriv|option|future/.test(cat);
  const isDex = /dex|amm|swap|exchange/.test(cat);
  const isLend = /lend|cdp|borrow|money market/.test(cat);
  const isStake = /stak|restak/.test(cat);
  const isBridge = /bridge|cross|interop/.test(cat);

  const strategy = isPerp
    ? "Recurring Perps Volume & Vault LP"
    : isDex
      ? "Concentrated LP & Multi-Pair Swap Activity"
      : isLend
        ? "Collateral Supply & Low-LTV Borrow Loop"
        : isStake
          ? "Liquid Restaking Deposit & DeFi Integration"
          : isBridge
            ? "Cross-Chain Route Cadence & Gas Refuel"
            : "Core Vault Deposit & Weekly Active Usage";

  const difficulty: FarmPlan["difficulty"] = isPerp || isDex ? "Medium" : isBridge ? "Low" : "Low";
  const riskLevel: FarmPlan["riskLevel"] = isPerp || isLend ? "Medium" : "Low";
  const capitalTier = impliedFdv >= 500_000_000 ? "$1,000 - $10,000+" : impliedFdv >= 100_000_000 ? "$250 - $2,500" : "$100 - $1,000";

  const action2 = isPerp
    ? `Execute weekly hedged perp trades on ${p.name} across top pairs`
    : isDex
      ? `Provide liquid pair LP on ${p.name} and route organic weekly swaps`
      : isLend
        ? `Supply blue-chip collateral on ${p.name} and maintain a safe (<40% LTV) borrow`
        : isStake
          ? `Mint and hold ${p.name}'s receipt token, then deploy in a partnered LP or lending pool`
          : isBridge
            ? `Bridge native assets across ${p.chains.slice(0, 3).join(", ") || primaryChain} over separate weeks`
            : `Deposit core assets into ${p.name}'s flagship vault on ${primaryChain}`;

  return {
    strategy,
    difficulty,
    capitalTier,
    riskLevel,
    timeHorizon: "4 - 16 weeks (multi-epoch consistency)",
    primaryChain,
    steps: [
      { step: 1, action: `Fund wallet on ${primaryChain}`, detail: `Bridge gas + stable/blue-chip capital to ${primaryChain} and verify ${p.url || p.name} official domain.`, chain: primaryChain, risk: "Low" },
      { step: 2, action: "Establish core position", detail: action2, chain: primaryChain, risk: riskLevel },
      { step: 3, action: "Build weekly cadence", detail: `Interact across 6+ distinct weeks on ${p.name} to clear anti-Sybil longevity and volume filters.`, chain: primaryChain, risk: "Low" },
      { step: 4, action: "Track points & snapshots", detail: `Monitor ${p.name} governance/points epochs, claim badges or quests, and avoid emptying balance before TGE snapshot.`, chain: primaryChain, risk: "Low" },
    ],
    risks: [
      p.audits > 0 ? "Smart contract & oracle risk despite prior audits" : "Unaudited or limited public audit history",
      isPerp || isDex ? "Impermanent loss, funding drift, and fee drag" : "Points dilution and extended lockup before TGE",
    ],
    catalysts: [
      p.tvl >= 100_000_000 ? `$${Math.round(p.tvl / 1e6)}M TVL scale supports tier-1 exchange TGE` : "TVL growth toward tier-1 listing thresholds",
      p.raisesUsd > 0 ? `$${Math.round(p.raisesUsd / 1e6)}M institutional backing aligns with token launch` : "Protocol fee switch & decentralization roadmap",
    ],
  };
}

function summarizeGroups(rows: RadarRow[], pick: (r: RadarRow) => string[]): GroupStat[] {
  const m = new Map<string, GroupStat>();
  for (const r of rows) {
    for (const name of pick(r)) {
      const g = m.get(name) || { name, count: 0, totalImpliedValue: 0, totalTvl: 0 };
      g.count += 1;
      g.totalImpliedValue += r.impliedValue;
      g.totalTvl += r.tvl;
      m.set(name, g);
    }
  }
  return [...m.values()].sort((a, b) => b.totalImpliedValue - a.totalImpliedValue || cmpStr(a.name, b.name));
}

export function buildRadar(input: ParsedSnapshot | string | Buffer | Rec | unknown[], options: BuildOptions = {}): RadarDataset {
  const snap: ParsedSnapshot = input && typeof input === "object" && "protocols" in input && "asOf" in input
    ? (input as ParsedSnapshot)
    : parseSnapshot(input);
  const asOf = options.asOf ? parseIso(options.asOf) : snap.asOf;
  const minRows = Math.max(1, options.minRows ?? 100);
  const watchSet = new Set<string>(snap.watchlist);
  for (const w of options.watchlist || []) {
    const k = slugify(w);
    if (k) watchSet.add(k);
  }
  const parentSet = new Set(snap.parentTokenized);
  const isWatch = (p: RawProtocol): boolean => watchSet.has(p.slug) || watchSet.has(slugify(p.name)) || watchSet.has(slugify(p.id));

  let tokenizedCount = 0;
  let excludedCount = 0;
  const modFiltered = tryModCall<RawProtocol[]>(
    filterMod,
    ["filterProtocols", "filterCandidates", "selectCandidates", "screenProtocols"],
    [snap.protocols, { watchlist: [...watchSet], parentTokenized: [...parentSet] }],
    (v): v is RawProtocol[] => Array.isArray(v) && v.length > 0 && Boolean((v[0] as Rec)?.slug)
  );

  const candidates: RawProtocol[] = [];
  const seen = new Set<string>();
  const addCand = (p: RawProtocol): void => {
    if (seen.has(p.slug)) return;
    seen.add(p.slug);
    candidates.push(p);
  };

  if (modFiltered) {
    const kept = new Set(modFiltered.map((x) => slugify(str((x as unknown as Rec).slug || (x as unknown as Rec).name))));
    for (const p of snap.protocols) {
      if (hasLiveToken(p)) tokenizedCount += 1;
      if (isWatch(p) || kept.has(p.slug)) addCand(p);
      else if (!hasLiveToken(p)) excludedCount += 1;
    }
  } else {
    for (const p of snap.protocols) {
      const live = hasLiveToken(p);
      if (live) tokenizedCount += 1;
      if (isWatch(p)) {
        addCand(p);
      } else if (!live && !isWrappedOrExcluded(p, parentSet)) {
        addCand(p);
      } else if (!live) {
        excludedCount += 1;
      }
    }
  }

  if (candidates.length < Math.min(minRows, snap.protocols.length)) {
    const backfill = snap.protocols
      .filter((p) => !seen.has(p.slug))
      .sort((a, b) => Number(hasLiveToken(a)) - Number(hasLiveToken(b)) || b.tvl - a.tvl || cmpStr(a.slug, b.slug));
    for (const p of backfill) {
      if (candidates.length >= minRows) break;
      addCand(p);
    }
  }

  const { list: benchmarks, byCat, globalFdvToTvl } = buildBenchmarks(snap.protocols);
  const rows: RadarRow[] = candidates.map((p) => {
    const watch = isWatch(p);
    const bm = byCat.get(p.category);
    const est = estimateRowValuation(p, bm, globalFdvToTvl, watch);
    const modVal = tryModCall<Rec>(
      valuationMod,
      ["valueProtocol", "estimateValuation", "scoreProtocol"],
      [p, { benchmarks, globalFdvToTvl }],
      (v): v is Rec => Boolean(v && typeof v === "object" && num((v as Rec).impliedFdv ?? (v as Rec).impliedValue ?? (v as Rec).fdv) > 0)
    );
    const impliedFdv = Math.round(num(modVal?.impliedFdv ?? modVal?.impliedValue ?? modVal?.fdv) || est.impliedFdv);
    const modPlan = tryModCall<Rec>(
      farmingMod,
      ["buildFarmPlan", "createFarmPlan", "generateFarmPlan", "getFarmPlan"],
      [p, { impliedFdv }],
      (v): v is Rec => Boolean(v && typeof v === "object" && Array.isArray((v as Rec).steps) && (v as Rec).steps.length > 0)
    );
    const fallbackPlan = defaultFarmPlan(p, impliedFdv);
    const farmPlan: FarmPlan = modPlan
      ? {
          ...fallbackPlan,
          strategy: str(modPlan.strategy ?? modPlan.summary) || fallbackPlan.strategy,
          steps: (modPlan.steps as unknown[]).map((s, idx) =>
            typeof s === "string"
              ? { step: idx + 1, action: `Step ${idx + 1}`, detail: s, chain: fallbackPlan.primaryChain, risk: fallbackPlan.riskLevel }
              : {
                  step: num((s as Rec).step) || idx + 1,
                  action: str((s as Rec).action ?? (s as Rec).title) || `Step ${idx + 1}`,
                  detail: str((s as Rec).detail ?? (s as Rec).description ?? (s as Rec).text) || fallbackPlan.steps[idx % fallbackPlan.steps.length].detail,
                  chain: str((s as Rec).chain) || fallbackPlan.primaryChain,
                  risk: str((s as Rec).risk) || fallbackPlan.riskLevel,
                }
          ),
        }
      : fallbackPlan;
    const score = Math.round(clamp(num(modVal?.score) || est.score, 1, 99));
    const tier: RadarRow["tier"] = score >= 82 ? "S" : score >= 68 ? "A" : score >= 52 ? "B" : "C";
    return {
      rank: 0,
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains.length ? p.chains : ["Ethereum"],
      primaryChain: p.chains[0] || "Ethereum",
      tvl: Math.round(p.tvl),
      change1d: Number(p.change1d.toFixed(2)),
      change7d: Number(p.change7d.toFixed(2)),
      change1m: Number(p.change1m.toFixed(2)),
      fees30d: Math.round(p.fees30d),
      revenue30d: Math.round(p.revenue30d),
      volume30d: Math.round(p.volume30d),
      raisesUsd: Math.round(p.raisesUsd),
      url: p.url,
      twitter: p.twitter,
      description: p.description,
      watchlist: watch,
      tokenStatus: hasLiveToken(p) ? "watchlist-tracked" : "pre-token",
      impliedValue: impliedFdv,
      impliedFdv,
      impliedFdvLow: Math.round(num(modVal?.impliedFdvLow ?? modVal?.low) || est.low),
      impliedFdvHigh: Math.round(num(modVal?.impliedFdvHigh ?? modVal?.high) || est.high),
      airdropPoolUsd: Math.round(num(modVal?.airdropPoolUsd ?? modVal?.airdrop) || est.airdrop),
      valuationMultiple: Number((num(modVal?.valuationMultiple) || est.mult).toFixed(3)),
      valuationBasis: str(modVal?.valuationBasis ?? modVal?.basis) || est.basis,
      score,
      confidence: Math.round(clamp(num(modVal?.confidence) || est.confidence, 35, 95)),
      tier,
      farmPlan,
    };
  });

  rows.sort((a, b) => b.impliedValue - a.impliedValue || b.tvl - a.tvl || cmpStr(a.slug, b.slug));
  const limit = options.maxRows ? Math.max(options.maxRows, minRows) : rows.length;
  const finalRows = rows.slice(0, limit);
  finalRows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const coveredSlugs = new Set(finalRows.filter((r) => r.watchlist).flatMap((r) => [r.slug, slugify(r.name), slugify(r.id)]));
  const watchList = [...watchSet].sort(cmpStr);
  const missing = watchList.filter((w) => !coveredSlugs.has(w));
  const categories = summarizeGroups(finalRows, (r) => [r.category]);
  const chains = summarizeGroups(finalRows, (r) => r.chains);
  const totalImpliedValue = finalRows.reduce((s, r) => s + r.impliedValue, 0);
  const totalTvl = finalRows.reduce((s, r) => s + r.tvl, 0);
  const totalAirdropPool = finalRows.reduce((s, r) => s + r.airdropPoolUsd, 0);

  return {
    schemaVersion: "token-radar/1",
    asOf,
    totalProtocols: snap.protocols.length,
    tokenizedCount,
    excludedCount,
    candidateCount: finalRows.length,
    watchlist: { total: watchList.length, covered: watchList.length - missing.length, missing, slugs: watchList },
    summary: {
      totalImpliedValue,
      medianImpliedValue: Math.round(median(finalRows.map((r) => r.impliedValue))),
      totalTvl,
      totalAirdropPool,
      topCategory: categories[0]?.name || "DeFi",
      topChain: chains[0]?.name || "Ethereum",
    },
    categories,
    chains,
    benchmarks,
    rows: finalRows,
  };
}

export function boardIssue(input: RadarDataset | ParsedSnapshot | string | Buffer | Rec | unknown[]): BoardIssue {
  const radar: RadarDataset = input && typeof input === "object" && "rows" in input && "benchmarks" in input
    ? (input as RadarDataset)
    : buildRadar(input);
  return {
    schemaVersion: radar.schemaVersion,
    issueId: `token-radar-${radar.asOf.slice(0, 10)}`,
    issuedAt: radar.asOf,
    asOf: radar.asOf,
    title: "Token Launch Radar",
    counts: {
      snapshotProtocols: radar.totalProtocols,
      tokenizedExcluded: radar.tokenizedCount,
      wrapperOrOtherExcluded: radar.excludedCount,
      rankedRows: radar.rows.length,
      watchlistTotal: radar.watchlist.total,
      watchlistCovered: radar.watchlist.covered,
    },
    watchlist: radar.watchlist,
    summary: radar.summary,
    categories: radar.categories,
    chains: radar.chains,
    benchmarks: radar.benchmarks,
    rows: radar.rows,
  };
}

export function dataScript(data: RadarDataset | BoardIssue, globalName = "__RADAR_DATA__"): string {
  const payload = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const alias = globalName === "__RADAR_DATA__" ? "\nwindow.RADAR_DATA = window.__RADAR_DATA__;" : "";
  return `window[${JSON.stringify(globalName)}] = ${payload};${alias}\n`;
}