// vendor/makefun-board.ts
// Kit-provided board/dossier helper. Emits dossier.json describing the board
// produced by main.ts. Self-contained, dependency free, Node 22.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface BoardRow {
  slug: string;
  name: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  impliedValueUsd?: number;
  launchScore?: number;
  farmPlan?: string[];
  [k: string]: unknown;
}

export interface DossierInput {
  generatedAt?: string;
  source?: string;
  rows: BoardRow[];
  meta?: Record<string, unknown>;
}

export interface Dossier {
  format: "makefun-board/1";
  generatedAt: string;
  source: string;
  rowCount: number;
  checksum: string;
  categories: Record<string, number>;
  chains: Record<string, number>;
  top: Array<{
    rank: number;
    slug: string;
    name: string;
    impliedValueUsd: number;
    launchScore: number;
    farmSteps: number;
  }>;
  meta: Record<string, unknown>;
}

const FORMAT = "makefun-board/1" as const;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function checksumOf(rows: BoardRow[]): string {
  const h = createHash("sha256");
  h.update(stableStringify(rows));
  return h.digest("hex");
}

function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) {
    if (!v) continue;
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export function buildDossier(input: DossierInput): Dossier {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const source = input.source ?? "defillama-snapshot";

  const categories = tally(rows.map((r) => String(r.category ?? "unknown")));
  const chains = tally(rows.flatMap((r) => (Array.isArray(r.chains) ? r.chains.map(String) : [])));

  const ranked = rows
    .map((r) => ({
      slug: String(r.slug ?? ""),
      name: String(r.name ?? r.slug ?? ""),
      impliedValueUsd: Number(r.impliedValueUsd ?? 0) || 0,
      launchScore: Number(r.launchScore ?? 0) || 0,
      farmSteps: Array.isArray(r.farmPlan) ? r.farmPlan.length : 0,
    }))
    .sort((a, b) => b.impliedValueUsd - a.impliedValueUsd || b.launchScore - a.launchScore)
    .slice(0, 25)
    .map((r, i) => ({ rank: i + 1, ...r }));

  return {
    format: FORMAT,
    generatedAt,
    source,
    rowCount: rows.length,
    checksum: checksumOf(rows),
    categories,
    chains,
    top: ranked,
    meta: input.meta ?? {},
  };
}

export function writeDossier(outDir: string, input: DossierInput): { path: string; dossier: Dossier } {
  const dossier = buildDossier(input);
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "dossier.json");
  writeFileSync(path, JSON.stringify(dossier, null, 2) + "\n", "utf8");
  return { path, dossier };
}

export function readBoard(path: string): BoardRow[] {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed as BoardRow[];
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as BoardRow[];
    if (Array.isArray(obj.board)) return obj.board as BoardRow[];
  }
  throw new Error(`board file ${path} does not contain a row array`);
}

export function verifyDossier(dossier: Dossier, rows: BoardRow[]): boolean {
  return dossier.format === FORMAT && dossier.checksum === checksumOf(rows) && dossier.rowCount === rows.length;
}

export function dossierFromBoardFile(boardPath: string, outDir: string): Dossier {
  const rows = readBoard(boardPath);
  return writeDossier(outDir, { rows, source: "board.json" }).dossier;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const boardPath = process.argv[2] ?? join(process.env.MAKEFUN_OUTPUT_DIR ?? ".", "board.json");
  const outDir = process.argv[3] ?? process.env.MAKEFUN_OUTPUT_DIR ?? dirname(boardPath);
  const dossier = dossierFromBoardFile(boardPath, outDir);
  process.stdout.write(`wrote dossier.json with ${dossier.rowCount} rows (checksum ${dossier.checksum.slice(0, 12)})\n`);
}

export default { buildDossier, writeDossier, readBoard, verifyDossier, dossierFromBoardFile };