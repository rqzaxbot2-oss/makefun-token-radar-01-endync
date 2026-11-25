export interface ProtocolSnapshot {
  id?: string | number;
  name: string;
  slug: string;
  symbol?: string | null;
  category?: string | null;
  chains?: readonly string[] | null;
  chainTvls?: Readonly<Record<string, number>> | null;
  tvl?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  gecko_id?: string | null;
  fees24h?: number | null;
  fees7d?: number | null;
  fees30d?: number | null;
  fees1y?: number | null;
  annualizedFees?: number | null;
  revenue24h?: number | null;
  revenue30d?: number | null;
  annualizedRevenue?: number | null;
  volume24h?: number | null;
  volume30d?: number | null;
  annualizedVolume?: number | null;
  totalRaised?: number | null;
  audits?: string | number | null;
  audit_links?: readonly string[] | null;
  listedAt?: number | null;
  oracles?: readonly string[] | null;
  url?: string | null;
  twitter?: string | null;
  description?: string | null;
  parentProtocol?: string | null;
}

export interface PeerReference {
  slug: string;
  name: string;
  symbol: string;
  tvl: number;
  fdv: number;
  fdvToTvl: number;
  fdvToFees: number | null;
}

export interface CategoryBenchmark {
  category: string;
  peerCount: number;
  feePeerCount: number;
  fdvToTvl: number;
  fdvToTvlP25: number;
  fdvToTvlP75: number;
  fdvToFees: number;
  fdvToFeesP25: number;
  fdvToFeesP75: number;
  tvlWeight: number;
  typicalFloatPct: number;
  typicalAirdropPct: number;
  topPeers: PeerReference[];
}

export interface BenchmarkSet {
  global: CategoryBenchmark;
  byCategory: Record<string, CategoryBenchmark>;
  tokenizedPeerCount: number;
}

export interface ValuationBreakdown {
  tvlAnchorUsd: number;
  feeAnchorUsd: number;
  volumeAnchorUsd: number;
  fundingAnchorUsd: number;
  baseFdvUsd: number;
  peerFdvToTvl: number;
  peerFdvToFees: number;
  scaleFactor: number;
  momentumMultiplier: number;
  chainBreadthMultiplier: number;
  capitalEfficiencyMultiplier: number;
  maturityMultiplier: number;
  totalMultiplier: number;
  effectiveChainCount: number;
  activeChainCount: number;
  annualizedFeesUsd: number;
  annualizedRevenueUsd: number;
  annualizedVolumeUsd: number;
}

export interface ProtocolValuation {
  slug: string;
  name: string;
  category: string;
  tvl: number;
  impliedFdv: number;
  fdvLow: number;
  fdvHigh: number;
  impliedInitialMcap: number;
  estimatedAirdropPoolUsd: number;
  impliedAirdropYieldPct: number;
  launchScore: number;
  fundamentalScore: number;
  momentumScore: number;
  chainBreadthScore: number;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  breakdown: ValuationBreakdown;
  comparablePeers: PeerReference[];
  valuationDrivers: string[];
}

export interface RankedProtocolValuation extends ProtocolValuation {
  rank: number;
  percentile: number;
}

export interface ValuationOptions {
  sortBy?: "impliedFdv" | "launchScore";
  benchmarks?: BenchmarkSet;
}

interface CategoryPrior {
  fdvToTvl: number;
  fdvToFees: number;
  tvlWeight: number;
  floatPct: number;
  airdropPct: number;
}

const DEFAULT_PRIOR: CategoryPrior = {
  fdvToTvl: 0.72,
  fdvToFees: 16.0,
  tvlWeight: 0.62,
  floatPct: 0.16,
  airdropPct: 0.07,
};

const CATEGORY_PRIORS: Record<string, CategoryPrior> = {
  Dexes: { fdvToTvl: 0.85, fdvToFees: 14.5, tvlWeight: 0.48, floatPct: 0.18, airdropPct: 0.08 },
  Derivatives: { fdvToTvl: 2.15, fdvToFees: 16.5, tvlWeight: 0.35, floatPct: 0.18, airdropPct: 0.09 },
  Lending: { fdvToTvl: 0.42, fdvToFees: 17.0, tvlWeight: 0.65, floatPct: 0.17, airdropPct: 0.065 },
  "Liquid Staking": { fdvToTvl: 0.28, fdvToFees: 15.0, tvlWeight: 0.70, floatPct: 0.16, airdropPct: 0.06 },
  "Liquid Restaking": { fdvToTvl: 0.34, fdvToFees: 18.0, tvlWeight: 0.72, floatPct: 0.15, airdropPct: 0.075 },
  Restaking: { fdvToTvl: 0.48, fdvToFees: 22.0, tvlWeight: 0.75, floatPct: 0.14, airdropPct: 0.08 },
  Bridge: { fdvToTvl: 1.45, fdvToFees: 20.0, tvlWeight: 0.45, floatPct: 0.16, airdropPct: 0.085 },
  "Cross Chain": { fdvToTvl: 1.35, fdvToFees: 19.0, tvlWeight: 0.48, floatPct: 0.16, airdropPct: 0.08 },
  CDP: { fdvToTvl: 0.45, fdvToFees: 15.5, tvlWeight: 0.68, floatPct: 0.16, airdropPct: 0.06 },
  Yield: { fdvToTvl: 0.50, fdvToFees: 14.0, tvlWeight: 0.62, floatPct: 0.17, airdropPct: 0.07 },
  "Yield Aggregator": { fdvToTvl: 0.48, fdvToFees: 13.5, tvlWeight: 0.60, floatPct: 0.18, airdropPct: 0.07 },
  RWA: { fdvToTvl: 0.65, fdvToFees: 22.0, tvlWeight: 0.74, floatPct: 0.14, airdropPct: 0.055 },
  "Prediction Market": { fdvToTvl: 2.60, fdvToFees: 20.0, tvlWeight: 0.42, floatPct: 0.16, airdropPct: 0.08 },
  Launchpad: { fdvToTvl: 1.80, fdvToFees: 13.0, tvlWeight: 0.38, floatPct: 0.19, airdropPct: 0.07 },
  "DEX Aggregator": { fdvToTvl: 2.20, fdvToFees: 15.0, tvlWeight: 0.30, floatPct: 0.18, airdropPct: 0.08 },
  Options: { fdvToTvl: 1.65, fdvToFees: 16.0, tvlWeight: 0.45, floatPct: 0.17, airdropPct: 0.075 },
  "Basis Trading": { fdvToTvl: 0.62, fdvToFees: 16.0, tvlWeight: 0.64, floatPct: 0.15, airdropPct: 0.075 },
  Staking: { fdvToTvl: 0.40, fdvToFees: 15.0, tvlWeight: 0.68, floatPct: 0.16, airdropPct: 0.06 },
  Privacy: { fdvToTvl: 1.30, fdvToFees: 18.0, tvlWeight: 0.65, floatPct: 0.15, airdropPct: 0.07 },
  Payments: { fdvToTvl: 1.50, fdvToFees: 19.0, tvlWeight: 0.50, floatPct: 0.16, airdropPct: 0.065 },
  Synthetics: { fdvToTvl: 0.90, fdvToFees: 16.0, tvlWeight: 0.58, floatPct: 0.17, airdropPct: 0.07 },
  NFT: { fdvToTvl: 1.40, fdvToFees: 14.0, tvlWeight: 0.45, floatPct: 0.18, airdropPct: 0.08 },
  "NFT Marketplace": { fdvToTvl: 1.85, fdvToFees: 14.0, tvlWeight: 0.40, floatPct: 0.18, airdropPct: 0.085 },
  Gaming: { fdvToTvl: 1.75, fdvToFees: 18.0, tvlWeight: 0.55, floatPct: 0.16, airdropPct: 0.075 },
  Farm: { fdvToTvl: 0.35, fdvToFees: 10.0, tvlWeight: 0.64, floatPct: 0.20, airdropPct: 0.07 },
  "Algo-Stables": { fdvToTvl: 0.55, fdvToFees: 15.0, tvlWeight: 0.66, floatPct: 0.16, airdropPct: 0.06 },
  Insurance: { fdvToTvl: 0.70, fdvToFees: 18.0, tvlWeight: 0.65, floatPct: 0.17, airdropPct: 0.06 },
  "Onchain Capital Allocator": { fdvToTvl: 0.52, fdvToFees: 15.0, tvlWeight: 0.64, floatPct: 0.16, airdropPct: 0.065 },
};

const CATEGORY_ALIASES: Record<string, string> = {
  dexs: "Dexes",
  dex: "Dexes",
  "spot dex": "Dexes",
  perps: "Derivatives",
  "perpetuals": "Derivatives",
  bridges: "Bridge",
  "cross chain bridge": "Bridge",
  "money market": "Lending",
  "liquid-staking": "Liquid Staking",
  "liquid-restaking": "Liquid Restaking",
  "prediction markets": "Prediction Market",
};

const ECOSYSTEM_TIER: Record<string, number> = {
  ethereum: 1.0,
  solana: 0.95,
  arbitrum: 0.85,
  base: 0.85,
  hyperliquid: 0.85,
  bsc: 0.75,
  sui: 0.75,
  optimism: 0.7,
  avalanche: 0.65,
  polygon: 0.65,
  berachain: 0.65,
  aptos: 0.6,
  ton: 0.6,
  sonic: 0.55,
  monad: 0.65,
  scroll: 0.5,
  linea: 0.55,
  starknet: 0.55,
  zksync: 0.55,
  "zksync era": 0.55,
  mantle: 0.5,
  tron: 0.55,
  bitcoin: 0.8,
};

const EXCLUDED_CHAIN_KEYS = new Set([
  "staking",
  "borrowed",
  "pool2",
  "treasury",
  "vesting",
  "offers",
  "doublecounted",
  "liquidstaking",
  "dcandlsoverlap",
]);

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function normalizeCategory(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "DeFi";
  const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  for (const key of Object.keys(CATEGORY_PRIORS)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return key;
  }
  return trimmed;
}

function isRealChainKey(key: string): boolean {
  const lower = key.toLowerCase().trim();
  if (!lower || EXCLUDED_CHAIN_KEYS.has(lower)) return false;
  if (
    lower.endsWith("-borrowed") ||
    lower.endsWith("-staking") ||
    lower.endsWith("-pool2") ||
    lower.endsWith("-treasury") ||
    lower.endsWith("-vesting") ||
    lower.endsWith("-offers")
  ) {
    return false;
  }
  return true;
}

export function extractAnnualizedFees(p: ProtocolSnapshot): number {
  const ann = safeNum(p.annualizedFees, 0);
  if (ann > 0) return ann;
  const f1y = safeNum(p.fees1y, 0);
  if (f1y > 0) return f1y;
  const f30 = safeNum(p.fees30d, 0);
  if (f30 > 0) return f30 * 12;
  const f7 = safeNum(p.fees7d, 0);
  if (f7 > 0) return f7 * 52;
  const f24 = safeNum(p.fees24h, 0);
  if (f24 > 0) return f24 * 365;
  return extractAnnualizedRevenue(p);
}

export function extractAnnualizedRevenue(p: ProtocolSnapshot): number {
  const ann = safeNum(p.annualizedRevenue, 0);
  if (ann > 0) return ann;
  const r30 = safeNum(p.revenue30d, 0);
  if (r30 > 0) return r30 * 12;
  const r24 = safeNum(p.revenue24h, 0);
  if (r24 > 0) return r24 * 365;
  return 0;
}

export function extractAnnualizedVolume(p: ProtocolSnapshot): number {
  const ann = safeNum(p.annualizedVolume, 0);
  if (ann > 0) return ann;
  const v30 = safeNum(p.volume30d, 0);
  if (v30 > 0) return v30 * 12;
  const v24 = safeNum(p.volume24h, 0);
  if (v24 > 0) return v24 * 365;
  return 0;
}

function analyzeChainFootprint(p: ProtocolSnapshot): {
  activeChains: string[];
  effectiveChains: number;
  ecosystemBonus: number;
} {
  const tvlMap: Array<[string, number]> = [];
  if (p.chainTvls && typeof p.chainTvls === "object") {
    for (const [k, v] of Object.entries(p.chainTvls)) {
      const val = safeNum(v, 0);
      if (val > 10_000 && isRealChainKey(k)) {
        tvlMap.push([k, val]);
      }
    }
  }

  let activeChains: string[];
  let effectiveChains = 1;

  if (tvlMap.length > 0) {
    tvlMap.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const total = tvlMap.reduce((sum, [, val]) => sum + val, 0);
    activeChains = tvlMap.map(([name]) => name);
    if (total > 0) {
      let hhi = 0;
      for (const [, val] of tvlMap) {
        const share = val / total;
        hhi += share * share;
      }
      effectiveChains = hhi > 0 ? 1 / hhi : 1;
    }
  } else {
    const rawChains = Array.isArray(p.chains) ? p.chains : [];
    activeChains = [...new Set(rawChains.filter((c) => typeof c === "string" && isRealChainKey(c)))];
    activeChains.sort((a, b) => a.localeCompare(b));
    effectiveChains = Math.max(1, activeChains.length * 0.72);
  }

  let tierScore = 0;
  for (const chain of activeChains) {
    const w = ECOSYSTEM_TIER[chain.toLowerCase()];
    if (w) tierScore += w;
  }
  const ecosystemBonus = clamp(tierScore * 0.032, 0, 0.085);
  return {
    activeChains,
    effectiveChains: round2(Math.max(1, effectiveChains)),
    ecosystemBonus,
  };
}

function getPeerMarketFdv(p: ProtocolSnapshot): number {
  const fdv = safeNum(p.fdv, 0);
  if (fdv > 0) return fdv;
  const mcap = safeNum(p.mcap, 0);
  return mcap > 0 ? mcap : 0;
}

function summarizeCategory(
  category: string,
  peers: readonly PeerReference[],
  globalFallback: CategoryPrior
): CategoryBenchmark {
  const prior = CATEGORY_PRIORS[category] ?? globalFallback;
  const tvlMults = peers.map((x) => x.fdvToTvl).filter((x) => x > 0).sort((a, b) => a - b);
  const feeMults = peers
    .map((x) => x.fdvToFees)
    .filter((x): x is number => x !== null && x > 0)
    .sort((a, b) => a - b);

  const empTvl = tvlMults.length > 0 ? quantile(tvlMults, 0.5) : prior.fdvToTvl;
  const tvlShrink = tvlMults.length / (tvlMults.length + 4);
  const blendedTvl = tvlShrink * empTvl + (1 - tvlShrink) * prior.fdvToTvl;

  const empFee = feeMults.length > 0 ? quantile(feeMults, 0.5) : prior.fdvToFees;
  const feeShrink = feeMults.length / (feeMults.length + 4);
  const blendedFee = feeShrink * empFee + (1 - feeShrink) * prior.fdvToFees;

  const sortedPeers = [...peers].sort(
    (a, b) => b.fdv - a.fdv || b.tvl - a.tvl || a.slug.localeCompare(b.slug)
  );

  return {
    category,
    peerCount: tvlMults.length,
    feePeerCount: feeMults.length,
    fdvToTvl: round2(clamp(blendedTvl, 0.15, 6.0)),
    fdvToTvlP25: round2(tvlMults.length >= 3 ? quantile(tvlMults, 0.25) : blendedTvl * 0.65),
    fdvToTvlP75: round2(tvlMults.length >= 3 ? quantile(tvlMults, 0.75) : blendedTvl * 1.45),
    fdvToFees: round2(clamp(blendedFee, 4.0, 45.0)),
    fdvToFeesP25: round2(feeMults.length >= 3 ? quantile(feeMults, 0.25) : blendedFee * 0.65),
    fdvToFeesP75: round2(feeMults.length >= 3 ? quantile(feeMults, 0.75) : blendedFee * 1.45),
    tvlWeight: prior.tvlWeight,
    typicalFloatPct: prior.floatPct,
    typicalAirdropPct: prior.airdropPct,
    topPeers: sortedPeers.slice(0, 5),
  };
}

export function buildCategoryBenchmarks(allProtocols: readonly ProtocolSnapshot[]): BenchmarkSet {
  const allPeers: PeerReference[] = [];
  const grouped = new Map<string, PeerReference[]>();

  for (const p of allProtocols) {
    const fdv = getPeerMarketFdv(p);
    const tvl = safeNum(p.tvl, 0);
    if (fdv < 2_000_000 || tvl < 500_000) continue;

    const fdvToTvl = fdv / tvl;
    if (fdvToTvl < 0.04 || fdvToTvl > 25) continue;

    const annFees = extractAnnualizedFees(p);
    let fdvToFees: number | null = null;
    if (annFees >= 50_000) {
      const ratio = fdv / annFees;
      if (ratio >= 1.5 && ratio <= 120) {
        fdvToFees = round2(ratio);
      }
    }

    const cat = normalizeCategory(p.category);
    const ref: PeerReference = {
      slug: p.slug,
      name: p.name,
      symbol: (p.symbol ?? "").trim(),
      tvl: Math.round(tvl),
      fdv: Math.round(fdv),
      fdvToTvl: round2(fdvToTvl),
      fdvToFees,
    };

    allPeers.push(ref);
    const bucket = grouped.get(cat);
    if (bucket) bucket.push(ref);
    else grouped.set(cat, [ref]);
  }

  const global = summarizeCategory("Global", allPeers, DEFAULT_PRIOR);
  const globalPrior: CategoryPrior = {
    fdvToTvl: global.fdvToTvl,
    fdvToFees: global.fdvToFees,
    tvlWeight: DEFAULT_PRIOR.tvlWeight,
    floatPct: DEFAULT_PRIOR.floatPct,
    airdropPct: DEFAULT_PRIOR.airdropPct,
  };

  const byCategory: Record<string, CategoryBenchmark> = {};
  const categoryNames = new Set([...Object.keys(CATEGORY_PRIORS), ...grouped.keys()]);
  for (const cat of [...categoryNames].sort((a, b) => a.localeCompare(b))) {
    byCategory[cat] = summarizeCategory(cat, grouped.get(cat) ?? [], globalPrior);
  }

  return {
    global,
    byCategory,
    tokenizedPeerCount: allPeers.length,
  };
}

export function estimateProtocolValuation(
  protocol: ProtocolSnapshot,
  benchmarks: BenchmarkSet
): ProtocolValuation {
  const category = normalizeCategory(protocol.category);
  const bench = benchmarks.byCategory[category] ?? benchmarks.global;

  const tvl = Math.max(0, safeNum(protocol.tvl, 0));
  const annFees = extractAnnualizedFees(protocol);
  const annRev = extractAnnualizedRevenue(protocol);
  const annVol = extractAnnualizedVolume(protocol);
  const totalRaised = Math.max(0, safeNum(protocol.totalRaised, 0));

  const scaleFactor =
    tvl > 0 ? clamp(Math.pow(100_000_000 / Math.max(tvl, 5_000_000), 0.14), 0.56, 1.38) : 1.0;

  const tvlAnchor = tvl > 0 ? tvl * bench.fdvToTvl * scaleFactor : 0;
  const feeAnchor = annFees > 0 ? annFees * bench.fdvToFees : 0;
  const volAnchor =
    annVol > 0 ? clamp(annVol * 0.012, 0, Math.max(tvlAnchor * 3.5, 4_000_000_000)) : 0;
  const fundingAnchor = totalRaised > 0 ? totalRaised * 5.0 : 0;

  let weightedSum = 0;
  let weightTotal = 0;

  if (tvlAnchor > 0) {
    const w = feeAnchor > 0 ? bench.tvlWeight : 0.85;
    weightedSum += tvlAnchor * w;
    weightTotal += w;
  }
  if (feeAnchor > 0) {
    const w = tvlAnchor > 0 ? 1 - bench.tvlWeight : 0.85;
    weightedSum += feeAnchor * w;
    weightTotal += w;
  }
  if (volAnchor > 0) {
    const w = 0.15;
    weightedSum += volAnchor * w;
    weightTotal += w;
  }
  if (fundingAnchor > 0) {
    const w = tvlAnchor > 0 || feeAnchor > 0 ? 0.12 : 0.75;
    weightedSum += fundingAnchor * w;
    weightTotal += w;
  }

  const baseFdv = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const c7 = clamp(safeNum(protocol.change_7d, 0), -75, 250);
  const c30 = clamp(safeNum(protocol.change_1m, 0), -85, 500);
  const blendedGrowth = 0.35 * c7 + 0.65 * c30;
  const momentumMultiplier = clamp(1 + Math.tanh(blendedGrowth / 65) * 0.3, 0.78, 1.35);

  const footprint = analyzeChainFootprint(protocol);
  const multiChainLift = Math.min(0.18, Math.log2(footprint.effectiveChains) * 0.065);
  const chainBreadthMultiplier = clamp(0.95 + multiChainLift + footprint.ecosystemBonus, 0.95, 1.24);

  let capitalEfficiencyMultiplier = 1.0;
  if (annFees > 0 && tvl > 100_000) {
    const feeYield = annFees / tvl;
    const effShift = Math.tanh(Math.log10(Math.max(feeYield, 0.001) / 0.025)) * 0.14;
    capitalEfficiencyMultiplier = clamp(1 + effShift, 0.9, 1.18);
  }

  const auditCount =
    (Array.isArray(protocol.audit_links) ? protocol.audit_links.length : 0) +
    (safeNum(protocol.audits, 0) > 0 ? 1 : 0);
  const maturityMultiplier = clamp(
    0.96 + (auditCount > 0 ? 0.05 : 0) + (tvl >= 50_000_000 ? 0.05 : tvl >= 10_000_000 ? 0.02 : 0),
    0.95,
    1.08
  );

  const totalMultiplier = clamp(
    momentumMultiplier * chainBreadthMultiplier * capitalEfficiencyMultiplier * maturityMultiplier,
    0.72,
    1.62
  );

  const impliedFdv = baseFdv > 0 ? Math.max(1_000_000, Math.round(baseFdv * totalMultiplier)) : 0;

  let confidenceScore = 30;
  if (tvl >= 10_000_000) confidenceScore += 22;
  else if (tvl >= 1_000_000) confidenceScore += 12;
  if (annFees >= 100_000) confidenceScore += 20;
  if (bench.peerCount >= 8) confidenceScore += 14;
  else if (bench.peerCount >= 3) confidenceScore += 8;
  if (auditCount > 0) confidenceScore += 7;
  if (protocol.change_1m !== null && protocol.change_1m !== undefined) confidenceScore += 7;
  confidenceScore = clamp(Math.round(confidenceScore), 15, 98);

  const confidence: "high" | "medium" | "low" =
    confidenceScore >= 72 ? "high" : confidenceScore >= 48 ? "medium" : "low";

  const spread = confidence === "high" ? 0.28 : confidence === "medium" ? 0.36 : 0.45;
  const fdvLow = Math.round(impliedFdv * (1 - spread));
  const fdvHigh = Math.round(impliedFdv * (1 + spread * 1.35));
  const impliedInitialMcap = Math.round(impliedFdv * bench.typicalFloatPct);
  const estimatedAirdropPoolUsd = Math.round(impliedFdv * bench.typicalAirdropPct);
  const impliedAirdropYieldPct =
    tvl > 0 ? round2(clamp((estimatedAirdropPoolUsd / tvl) * 100, 0, 250)) : 0;

  const valScore =
    impliedFdv > 0 ? clamp(((Math.log10(impliedFdv) - 6.3) / (10.1 - 6.3)) * 100, 0, 100) : 0;
  const tvlDepthScore = tvl > 0 ? clamp(((Math.log10(tvl) - 5.7) / (10.0 - 5.7)) * 100, 0, 100) : 0;
  const feeQualityScore =
    annFees > 0 ? clamp(((Math.log10(annFees) - 4.5) / (8.7 - 4.5)) * 100, 0, 100) : tvlDepthScore * 0.55;
  const fundamentalScore = round2(
    clamp(0.55 * tvlDepthScore + 0.35 * feeQualityScore + (auditCount > 0 ? 10 : 0), 0, 100)
  );
  const momentumScore = round2(clamp(50 + Math.tanh(blendedGrowth / 55) * 48, 2, 98));
  const chainBreadthScore = round2(
    clamp(
      22 + Math.log2(footprint.effectiveChains) * 24 + footprint.ecosystemBonus * 320,
      10,
      100
    )
  );
  const launchScore = round2(
    clamp(
      0.46 * valScore + 0.24 * fundamentalScore + 0.16 * momentumScore + 0.14 * chainBreadthScore,
      0,
      100
    )
  );

  const valuationDrivers: string[] = [
    `${category} peer benchmark: ${bench.fdvToTvl}x FDV/TVL (${bench.peerCount} tokenized peers)`,
  ];
  if (annFees > 0) {
    valuationDrivers.push(
      `Annualized fee run-rate $${Math.round(annFees).toLocaleString("en-US")} at ${bench.fdvToFees}x peer multiple`
    );
  }
  if (blendedGrowth >= 15) {
    valuationDrivers.push(`Strong TVL momentum (${round2(blendedGrowth)}% blended 7d/30d growth)`);
  } else if (blendedGrowth <= -15) {
    valuationDrivers.push(`TVL contraction discount (${round2(blendedGrowth)}% blended 7d/30d trend)`);
  }
  if (footprint.activeChains.length >= 3) {
    valuationDrivers.push(
      `Multi-chain footprint across ${footprint.activeChains.length} chains (${footprint.effectiveChains} effective)`
    );
  } else if (footprint.activeChains.length > 0) {
    valuationDrivers.push(`Concentrated on ${footprint.activeChains.join(", ")}`);
  }

  return {
    slug: protocol.slug,
    name: protocol.name,
    category,
    tvl: Math.round(tvl),
    impliedFdv,
    fdvLow,
    fdvHigh,
    impliedInitialMcap,
    estimatedAirdropPoolUsd,
    impliedAirdropYieldPct,
    launchScore,
    fundamentalScore,
    momentumScore,
    chainBreadthScore,
    confidence,
    confidenceScore,
    breakdown: {
      tvlAnchorUsd: Math.round(tvlAnchor),
      feeAnchorUsd: Math.round(feeAnchor),
      volumeAnchorUsd: Math.round(volAnchor),
      fundingAnchorUsd: Math.round(fundingAnchor),
      baseFdvUsd: Math.round(baseFdv),
      peerFdvToTvl: bench.fdvToTvl,
      peerFdvToFees: bench.fdvToFees,
      scaleFactor: round2(scaleFactor),
      momentumMultiplier: round2(momentumMultiplier),
      chainBreadthMultiplier: round2(chainBreadthMultiplier),
      capitalEfficiencyMultiplier: round2(capitalEfficiencyMultiplier),
      maturityMultiplier: round2(maturityMultiplier),
      totalMultiplier: round2(totalMultiplier),
      effectiveChainCount: footprint.effectiveChains,
      activeChainCount: footprint.activeChains.length,
      annualizedFeesUsd: Math.round(annFees),
      annualizedRevenueUsd: Math.round(annRev),
      annualizedVolumeUsd: Math.round(annVol),
    },
    comparablePeers: bench.topPeers,
    valuationDrivers,
  };
}

export function rankProtocolsByValuation(
  candidates: readonly ProtocolSnapshot[],
  allProtocols: readonly ProtocolSnapshot[],
  options: ValuationOptions = {}
): RankedProtocolValuation[] {
  const benchmarks = options.benchmarks ?? buildCategoryBenchmarks(allProtocols);
  const sortBy = options.sortBy ?? "impliedFdv";

  const evaluated = candidates.map((p) => estimateProtocolValuation(p, benchmarks));
  evaluated.sort((a, b) => {
    const primary =
      sortBy === "launchScore" ? b.launchScore - a.launchScore : b.impliedFdv - a.impliedFdv;
    if (primary !== 0) return primary;
    if (b.impliedFdv !== a.impliedFdv) return b.impliedFdv - a.impliedFdv;
    if (b.launchScore !== a.launchScore) return b.launchScore - a.launchScore;
    if (b.tvl !== a.tvl) return b.tvl - a.tvl;
    return a.slug.localeCompare(b.slug);
  });

  const total = evaluated.length;
  return evaluated.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    percentile: total > 1 ? round2(((total - 1 - idx) / (total - 1)) * 100) : 100,
  }));
}