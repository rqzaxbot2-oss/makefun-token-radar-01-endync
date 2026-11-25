export interface ValuationProtocolInput {
  slug: string;
  name: string;
  category?: string | null;
  tvl?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  chains?: string[] | null;
  chainTvls?: Record<string, number> | null;
  audits?: string | number | null;
  listedAt?: number | null;
  description?: string | null;
  twitter?: string | null;
  url?: string | null;
  fees24h?: number | null;
  fees30d?: number | null;
  revenue24h?: number | null;
  revenue30d?: number | null;
  volume24h?: number | null;
  volume30d?: number | null;
  raisesTotalUsd?: number | null;
  symbol?: string | null;
  gecko_id?: string | null;
}

export interface CategoryBenchmark {
  category: string;
  peerCount: number;
  empiricalMedian: number;
  priorMultiple: number;
  blendedMultiple: number;
  p25Multiple: number;
  p75Multiple: number;
  revMultiple: number;
}

export interface BenchmarkTable {
  globalMedian: number;
  totalPeers: number;
  byCategory: Record<string, CategoryBenchmark>;
}

export interface ValuationBreakdown {
  baseMultiple: number;
  peerMultiple: number;
  peerCount: number;
  scaleAdjustment: number;
  momentumFactor: number;
  chainFactor: number;
  revenueBlendWeight: number;
  revenueImpliedFdv: number | null;
  tvlImpliedFdv: number;
  effectiveChains: number;
  chainDiversityHhi: number;
  topChain: string;
  topChainShare: number;
  ageMonths: number | null;
}

export interface ValuationResult {
  impliedFdv: number;
  fdvLow: number;
  fdvHigh: number;
  impliedMultiple: number;
  estimatedAirdropPct: number;
  estimatedAirdropUsd: number;
  estRewardPer10kUsd: number;
  radarScore: number;
  readinessScore: number;
  momentumScore: number;
  chainScore: number;
  confidenceScore: number;
  confidenceTier: "High" | "Medium" | "Low";
  launchHorizon: "Imminent (0-3m)" | "Near-Term (3-6m)" | "Mid-Term (6-12m)" | "Speculative (12m+)";
  breakdown: ValuationBreakdown;
  signals: string[];
}

const CATEGORY_PRIORS: Record<string, { fdvTvl: number; rev: number; airdropPct: number }> = {
  "derivatives": { fdvTvl: 3.1, rev: 18, airdropPct: 0.08 },
  "perps": { fdvTvl: 3.2, rev: 18, airdropPct: 0.08 },
  "dexs": { fdvTvl: 1.65, rev: 15, airdropPct: 0.07 },
  "dexes": { fdvTvl: 1.65, rev: 15, airdropPct: 0.07 },
  "lending": { fdvTvl: 0.52, rev: 14, airdropPct: 0.06 },
  "cdp": { fdvTvl: 0.48, rev: 13, airdropPct: 0.06 },
  "liquid staking": { fdvTvl: 0.34, rev: 12, airdropPct: 0.05 },
  "liquid restaking": { fdvTvl: 0.42, rev: 14, airdropPct: 0.07 },
  "restaking": { fdvTvl: 0.55, rev: 15, airdropPct: 0.07 },
  "bridge": { fdvTvl: 1.45, rev: 16, airdropPct: 0.07 },
  "cross chain": { fdvTvl: 1.55, rev: 16, airdropPct: 0.07 },
  "cross chain bridge": { fdvTvl: 1.45, rev: 16, airdropPct: 0.07 },
  "yield": { fdvTvl: 0.62, rev: 12, airdropPct: 0.06 },
  "yield aggregator": { fdvTvl: 0.68, rev: 12, airdropPct: 0.06 },
  "rwa": { fdvTvl: 0.75, rev: 16, airdropPct: 0.05 },
  "rwa lending": { fdvTvl: 0.7, rev: 15, airdropPct: 0.05 },
  "basis trading": { fdvTvl: 0.85, rev: 14, airdropPct: 0.07 },
  "options": { fdvTvl: 2.2, rev: 16, airdropPct: 0.07 },
  "prediction market": { fdvTvl: 3.4, rev: 22, airdropPct: 0.08 },
  "launchpad": { fdvTvl: 2.1, rev: 16, airdropPct: 0.07 },
  "synthetics": { fdvTvl: 1.3, rev: 14, airdropPct: 0.06 },
  "privacy": { fdvTvl: 1.7, rev: 15, airdropPct: 0.06 },
  "nft marketplace": { fdvTvl: 2.6, rev: 16, airdropPct: 0.08 },
  "nft lending": { fdvTvl: 1.4, rev: 14, airdropPct: 0.07 },
  "leveraged farming": { fdvTvl: 0.85, rev: 13, airdropPct: 0.07 },
  "farm": { fdvTvl: 0.72, rev: 11, airdropPct: 0.06 },
  "indexes": { fdvTvl: 0.8, rev: 12, airdropPct: 0.06 },
  "gaming": { fdvTvl: 2.4, rev: 18, airdropPct: 0.08 },
  "socialfi": { fdvTvl: 2.8, rev: 18, airdropPct: 0.08 },
  "ai": { fdvTvl: 2.9, rev: 20, airdropPct: 0.08 },
  "payments": { fdvTvl: 1.6, rev: 16, airdropPct: 0.06 },
  "staking pool": { fdvTvl: 0.38, rev: 12, airdropPct: 0.05 },
  "chain": { fdvTvl: 2.5, rev: 20, airdropPct: 0.08 },
  "rollup": { fdvTvl: 2.3, rev: 18, airdropPct: 0.08 },
};

const TIER1_CHAINS = new Set([
  "ethereum", "solana", "arbitrum", "base", "optimism", "hyperliquid",
  "sui", "berachain", "starknet", "monad", "sonic", "aptos", "avalanche",
  "polygon", "bsc", "bnb", "ton", "linea", "scroll", "zksync era", "blast",
]);

const SYNTHETIC_TVL_KEYS = new Set([
  "borrowed", "staking", "pool2", "vesting", "offers", "treasury",
  "doublecounted", "liquidstaking", "govtokens", "dcandlsoverlap",
]);

function isFinitePos(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function round(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function normCategory(cat?: string | null): string {
  return (cat ?? "defi").trim().toLowerCase();
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = clamp(q, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const weight = pos - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function getPrior(catKey: string): { fdvTvl: number; rev: number; airdropPct: number } {
  if (CATEGORY_PRIORS[catKey]) return CATEGORY_PRIORS[catKey];
  for (const [k, v] of Object.entries(CATEGORY_PRIORS)) {
    if (catKey.includes(k) || k.includes(catKey)) return v;
  }
  return { fdvTvl: 0.95, rev: 14, airdropPct: 0.065 };
}

export function buildCategoryBenchmarks(allProtocols: ValuationProtocolInput[]): BenchmarkTable {
  const globalRatios: number[] = [];
  const catBuckets = new Map<string, number[]>();

  for (const p of allProtocols) {
    if (!isFinitePos(p.tvl) || p.tvl < 1_000_000) continue;
    let peerFdv = 0;
    if (isFinitePos(p.fdv)) {
      peerFdv = p.fdv;
    } else if (isFinitePos(p.mcap)) {
      peerFdv = p.mcap * 1.38;
    }
    if (peerFdv < 1_000_000) continue;

    const ratio = peerFdv / p.tvl;
    if (ratio < 0.04 || ratio > 18) continue;

    globalRatios.push(ratio);
    const key = normCategory(p.category);
    const list = catBuckets.get(key);
    if (list) list.push(ratio);
    else catBuckets.set(key, [ratio]);
  }

  globalRatios.sort((a, b) => a - b);
  const globalMedian = globalRatios.length >= 5 ? quantile(globalRatios, 0.5) : 0.92;
  const byCategory: Record<string, CategoryBenchmark> = {};

  const allKeys = new Set<string>([...Object.keys(CATEGORY_PRIORS), ...catBuckets.keys()]);
  const sortedKeys = Array.from(allKeys).sort();

  for (const key of sortedKeys) {
    const ratios = (catBuckets.get(key) ?? []).slice().sort((a, b) => a - b);
    const prior = getPrior(key);
    const n = ratios.length;
    const empMed = n > 0 ? quantile(ratios, 0.5) : prior.fdvTvl;
    const shrinkage = n / (n + 6);
    const blended = clamp(shrinkage * empMed + (1 - shrinkage) * prior.fdvTvl, 0.18, 6.5);
    const p25 = n >= 4 ? clamp(quantile(ratios, 0.25), 0.1, blended) : blended * 0.62;
    const p75 = n >= 4 ? clamp(quantile(ratios, 0.75), blended, 10) : blended * 1.55;

    byCategory[key] = {
      category: key,
      peerCount: n,
      empiricalMedian: round(empMed, 3),
      priorMultiple: round(prior.fdvTvl, 3),
      blendedMultiple: round(blended, 3),
      p25Multiple: round(p25, 3),
      p75Multiple: round(p75, 3),
      revMultiple: prior.rev,
    };
  }

  return {
    globalMedian: round(globalMedian, 3),
    totalPeers: globalRatios.length,
    byCategory,
  };
}

function extractRealChainTvls(p: ValuationProtocolInput): Array<{ chain: string; tvl: number }> {
  const entries: Array<{ chain: string; tvl: number }> = [];
  if (p.chainTvls && typeof p.chainTvls === "object") {
    for (const [rawKey, rawVal] of Object.entries(p.chainTvls)) {
      const lower = rawKey.toLowerCase();
      if (SYNTHETIC_TVL_KEYS.has(lower) || lower.includes("-")) continue;
      if (isFinitePos(rawVal)) {
        entries.push({ chain: rawKey, tvl: rawVal });
      }
    }
  }
  if (entries.length === 0 && Array.isArray(p.chains) && p.chains.length > 0 && isFinitePos(p.tvl)) {
    const share = p.tvl / p.chains.length;
    for (const c of p.chains) {
      if (c && typeof c === "string") entries.push({ chain: c, tvl: share });
    }
  }
  entries.sort((a, b) => b.tvl - a.tvl || a.chain.localeCompare(b.chain));
  return entries;
}

function computeMomentum(p: ValuationProtocolInput): { score: number; factor: number; signals: string[] } {
  const c1d = typeof p.change_1d === "number" && Number.isFinite(p.change_1d) ? clamp(p.change_1d, -35, 65) : null;
  const c7d = typeof p.change_7d === "number" && Number.isFinite(p.change_7d) ? clamp(p.change_7d, -55, 160) : null;
  const c1m = typeof p.change_1m === "number" && Number.isFinite(p.change_1m) ? clamp(p.change_1m, -75, 320) : null;

  let weighted = 0;
  let totalW = 0;
  if (c1d !== null) {
    weighted += (c1d / 20) * 0.15;
    totalW += 0.15;
  }
  if (c7d !== null) {
    weighted += (c7d / 35) * 0.35;
    totalW += 0.35;
  }
  if (c1m !== null) {
    weighted += (c1m / 75) * 0.5;
    totalW += 0.5;
  }

  const composite = totalW > 0 ? weighted / totalW : 0;
  const score = clamp(50 + composite * 28, 5, 98);
  const factor = clamp(1 + composite * 0.18, 0.74, 1.42);
  const signals: string[] = [];

  if (c1m !== null && c1m >= 35) signals.push(`Strong 30d TVL expansion (+${round(c1m, 1)}%)`);
  else if (c7d !== null && c7d >= 15) signals.push(`Accelerating 7d inflows (+${round(c7d, 1)}%)`);
  else if (c1m !== null && c1m <= -25) signals.push(`30d TVL contraction (${round(c1m, 1)}%)`);

  return { score: round(score, 1), factor: round(factor, 3), signals };
}

function computeChainMetrics(p: ValuationProtocolInput): {
  score: number;
  factor: number;
  effectiveChains: number;
  hhi: number;
  topChain: string;
  topChainShare: number;
  signals: string[];
} {
  const real = extractRealChainTvls(p);
  if (real.length === 0) {
    return { score: 35, factor: 0.92, effectiveChains: 1, hhi: 1, topChain: "Unknown", topChainShare: 1, signals: [] };
  }

  const total = real.reduce((s, x) => s + x.tvl, 0);
  const active = real.filter((x) => x.tvl >= total * 0.01 || x.tvl >= 500_000);
  const count = Math.max(1, active.length);
  let hhi = 0;
  let tier1Share = 0;

  for (const item of real) {
    const w = total > 0 ? item.tvl / total : 0;
    hhi += w * w;
    if (TIER1_CHAINS.has(item.chain.toLowerCase())) tier1Share += w;
  }

  const effChains = hhi > 0 ? 1 / hhi : 1;
  const breadthPts = Math.min(35, Math.log2(count + 1) * 14);
  const diversityPts = Math.min(25, (effChains - 1) * 12);
  const qualityPts = tier1Share * 40;
  const score = clamp(15 + breadthPts + diversityPts + qualityPts, 15, 98);
  const factor = clamp(0.88 + (score - 45) * 0.006, 0.85, 1.24);

  const signals: string[] = [];
  if (count >= 4) signals.push(`Multi-chain footprint across ${count} active networks`);
  if (tier1Share >= 0.85) signals.push(`Tier-1 liquidity anchored on ${real[0].chain}`);

  return {
    score: round(score, 1),
    factor: round(factor, 3),
    effectiveChains: round(effChains, 2),
    hhi: round(hhi, 3),
    topChain: real[0].chain,
    topChainShare: round(total > 0 ? real[0].tvl / total : 1, 3),
    signals,
  };
}

function normalizeListedAtSec(listedAt?: number | null): number | null {
  if (typeof listedAt !== "number" || !Number.isFinite(listedAt) || listedAt <= 0) return null;
  return listedAt > 10_000_000_000 ? Math.floor(listedAt / 1000) : Math.floor(listedAt);
}

export function evaluateProtocol(
  p: ValuationProtocolInput,
  benchmarks: BenchmarkTable,
  snapshotEpochSec = 1_743_465_600
): ValuationResult {
  const tvl = isFinitePos(p.tvl) ? p.tvl : 0;
  const catKey = normCategory(p.category);
  const prior = getPrior(catKey);
  const bench = benchmarks.byCategory[catKey] ?? {
    category: catKey,
    peerCount: 0,
    empiricalMedian: benchmarks.globalMedian,
    priorMultiple: prior.fdvTvl,
    blendedMultiple: clamp((benchmarks.globalMedian + prior.fdvTvl) / 2, 0.25, 4.5),
    p25Multiple: prior.fdvTvl * 0.6,
    p75Multiple: prior.fdvTvl * 1.5,
    revMultiple: prior.rev,
  };

  // Gentle economies-of-scale curve anchored at $100M TVL
  const tvlSafe = Math.max(tvl, 100_000);
  const scaleAdjustment = clamp(Math.pow(tvlSafe / 100_000_000, -0.09), 0.62, 1.32);

  const mom = computeMomentum(p);
  const ch = computeChainMetrics(p);
  const signals: string[] = [...mom.signals, ...ch.signals];

  const baseMultiple = bench.blendedMultiple;
  const effectiveMultiple = clamp(baseMultiple * scaleAdjustment * mom.factor * ch.factor, 0.14, 7.5);
  const tvlImpliedFdv = tvl * effectiveMultiple;

  // Optional revenue-based valuation cross-check if snapshot includes fee/revenue metrics
  let annualizedRev: number | null = null;
  if (isFinitePos(p.revenue30d)) annualizedRev = p.revenue30d * 12;
  else if (isFinitePos(p.revenue24h)) annualizedRev = p.revenue24h * 365;
  else if (isFinitePos(p.fees30d)) annualizedRev = p.fees30d * 12 * 0.28;
  else if (isFinitePos(p.fees24h)) annualizedRev = p.fees24h * 365 * 0.28;

  let revenueImpliedFdv: number | null = null;
  let revenueBlendWeight = 0;
  if (annualizedRev !== null && annualizedRev >= 150_000) {
    revenueImpliedFdv = annualizedRev * bench.revMultiple * clamp(mom.factor, 0.85, 1.25);
    revenueBlendWeight = isFinitePos(p.revenue30d) || isFinitePos(p.revenue24h) ? 0.35 : 0.2;
    signals.push(`Fee/revenue run-rate supports ~$${Math.round(revenueImpliedFdv / 1_000_000)}M valuation`);
  }

  let impliedFdv =
    revenueImpliedFdv !== null
      ? tvlImpliedFdv * (1 - revenueBlendWeight) + revenueImpliedFdv * revenueBlendWeight
      : tvlImpliedFdv;

  if (isFinitePos(p.raisesTotalUsd)) {
    const raiseFloor = p.raisesTotalUsd * 4.5;
    if (raiseFloor > impliedFdv) {
      impliedFdv = impliedFdv * 0.65 + raiseFloor * 0.35;
      signals.push(`Venture funding floor ($${round(p.raisesTotalUsd / 1_000_000, 1)}M raised)`);
    }
  }

  impliedFdv = Math.max(impliedFdv, tvl * 0.12);

  // Tenure & launch readiness
  const listedSec = normalizeListedAtSec(p.listedAt);
  const ageMonths =
    listedSec !== null && snapshotEpochSec >= listedSec
      ? round((snapshotEpochSec - listedSec) / (30.4375 * 86400), 1)
      : null;

  const tvlScalePts = clamp((Math.log10(Math.max(tvl, 100_000)) - 5.5) * 11, 0, 38);
  let agePts = 12;
  if (ageMonths !== null) {
    if (ageMonths >= 4 && ageMonths <= 26) agePts = 22;
    else if (ageMonths > 26 && ageMonths <= 42) agePts = 14;
    else if (ageMonths > 42) agePts = 7;
    else agePts = 10;
  }

  const hasAudit = p.audits !== null && p.audits !== undefined && String(p.audits) !== "0" && String(p.audits).trim() !== "";
  const auditPts = hasAudit ? 10 : 0;
  if (hasAudit) signals.push("Audited smart contract suite");

  const socialPts = (p.twitter ? 5 : 0) + (p.url ? 3 : 0);
  const desc = (p.description ?? "").toLowerCase();
  const hasPointsSignal = /\b(points?|season\s*\d|airdrop|epochs?|xp|rewards?\s+program|incentive)\b/i.test(desc);
  const pointsPts = hasPointsSignal ? 10 : 0;
  if (hasPointsSignal) signals.push("Explicit points/season incentive language detected");

  const momReadinessPts = clamp((mom.score - 35) * 0.2, 0, 12);
  const readinessScore = round(clamp(tvlScalePts + agePts + auditPts + socialPts + pointsPts + momReadinessPts, 10, 99), 1);

  // Confidence band width & score
  const peerDepthPts = Math.min(35, bench.peerCount * 2.2);
  const tvlDepthPts = clamp((Math.log10(Math.max(tvl, 100_000)) - 5) * 9, 0, 30);
  const revPts = revenueImpliedFdv !== null ? 15 : 0;
  const stabilityPenalty =
    typeof p.change_7d === "number" && Number.isFinite(p.change_7d) && Math.abs(p.change_7d) > 85 ? 10 : 0;
  const confidenceScore = round(
    clamp(22 + peerDepthPts + tvlDepthPts + revPts + (hasAudit ? 8 : 0) - stabilityPenalty, 18, 96),
    1
  );
  const confidenceTier: "High" | "Medium" | "Low" =
    confidenceScore >= 72 ? "High" : confidenceScore >= 48 ? "Medium" : "Low";

  const halfSpread = clamp(0.56 - (confidenceScore / 100) * 0.34, 0.2, 0.55);
  const fdvLow = Math.round(impliedFdv * (1 - halfSpread));
  const fdvHigh = Math.round(impliedFdv * (1 + halfSpread * 1.18));
  const fdvMid = Math.round(impliedFdv);

  // Community airdrop economics
  const airdropScaleAdj = tvl >= 1_000_000_000 ? -0.01 : tvl <= 40_000_000 ? 0.01 : 0;
  const estimatedAirdropPct = round(clamp(prior.airdropPct + airdropScaleAdj, 0.04, 0.1), 3);
  const estimatedAirdropUsd = Math.round(fdvMid * estimatedAirdropPct);
  const estRewardPer10kUsd =
    tvl >= 500_000 ? Math.round(clamp((estimatedAirdropUsd / tvl) * 10_000, 10, 12_500)) : 0;

  // Composite radar score (0-100): balances launch size, readiness, momentum, chain quality, and confidence
  const fdvNorm = clamp((Math.log10(Math.max(fdvMid, 1_000_000)) - 6) * 24, 0, 100);
  const radarScore = round(
    clamp(
      fdvNorm * 0.44 + readinessScore * 0.24 + mom.score * 0.14 + ch.score * 0.1 + confidenceScore * 0.08,
      5,
      99.5
    ),
    1
  );

  const launchHorizon: ValuationResult["launchHorizon"] =
    readinessScore >= 76
      ? "Imminent (0-3m)"
      : readinessScore >= 58
        ? "Near-Term (3-6m)"
        : readinessScore >= 40
          ? "Mid-Term (6-12m)"
          : "Speculative (12m+)";

  if (bench.peerCount >= 5) {
    signals.push(`Calibrated vs ${bench.peerCount} tokenized ${p.category ?? "DeFi"} peers (${bench.blendedMultiple}x)`);
  }

  return {
    impliedFdv: fdvMid,
    fdvLow,
    fdvHigh,
    impliedMultiple: tvl > 0 ? round(fdvMid / tvl, 2) : round(effectiveMultiple, 2),
    estimatedAirdropPct,
    estimatedAirdropUsd,
    estRewardPer10kUsd,
    radarScore,
    readinessScore,
    momentumScore: mom.score,
    chainScore: ch.score,
    confidenceScore,
    confidenceTier,
    launchHorizon,
    breakdown: {
      baseMultiple: round(baseMultiple, 3),
      peerMultiple: round(bench.empiricalMedian, 3),
      peerCount: bench.peerCount,
      scaleAdjustment: round(scaleAdjustment, 3),
      momentumFactor: mom.factor,
      chainFactor: ch.factor,
      revenueBlendWeight: round(revenueBlendWeight, 2),
      revenueImpliedFdv: revenueImpliedFdv !== null ? Math.round(revenueImpliedFdv) : null,
      tvlImpliedFdv: Math.round(tvlImpliedFdv),
      effectiveChains: ch.effectiveChains,
      chainDiversityHhi: ch.hhi,
      topChain: ch.topChain,
      topChainShare: ch.topChainShare,
      ageMonths,
    },
    signals: signals.slice(0, 5),
  };
}