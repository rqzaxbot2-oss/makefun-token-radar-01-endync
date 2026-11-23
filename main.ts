import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// token-radar-01 — Node 22 entrypoint
// Parses a sealed DefiLlama snapshot, finds protocols with no token that are
// not wrapped/staked derivatives of a tokenized protocol, scores them by the
// implied value of a launch, and writes board.json + dossier.json.
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || HERE;

type Json = any;

interface Protocol {
  name: string;
  slug: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
  mcap?: number;
  listedAt?: number;
  url?: string;
  twitter?: string;
  description?: string;
  parentProtocol?: string;
  symbol?: string;
  audits?: string;
  audit_links?: string[];
  oracles?: string;
  forkedFrom?: string[];
  methodology?: string;
  referralUrl?: string;
  logo?: string;
  gecko_id?: string;
  tokenSymbol?: string;
  [k: string]: Json;
}

interface Row {
  rank: number;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  tvl_7d: number;
  tvl_1m: number;
  tvl_1y: number;
  implied_value_usd: number;
  implied_value_low: number;
  implied_value_high: number;
  confidence: number;
  score: number;
  reasons: string[];
  farm_plan: FarmStep[];
  url?: string;
  twitter?: string;
  description?: string;
  audits?: number;
  parent?: string;
  forked_from?: string[];
  peers: { name: string; mcap: number; ratio: number }[];
}

interface FarmStep {
  step: number;
  action: string;
  detail: string;
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
}

const WRAPPED_PATTERNS = [
  /^wrapped\s/i,
  /^staked\s/i,
  /^stk/i,
  /^s?weth$/i,
  /^s?wbtc$/i,
  /^s?usdc$/i,
  /^s?usdt$/i,
  /^wsol$/i,
  /^wsteth$/i,
  /^reth$/i,
  /^cbeth$/i,
  /^sfrxeth$/i,
  /^ankreth$/i,
  /^meth$/i,
  /^ezeth$/i,
  /^rseth$/i,
  /^weeth$/i,
  /^susde$/i,
  /^susds$/i,
  /^wbeth$/i,
  /^wbnb$/i,
  /^wavax$/i,
  /^wmatic$/i,
  /^wpol$/i,
  /^wftm$/i,
  /^wxdai$/i,
  /^wglmr$/i,
  /^wmovr$/i,
  /^wone$/i,
  /^wcro$/i,
  /^wklay$/i,
  /^wxtz$/i,
  /^wfil$/i,
  /^wdot$/i,
  /^watom$/i,
  /^wosmo$/i,
  /^wsei$/i,
  /^wsui$/i,
  /^wapt$/i,
  /^wcore$/i,
  /^wzksync$/i,
  /^wbase$/i,
  /^warb$/i,
  /^wop$/i,
  /^wlinea$/i,
  /^wscroll$/i,
  /^wmnt$/i,
  /^wblast$/i,
  /^wmode$/i,
  /^wzora$/i,
  /^wfrax$/i,
  /^wcrv$/i,
  /^wldo$/i,
  /^waave$/i,
  /^wuni$/i,
  /^wlink$/i,
  /^wmkr$/i,
  /^wsnx$/i,
  /^wcomp$/i,
  /^wsushi$/i,
  /^wbal$/i,
  /^wcrvusd$/i,
  /^wgho$/i,
  /^wusde$/i,
  /^wusds$/i,
  /^wfrax$/i,
  /^wusdt0$/i,
  /^wsusde$/i,
  /^wsusds$/i,
  /^wstusd$/i,
  /^wsteth$/i,
  /^wstksceth$/i,
  /^wstkscusdc$/i,
  /^wstkscusdt$/i,
  /^wstksusde$/i,
  /^wstksusds$/i,
  /^wstksusdt$/i,
  /^wstksweth$/i,
  /^wstkswbtc$/i,
  /^wstkswusd$/i,
  /^wstksusdc$/i,
  /^wstksusdt$/i,
  /^wstksusde$/i,
  /^wstksusds$/i,
  /^wstksusd$/i,
  /^wstksweth$/i,
  /^wstkswbtc$/i,
  /^wstkswusd$/i,
  /^wstksusdc$/i,
  /^wstksusdt$/i,
  /^wstksusde$/i,
  /^wstksusds$/i,
  /^wstksusd$/i,
  /^wstksweth$/i,
  /^wstkswbtc$/i,
  /^wstkswusd$/i,
];

const WRAPPED_SUFFIX = /(?:-?wrapped|\.wrapped| wrapped)$/i;

const STAKED_KEYWORDS = [
  "liquid staking",
  "liquid restaking",
  "restaking",
  "staked",
  "staking pool",
  "wrapped",
  "bridged",
  "canonical bridge",
  "wrapped token",
  "staked token",
];

const DERIVATIVE_CATEGORIES = [
  "Liquid Staking",
  "Liquid Restaking",
  "Restaking",
  "Wrapped",
  "Bridge",
  "Canonical Bridge",
  "Staked",
];

const CATEGORY_PEER_MULTIPLE: Record<string, number> = {
  "Dexes": 0.9,
  "DEX": 0.9,
  "Lending": 0.7,
  "CDP": 0.7,
  "Perp DEX": 1.4,
  "Derivatives": 1.2,
  "Yield": 0.8,
  "Yield Aggregator": 0.8,
  "Liquid Staking": 0.6,
  "Liquid Restaking": 0.6,
  "Restaking": 0.6,
  "Bridge": 1.1,
  "Cross Chain Bridge": 1.1,
  "Chain": 1.6,
  "L1": 1.8,
  "L2": 1.5,
  "Rollup": 1.5,
  "RWA": 1.3,
  "Real World Assets": 1.3,
  "Gaming": 1.0,
  "GameFi": 1.0,
  "NFT Marketplace": 0.8,
  "NFT Lending": 0.8,
  "Oracle": 1.5,
  "Insurance": 0.6,
  "Options": 1.0,
  "Launchpad": 1.2,
  "Prediction Market": 1.4,
  "Social": 1.0,
  "Privacy": 1.2,
  "Payments": 1.0,
  "Stablecoin Issuer": 1.4,
  "Algo-Stables": 0.5,
  "Farm": 0.5,
  "Onchain Capital Allocator": 0.7,
  "Indexes": 0.6,
  "Synthetics": 0.9,
  "Basis Trading": 0.6,
  "CEX": 1.0,
  "Dex Aggregator": 0.9,
  "Liquidity Manager": 0.7,
  "Telegram Bot": 0.6,
  "MEV": 1.0,
  "Reserve Currency": 1.0,
  "Token Locker": 0.5,
  "Treasury": 0.5,
  "Uncollateralized Lending": 0.6,
  "RWA Lending": 0.9,
  "Leveraged Farming": 0.6,
  "Yield Lottery": 0.4,
  "Basis Trading": 0.6,
  "Options Vault": 0.6,
  "Leveraged": 0.7,
  "Anchor": 0.6,
  "Liquid Staking Index": 0.6,
  "Liquid Staking Wrapper": 0.5,
  "Liquid Staking Derivative": 0.5,
  "Staking Pool": 0.5,
  "Staking": 0.6,
  "Validator": 0.6,
  "Node Provider": 0.6,
  "Infrastructure": 1.0,
  "Developer Tools": 1.0,
  "Wallet": 0.8,
  "Explorer": 0.8,
  "Data Availability": 1.0,
  "Sequencer": 1.0,
  "Interoperability": 1.1,
  "Messaging": 1.0,
  "Chain Abstraction": 1.0,
  "Account Abstraction": 0.9,
  "Modular": 1.0,
  "Rollup-as-a-Service": 1.0,
  "RaaS": 1.0,
  "Bitcoin Layer": 1.2,
  "Bitcoin": 1.2,
  "Solana": 1.5,
  "Ethereum": 1.6,
  "Cosmos": 1.1,
  "Move": 1.1,
  "Aptos": 1.1,
  "Sui": 1.1,
  "TON": 1.1,
  "Berachain": 1.2,
  "Hyperliquid": 1.4,
  "Monad": 1.2,
  "MegaETH": 1.2,
  "AI Agents": 1.3,
  "AI": 1.3,
  "DeFAI": 1.2,
  "Intent": 1.0,
  "Solver": 1.0,
  "Orderbook": 1.0,
  "AMM": 0.9,
  "CLMM": 1.0,
  "Concentrated Liquidity": 1.0,
  "Vault": 0.7,
  "Strategy": 0.7,
  "Yield Strategy": 0.7,
  "Leverage": 0.7,
  "Delta Neutral": 0.6,
  "Hedge": 0.6,
  "Structured Product": 0.6,
  "Fixed Rate": 0.8,
  "Fixed Income": 0.8,
  "Bonding": 0.6,
  "Launch": 0.8,
  "Crowdfunding": 0.6,
  "DAO": 0.6,
  "Governance": 0.6,
  "Vesting": 0.5,
  "Airdrop": 0.5,
  "Points": 0.5,
  "Quest": 0.5,
  "Referral": 0.5,
  "Affiliate": 0.5,
  "Bounties": 0.5,
  "Bug Bounty": 0.5,
  "Security": 0.8,
  "Audit": 0.8,
  "Compliance": 0.8,
  "KYC": 0.8,
  "Identity": 0.8,
  "Reputation": 0.8,
  "Attestation": 0.8,
  "Credential": 0.8,
  "Passport": 0.8,
  "Soulbound": 0.8,
  "Badge": 0.8,
  "POAP": 0.8,
  "NFT": 0.8,
  "NFT Marketplace": 0.8,
  "NFT Lending": 0.8,
  "NFT Fi": 0.8,
  "NFT Perp": 0.8,
  "NFT AMM": 0.8,
  "NFT Staking": 0.8,
  "NFT Rental": 0.8,
  "NFT Fractionalization": 0.8,
  "NFT Aggregator": 0.8,
  "NFT Launchpad": 0.8,
  "NFT DEX": 0.8,
  "NFT Options": 0.8,
  "NFT Index": 0.8,
  "NFT Vault": 0.8,
  "NFT Yield": 0.8,
  "NFT Farm": 0.8,
  "NFT Pool": 0.8,
  "NFT Swap": 0.8,
  "NFT Bridge": 0.8,
  "NFT Oracle": 0.8,
  "NFT Insurance": 0.8,
  "NFT Prediction": 0.8,
  "NFT Gaming": 0.8,
  "NFT Social": 0.8,
  "NFT DAO": 0.8,
  "NFT Governance": 0.8,
  "NFT Identity": 0.8,
  "NFT Reputation": 0.8,
  "NFT Attestation": 0.8,
  "NFT Credential": 0.8,
  "NFT Passport": 0.8,
  "NFT Soulbound": 0.8,
  "NFT Badge": 0.8,
  "NFT POAP": 0.8,
};

const CATEGORY_DEFAULT_MULTIPLE = 0.8;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isWrappedOrStaked(p: Protocol): { wrapped: boolean; why: string } {
  const name = p.name || "";
  const slug = p.slug || "";
  const sym = (p.tokenSymbol || p.symbol || "").trim();

  if (WRAPPED_PATTERNS.some((r) => r.test(name))) {
    return { wrapped: true, why: "name matches wrapped/staked token pattern" };
  }
  if (WRAPPED_SUFFIX.test(name)) {
    return { wrapped: true, why: "name ends in wrapped" };
  }
  if (sym && WRAPPED_PATTERNS.some((r) => r.test(sym))) {
    return { wrapped: true, why: "symbol matches wrapped/staked token pattern" };
  }
  if (/^(w|st|stk|s)[a-z]{2,6}$/i.test(sym) && sym.length <= 8) {
    // conservative: only flag if category is derivative-ish
    const cat = (p.category || "").toLowerCase();
    if (cat.includes("wrapped") || cat.includes("staking") || cat.includes("restaking")) {
      return { wrapped: true, why: "w-prefixed symbol in derivative category" };
    }
  }
  const cat = (p.category || "").toLowerCase();
  if (DERIVATIVE_CATEGORIES.some((c) => cat === c.toLowerCase())) {
    return { wrapped: true, why: `category ${p.category} is a derivative product` };
  }
  const desc = (p.description || "").toLowerCase();
  if (STAKED_KEYWORDS.some((k) => desc.includes(k)) && /wrapped|staked|derivative/i.test(desc)) {
    return { wrapped: true, why: "description marks it as wrapped/staked derivative" };
  }
  if (p.parentProtocol) {
    return { wrapped: true, why: `child of ${p.parentProtocol}` };
  }
  if (slug.startsWith("wrapped-") || slug.startsWith("staked-") || slug.startsWith("stk-")) {
    return { wrapped: true, why: "slug marks it as wrapped/staked" };
  }
  return { wrapped: false, why: "" };
}

function hasToken(p: Protocol): boolean {
  if (p.mcap && p.mcap > 0) return true;
  if (p.tokenSymbol && p.tokenSymbol.trim().length > 0) return true;
  if (p.symbol && p.symbol.trim().length > 0) return true;
  if (p.gecko_id && String(p.gecko_id).trim().length > 0) return true;
  return false;
}

function categoryMultiple(cat: string): number {
  if (!cat) return CATEGORY_DEFAULT_MULTIPLE;
  if (CATEGORY_PEER_MULTIPLE[cat] !== undefined) return CATEGORY_PEER_MULTIPLE[cat];
  const n = norm(cat);
  for (const [k, v] of Object.entries(CATEGORY_PEER_MULTIPLE)) {
    if (norm(k) === n) return v;
  }
  for (const [k, v] of Object.entries(CATEGORY_PEER_MULTIPLE)) {
    if (n.includes(norm(k)) || norm(k).includes(n)) return v;
  }
  return CATEGORY_DEFAULT_MULTIPLE;
}

function findPeers(p: Protocol, all: Protocol[]): { name: string; mcap: number; ratio: number }[] {
  const cat = p.category || "";
  const peers: { name: string; mcap: number; ratio: number }[] = [];
  for (const q of all) {
    if (q === p) continue;
    if (!q.mcap || q.mcap <= 0) continue;
    if (!q.tvl || q.tvl <= 0) continue;
    if ((q.category || "") !== cat) continue;
    const ratio = q.mcap / q.tvl;
    if (!isFinite(ratio) || ratio <= 0) continue;
    peers.push({ name: q.name, mcap: q.mcap, ratio });
  }
  peers.sort((a, b) => b.mcap - a.mcap);
  return peers.slice(0, 8);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function scoreRow(p: Protocol, peers: { name: string; mcap: number; ratio: number }[], all: Protocol[]): Row {
  const tvl = p.tvl || 0;
  const cat = p.category || "Unknown";
  const catMult = categoryMultiple(cat);
  const peerRatios = peers.map((x) => x.ratio);
  const peerMedian = peerRatios.length > 0 ? median(peerRatios) : catMult;
  const baseRatio = peerRatios.length >= 2 ? 0.6 * peerMedian + 0.4 * catMult : catMult;

  const implied = tvl * baseRatio;
  const low = tvl * baseRatio * 0.55;
  const high = tvl * baseRatio * 1.75;

  // confidence: more peers + more TVL + established age => higher
  let confidence = 0.4;
  confidence += Math.min(0.3, peers.length * 0.05);
  confidence += Math.min(0.2, Math.log10(Math.max(1, tvl)) / 40);
  if (p.listedAt) {
    const ageDays = (Date.now() / 1000 - p.listedAt) / 86400;
    confidence += Math.min(0.1, ageDays / 3650);
  }
  confidence = Math.max(0.05, Math.min(0.98, confidence));

  const ch7 = p.change_7d || 0;
  const ch1m = p.change_1m || 0;
  const momentum = 1 + Math.max(-0.3, Math.min(0.4, (ch7 * 0.6 + ch1m * 0.4) / 100));

  const reasons: string[] = [];
  reasons.push(`TVL $${fmt(tvl)} across ${(p.chains || []).length || 1} chain(s)`);
  reasons.push(`category ${cat} peer multiple ${baseRatio.toFixed(2)}x TVL`);
  if (peers.length) reasons.push(`${peers.length} tokenized peer(s) in same category`);
  if (p.audits === "yes" || (p.audit_links && p.audit_links.length)) reasons.push("audited");
  if (p.forkedFrom && p.forkedFrom.length) reasons.push(`forked from ${p.forkedFrom.join(", ")}`);
  if (ch7 || ch1m) reasons.push(`7d ${ch7.toFixed(1)}% / 1m ${ch1m.toFixed(1)}% TVL change`);

  const score = implied * confidence * momentum;

  const farm = farmPlan(p, tvl, implied, cat);

  return {