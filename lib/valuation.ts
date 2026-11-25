export interface PeerProtocolInput {
  id?: string;
  name: string;
  slug: string;
  category?: string;
  tvl?: number;
  mcap?: number | null;
  fdv?: number | null;
  fees24h?: number | null;
  fees7d?: number | null;
  fees30d?: number | null;
  revenue24h?: number | null;
  revenue7d?: number | null;
  revenue30d?: number | null;
  volume24h?: number | null;
  symbol?: string | null;
  gecko_id?: string | null;
}

export interface ValuationInput extends PeerProtocolInput {
  chains?: string[];
  chain?: string;
  chainTvls?: Record<string, number>;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  totalRaised?: number | null;
  backers?: string[];
  investors?: string[];
  audits?: number | string | null;
  audit_links?: string[];
  listedAt?: number | null;
  pointsProgram?: boolean;
  isWatchlist?: boolean;
  watchlist?: boolean;
  url?: string;
  twitter?: string;
  description?: string;
}

export interface CategoryBenchmark {
  category: string;
  peerCount: number;
  fdvToTvlMedian: number;
  fdvToTvlP25: number;
  fdvToTvlP75: number;
  fdvToRevMedian: number;
  fdvToFeesMedian: number;
  defaultAirdropPct: number;
  typicalFloatPct: number;
  source: "empirical" | "blended" | "prior";
}

export interface ValuationBreakdown {
  tvlImpliedFdv: number;
  revenueImpliedFdv: number | null;
  feesImpliedFdv: number | null;
  raiseImpliedFdv: number | null;
  weights: { tvl: number; revenue: number; fees: number; raise: number };
  appliedFdvToTvl: number;
  sizeElasticity: number;
  momentumMultiplier: number;
  multichainPremium: number;
}

export interface AirdropEstimate {
  allocationPct: number;
  poolUsdLow: number;
  poolUsdBase: number;
  poolUsdHigh: number;
  usdPerTvlDollar: number;
  impliedAprPct: number;
  efficiencyTier: "High" | "Medium" | "Crowded" | "Activity-Based";
}

export interface ConvictionBreakdown {
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
  launchHorizon: "Imminent (0-3m)" | "Near-Term (3-6m)" | "Mid-Term (6-12m)" | "Early (12m+)";
  scaleScore: number;
  revenueQualityScore: number;
  momentumScore: number;
  tgeCatalystScore: number;
  airdropEdgeScore: number;
}

export interface ProtocolValuation {
  slug: string;
  name: string;
  category: string;
  normalizedCategory: string;
  tvl: number;
  annualizedFees: number;
  annualizedRevenue: number;
  totalRaisedUsd: number;
  fdvLow: number;
  fdvBase: number;
  fdvHigh: number;
  impliedLaunchMcap: number;
  initialFloatPct: number;
  benchmark: CategoryBenchmark;
  breakdown: ValuationBreakdown;
  airdrop: AirdropEstimate;
  conviction: ConvictionBreakdown;
  radarScore: number;
  rank: number;
  percentile: number;
  isWatchlist: boolean;
}

export interface ValuationBatchResult {
  benchmarks: Record<string, CategoryBenchmark>;
  ranked: ProtocolValuation[];
  summary: {
    candidateCount: number;
    totalImpliedFdvUsd: number;
    totalAirdropPoolUsd: number;
    medianImpliedFdvUsd: number;
    peerPoolCount: number;
    categoryCount: number;
  };
}

interface SectorPrior {
  fdvToTvl: number;
  fdvToRev: number;
  fdvToFees: number;
  airdropPct: number;
  floatPct: number;
}

const SECTOR_PRIORS: Record<string, SectorPrior> = {
  "Dexes": { fdvToTvl: 1.65, fdvToRev: 18, fdvToFees: 7.5, airdropPct: 0.085, floatPct: 0.16 },
  "Derivatives": { fdvToTvl: 3.8, fdvToRev: 16, fdvToFees: 9.0, airdropPct: 0.10, floatPct: 0.15 },
  "Lending": { fdvToTvl: 0.42, fdvToRev: 20, fdvToFees: 8.5, airdropPct: 0.075, floatPct: 0.17 },
  "Liquid Staking": { fdvToTvl: 0.24, fdvToRev: 22, fdvToFees: 9.5, airdropPct: 0.065, floatPct: 0.18 },
  "Restaking": { fdvToTvl: 0.52, fdvToRev: 26, fdvToFees: 12.0, airdropPct: 0.08, floatPct: 0.14 },
  "CDP": { fdvToTvl: 0.55, fdvToRev: 19, fdvToFees: 10.0, airdropPct: 0.07, floatPct: 0.16 },
  "Yield": { fdvToTvl: 0.72, fdvToRev: 17, fdvToFees: 8.0, airdropPct: 0.08, floatPct: 0.16 },
  "Bridge": { fdvToTvl: 2.6, fdvToRev: 24, fdvToFees: 11.0, airdropPct: 0.095, floatPct: 0.15 },
  "RWA": { fdvToTvl: 0.68, fdvToRev: 25, fdvToFees: 14.0, airdropPct: 0.055, floatPct: 0.14 },
  "Prediction Market": { fdvToTvl: 5.2, fdvToRev: 28, fdvToFees: 14.0, airdropPct: 0.09, floatPct: 0.14 },
  "Options": { fdvToTvl: 2.9, fdvToRev: 20, fdvToFees: 10.5, airdropPct: 0.085, floatPct: 0.15 },
  "Launchpad": { fdvToTvl: 3.1, fdvToRev: 15, fdvToFees: 8.0, airdropPct: 0.08, floatPct: 0.17 },
  "Default": { fdvToTvl: 1.15, fdvToRev: 20, fdvToFees: 9.5, airdropPct: 0.075, floatPct: 0.16 },
};

const REFERENCE_EPOCH_SEC = 1767225600; // 2026-01-01T00:00:00Z deterministic baseline

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
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

export function normalizeCategory(raw?: string): string {
  const c = (raw ?? "").trim().toLowerCase();
  if (!c) return "Default";
  if (c.includes("dex") || c.includes("amm") || c.includes("swap") || c.includes("liquidity")) return "Dexes";
  if (c.includes("perp") || c.includes("deriv") || c.includes("futures") || c.includes("synthet")) return "Derivatives";
  if (c.includes("lend") || c.includes("borrow") || c.includes("money market") || c.includes("credit")) return "Lending";
  if (c.includes("liquid restak") || c.includes("restak")) return "Restaking";
  if (c.includes("liquid stak") || c === "staking" || c.includes("staking pool")) return "Liquid Staking";
  if (c.includes("cdp") || c.includes("stablecoin")) return "CDP";
  if (c.includes("yield") || c.includes("farm") || c.includes("vault") || c.includes("basis")) return "Yield";
  if (c.includes("bridge") || c.includes("cross chain") || c.includes("interop")) return "Bridge";
  if (c.includes("rwa") || c.includes("real world") || c.includes("treasur")) return "RWA";
  if (c.includes("predict")) return "Prediction Market";
  if (c.includes("option")) return "Options";
  if (c.includes("launch") || c.includes("ido")) return "Launchpad";
  return "Default";
}

function normalizeRaisedUsd(raw?: number | null): number {
  const n = safeNum(raw);
  if (n <= 0) return 0;
  return n < 50_000 ? n * 1_000_000 : n;
}

function annualizeFlow(d30?: number | null, d7?: number | null, d24?: number | null): number {
  const m30 = safeNum(d30);
  if (m30 > 0) return m30 * (365 / 30);
  const w7 = safeNum(d7);
  if (w7 > 0) return w7 * (365 / 7);
  const h24 = safeNum(d24);
  if (h24 > 0) return h24 * 365;
  return 0;
}

function extractPeerFdv(p: PeerProtocolInput): number {
  const fdv = safeNum(p.fdv);
  if (fdv > 1_000_000) return fdv;
  const mcap = safeNum(p.mcap);
  if (mcap > 1_000_000) return mcap * 1.45;
  return 0;
}

export function calibratePeerBenchmarks(peers: PeerProtocolInput[]): {
  benchmarks: Record<string, CategoryBenchmark>;
  peerPoolCount: number;
} {
  const buckets = new Map<string, { tvlMults: number[]; revMults: number[]; feeMults: number[] }>();
  let peerPoolCount = 0;

  for (const p of peers) {
    const fdv = extractPeerFdv(p);
    const tvl = safeNum(p.tvl);
    if (fdv <= 1_000_000) continue;

    const annRev = annualizeFlow(p.revenue30d, p.revenue7d, p.revenue24h);
    const annFees = annualizeFlow(p.fees30d, p.fees7d, p.fees24h);
    if (tvl < 250_000 && annRev < 100_000 && annFees < 250_000) continue;

    peerPoolCount += 1;
    const cat = normalizeCategory(p.category);
    let bucket = buckets.get(cat);
    if (!bucket) {
      bucket = { tvlMults: [], revMults: [], feeMults: [] };
      buckets.set(cat, bucket);
    }

    if (tvl >= 250_000) {
      const m = fdv / tvl;
      if (m >= 0.03 && m <= 35) bucket.tvlMults.push(m);
    }
    if (annRev >= 100_000) {
      const m = fdv / annRev;
      if (m >= 1 && m <= 180) bucket.revMults.push(m);
    }
    if (annFees >= 250_000) {
      const m = fdv / annFees;
      if (m >= 0.5 && m <= 120) bucket.feeMults.push(m);
    }
  }

  const allTvl: number[] = [];
  const allRev: number[] = [];
  const allFee: number[] = [];
  for (const b of buckets.values()) {
    allTvl.push(...b.tvlMults);
    allRev.push(...b.revMults);
    allFee.push(...b.feeMults);
  }
  allTvl.sort((a, b) => a - b);
  allRev.sort((a, b) => a - b);
  allFee.sort((a, b) => a - b);

  const benchmarks: Record<string, CategoryBenchmark> = {};
  const categories = Object.keys(SECTOR_PRIORS);

  for (const cat of categories) {
    const prior = SECTOR_PRIORS[cat];
    const b = buckets.get(cat) ?? { tvlMults: [], revMults: [], feeMults: [] };
    const tvlSorted = [...b.tvlMults].sort((x, y) => x - y);
    const revSorted = [...b.revMults].sort((x, y) => x - y);
    const feeSorted = [...b.feeMults].sort((x, y) => x - y);

    const n = tvlSorted.length;
    const shrink = n / (n + 4);
    const empMed = n > 0 ? quantile(tvlSorted, 0.5) : prior.fdvToTvl;
    const empP25 = n >= 3 ? quantile(tvlSorted, 0.25) : empMed * 0.58;
    const empP75 = n >= 3 ? quantile(tvlSorted, 0.75) : empMed * 1.65;

    const fdvToTvlMedian = clamp(shrink * empMed + (1 - shrink) * prior.fdvToTvl, 0.12, 12);
    const fdvToTvlP25 = clamp(shrink * empP25 + (1 - shrink) * (prior.fdvToTvl * 0.55), 0.06, fdvToTvlMedian * 0.9);
    const fdvToTvlP75 = clamp(shrink * empP75 + (1 - shrink) * (prior.fdvToTvl * 1.65), fdvToTvlMedian * 1.15, 22);

    const revShrink = revSorted.length / (revSorted.length + 3);
    const revBase = revSorted.length > 0 ? quantile(revSorted, 0.5) : allRev.length > 0 ? quantile(allRev, 0.5) : prior.fdvToRev;
    const fdvToRevMedian = clamp(revShrink * revBase + (1 - revShrink) * prior.fdvToRev, 4, 80);

    const feeShrink = feeSorted.length / (feeSorted.length + 3);
    const feeBase = feeSorted.length > 0 ? quantile(feeSorted, 0.5) : allFee.length > 0 ? quantile(allFee, 0.5) : prior.fdvToFees;
    const fdvToFeesMedian = clamp(feeShrink * feeBase + (1 - feeShrink) * prior.fdvToFees, 2, 45);

    const source: CategoryBenchmark["source"] = n >= 6 ? "empirical" : n >= 1 ? "blended" : "prior";

    benchmarks[cat] = {
      category: cat,
      peerCount: n,
      fdvToTvlMedian: round(fdvToTvlMedian, 3),
      fdvToTvlP25: round(fdvToTvlP25, 3),
      fdvToTvlP75: round(fdvToTvlP75, 3),
      fdvToRevMedian: round(fdvToRevMedian, 2),
      fdvToFeesMedian: round(fdvToFeesMedian, 2),
      defaultAirdropPct: prior.airdropPct,
      typicalFloatPct: prior.floatPct,
      source,
    };
  }

  return { benchmarks, peerPoolCount };
}

function computeSizeElasticity(tvl: number): number {
  if (tvl <= 0) return 1.0;
  const logRatio = Math.log10(Math.max(tvl, 100_000) / 100_000_000);
  // Smooth diminishing multiple above $100M TVL, modest scarcity premium below $100M
  return clamp(1 - 0.14 * logRatio, 0.55, 1.32);
}

function computeMomentumMultiplier(change7d: number, change30d: number): number {
  const c7 = clamp(change7d, -60, 180);
  const c30 = clamp(change30d, -75, 250);
  const blended = 0.35 * c7 + 0.65 * c30;
  return clamp(1 + blended / 360, 0.78, 1.35);
}

function computeMultichainPremium(chains: string[]): number {
  const count = chains.length;
  if (count <= 1) return 1.0;
  return clamp(1 + 0.035 * Math.min(count - 1, 5), 1.0, 1.15);
}

export function valuateProtocol(
  input: ValuationInput,
  benchmarks: Record<string, CategoryBenchmark>,
  asOfEpochSec = REFERENCE_EPOCH_SEC,
): ProtocolValuation {
  const normCat = normalizeCategory(input.category);
  const bm = benchmarks[normCat] ?? benchmarks["Default"];
  const tvl = Math.max(0, safeNum(input.tvl));
  const annFees = annualizeFlow(input.fees30d, input.fees7d, input.fees24h);
  const annRev = annualizeFlow(input.revenue30d, input.revenue7d, input.revenue24h);
  const totalRaisedUsd = normalizeRaisedUsd(input.totalRaised);
  const chains = Array.isArray(input.chains) && input.chains.length > 0
    ? input.chains
    : input.chain ? [input.chain] : [];

  const change7d = safeNum(input.change_7d);
  const change30d = safeNum(input.change_1m);

  const sizeElasticity = round(computeSizeElasticity(tvl), 3);
  const momentumMultiplier = round(computeMomentumMultiplier(change7d, change30d), 3);
  const multichainPremium = round(computeMultichainPremium(chains), 3);
  const appliedMult = bm.fdvToTvlMedian * sizeElasticity * momentumMultiplier * multichainPremium;

  const tvlImpliedFdv = tvl > 0 ? tvl * appliedMult : 0;
  const revenueImpliedFdv = annRev >= 50_000 ? annRev * bm.fdvToRevMedian * momentumMultiplier : null;
  const feesImpliedFdv = annFees >= 100_000 ? annFees * bm.fdvToFeesMedian * momentumMultiplier : null;
  const raiseImpliedFdv = totalRaisedUsd >= 500_000 ? totalRaisedUsd * 6.2 * Math.sqrt(momentumMultiplier) : null;

  // Dynamic pillar weights depending on available fundamental signals
  let wTvl = tvl > 0 ? 0.55 : 0;
  let wRev = revenueImpliedFdv !== null ? 0.30 : 0;
  let wFees = feesImpliedFdv !== null ? (revenueImpliedFdv !== null ? 0.10 : 0.28) : 0;
  let wRaise = raiseImpliedFdv !== null ? 0.18 : 0;
  const wSum = wTvl + wRev + wFees + wRaise;

  let fdvBase = 0;
  if (wSum > 0) {
    wTvl /= wSum;
    wRev /= wSum;
    wFees /= wSum;
    wRaise /= wSum;
    fdvBase =
      wTvl * tvlImpliedFdv +
      wRev * (revenueImpliedFdv ?? 0) +
      wFees * (feesImpliedFdv ?? 0) +
      wRaise * (raiseImpliedFdv ?? 0);
  } else {
    fdvBase = 15_000_000;
  }

  // Enforce reasonable bounds relative to peer band and funding floor
  const minFloor = Math.max(5_000_000, totalRaisedUsd * 2.2);
  fdvBase = Math.max(fdvBase, minFloor);

  const lowRatio = clamp(bm.fdvToTvlP25 / bm.fdvToTvlMedian, 0.45, 0.78);
  const highRatio = clamp(bm.fdvToTvlP75 / bm.fdvToTvlMedian, 1.28, 2.05);
  const fdvLow = round(fdvBase * lowRatio, 0);
  const fdvHigh = round(fdvBase * highRatio, 0);
  fdvBase = round(fdvBase, 0);

  const initialFloatPct = round(
    clamp(bm.typicalFloatPct - (totalRaisedUsd > 30_000_000 ? 0.02 : 0), 0.10, 0.25),
    3,
  );
  const impliedLaunchMcap = round(fdvBase * initialFloatPct, 0);

  // Airdrop economics
  const hasPoints = Boolean(input.pointsProgram);
  let airdropPct = bm.defaultAirdropPct;
  if (hasPoints) airdropPct += 0.015;
  if (totalRaisedUsd > 50_000_000) airdropPct -= 0.012;
  if (tvl > 500_000_000) airdropPct -= 0.008;
  airdropPct = round(clamp(airdropPct, 0.04, 0.14), 4);

  const poolUsdBase = round(fdvBase * airdropPct, 0);
  const poolUsdLow = round(fdvLow * clamp(airdropPct * 0.78, 0.03, 0.12), 0);
  const poolUsdHigh = round(fdvHigh * clamp(airdropPct * 1.22, 0.05, 0.18), 0);
  const usdPerTvlDollar = tvl >= 100_000 ? round(poolUsdBase / tvl, 4) : 0;

  // Estimate farming window in months based on protocol maturity
  const listedAt = safeNum(input.listedAt);
  const ageDays = listedAt > 1_500_000_000 ? Math.max(30, (asOfEpochSec - listedAt) / 86400) : 240;
  const estWindowMonths = hasPoints ? 4.5 : ageDays > 365 ? 5.5 : 7.5;
  const rawApr = tvl >= 100_000 ? (poolUsdBase / tvl) * (12 / estWindowMonths) * 100 : 0;
  const impliedAprPct = round(clamp(rawApr, 0, 220), 1);

  const efficiencyTier: AirdropEstimate["efficiencyTier"] =
    tvl < 2_000_000 && (annFees > 200_000 || safeNum(input.volume24h) > 500_000)
      ? "Activity-Based"
      : usdPerTvlDollar >= 0.09
        ? "High"
        : usdPerTvlDollar >= 0.035
          ? "Medium"
          : "Crowded";

  // Conviction scoring (0-100 across 5 transparent pillars)
  const scaleScore = round(
    clamp((Math.log10(Math.max(tvl, 50_000)) - 4.7) / 4.8 * 75 + (Math.log10(Math.max(fdvBase, 5_000_000)) - 6.7) / 3.3 * 25, 8, 100),
    1,
  );
  const feeYield = tvl > 0 ? annFees / tvl : 0;
  const revenueQualityScore = round(
    annRev > 0
      ? clamp(42 + Math.log10(Math.max(annRev, 10_000)) * 7.5 + clamp(feeYield * 120, 0, 18), 25, 100)
      : annFees > 0
        ? clamp(32 + Math.log10(Math.max(annFees, 10_000)) * 6.5, 20, 88)
        : 22,
    1,
  );
  const momentumScore = round(
    clamp(50 + clamp(change30d, -60, 140) * 0.32 + clamp(change7d, -40, 80) * 0.22 + Math.min(chains.length * 2.5, 10), 10, 100),
    1,
  );

  const auditCount = Array.isArray(input.audit_links) && input.audit_links.length > 0
    ? input.audit_links.length
    : safeNum(input.audits);
  const isWatchlist = Boolean(input.isWatchlist || input.watchlist);
  const tgeCatalystScore = round(
    clamp(
      24 +
        (hasPoints ? 26 : 0) +
        (totalRaisedUsd >= 10_000_000 ? 22 : totalRaisedUsd >= 2_000_000 ? 12 : 0) +
        (ageDays >= 270 && ageDays <= 900 ? 14 : ageDays > 900 ? 8 : 4) +
        (auditCount > 0 ? 8 : 0) +
        (isWatchlist ? 12 : 0),
      15,
      100,
    ),
    1,
  );
  const airdropEdgeScore = round(
    clamp(
      (Math.log10(Math.max(poolUsdBase, 500_000)) - 5.7) * 18 +
        clamp(usdPerTvlDollar * 240, 0, 38) +
        (efficiencyTier === "Activity-Based" ? 22 : 0),
      12,
      100,
    ),
    1,
  );

  const totalConviction = round(
    0.25 * scaleScore +
      0.20 * revenueQualityScore +
      0.20 * momentumScore +
      0.20 * tgeCatalystScore +
      0.15 * airdropEdgeScore,
    1,
  );

  const grade: ConvictionBreakdown["grade"] =
    totalConviction >= 82 ? "S" : totalConviction >= 70 ? "A" : totalConviction >= 56 ? "B" : totalConviction >= 42 ? "C" : "D";

  const launchHorizon: ConvictionBreakdown["launchHorizon"] =
    hasPoints && (totalRaisedUsd >= 10_000_000 || ageDays >= 240)
      ? "Imminent (0-3m)"
      : tgeCatalystScore >= 65
        ? "Near-Term (3-6m)"
        : ageDays >= 180
          ? "Mid-Term (6-12m)"
          : "Early (12m+)";

  // Composite radar ranking score: prioritizes launch value (FDV) weighted by conviction & catalyst readiness
  const fdvNorm = clamp((Math.log10(Math.max(fdvBase, 5_000_000)) - 6.7) / 3.5 * 100, 0, 100);
  const radarScore = round(0.58 * fdvNorm + 0.42 * totalConviction + (isWatchlist ? 3.5 : 0), 2);

  return {
    slug: input.slug,
    name: input.name,
    category: input.category ?? "Other",
    normalizedCategory: normCat,
    tvl: round(tvl, 0),
    annualizedFees: round(annFees, 0),
    annualizedRevenue: round(annRev, 0),
    totalRaisedUsd: round(totalRaisedUsd, 0),
    fdvLow,
    fdvBase,
    fdvHigh,
    impliedLaunchMcap,
    initialFloatPct,
    benchmark: bm,
    breakdown: {
      tvlImpliedFdv: round(tvlImpliedFdv, 0),
      revenueImpliedFdv: revenueImpliedFdv !== null ? round(revenueImpliedFdv, 0) : null,
      feesImpliedFdv: feesImpliedFdv !== null ? round(feesImpliedFdv, 0) : null,
      raiseImpliedFdv: raiseImpliedFdv !== null ? round(raiseImpliedFdv, 0) : null,
      weights: {
        tvl: round(wTvl, 3),
        revenue: round(wRev, 3),
        fees: round(wFees, 3),
        raise: round(wRaise, 3),
      },
      appliedFdvToTvl: round(appliedMult, 3),
      sizeElasticity,
      momentumMultiplier,
      multichainPremium,
    },
    airdrop: {
      allocationPct: airdropPct,
      poolUsdLow,
      poolUsdBase,
      poolUsdHigh,
      usdPerTvlDollar,
      impliedAprPct,
      efficiencyTier,
    },
    conviction: {
      total: totalConviction,
      grade,
      launchHorizon,
      scaleScore,
      revenueQualityScore,
      momentumScore,
      tgeCatalystScore,
      airdropEdgeScore,
    },
    radarScore,
    rank: 0,
    percentile: 0,
    isWatchlist,
  };
}

export function rankCandidates(
  candidates: ValuationInput[],
  allProtocols: PeerProtocolInput[],
  asOfEpochSec = REFERENCE_EPOCH_SEC,
): ValuationBatchResult {
  const { benchmarks, peerPoolCount } = calibratePeerBenchmarks(allProtocols);
  const valued = candidates.map((c) => valuateProtocol(c, benchmarks, asOfEpochSec));

  valued.sort((a, b) => {
    if (b.radarScore !== a.radarScore) return b.radarScore - a.radarScore;
    if (b.fdvBase !== a.fdvBase) return b.fdvBase - a.fdvBase;
    if (b.tvl !== a.tvl) return b.tvl - a.tvl;
    return a.slug.localeCompare(b.slug);
  });

  const n = valued.length;
  let totalFdv = 0;
  let totalAirdrop = 0;
  const fdvSorted: number[] = [];

  for (let i = 0; i < n; i++) {
    valued[i].rank = i + 1;
    valued[i].percentile = n > 1 ? round((1 - i / (n - 1)) * 100, 1) : 100;
    totalFdv += valued[i].fdvBase;
    totalAirdrop += valued[i].airdrop.poolUsdBase;
    fdvSorted.push(valued[i].fdvBase);
  }
  fdvSorted.sort((a, b) => a - b);

  return {
    benchmarks,
    ranked: valued,
    summary: {
      candidateCount: n,
      totalImpliedFdvUsd: round(totalFdv, 0),
      totalAirdropPoolUsd: round(totalAirdrop, 0),
      medianImpliedFdvUsd: round(quantile(fdvSorted, 0.5), 0),
      peerPoolCount,
      categoryCount: Object.keys(benchmarks).length,
    },
  };
}