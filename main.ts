import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type Proto = {
  name: string;
  slug?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
  mcap?: number;
  listedAt?: number;
  twitter?: string;
  url?: string;
  description?: string;
  audits?: string | number;
  parentProtocol?: string;
  symbol?: string;
  oracles?: string[];
  forkedFrom?: string[];
  raises?: unknown;
  [k: string]: unknown;
};

const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR || process.cwd());

function readJSON(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf8"));
}

function extractArray(raw: unknown): Proto[] | null {
  if (Array.isArray(raw)) return raw as Proto[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["protocols", "data", "rows", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Proto[];
    }
  }
  return null;
}

function findSnapshot(): Proto[] {
  const candidates = [
    join(OUT, "snapshot.json"),
    join(OUT, "input", "snapshot.json"),
    join(process.cwd(), "snapshot.json"),
    join(process.cwd(), "data", "snapshot.json"),
    join(process.cwd(), "vendor", "snapshot.json"),
    join(process.cwd(), "vendor", "makefun-board", "snapshot.json"),
    join(process.cwd(), "vendor", "makefun-board", "data", "snapshot.json"),
    join(process.cwd(), "input", "snapshot.json"),
  ];
  const seen = new Set<string>();
  for (const c of candidates) {
    const abs = resolve(c);
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      if (!existsSync(abs) || !statSync(abs).isFile()) continue;
      const arr = extractArray(readJSON(abs));
      if (arr) return arr;
    } catch (err) {
      console.warn(`Skipping unreadable snapshot candidate ${abs}: ${(err as Error).message}`);
    }
  }
  return [];
}

const WRAPPED_RE = /(wrapped|staked|st-|s-?eth|restaked|bridged|receipt|liquid staking|lsd|lrt|vault share|pt-|yt-|a-?token|ib-?token|c-?token)/i;
const STABLE_RE = /(usd|stable|dai|usdc|usdt|frax|crvusd|gho|busd|tusd|usde)/i;

function isWrappedOrStaked(p: Proto): boolean {
  const n = `${p.name} ${p.symbol ?? ""}`;
  if (WRAPPED_RE.test(n)) return true;
  if (STABLE_RE.test(n) && /(usd|stable)/i.test(p.category ?? "")) return true;
  if (typeof p.parentProtocol === "string" && p.parentProtocol.trim().length > 0) return true;
  return false;
}

function hasToken(p: Proto): boolean {
  const t = p as Record<string, unknown>;
  if (t.token === true || t.hasToken === true) return true;
  if (t.token === false || t.hasToken === false) return false;
  if (typeof t.mcap === "number" && Number.isFinite(t.mcap) && t.mcap > 0) return true;
  return false;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function score(p: Proto): { value: number; parts: Record<string, number> } {
  const tvl = Math.max(0, num(p.tvl));
  const c7 = num(p.change_7d);
  const c30 = num(p.change_1m);
  const listedAt = num(p.listedAt);
  const ageDays = listedAt > 0 ? Math.max(1, (Date.now() / 1000 - listedAt) / 86400) : 365;
  const chains = Array.isArray(p.chains) ? p.chains.length : 1;

  const base = tvl * 0.9;
  const momentum = 1 + Math.max(-0.3, Math.min(0.6, (c7 / 100) * 0.5 + (c30 / 100) * 0.3));
  const chainBoost = 1 + Math.min(0.4, Math.max(0, chains - 1) * 0.08);
  const fresh = ageDays < 180 ? 1.15 : ageDays < 365 ? 1.05 : 1.0;
  const cat = (p.category ?? "").toLowerCase();
  const catBoost = /(dex|lending|perps|derivatives|yield|cdp)/.test(cat) ? 1.2 : /(bridge|oracle|rwa)/.test(cat) ? 1.1 : 1.0;
  const audit = p.audits ? 1.05 : 1.0;
  const value = base * momentum * chainBoost * fresh * catBoost * audit;
  return {
    value: Math.round(value),
    parts: {
      base: Math.round(base),
      momentum: +momentum.toFixed(3),
      chainBoost: +chainBoost.toFixed(3),
      fresh: +fresh.toFixed(3),
      catBoost: +catBoost.toFixed(3),
      audit: +audit.toFixed(3),
    },
  };
}

function farmPlan(p: Proto, value: number): string[] {
  const cat = (p.category ?? "").toLowerCase();
  const steps: string[] = [];
  steps.push(`Track ${p.name} on DefiLlama and their official X/Discord for token announcements.`);
  if (/dex|perps|derivatives/.test(cat)) {
    steps.push("Provide liquidity to their main pool and accumulate volume; DEX/perp protocols usually airdrop to LPs and traders.");
    steps.push("Trade regularly with small size to build a volume footprint; snapshot likely before TGE.");
  } else if (/lending|cdp/.test(cat)) {
    steps.push("Supply collateral and borrow against it to build both supply and borrow activity.");
    steps.push("Repay cleanly and repeat across a few epochs to show sustained usage.");
  } else if (/bridge/.test(cat)) {
    steps.push("Bridge small amounts across supported chains to register on multiple chain-specific snapshots.");
  } else if (/yield|vault|staking/.test(cat)) {
    steps.push("Deposit into their vaults and keep positions open across snapshot dates.");
  } else {
    steps.push("Use the protocol's core product weekly with modest size to build on-chain history.");
  }
  steps.push("Join their testnet or points program if live; testnet tasks often convert to mainnet allocations.");
  steps.push("Keep a dedicated wallet for farming so sybil filters don't flag your main holdings.");
  steps.push(`Estimated implied FDV at launch: ~$${value.toLocaleString()} — size positions accordingly.`);
  return steps;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "protocol";
}

function main() {
  const snap = findSnapshot();
  if (snap.length === 0) {
    console.warn("No snapshot found; writing empty board.");
  }

  const rows = snap
    .filter((p): p is Proto => !!p && typeof p === "object" && typeof p.name === "string" && p.name.trim().length > 0)
    .filter((p) => !hasToken(p))
    .filter((p) => !isWrappedOrStaked(p))
    .filter((p) => num(p.tvl) > 0)
    .map((p) => {
      const s = score(p);
      return {
        name: p.name,
        slug: p.slug ?? slugify(p.name),
        category: p.category ?? "Unknown",
        chains: Array.isArray(p.chains) ? p.chains : [],
        tvl: Math.round(num(p.tvl)),
        change_1d: num(p.change_1d),
        change_7d: num(p.change_7d),
        change_1m: num(p.change_1m),
        impliedValue: s.value,
        scoreParts: s.parts,
        farmPlan: farmPlan(p, s.value),
        url: p.url ?? null,
        twitter: p.twitter ?? null,
        description: p.description ?? null,
      };
    })
    .sort((a, b) => b.impliedValue - a.impliedValue || a.name.localeCompare(b.name));

  const generatedAt = new Date().toISOString();
  const board = {
    generatedAt,
    totalProtocols: snap.length,
    tokenlessCount: rows.length,
    rows,
  };

  const dossier = {
    generatedAt,
    methodology: {
      filter: "Protocols with no token, excluding wrapped/staked/stable derivatives and child protocols.",
      scoring: "impliedValue = TVL * 0.9 * momentum * chainBoost * freshness * categoryBoost * auditBoost",
    },
    top: rows.slice(0, 25).map((r) => ({ name: r.name, impliedValue: r.impliedValue, category: r.category })),
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));
  writeFileSync(join(OUT, "dossier.json"), JSON.stringify(dossier, null, 2));

  const dashDir = join(OUT, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "data.js"), `window.BOARD = ${JSON.stringify(board)};\n`);

  console.log(`Wrote board.json with ${rows.length} rows from ${snap.length} protocols.`);
}

try {
  main();
} catch (err) {
  console.error(`Fatal: ${(err as Error).message}`);
  process.exitCode = 1;
}