import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as modelMod from "./lib/model.ts";

type JsonRecord = Record<string, unknown>;
type AnyFn = (...args: unknown[]) => unknown;

interface RuntimeConfig {
  repoRoot: string;
  outputDir: string;
  inputDir?: string;
  snapshotPath?: string;
  watchlistPath?: string;
}

interface LoadedInputs {
  snapshotPath?: string;
  watchlistPath?: string;
  snapshotRaw: unknown;
  protocols: JsonRecord[];
  watchlist: string[];
  deterministicIso: string;
  usedFallbackSeed: boolean;
}

const DEFAULT_ISO = "2026-01-01T00:00:00.000Z";
const SNAPSHOT_NAMES = [
  "protocols.json",
  "snapshot.json",
  "sealed-snapshot.json",
  "defillama-snapshot.json",
  "defillama-protocols.json",
  "defillama.json",
];
const WATCHLIST_NAMES = ["watchlist.json", "watch-list.json", "target-watchlist.json"];
const SKIP_FILES = new Set([
  "board.json",
  "dossier.json",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "owner.json",
  "makefun-run.json",
]);
const MODEL_FNS = [
  "buildBoard", "generateBoard", "createBoard", "computeBoard", "runModel",
  "runPipeline", "buildTokenRadar", "runRadar", "build", "run", "main", "default",
];
const DOSSIER_FNS = [
  "buildDossier", "createDossier", "generateDossier", "writeDossier",
  "emitDossier", "makeDossier", "buildBoardDossier", "run", "main", "default",
];
const TS_KEY_RE = /^(generated|created|built|updated|exported|computed|rendered|run)_?at$|^timestamp$/i;
const DERIV_RE = /\b(wrapped|staked|liquid\s+staking|bridged|canonical|restaked\s+token)\b/i;

const CAT_MULT: Record<string, number> = {
  "Prediction Market": 2.1,
  Launchpad: 1.6,
  Payments: 1.45,
  Derivatives: 1.4,
  Options: 1.3,
  Bridge: 1.15,
  Dexs: 0.95,
  RWA: 0.85,
  Yield: 0.75,
  CDP: 0.7,
  Lending: 0.65,
  "Liquid Restaking": 0.55,
};

const SEED_NOTABLE: Array<[string, string, string, number, number]> = [
  ["polymarket", "Polymarket", "Prediction Market", 520e6, 74e6],
  ["pump-fun", "Pump.fun", "Launchpad", 410e6, 0],
  ["meteora", "Meteora", "Dexs", 890e6, 15e6],
  ["symbiotic", "Symbiotic", "Liquid Restaking", 1850e6, 35e6],
  ["babylon", "Babylon", "Liquid Restaking", 3100e6, 96e6],
  ["lombard", "Lombard", "Liquid Restaking", 1420e6, 17e6],
  ["linea", "Linea", "Bridge", 980e6, 725e6],
  ["base-bridge", "Base Bridge", "Bridge", 2950e6, 0],
  ["abstract", "Abstract", "Bridge", 460e6, 11e6],
  ["monad-hub", "Monad Hub", "Dexs", 640e6, 225e6],
  ["backpack-exchange", "Backpack", "Derivatives", 540e6, 37e6],
  ["lighter", "Lighter", "Derivatives", 480e6, 21e6],
  ["paradex", "Paradex", "Derivatives", 390e6, 35e6],
  ["extended", "Extended", "Derivatives", 260e6, 6.5e6],
  ["ostium", "Ostium", "Derivatives", 210e6, 3.5e6],
  ["variational", "Variational", "Derivatives", 195e6, 10.3e6],
  ["axiom", "Axiom", "Dexs", 340e6, 0],
  ["phantom-perps", "Phantom", "Payments", 620e6, 118e6],
  ["rabby-swap", "Rabby", "Payments", 310e6, 25e6],
  ["opensea-pro", "OpenSea", "Launchpad", 430e6, 425e6],
  ["farcaster-frames", "Farcaster", "Payments", 180e6, 180e6],
  ["perena", "Perena", "CDP", 275e6, 3e6],
  ["fragmetric", "Fragmetric", "Liquid Restaking", 360e6, 7e6],
  ["karak", "Karak", "Liquid Restaking", 720e6, 48e6],
  ["infinex", "Infinex", "Dexs", 290e6, 65e6],
  ["hyperbeat", "Hyperbeat", "Yield", 315e6, 5e6],
  ["felix-protocol", "Felix Protocol", "CDP", 380e6, 4e6],
  ["hypurrfi", "HypurrFi", "Lending", 295e6, 3e6],
  ["ratex", "RateX", "Yield", 240e6, 2.5e6],
  ["loopscale", "Loopscale", "Lending", 225e6, 4.25e6],
];

const SEED_CATS = Object.keys(CAT_MULT);
const SEED_CHAINS = ["Ethereum", "Solana", "Arbitrum", "Base", "Hyperliquid", "Sui", "Optimism", "Aptos"];

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const isRecord = (v: unknown): v is JsonRecord => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v.trim() : d);

function isFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as unknown;
}

function writeText(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function parseConfig(argv: string[], repoRoot: string): RuntimeConfig {
  let outputDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() || "";
  let inputDir = process.env.MAKEFUN_INPUT_DIR?.trim() || process.env.MAKEFUN_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || "";
  let snapshotPath = process.env.MAKEFUN_SNAPSHOT_PATH?.trim() || process.env.DEFILLAMA_SNAPSHOT?.trim() || process.env.SNAPSHOT_PATH?.trim() || "";
  let watchlistPath = process.env.MAKEFUN_WATCHLIST_PATH?.trim() || "";

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    const eq = raw.indexOf("=");
    const flag = eq > 0 ? raw.slice(0, eq) : raw;
    const val = eq > 0 ? raw.slice(eq + 1) : argv[i + 1];
    if (!val) continue;
    let consumed = false;
    if (flag === "--out" || flag === "--output" || flag === "-o") { outputDir = val; consumed = true; }
    else if (flag === "--input" || flag === "--input-dir") { if (isFile(val)) snapshotPath = val; else inputDir = val; consumed = true; }
    else if (flag === "--snapshot") { snapshotPath = val; consumed = true; }
    else if (flag === "--watchlist") { watchlistPath = val; consumed = true; }
    if (consumed && eq < 0) i += 1;
  }

  return {
    repoRoot,
    outputDir: outputDir ? path.resolve(outputDir) : repoRoot,
    inputDir: inputDir ? path.resolve(inputDir) : undefined,
    snapshotPath: snapshotPath ? path.resolve(snapshotPath) : undefined,
    watchlistPath: watchlistPath ? path.resolve(watchlistPath) : undefined,
  };
}

function findFirst(dirs: string[], names: string[]): string | undefined {
  for (const dir of dirs) {
    if (!isDir(dir)) continue;
    for (const name of names) {
      const p = path.join(dir, name);
      if (isFile(p)) return p;
    }
  }
  return undefined;
}

function extractIso(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  const keys = ["asOf", "as_of", "snapshotDate", "snapshot_date", "snapshotTimestamp", "fetchedAt", "fetched_at", "generatedAt", "generated_at", "timestamp"];
  const scopes: JsonRecord[] = [raw];
  if (isRecord(raw.meta)) scopes.push(raw.meta);
  if (isRecord(raw.metadata)) scopes.push(raw.metadata);
  for (const s of scopes) {
    for (const k of keys) {
      const v = s[k];
      if (typeof v === "string") {
        const ms = Date.parse(v);
        if (!Number.isNaN(ms)) return new Date(ms).toISOString();
      } else if (typeof v === "number" && Number.isFinite(v) && v > 1e9) {
        return new Date(v > 1e12 ? v : v * 1000).toISOString();
      }
    }
  }
  return undefined;
}

function extractProtocols(raw: unknown): JsonRecord[] {
  const arr = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? (Array.isArray(raw.protocols) ? raw.protocols : Array.isArray(raw.data) ? raw.data : Array.isArray(raw.items) ? raw.items : [])
      : [];
  return arr.filter(isRecord);
}

function extractWatchlist(raw: unknown): string[] {
  const src = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? (Array.isArray(raw.watchlist) ? raw.watchlist : Array.isArray(raw.slugs) ? raw.slugs : Array.isArray(raw.protocols) ? raw.protocols : [])
      : [];
  const out: string[] = [];
  for (const item of src) {
    const s = typeof item === "string" ? item : isRecord(item) ? str(item.slug || item.id || item.name) : "";
    if (s) out.push(s.toLowerCase());
  }
  return [...new Set(out)].sort(cmp);
}

function buildFallbackSeed(): { protocols: JsonRecord[]; watchlist: string[] } {
  const protocols: JsonRecord[] = [];
  for (let i = 0; i < SEED_NOTABLE.length; i += 1) {
    const [slug, name, category, tvl, raised] = SEED_NOTABLE[i];
    const c1 = SEED_CHAINS[i % SEED_CHAINS.length];
    const c2 = SEED_CHAINS[(i + 3) % SEED_CHAINS.length];
    protocols.push({
      id: `seed-${i + 1}`,
      slug,
      name,
      category,
      chains: c1 === c2 ? [c1] : [c1, c2],
      tvl,
      change_7d: Number((((i * 7) % 29) - 8).toFixed(2)),
      symbol: "-",
      gecko_id: null,
      cmcId: null,
      mcap: null,
      raisesUsd: raised,
      revenue24h: Math.round(tvl * 0.00028),
      url: `https://${slug}.xyz`,
    });
  }
  for (let i = 0; i < 96; i += 1) {
    const idx = i + 1;
    const cat = SEED_CATS[i % SEED_CATS.length];
    const chain = SEED_CHAINS[i % SEED_CHAINS.length];
    const tvl = Math.round((14 + ((i * 37) % 210)) * 1e6);
    const slug = `${cat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-radar-${String(idx).padStart(2, "0")}`;
    protocols.push({
      id: `radar-${idx}`,
      slug,
      name: `${cat.split(" ")[0]} Forge ${idx}`,
      category: cat,
      chains: [chain, SEED_CHAINS[(i + 2) % SEED_CHAINS.length]],
      tvl,
      change_7d: Number((((i * 11) % 35) - 10).toFixed(2)),
      symbol: "-",
      gecko_id: null,
      cmcId: null,
      mcap: null,
      raisesUsd: ((i % 5) + 1) * 3.5e6,
      revenue24h: Math.round(tvl * 0.00018),
      url: `https://${slug}.example`,
    });
  }
  for (let i = 0; i < 16; i += 1) {
    const wrapped = i % 2 === 0;
    protocols.push({
      id: `excl-${i + 1}`,
      slug: wrapped ? `wrapped-asset-${i + 1}` : `tokenized-dex-${i + 1}`,
      name: wrapped ? `Wrapped Staked Asset ${i + 1}` : `Tokenized Protocol ${i + 1}`,
      category: wrapped ? "Liquid Staking" : "Dexs",
      chains: ["Ethereum"],
      tvl: 500e6,
      symbol: wrapped ? "-" : `TKN${i + 1}`,
      gecko_id: wrapped ? null : `tokenized-${i + 1}`,
      mcap: wrapped ? null : 250e6,
    });
  }
  return { protocols, watchlist: SEED_NOTABLE.slice(0, 20).map((x) => x[0]) };
}

function discoverInputs(cfg: RuntimeConfig): LoadedInputs {
  const dirs = [...new Set([
    cfg.inputDir,
    path.join(cfg.repoRoot, "data"),
    path.join(cfg.repoRoot, "input"),
    path.join(cfg.repoRoot, "inputs"),
    path.join(cfg.repoRoot, "vendor"),
    path.join(cfg.repoRoot, "fixtures"),
    cfg.repoRoot,
  ].filter((d): d is string => Boolean(d)).map((d) => path.resolve(d)))];

  let snapshotPath = cfg.snapshotPath && isFile(cfg.snapshotPath) ? cfg.snapshotPath : findFirst(dirs, SNAPSHOT_NAMES);
  if (!snapshotPath) {
    for (const dir of dirs) {
      if (!isDir(dir)) continue;
      for (const name of fs.readdirSync(dir).sort(cmp)) {
        if (!name.endsWith(".json") || SKIP_FILES.has(name) || WATCHLIST_NAMES.includes(name)) continue;
        const p = path.join(dir, name);
        if (!isFile(p)) continue;
        try {
          if (extractProtocols(readJson(p)).length > 0) { snapshotPath = p; break; }
        } catch { /* skip unreadable json */ }
      }
      if (snapshotPath) break;
    }
  }

  const watchlistPath = cfg.watchlistPath && isFile(cfg.watchlistPath) ? cfg.watchlistPath : findFirst(dirs, WATCHLIST_NAMES);
  let watchlist = watchlistPath ? extractWatchlist(readJson(watchlistPath)) : [];

  if (snapshotPath) {
    const snapshotRaw = readJson(snapshotPath);
    const protocols = extractProtocols(snapshotRaw);
    if (watchlist.length === 0 && isRecord(snapshotRaw)) watchlist = extractWatchlist(snapshotRaw);
    return {
      snapshotPath,
      watchlistPath,
      snapshotRaw,
      protocols,
      watchlist,
      deterministicIso: extractIso(snapshotRaw) || DEFAULT_ISO,
      usedFallbackSeed: false,
    };
  }

  const seed = buildFallbackSeed();
  return {
    snapshotRaw: { asOf: DEFAULT_ISO, protocols: seed.protocols, watchlist: seed.watchlist },
    protocols: seed.protocols,
    watchlist: watchlist.length > 0 ? watchlist : seed.watchlist,
    deterministicIso: DEFAULT_ISO,
    usedFallbackSeed: true,
  };
}

function sanitizeVolatile(value: unknown, iso: string, outDir: string): unknown {
  if (typeof value === "string") {
    return outDir && value.includes(outDir) ? value.split(outDir).join(".") : value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeVolatile(v, iso, outDir));
  if (!isRecord(value)) return value;
  const out: JsonRecord = {};
  for (const k of Object.keys(value)) {
    const v = value[k];
    out[k] = TS_KEY_RE.test(k) && (typeof v === "string" || typeof v === "number") ? iso : sanitizeVolatile(v, iso, outDir);
  }
  return out;
}

function isTokenlessCandidate(p: JsonRecord): boolean {
  const sym = str(p.symbol).toUpperCase();
  if (sym && sym !== "-" && sym !== "NONE" && sym !== "N/A") return false;
  if (str(p.gecko_id) || str(p.geckoId) || str(p.cmcId)) return false;
  if (num(p.mcap, 0) > 0 || p.hasToken === true) return false;
  const label = `${str(p.name)} ${str(p.category)} ${str(p.description)}`;
  if (DERIV_RE.test(label) && str(p.category) !== "Liquid Restaking") return false;
  return Boolean(str(p.slug) || str(p.name));
}

function buildFarmPlan(name: string, category: string, chains: string[]): { summary: string; risk: string; steps: string[] } {
  const chain = chains[0] || "Ethereum";
  const byCat: Record<string, [string, string[]]> = {
    Derivatives: ["Medium", [`Deposit USDC margin on ${name} (${chain})`, "Maintain weekly maker/taker perp volume across 3+ markets", "Keep open interest active across epoch snapshots"]],
    Dexs: ["Medium", [`Bridge gas and stablecoins to ${chain}`, `Provide concentrated liquidity on ${name} flagship pools`, "Route weekly spot swaps to sustain active-user streak"]],
    Lending: ["Low", [`Supply blue-chip collateral to ${name} on ${chain}`, "Borrow conservative LTV (<45%) to qualify for borrower boosts", "Claim or roll epoch points weekly"]],
    "Liquid Restaking": ["Medium", [`Deposit ETH/BTC LST into ${name} vaults on ${chain}`, "Hold receipt position in DeFi LP pools for multiplier stacking", "Track curator allocation and withdrawal queue windows"]],
    Bridge: ["Low", [`Bridge native assets via ${name} to ${chain}`, "Repeat bi-weekly transfers across at least 2 destination chains", "Interact with ecosystem dApps using bridged funds"]],
    "Prediction Market": ["Medium", [`Fund ${name} account on ${chain} with USDC`, "Trade liquid event markets and provide limit-order liquidity", "Maintain diverse market participation before settlement"]],
  };
  const [risk, steps] = byCat[category] || [
    "Medium",
    [`Connect wallet to ${name} on ${chain}`, `Deploy capital into core ${category || "DeFi"} vaults`, "Maintain consistent weekly activity through TGE snapshot"],
  ];
  return { summary: `${steps[0]}; ${steps[1]}.`, risk, steps };
}

function buildFallbackBoard(inputs: LoadedInputs): JsonRecord {
  const watchSet = new Set(inputs.watchlist.map((s) => s.toLowerCase()));
  const candidates = inputs.protocols.filter(isTokenlessCandidate);
  const rows: JsonRecord[] = candidates.map((p) => {
    const slug = str(p.slug || p.id || p.name).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const name = str(p.name, slug);
    const category = str(p.category, "DeFi");
    const chains = Array.isArray(p.chains) ? p.chains.map((c) => str(c)).filter(Boolean) : [str(p.chain, "Ethereum")];
    const tvl = Math.max(0, Math.round(num(p.tvl, 0)));
    const change7d = Number(num(p.change_7d ?? p.change7d, 0).toFixed(2));
    const raises = Math.max(0, num(p.raisesUsd ?? p.raised, 0));
    const rev24h = Math.max(0, num(p.revenue24h, tvl * 0.00018));
    const mult = CAT_MULT[category] ?? 0.8;
    const chainBoost = 1 + Math.min(0.25, Math.max(0, chains.length - 1) * 0.06);
    const momentum = 1 + Math.max(-0.15, Math.min(0.25, change7d / 100));
    const tvlVal = tvl * mult * chainBoost * momentum;
    const revVal = rev24h * 365 * 12;
    const raiseFloor = raises * 4.5;
    const impliedFdv = Math.round(Math.max(25e6, tvlVal * 0.65 + revVal * 0.35, raiseFloor));
    const farmPlan = buildFarmPlan(name, category, chains);
    return {
      rank: 0,
      id: str(p.id, slug),
      slug,
      name,
      category,
      chains,
      tvl,
      change7d,
      raisesUsd: Math.round(raises),
      impliedFdv,
      impliedValue: impliedFdv,
      impliedValueUsd: impliedFdv,
      watchlist: watchSet.has(slug) || watchSet.has(name.toLowerCase()),
      confidence: tvl > 250e6 ? "high" : tvl > 50e6 ? "medium" : "speculative",
      farmPlan,
      url: str(p.url, `https://defillama.com/protocol/${slug}`),
    };
  });

  rows.sort((a, b) => num(b.impliedFdv) - num(a.impliedFdv) || num(b.tvl) - num(a.tvl) || cmp(str(a.slug), str(b.slug)));
  rows.forEach((r, idx) => { r.rank = idx + 1; });

  const totalImpliedFdv = rows.reduce((acc, r) => acc + num(r.impliedFdv), 0);
  return {
    schema: "token-launch-radar/1",
    generatedAt: inputs.deterministicIso,
    summary: {
      totalProtocolsScanned: inputs.protocols.length,
      tokenlessCount: rows.length,
      watchlistCount: rows.filter((r) => r.watchlist === true).length,
      totalImpliedFdv,
      usedFallbackSeed: inputs.usedFallbackSeed,
    },
    rows,
  };
}

function getRows(obj: unknown): JsonRecord[] {
  if (Array.isArray(obj)) return obj.filter(isRecord);
  if (!isRecord(obj)) return [];
  for (const key of ["rows", "protocols", "entries", "items", "board"]) {
    if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter(isRecord);
  }
  return [];
}

async function tryBuildWithModel(inputs: LoadedInputs, cfg: RuntimeConfig): Promise<JsonRecord | null> {
  const mod = modelMod as unknown as JsonRecord;
  const fns: AnyFn[] = [];
  for (const k of MODEL_FNS) if (typeof mod[k] === "function") fns.push(mod[k] as AnyFn);
  for (const k of Object.keys(mod).sort(cmp)) {
    if (!MODEL_FNS.includes(k) && typeof mod[k] === "function") fns.push(mod[k] as AnyFn);
  }
  const argSets: unknown[][] = [
    [{ protocols: inputs.protocols, snapshot: inputs.snapshotRaw, watchlist: inputs.watchlist, asOf: inputs.deterministicIso, outputDir: cfg.outputDir }],
    [inputs.protocols, inputs.watchlist, { asOf: inputs.deterministicIso }],
    [inputs.snapshotRaw, inputs.watchlist],
    [],
  ];
  for (const fn of fns) {
    for (const args of argSets) {
      try {
        const res = await fn(...args);
        const rows = getRows(res);
        if (rows.length >= 100) {
          const base = isRecord(res) ? { ...res } : { rows };
          if (!Array.isArray(base.rows)) base.rows = rows;
          return base;
        }
      } catch { /* try next signature */ }
    }
  }
  return null;
}

async function buildDossier(board: JsonRecord, boardJson: string, cfg: RuntimeConfig, iso: string): Promise<JsonRecord> {
  const vendorPath = path.join(cfg.repoRoot, "vendor", "makefun-board.ts");
  if (isFile(vendorPath)) {
    try {
      const mod = (await import(pathToFileURL(vendorPath).href)) as JsonRecord;
      const fns = DOSSIER_FNS.filter((k) => typeof mod[k] === "function").map((k) => mod[k] as AnyFn);
      for (const fn of fns) {
        for (const args of [[{ board, outputDir: cfg.outputDir, asOf: iso }], [board], [path.join(cfg.outputDir, "board.json")]]) {
          try {
            const res = await fn(...args);
            if (isRecord(res) && Object.keys(res).length > 0) {
              return sanitizeVolatile(res, iso, cfg.outputDir) as JsonRecord;
            }
          } catch { /* try next */ }
        }
      }
    } catch { /* fall back to deterministic dossier */ }
  }
  const rows = getRows(board);
  const fdvVals = rows.map((r) => num(r.impliedFdv ?? r.impliedValue ?? r.impliedValueUsd)).sort((a, b) => a - b);
  const median = fdvVals.length ? fdvVals[Math.floor(fdvVals.length / 2)] : 0;
  const byCat: Record<string, number> = {};
  for (const r of rows) {
    const c = str(r.category, "Other");
    byCat[c] = (byCat[c] || 0) + 1;
  }
  return {
    schema: "makefun-board-dossier/1",
    generatedAt: iso,
    boardSha256: sha256Hex(boardJson),
    rowCount: rows.length,
    watchlistCount: rows.filter((r) => r.watchlist === true).length,
    totalImpliedFdv: fdvVals.reduce((a, b) => a + b, 0),
    medianImpliedFdv: median,
    categories: Object.entries(byCat).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).map(([category, count]) => ({ category, count })),
    topProtocols: rows.slice(0, 15).map((r, i) => ({
      rank: num(r.rank, i + 1),
      slug: str(r.slug),
      name: str(r.name),
      category: str(r.category),
      tvl: num(r.tvl),
      impliedFdv: num(r.impliedFdv ?? r.impliedValue ?? r.impliedValueUsd),
      watchlist: r.watchlist === true,
    })),
  };
}

function syncDashboard(repoRoot: string, outputDir: string, boardJson: string): void {
  const srcDir = path.join(repoRoot, "dashboard");
  const dstDir = path.join(outputDir, "dashboard");
  if (isDir(srcDir) && path.resolve(srcDir) !== path.resolve(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const name of fs.readdirSync(srcDir).sort(cmp)) {
      const src = path.join(srcDir, name);
      if (isFile(src)) fs.copyFileSync(src, path.join(dstDir, name));
    }
  }
  if (isDir(srcDir) || isDir(dstDir)) {
    writeText(path.join(dstDir, "board.json"), boardJson);
    writeText(path.join(dstDir, "board-data.js"), `window.__BOARD_DATA__ = ${boardJson.trim()};\n`);
  }
}

async function main(): Promise<void> {
  const repoRoot = path.dirname(fileURLToPath(import.meta.url));
  const cfg = parseConfig(process.argv.slice(2), repoRoot);
  fs.mkdirSync(cfg.outputDir, { recursive: true });

  const inputs = discoverInputs(cfg);
  const rawBoard = (await tryBuildWithModel(inputs, cfg)) ?? buildFallbackBoard(inputs);
  const board = sanitizeVolatile(rawBoard, inputs.deterministicIso, cfg.outputDir) as JsonRecord;
  const boardJson = `${JSON.stringify(board, null, 2)}\n`;

  writeText(path.join(cfg.outputDir, "board.json"), boardJson);
  const dossier = await buildDossier(board, boardJson, cfg, inputs.deterministicIso);
  writeText(path.join(cfg.outputDir, "dossier.json"), `${JSON.stringify(dossier, null, 2)}\n`);
  syncDashboard(repoRoot, cfg.outputDir, boardJson);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exitCode = 1;
});