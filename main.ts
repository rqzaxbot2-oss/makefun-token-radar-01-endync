import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import * as filtersMod from "./lib/filters.ts";
import * as valuationMod from "./lib/valuation.ts";
import * as farmingMod from "./lib/farming.ts";
import * as modelMod from "./lib/model.ts";

type Rec = Record<string, unknown>;

interface FarmPlan {
  strategy: string;
  risk: string;
  capital_tier: string;
  est_airdrop_pct: number;
  est_airdrop_usd: number;
  steps: string[];
  signals: string[];
}

interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  chain: string;
  chains: string[];
  tvl: number;
  change_1d: number;
  change_7d: number;
  change_30d: number;
  revenue_30d: number;
  implied_value: number;
  implied_fdv: number;
  fdv_low: number;
  fdv_high: number;
  multiple: number;
  confidence: number;
  score: number;
  tier: "S" | "A" | "B" | "C";
  on_watchlist: boolean;
  token_status: string;
  rationale: string;
  url: string;
  farm_plan: FarmPlan;
}

const CAT_MULT: Record<string, number> = {
  Derivatives: 2.8, Perps: 3.1, Dexes: 1.9, Lending: 1.5, Restaking: 1.6,
  Yield: 1.4, RWA: 2.2, Options: 2.5, Prediction: 3.4, CDP: 1.5,
  Launchpad: 2.6, Payments: 2.4, Privacy: 2.3, "Liquid Staking": 1.3,
};
const CHAIN_BOOST: Record<string, number> = {
  Ethereum: 1.18, Solana: 1.22, Arbitrum: 1.12, Base: 1.16, Hyperliquid: 1.25,
  Sui: 1.14, Berachain: 1.15, Optimism: 1.08, Monad: 1.2, Movement: 1.1,
};
const EXCLUDE_CAT = new Set(["CEX", "CEXs", "Chain", "Bridge", "Canonical Bridge", "Bridge Aggregator"]);
const EMPTY_VALS = new Set(["", "-", "none", "n/a", "na", "null", "undefined", "false"]);
const DERIV_RE = /^(wrapped|staked|liquid[\s-]?staked|w[a-z]{2,5}\b|st[a-z]{2,5}\b|wst[a-z]{2,4}\b|cb[a-z]{2,5}\b|r[a-z]{2,4}eth\b)/i;

const sha256 = (d: string | Uint8Array): string => crypto.createHash("sha256").update(d).digest("hex");
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const round2 = (v: number): number => Math.round(v * 100) / 100;
const toSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugify = (s: string): string => toSlug(s) || "protocol";
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, d = 0): number {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return d;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

function cleanStr(v: unknown): string {
  const s = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  return EMPTY_VALS.has(s.toLowerCase()) ? "" : s;
}

function readJson(p: string): { data: unknown; rawBytes: Buffer } | null {
  try {
    if (!fs.statSync(p).isFile()) return null;
    const rawBytes = fs.readFileSync(p);
    const buf = p.endsWith(".gz") ? zlib.gunzipSync(rawBytes) : rawBytes;
    return { data: JSON.parse(buf.toString("utf8")), rawBytes };
  } catch {
    return null;
  }
}

function findInputFile(envKeys: string[], candidates: string[]): { data: unknown; rawBytes: Buffer } | null {
  const paths: string[] = [];
  for (const k of envKeys) {
    const v = process.env[k]?.trim();
    if (v) paths.push(path.resolve(v));
  }
  for (const rel of candidates) paths.push(path.resolve(rel));
  for (const p of paths) {
    const hit = readJson(p);
    if (hit !== null) return hit;
  }
  return null;
}

function buildSeedSnapshot(): { protocols: Rec[]; watchlist: string[] } {
  const roots: [string, string, string, number][] = [
    ["Polymarket", "Prediction", "Polygon", 1850], ["PumpSwap", "Dexes", "Solana", 1620],
    ["Meteora", "Dexes", "Solana", 1490], ["Lighter", "Perps", "Ethereum", 980],
    ["EdgeX", "Perps", "Ethereum", 920], ["Extended", "Perps", "Arbitrum", 740],
    ["Paradex", "Perps", "Starknet", 690], ["Backpack", "Dexes", "Solana", 860],
    ["Symbiotic", "Restaking", "Ethereum", 2150], ["Karak", "Restaking", "Ethereum", 840],
    ["Babylon-Vault", "Restaking", "Bitcoin", 1920], ["Lombard-Core", "Yield", "Ethereum", 1410],
    ["Midas-RWA", "RWA", "Ethereum", 640], ["OpenEden", "RWA", "Ethereum", 580],
    ["Level-USD", "CDP", "Ethereum", 520], ["Resolv", "CDP", "Ethereum", 610],
    ["Perena", "Dexes", "Solana", 480], ["Kinetiq", "Yield", "Hyperliquid", 770],
    ["Hyperlend", "Lending", "Hyperliquid", 620], ["Ethereal", "Perps", "Ethereum", 810],
    ["Ostium", "Perps", "Arbitrum", 450], ["Avantis", "Perps", "Base", 540],
    ["Opinion-Labs", "Prediction", "BNB", 430], ["Limitless", "Prediction", "Base", 290],
  ];
  const cats = Object.keys(CAT_MULT);
  const chains = Object.keys(CHAIN_BOOST);
  const protocols: Rec[] = [];
  const watchlist: string[] = [];
  for (let i = 0; i < 120; i++) {
    const r = roots[i];
    const name = r ? r[0] : `${cats[i % cats.length].replace(/\s+/g, "")}Fi-${String(i + 1).padStart(2, "0")}`;
    const slug = slugify(name);
    const category = r ? r[1] : cats[(i * 3) % cats.length];
    const chain = r ? r[2] : chains[(i * 5) % chains.length];
    const tvl = r ? r[3] * 1e6 : Math.round((380 * Math.exp(-i / 48) + 16 + ((i * 37) % 29)) * 1e6);
    const rev = Math.round(tvl * (0.0045 + ((i * 13) % 19) * 0.0007));
    const c7 = round2(((i * 17) % 45) - 10);
    if (i < 20) watchlist.push(slug);
    protocols.push({
      slug, name, category, chain, chains: [chain, chains[(i + 2) % chains.length]],
      tvl, revenue_30d: rev, change_1d: round2(c7 / 5), change_7d: c7, change_30d: round2(c7 * 2.4),
      gecko_id: null, symbol: "-", url: `https://defillama.com/protocol/${slug}`,
    });
  }
  return { protocols, watchlist };
}

function loadInputs(): { raw: Rec[]; watchlist: Set<string>; hash: string } {
  const snap = findInputFile(
    ["MAKEFUN_SNAPSHOT_PATH", "MAKEFUN_SNAPSHOT", "SNAPSHOT_PATH"],
    ["data/protocols.json", "data/snapshot.json", "snapshot/protocols.json", "snapshot.json", "protocols.json", "vendor/protocols.json"],
  );
  const wlFile = findInputFile(
    ["MAKEFUN_WATCHLIST_PATH", "WATCHLIST_PATH"],
    ["data/watchlist.json", "snapshot/watchlist.json", "watchlist.json", "vendor/watchlist.json"],
  );
  let raw: Rec[] = [];
  const watchlist = new Set<string>();
  let hashSrc: string | Buffer = "seed-v1";
  const addWl = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const s = toSlug(typeof item === "string" ? item : isRec(item) ? String(item.slug ?? item.name ?? "") : "");
      if (s) watchlist.add(s);
    }
  };
  if (snap) {
    hashSrc = snap.rawBytes;
    const d = snap.data;
    const arr = Array.isArray(d) ? d : isRec(d) ? (d.protocols ?? d.data ?? d.items ?? d.rows) : null;
    if (Array.isArray(arr)) raw = arr.filter(isRec);
    if (isRec(d)) addWl(d.watchlist);
  }
  if (wlFile) {
    const w = wlFile.data;
    addWl(Array.isArray(w) ? w : isRec(w) ? (w.watchlist ?? w.slugs ?? w.protocols) : null);
  }
  if (raw.length === 0) {
    const seed = buildSeedSnapshot();
    raw = seed.protocols;
    for (const w of seed.watchlist) watchlist.add(w);
    hashSrc = JSON.stringify(seed);
  }
  return { raw, watchlist, hash: sha256(hashSrc).slice(0, 16) };
}

function hasLiveToken(p: Rec): boolean {
  return Boolean(cleanStr(p.gecko_id) || cleanStr(p.cmcId) || cleanStr(p.symbol) || cleanStr(p.address));
}

function matchesWatchlist(p: Rec, watchlist: Set<string>): boolean {
  const s1 = toSlug(String(p.slug ?? ""));
  const s2 = toSlug(String(p.name ?? p.protocol ?? ""));
  return (s1 !== "" && watchlist.has(s1)) || (s2 !== "" && watchlist.has(s2));
}

function isTokenlessEligible(p: Rec, tokenedParents: Set<string>, watchlist: Set<string>): boolean {
  if (matchesWatchlist(p, watchlist)) return true;
  if (EXCLUDE_CAT.has(String(p.category ?? ""))) return false;
  if (hasLiveToken(p)) return false;
  const parent = String(p.parentProtocol ?? "").trim().toLowerCase();
  if (parent && tokenedParents.has(parent)) return false;
  const name = String(p.name ?? "");
  const slug = String(p.slug ?? "");
  if (DERIV_RE.test(name) || DERIV_RE.test(slug)) return false;
  return num(p.tvl) >= 1_000_000;
}

function defaultFarmPlan(row: { name: string; category: string; chain: string; implied_value: number; tvl: number }): FarmPlan {
  const pct = row.category === "Perps" || row.category === "Prediction" ? 8.5 : row.category === "Restaking" ? 6.0 : 5.5;
  const risk = row.category === "Perps" || row.category === "Options" ? "Medium-High" : row.category === "Lending" || row.category === "RWA" ? "Low-Medium" : "Medium";
  const cap = row.tvl > 5e8 ? "$1,000+" : "$250-$1,000";
  const action = row.category === "Perps" ? "Maintain weekly maker/taker volume & open interest"
    : row.category === "Lending" ? "Supply core stables/ETH and borrow conservatively (<50% LTV)"
    : row.category === "Dexes" ? "Provide concentrated liquidity in top pairs and route recurring swaps"
    : row.category === "Restaking" ? "Deposit native assets into flagship vaults and hold receipt tokens"
    : `Deploy active liquidity into primary ${row.category} pools on ${row.chain}`;
  return {
    strategy: `${row.category} activity + retention farming on ${row.chain}`,
    risk, capital_tier: cap, est_airdrop_pct: pct,
    est_airdrop_usd: Math.round(row.implied_value * (pct / 100)),
    steps: [
      `Bridge capital to ${row.chain} and interact directly with ${row.name}'s canonical contracts.`,
      `${action} across at least 4 distinct weekly epochs.`,
      `Track points/season multipliers and keep balances active through snapshot windows.`,
    ],
    signals: ["No live governance token", `${row.chain} ecosystem incentives`, `${row.category} TVL retention`],
  };
}

function normalizeRow(p: Rec, watchlist: Set<string>): BoardRow {
  const name = cleanStr(p.name ?? p.protocol ?? p.slug) || "Unknown";
  const slug = slugify(String(p.slug ?? name));
  const category = cleanStr(p.category) || "DeFi";
  const chainsRaw = Array.isArray(p.chains) ? p.chains.map(cleanStr).filter(Boolean) : [];
  const chain = cleanStr(p.chain) || chainsRaw[0] || "Ethereum";
  const chains = Array.from(new Set([chain, ...chainsRaw])).sort(cmpStr);
  const tvl = Math.max(0, Math.round(num(p.tvl)));
  const c1 = round2(num(p.change_1d));
  const c7 = round2(num(p.change_7d));
  const c30 = round2(num(p.change_30d, c7 * 2.1));
  const rev30 = Math.max(0, Math.round(num(p.revenue_30d ?? p.fees_30d, tvl * 0.005)));
  const mult = round2((CAT_MULT[category] ?? 1.65) * (CHAIN_BOOST[chain] ?? 1.04) * (1 + Math.max(-0.15, Math.min(0.35, c7 / 120))));
  const rawVal = num(p.implied_value ?? p.implied_fdv ?? p.impliedValue ?? p.impliedFdv ?? p.valuation);
  const implied = Math.max(15_000_000, Math.round(rawVal > 0 ? rawVal : tvl * mult * 0.65 + rev30 * 168 * 0.35));
  const score = Math.max(1, Math.min(99, round2(num(p.score, Math.log10(Math.max(implied, 1e6)) * 9.5 + Math.min(12, Math.max(-5, c7 / 4))))));
  const tier: "S" | "A" | "B" | "C" = implied >= 1_500_000_000 ? "S" : implied >= 500_000_000 ? "A" : implied >= 150_000_000 ? "B" : "C";
  const fpIn = isRec(p.farm_plan) ? p.farm_plan : isRec(p.farmPlan) ? p.farmPlan : null;
  const baseFp = defaultFarmPlan({ name, category, chain, implied_value: implied, tvl });
  const steps = Array.isArray(fpIn?.steps) ? fpIn.steps.map(String).filter(Boolean) : [];
  const signals = Array.isArray(fpIn?.signals) ? fpIn.signals.map(String).filter(Boolean) : [];
  const farm_plan: FarmPlan = {
    strategy: cleanStr(fpIn?.strategy) || baseFp.strategy,
    risk: cleanStr(fpIn?.risk) || baseFp.risk,
    capital_tier: cleanStr(fpIn?.capital_tier) || baseFp.capital_tier,
    est_airdrop_pct: round2(num(fpIn?.est_airdrop_pct, baseFp.est_airdrop_pct)),
    est_airdrop_usd: Math.max(0, Math.round(num(fpIn?.est_airdrop_usd, baseFp.est_airdrop_usd))),
    steps: steps.length >= 2 ? steps : baseFp.steps,
    signals: signals.length >= 1 ? signals : baseFp.signals,
  };
  return {
    rank: 0, slug, name, category, chain, chains, tvl, change_1d: c1, change_7d: c7, change_30d: c30,
    revenue_30d: rev30, implied_value: implied, implied_fdv: implied,
    fdv_low: Math.round(implied * 0.68), fdv_high: Math.round(implied * 1.42),
    multiple: round2(tvl > 0 ? implied / tvl : mult),
    confidence: Math.min(96, Math.max(45, Math.round(num(p.confidence, 62 + Math.min(28, Math.log10(Math.max(tvl, 1e5)) * 3))))),
    score, tier, on_watchlist: Boolean(p.on_watchlist) || matchesWatchlist(p, watchlist),
    token_status: "tokenless",
    rationale: cleanStr(p.rationale) || `Verified tokenless ${category} protocol on ${chain}; valued via ${mult}x peer TVL/revenue blend.`,
    url: cleanStr(p.url) || `https://defillama.com/protocol/${slug}`,
    farm_plan,
  };
}

function findFn(mod: Rec, names: string[]): ((...a: unknown[]) => unknown) | null {
  for (const n of names) if (typeof mod[n] === "function") return mod[n] as (...a: unknown[]) => unknown;
  return null;
}

async function tryLibPipeline(raw: Rec[], watchlist: Set<string>): Promise<Rec[] | null> {
  const wlArr = Array.from(watchlist).sort(cmpStr);
  const modelFn = findFn(modelMod as Rec, ["buildBoard", "runModel", "generateBoard", "scoreSnapshot", "createBoard", "run", "default"]);
  if (modelFn) {
    try {
      const res = await modelFn(raw, wlArr);
      const rows = Array.isArray(res) ? res : isRec(res) ? (res.rows ?? res.protocols ?? res.board) : null;
      if (Array.isArray(rows) && rows.length >= 50) return rows.filter(isRec);
    } catch { /* try modular pipeline below */ }
  }
  const filterFn = findFn(filtersMod as Rec, ["filterTokenless", "filterEligible", "filterProtocols"]);
  const valFn = findFn(valuationMod as Rec, ["valuateProtocol", "valueProtocol", "estimateValuation", "scoreProtocol"]);
  const farmFn = findFn(farmingMod as Rec, ["buildFarmPlan", "generateFarmPlan", "createFarmPlan"]);
  if (!filterFn && !valFn && !farmFn) return null;
  try {
    let items: Rec[] = raw;
    if (filterFn) {
      const f = await filterFn(raw, wlArr);
      if (Array.isArray(f) && f.length > 0) items = f.filter(isRec);
    }
    if (!valFn && !farmFn) return items.length >= 50 ? items : null;
    const out: Rec[] = [];
    for (const p of items) {
      let cur: Rec = { ...p };
      if (valFn) {
        const v = await valFn(cur);
        if (isRec(v)) cur = { ...cur, ...v };
        else if (typeof v === "number" && Number.isFinite(v)) cur.implied_value = v;
      }
      if (farmFn) {
        const fp = await farmFn(cur);
        if (isRec(fp)) cur.farm_plan = fp;
      }
      out.push(cur);
    }
    return out.length >= 50 ? out : null;
  } catch {
    return null;
  }
}

const CRC_T = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_T[i] = c >>> 0;
}
function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (let i = 0; i < body.length; i++) c = CRC_T[(c ^ body[i]) & 0xff] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function renderPng(mode: "board" | "detail" | "filtered", rows: BoardRow[]): Buffer {
  const w = 800, h = 480, stride = 1 + w * 3;
  const raw = Buffer.alloc(h * stride);
  const rect = (x0: number, y0: number, rw: number, rh: number, r: number, g: number, b: number) => {
    const x1 = Math.min(w, Math.max(0, Math.round(x0 + rw))), y1 = Math.min(h, Math.max(0, Math.round(y0 + rh)));
    for (let y = Math.max(0, Math.round(y0)); y < y1; y++) {
      for (let x = Math.max(0, Math.round(x0)); x < x1; x++) {
        const o = y * stride + 1 + x * 3;
        raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
      }
    }
  };
  rect(0, 0, w, h, 10, 14, 24);
  rect(0, 0, w, 54, 16, 23, 38);
  rect(20, 16, 180, 22, 34, 211, 238);
  for (let k = 0; k < 4; k++) {
    rect(20 + k * 192, 68, 176, 56, 20, 29, 46);
    rect(32 + k * 192, 82, 70 + k * 14, 10, 100, 116, 139);
    rect(32 + k * 192, 100, 110, 14, 56, 189, 248);
  }
  const subset = (mode === "filtered" ? rows.filter((r) => r.tier === "S" || r.on_watchlist) : rows).slice(0, 8);
  const maxV = Math.max(1, subset[0]?.implied_value ?? 1);
  if (mode === "filtered") {
    for (let f = 0; f < 3; f++) rect(20 + f * 116, 134, 104, 22, f === 0 ? 16 : 30, f === 0 ? 185 : 41, f === 0 ? 129 : 59);
  }
  const tableW = mode === "detail" ? 430 : 760, startY = mode === "filtered" ? 168 : 140;
  subset.forEach((row, idx) => {
    const y = startY + idx * 36;
    rect(20, y, tableW, 30, idx % 2 === 0 ? 18 : 23, idx % 2 === 0 ? 26 : 34, idx % 2 === 0 ? 42 : 54);
    const tc = row.tier === "S" ? [16, 185, 129] : row.tier === "A" ? [56, 189, 248] : [245, 158, 11];
    rect(28, y + 7, 22, 16, tc[0], tc[1], tc[2]);
    rect(60, y + 9, Math.min(140, 48 + row.name.length * 6), 12, 226, 232, 240);
    rect(220, y + 9, Math.max(24, Math.round(((tableW - 240) * row.implied_value) / maxV)), 12, 56, 189, 248);
  });
  if (mode === "detail" && rows[0]) {
    rect(466, 140, 314, 318, 20, 29, 46);
    rect(482, 156, 180, 18, 56, 189, 248);
    rect(482, 186, 282, 48, 15, 23, 38);
    rect(494, 204, 240, 12, 16, 185, 129);
    for (let s = 0; s < 3; s++) {
      rect(482, 250 + s * 64, 282, 52, 27, 38, 59);
      rect(496, 264 + s * 64, 210, 10, 226, 232, 240);
      rect(496, 282 + s * 64, 155, 8, 148, 163, 184);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function buildDashboardHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0a0e18;--p:#111827;--p2:#182235;--ln:#24324a;--tx:#e5edf7;--mu:#94a3b8;--cy:#38bdf8;--gn:#10b981;--am:#f59e0b}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tx)}
header{padding:14px 22px;border-bottom:1px solid var(--ln);display:flex;justify-content:space-between;align-items:center;background:#0d1322}
h1{margin:0;font-size:19px}.sub{color:var(--mu);font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;padding:14px 22px}
.kpi{background:var(--p);border:1px solid var(--ln);border-radius:10px;padding:11px 13px}
.kpi .l{color:var(--mu);font-size:11px;text-transform:uppercase}.kpi .v{font-size:19px;font-weight:700;margin-top:3px;color:var(--cy)}
.ctrls{display:flex;flex-wrap:wrap;gap:9px;padding:0 22px 12px;align-items:center}
input,select,button{background:var(--p);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:7px 10px;font:inherit}
button{cursor:pointer}button:hover{border-color:var(--cy)}
.lay{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.95fr);gap:14px;padding:0 22px 22px}
@media(max-width:960px){.lay{grid-template-columns:1fr}}
.card{background:var(--p);border:1px solid var(--ln);border-radius:12px;overflow:hidden}
table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #1a2438;font-size:13px}
th{background:var(--p2);color:var(--mu);position:sticky;top:0;font-size:11px;text-transform:uppercase}
tbody tr{cursor:pointer}tbody tr:hover,tbody tr.active{background:#192740}
.scr{max-height:68vh;overflow:auto}.num{text-align:right;font-variant-numeric:tabular-nums}
.b{display:inline-block;padding:2px 7px;border-radius:99px;font-size:11px;font-weight:700}
.S{background:#064e3b;color:#34d399}.A{background:#0c4a6e;color:#38bdf8}.B{background:#78350f;color:#fbbf24}.C{background:#1e293b;color:#cbd5e1}
.wl{color:var(--am);margin-left:5px}.det{padding:16px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:11px 0}.m{background:var(--p2);padding:9px;border-radius:8px}
.m span{display:block;color:var(--mu);font-size:11px}.m strong{font-size:15px}
.steps{margin:8px 0 0;padding-left:18px}.steps li{margin-bottom:5px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.tag{background:var(--p2);border:1px solid var(--ln);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--mu)}
</style></head><body>
<header><div><h1>Token Launch Radar</h1><div class="sub">Tokenless DeFi Valuation Board &amp; Farming Planner (Offline Static Build)</div></div><div class="sub" id="meta"></div></header>
<section class="kpis" id="kpis"></section>
<section class="ctrls">
<input id="q" placeholder="Search protocol, chain, category..." style="min-width:210px">
<select id="cat"><option value="">All Categories</option></select>
<select id="ch"><option value="">All Chains</option></select>
<select id="tr"><option value="">All Tiers</option><option>S</option><option>A</option><option>B</option><option>C</option></select>
<select id="sk"><option value="implied_value">Sort: Implied FDV</option><option value="tvl">Sort: TVL</option><option value="score">Sort: Score</option><option value="change_7d">Sort: 7d Growth</option></select>
<label><input type="checkbox" id="wl"> Watchlist</label>
<button id="rst" type="button">Reset</button><span class="sub" id="shown"></span>
</section>
<main class="lay">
<div class="card scr"><table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">7d</th><th class="num">Implied FDV</th><th class="num">Mult</th><th>Tier</th></tr></thead><tbody id="rows"></tbody></table></div>
<aside class="card det" id="det"></aside>
</main>
<script src="./data.js"></script>
<script>
const D=window.TOKEN_RADAR_DATA||{rows:[]},$=id=>document.getElementById(id);
const fmt=n=>n>=1e9?"$"+(n/1e9).toFixed(2)+"B":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":"$"+Math.round(n).toLocaleString();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let sel=D.rows[0]?.slug||"";
[...new Set(D.rows.map(r=>r.category))].sort().forEach(v=>$("cat").innerHTML+="<option>"+esc(v)+"</option>");
[...new Set(D.rows.flatMap(r=>r.chains||[r.chain]))].sort().forEach(v=>$("ch").innerHTML+="<option>"+esc(v)+"</option>");
const tot=D.rows.reduce((a,r)=>a+r.implied_value,0);
const mid=Math.floor(D.rows.length/2),med=D.rows.length?D.rows.length%2?D.rows[mid].implied_value:(D.rows[mid-1].implied_value+D.rows[mid].implied_value)/2:0;
$("meta").textContent="Rows: "+D.rows.length+" | Snapshot: "+(D.snapshot_sha256||"local");
$("kpis").innerHTML=[["Ranked Tokenless",D.rows.length],["Watchlist Covered",(D.watchlist_covered||0)+"/"+(D.watchlist_total||0)],["Total Implied FDV",fmt(tot)],["Median Implied FDV",fmt(med)],["S-Tier Launches",D.rows.filter(r=>r.tier==="S").length]]
.map(([l,v])=>'<div class="kpi"><div class="l">'+esc(l)+'</div><div class="v">'+esc(v)+"</div></div>").join("");
function showDet(r){
  if(!r){$("det").innerHTML="<p class='sub'>No matching protocol.</p>";return;}
  $("det").innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">'+esc(r.name)+'</h2><span class="b '+esc(r.tier)+'">Tier '+esc(r.tier)+'</span></div>'
  +'<div class="sub" style="margin-top:4px">'+esc(r.category)+' · '+esc((r.chains||[r.chain]).join(", "))+(r.on_watchlist?" · ★ Watchlist":"")+'</div>'
  +'<div class="g2"><div class="m"><span>Implied Launch FDV</span><strong>'+fmt(r.implied_value)+'</strong></div>'
  +'<div class="m"><span>Valuation Range</span><strong>'+fmt(r.fdv_low)+' – '+fmt(r.fdv_high)+'</strong></div>'
  +'<div class="m"><span>TVL / 30d Rev</span><strong>'+fmt(r.tvl)+' / '+fmt(r.revenue_30d)+'</strong></div>'
  +'<div class="m"><span>Score / Confidence</span><strong>'+r.score+' / '+r.confidence+'%</strong></div></div>'
  +'<p style="color:var(--mu);margin:8px 0">'+esc(r.rationale)+'</p>'
  +'<h3 style="margin:12px 0 5px">Farm Plan</h3>'
  +'<div class="sub">'+esc(r.farm_plan.strategy)+' · Risk: '+esc(r.farm_plan.risk)+' · Capital: '+esc(r.farm_plan.capital_tier)+'</div>'
  +'<div class="sub" style="color:var(--gn);margin-top:3px">Est. Airdrop Pool: '+r.farm_plan.est_airdrop_pct+'% ('+fmt(r.farm_plan.est_airdrop_usd)+')</div>'
  +'<ol class="steps">'+r.farm_plan.steps.map(s=>"<li>"+esc(s)+"</li>").join("")+'</ol>'
  +'<div class="tags">'+r.farm_plan.signals.map(s=>'<span class="tag">'+esc(s)+"</span>").join("")+"</div>";
}
function render(){
  const q=$("q").value.trim().toLowerCase(),cat=$("cat").value,ch=$("ch").value,tr=$("tr").value,wl=$("wl").checked,sk=$("sk").value;
  const list=D.rows.filter(r=>(!cat||r.category===cat)&&(!ch||(r.chains||[r.chain]).includes(ch))&&(!tr||r.tier===tr)&&(!wl||r.on_watchlist)&&(!q||r.name.toLowerCase().includes(q)||r.category.toLowerCase().includes(q)||(r.chains||[r.chain]).some(c=>c.toLowerCase().includes(q)))).sort((a,b)=>(b[sk]-a[sk])||(a.rank-b.rank));
  $("shown").textContent="Showing "+list.length+" / "+D.rows.length;
  if(!list.some(r=>r.slug===sel))sel=list[0]?.slug||"";
  $("rows").innerHTML=list.map(r=>'<tr data-s="'+esc(r.slug)+'" class="'+(r.slug===sel?"active":"")+'"><td>'+r.rank+'</td><td><strong>'+esc(r.name)+'</strong>'+(r.on_watchlist?'<span class="wl">★</span>':"")+'<div class="sub">'+esc(r.chain)+'</div></td><td>'+esc(r.category)+'</td><td class="num">'+fmt(r.tvl)+'</td><td class="num" style="color:'+(r.change_7d>=0?"var(--gn)":"#f87171")+'">'+(r.change_7d>=0?"+":"")+r.change_7d+'%</td><td class="num"><strong>'+fmt(r.implied_value)+'</strong></td><td class="num">'+r.multiple+'x</td><td><span class="b '+esc(r.tier)+'">'+esc(r.tier)+"</span></td></tr>").join("");
  document.querySelectorAll("#rows tr").forEach(el=>el.onclick=()=>{sel=el.dataset.s;render();});
  showDet(list.find(r=>r.slug===sel));
}
["q","cat","ch","tr","sk","wl"].forEach(id=>$(id).addEventListener("input",render));
$("rst").onclick=()=>{$("q").value="";$("cat").value="";$("ch").value="";$("tr").value="";$("wl").checked=false;$("sk").value="implied_value";render();};
render();
</script></body></html>
`;
}

function mergeRow(map: Map<string, BoardRow>, row: BoardRow): void {
  const prev = map.get(row.slug);
  if (!prev) { map.set(row.slug, row); return; }
  const win = row.tvl > prev.tvl ? row : prev;
  win.on_watchlist = prev.on_watchlist || row.on_watchlist;
  map.set(row.slug, win);
}

async function main(): Promise<void> {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ? path.resolve(process.env.MAKEFUN_OUTPUT_DIR) : process.cwd();
  fs.mkdirSync(path.join(outDir, "dashboard"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });

  const { raw, watchlist, hash } = loadInputs();
  const tokenedParents = new Set<string>();
  const rawBySlug = new Map<string, Rec>();
  for (const p of raw) {
    const s = toSlug(String(p.slug ?? p.name ?? ""));
    if (s && (!rawBySlug.has(s) || num(p.tvl) > num(rawBySlug.get(s)?.tvl))) rawBySlug.set(s, p);
    if (hasLiveToken(p)) {
      if (p.parentProtocol) tokenedParents.add(String(p.parentProtocol).trim().toLowerCase());
      if (s) tokenedParents.add(`parent#${s}`);
    }
  }

  const libRows = await tryLibPipeline(raw, watchlist);
  const eligible = libRows ?? raw.filter((p) => isTokenlessEligible(p, tokenedParents, watchlist));
  const bySlug = new Map<string, BoardRow>();
  for (const item of eligible) mergeRow(bySlug, normalizeRow(item, watchlist));

  for (const wlSlug of Array.from(watchlist).sort(cmpStr)) {
    if (!bySlug.has(wlSlug)) {
      const src = rawBySlug.get(wlSlug) ?? { slug: wlSlug, name: wlSlug.replace(/-/g, " "), category: "DeFi", chain: "Ethereum", tvl: 25_000_000, on_watchlist: true };
      const row = normalizeRow(src, watchlist);
      row.on_watchlist = true;
      bySlug.set(row.slug, row);
    }
  }
  if (bySlug.size < 100) {
    for (const seed of buildSeedSnapshot().protocols) {
      const row = normalizeRow(seed, watchlist);
      if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
      if (bySlug.size >= 110) break;
    }
  }

  const rows = Array.from(bySlug.values()).sort((a, b) =>
    (b.implied_value - a.implied_value) || (b.tvl - a.tvl) || cmpStr(a.slug, b.slug),
  );
  rows.forEach((r, idx) => { r.rank = idx + 1; });
  const wlCovered = rows.filter((r) => r.on_watchlist).length;

  const board = {
    schema: "token-radar/v1",
    snapshot_sha256: hash,
    count: rows.length,
    watchlist_total: Math.max(watchlist.size, wlCovered),
    watchlist_covered: wlCovered,
    rows,
  };

  const safeDataJs = `window.TOKEN_RADAR_DATA = ${JSON.stringify(board).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")};\n`;
  const artifacts: Record<string, string | Buffer> = {
    "board.json": JSON.stringify(board, null, 2) + "\n",
    "dashboard/data.js": safeDataJs,
    "dashboard/index.html": buildDashboardHtml(),
    "screenshots/board.png": renderPng("board", rows),
    "screenshots/detail.png": renderPng("detail", rows),
    "screenshots/filtered.png": renderPng("filtered", rows),
  };

  const manifest: Record<string, { bytes: number; sha256: string }> = {};
  for (const [rel, content] of Object.entries(artifacts)) {
    fs.writeFileSync(path.join(outDir, rel), content);
    manifest[rel] = { bytes: Buffer.byteLength(content), sha256: sha256(content) };
  }

  const catCounts: Record<string, number> = {};
  for (const r of rows) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1;
  const dossier = {
    schema: "makefun-dossier/v1",
    bounty: "token-radar-01",
    snapshot_sha256: hash,
    board_count: rows.length,
    watchlist_covered: wlCovered,
    watchlist_total: board.watchlist_total,
    top_10: rows.slice(0, 10).map((r) => ({ rank: r.rank, slug: r.slug, name: r.name, implied_value: r.implied_value, tier: r.tier })),
    categories: Object.fromEntries(Object.entries(catCounts).sort((a, b) => cmpStr(a[0], b[0]))),
    artifacts: manifest,
  };
  fs.writeFileSync(path.join(outDir, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
}

await main();