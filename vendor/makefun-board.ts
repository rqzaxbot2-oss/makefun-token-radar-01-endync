// vendor/makefun-board.ts
// Kit-provided board/dossier helper. Emits dossier.json describing the entry.
// Self-contained: standard library only.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";

export interface BoardRow {
  rank: number;
  protocol: string;
  slug: string;
  category: string;
  chain: string;
  tvl_usd: number;
  implied_value_usd: number;
  confidence: number;
  score: number;
  reason: string;
  farm_plan: {
    steps: string[];
    est_hours: number;
    est_cost_usd: number;
    expected_tokens: string;
  };
  evidence: {
    has_token: boolean;
    wrapped_or_staked: boolean;
    notes: string[];
  };
}

export interface Dossier {
  format: "makefun-dossier/1";
  generated_at: string;
  generator: string;
  summary: {
    rows: number;
    protocols_considered: number;
    protocols_without_token: number;
    top_score: number;
    median_implied_value_usd: number;
    total_implied_value_usd: number;
  };
  filters: {
    categories: string[];
    chains: string[];
    min_tvl_usd: number;
    max_tvl_usd: number;
  };
  board: BoardRow[];
  files: Array<{ name: string; sha256: string; bytes: number }>;
  provenance: {
    snapshot_source: string;
    snapshot_sealed: boolean;
    method: string;
  };
}

const GENERATOR = "makefun-board/1.0.0";

function sha256File(path: string): { sha256: string; bytes: number } | null {
  try {
    const buf = readFileSync(path);
    return { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
  } catch {
    return null;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function loadBoard(boardPath: string): BoardRow[] {
  const raw = readFileSync(boardPath, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as BoardRow[];
  if (parsed && Array.isArray(parsed.board)) return parsed.board as BoardRow[];
  throw new Error(`board.json at ${boardPath} has no board array`);
}

export function buildDossier(opts: {
  boardPath: string;
  outputPath: string;
  rootDir: string;
  extraFiles?: string[];
  snapshotSource?: string;
  snapshotSealed?: boolean;
}): Dossier {
  const board = loadBoard(opts.boardPath);
  const rows = board.length;
  const values = board.map((r) => Number(r.implied_value_usd) || 0);
  const scores = board.map((r) => Number(r.score) || 0);
  const categories = Array.from(new Set(board.map((r) => r.category).filter(Boolean))).sort();
  const chains = Array.from(new Set(board.map((r) => r.chain).filter(Boolean))).sort();
  const tvls = board.map((r) => Number(r.tvl_usd) || 0);

  const files: Array<{ name: string; sha256: string; bytes: number }> = [];
  const candidates = [
    "main.ts",
    "board.json",
    "dashboard/index.html",
    ...(opts.extraFiles ?? []),
  ];
  for (const rel of candidates) {
    const abs = resolve(opts.rootDir, rel);
    if (!existsSync(abs)) continue;
    const h = sha256File(abs);
    if (h) files.push({ name: rel, sha256: h.sha256, bytes: h.bytes });
  }

  const dossier: Dossier = {
    format: "makefun-dossier/1",
    generated_at: new Date().toISOString(),
    generator: GENERATOR,
    summary: {
      rows,
      protocols_considered: rows,
      protocols_without_token: board.filter((r) => r.evidence && r.evidence.has_token === false).length,
      top_score: scores.length ? Math.max(...scores) : 0,
      median_implied_value_usd: round2(median(values)),
      total_implied_value_usd: round2(values.reduce((a, b) => a + b, 0)),
    },
    filters: {
      categories,
      chains,
      min_tvl_usd: tvls.length ? Math.min(...tvls) : 0,
      max_tvl_usd: tvls.length ? Math.max(...tvls) : 0,
    },
    board,
    files,
    provenance: {
      snapshot_source: opts.snapshotSource ?? "sealed DefiLlama protocol snapshot",
      snapshot_sealed: opts.snapshotSealed ?? true,
      method:
        "Filter protocols with no recorded token and not a wrapped/staked derivative of a trading token; " +
        "score by TVL, category multiple, chain premium and confidence; implied value = TVL * category multiple * confidence.",
    },
  };

  writeFileSync(opts.outputPath, JSON.stringify(dossier, null, 2) + "\n", "utf8");
  return dossier;
}

export function verifyDossier(dossierPath: string, rootDir: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  let dossier: Dossier;
  try {
    dossier = JSON.parse(readFileSync(dossierPath, "utf8")) as Dossier;
  } catch (e) {
    return { ok: false, problems: [`cannot read dossier: ${(e as Error).message}`] };
  }
  if (dossier.format !== "makefun-dossier/1") problems.push("format mismatch");
  if (!Array.isArray(dossier.board) || dossier.board.length < 100) {
    problems.push(`board has ${dossier.board?.length ?? 0} rows, need >= 100`);
  }
  for (const f of dossier.files ?? []) {
    const abs = resolve(rootDir, f.name);
    const h = sha256File(abs);
    if (!h) problems.push(`missing file ${f.name}`);
    else if (h.sha256 !== f.sha256) problems.push(`hash drift ${f.name}`);
  }
  return { ok: problems.length === 0, problems };
}

// CLI: node vendor/makefun-board.ts [--board board.json] [--out dossier.json] [--root .]
function main(argv: string[]): void {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args.set(key, val);
    }
  }
  const root = resolve(args.get("root") ?? process.cwd());
  const boardPath = resolve(root, args.get("board") ?? "board.json");
  const outPath = resolve(root, args.get("out") ?? "dossier.json");
  const dossier = buildDossier({ boardPath, outputPath: outPath, rootDir: root });
  const check = verifyDossier(outPath, root);
  process.stdout.write(
    JSON.stringify(
      {
        wrote: relative(root, outPath) || basename(outPath),
        rows: dossier.summary.rows,
        top_score: dossier.summary.top_score,
        median_implied_value_usd: dossier.summary.median_implied_value_usd,
        files: dossier.files.map((f) => f.name),
        verified: check.ok,
        problems: check.problems,
      },
      null,
      2,
    ) + "\n",
  );
  if (!check.ok) process.exitCode = 1;
}

const invokedDirectly = (() => {
  try {
    const entry = process.argv[1] ? resolve(process.argv[1]) : "";
    return entry.endsWith("makefun-board.ts") || entry.endsWith("makefun-board.js");
  } catch {
    return false;
  }
})();

if (invokedDirectly) main(process.argv.slice(2));