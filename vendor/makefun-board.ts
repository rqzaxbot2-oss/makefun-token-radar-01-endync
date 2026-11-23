// vendor/makefun-board.ts
// Kit-provided board/dossier helper. Emits dossier.json from board.json.
// Dependency free, Node 22+, no network calls.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface FarmStep {
  step: string;
  detail: string;
}

export interface FarmPlan {
  steps: FarmStep[];
  capitalUsd: number;
  expectedApyPct: number;
  risk: "low" | "medium" | "high";
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvlUsd: number;
  impliedValueUsd: number;
  valueScore: number;
  tokenStatus: "no-token" | "wrapped" | "staked" | "has-token";
  confidence: number;
  rationale: string;
  farmPlan: FarmPlan;
}

export interface Board {
  generatedAt: string;
  source: string;
  totalProtocols: number;
  watchlist: number;
  rows: BoardRow[];
}

export interface DossierProtocol {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvlUsd: number;
  impliedValueUsd: number;
  rank: number;
  tokenStatus: string;
  confidence: number;
  rationale: string;
  farmPlan: FarmPlan;
}

export interface Dossier {
  format: "makefun-dossier/1";
  generatedAt: string;
  source: string;
  summary: {
    totalProtocols: number;
    watchlist: number;
    noTokenCount: number;
    wrappedOrStakedCount: number;
    totalImpliedValueUsd: number;
    topCategory: string;
  };
  protocols: DossierProtocol[];
}

const DEFAULT_BOARD = "board.json";

export function loadBoard(dir: string = process.cwd()): Board {
  const path = join(dir, DEFAULT_BOARD);
  if (!existsSync(path)) {
    throw new Error(`board.json not found at ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Board;
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error("board.json is malformed: missing rows array");
  }
  return parsed;
}

function topCategory(rows: BoardRow[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [cat, n] of counts) {
    if (n > bestCount) {
      best = cat;
      bestCount = n;
    }
  }
  return best;
}

export function buildDossier(board: Board): Dossier {
  const rows = board.rows.slice().sort((a, b) => a.rank - b.rank);
  const noToken = rows.filter((r) => r.tokenStatus === "no-token").length;
  const wrappedOrStaked = rows.filter(
    (r) => r.tokenStatus === "wrapped" || r.tokenStatus === "staked",
  ).length;
  const totalImplied = rows.reduce((s, r) => s + (r.impliedValueUsd || 0), 0);

  const protocols: DossierProtocol[] = rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvlUsd: r.tvlUsd,
    impliedValueUsd: r.impliedValueUsd,
    rank: r.rank,
    tokenStatus: r.tokenStatus,
    confidence: r.confidence,
    rationale: r.rationale,
    farmPlan: r.farmPlan,
  }));

  return {
    format: "makefun-dossier/1",
    generatedAt: board.generatedAt,
    source: board.source,
    summary: {
      totalProtocols: board.totalProtocols,
      watchlist: board.watchlist,
      noTokenCount: noToken,
      wrappedOrStakedCount: wrappedOrStaked,
      totalImpliedValueUsd: Math.round(totalImplied),
      topCategory: topCategory(rows),
    },
    protocols,
  };
}

export function writeDossier(dossier: Dossier, dir: string = process.cwd()): string {
  const path = join(dir, "dossier.json");
  writeFileSync(path, JSON.stringify(dossier, null, 2) + "\n", "utf8");
  return path;
}

export function emitDossier(dir: string = process.cwd()): string {
  const board = loadBoard(dir);
  const dossier = buildDossier(board);
  return writeDossier(dossier, dir);
}

export function validateBoard(board: Board): string[] {
  const problems: string[] = [];
  if (board.rows.length < 100) {
    problems.push(`board has ${board.rows.length} rows; at least 100 required`);
  }
  const seen = new Set<string>();
  for (const r of board.rows) {
    if (!r.slug) problems.push("row missing slug");
    if (seen.has(r.slug)) problems.push(`duplicate slug: ${r.slug}`);
    seen.add(r.slug);
    if (typeof r.impliedValueUsd !== "number" || r.impliedValueUsd < 0) {
      problems.push(`row ${r.slug} has invalid impliedValueUsd`);
    }
    if (!r.farmPlan || !Array.isArray(r.farmPlan.steps) || r.farmPlan.steps.length === 0) {
      problems.push(`row ${r.slug} has no farm plan`);
    }
  }
  return problems;
}

// CLI: node vendor/makefun-board.ts [dir]
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || process.cwd();
  try {
    const board = loadBoard(dir);
    const problems = validateBoard(board);
    if (problems.length > 0) {
      for (const p of problems) console.error(`warning: ${p}`);
    }
    const path = emitDossier(dir);
    console.log(`wrote ${path}`);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }
}