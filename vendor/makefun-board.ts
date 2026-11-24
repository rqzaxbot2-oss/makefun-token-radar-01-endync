import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BOARD_SCHEMA_VERSION = "makefun-board/1";
export const DOSSIER_SCHEMA_VERSION = "makefun-dossier/1";
export const MIN_BOARD_ROWS = 100;
export const DEFAULT_SNAPSHOT_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export interface FarmStepLike {
  action?: string;
  description?: string;
  step?: string;
  summary?: string;
  title?: string;
  [key: string]: unknown;
}

export interface FarmPlanLike {
  steps?: ReadonlyArray<string | FarmStepLike>;
  strategy?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface BoardRowInput {
  category?: string;
  chains?: readonly string[];
  compositeScore?: number;
  estimatedFdvUsd?: number;
  excluded?: boolean;
  farm?: FarmPlanLike;
  farmPlan?: FarmPlanLike | ReadonlyArray<string | FarmStepLike>;
  farm_plan?: FarmPlanLike | ReadonlyArray<string | FarmStepLike>;
  farmingSteps?: ReadonlyArray<string | FarmStepLike>;
  hasLiveToken?: boolean;
  hasToken?: boolean;
  id?: string;
  impliedFdv?: number;
  impliedFdvHighUsd?: number;
  impliedFdvLowUsd?: number;
  impliedFdvUsd?: number;
  impliedValue?: number;
  impliedValueHigh?: number;
  impliedValueLow?: number;
  impliedValueUsd?: number;
  inWatchlist?: boolean;
  isDerivative?: boolean;
  isStakedDerivative?: boolean;
  isWatchlist?: boolean;
  isWrapped?: boolean;
  launchScore?: number;
  metrics?: Record<string, unknown>;
  name: string;
  radarScore?: number;
  rank?: number;
  score?: number;
  slug?: string;
  steps?: ReadonlyArray<string | FarmStepLike>;
  tvl?: number;
  tvlUsd?: number;
  valuation?: Record<string, unknown>;
  valuationUsd?: number;
  watchlist?: boolean;
  [key: string]: unknown;
}

export type CanonicalBoardRow<T extends BoardRowInput = BoardRowInput> = T & {
  impliedValueUsd: number;
  name: string;
  rank: number;
  slug: string;
  tvlUsd: number;
  watchlist: boolean;
};

export interface BoardBuildOptions {
  artifacts?: ReadonlyArray<{ path: string; sha256?: string }>;
  generatedAt?: string;
  methodology?: Record<string, unknown>;
  minRows?: number;
  snapshotHash?: string;
  sortBy?: "impliedValue" | "score";
  strict?: boolean;
  watchlist?: readonly string[];
}

export interface InvariantReport {
  allHaveFarmPlan: boolean;
  allHaveImpliedValue: boolean;
  contiguousRanks: boolean;
  minRowsMet: boolean;
  noLiveTokenOrDerivative: boolean;
  rankingMonotonic: boolean;
  uniqueSlugs: boolean;
  watchlistComplete: boolean;
}

export interface WatchlistSummary {
  complete: boolean;
  coverageRatio: number;
  covered: string[];
  missing: string[];
  required: string[];
}

export interface ValidationResult {
  errors: string[];
  invariants: InvariantReport;
  valid: boolean;
  warnings: string[];
  watchlist: WatchlistSummary;
}

export interface BoardDocument<T extends BoardRowInput = BoardRowInput> {
  generatedAt: string;
  minRows: number;
  rows: CanonicalBoardRow<T>[];
  schemaVersion: string;
  snapshotHash: string;
  summary: {
    categories: Record<string, number>;
    chains: Record<string, number>;
    medianImpliedValueUsd: number;
    topImpliedValueUsd: number;
    totalImpliedValueUsd: number;
    totalTvlUsd: number;
  };
  totalProtocols: number;
  watchlist: WatchlistSummary;
}

export interface DossierDocument {
  artifacts: Array<{ path: string; sha256?: string }>;
  boardSchemaVersion: string;
  boardSha256: string;
  distribution: {
    byCategory: Array<{
      category: string;
      count: number;
      totalImpliedValueUsd: number;
      totalTvlUsd: number;
    }>;
    byChain: Array<{ chain: string; count: number; totalTvlUsd: number }>;
    maxImpliedValueUsd: number;
    meanImpliedValueUsd: number;
    medianImpliedValueUsd: number;
    minImpliedValueUsd: number;
    p10ImpliedValueUsd: number;
    p90ImpliedValueUsd: number;
    totalImpliedValueUsd: number;
    totalTvlUsd: number;
  };
  errors: string[];
  generatedAt: string;
  invariants: InvariantReport;
  methodology: Record<string, unknown>;
  rowCount: number;
  schemaVersion: string;
  topProtocols: Array<{
    category: string;
    farmStepCount: number;
    impliedValueUsd: number;
    name: string;
    rank: number;
    slug: string;
    tvlUsd: number;
    watchlist: boolean;
  }>;
  valid: boolean;
  warnings: string[];
  watchlist: {
    complete: boolean;
    coverageRatio: number;
    covered: number;
    items: Array<{
      farmStepCount: number;
      impliedValueUsd: number;
      name: string;
      rank: number;
      slug: string;
      tvlUsd: number;
    }>;
    missing: string[];
    total: number;
  };
}

export interface BoardArtifactsResult<T extends BoardRowInput = BoardRowInput> {
  board: BoardDocument<T>;
  boardJson: string;
  boardSha256: string;
  dossier: DossierDocument;
  dossierJson: string;
  dossierSha256: string;
  validation: ValidationResult;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null as unknown as T;
    return (Object.is(value, -0) ? 0 : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort(cmpStr)) {
      if (record[key] !== undefined) out[key] = canonicalize(record[key]);
    }
    return out as T;
  }
  return value;
}

export function canonicalStringify(value: unknown, space = 2): string {
  return `${JSON.stringify(canonicalize(value), null, space)}\n`;
}

export function sha256Hex(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function extractSlug(row: BoardRowInput): string {
  const raw = typeof row.slug === "string" && row.slug.trim()
    ? row.slug
    : typeof row.id === "string" && row.id.trim()
      ? row.id
      : typeof row.name === "string"
        ? row.name
        : "";
  return normalizeSlug(raw);
}

function extractImpliedValue(row: BoardRowInput): number {
  const val = row.valuation ?? {};
  const candidates = [
    row.impliedValueUsd,
    row.impliedFdvUsd,
    row.impliedValue,
    row.impliedFdv,
    row.valuationUsd,
    row.estimatedFdvUsd,
    val.impliedFdvUsd,
    val.impliedValueUsd,
    val.pointEstimateUsd,
    val.midUsd,
    val.medianUsd,
    val.baseUsd,
  ];
  for (const c of candidates) {
    const n = toFinite(c);
    if (n !== null) return n;
  }
  return 0;
}

function extractTvl(row: BoardRowInput): number {
  const metrics = row.metrics ?? {};
  const candidates = [row.tvlUsd, row.tvl, metrics.tvlUsd, metrics.tvl];
  for (const c of candidates) {
    const n = toFinite(c);
    if (n !== null) return n;
  }
  return 0;
}

function extractScore(row: BoardRowInput): number {
  const candidates = [
    row.score,
    row.compositeScore,
    row.launchScore,
    row.radarScore,
  ];
  for (const c of candidates) {
    const n = toFinite(c);
    if (n !== null) return n;
  }
  return extractImpliedValue(row);
}

function isNonEmptyStep(step: unknown): boolean {
  if (typeof step === "string") return step.trim().length > 0;
  if (step && typeof step === "object") {
    const s = step as FarmStepLike;
    return [s.action, s.title, s.description, s.step, s.summary].some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
  }
  return false;
}

function extractFarmSteps(row: BoardRowInput): unknown[] {
  const sources = [
    row.farmPlan,
    row.farm_plan,
    row.farmingSteps,
    row.steps,
    row.farm,
  ];
  for (const src of sources) {
    if (Array.isArray(src)) return src.filter(isNonEmptyStep);
    if (src && typeof src === "object") {
      const plan = src as FarmPlanLike;
      if (Array.isArray(plan.steps)) return plan.steps.filter(isNonEmptyStep);
    }
  }
  return [];
}

function hasValidFarmPlan(row: BoardRowInput): boolean {
  if (extractFarmSteps(row).length > 0) return true;
  for (const src of [row.farmPlan, row.farm_plan, row.farm]) {
    if (src && typeof src === "object" && !Array.isArray(src)) {
      const plan = src as FarmPlanLike;
      if (
        (typeof plan.summary === "string" && plan.summary.trim().length > 0) ||
        (typeof plan.strategy === "string" && plan.strategy.trim().length > 0)
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasDisqualifyingTokenFlag(row: BoardRowInput): boolean {
  return Boolean(
    row.hasToken ||
      row.hasLiveToken ||
      row.isWrapped ||
      row.isStakedDerivative ||
      row.isDerivative ||
      row.excluded,
  );
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const weight = idx - lo;
  return sortedAsc[lo] * (1 - weight) + sortedAsc[hi] * weight;
}

function normalizeWatchlist(list?: readonly string[]): string[] {
  if (!list || list.length === 0) return [];
  const unique = new Set<string>();
  for (const item of list) {
    const slug = normalizeSlug(item);
    if (slug) unique.add(slug);
  }
  return [...unique].sort(cmpStr);
}

export function rankBoardRows<T extends BoardRowInput>(
  rows: readonly T[],
  options: Pick<BoardBuildOptions, "watchlist" | "sortBy"> = {},
): CanonicalBoardRow<T>[] {
  const watchSet = new Set(normalizeWatchlist(options.watchlist));
  const sortBy = options.sortBy ?? "impliedValue";

  const prepared = rows.map((row) => {
    const slug = extractSlug(row);
    const impliedValueUsd = round2(extractImpliedValue(row));
    const tvlUsd = round2(extractTvl(row));
    const primary = sortBy === "score" ? extractScore(row) : impliedValueUsd;
    const watchlist = Boolean(
      watchSet.has(slug) || row.watchlist || row.isWatchlist || row.inWatchlist,
    );
    return {
      primary,
      row: {
        ...row,
        impliedValueUsd,
        name: String(row.name ?? slug).trim(),
        rank: 0,
        slug,
        tvlUsd,
        watchlist,
      } as CanonicalBoardRow<T>,
    };
  });

  prepared.sort((a, b) => {
    if (b.primary !== a.primary) return b.primary - a.primary;
    if (b.row.impliedValueUsd !== a.row.impliedValueUsd) {
      return b.row.impliedValueUsd - a.row.impliedValueUsd;
    }
    if (b.row.tvlUsd !== a.row.tvlUsd) return b.row.tvlUsd - a.row.tvlUsd;
    return cmpStr(a.row.slug, b.row.slug);
  });

  return prepared.map((item, index) => ({
    ...item.row,
    rank: index + 1,
  }));
}

export function validateBoardRows(
  rows: readonly BoardRowInput[],
  options: BoardBuildOptions = {},
): ValidationResult {
  const minRows = options.minRows ?? MIN_BOARD_ROWS;
  const sortBy = options.sortBy ?? "impliedValue";
  const required = normalizeWatchlist(options.watchlist);
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenSlugs = new Set<string>();
  let uniqueSlugs = true;
  let allHaveImpliedValue = rows.length > 0;
  let allHaveFarmPlan = rows.length > 0;
  let contiguousRanks = rows.length > 0;
  let rankingMonotonic = true;
  let noLiveTokenOrDerivative = true;
  let prevMetric = Number.POSITIVE_INFINITY;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const slug = extractSlug(row);
    if (!slug) {
      uniqueSlugs = false;
      errors.push(`Row ${i + 1} is missing a valid slug or name`);
    } else if (seenSlugs.has(slug)) {
      uniqueSlugs = false;
      errors.push(`Duplicate protocol slug detected: ${slug}`);
    } else {
      seenSlugs.add(slug);
    }

    if (row.rank !== undefined && row.rank !== i + 1) {
      contiguousRanks = false;
    }

    const implied = extractImpliedValue(row);
    if (!(implied > 0)) {
      allHaveImpliedValue = false;
      errors.push(`Protocol ${slug || `#${i + 1}`} has non-positive implied value`);
    }

    const low = toFinite(row.impliedFdvLowUsd ?? row.impliedValueLow);
    const high = toFinite(row.impliedFdvHighUsd ?? row.impliedValueHigh);
    if (low !== null && high !== null && low > high) {
      warnings.push(`Protocol ${slug} has inverted valuation bounds (${low} > ${high})`);
    }

    if (!hasValidFarmPlan(row)) {
      allHaveFarmPlan = false;
      errors.push(`Protocol ${slug || `#${i + 1}`} is missing a farm plan`);
    }

    if (hasDisqualifyingTokenFlag(row)) {
      noLiveTokenOrDerivative = false;
      errors.push(`Protocol ${slug || `#${i + 1}`} is flagged as tokenized or derivative`);
    }

    const metric = sortBy === "score" ? extractScore(row) : implied;
    if (metric > prevMetric) {
      rankingMonotonic = false;
    }
    prevMetric = metric;
  }

  const minRowsMet = rows.length >= minRows;
  if (!minRowsMet) {
    errors.push(`Board has ${rows.length} rows; minimum required is ${minRows}`);
  }
  if (!contiguousRanks) {
    errors.push("Board ranks are not contiguous 1..N integers");
  }
  if (!rankingMonotonic) {
    errors.push(`Board rows are not monotonically ordered by ${sortBy} descending`);
  }

  const covered = required.filter((slug) => seenSlugs.has(slug));
  const missing = required.filter((slug) => !seenSlugs.has(slug));
  const watchlistComplete = missing.length === 0;
  if (!watchlistComplete) {
    errors.push(`Watchlist incomplete; missing: ${missing.join(", ")}`);
  }

  const watchlist: WatchlistSummary = {
    complete: watchlistComplete,
    coverageRatio: required.length === 0 ? 1 : round2(covered.length / required.length),
    covered,
    missing,
    required,
  };

  const invariants: InvariantReport = {
    allHaveFarmPlan,
    allHaveImpliedValue,
    contiguousRanks,
    minRowsMet,
    noLiveTokenOrDerivative,
    rankingMonotonic,
    uniqueSlugs,
    watchlistComplete,
  };

  return {
    errors,
    invariants,
    valid: errors.length === 0,
    warnings,
    watchlist,
  };
}

export function buildBoard<T extends BoardRowInput>(
  rows: readonly T[],
  options: BoardBuildOptions = {},
): BoardDocument<T> {
  const ranked = rankBoardRows(rows, options);
  const validation = validateBoardRows(ranked, options);
  const categories: Record<string, number> = {};
  const chains: Record<string, number> = {};

  let totalImplied = 0;
  let totalTvl = 0;
  const impliedValues: number[] = [];

  for (const row of ranked) {
    totalImplied += row.impliedValueUsd;
    totalTvl += row.tvlUsd;
    impliedValues.push(row.impliedValueUsd);

    const cat = typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : "Uncategorized";
    categories[cat] = (categories[cat] ?? 0) + 1;

    if (Array.isArray(row.chains)) {
      for (const ch of row.chains) {
        if (typeof ch === "string" && ch.trim()) {
          const name = ch.trim();
          chains[name] = (chains[name] ?? 0) + 1;
        }
      }
    }
  }

  const sortedImplied = [...impliedValues].sort((a, b) => a - b);
  const snapshotHash =
    options.snapshotHash ??
    sha256Hex(canonicalStringify(ranked.map((r) => [r.slug, r.tvlUsd, r.impliedValueUsd]), 0));

  return canonicalize({
    generatedAt: options.generatedAt ?? DEFAULT_SNAPSHOT_TIMESTAMP,
    minRows: options.minRows ?? MIN_BOARD_ROWS,
    rows: ranked,
    schemaVersion: BOARD_SCHEMA_VERSION,
    snapshotHash,
    summary: {
      categories,
      chains,
      medianImpliedValueUsd: round2(percentile(sortedImplied, 0.5)),
      topImpliedValueUsd: ranked.length > 0 ? ranked[0].impliedValueUsd : 0,
      totalImpliedValueUsd: round2(totalImplied),
      totalTvlUsd: round2(totalTvl),
    },
    totalProtocols: ranked.length,
    watchlist: validation.watchlist,
  });
}

export function buildDossier<T extends BoardRowInput>(
  board: BoardDocument<T>,
  validation: ValidationResult,
  options: BoardBuildOptions = {},
): DossierDocument {
  const boardSha256 = sha256Hex(canonicalStringify(board));
  const impliedAsc = board.rows.map((r) => r.impliedValueUsd).sort((a, b) => a - b);
  const catMap = new Map<string, { count: number; implied: number; tvl: number }>();
  const chainMap = new Map<string, { count: number; tvl: number }>();

  for (const row of board.rows) {
    const cat = typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : "Uncategorized";
    const cEntry = catMap.get(cat) ?? { count: 0, implied: 0, tvl: 0 };
    cEntry.count += 1;
    cEntry.implied += row.impliedValueUsd;
    cEntry.tvl += row.tvlUsd;
    catMap.set(cat, cEntry);

    if (Array.isArray(row.chains)) {
      for (const ch of row.chains) {
        if (typeof ch === "string" && ch.trim()) {
          const name = ch.trim();
          const chEntry = chainMap.get(name) ?? { count: 0, tvl: 0 };
          chEntry.count += 1;
          chEntry.tvl += row.tvlUsd;
          chainMap.set(name, chEntry);
        }
      }
    }
  }

  const byCategory = [...catMap.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      totalImpliedValueUsd: round2(v.implied),
      totalTvlUsd: round2(v.tvl),
    }))
    .sort((a, b) => b.totalImpliedValueUsd - a.totalImpliedValueUsd || cmpStr(a.category, b.category));

  const byChain = [...chainMap.entries()]
    .map(([chain, v]) => ({
      chain,
      count: v.count,
      totalTvlUsd: round2(v.tvl),
    }))
    .sort((a, b) => b.totalTvlUsd - a.totalTvlUsd || cmpStr(a.chain, b.chain));

  const watchSet = new Set(validation.watchlist.required);
  const watchlistItems = board.rows
    .filter((r) => (watchSet.size > 0 ? watchSet.has(r.slug) : r.watchlist))
    .map((r) => ({
      farmStepCount: extractFarmSteps(r).length,
      impliedValueUsd: r.impliedValueUsd,
      name: r.name,
      rank: r.rank,
      slug: r.slug,
      tvlUsd: r.tvlUsd,
    }));

  const topProtocols = board.rows.slice(0, 25).map((r) => ({
    category: typeof r.category === "string" && r.category.trim() ? r.category.trim() : "Uncategorized",
    farmStepCount: extractFarmSteps(r).length,
    impliedValueUsd: r.impliedValueUsd,
    name: r.name,
    rank: r.rank,
    slug: r.slug,
    tvlUsd: r.tvlUsd,
    watchlist: r.watchlist,
  }));

  const totalImplied = board.summary.totalImpliedValueUsd;
  const count = board.rows.length;

  return canonicalize({
    artifacts: options.artifacts ? [...options.artifacts] : [],
    boardSchemaVersion: board.schemaVersion,
    boardSha256,
    distribution: {
      byCategory,
      byChain,
      maxImpliedValueUsd: impliedAsc.length > 0 ? impliedAsc[impliedAsc.length - 1] : 0,
      meanImpliedValueUsd: count > 0 ? round2(totalImplied / count) : 0,
      medianImpliedValueUsd: round2(percentile(impliedAsc, 0.5)),
      minImpliedValueUsd: impliedAsc.length > 0 ? impliedAsc[0] : 0,
      p10ImpliedValueUsd: round2(percentile(impliedAsc, 0.1)),
      p90ImpliedValueUsd: round2(percentile(impliedAsc, 0.9)),
      totalImpliedValueUsd: totalImplied,
      totalTvlUsd: board.summary.totalTvlUsd,
    },
    errors: validation.errors,
    generatedAt: board.generatedAt,
    invariants: validation.invariants,
    methodology: options.methodology ?? {},
    rowCount: count,
    schemaVersion: DOSSIER_SCHEMA_VERSION,
    topProtocols,
    valid: validation.valid,
    warnings: validation.warnings,
    watchlist: {
      complete: validation.watchlist.complete,
      coverageRatio: validation.watchlist.coverageRatio,
      covered: validation.watchlist.covered.length,
      items: watchlistItems,
      missing: validation.watchlist.missing,
      total: validation.watchlist.required.length,
    },
  });
}

export function buildBoardAndDossier<T extends BoardRowInput>(
  rows: readonly T[],
  options: BoardBuildOptions = {},
): BoardArtifactsResult<T> {
  const board = buildBoard(rows, options);
  const validation = validateBoardRows(board.rows, options);
  if (options.strict && !validation.valid) {
    throw new Error(`Board validation failed:\n- ${validation.errors.join("\n- ")}`);
  }
  const boardJson = canonicalStringify(board);
  const boardSha256 = sha256Hex(boardJson);
  const dossier = buildDossier(board, validation, options);
  const dossierJson = canonicalStringify(dossier);
  const dossierSha256 = sha256Hex(dossierJson);
  return {
    board,
    boardJson,
    boardSha256,
    dossier,
    dossierJson,
    dossierSha256,
    validation,
  };
}

export function writeBoardArtifacts<T extends BoardRowInput>(
  outputDir: string,
  rows: readonly T[],
  options: BoardBuildOptions = {},
): BoardArtifactsResult<T> {
  const result = buildBoardAndDossier(rows, options);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "board.json"), result.boardJson, "utf8");
  writeFileSync(join(outputDir, "dossier.json"), result.dossierJson, "utf8");
  return result;
}

export default {
  BOARD_SCHEMA_VERSION,
  DEFAULT_SNAPSHOT_TIMESTAMP,
  DOSSIER_SCHEMA_VERSION,
  MIN_BOARD_ROWS,
  buildBoard,
  buildBoardAndDossier,
  buildDossier,
  canonicalStringify,
  canonicalize,
  normalizeSlug,
  rankBoardRows,
  sha256Hex,
  validateBoardRows,
  writeBoardArtifacts,
};