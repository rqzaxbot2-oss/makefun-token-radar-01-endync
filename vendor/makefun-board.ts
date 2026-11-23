import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BoardRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
  impliedValue: number;
  score: number;
  rank: number;
  farmPlan: string[];
  reason: string;
  url: string | null;
}

export interface Dossier {
  format: "makefun-board/1";
  generatedAt: string;
  source: string;
  totals: {
    protocols: number;
    rows: number;
    covered: number;
    excluded: number;
  };
  rows: BoardRow[];
  excluded: Array<{ slug: string; name: string; reason: string }>;
  notes: string[];
}

export interface BuildOptions {
  outDir?: string;
  sourceLabel?: string;
  generatedAt?: string;
}

const WRAPPED_HINTS = [
  "wrapped",
  "staked",
  "staking",
  "restaked",
  "restaking",
  "liquid staking",
  "lst",
  "lrt",
  "vault",
  "receipt",
  "bridged",
  "synthetic",
  "derivative",
  "ib token",
  "a token",
  "c token",
  "gauge",
  "liquidity pool",
];

const STABLE_HINTS = ["stable", "usd", "dollar", "tether", "usdc", "usdt", "dai", "frax"];

export function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function looksWrappedOrStaked(name: string, category: string | null): boolean {
  const hay = `${name} ${category ?? ""}`.toLowerCase();
  return WRAPPED_HINTS.some((hint) => hay.includes(hint));
}

export function looksStable(name: string, category: string | null): boolean {
  const hay = `${name} ${category ?? ""}`.toLowerCase();
  return STABLE_HINTS.some((hint) => hay.includes(hint));
}

export function impliedValue(tvl: number, category: string | null, chains: string[]): number {
  const cat = (category ?? "").toLowerCase();
  let multiplier = 0.12;
  if (cat.includes("dex")) multiplier = 0.22;
  else if (cat.includes("lending")) multiplier = 0.2;
  else if (cat.includes("bridge")) multiplier = 0.16;
  else if (cat.includes("perp")) multiplier = 0.26;
  else if (cat.includes("yield")) multiplier = 0.14;
  else if (cat.includes("cdp")) multiplier = 0.18;
  else if (cat.includes("rwa")) multiplier = 0.1;
  const chainBoost = 1 + Math.min(chains.length, 8) * 0.03;
  const sizeBoost = 1 + Math.log10(1 + Math.max(0, tvl)) / 20;
  return Math.round(tvl * multiplier * chainBoost * sizeBoost);
}

export function scoreRow(row: Omit<BoardRow, "score" | "rank">): number {
  const value = Math.max(0, row.impliedValue);
  const size = Math.log10(1 + value);
  const chainFactor = 1 + Math.min(row.chains.length, 10) * 0.05;
  const planFactor = 1 + Math.min(row.farmPlan.length, 6) * 0.02;
  return Math.round(size * chainFactor * planFactor * 1000) / 1000;
}

export function buildFarmPlan(row: {
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
}): string[] {
  const chain = row.chains[0] ?? "the main chain";
  const cat = (row.category ?? "protocol").toLowerCase();
  const plan: string[] = [];
  plan.push(`Watch ${row.name} on ${chain} for a points or testnet announcement before any token exists.`);
  if (cat.includes("dex") || cat.includes("perp")) {
    plan.push(`Provide liquidity or trade on ${row.name} to build volume that a future airdrop can weight.`);
  } else if (cat.includes("lending") || cat.includes("cdp")) {
    plan.push(`Supply and borrow small amounts on ${row.name} to keep a healthy position without liquidation risk.`);
  } else if (cat.includes("bridge")) {
    plan.push(`Move a small balance across ${row.name} to register bridge usage early.`);
  } else if (cat.includes("yield")) {
    plan.push(`Deposit into ${row.name} vaults to accrue yield and potential points.`);
  } else {
    plan.push(`Use ${row.name} for its core product and keep a record of the activity.`);
  }
  plan.push(`Track ${row.name} governance and docs for a token or points program.`);
  plan.push(`Keep gas on ${chain} ready so you can act on a launch announcement.`);
  return plan;
}

export function makeRow(input: {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
  url?: string | null;
  reason?: string;
}): BoardRow {
  const base = {
    slug: normalizeSlug(input.slug || input.name),
    name: input.name,
    category: input.category,
    chains: input.chains.length ? input.chains : ["unknown"],
    tvl: Math.max(0, input.tvl),
    impliedValue: impliedValue(input.tvl, input.category, input.chains),
    farmPlan: buildFarmPlan({
      name: input.name,
      category: input.category,
      chains: input.chains,
      tvl: input.tvl,
    }),
    reason: input.reason ?? "No token recorded and not a wrapped or staked product.",
    url: input.url ?? null,
  };
  const score = scoreRow(base);
  return { ...base, score, rank: 0 };
}

export function rankRows(rows: BoardRow[]): BoardRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.impliedValue !== a.impliedValue) return b.impliedValue - a.impliedValue;
    return a.slug.localeCompare(b.slug);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildDossier(
  rows: BoardRow[],
  excluded: Array<{ slug: string; name: string; reason: string }>,
  options: BuildOptions = {},
): Dossier {
  const ranked = rankRows(rows);
  const covered = ranked.length;
  return {
    format: "makefun-board/1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: options.sourceLabel ?? "sealed-defillama-snapshot",
    totals: {
      protocols: covered + excluded.length,
      rows: ranked.length,
      covered,
      excluded: excluded.length,
    },
    rows: ranked,
    excluded,
    notes: [
      "Implied value is a heuristic on TVL, category and chain spread.",
      "Wrapped, staked and bridged products are excluded from the watchlist.",
    ],
  };
}

export function writeDossier(dossier: Dossier, outDir: string): string {
  const dir = resolve(outDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = resolve(dir, "dossier.json");
  writeFileSync(target, `${JSON.stringify(dossier, null, 2)}\n`, "utf8");
  return target;
}

export function writeBoard(rows: BoardRow[], outDir: string): string {
  const dir = resolve(outDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = resolve(dir, "board.json");
  const ranked = rankRows(rows);
  writeFileSync(target, `${JSON.stringify({ rows: ranked }, null, 2)}\n`, "utf8");
  return target;
}

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function ensureDirFor(path: string): void {
  const dir = dirname(resolve(path));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function summarize(rows: BoardRow[]): string {
  const ranked = rankRows(rows);
  const top = ranked.slice(0, 5).map((row) => `${row.rank}. ${row.name} ($${row.impliedValue.toLocaleString("en-US")})`);
  return [`${ranked.length} protocols on the watchlist`, ...top].join("\n");
}
</｜DSML｜ parameter>
</｜DSML｜ invoke>
</｜DSML｜ calls>