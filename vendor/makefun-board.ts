import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * makefun-board.ts — kit-provided helper for the token-radar bounty.
 *
 * It turns a board (the ranked watchlist) plus provenance metadata into a
 * deterministic dossier.json, and offers small utilities the entrypoint uses
 * to keep the board honest (stable ids, checksums, coverage checks).
 *
 * No network access. No external dependencies. Node 22+ standard library only.
 */

export type FarmStep = {
  step: number;
  action: string;
  detail: string;
};

export type FarmPlan = {
  summary: string;
  steps: FarmStep[];
  effort: "low" | "medium" | "high";
  capital: string;
  risks: string[];
};

export type BoardRow = {
  rank: number;
  id: string;
  name: string;
  category: string;
  chains: string[];
  tvlUsd: number;
  impliedValueUsd: number;
  impliedValueLabel: string;
  confidence: number;
  rationale: string;
  farmPlan: FarmPlan;
};

export type Board = {
  generatedAt: string;
  source: string;
  snapshot: {
    protocols: number;
    withToken: number;
    noToken: number;
    excluded: number;
    watchlist: number;
  };
  rows: BoardRow[];
};

export type Dossier = {
  format: "makefun-dossier/1";
  bounty: string;
  generatedAt: string;
  board: {
    sha256: string;
    rows: number;
    top: { rank: number; name: string; impliedValueUsd: number }[];
    categories: Record<string, number>;
  };
  coverage: {
    snapshotProtocols: number;
    watchlist: number;
    covered: number;
    complete: boolean;
  };
  provenance: {
    entrypoint: string;
    license: string;
    network: "none";
    node: string;
  };
};

const BOUNTY = "token-radar-01";
const FORMAT = "makefun-dossier/1" as const;

/** Stable, filesystem-safe id from a protocol name. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "unnamed";
}

/** Deterministic short hash used to disambiguate duplicate slugs. */
export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
}

/** Assign unique ids to rows, disambiguating collisions with a short hash. */
export function assignIds(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const base = slug(name);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${shortHash(name)}`;
  });
}

/** Human label for an implied value in USD. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [scale, suffix] of units) {
    if (value >= scale) {
      const n = value / scale;
      const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
      return `$${n.toFixed(digits)}${suffix}`;
    }
  }
  return `$${Math.round(value)}`;
}

/** Clamp a confidence score to [0,1] and round to two decimals. */
export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

/** Sort rows by implied value descending, then by name, then reassign ranks. */
export function rankRows(rows: Omit<BoardRow, "rank">[]): BoardRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.impliedValueUsd !== a.impliedValueUsd) {
        return b.impliedValueUsd - a.impliedValueUsd;
      }
      return a.name.localeCompare(b.name);
    })
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** sha256 of a file's bytes, hex encoded. */
export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** sha256 of a string, hex encoded. */
export function textSha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Build the dossier from a board and its snapshot counts. */
export function buildDossier(
  board: Board,
  snapshotProtocols: number,
  boardPath: string,
): Dossier {
  const categories: Record<string, number> = {};
  for (const row of board.rows) {
    categories[row.category] = (categories[row.category] ?? 0) + 1;
  }
  const boardSha = existsSync(boardPath)
    ? fileSha256(boardPath)
    : textSha256(JSON.stringify(board));
  const watchlist = board.snapshot.watchlist;
  return {
    format: FORMAT,
    bounty: BOUNTY,
    generatedAt: board.generatedAt,
    board: {
      sha256: boardSha,
      rows: board.rows.length,
      top: board.rows.slice(0, 10).map((r) => ({
        rank: r.rank,
        name: r.name,
        impliedValueUsd: r.impliedValueUsd,
      })),
      categories,
    },
    coverage: {
      snapshotProtocols,
      watchlist,
      covered: board.rows.length,
      complete: board.rows.length >= watchlist && watchlist > 0,
    },
    provenance: {
      entrypoint: "main.ts",
      license: "MIT",
      network: "none",
      node: "22",
    },
  };
}

/** Write dossier.json into the output directory. */
export function writeDossier(dossier: Dossier, outputDir: string): string {
  const path = join(outputDir, "dossier.json");
  writeFileSync(path, JSON.stringify(dossier, null, 2) + "\n");
  return path;
}

/** Read a board.json from disk, validating the minimum shape. */
export function readBoard(path: string): Board {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Board;
  if (!raw || !Array.isArray(raw.rows)) {
    throw new Error(`board at ${path} has no rows`);
  }
  return raw;
}

/** Assert the board covers the whole watchlist; throws with a clear message. */
export function assertCoverage(board: Board): void {
  const expected = board.snapshot.watchlist;
  if (board.rows.length < expected) {
    throw new Error(
      `board covers ${board.rows.length} of ${expected} watchlist protocols`,
    );
  }
  if (board.rows.length < 100) {
    throw new Error(`board has ${board.rows.length} rows, needs at least 100`);
  }
  const ids = new Set<string>();
  for (const row of board.rows) {
    if (ids.has(row.id)) throw new Error(`duplicate row id: ${row.id}`);
    ids.add(row.id);
    if (!row.farmPlan || row.farmPlan.steps.length === 0) {
      throw new Error(`row ${row.id} has no farm plan`);
    }
    if (!Number.isFinite(row.impliedValueUsd) || row.impliedValueUsd < 0) {
      throw new Error(`row ${row.id} has an invalid implied value`);
    }
  }
}

/** CLI: node vendor/makefun-board.ts <board.json> <outputDir> */
export function main(argv: string[]): number {
  const [boardPath, outputDir] = argv;
  if (!boardPath || !outputDir) {
    console.error("usage: makefun-board <board.json> <outputDir>");
    return 2;
  }
  const board = readBoard(boardPath);
  assertCoverage(board);
  const dossier = buildDossier(board, board.snapshot.protocols, boardPath);
  const path = writeDossier(dossier, outputDir);
  console.log(`wrote ${path} (${dossier.board.rows} rows)`);
  return 0;
}

const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /makefun-board\.(ts|js|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}