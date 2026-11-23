import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RawProtocol {
  name?: string;
  slug?: string;
  symbol?: string;
  category?: string;
  chains?: string[];
  tvl?: number | null;
  chainTvls?: Record<string, number>;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  mcap?: number | null;
  listedAt?: number | null;
  url?: string;
  twitter?: string;
  description?: string;
  audits?: string | number | null;
  audit_links?: string[];
  oracles?: string[];
  forkedFrom?: string[];
  parentProtocol?: string;
  referralUrl?: string;
  logo?: string;
  gecko_id?: string | null;
  token?: string | null;
  [k: string]: unknown;
}

interface FarmStep {
  step: number;
  action: string;
  detail: string;
  cost: string;
  payoff: string;
}

interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl: number;
  tvl7d: number | null;
  tvl1m: number | null;
  momentum: number;
  impliedValue: number;
  impliedLow: number;
  impliedHigh: number;
  confidence: number;
  score: number;
  tier: "S" | "A" | "B" | "C";
  reason: string;
  farmPlan: FarmStep[];
  url: string;
  twitter: string | null;
  description: string;
  audits: number;
  oracles: string[];
  forkedFrom: string[];
  parent: string | null;
}

// ---------------------------------------------------------------------------
// Category multiples: implied FDV = TVL * multiple (median tokenized peer)
// ---------------------------------------------------------------------------
const CATEGORY_MULTIPLE: Record<string, { mult: number; spread: number; note: string }> = {
  "Liquid Staking": { mult: 0.28, spread: 0.35, note: "LST tokens trade well under TVL; staked product risk" },
  "Liquid Restaking": { mult: 0.22, spread: 0.4, note: "restaking points already priced by peers" },
  "Bridge": { mult: 0.9, spread: 0.5, note: "bridges trade near TVL on volume" },
  "Dexes": { mult: 0.75, spread: 0.45, note: "DEX tokens trade at a discount to TVL" },
  "DEX": { mult: 0.75, spread: 0.45, note: "DEX tokens trade at a discount to TVL" },
  "Lending": { mult: 0.55, spread: 0.4, note: "lending protocols price on borrow demand" },
  "CDP": { mult: 0.5, spread: 0.45, note: "stablecoin issuers price on supply" },
  "Yield": { mult: 0.35, spread: 0.5, note: "yield aggregators price on AUM share" },
  "Yield Aggregator": { mult: 0.35, spread: 0.5, note: "yield aggregators price on AUM share" },
  "Perp DEX": { mult: 1.1, spread: 0.5, note: "perps command premium on volume" },
  "Derivatives": { mult: 0.9, spread: 0.5, note: "derivatives price on open interest" },
  "Options": { mult: 0.7, spread: 0.5, note: "options venues price on notional" },
  "Lending & CDP": { mult: 0.55, spread: 0.4, note: "lending and CDP price on borrow demand" },
  "Stablecoin Issuer": { mult: 0.6, spread: 0.45, note: "issuers price on supply" },
  "RWA": { mult: 0.5, spread: 0.55, note: "RWA prices on TVL with regulatory discount" },
  "Liquidity Manager": { mult: 0.3, spread: 0.5, note: "managers price on managed liquidity" },
  "Launchpad": { mult: 1.3, spread: 0.6, note: "launchpads price on fee flow" },
  "Prediction Market": { mult: 1.0, spread: 0.6, note: "prediction markets price on volume" },
  "Gaming": { mult: 0.4, spread: 0.6, note: "gaming prices on active users" },
  "NFT Marketplace": { mult: 0.35, spread: 0.6, note: "NFT venues price on take rate" },
  "Indexes": { mult: 0.3, spread: 0.5, note: "index products price on AUM" },
  "Insurance": { mult: 0.3, spread: 0.6, note: "insurance prices on covered capital" },
  "Farm": { mult: 0.25, spread: 0.5, note: "farms price on emissions" },
  "Algo-Stables": { mult: 0.3, spread: 0.6, note: "algo-stables price on supply" },
  "CEX": { mult: 0.4, spread: 0.5, note: "CEX prices on volume" },
  "Chain": { mult: 0.6, spread: 0.5, note: "chains price on TVL and activity" },
  "Canonical Bridge": { mult: 0.8, spread: 0.5, note: "canonical bridges price on TVL" },
  "Cross Chain Bridge": { mult: 0.8, spread: 0.5, note: "bridges price on TVL" },
  "Restaking": { mult: 0.25, spread: 0.4, note: "restaking prices on secured value" },
  "Staking Pool": { mult: 0.25, spread: 0.4, note: "staking pools price on stake" },
  "Staking": { mult: 0.25, spread: 0.4, note: "staking prices on stake" },
  "Basis Trading": { mult: 0.4, spread: 0.5, note: "basis trading prices on capital" },
  "Synthetics": { mult: 0.6, spread: 0.5, note: "synthetics price on open interest" },
  "Onchain Capital Allocator": { mult: 0.35, spread: 0.5, note: "allocators price on AUM" },
  "Vault": { mult: 0.35, spread: 0.5, note: "vaults price on AUM" },
  "SoFi": { mult: 0.5, spread: 0.5, note: "SoFi prices on TVL" },
  "Telegram Bot": { mult: 0.6, spread: 0.6, note: "bots price on volume" },
  "Trading App": { mult: 0.6, spread: 0.6, note: "trading apps price on volume" },
  "Wallet": { mult: 0.5, spread: 0.6, note: "wallets price on users" },
  "Payments": { mult: 0.5, spread: 0.6, note: "payments price on volume" },
  "Oracle": { mult: 0.8, spread: 0.5, note: "oracles price on integrations" },
  "MEV": { mult: 0.7, spread: 0.5, note: "MEV prices on extracted value" },
  "Reserve Currency": { mult: 0.5, spread: 0.5, note: "reserve currencies price on supply" },
  "Uncollateralized Lending": { mult: 0.5, spread: 0.5, note: "lending prices on borrow demand" },
  "Leveraged Farming": { mult: 0.3, spread: 0.5, note: "leveraged farming prices on TVL" },
  "Fixed Rate Lending": { mult: 0.5, spread: 0.5, note: "fixed lending prices on TVL" },
  "Liquidity": { mult: 0.4, spread: 0.5, note: "liquidity prices on TVL" },
  "OTC Marketplace": { mult: 0.4, spread: 0.5, note: "OTC prices on volume" },
  "DCA": { mult: 0.4, spread: 0.5, note: "DCA prices on volume" },
  "Charity": { mult: 0.2, spread: 0.6, note: "charity prices on donations" },
  "Other": { mult: 0.4, spread: 0.5, note: "generic multiple" },
};

const FALLBACK = { mult: 0.45, spread: 0.5, note: "generic multiple" };

// Wrapped / staked / liquid product name markers
const WRAPPED_MARKERS = [
  "wrapped", "staked", "liquid", "restaked", "restaking", "lst", "lsd",
  "receipt", "vault share", "share", "wst", "rst", "vst", "st-", "st ",
  "bridged", "canonical", "pegged", "weth", "wbtc", "wsol", "wsteth",
  "steth", "reth", "cbeth", "sfrxeth", "frxeth", "meth", "ezeth", "weeth",
  "rseth", "susde", "usde", "susds", "sgho", "gho", "wusdm", "usdm",
];

const STAKED_CATEGORIES = new Set([
  "Liquid Staking", "Liquid Restaking", "Restaking", "Staking", "Staking Pool",
  "Yield Aggregator", "Vault", "Indexes", "Leveraged Farming",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function looksWrapped(name: string, symbol: string | undefined, category: string): boolean {
  if (STAKED_CATEGORIES.has(category)) return true;
  const n = (name + " " + (symbol ?? "")).toLowerCase();
  for (const m of WRAPPED_MARKERS) {
    if (n.includes(m)) return true;
  }
  return false;
}

function hasToken(p: RawProtocol): boolean {
  if (str(p.token).length > 0) return true;
  if (str(p.gecko_id).length > 0) return true;
  if (str(p.symbol).length > 0) return true;
  const mcap = num(p.mcap);
  if (mcap !== null && mcap > 0) return true;
  return false;
}

function momentumScore(p: RawProtocol): number {
  const d1 = num(p.change_1d) ?? 0;
  const d7 = num(p.change_7d) ?? 0;
  const d30 = num(p.change_1m) ?? 0;
  const raw = d1 * 0.5 + d7 * 0.3 + d30 * 0.2;
  return Math.max(-50, Math.min(50, raw));
}

function confidenceFor(p: RawProtocol, tvl: number): number {
  let c = 0.5;
  if (tvl > 1e9) c += 0.2;
  else if (tvl > 1e8) c += 0.15;
  else if (tvl > 1e7) c += 0.1;
  else if (tvl > 1e6) c += 0.05;
  const audits = num(p.audits);
  if (audits !== null && audits > 0) c += 0.08;
  if ((p.audit_links?.length ?? 0) > 0) c += 0.05;
  if ((p.chains?.length ?? 0) > 1) c += 0.05;
  const listedAt = num(p.listedAt);
  if (listedAt !== null && listedAt > 0) {
    const age = (Date.now() / 1000 - listedAt) / 86400;
    if (age > 365) c += 0.07;
    else if (age > 180) c += 0.04;
  }
  if (str(p.twitter).length > 0) c += 0.03;
  if (str(p.url).length > 0) c += 0.02;
  return Math.max(0.1, Math.min(0.98, c));
}

function tierFor(score: number): "S" | "A" | "B" | "C" {
  if (score >= 80) return "S";
  if (score >= 60) return "A";
  if (score >= 40) return "B";
  return "C";
}

function farmPlanFor(row: Omit<BoardRow, "farmPlan" | "rank">): FarmStep[] {
  const steps: FarmStep[] = [];
  const cat = row.category;
  const chain = row.chains[0] ?? "mainnet";
  const isLending = /lend|cdp|borrow/i.test(cat);
  const isDex = /dex|swap|liquidity/i.test(cat);
  const isPerp = /perp|deriv|option|synthet/i.test(cat);
  const isBridge = /bridge/i.test(cat);
  const isYield = /yield|vault|index|farm/i.test(cat);

  steps.push({
    step: 1,
    action: "Confirm no token exists",
    detail: `Check ${row.url || "the protocol site"} and docs for a token, points program or airdrop page. Snapshot shows no token and no wrapped/staked derivative.`,
    cost: "0",
    payoff: "avoid farming a protocol whose token already trades",
  });

  if (isLending) {
    steps.push({
      step: 2,
      action: "Supply collateral",
      detail: `Supply a blue-chip asset (ETH/USDC) to ${row.name} on its deepest chain (${chain}). Keep LTV under 50%.`,
      cost: "gas + opportunity cost",
      payoff: "borrow demand drives points; supply is the base unit",
    });
    steps.push({
      step: 3,
      action: "Borrow and re-supply",
      detail: "Borrow a stable against the collateral and re-supply it (2-3 loops max) to multiply borrow volume without liquidation risk.",
      cost: "gas per loop",
      payoff: "borrow volume is usually the weighted metric",
    });
  } else if (isDex) {
    steps.push({
      step: 2,
      action: "Provide liquidity",
      detail: `Add a concentrated range in the deepest pool on ${chain}. Use a stable/stable or ETH/stable pair to limit IL.`,
      cost: "gas + IL risk",
      payoff: "LP fees plus volume-weighted points",
    });
    steps.push({
      step: 3,
      action: "Route volume",
      detail: "Do small swaps through the router weekly to add volume without paying much fee.",
      cost: "swap fees",
      payoff: "volume often counts double LP fees",
    });
  } else if (isPerp) {
    steps.push({
      step: 2,
      action: "Open hedged positions",
      detail: `Open a small long and short on ${row.name} to generate volume, keeping leverage under 3x.`,
      cost: "funding + fees",
      payoff: "volume is the primary metric",
    });
    steps.push({
      step: 3,
      action: "Provide insurance/backstop",
      detail: "If the protocol has a backstop or insurance pool, deposit a small amount to earn the insurance yield.",
      cost: "capital at risk",
      payoff: "backstop deposits often earn bonus points",
    });
  } else if (isBridge) {
    steps.push({
      step: 2,
      action: "Bridge both ways",
      detail: `Bridge a small amount from ${chain} to another chain and back to generate transfer volume.`,
      cost: "bridge fee + gas",
      payoff: "transfer volume is the metric",
    });
    steps.push({
      step: 3,
      action: "Provide bridge liquidity",
      detail: "Deposit into the bridge's liquidity pool if one exists to earn LP fees and points.",
      cost: "capital lockup",
      payoff: "LP deposits often count",
    });
  } else if (isYield) {
    steps.push({
      step: 2,
      action: "Deposit into the vault",
      detail: `Deposit a stable or ETH into ${row.name}'s flagship vault on ${chain}.`,
      cost: "gas",
      payoff: "AUM share is the metric",
    });
    steps.push({
      step: 3,
      action: "Compound weekly",
      detail: "Harvest and redeposit weekly to keep the position growing and to add transaction count.",
      cost: "gas per harvest",
      payoff: "compounding increases AUM share",
    });
  } else {
    steps.push({
      step: 2,
      action: "Use the core product",
      detail: `Use ${row.name}'s main product on ${chain} with a small position to generate activity.`,
      cost: "gas",
      payoff: "activity is the base metric",
    });
    steps.push({
      step: 3,
      action: "Hold and revisit",
      detail: "Hold the position and check the protocol's docs and socials monthly for a points or airdrop announcement.",
      cost: "capital lockup",
      payoff: "early users get the largest share",
    });
  }

  const handle = row.twitter ? "@" + row.twitter.replace(/^@/, "") : "the protocol's socials";
  steps.push({
    step: steps.length + 1,
    action: "Track the launch",
    detail: `Watch ${handle} and DefiLlama for a token announcement. Exit farming if a token launches without a retroactive allocation.`,
    cost: "0",
    payoff: "avoid sunk cost after a tokenless launch",
  });

  return steps;
}

// ---------------------------------------------------------------------------
// Snapshot loading
// ---------------------------------------------------------------------------
function extractProtocols(parsed: unknown, depth = 0): RawProtocol[] {
  if (depth > 4) return [];
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is RawProtocol => !!x && typeof x === "object" && !Array.isArray(x));
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["protocols", "data", "rows", "items", "snapshot"]) {
      const v = obj[key];
      if (Array.isArray(v)) {
        const out = extractProtocols(v, depth + 1);
        if (out.length) return out;
      } else if (v && typeof v === "object") {
        const inner = extractProtocols(v, depth + 1);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

function tryLoad(file: string): RawProtocol[] {
  try {
    if (!statSync(file).isFile()) return [];
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return extractProtocols(parsed);
  } catch {
    return [];
  }
}

function findSnapshot(root: string): { protocols: RawProtocol[]; source: string } {
  const candidates = [
    join(root, "snapshot.json"),
    join(root, "data", "snapshot.json"),
    join(root, "vendor", "snapshot.json"),
    join(root, "vendor", "makefun-board", "snapshot.json"),
    join(root, "input", "snapshot.json"),
    join(root, "protocols.json"),
    join(root, "data", "protocols.json"),
  ];
  for (const c of candidates) {
    const protocols = tryLoad(c);
    if (protocols.length) return { protocols, source: c };
  }
  const dirs = [root, join(root, "data"), join(root, "vendor"), join(root, "input")];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    let files: string[];
    try {
      files = readdirSync(d);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const protocols = tryLoad(join(d, f));
      if (protocols.length) return { protocols, source: join(d, f) };
    }
  }
  return { protocols: [], source: "" };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
function buildBoard(protocols: RawProtocol[]): BoardRow[] {
  const rows