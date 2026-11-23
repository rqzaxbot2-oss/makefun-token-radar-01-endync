// vendor/makefun-board.ts
// Kit-provided board/dossier helper, vendored unchanged.
// Builds board.json rows and dossier.json from a token-launch radar snapshot.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ProtocolRow {
  slug: string;
  name: string;
  chain: string;
  category: string;
  tvl: number;
  listedAt: number | null;
  token: string | null;
  wrappedOrStaked: boolean;
  impliedValue: number;
  impliedValueUsd: number;
  confidence: number;
  farmPlan: FarmStep[];
  notes: string;
}

export interface FarmStep {
  step: number;
  action: string;
  where: string;
  expected: string;
}

export interface BoardFile {
  generatedAt: string;
  source: string;
  snapshotHash: string;
  count: number;
  rows: ProtocolRow[];
}

export interface DossierFile {
  generatedAt: string;
  board: string;
  boardHash: string;
  totals: {
    protocols: number;
    noToken: number;
    wrappedOrStaked: number;
    ranked: number;
  };
  top: Array<{ slug: string; name: string; impliedValueUsd: number }>;
  methodology: string[];
}

const DEFAULT_SOURCE = "defillama-snapshot";

export function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function roundUsd(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n >= 1_000_000_000) return Math.round(n / 1_000_000) * 1_000_000;
  if (n >= 1_000_000) return Math.round(n / 1_000) * 1_000;
  if (n >= 1_000) return Math.round(n);
  return Math.round(n * 100) / 100;
}

export function scoreImpliedValue(tvl: number, confidence: number): number {
  const base = Math.max(0, tvl);
  const weight = Math.min(1, Math.max(0, confidence));
  // Launch value proxy: TVL scaled by confidence, with a mild superlinear kicker
  // for larger protocols (bigger TVL tends to mean bigger token float demand).
  const kicker = 1 + Math.log10(1 + base / 1_000_000) * 0.15;
  return roundUsd(base * weight * kicker);
}

export function isWrappedOrStaked(name: string, slug: string, token: string | null): boolean {
  const hay = `${name} ${slug} ${token ?? ""}`.toLowerCase();
  const markers = [
    "wrapped",
    "staked",
    "stake",
    "restaked",
    "restaking",
    "liquid staking",
    "lst",
    "lsd",
    "receipt",
    "vault share",
    "gauge",
    "wst",
    "rst",
    "st-",
    "-st",
  ];
  if (/\bw(eth|btc|sol|matic|avax)\b/.test(hay)) return true;
  return markers.some((m) => hay.includes(m));
}

export function buildFarmPlan(row: Omit<ProtocolRow, "farmPlan">): FarmStep[] {
  const where = row.chain || "multi-chain";
  const steps: FarmStep[] = [
    {
      step: 1,
      action: "Track the protocol's docs, governance forum and X account for token or points announcements.",
      where: `${row.name} official channels`,
      expected: "Early notice of snapshot dates and eligibility rules",
    },
    {
      step: 2,
      action: "Bridge a small amount of gas and deposit into the protocol's core pool or product.",
      where,
      expected: "On-chain footprint that qualifies for a potential airdrop",
    },
    {
      step: 3,
      action: "Hold the position across at least two snapshots and keep activity organic (no wash loops).",
      where: `${row.name} contracts`,
      expected: "Consistent usage weight in any points program",
    },
    {
      step: 4,
      action: "Diversify across 2-3 chains or pools if the protocol is multi-chain, keeping each position small.",
      where: `${row.name} deployments`,
      expected: "Coverage of chain-specific allocation buckets",
    },
    {
      step: 5,
      action: "Log wallet, dates and amounts; review monthly and exit if TVL collapses or a token launches.",
      where: "local tracker",
      expected: "Clean records for claiming and tax",
    },
  ];
  return steps;
}

export function normalizeRow(raw: Partial<ProtocolRow> & { name: string; slug?: string }): ProtocolRow {
  const slug = raw.slug ?? raw.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const tvl = Number.isFinite(raw.tvl) ? Number(raw.tvl) : 0;
  const confidence = Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0.5;
  const token = raw.token ?? null;
  const wrappedOrStaked = raw.wrappedOrStaked ?? isWrappedOrStaked(raw.name, slug, token);
  const base: Omit<ProtocolRow, "farmPlan"> = {
    slug,
    name: raw.name,
    chain: raw.chain ?? "multi-chain",
    category: raw.category ?? "unknown",
    tvl,
    listedAt: raw.listedAt ?? null,
    token,
    wrappedOrStaked,
    impliedValue: 0,
    impliedValueUsd: 0,
    confidence,
    notes: raw.notes ?? "",
  };
  const impliedValueUsd = wrappedOrStaked || token ? 0 : scoreImpliedValue(tvl, confidence);
  const row: ProtocolRow = {
    ...base,
    impliedValue: impliedValueUsd,
    impliedValueUsd,
    farmPlan: buildFarmPlan(base),
  };
  return row;
}

export function rankRows(rows: ProtocolRow[]): ProtocolRow[] {
  return [...rows].sort((a, b) => {
    if (b.impliedValueUsd !== a.impliedValueUsd) return b.impliedValueUsd - a.impliedValueUsd;
    if (b.tvl !== a.tvl) return b.tvl - a.tvl;
    return a.slug.localeCompare(b.slug);
  });
}

export function buildBoard(rows: ProtocolRow[], source = DEFAULT_SOURCE): BoardFile {
  const ranked = rankRows(rows);
  const payload = JSON.stringify(ranked.map((r) => [r.slug, r.impliedValueUsd, r.tvl]));
  return {
    generatedAt: new Date().toISOString(),
    source,
    snapshotHash: stableHash(payload),
    count: ranked.length,
    rows: ranked,
  };
}

export function buildDossier(board: BoardFile, boardPath = "board.json"): DossierFile {
  const noToken = board.rows.filter((r) => !r.token).length;
  const wrappedOrStaked = board.rows.filter((r) => r.wrappedOrStaked).length;
  const ranked = board.rows.filter((r) => !r.token && !r.wrappedOrStaked).length;
  const top = board.rows
    .filter((r) => !r.token && !r.wrappedOrStaked)
    .slice(0, 25)
    .map((r) => ({ slug: r.slug, name: r.name, impliedValueUsd: r.impliedValueUsd }));
  return {
    generatedAt: new Date().toISOString(),
    board: boardPath,
    boardHash: stableHash(JSON.stringify(board.rows)),
    totals: {
      protocols: board.rows.length,
      noToken,
      wrappedOrStaked,
      ranked,
    },
    top,
    methodology: [
      "Snapshot: every protocol DefiLlama tracks, read once and hashed.",
      "Exclude protocols that already record a token.",
      "Exclude wrapped and staked products of a token that already trades.",
      "Implied value = TVL x confidence x a mild log kicker for larger protocols.",
      "Rank by implied value, then TVL, then slug for stable ordering.",
      "Each row carries a five-step farm plan for pre-launch positioning.",
    ],
  };
}

export function writeJson(path: string, data: unknown): void {
  const dir = dirname(resolve(path));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function writeBoardAndDossier(
  rows: ProtocolRow[],
  outDir: string,
  source = DEFAULT_SOURCE,
): { board: BoardFile; dossier: DossierFile; boardPath: string; dossierPath: string } {
  const board = buildBoard(rows, source);
  const boardPath = join(outDir, "board.json");
  writeJson(boardPath, board);
  const dossier = buildDossier(board, "board.json");
  const dossierPath = join(outDir, "dossier.json");
  writeJson(dossierPath, dossier);
  return { board, dossier, boardPath, dossierPath };
}

export function loadSnapshot(path: string): unknown {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text);
}

export function rowsFromSnapshot(snapshot: unknown): ProtocolRow[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const obj = snapshot as Record<string, unknown>;
  const list = Array.isArray(obj.protocols)
    ? obj.protocols
    : Array.isArray(obj.data)
      ? obj.data
      : Array.isArray(snapshot)
        ? (snapshot as unknown[])
        : [];
  const rows: ProtocolRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : typeof rec.slug === "string" ? rec.slug : null;
    if (!name) continue;
    rows.push(
      normalizeRow({
        name,
        slug: typeof rec.slug === "string" ? rec.slug : undefined,
        chain: typeof rec.chain === "string" ? rec.chain : undefined,
        category: typeof rec.category === "string" ? rec.category : undefined,
        tvl: typeof rec.tvl === "number" ? rec.tvl : Number(rec.tvl) || 0,
        token: typeof rec.token === "string" ? rec.token : null,
        confidence: typeof rec.confidence === "number" ? rec.confidence : 0.5,
        listedAt: typeof rec.listedAt === "number" ? rec.listedAt : null,
      }),
    );
  }
  return rows;
}

export const VERSION = "makefun-board/1";
</｜DSML｜ parameter>
</｜DSML｜ invoke>
</｜DSML｜ calls>