// vendor/makefun-board.ts
// Kit-provided board/dossier helper. Emits dossier.json describing the entry.
// Self-contained: only Node standard library imports.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

export type BoardRow = {
  id: string;
  name: string;
  category?: string;
  chains?: string[];
  tvl?: number | null;
  impliedValue?: number | null;
  impliedValueUsd?: number | null;
  farmPlan?: string | string[];
  notes?: string;
  [key: string]: unknown;
};

export type DossierInput = {
  title?: string;
  generatedAt?: string;
  rows?: BoardRow[];
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

export type Dossier = {
  format: string;
  version: number;
  title: string;
  generatedAt: string;
  rowCount: number;
  rows: BoardRow[];
  checksum: string;
  meta: Record<string, unknown>;
};

const FORMAT = "makefun-board-dossier/1";
const VERSION = 1;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

function checksumOf(rows: BoardRow[]): string {
  const h = createHash("sha256");
  h.update(stableStringify(rows));
  return h.digest("hex");
}

function normalizeRow(row: BoardRow, index: number): BoardRow {
  const id =
    typeof row.id === "string" && row.id.length > 0
      ? row.id
      : typeof row.name === "string" && row.name.length > 0
        ? row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        : `row-${index + 1}`;
  const out: BoardRow = { ...row, id };
  if (!out.name) out.name = id;
  if (out.impliedValue === undefined && out.impliedValueUsd !== undefined) {
    out.impliedValue = out.impliedValueUsd;
  }
  if (out.impliedValueUsd === undefined && out.impliedValue !== undefined) {
    out.impliedValueUsd = out.impliedValue;
  }
  if (out.farmPlan === undefined) out.farmPlan = "";
  return out;
}

export function buildDossier(input: DossierInput): Dossier {
  const rows = Array.isArray(input.rows) ? input.rows.map(normalizeRow) : [];
  const title =
    typeof input.title === "string" && input.title.length > 0
      ? input.title
      : "Token Launch Radar";
  const generatedAt =
    typeof input.generatedAt === "string" && input.generatedAt.length > 0
      ? input.generatedAt
      : new Date().toISOString();
  const meta: Record<string, unknown> = { ...(input.meta ?? {}) };
  return {
    format: FORMAT,
    version: VERSION,
    title,
    generatedAt,
    rowCount: rows.length,
    rows,
    checksum: checksumOf(rows),
    meta,
  };
}

export function writeDossier(
  input: DossierInput,
  outDir?: string,
): { path: string; dossier: Dossier } {
  const dossier = buildDossier(input);
  const dir = resolve(outDir ?? process.env.MAKEFUN_OUTPUT_DIR ?? process.cwd());
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "dossier.json");
  writeFileSync(path, JSON.stringify(dossier, null, 2) + "\n", "utf8");
  return { path, dossier };
}

export function readDossier(path: string): Dossier {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Dossier;
  if (!parsed || parsed.format !== FORMAT) {
    throw new Error(`not a ${FORMAT} file: ${path}`);
  }
  return parsed;
}

export function verifyDossier(dossier: Dossier): boolean {
  if (!dossier || !Array.isArray(dossier.rows)) return false;
  return checksumOf(dossier.rows) === dossier.checksum;
}

export function validateDossier(input: DossierInput): string[] {
  const problems: string[] = [];
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length < 100) {
    problems.push(`board has ${rows.length} rows; at least 100 required`);
  }
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const n = normalizeRow(row, i);
    if (seen.has(n.id)) problems.push(`duplicate id: ${n.id}`);
    seen.add(n.id);
    if (n.impliedValue === undefined || n.impliedValue === null) {
      problems.push(`row ${n.id} has no implied value`);
    }
    const plan = n.farmPlan;
    const hasPlan =
      (typeof plan === "string" && plan.trim().length > 0) ||
      (Array.isArray(plan) && plan.length > 0);
    if (!hasPlan) problems.push(`row ${n.id} has no farm plan`);
  });
  return problems;
}

export function loadBoardJson(path: string): BoardRow[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as BoardRow[];
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows as BoardRow[];
  return [];
}

export function emitDossierFromBoard(
  boardPath: string,
  outDir?: string,
  title?: string,
): { path: string; dossier: Dossier } {
  const rows = loadBoardJson(boardPath);
  return writeDossier({ rows, title }, outDir);
}

export default {
  buildDossier,
  writeDossier,
  readDossier,
  verifyDossier,
  validateDossier,
  loadBoardJson,
  emitDossierFromBoard,
};
</｜DSML｜ parameter>
</｜DSML｜ invoke>
</｜DSML｜ calls>