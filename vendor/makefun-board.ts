// vendor/makefun-board.ts
// Kit-provided board/dossier helper. Used by main.ts. Do not edit.
//
// Exposes:
//   - Types for board rows, farm plans and dossiers
//   - buildDossier(rows, meta): assemble a dossier from ranked rows
//   - validateBoard(rows): sanity checks used by main.ts before writing board.json
//   - stableSort / compareRows: deterministic ranking helpers
//   - formatUsd / formatPct: display helpers shared with the dashboard
//
// No network. No external deps. Pure functions only.

export type Confidence = "high" | "medium" | "low";

export interface FarmStep {
  step: number;
  action: string;
  detail: string;
  cost_usd?: number;
  risk?: Confidence;
}

export interface FarmPlan {
  summary: string;
  steps: FarmStep[];
  capital_usd: number;
  expected_value_usd: number;
  time_hours: number;
  risks: string[];
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  implied_value_usd: number;
  implied_value_low_usd: number;
  implied_value_high_usd: number;
  confidence: Confidence;
  has_token: false;
  is_wrapped_or_staked: false;
  rationale: string;
  farm: FarmPlan;
  signals: Record<string, number | string | boolean>;
}

export interface DossierMeta {
  generated_at: string;
  source: string;
  snapshot_rows: number;
  watchlist_rows: number;
  excluded_rows: number;
  method: string;
  version: string;
}

export interface Dossier {
  format: "makefun-board/1";
  meta: DossierMeta;
  rows: BoardRow[];
  summary: {
    total_implied_value_usd: number;
    median_implied_value_usd: number;
    top_slug: string | null;
    by_category: Record<string, number>;
    by_confidence: Record<Confidence, number>;
  };
}

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function compareRows(a: BoardRow, b: BoardRow): number {
  if (b.implied_value_usd !== a.implied_value_usd) {
    return b.implied_value_usd - a.implied_value_usd;
  }
  const ca = CONFIDENCE_ORDER[a.confidence] ?? 3;
  const cb = CONFIDENCE_ORDER[b.confidence] ?? 3;
  if (ca !== cb) return ca - cb;
  if (b.tvl_usd !== a.tvl_usd) return b.tvl_usd - a.tvl_usd;
  return a.slug.localeCompare(b.slug);
}

export function stableSort(rows: BoardRow[]): BoardRow[] {
  return [...rows].sort(compareRows);
}

export function validateBoard(rows: BoardRow[]): string[] {
  const problems: string[] = [];
  if (rows.length < 100) {
    problems.push(`board has ${rows.length} rows, need at least 100`);
  }
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.slug) problems.push(`row ${i}: missing slug`);
    if (seen.has(r.slug)) problems.push(`row ${i}: duplicate slug ${r.slug}`);
    seen.add(r.slug);
    if (r.has_token) problems.push(`row ${i} (${r.slug}): has_token must be false`);
    if (r.is_wrapped_or_staked) {
      problems.push(`row ${i} (${r.slug}): wrapped/staked must be excluded`);
    }
    if (!Number.isFinite(r.implied_value_usd) || r.implied_value_usd < 0) {
      problems.push(`row ${i} (${r.slug}): bad implied value`);
    }
    if (r.implied_value_low_usd > r.implied_value_usd ||
        r.implied_value_usd > r.implied_value_high_usd) {
      problems.push(`row ${i} (${r.slug}): implied value outside low/high band`);
    }
    if (!r.farm || !Array.isArray(r.farm.steps) || r.farm.steps.length === 0) {
      problems.push(`row ${i} (${r.slug}): missing farm plan`);
    }
    if (!r.rationale || r.rationale.length < 10) {
      problems.push(`row ${i} (${r.slug}): rationale too short`);
    }
    if (r.rank !== i + 1) {
      problems.push(`row ${i} (${r.slug}): rank ${r.rank} != ${i + 1}`);
    }
  }
  return problems;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function buildDossier(rows: BoardRow[], meta: DossierMeta): Dossier {
  const sorted = stableSort(rows).map((r, i) => ({ ...r, rank: i + 1 }));
  const values = sorted.map((r) => r.implied_value_usd);
  const byCategory: Record<string, number> = {};
  const byConfidence: Record<Confidence, number> = { high: 0, medium: 0, low: 0 };
  for (const r of sorted) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byConfidence[r.confidence] = (byConfidence[r.confidence] ?? 0) + 1;
  }
  return {
    format: "makefun-board/1",
    meta,
    rows: sorted,
    summary: {
      total_implied_value_usd: values.reduce((a, b) => a + b, 0),
      median_implied_value_usd: median(values),
      top_slug: sorted.length > 0 ? sorted[0].slug : null,
      by_category: byCategory,
      by_confidence: byConfidence,
    },
  };
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export default {
  buildDossier,
  validateBoard,
  stableSort,
  compareRows,
  formatUsd,
  formatPct,
};