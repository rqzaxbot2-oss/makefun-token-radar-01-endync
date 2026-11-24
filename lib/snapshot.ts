import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

export interface SnapshotRaise {
  amountUsd: number;
  round: string;
  date: string;
  leadInvestors: string[];
  valuationUsd: number | null;
}

export interface SnapshotFeeMetrics {
  dailyUsd: number;
  weeklyUsd: number;
  monthlyUsd: number;
  annualizedUsd: number;
}

export interface SnapshotVolumeMetrics {
  dailyUsd: number;
  monthlyUsd: number;
}

export interface SnapshotProtocol {
  id: string;
  name: string;
  slug: string;
  symbol: string | null;
  gecko_id: string | null;
  cmcId: string | null;
  address: string | null;
  url: string;
  description: string;
  chain: string;
  chains: string[];
  category: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  change_1m: number | null;
  mcap: number | null;
  fdv: number | null;
  parentProtocol: string | null;
  twitter: string | null;
  github: string[];
  audits: number;
  listedAt: number;
  raises: SnapshotRaise[];
  totalRaisedUsd: number;
  fees24h: number;
  fees7d: number;
  fees30d: number;
  feesAnnualized: number;
  revenue24h: number;
  revenue7d: number;
  revenue30d: number;
  revenueAnnualized: number;
  volume24h: number;
  volume30d: number;
  users30d: number;
  hasPoints: boolean;
  pointsProgram: string | null;
  watchlist: boolean;
}

export interface LoadedSnapshot {
  source: string;
  sourceMode: "sealed-file" | "sealed-dir" | "fallback-offline";
  snapshotDate: string;
  snapshotTimestamp: number;
  snapshotHash: string;
  protocols: SnapshotProtocol[];
  watchlist: string[];
  feesBySlug: Record<string, SnapshotFeeMetrics>;
  revenueBySlug: Record<string, SnapshotFeeMetrics>;
  raisesBySlug: Record<string, SnapshotRaise[]>;
  volumesBySlug: Record<string, SnapshotVolumeMetrics>;
  meta: {
    totalRawProtocols: number;
    watchlistCount: number;
    hasFeesData: boolean;
    hasRevenueData: boolean;
    hasRaisesData: boolean;
    loadedFiles: string[];
  };
}

export interface SnapshotLoadOptions {
  snapshotPath?: string;
  cwd?: string;
  forceFallback?: boolean;
}

const DEFAULT_SNAPSHOT_DATE = "2026-04-01T00:00:00.000Z";
const DEFAULT_SNAPSHOT_TS = 1775001600;

const ENV_KEYS = [
  "MAKEFUN_SNAPSHOT_PATH",
  "MAKEFUN_SNAPSHOT_DIR",
  "SNAPSHOT_PATH",
  "SNAPSHOT_DIR",
  "DEFILLAMA_SNAPSHOT",
  "SEALED_SNAPSHOT",
];

const DISK_CANDIDATES = [
  "snapshot.json",
  "snapshot.json.gz",
  "data/snapshot.json",
  "data/snapshot.json.gz",
  "data/protocols.json",
  "sealed/snapshot.json",
  "sealed/protocols.json",
  "snapshot/protocols.json",
  "vendor/snapshot.json",
  "sealed",
  "snapshot",
  "data",
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s === "-" || s.toLowerCase() === "none" || s.toLowerCase() === "null") return null;
  return s;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sha256Hex(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath);
  const text = filePath.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(text);
}

// [slug, name, symbol, geckoId, category, chains, tvlM, fdvM, fees30dM, rev30dM]
type PeerTuple = [string, string, string, string, string, string[], number, number, number, number];
const TOKENED_PEERS: PeerTuple[] = [
  ["aave", "Aave", "AAVE", "aave", "Lending", ["Ethereum", "Arbitrum", "Base", "Polygon"], 21400, 3850, 44.2, 8.9],
  ["uniswap", "Uniswap", "UNI", "uniswap", "Dexes", ["Ethereum", "Arbitrum", "Base", "Optimism"], 5650, 9100, 82.5, 4.1],
  ["lido", "Lido", "LDO", "lido-dao", "Liquid Staking", ["Ethereum"], 28900, 1780, 74.0, 7.4],
  ["pendle", "Pendle", "PENDLE", "pendle", "Yield", ["Ethereum", "Arbitrum", "Base"], 4350, 1290, 5.8, 4.6],
  ["ethena", "Ethena", "ENA", "ethena", "Basis Trading", ["Ethereum"], 5400, 8900, 36.4, 14.5],
  ["eigenlayer", "EigenLayer", "EIGEN", "eigenlayer", "Restaking", ["Ethereum"], 13600, 5200, 4.1, 1.2],
  ["hyperliquid", "Hyperliquid", "HYPE", "hyperliquid", "Derivatives", ["Hyperliquid", "Arbitrum"], 2950, 19800, 52.0, 46.8],
  ["gmx", "GMX", "GMX", "gmx", "Derivatives", ["Arbitrum", "Avalanche"], 580, 340, 11.4, 3.4],
  ["jito", "Jito", "JTO", "jito-governance-token", "Liquid Staking", ["Solana"], 3120, 2950, 48.0, 2.9],
  ["raydium", "Raydium", "RAY", "raydium", "Dexes", ["Solana"], 2480, 2400, 61.2, 7.3],
  ["aerodrome", "Aerodrome", "AERO", "aerodrome-finance", "Dexes", ["Base"], 1320, 1450, 28.6, 25.7],
  ["morpho", "Morpho", "MORPHO", "morpho", "Lending", ["Ethereum", "Base"], 3840, 2150, 12.1, 1.8],
  ["kamino", "Kamino", "KMNO", "kamino", "Lending", ["Solana"], 2210, 1180, 14.4, 3.2],
  ["across", "Across", "ACX", "across-protocol", "Bridge", ["Ethereum", "Arbitrum", "Base", "Optimism"], 195, 420, 3.9, 1.1],
  ["curve-dex", "Curve DEX", "CRV", "curve-dao-token", "Dexes", ["Ethereum", "Arbitrum", "Optimism"], 2040, 1380, 8.7, 4.3],
];

// [slug, name, parentSlug, category, chains, tvlM, fees30dM]
type WrappedTuple = [string, string, string, string, string[], number, number];
const WRAPPED_DERIVATIVES: WrappedTuple[] = [
  ["lido-wsteth", "Lido wstETH", "parent#lido", "Liquid Staking", ["Ethereum", "Arbitrum", "Base"], 14200, 0.2],
  ["jito-jitosol", "JitoSOL Staked SOL", "parent#jito", "Liquid Staking", ["Solana"], 2640, 0.1],
  ["ethena-susde", "Ethena sUSDe", "parent#ethena", "Basis Trading", ["Ethereum"], 3890, 0.4],
  ["aave-v3-wrapped", "Aave V3 Wrapped Markets", "parent#aave", "Lending", ["Ethereum", "Arbitrum"], 6420, 1.8],
  ["uniswap-v4-router", "Uniswap V4 Core", "parent#uniswap", "Dexes", ["Ethereum", "Base"], 1850, 2.1],
  ["pendle-sy-wrappers", "Pendle SY Wrappers", "parent#pendle", "Yield", ["Ethereum", "Arbitrum"], 2190, 0.3],
  ["gmx-v2-glp", "GMX V2 GM Pools", "parent#gmx", "Derivatives", ["Arbitrum"], 410, 0.9],
  ["curve-scrvusd", "Curve scrvUSD", "parent#curve-dex", "CDP", ["Ethereum"], 295, 0.2],
  ["eigenlayer-wrapped-pod", "EigenLayer Wrapped Pod", "parent#eigenlayer", "Restaking", ["Ethereum"], 4150, 0.1],
  ["morpho-blue-vaults", "Morpho Blue Vaults", "parent#morpho", "Lending", ["Ethereum", "Base"], 1720, 0.5],
];

// [slug, name, category, chains, tvlM, fees30dM, rev30dM, vol30dM, raisedM, chg7d, chg30d, points]
type FlagshipTuple = [string, string, string, string[], number, number, number, number, number, number, number, string | null];
const FLAGSHIP_TOKENLESS: FlagshipTuple[] = [
  ["polymarket", "Polymarket", "Prediction Market", ["Polygon"], 485, 18.6, 9.3, 1840, 74, 14.2, 41.5, "Volume & Liquidity Rewards"],
  ["pump-fun", "Pump.fun", "Launchpad", ["Solana"], 312, 46.5, 44.2, 4120, 12, 18.4, 52.0, null],
  ["meteora", "Meteora", "Dexes", ["Solana"], 1140, 29.4, 8.8, 7650, 15, 9.6, 31.2, "MET Points Season 2"],
  ["symbiotic", "Symbiotic", "Restaking", ["Ethereum"], 2380, 4.9, 1.6, 210, 29.8, 6.4, 24.8, "Symbiotic Restaking Points"],
  ["lombard", "Lombard", "Liquid Restaking", ["Ethereum", "Base", "BSC"], 1690, 3.8, 1.4, 340, 16, 7.9, 28.4, "Lombard Lux"],
  ["babylon-staking", "Babylon Staking", "Restaking", ["Bitcoin", "Ethereum"], 4420, 6.2, 2.5, 190, 96, 5.1, 19.6, "Babylon Finality Points"],
  ["axiom-trade", "Axiom Trade", "Derivatives", ["Solana"], 198, 22.8, 18.2, 5420, 18, 24.5, 68.0, "Axiom Trade Points"],
  ["paradex", "Paradex", "Derivatives", ["Starknet"], 345, 7.6, 5.4, 4880, 35, 11.8, 36.2, "Paradex XP Season 2"],
  ["edgex", "EdgeX", "Derivatives", ["Ethereum", "Arbitrum"], 290, 8.9, 6.7, 5190, 22, 15.2, 44.1, "EdgeX Open Season Points"],
  ["lighter", "Lighter", "Derivatives", ["Arbitrum", "Ethereum"], 418, 9.4, 7.1, 6320, 21, 19.3, 55.7, "Lighter Trading Points"],
  ["karak", "Karak", "Restaking", ["Ethereum", "Arbitrum"], 780, 2.1, 0.8, 95, 48, 2.2, 8.4, "Karak XP"],
  ["ostium", "Ostium", "Derivatives", ["Arbitrum"], 142, 3.4, 2.5, 1620, 13.5, 16.8, 49.0, "Ostium Points"],
  ["ethereal", "Ethereal", "Derivatives", ["Ethereum"], 520, 4.7, 3.3, 1940, 20, 12.1, 38.5, "Ethereal Season Zero"],
  ["variational", "Variational", "Derivatives", ["Arbitrum"], 165, 3.9, 2.9, 1780, 11.8, 13.4, 34.0, "Variational Omni Points"],
  ["backpack-exchange", "Backpack Exchange", "Dexes", ["Solana", "Ethereum"], 465, 11.2, 7.8, 4920, 37, 8.7, 29.3, "Backpack Season Points"],
  ["jumper-exchange", "Jumper Exchange", "Bridge", ["Ethereum", "Arbitrum", "Base", "Optimism"], 138, 6.1, 4.9, 2890, 23, 6.9, 21.4, "Jumper Loyalty Pass"],
  ["relay-bridge", "Relay Bridge", "Bridge", ["Base", "Arbitrum", "Ethereum", "Optimism"], 164, 5.4, 4.3, 3140, 14, 14.9, 43.2, "Relay Route Rewards"],
  ["orbiter-finance", "Orbiter Finance", "Bridge", ["Ethereum", "Arbitrum", "zkSync Era", "Base"], 112, 4.8, 3.6, 2150, 10, 4.2, 12.8, "Orbiter O-Points"],
  ["owlto-finance", "Owlto Finance", "Bridge", ["Base", "Arbitrum", "Scroll", "Linea"], 84, 3.2, 2.4, 1480, 8, 5.5, 15.1, "Owlto Points"],
  ["bungee-exchange", "Bungee Exchange", "Bridge", ["Optimism", "Arbitrum", "Base"], 96, 3.6, 2.7, 1720, 12.8, 4.8, 14.6, "Bungee Refuel XP"],
  ["rabby-swap", "Rabby Swap", "Dex Aggregator", ["Ethereum", "Arbitrum", "Base", "BSC"], 72, 6.8, 6.1, 2410, 25, 7.3, 22.9, "Rabby Points"],
  ["phantom-perps", "Phantom Perps", "Derivatives", ["Solana"], 265, 12.4, 9.9, 3680, 118, 11.2, 37.6, null],
  ["treehouse-protocol", "Treehouse Protocol", "Yield", ["Ethereum", "Arbitrum"], 388, 2.7, 1.4, 180, 18, 8.1, 26.5, "Treehouse Nuts"],
  ["level-money", "Level Money", "CDP", ["Ethereum"], 274, 2.9, 1.6, 240, 6.0, 9.4, 31.8, "Level XP"],
  ["resolv-protocol", "Resolv Protocol", "Basis Trading", ["Ethereum", "Base"], 612, 5.8, 2.6, 420, 10, 10.6, 33.4, "Resolv USR Points"],
  ["bedrock-uni", "Bedrock", "Liquid Restaking", ["Ethereum", "BSC", "Arbitrum"], 545, 2.4, 0.9, 160, 12, 5.8, 18.2, "Bedrock Diamonds"],
  ["satlayer", "SatLayer", "Restaking", ["Ethereum", "Bitcoin"], 410, 1.8, 0.7, 110, 8, 9.1, 27.4, "SatLayer Sats"],
  ["corn-network", "Corn Network", "Yield", ["Arbitrum", "Ethereum"], 328, 2.1, 0.9, 195, 6.7, 6.2, 20.5, "Corn Kernels"],
  ["superform", "Superform", "Yield Aggregator", ["Base", "Arbitrum", "Ethereum"], 186, 1.9, 1.1, 280, 9.5, 7.4, 23.1, "Superform CRED"],
  ["ambient-finance", "Ambient Finance", "Dexes", ["Scroll", "Ethereum", "Blast"], 218, 2.6, 0.9, 1180, 6.5, 3.8, 11.2, "Ambient Points"],
  ["syncswap", "SyncSwap", "Dexes", ["zkSync Era", "Linea", "Scroll"], 174, 2.3, 0.8, 940, 5.5, 2.9, 9.4, "SyncSwap Loyalty"],
  ["kuru-exchange", "Kuru Exchange", "Dexes", ["Monad", "Ethereum"], 128, 2.5, 1.2, 860, 11.6, 17.4, 48.2, "Kuru Orderbook XP"],
  ["kodiak-finance", "Kodiak Finance", "Dexes", ["Berachain"], 492, 4.3, 1.7, 1520, 5.3, 12.8, 39.0, "Kodiak Sweetened Points"],
  ["infinit-labs", "Infinit Labs", "Lending", ["Ethereum", "Mantle", "Arbitrum"], 235, 2.2, 1.0, 290, 6.0, 8.9, 25.3, "Infinit Stones"],
  ["upshift-finance", "Upshift Finance", "Yield", ["Ethereum", "Avalanche", "Base"], 356, 3.1, 1.5, 310, 10, 10.2, 30.8, "Upshift Points"],
];

const GEN_PREFIXES = [
  "Aether", "Boreal", "Cinder", "Delta", "Echelon",
  "Flux", "Glacier", "Helios", "Iris", "Juno",
  "Kestrel", "Lumen", "Meridian", "Nimbus", "Onyx",
];
const GEN_SUFFIXES = ["Finance", "Protocol", "Exchange", "Vaults", "Markets"];
const GEN_CATEGORIES = [
  "Dexes", "Lending", "Derivatives", "Restaking", "Yield", "Bridge",
  "CDP", "RWA", "Liquid Restaking", "Options", "Dex Aggregator", "Yield Aggregator",
];
const GEN_CHAINS = [
  "Ethereum", "Arbitrum", "Base", "Solana", "Optimism", "Polygon",
  "Avalanche", "BSC", "Starknet", "Scroll", "Linea", "zkSync Era", "Berachain", "Sonic",
];
const INVESTORS = [
  "Paradigm", "Polychain Capital", "Dragonfly", "Multicoin Capital",
  "a16z Crypto", "Framework Ventures", "Hack VC", "Pantera Capital",
  "Galaxy Digital", "Variant", "Coinbase Ventures", "Electric Capital",
];

function makeChainTvls(chains: string[], totalTvl: number, rand: () => number): Record<string, number> {
  const out: Record<string, number> = {};
  if (chains.length === 1) {
    out[chains[0]] = Math.round(totalTvl);
    return out;
  }
  const weights = chains.map((_, idx) => Math.pow(0.58, idx) * (0.8 + rand() * 0.4));
  const sum = weights.reduce((a, b) => a + b, 0);
  let remaining = Math.round(totalTvl);
  for (let i = 0; i < chains.length; i++) {
    const share = i === chains.length - 1 ? remaining : Math.round((totalTvl * weights[i]) / sum);
    out[chains[i]] = Math.max(0, share);
    remaining -= share;
  }
  return out;
}

export function buildFallbackSnapshot(): LoadedSnapshot {
  const rand = mulberry32(20260401);
  const protocols: SnapshotProtocol[] = [];
  const watchlist: string[] = [];
  const feesBySlug: Record<string, SnapshotFeeMetrics> = {};
  const revenueBySlug: Record<string, SnapshotFeeMetrics> = {};
  const raisesBySlug: Record<string, SnapshotRaise[]> = {};
  const volumesBySlug: Record<string, SnapshotVolumeMetrics> = {};

  let idSeq = 1001;

  const pushProto = (p: SnapshotProtocol) => {
    protocols.push(p);
    feesBySlug[p.slug] = {
      dailyUsd: p.fees24h,
      weeklyUsd: p.fees7d,
      monthlyUsd: p.fees30d,
      annualizedUsd: p.feesAnnualized,
    };
    revenueBySlug[p.slug] = {
      dailyUsd: p.revenue24h,
      weeklyUsd: p.revenue7d,
      monthlyUsd: p.revenue30d,
      annualizedUsd: p.revenueAnnualized,
    };
    if (p.raises.length > 0) raisesBySlug[p.slug] = p.raises;
    if (p.volume30d > 0) volumesBySlug[p.slug] = { dailyUsd: p.volume24h, monthlyUsd: p.volume30d };
    if (p.watchlist) watchlist.push(p.slug);
  };

  for (const [slug, name, symbol, geckoId, category, chains, tvlM, fdvM, fees30dM, rev30dM] of TOKENED_PEERS) {
    const tvl = tvlM * 1e6;
    const fdv = fdvM * 1e6;
    const fees30d = fees30dM * 1e6;
    const rev30d = rev30dM * 1e6;
    const vol30d = category === "Dexes" || category === "Derivatives" ? fees30d * 280 : fees30d * 24;
    pushProto({
      id: String(idSeq++),
      name,
      slug,
      symbol,
      gecko_id: geckoId,
      cmcId: String(2000 + idSeq),
      address: `0x${sha256Hex(slug).slice(0, 40)}`,
      url: `https://${slug}.org`,
      description: `${name} is an established ${category.toLowerCase()} protocol with a live governance token (${symbol}).`,
      chain: chains[0],
      chains,
      category,
      tvl,
      chainTvls: makeChainTvls(chains, tvl, rand),
      change_1h: round2((rand() - 0.48) * 1.4),
      change_1d: round2((rand() - 0.46) * 5.2),
      change_7d: round2((rand() - 0.42) * 14.0),
      change_1m: round2((rand() - 0.38) * 28.0),
      mcap: Math.round(fdv * (0.42 + rand() * 0.35)),
      fdv,
      parentProtocol: null,
      twitter: slug.replace(/-/g, ""),
      github: [slug],
      audits: 4,
      listedAt: DEFAULT_SNAPSHOT_TS - Math.round((420 + rand() * 900) * 86400),
      raises: [],
      totalRaisedUsd: 0,
      fees24h: Math.round(fees30d / 30),
      fees7d: Math.round((fees30d * 7) / 30),
      fees30d: Math.round(fees30d),
      feesAnnualized: Math.round(fees30d * 12),
      revenue24h: Math.round(rev30d / 30),
      revenue7d: Math.round((rev30d * 7) / 30),
      revenue30d: Math.round(rev30d),
      revenueAnnualized: Math.round(rev30d * 12),
      volume24h: Math.round(vol30d / 30),
      volume30d: Math.round(vol30d),
      users30d: Math.round(18000 + (fees30d / 1e6) * 2800),
      hasPoints: false,
      pointsProgram: null,
      watchlist: false,
    });
  }

  for (const [slug, name, parentProtocol, category, chains, tvlM, fees30dM] of WRAPPED_DERIVATIVES) {
    const tvl = tvlM * 1e6;
    const fees30d = fees30dM * 1e6;
    pushProto({
      id: String(idSeq++),
      name,
      slug,
      symbol: null,
      gecko_id: null,
      cmcId: null,
      address: null,
      url: `https://${slug}.fi`,
      description: `${name} is a wrapped or staked receipt module belonging to an existing tokened parent protocol.`,
      chain: chains[0],
      chains,
      category,
      tvl,
      chainTvls: makeChainTvls(chains, tvl, rand),
      change_1h: round2((rand() - 0.5) * 1.1),
      change_1d: round2((rand() - 0.48) * 3.8),
      change_7d: round2((rand() - 0.45) * 10.2),
      change_1m: round2((rand() - 0.4) * 20.0),
      mcap: null,
      fdv: null,
      parentProtocol,
      twitter: null,
      github: [slug],
      audits: 3,
      listedAt: DEFAULT_SNAPSHOT_TS - Math.round((260 + rand() * 520) * 86400),
      raises: [],
      totalRaisedUsd: 0,
      fees24h: Math.round(fees30d / 30),
      fees7d: Math.round((fees30d * 7) / 30),
      fees30d: Math.round(fees30d),
      feesAnnualized: Math.round(fees30d * 12),
      revenue24h: Math.round((fees30d * 0.25) / 30),
      revenue7d: Math.round((fees30d * 0.25 * 7) / 30),
      revenue30d: Math.round(fees30d * 0.25),
      revenueAnnualized: Math.round(fees30d * 3),
      volume24h: Math.round((fees30d * 40) / 30),
      volume30d: Math.round(fees30d * 40),
      users30d: Math.round(9500 + rand() * 14000),
      hasPoints: false,
      pointsProgram: null,
      watchlist: false,
    });
  }

  for (const [slug, name, category, chains, tvlM, fees30dM, rev30dM, vol30dM, raisedM, chg7d, chg30d, points] of FLAGSHIP_TOKENLESS) {
    const tvl = tvlM * 1e6;
    const fees30d = fees30dM * 1e6;
    const rev30d = rev30dM * 1e6;
    const vol30d = vol30dM * 1e6;
    const invA = INVESTORS[Math.floor(rand() * INVESTORS.length)];
    const invB = INVESTORS[Math.floor(rand() * INVESTORS.length)];
    const raises: SnapshotRaise[] = raisedM > 0 ? [{
      amountUsd: Math.round(raisedM * 1e6),
      round: raisedM >= 25 ? "Series B" : raisedM >= 10 ? "Series A" : "Seed",
      date: "2025-06-15",
      leadInvestors: invA === invB ? [invA] : [invA, invB],
      valuationUsd: Math.round(raisedM * (8 + rand() * 6) * 1e6),
    }] : [];
    pushProto({
      id: String(idSeq++),
      name,
      slug,
      symbol: null,
      gecko_id: null,
      cmcId: null,
      address: null,
      url: `https://${slug}.xyz`,
      description: `${name} is a leading tokenless ${category.toLowerCase()} protocol operating across ${chains.join(", ")}.`,
      chain: chains[0],
      chains,
      category,
      tvl,
      chainTvls: makeChainTvls(chains, tvl, rand),
      change_1h: round2((rand() - 0.44) * 1.8),
      change_1d: round2(chg7d / 5 + (rand() - 0.5) * 2.2),
      change_7d: chg7d,
      change_1m: chg30d,
      mcap: null,
      fdv: null,
      parentProtocol: null,
      twitter: slug.replace(/-/g, ""),
      github: [slug],
      audits: 2 + Math.floor(rand() * 3),
      listedAt: DEFAULT_SNAPSHOT_TS - Math.round((120 + rand() * 480) * 86400),
      raises,
      totalRaisedUsd: raises.reduce((acc, r) => acc + r.amountUsd, 0),
      fees24h: Math.round(fees30d / 30),
      fees7d: Math.round((fees30d * 7) / 30),
      fees30d: Math.round(fees30d),
      feesAnnualized: Math.round(fees30d * 12),
      revenue24h: Math.round(rev30d / 30),
      revenue7d: Math.round((rev30d * 7) / 30),
      revenue30d: Math.round(rev30d),
      revenueAnnualized: Math.round(rev30d * 12),
      volume24h: Math.round(vol30d / 30),
      volume30d: Math.round(vol30d),
      users30d: Math.round(12000 + fees30dM * 4200 + tvlM * 25),
      hasPoints: Boolean(points),
      pointsProgram: points,
      watchlist: true,
    });
  }

  let genIdx = 0;
  for (const prefix of GEN_PREFIXES) {
    for (const suffix of GEN_SUFFIXES) {
      const name = `${prefix} ${suffix}`;
      const slug = toSlug(name);
      const category = GEN_CATEGORIES[genIdx % GEN_CATEGORIES.length];
      const chainCount = 1 + (genIdx % 3);
      const chains: string[] = [];
      for (let c = 0; c < chainCount; c++) {
        const ch = GEN_CHAINS[(genIdx * 3 + c * 5) % GEN_CHAINS.length];
        if (!chains.includes(ch)) chains.push(ch);
      }
      const rankFactor = Math.pow(1 - genIdx / 82, 2.35);
      const tvl = Math.round((8.5 + rankFactor * 410 + rand() * 32) * 1e6);
      const feeRate =
        category === "Derivatives" || category === "Dex Aggregator" ? 0.016 :
        category === "Dexes" || category === "Bridge" || category === "Options" ? 0.011 :
        category === "Lending" || category === "CDP" ? 0.0065 : 0.0042;
      const fees30d = Math.round(tvl * feeRate * (0.65 + rand() * 0.9));
      const revShare = category === "Derivatives" || category === "Bridge" ? 0.62 : 0.34;
      const rev30d = Math.round(fees30d * revShare);
      const volMult = category === "Dexes" || category === "Derivatives" || category === "Bridge" ? 185 : 22;
      const vol30d = Math.round(fees30d * volMult);
      const hasRaise = rand() > 0.28;
      const raiseAmt = hasRaise ? Math.round((2.5 + rankFactor * 24 + rand() * 8) * 1e6) : 0;
      const lead = INVESTORS[(genIdx * 7) % INVESTORS.length];
      const raises: SnapshotRaise[] = hasRaise ? [{
        amountUsd: raiseAmt,
        round: raiseAmt >= 14e6 ? "Series A" : "Seed",
        date: `2025-0${1 + (genIdx % 9)}-12`,
        leadInvestors: [lead],
        valuationUsd: Math.round(raiseAmt * (7 + rand() * 5)),
      }] : [];
      const hasPoints = rand() > 0.32;
      const chg7d = round2((rand() - 0.34) * 26);
      const chg30d = round2(chg7d * 2.4 + (rand() - 0.35) * 22);
      pushProto({
        id: String(idSeq++),
        name,
        slug,
        symbol: null,
        gecko_id: null,
        cmcId: null,
        address: null,
        url: `https://${slug}.finance`,
        description: `${name} is a tokenless ${category.toLowerCase()} protocol deployed on ${chains.join(", ")}.`,
        chain: chains[0],
        chains,
        category,
        tvl,
        chainTvls: makeChainTvls(chains, tvl, rand),
        change_1h: round2((rand() - 0.48) * 1.5),
        change_1d: round2(chg7d / 5 + (rand() - 0.5) * 2.0),
        change_7d: chg7d,
        change_1m: chg30d,
        mcap: null,
        fdv: null,
        parentProtocol: null,
        twitter: slug.replace(/-/g, ""),
        github: [slug],
        audits: 1 + (genIdx % 3),
        listedAt: DEFAULT_SNAPSHOT_TS - Math.round((75 + rand() * 440) * 86400),
        raises,
        totalRaisedUsd: raiseAmt,
        fees24h: Math.round(fees30d / 30),
        fees7d: Math.round((fees30d * 7) / 30),
        fees30d,
        feesAnnualized: fees30d * 12,
        revenue24h: Math.round(rev30d / 30),
        revenue7d: Math.round((rev30d * 7) / 30),
        revenue30d: rev30d,
        revenueAnnualized: rev30d * 12,
        volume24h: Math.round(vol30d / 30),
        volume30d: vol30d,
        users30d: Math.round(2400 + (tvl / 1e6) * 42 + (fees30d / 1e5) * 350),
        hasPoints,
        pointsProgram: hasPoints ? `${prefix} Loyalty Points` : null,
        watchlist: false,
      });
      genIdx++;
    }
  }

  protocols.sort((a, b) => b.tvl - a.tvl || a.slug.localeCompare(b.slug));
  watchlist.sort();
  return {
    source: "builtin://deterministic-135-snapshot",
    sourceMode: "fallback-offline",
    snapshotDate: DEFAULT_SNAPSHOT_DATE,
    snapshotTimestamp: DEFAULT_SNAPSHOT_TS,
    snapshotHash: sha256Hex({ protocols: protocols.map((p) => [p.slug, p.tvl, p.fees30d]), watchlist }),
    protocols,
    watchlist,
    feesBySlug,
    revenueBySlug,
    raisesBySlug,
    volumesBySlug,
    meta: {
      totalRawProtocols: protocols.length,
      watchlistCount: watchlist.length,
      hasFeesData: true,
      hasRevenueData: true,
      hasRaisesData: true,
      loadedFiles: [],
    },
  };
}

function indexFeePayload(raw: unknown): Record<string, SnapshotFeeMetrics> {
  const out: Record<string, SnapshotFeeMetrics> = {};
  if (!raw || typeof raw !== "object") return out;
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>).protocols)
      ? ((raw as Record<string, unknown>).protocols as unknown[])
      : [];
  if (rows.length > 0) {
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const r = item as Record<string, unknown>;
      const slug = toSlug(String(r.slug ?? r.defillamaId ?? r.name ?? ""));
      if (!slug) continue;
      const d = num(r.total24h ?? r.dailyUsd ?? r.fees24h ?? r.revenue24h);
      const w = num(r.total7d ?? r.weeklyUsd ?? r.fees7d ?? r.revenue7d, d * 7);
      const m = num(r.total30d ?? r.monthlyUsd ?? r.fees30d ?? r.revenue30d, d * 30);
      out[slug] = { dailyUsd: d, weeklyUsd: w, monthlyUsd: m, annualizedUsd: m * 12 };
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const slug = toSlug(k);
    if (typeof v === "number") {
      out[slug] = { dailyUsd: v / 30, weeklyUsd: (v * 7) / 30, monthlyUsd: v, annualizedUsd: v * 12 };
    } else if (v && typeof v === "object") {
      const r = v as Record<string, unknown>;
      const d = num(r.total24h ?? r.dailyUsd);
      const m = num(r.total30d ?? r.monthlyUsd, d * 30);
      out[slug] = { dailyUsd: d, weeklyUsd: num(r.total7d ?? r.weeklyUsd, d * 7), monthlyUsd: m, annualizedUsd: m * 12 };
    }
  }
  return out;
}

function indexRaisesPayload(raw: unknown): Record<string, SnapshotRaise[]> {
  const out: Record<string, SnapshotRaise[]> = {};
  if (!raw || typeof raw !== "object") return out;
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>).raises)
      ? ((raw as Record<string, unknown>).raises as unknown[])
      : [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const slug = toSlug(String(r.slug ?? r.defillamaId ?? r.name ?? ""));
    if (!slug) continue;
    const rawAmt = num(r.amountUsd ?? r.amount);
    const amountUsd = r.amountUsd !== undefined ? rawAmt : rawAmt < 5000 ? rawAmt * 1e6 : rawAmt;
    const lead = Array.isArray(r.leadInvestors) ? r.leadInvestors.map(String) : [];
    const entry: SnapshotRaise = {
      amountUsd: Math.round(amountUsd),
      round: String(r.round ?? "Venture"),
      date: typeof r.date === "number" ? new Date(r.date * 1000).toISOString().slice(0, 10) : String(r.date ?? "2025-01-01"),
      leadInvestors: lead,
      valuationUsd: r.valuationUsd !== undefined ? num(r.valuationUsd) : r.valuation ? num(r.valuation) * 1e6 : null,
    };
    (out[slug] ??= []).push(entry);
  }
  return out;
}

function normalizeWatchlist(raw: unknown): string[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).watchlist)
      ? ((raw as Record<string, unknown>).watchlist as unknown[])
      : [];
  const slugs = new Set<string>();
  for (const item of list) {
    if (typeof item === "string" && item.trim()) slugs.add(toSlug(item));
    else if (item && typeof item === "object") {
      const r = item as Record<string, unknown>;
      const s = cleanStr(r.slug ?? r.name);
      if (s) slugs.add(toSlug(s));
    }
  }
  return Array.from(slugs).sort();
}

function normalizeRawProtocol(
  raw: Record<string, unknown>,
  idx: number,
  feesMap: Record<string, SnapshotFeeMetrics>,
  revMap: Record<string, SnapshotFeeMetrics>,
  raisesMap: Record<string, SnapshotRaise[]>,
  volMap: Record<string, SnapshotVolumeMetrics>,
  watchSet: Set<string>,
): SnapshotProtocol {
  const name = String(raw.name ?? raw.slug ?? `Protocol ${idx + 1}`);
  const slug = toSlug(String(raw.slug ?? name));
  const chains = Array.isArray(raw.chains) && raw.chains.length > 0
    ? raw.chains.map(String)
    : [String(raw.chain ?? "Ethereum")];
  const tvl = Math.max(0, num(raw.tvl));
  const f = feesMap[slug];
  const rv = revMap[slug];
  const vl = volMap[slug];
  const fees30d = num(raw.fees30d, f?.monthlyUsd ?? 0);
  const rev30d = num(raw.revenue30d, rv?.monthlyUsd ?? 0);
  const vol30d = num(raw.volume30d, vl?.monthlyUsd ?? 0);
  const raises = Array.isArray(raw.raises) ? (raw.raises as SnapshotRaise[]) : (raisesMap[slug] ?? []);
  const chainTvls: Record<string, number> = {};
  if (raw.chainTvls && typeof raw.chainTvls === "object") {
    for (const [k, v] of Object.entries(raw.chainTvls as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && !k.includes("-")) chainTvls[k] = v;
    }
  }
  const pointsProgram = cleanStr(raw.pointsProgram);
  return {
    id: String(raw.id ?? idx + 1),
    name,
    slug,
    symbol: cleanStr(raw.symbol),
    gecko_id: cleanStr(raw.gecko_id ?? raw.geckoId),
    cmcId: cleanStr(raw.cmcId),
    address: cleanStr(raw.address),
    url: String(raw.url ?? `https://defillama.com/protocol/${slug}`),
    description: String(raw.description ?? `${name} (${String(raw.category ?? "DeFi")})`),
    chain: String(raw.chain ?? chains[0]),
    chains,
    category: String(raw.category ?? "DeFi"),
    tvl,
    chainTvls,
    change_1h: raw.change_1h == null ? null : num(raw.change_1h),
    change_1d: raw.change_1d == null ? null : num(raw.change_1d),
    change_7d: raw.change_7d == null ? null : num(raw.change_7d),
    change_1m: raw.change_1m == null ? null : num(raw.change_1m),
    mcap: raw.mcap == null ? null : num(raw.mcap),
    fdv: raw.fdv == null ? null : num(raw.fdv),
    parentProtocol: cleanStr(raw.parentProtocol),
    twitter: cleanStr(raw.twitter),
    github: Array.isArray(raw.github) ? raw.github.map(String) : [],
    audits: num(raw.audits, 0),
    listedAt: num(raw.listedAt, DEFAULT_SNAPSHOT_TS - 180 * 86400),
    raises,
    totalRaisedUsd: raises.reduce((acc, r) => acc + num(r.amountUsd), 0),
    fees24h: num(raw.fees24h, f?.dailyUsd ?? fees30d / 30),
    fees7d: num(raw.fees7d, f?.weeklyUsd ?? (fees30d * 7) / 30),
    fees30d,
    feesAnnualized: fees30d * 12,
    revenue24h: num(raw.revenue24h, rv?.dailyUsd ?? rev30d / 30),
    revenue7d: num(raw.revenue7d, rv?.weeklyUsd ?? (rev30d * 7) / 30),
    revenue30d: rev30d,
    revenueAnnualized: rev30d * 12,
    volume24h: num(raw.volume24h, vl?.dailyUsd ?? vol30d / 30),
    volume30d: vol30d,
    users30d: num(raw.users30d, Math.round(1500 + tvl / 80000)),
    hasPoints: Boolean(raw.hasPoints || pointsProgram),
    pointsProgram,
    watchlist: Boolean(raw.watchlist || watchSet.has(slug)),
  };
}

export function resolveSnapshotSource(input?: string | SnapshotLoadOptions): string | null {
  const opts: SnapshotLoadOptions = typeof input === "string" ? { snapshotPath: input } : (input ?? {});
  if (opts.forceFallback) return null;
  const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd();
  const explicit = [opts.snapshotPath, ...ENV_KEYS.map((k) => process.env[k])].filter((v): v is string => Boolean(v));
  for (const candidate of explicit) {
    const abs = resolve(cwd, candidate);
    if (existsSync(abs)) return abs;
  }
  for (const rel of DISK_CANDIDATES) {
    const abs = join(cwd, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

function hydrateSnapshot(
  source: string,
  sourceMode: "sealed-file" | "sealed-dir",
  rawProtocols: unknown[],
  feesBySlug: Record<string, SnapshotFeeMetrics>,
  revenueBySlug: Record<string, SnapshotFeeMetrics>,
  raisesBySlug: Record<string, SnapshotRaise[]>,
  volumesBySlug: Record<string, SnapshotVolumeMetrics>,
  watchlist: string[],
  snapshotDate: string,
  loadedFiles: string[],
): LoadedSnapshot {
  const watchSet = new Set(watchlist);
  const protocols = rawProtocols
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item, idx) => normalizeRawProtocol(item, idx, feesBySlug, revenueBySlug, raisesBySlug, volumesBySlug, watchSet))
    .sort((a, b) => b.tvl - a.tvl || a.slug.localeCompare(b.slug));
  const ts = Math.floor(Date.parse(snapshotDate) / 1000) || DEFAULT_SNAPSHOT_TS;
  return {
    source,
    sourceMode,
    snapshotDate,
    snapshotTimestamp: ts,
    snapshotHash: sha256Hex({ protocols: protocols.map((p) => [p.slug, Math.round(p.tvl)]), watchlist }),
    protocols,
    watchlist,
    feesBySlug,
    revenueBySlug,
    raisesBySlug,
    volumesBySlug,
    meta: {
      totalRawProtocols: protocols.length,
      watchlistCount: watchlist.length,
      hasFeesData: Object.keys(feesBySlug).length > 0,
      hasRevenueData: Object.keys(revenueBySlug).length > 0,
      hasRaisesData: Object.keys(raisesBySlug).length > 0,
      loadedFiles: loadedFiles.slice().sort(),
    },
  };
}

function loadFromDirectory(dirPath: string): LoadedSnapshot | null {
  const tryRead = (names: string[]): { data: unknown; file: string } | null => {
    for (const n of names) {
      const p = join(dirPath, n);
      if (existsSync(p) && statSync(p).isFile()) return { data: readJsonFile(p), file: n };
    }
    return null;
  };
  const protoHit = tryRead(["protocols.json", "protocols.json.gz", "snapshot.json", "snapshot.json.gz"]);
  if (!protoHit) return null;
  const loadedFiles = [protoHit.file];
  const root = protoHit.data;
  const rawProtocols: unknown[] = Array.isArray(root)
    ? root
    : Array.isArray((root as Record<string, unknown>).protocols)
      ? ((root as Record<string, unknown>).protocols as unknown[])
      : [];
  const feesHit = tryRead(["fees.json", "fees.json.gz"]);
  const revHit = tryRead(["revenue.json", "revenue.json.gz"]);
  const raisesHit = tryRead(["raises.json", "raises.json.gz"]);
  const volHit = tryRead(["volumes.json", "dexs.json", "derivatives.json"]);
  const watchHit = tryRead(["watchlist.json"]);
  for (const hit of [feesHit, revHit, raisesHit, volHit, watchHit]) {
    if (hit) loadedFiles.push(hit.file);
  }
  const volFees = indexFeePayload(volHit?.data);
  const volumesBySlug: Record<string, SnapshotVolumeMetrics> = {};
  for (const [k, v] of Object.entries(volFees)) volumesBySlug[k] = { dailyUsd: v.dailyUsd, monthlyUsd: v.monthlyUsd };
  return hydrateSnapshot(
    dirPath,
    "sealed-dir",
    rawProtocols,
    indexFeePayload(feesHit?.data),
    indexFeePayload(revHit?.data),
    indexRaisesPayload(raisesHit?.data),
    volumesBySlug,
    normalizeWatchlist(watchHit?.data ?? (root as Record<string, unknown>).watchlist),
    String((root as Record<string, unknown>).snapshotDate ?? DEFAULT_SNAPSHOT_DATE),
    loadedFiles,
  );
}

export function loadSnapshot(input?: string | SnapshotLoadOptions): LoadedSnapshot {
  const resolved = resolveSnapshotSource(input);
  if (!resolved) return buildFallbackSnapshot();
  const st = statSync(resolved);
  if (st.isDirectory()) {
    return loadFromDirectory(resolved) ?? buildFallbackSnapshot();
  }
  const data = readJsonFile(resolved);
  if (Array.isArray(data)) {
    return hydrateSnapshot(resolved, "sealed-file", data, {}, {}, {}, {}, [], DEFAULT_SNAPSHOT_DATE, [resolved]);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const rawProtocols = Array.isArray(obj.protocols) ? obj.protocols : [];
    if (rawProtocols.length === 0) return buildFallbackSnapshot();
    const volFees = indexFeePayload(obj.volumes ?? obj.dexs);
    const volumesBySlug: Record<string, SnapshotVolumeMetrics> = {};
    for (const [k, v] of Object.entries(volFees)) volumesBySlug[k] = { dailyUsd: v.dailyUsd, monthlyUsd: v.monthlyUsd };
    return hydrateSnapshot(
      resolved,
      "sealed-file",
      rawProtocols,
      indexFeePayload(obj.fees ?? obj.feesBySlug),
      indexFeePayload(obj.revenue ?? obj.revenueBySlug),
      indexRaisesPayload(obj.raises ?? obj.raisesBySlug),
      volumesBySlug,
      normalizeWatchlist(obj.watchlist),
      String(obj.snapshotDate ?? obj.capturedAt ?? DEFAULT_SNAPSHOT_DATE),
      [resolved],
    );
  }
  return buildFallbackSnapshot();
}

export const loadSealedSnapshot = loadSnapshot;
export const SNAPSHOT_FALLBACK_COUNT = 135;