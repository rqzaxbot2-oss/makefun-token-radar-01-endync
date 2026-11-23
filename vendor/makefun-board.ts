import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvlUsd: number;
  impliedValueUsd: number;
  launchScore: number;
  farmSteps: string[];
  notes: string;
  [key: string]: unknown;
}

export interface Board {
  version: string;
  generatedAt: string;
  source: string;
  rows: BoardRow[];
  stats: {
    total: number;
    covered: number;
    noToken: number;
    excluded: number;
    totalImpliedValueUsd: number;
  };
}

export interface Dossier {
  version: string;
  generatedAt: string;
  boardHash: string;
  rowCount: number;
  topRows: Array<{
    rank: number;
    slug: string;
    name: string;
    impliedValueUsd: number;
    launchScore: number;
  }>;
  methodology: string;
  files: Record<string, string>;
}

const BOARD_VERSION = "makefun-board/1";
const DOSSIER_VERSION = "makefun-dossier/1";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export function hashBoard(board: Board): string {
  return sha256(stableStringify(board));
}

export function validateBoard(board: Board): string[] {
  const errors: string[] = [];
  if (!board || typeof board !== "object") {
    errors.push("board is not an object");
    return errors;
  }
  if (board.version !== BOARD_VERSION) {
    errors.push(`board.version must be ${BOARD_VERSION}`);
  }
  if (!Array.isArray(board.rows)) {
    errors.push("board.rows must be an array");
    return errors;
  }
  if (board.rows.length < 100) {
    errors.push(`board.rows must have at least 100 rows (has ${board.rows.length})`);
  }
  const seen = new Set<string>();
  board.rows.forEach((row, i) => {
    if (!row || typeof row !== "object") {
      errors.push(`row ${i} is not an object`);
      return;
    }
    if (typeof row.slug !== "string" || row.slug.length === 0) {
      errors.push(`row ${i} has no slug`);
    } else if (seen.has(row.slug)) {
      errors.push(`row ${i} repeats slug ${row.slug}`);
    } else {
      seen.add(row.slug);
    }
    if (typeof row.name !== "string" || row.name.length === 0) {
      errors.push(`row ${i} has no name`);
    }
    if (typeof row.impliedValueUsd !== "number" || !Number.isFinite(row.impliedValueUsd)) {
      errors.push(`row ${i} has no finite impliedValueUsd`);
    }
    if (!Array.isArray(row.farmSteps) || row.farmSteps.length === 0) {
      errors.push(`row ${i} has no farmSteps`);
    }
    if (typeof row.rank !== "number") {
      errors.push(`row ${i} has no numeric rank`);
    }
  });
  return errors;
}

export function buildDossier(board: Board, methodology?: string): Dossier {
  const errors = validateBoard(board);
  if (errors.length > 0) {
    throw new Error("invalid board: " + errors.join("; "));
  }
  const sorted = [...board.rows].sort((a, b) => a.rank - b.rank);
  const topRows = sorted.slice(0, 25).map((row) => ({
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    impliedValueUsd: row.impliedValueUsd,
    launchScore: row.launchScore,
  }));
  return {
    version: DOSSIER_VERSION,
    generatedAt: board.generatedAt,
    boardHash: hashBoard(board),
    rowCount: board.rows.length,
    topRows,
    methodology:
      methodology ??
      "Protocols tracked by DefiLlama with no token of their own, excluding wrapped and staked products of tokens that already trade, ranked by implied launch value (TVL times category multiple) and launch readiness.",
    files: {
      "board.json": "The full watchlist board with implied values and farm plans.",
      "dashboard/index.html": "Static dashboard rendering the board, detail views and filters.",
    },
  };
}

export function writeJson(path: string, value: unknown): void {
  const abs = resolve(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function writeBoard(path: string, board: Board): void {
  const errors = validateBoard(board);
  if (errors.length > 0) {
    throw new Error("invalid board: " + errors.join("; "));
  }
  writeJson(path, board);
}

export function writeDossier(path: string, dossier: Dossier): void {
  writeJson(path, dossier);
}

export function loadBoard(path: string): Board {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`board not found at ${abs}`);
  }
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as Board;
  const errors = validateBoard(parsed);
  if (errors.length > 0) {
    throw new Error("invalid board: " + errors.join("; "));
  }
  return parsed;
}

export function emitBoardAndDossier(
  outputDir: string,
  board: Board,
  methodology?: string,
): { boardPath: string; dossierPath: string; dossier: Dossier } {
  const boardPath = resolve(outputDir, "board.json");
  const dossierPath = resolve(outputDir, "dossier.json");
  writeBoard(boardPath, board);
  const dossier = buildDossier(board, methodology);
  writeDossier(dossierPath, dossier);
  return { boardPath, dossierPath, dossier };
}

export const BOARD_FORMAT_VERSION = BOARD_VERSION;
export const DOSSIER_FORMAT_VERSION = DOSSIER_VERSION;
</｜DSML｜ parameter>
</｜DSML｜ invoke>
</｜DSML｜ calls>