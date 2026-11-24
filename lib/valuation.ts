export interface ValuationProtocolInput {
  id?: string;
  name: string;
  slug?: string;
  category?: string | null;
  chain?: string | null;
  chains?: ReadonlyArray<string> | null;
  tvl?: number | null;
  chainTvls?: Record<string, number> | null;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  tvlChange7d?: number | null;
  tvlChange30d?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  gecko_id?: string | null;
  audits?: string | number | null;
  audit_links?: ReadonlyArray<string> | null;
  listedAt?: number | null;
  raised?: number | null;
  totalRaised?: number | null;
  fees24h?: number | null;
  revenue24h?: number | null;
  annualizedFees?: number | null;
  annualizedRevenue?: number | null;
  volume24h?: number | null;
  twitter?: string | null;
  github?: ReadonlyArray<string> | string | null;
  url?: string | null;
  isWatchlist?: boolean;
  watchlist?: boolean;
}

export interface CategoryBenchmark {
  category: string;
  priorMultiple: number;
  empiricalMultiple: number | null;
  blendedMultiple: number;
  sampleSize: number;
  medianTvl: number;
}

export interface ValuationBreakdown {
  tvlBaseUsd: number;
  categoryMultiple: number;
  sizeElasticity: number;
  chainPremium: number;
  multiChainBonus: number;
  momentumFactor: number;
  qualityFactor: number;
  tvlImpliedFdv: number;
  revenueImpliedFdv: number | null;
  fundingImpliedFdv: number | null;
  fdvLow: number;
  fdvMid: number;
  fdvHigh: number;
  methodology: string;
}

export interface AirdropEstimate {
  allocationPct: number;
  poolUsd: number;
  poolLowUsd: number;
  poolHighUsd: number;
  yieldPer10kUsd: number;
  impliedCampaignAprPct: number;
  dilutionRisk: "Low" | "Moderate" | "High";
}

export interface ConvictionBreakdown {
  score: number;
  tier: "S" | "A" | "B" | "C" | "D";
  launchProbability: number;
  scaleScore: number;
  momentumScore: number;
  upsideScore: number;
  readinessScore: number;
  tailwindScore: number;
  signals: string[];
}

export interface ProtocolValuation {
  impliedFdv: number;
  impliedValue: number;
  fdvLow: number;
  fdvHigh: number;
  primaryChain: string;
  normalizedCategory: string;
  breakdown: ValuationBreakdown;
  airdrop: AirdropEstimate;
  conviction: ConvictionBreakdown;
}

export interface ValuationOptions {
  benchmarks?: Record<string, CategoryBenchmark>;
  referenceTimestamp?: number;
}

const DEFAULT_REFERENCE_TS = 1743465600;

export const CATEGORY_MULTIPLES: Record<string, number> = {
  "Derivatives": 2.45,
  "Perps": 2.55,
  "Prediction Market": 2.6,
  "Dexs": 1.65,
  "DEX Aggregator": 2.1,
  "Bridge": 1.9,
  "Cross Chain": 1.85,
  "Bridge Aggregator": 1.95,
  "Launchpad": 2.25,
  "Options": 1.8,
  "Options Vault": 1.4,
  "Synthetics": 1.5,
  "Lending": 0.88,
  "CDP": 0.72,
  "Liquid Staking": 0.52,
  "Liquid Restaking": 0.65,
  "Restaking": 0.78,
  "Yield": 0.92,
  "Yield Aggregator": 0.85,
  "Leveraged Farming": 0.95,
  "RWA": 1.15,
  "RWA Lending": 1.05,
  "NFT Marketplace": 2.15,
  "NFT Lending": 1.35,
  "Gaming": 2.3,
  "SocialFi": 2.4,
  "Payments": 1.95,
  "Privacy": 1.75,
  "Oracle": 2.2,
  "MEV": 2.1,
  "Basis Trading": 1.25,
  "Liquidity Manager": 1.05,
  "Indexes": 1.15,
  "Insurance": 1.1,
  "Staking Pool": 0.6,
  "Farm": 0.8,
  "Default": 1.15,
};

export const CATEGORY_AIRDROP_PCT: Record<string, number> = {
  "Derivatives": 10.5,
  "Perps": 11.0,
  "Prediction Market": 9.5,
  "Dexs": 9.0,
  "DEX Aggregator": 10.0,
  "Bridge": 10.5,
  "Cross Chain": 10.0,
  "Launchpad": 8.0,
  "Options": 9.0,
  "Lending": 7.5,
  "CDP": 7.0,
  "Liquid Staking": 6.5,
  "Liquid Restaking": 8.5,
  "Restaking": 9.0,
  "Yield": 8.0,
  "Yield Aggregator": 8.0,
  "RWA": 6.0,
  "NFT Marketplace": 10.0,
  "Gaming": 9.5,
  "SocialFi": 10.5,
  "Payments": 7.0,
  "Basis Trading": 8.5,
  "Liquidity Manager": 8.0,
  "Default": 8.0,
};

export const CATEGORY_REVENUE_MULTIPLES: Record<string, number> = {
  "Derivatives": 22,
  "Perps": 24,
  "Dexs": 18,
  "DEX Aggregator": 25,
  "Bridge": 22,
  "Cross Chain": 20,
  "Lending": 16,
  "CDP": 15,
  "Liquid Staking": 14,
  "Liquid Restaking": 18,
  "Restaking": 20,
  "Yield": 15,
  "RWA": 18,
  "Prediction Market": 28,
  "Launchpad": 16,
  "Default": 18,
};

export const CHAIN_PREMIUMS: Record<string, number> = {
  "Ethereum": 1.26,
  "Solana": 1.24,
  "Hyperliquid": 1.22,
  "Base": 1.19,
  "Sui": 1.16,
  "Monad": 1.16,
  "Berachain": 1.14,
  "Arbitrum": 1.13,
  "Bitcoin": 1.12,
  "Optimism": 1.09,
  "OP Mainnet": 1.09,
  "Sonic": 1.08,
  "Aptos": 1.08,
  "Starknet": 1.07,
  "TON": 1.07,
  "Linea": 1.06,
  "Scroll": 1.05,
  "zkSync Era": 1.05,
  "Mantle": 1.04,
  "Sei": 1.05,
  "Blast": 1.03,
  "Avalanche": 1.03,
  "Polygon": 1.02,
  "BSC": 1.01,
  "Gnosis": 1.0,
  "Fantom": 0.96,
  "Tron": 0.95,
  "Cronos": 0.94,
  "Default": 1.0,
};

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundInt(value: number): number {
  return Math.round(value);
}

function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function normalizeCategory(category?: string | null): string {
  const raw = (category ?? "").trim();
  if (!raw) return "Default";
  if (CATEGORY_MULTIPLES[raw] !== undefined) return raw;
  const lower = raw.toLowerCase();
  for (const key of Object.keys(CATEGORY_MULTIPLES)) {
    if (key.toLowerCase() === lower) return key;
  }
  if (lower.includes("perp") || lower.includes("deriv")) return "Derivatives";
  if (lower.includes("dex")) return "Dexs";
  if (lower.includes("lend") || lower.includes("borrow")) return "Lending";
  if (lower.includes("restak")) return "Restaking";
  if (lower.includes("liquid stak")) return "Liquid Staking";
  if (lower.includes("bridge") || lower.includes("cross")) return "Bridge";
  if (lower.includes("yield")) return "Yield";
  if (lower.includes("cdp") || lower.includes("stable")) return "CDP";
  if (lower.includes("rwa")) return "RWA";
  if (lower.includes("predict")) return "Prediction Market";
  if (lower.includes("option")) return "Options";
  if (lower.includes("launch")) return "Launchpad";
  return raw;
}

export function normalizeChain(chain?: string | null): string {
  const raw = (chain ?? "").trim();
  if (!raw || raw.toLowerCase() === "multi-chain") return "Default";
  if (CHAIN_PREMIUMS[raw] !== undefined) return raw;
  const lower = raw.toLowerCase();
  for (const key of Object.keys(CHAIN_PREMIUMS)) {
    if (key.toLowerCase() === lower) return key;
  }
  if (lower === "eth" || lower === "mainnet") return "Ethereum";
  if (lower === "sol") return "Solana";
  if (lower === "arb") return "Arbitrum";
  if (lower === "op" || lower === "optimism") return "Optimism";
  if (lower === "bnb" || lower === "binance") return "BSC";
  if (lower === "matic") return "Polygon";
  if (lower === "avax") return "Avalanche";
  return raw;
}

function normalizeRaisedUsd(protocol: ValuationProtocolInput): number {
  const raw = finiteOr(protocol.totalRaised, finiteOr(protocol.raised, 0));
  if (raw <= 0) return 0;
  return raw < 10_000 ? raw * 1_000_000 : raw;
}

function normalizeListedTs(listedAt?: number | null): number | null {
  const raw = finiteOr(listedAt, 0);
  if (raw <= 0) return null;
  return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
}

export function buildCategoryBenchmarks(
  protocols: ReadonlyArray<ValuationProtocolInput>
): Record<string, CategoryBenchmark> {
  const grouped = new Map<string, { ratios: number[]; tvls: number[] }>();
  for (const p of protocols) {
    const tvl = finiteOr(p.tvl, 0);
    const val = finiteOr(p.fdv, finiteOr(p.mcap, 0));
    if (tvl < 2_000_000 || val <= 0) continue;
    const ratio = val / tvl;
    if (ratio < 0.08 || ratio > 20) continue;
    const cat = normalizeCategory(p.category);
    const bucket = grouped.get(cat) ?? { ratios: [], tvls: [] };
    bucket.ratios.push(ratio);
    bucket.tvls.push(tvl);
    grouped.set(cat, bucket);
  }
  const result: Record<string, CategoryBenchmark> = {};
  const allCats = new Set([...Object.keys(CATEGORY_MULTIPLES), ...grouped.keys()]);
  for (const cat of allCats) {
    const prior = CATEGORY_MULTIPLES[cat] ?? CATEGORY_MULTIPLES.Default;
    const bucket = grouped.get(cat);
    if (!bucket || bucket.ratios.length < 3) {
      result[cat] = {
        category: cat,
        priorMultiple: prior,
        empiricalMultiple: null,
        blendedMultiple: prior,
        sampleSize: bucket ? bucket.ratios.length : 0,
        medianTvl: bucket ? roundInt(median(bucket.tvls)) : 0,
      };
      continue;
    }
    const emp = clamp(median(bucket.ratios), prior * 0.45, prior * 2.2);
    const weight = clamp(bucket.ratios.length / (bucket.ratios.length + 6), 0.25, 0.72);
    const blended = round2(prior * (1 - weight) + emp * weight);
    result[cat] = {
      category: cat,
      priorMultiple: prior,
      empiricalMultiple: round2(emp),
      blendedMultiple: blended,
      sampleSize: bucket.ratios.length,
      medianTvl: roundInt(median(bucket.tvls)),
    };
  }
  return result;
}

export function getCategoryMultiple(
  category?: string | null,
  benchmarks?: Record<string, CategoryBenchmark>
): number {
  const norm = normalizeCategory(category);
  const bench = benchmarks?.[norm];
  if (bench) return bench.blendedMultiple;
  return CATEGORY_MULTIPLES[norm] ?? CATEGORY_MULTIPLES.Default;
}

export function getChainPremium(
  chains?: ReadonlyArray<string> | null,
  chainTvls?: Record<string, number> | null,
  primaryChain?: string | null
): { premium: number; primaryChain: string; multiChainBonus: number } {
  const tvlEntries: Array<[string, number]> = [];
  if (chainTvls) {
    for (const [key, val] of Object.entries(chainTvls)) {
      if (key.includes("-") || key === "borrowed" || key === "staking" || key === "pool2") continue;
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        tvlEntries.push([normalizeChain(key), val]);
      }
    }
  }
  let resolvedPrimary = normalizeChain(primaryChain);
  let basePremium = CHAIN_PREMIUMS[resolvedPrimary] ?? CHAIN_PREMIUMS.Default;
  if (tvlEntries.length > 0) {
    tvlEntries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    resolvedPrimary = tvlEntries[0][0];
    const total = tvlEntries.reduce((acc, [, v]) => acc + v, 0);
    if (total > 0) {
      let weighted = 0;
      for (const [ch, v] of tvlEntries) {
        weighted += (v / total) * (CHAIN_PREMIUMS[ch] ?? CHAIN_PREMIUMS.Default);
      }
      basePremium = weighted;
    }
  } else if (chains && chains.length > 0) {
    const cleaned = chains.map(normalizeChain).filter((c) => c !== "Default");
    if (cleaned.length > 0) {
      if (resolvedPrimary === "Default") resolvedPrimary = cleaned[0];
      const premiums = cleaned.map((c) => CHAIN_PREMIUMS[c] ?? CHAIN_PREMIUMS.Default);
      basePremium = premiums.reduce((a, b) => a + b, 0) / premiums.length;
    }
  }
  const uniqueChains = new Set<string>();
  for (const c of chains ?? []) {
    const nc = normalizeChain(c);
    if (nc !== "Default") uniqueChains.add(nc);
  }
  for (const [c] of tvlEntries) {
    if (c !== "Default") uniqueChains.add(c);
  }
  const count = uniqueChains.size;
  const multiChainBonus = count >= 5 ? 0.08 : count >= 3 ? 0.05 : count === 2 ? 0.02 : 0;
  return {
    premium: round2(basePremium * (1 + multiChainBonus)),
    primaryChain: resolvedPrimary === "Default" ? "Multi-Chain" : resolvedPrimary,
    multiChainBonus: round2(multiChainBonus),
  };
}

export function computeSizeElasticity(tvl: number): number {
  if (tvl <= 0) return 1.0;
  const refTvl = 100_000_000;
  const raw = Math.pow(tvl / refTvl, -0.11);
  return round2(clamp(raw, 0.58, 1.48));
}

export function computeMomentumFactor(
  change1d?: number | null,
  change7d?: number | null,
  change1m?: number | null
): number {
  const c1d = clamp(finiteOr(change1d, 0), -50, 80);
  const c7d = clamp(finiteOr(change7d, 0), -60, 150);
  const c1m = clamp(finiteOr(change1m, 0), -70, 250);
  const composite = c7d * 0.55 + c1m * 0.35 + c1d * 0.1;
  return round2(clamp(1 + composite / 320, 0.8, 1.38));
}

function computeQualityFactor(protocol: ValuationProtocolInput): number {
  let factor = 1.0;
  const auditCount = Number(protocol.audits ?? 0);
  const hasAudits =
    (Number.isFinite(auditCount) && auditCount > 0) ||
    (Array.isArray(protocol.audit_links) && protocol.audit_links.length > 0);
  if (hasAudits) factor += 0.06;
  if (protocol.twitter) factor += 0.03;
  if (protocol.github && (Array.isArray(protocol.github) ? protocol.github.length > 0 : true)) {
    factor += 0.03;
  }
  if (protocol.isWatchlist || protocol.watchlist) factor += 0.05;
  return round2(clamp(factor, 0.92, 1.2));
}

export function estimateAirdropPool(
  impliedFdv: number,
  protocol: ValuationProtocolInput
): AirdropEstimate {
  const cat = normalizeCategory(protocol.category);
  let pct = CATEGORY_AIRDROP_PCT[cat] ?? CATEGORY_AIRDROP_PCT.Default;
  const raisedUsd = normalizeRaisedUsd(protocol);
  const tvl = Math.max(0, finiteOr(protocol.tvl, 0));
  if (raisedUsd >= 50_000_000) pct -= 1.2;
  else if (raisedUsd >= 15_000_000) pct -= 0.5;
  else if (raisedUsd === 0 && tvl >= 25_000_000) pct += 1.0;
  if (tvl >= 1_000_000_000) pct -= 0.8;
  pct = round2(clamp(pct, 4.5, 14.0));
  const poolUsd = roundInt(impliedFdv * (pct / 100));
  const poolLowUsd = roundInt(poolUsd * 0.65);
  const poolHighUsd = roundInt(poolUsd * 1.45);
  const effectiveFarmTvl = Math.max(tvl, 2_500_000);
  const yieldPer10kUsd = round2((10_000 / effectiveFarmTvl) * poolUsd);
  const impliedCampaignAprPct = round2(clamp((poolUsd / effectiveFarmTvl) * 100 * 1.5, 0.5, 240));
  const dilutionRisk: "Low" | "Moderate" | "High" =
    tvl >= 800_000_000 || raisedUsd >= 80_000_000
      ? "High"
      : tvl >= 120_000_000 || raisedUsd >= 20_000_000
        ? "Moderate"
        : "Low";
  return {
    allocationPct: pct,
    poolUsd,
    poolLowUsd,
    poolHighUsd,
    yieldPer10kUsd,
    impliedCampaignAprPct,
    dilutionRisk,
  };
}

export function computeConvictionScore(
  protocol: ValuationProtocolInput,
  impliedFdv: number,
  airdrop: AirdropEstimate,
  categoryMultiple: number,
  chainPremium: number,
  referenceTs: number = DEFAULT_REFERENCE_TS
): ConvictionBreakdown {
  const tvl = Math.max(0, finiteOr(protocol.tvl, 0));
  const c7d = finiteOr(protocol.change_7d, finiteOr(protocol.tvlChange7d, 0));
  const c1m = finiteOr(protocol.change_1m, finiteOr(protocol.tvlChange30d, 0));
  const raisedUsd = normalizeRaisedUsd(protocol);
  const signals: string[] = [];

  const scaleScore = round2(
    tvl > 0 ? clamp((Math.log10(tvl) - 5.2) * 6.2, 2, 25) : raisedUsd > 0 ? 8 : 2
  );
  if (tvl >= 250_000_000) signals.push("Category-leading TVL scale");
  else if (tvl >= 50_000_000) signals.push("Strong organic liquidity base");

  const momRaw = clamp(10 + c7d * 0.22 + c1m * 0.08, 1, 20);
  const momentumScore = round2(momRaw);
  if (c7d >= 12 || c1m >= 25) signals.push("Accelerating TVL inflow momentum");

  const fdvLog = impliedFdv > 0 ? Math.log10(impliedFdv) : 6;
  const fdvPart = clamp((fdvLog - 7.0) * 5.2, 1, 13);
  const yieldPart = clamp(Math.log10(Math.max(airdrop.yieldPer10kUsd, 10)) * 2.1, 1, 7);
  const upsideScore = round2(clamp(fdvPart + yieldPart, 2, 20));
  if (airdrop.poolUsd >= 40_000_000) signals.push("High-value expected airdrop pool");

  let readiness = 4;
  const listedTs = normalizeListedTs(protocol.listedAt);
  if (listedTs !== null && referenceTs > listedTs) {
    const ageMonths = (referenceTs - listedTs) / (30 * 86400);
    if (ageMonths >= 4 && ageMonths <= 24) {
      readiness += 6;
      signals.push("Prime TGE maturity window (4-24m)");
    } else if (ageMonths > 24) {
      readiness += 3.5;
    } else {
      readiness += 2.5;
    }
  } else {
    readiness += 3;
  }
  if (raisedUsd >= 10_000_000) {
    readiness += 4.5;
    signals.push("Backed by institutional funding");
  } else if (raisedUsd > 0) {
    readiness += 2.5;
  }
  const hasAudits =
    Number(protocol.audits ?? 0) > 0 ||
    (Array.isArray(protocol.audit_links) && protocol.audit_links.length > 0);
  if (hasAudits) readiness += 2.5;
  if (protocol.isWatchlist || protocol.watchlist) {
    readiness += 3;
    signals.push("Tracked on high-priority launch watchlist");
  }
  const readinessScore = round2(clamp(readiness, 2, 20));

  const catNorm = clamp((categoryMultiple / 2.2) * 8, 2, 8.5);
  const chainNorm = clamp(((chainPremium - 0.9) / 0.42) * 6.5, 1.5, 6.5);
  const tailwindScore = round2(clamp(catNorm + chainNorm, 3, 15));
  if (chainPremium >= 1.18) signals.push("High-multiple ecosystem tailwind");

  const score = round2(
    clamp(scaleScore + momentumScore + upsideScore + readinessScore + tailwindScore, 1, 100)
  );
  const tier: "S" | "A" | "B" | "C" | "D" =
    score >= 82 ? "S" : score >= 70 ? "A" : score >= 56 ? "B" : score >= 42 ? "C" : "D";
  const launchProbability = round2(clamp(0.18 + (score / 100) * 0.72, 0.18, 0.92));

  return {
    score,
    tier,
    launchProbability,
    scaleScore,
    momentumScore,
    upsideScore,
    readinessScore,
    tailwindScore,
    signals: signals.slice(0, 4),
  };
}

export function valuateProtocol(
  protocol: ValuationProtocolInput,
  options?: ValuationOptions
): ProtocolValuation {
  const normCat = normalizeCategory(protocol.category);
  const tvl = Math.max(0, finiteOr(protocol.tvl, 0));
  const categoryMultiple = getCategoryMultiple(normCat, options?.benchmarks);
  const chainInfo = getChainPremium(protocol.chains, protocol.chainTvls, protocol.chain);
  const sizeElasticity = computeSizeElasticity(tvl);
  const momentumFactor = computeMomentumFactor(
    protocol.change_1d,
    protocol.change_7d ?? protocol.tvlChange7d,
    protocol.change_1m ?? protocol.tvlChange30d
  );
  const qualityFactor = computeQualityFactor(protocol);

  const tvlBaseUsd = tvl > 0 ? tvl : 8_000_000;
  const tvlImpliedFdv = roundInt(
    tvlBaseUsd * categoryMultiple * sizeElasticity * chainInfo.premium * momentumFactor * qualityFactor
  );

  const annRev = finiteOr(
    protocol.annualizedRevenue,
    finiteOr(protocol.revenue24h, 0) > 0 ? finiteOr(protocol.revenue24h, 0) * 365 : 0
  );
  const annFees = finiteOr(
    protocol.annualizedFees,
    finiteOr(protocol.fees24h, 0) > 0 ? finiteOr(protocol.fees24h, 0) * 365 : 0
  );
  const revMult = CATEGORY_REVENUE_MULTIPLES[normCat] ?? CATEGORY_REVENUE_MULTIPLES.Default;
  let revenueImpliedFdv: number | null = null;
  if (annRev > 100_000) {
    revenueImpliedFdv = roundInt(annRev * revMult * chainInfo.premium);
  } else if (annFees > 250_000) {
    revenueImpliedFdv = roundInt(annFees * (revMult * 0.42) * chainInfo.premium);
  }

  const raisedUsd = normalizeRaisedUsd(protocol);
  const fundingImpliedFdv =
    raisedUsd > 0 ? roundInt(raisedUsd * 4.5 * chainInfo.premium) : null;

  let blended = tvlImpliedFdv;
  let methodology = "TVL-Multiple";
  if (revenueImpliedFdv !== null && fundingImpliedFdv !== null) {
    blended = roundInt(tvlImpliedFdv * 0.5 + revenueImpliedFdv * 0.35 + fundingImpliedFdv * 0.15);
    methodology = "TVL + Revenue + Funding Blend";
  } else if (revenueImpliedFdv !== null) {
    blended = roundInt(tvlImpliedFdv * 0.62 + revenueImpliedFdv * 0.38);
    methodology = "TVL + Revenue Blend";
  } else if (fundingImpliedFdv !== null) {
    const tvlWeight = tvl >= 10_000_000 ? 0.72 : 0.45;
    blended = roundInt(tvlImpliedFdv * tvlWeight + fundingImpliedFdv * (1 - tvlWeight));
    methodology = "TVL + Funding Blend";
  }
  if (fundingImpliedFdv !== null) {
    blended = Math.max(blended, roundInt(fundingImpliedFdv * 0.65));
  }
  const impliedFdv = Math.max(5_000_000, blended);
  const fdvLow = roundInt(impliedFdv * 0.68);
  const fdvHigh = roundInt(impliedFdv * 1.48);

  const airdrop = estimateAirdropPool(impliedFdv, protocol);
  const conviction = computeConvictionScore(
    protocol,
    impliedFdv,
    airdrop,
    categoryMultiple,
    chainInfo.premium,
    options?.referenceTimestamp ?? DEFAULT_REFERENCE_TS
  );

  return {
    impliedFdv,
    impliedValue: impliedFdv,
    fdvLow,
    fdvHigh,
    primaryChain: chainInfo.primaryChain,
    normalizedCategory: normCat,
    breakdown: {
      tvlBaseUsd: roundInt(tvlBaseUsd),
      categoryMultiple,
      sizeElasticity,
      chainPremium: chainInfo.premium,
      multiChainBonus: chainInfo.multiChainBonus,
      momentumFactor,
      qualityFactor,
      tvlImpliedFdv,
      revenueImpliedFdv,
      fundingImpliedFdv,
      fdvLow,
      fdvMid: impliedFdv,
      fdvHigh,
      methodology,
    },
    airdrop,
    conviction,
  };
}

export function valuateAndRankProtocols<T extends ValuationProtocolInput>(
  protocols: ReadonlyArray<T>,
  options?: ValuationOptions
): Array<
  T & {
    valuation: ProtocolValuation;
    impliedFdv: number;
    impliedValue: number;
    airdropPoolUsd: number;
    convictionScore: number;
    convictionTier: "S" | "A" | "B" | "C" | "D";
    rank: number;
  }
> {
  let maxListed = 0;
  for (const p of protocols) {
    const ts = normalizeListedTs(p.listedAt);
    if (ts !== null && ts > maxListed) maxListed = ts;
  }
  const referenceTimestamp =
    options?.referenceTimestamp ?? (maxListed > 0 ? maxListed + 86400 * 30 : DEFAULT_REFERENCE_TS);
  const benchmarks = options?.benchmarks ?? buildCategoryBenchmarks(protocols);
  const resolvedOpts: ValuationOptions = { benchmarks, referenceTimestamp };

  const enriched = protocols.map((protocol) => {
    const valuation = valuateProtocol(protocol, resolvedOpts);
    return {
      ...protocol,
      valuation,
      impliedFdv: valuation.impliedFdv,
      impliedValue: valuation.impliedValue,
      airdropPoolUsd: valuation.airdrop.poolUsd,
      convictionScore: valuation.conviction.score,
      convictionTier: valuation.conviction.tier,
      rank: 0,
    };
  });

  enriched.sort((a, b) => {
    if (b.impliedFdv !== a.impliedFdv) return b.impliedFdv - a.impliedFdv;
    if (b.convictionScore !== a.convictionScore) return b.convictionScore - a.convictionScore;
    const tvlDiff = finiteOr(b.tvl, 0) - finiteOr(a.tvl, 0);
    if (tvlDiff !== 0) return tvlDiff;
    return (a.slug ?? a.name).localeCompare(b.slug ?? b.name);
  });

  for (let i = 0; i < enriched.length; i++) {
    enriched[i].rank = i + 1;
  }
  return enriched;
}