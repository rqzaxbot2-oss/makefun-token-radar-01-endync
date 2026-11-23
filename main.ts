import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Token Launch Radar
// Reads a sealed DefiLlama-style snapshot, finds protocols with no token that
// are not a wrapped/staked product of a tokenized protocol, scores the value a
// launch would capture, and emits board.json + a static dashboard.
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : HERE;

type Raw = Record<string, any>;

interface Proto {
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  change7d: number | null;
  change30d: number | null;
  mcap: number | null;
  listedAt: number | null;
  url: string | null;
  description: string;
  hasToken: boolean;
  tokenSymbol: string | null;
  isDerivative: boolean;
  parent: string | null;
  score: number;
  impliedValue: number;
  valueLow: number;
  valueHigh: number;
  confidence: number;
  farmPlan: FarmStep[];
  reasons: string[];
}

interface FarmStep {
  step: number;
  title: string;
  detail: string;
  risk: "low" | "medium" | "high";
}

// ---------------------------------------------------------------------------
// Snapshot loading: find the sealed snapshot anywhere under the repo.
// ---------------------------------------------------------------------------
function findSnapshot(): Raw[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const roots = [HERE, process.cwd(), join(HERE, "snapshot"), join(HERE, "data"), join(HERE, "vendor")];

  const addCandidate = (p: string) => {
    if (seen.has(p)) return;
    seen.add(p);
    candidates.push(p);
  };

  for (const r of roots) {
    if (!existsSync(r)) continue;
    let entries: string[];
    try {
      entries = readdirSync(r);
    } catch {
      continue;
    }
    for (const f of entries) {
      const p = join(r, f);
      try {
        if (!statSync(p).isFile()) continue;
      } catch {
        continue;
      }
      if (/\.(json|jsonl)$/i.test(f) && /(snapshot|protocol|defillama|llama|sealed)/i.test(f)) addCandidate(p);
    }
  }
  // Fallback: any json under the known roots.
  for (const r of roots) {
    if (!existsSync(r)) continue;
    let entries: string[];
    try {
      entries = readdirSync(r);
    } catch {
      continue;
    }
    for (const f of entries) {
      const p = join(r, f);
      try {
        if (statSync(p).isFile() && /\.json$/i.test(f)) addCandidate(p);
      } catch {
        /* ignore */
      }
    }
  }

  for (const p of candidates) {
    let parsed: any;
    try {
      parsed = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    const arr = normalizeSnapshot(parsed);
    if (arr.length > 0) return arr;
  }
  return [];
}

function normalizeSnapshot(parsed: any): Raw[] {
  if (Array.isArray(parsed)) return parsed.filter((v) => v && typeof v === "object") as Raw[];
  if (parsed && typeof parsed === "object") {
    for (const key of ["protocols", "data", "rows", "snapshot", "items", "list"]) {
      if (Array.isArray(parsed[key])) return (parsed[key] as any[]).filter((v) => v && typeof v === "object") as Raw[];
    }
    // object keyed by slug
    const vals = Object.values(parsed);
    if (vals.length && vals.every((v) => v && typeof v === "object")) {
      return vals.map((v: any) => (v.slug ? v : { ...v })) as Raw[];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Field extraction with tolerant key matching.
// ---------------------------------------------------------------------------
function pick(o: Raw, keys: string[]): any {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    const lk = k.toLowerCase();
    for (const kk of Object.keys(o)) {
      if (kk.toLowerCase() === lk && o[kk] !== undefined && o[kk] !== null) return o[kk];
    }
  }
  return undefined;
}

function num(v: any): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,%\s]/g, "").replace(/,/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: any): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(str).join(", ");
  return String(v);
}

function boolish(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return /^(true|yes|1|y)$/i.test(v.trim());
  return false;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Derivative detection: wrapped / staked / bridged / LP of a tokenized parent.
// ---------------------------------------------------------------------------
const DERIVATIVE_PATTERNS: RegExp[] = [
  /\bwrapped\b/i, /\bstaked\b/i, /\bstaking\b/i, /\bliquid staking\b/i, /\bliquid restaking\b/i,
  /\brestaked\b/i, /\bbridged\b/i, /\bcanonical bridge\b/i, /\bweth\b/i, /\bwsteth\b/i, /\bsteth\b/i,
  /\brweth\b/i, /\bwbtc\b/i, /\bwbnb\b/i, /\bwavax\b/i, /\bwmatic\b/i, /\bwpol\b/i, /\bwsol\b/i,
  /\bwrapped (?:native|token|asset|btc|eth|sol)\b/i,
];

const DERIVATIVE_CATEGORIES = new Set([
  "liquid staking", "liquid restaking", "restaking", "bridge", "canonical bridge", "wrapped",
  "cross chain bridge", "yield aggregator", "liquid staking derivative", "cex", "chain",
]);

function detectDerivative(p: Raw, name: string, category: string, desc: string, symbol: string | null): { isDerivative: boolean; parent: string | null } {
  const text = `${name} ${desc}`;
  const cat = category.toLowerCase();
  const explicit = pick(p, ["isDerivative", "derivative", "wrapped", "isWrapped", "isStaked", "staked"]);
  if (explicit !== undefined && boolish(explicit)) {
    return { isDerivative: true, parent: str(pick(p, ["parent", "parentProtocol", "underlying", "baseProtocol"])) || null };
  }
  const parentField = pick(p, ["parent", "parentProtocol", "underlying", "baseProtocol", "derivativeOf"]);
  if (parentField) return { isDerivative: true, parent: str(parentField) };
  if (DERIVATIVE_CATEGORIES.has(cat) && /staking|restaking|bridge|wrapped/i.test(cat)) {
    return { isDerivative: true, parent: null };
  }
  // Symbol like wETH, stETH, rETH, wstETH, sUSD, aUSDC, cDAI
  if (symbol && /^(w|st|r|s|a|c|cb|sf|am|wst|rst|ez|rs|sfrx|frx)[A-Z]{2,6}$/.test(symbol)) {
    return { isDerivative: true, parent: null };
  }
  for (const re of DERIVATIVE_PATTERNS) {
    if (re.test(text)) return { isDerivative: true, parent: null };
  }
  return { isDerivative: false, parent: null };
}

// ---------------------------------------------------------------------------
// Parse raw record into Proto.
// ---------------------------------------------------------------------------
function parseProto(p: Raw): Proto | null {
  const name = str(pick(p, ["name", "protocol", "title", "displayName"])).trim();
  if (!name) return null;
  const slug = str(pick(p, ["slug", "id", "key"])).trim() || slugify(name);
  const category = str(pick(p, ["category", "type", "sector"])).trim() || "Other";
  const chainsRaw = pick(p, ["chains", "chain", "networks"]);
  const chains = Array.isArray(chainsRaw)
    ? chainsRaw.map(str).map((c) => c.trim()).filter(Boolean)
    : chainsRaw
      ? [str(chainsRaw).trim()].filter(Boolean)
      : [];
  const tvl = num(pick(p, ["tvl", "tvlUsd", "totalTvl", "locked", "tvlUSD"])) ?? 0;
  const change7d = num(pick(p, ["change_7d", "change7d", "tvlChange7d", "change7D"]));
  const change30d = num(pick(p, ["change_30d", "change30d", "tvlChange30d", "change30D", "change_1m"]));
  const mcap = num(pick(p, ["mcap", "marketCap", "market_cap", "mcapUsd"]));
  const listedAt = num(pick(p, ["listedAt", "listed_at", "createdAt", "launchDate"]));
  const url = str(pick(p, ["url", "website", "site"])).trim() || null;
  const description = str(pick(p, ["description", "desc", "about", "summary"])).trim();
  const symbolRaw = pick(p, ["symbol", "tokenSymbol", "token", "ticker"]);
  const tokenSymbol = symbolRaw ? str(symbolRaw).trim() || null : null;

  const hasTokenField = pick(p, ["hasToken", "token", "has_token", "tokenized", "hasTokenLaunched"]);
  let hasToken = false;
  if (hasTokenField !== undefined) {
    if (typeof hasTokenField === "object" && hasTokenField !== null) {
      hasToken =
        boolish(pick(hasTokenField as Raw, ["hasToken", "exists", "launched"])) ||
        !!str(pick(hasTokenField as Raw, ["symbol", "address"])).trim();
    } else {
      hasToken = boolish(hasTokenField);
    }
  }
  // A non-empty token symbol (not a placeholder) implies a token.
  if (!hasToken && tokenSymbol && !/^(-|none|n\/a|tbd)$/i.test(tokenSymbol) && tokenSymbol.length >= 2) {
    hasToken = true;
  }
  if (mcap !== null && mcap > 0) hasToken = true;

  const { isDerivative, parent } = detectDerivative(p, name, category, description, tokenSymbol);

  return {
    name, slug, category, chains, tvl, change7d, change30d, mcap, listedAt, url, description,
    hasToken, tokenSymbol, isDerivative, parent, score: 0, impliedValue: 0, valueLow: 0, valueHigh: 0,
    confidence: 0, farmPlan: [], reasons: [],
  };
}

// ---------------------------------------------------------------------------
// Scoring: what a launch would be worth.
// ---------------------------------------------------------------------------
const CATEGORY_MULT: Record<string, number> = {
  "dex": 0.32, "dexs": 0.32, "dexes": 0.32, "lending": 0.30, "cdp": 0.28, "liquid staking": 0.22,
  "liquid restaking": 0.22, "restaking": 0.22, "yield": 0.26, "yield aggregator": 0.26, "bridge": 0.18,
  "cross chain bridge": 0.18, "perps": 0.35, "derivatives": 0.33, "options": 0.30, "insurance": 0.20,
  "launchpad": 0.28, "nft marketplace": 0.18, "nft lending": 0.20, "rwa": 0.24, "real world assets": 0.24,
  "staking": 0.20, "cex": 0.15, "chain": 0.12, "l1": 0.12, "l2": 0.14, "rollup": 0.14, "gaming": 0.22,
  "social": 0.16, "oracle": 0.22, "indexes": 0.18, "farm": 0.24, "algo stables": 0.20, "stablecoin": 0.18,
  "payments": 0.18, "privacy": 0.16, "liquidations": 0.20, "onchain capital allocator": 0.24,
  "portfolio tracker": 0.10, "services": 0.12, "creator economy": 0.14, "prediction market": 0.26,
};

function categoryMult(cat: string): number {
  const c = cat.toLowerCase().trim();
  if (CATEGORY_MULT[c] !== undefined) return CATEGORY_MULT[c];
  for (const k of Object.keys(CATEGORY_MULT)) if (c.includes(k)) return CATEGORY_MULT[k];
  return 0.18;
}

function scoreProto(p: Proto): void {
  const mult = categoryMult(p.category);
  const tvl = Math.max(p.tvl, 0);
  // Base implied FDV: TVL * category multiple, with diminishing returns for huge TVL.
  const base = Math.pow(tvl, 0.92) * Math.pow(mult, 1.1) * 1.4;
  // Momentum: growth over 7d/30d boosts value.
  const mom7 = p.change7d ?? 0;
  const mom30 = p.change30d ?? 0;
  const momentum = 1 + clamp(mom7 / 100, -0.25, 0.6) * 0.5 + clamp(mom30 / 100, -0.3, 1.0) * 0.35;
  // Chain breadth bonus: multi-chain protocols capture more.
  const chainBonus = 1 + Math.min(p.chains.length, 12) * 0.02;
  // Age: older protocols have more proven traction.
  const ageBonus = p.listedAt ? 1 + Math.min((Date.now() / 1000 - p.listedAt) / (365 * 86400), 6) * 0.03 : 1;
  const implied = base * momentum * chainBonus * ageBonus;

  p.impliedValue = Math.round(implied);
  p.valueLow = Math.round(implied * 0.55);
  p.valueHigh = Math.round(implied * 1.9);

  // Confidence: based on data completeness.
  let conf = 0.5;
  if (tvl > 0) conf += 0.15;
  if (p.change7d !== null) conf += 0.1;
  if (p.change30d !== null) conf += 0.1;
  if (p.chains.length > 0) conf += 0.05;
  if (p.listedAt) conf += 0.05;
  if (p.description) conf += 0.05;
  p.confidence = Math.min(0.98, conf);

  // Score for ranking: implied value weighted by confidence and momentum.
  const momScore = 1 + clamp(mom7 / 100, -0.5, 1.0) * 0.4 + clamp(mom30 / 100, -0.5, 2.0) * 0.3;
  p.score = Math.round(implied * p.confidence * momScore);

  p.reasons = [];
  p.reasons.push(`TVL $${fmt(tvl)} across ${p.chains.length || 1} chain${p.chains.length === 1 ? "" : "s"}`);
  p.reasons.push(`${p.category} sector multiple ${(mult * 100).toFixed(0)}% of TVL`);
  if (mom7 !== 0) p.reasons.push(`7d TVL ${mom7 >= 0 ? "+" : ""}${mom7.toFixed(1)}%`);
  if (mom30 !== 0) p.reasons.push(`30d TVL ${mom30 >= 0 ? "+" : ""}${mom30.toFixed(1)}%`);
  if (p.listedAt) p.reasons.push(`tracked ${((Date.now() / 1000 - p.listedAt) / 86400).toFixed(0)}d`);
  p.reasons.push(`confidence ${(p.confidence * 100).toFixed(0)}%`);

  p.farmPlan = buildFarmPlan(p);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(0);
}

// ---------------------------------------------------------------------------
// Farm plan: steps to farm a pre-token protocol.
// ---------------------------------------------------------------------------
function buildFarmPlan(p: Proto): FarmStep[] {
  const cat = p.category.toLowerCase();
  const steps: FarmStep[] = [];
  let n = 1;
  const add = (title: string, detail: string, risk: FarmStep["risk"]) => {
    steps.push({ step: n++, title, detail, risk });
  };

  add(
    "Map the protocol surface",
    `Open ${p.url || p.name} and read the docs. Identify which contracts and chains hold TVL (${p.chains.slice(0, 4).join(", ") || "primary chain"}). Note any points program, waitlist or airdrop page already live.`,
    "low",
  );

  if (/dex|dexes|perps|derivatives|options/.test(cat)) {
    add(
      "Provide liquidity on the deepest pair",
      `Deposit into the highest-volume pool on ${p.name}. Start with the blue-chip pair (ETH/USDC or the protocol's base asset) to limit impermanent loss, then rotate into the incentivized pool once you confirm emissions or points.`,
      "medium",
    );
    add(
      "Trade volume on your own wallet",
      `Route a small, steady volume through ${p.name} each week from the wallet you will claim with. Wash-trading is detectable; keep it to genuine rebalances and fee-paying swaps.`,
      "medium",
    );
  } else if (/lending|cdp|stablecoin|algo stables/.test(cat)) {
    add(
      "Supply collateral, borrow and re-supply",
      `Supply a stable asset on ${p.name}, borrow against it at <50% LTV, and re-supply the borrowed asset. This compounds supply-side points while keeping liquidation risk low.`,
      "medium",
    );
    add(
      "Hold a debt position over time",
      `Most lending points programs weight time-integrated borrow. Keep a small debt open for weeks rather than opening and closing.`,
      "medium",
    );
  } else if (/staking|restaking|liquid staking|liquid restaking/.test(cat)) {
    add(
      "Stake the native asset",
      `Stake ETH or the base asset through ${p.name} and hold the receipt token. If a points program exists, staking is usually the primary accrual path.`,
      "low",
    );
    add(
      "Restake the receipt token",
      `If ${p.name} issues a liquid receipt, deposit it into a restaking or lending venue that accepts it to stack points from two protocols.`,
      "high",
    );
  } else if (/bridge|cross chain/.test(cat)) {
    add(
      "Bridge real volume",
      `Move assets across ${p.name} on routes you actually need. Bridges weight unique wallets and volume; a few genuine transfers beat many dust transactions.`,
      "medium",
    );
    add(
      "Provide bridge liquidity",
      `If ${p.name} has an LP or insurance pool, deposit into it. Bridge LPs often earn the largest share of any future token.`,
      "high",
    );
  } else if (/yield|farm|vault|aggregator/.test(cat)) {
    add(
      "Deposit into the flagship vault",
      `Deposit into ${p.name}'s highest-TVL vault. Yield aggregators typically reward depositors pro-rata to time-weighted TVL.`,
      "low",
    );
    add(
      "Loop across