import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : ROOT;

type Proto = {
  name: string;
  slug: string;
  category?: string | null;
  chains: string[];
  tvl: number | null;
  mcap: number | null;
  twitter: string | null;
  url: string | null;
  description: string | null;
  listedAt: number | null;
  audits: string | number | null;
  forks: number | null;
  parentProtocol: string | null;
  symbol: string | null;
  token: string | null;
  raw: any;
};

type BoardRow = {
  rank: number;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number | null;
  mcap: number | null;
  twitter: string | null;
  url: string | null;
  description: string | null;
  impliedValue: number;
  scoreParts: Record<string, number>;
  farmPlan: string[];
  tokenless: true;
  wrappedReason: null;
};

const WRAPPED_HINTS = [
  "wrapped", "staked", "stake", "liquid staking", "lsd", "lst", "restaked", "restaking",
  "vault", "receipt", "bridged", "canonical", "gauge", "lp token", "pt-", "yt-", "aave-v", "c-",
];

const DERIVATIVE_CATEGORY = /liquid staking|restaking|yield aggregator|cex|bridge/i;
const DERIVATIVE_NAME = /staked|wrapped|receipt/i;
const STRONG_CATEGORY = /dex|perp|derivativ|lending|cdp|yield|bridge|lsd|restaking|rwa|stablecoin|options|insurance|launchpad/i;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s;
}

function walkFiles(dir: string, acc: string[] = [], depth = 0): string[] {
  if (depth > 6 || !existsSync(dir)) return acc;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walkFiles(p, acc, depth + 1);
    else acc.push(p);
  }
  return acc;
}

function parseSnapshotFile(f: string): any | null {
  let txt: string;
  try { txt = readFileSync(f, "utf8"); } catch { return null; }
  try {
    if (f.toLowerCase().endsWith(".jsonl")) {
      const rows = txt.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
      return rows;
    }
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function findSnapshot(): { file: string; data: any } | null {
  const candidates: string[] = [];
  const env = process.env.MAKEFUN_SNAPSHOT || process.env.SNAPSHOT_PATH;
  if (env) candidates.push(resolve(env));
  const bases = [ROOT, OUT, join(ROOT, "snapshot"), join(ROOT, "data"), join(ROOT, "vendor")];
  const seen = new Set<string>();
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const f of walkFiles(base)) {
      if (seen.has(f)) continue;
      seen.add(f);
      const low = f.toLowerCase();
      if (!/\.(json|jsonl)$/.test(low)) continue;
      if (/snapshot|protocols|defillama|sealed|radar/.test(low)) candidates.push(f);
    }
  }
  for (const f of candidates) {
    const data = parseSnapshotFile(f);
    if (data === null) continue;
    if (extractList(data).length >= 20) return { file: f, data };
  }
  return null;
}

function extractList(data: any, depth = 0): any[] {
  if (depth > 4 || data === null || data === undefined) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== "object") return [];
  for (const k of ["protocols", "data", "rows", "items", "results", "list"]) {
    const v = (data as any)[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const inner = extractList(v, depth + 1);
      if (inner.length) return inner;
    }
  }
  const vals = Object.values(data);
  if (vals.length && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
    return vals as any[];
  }
  return [];
}

function normalize(p: any): Proto {
  const name = str(p.name ?? p.protocol ?? p.slug ?? p.id) ?? "unknown";
  const slug = str(p.slug ?? p.id) ?? slugify(name);
  const chainsRaw = Array.isArray(p.chains) ? p.chains : p.chain ? [p.chain] : [];
  const chains = Array.from(new Set(chainsRaw.map((c: any) => str(c)).filter((c: string | null): c is string => !!c)));
  return {
    name,
    slug,
    category: str(p.category ?? p.sector),
    chains,
    tvl: num(p.tvl ?? p.TVL ?? p.tvlUsd ?? p.totalLiquidityUSD),
    mcap: num(p.mcap ?? p.marketCap ?? p.market_cap ?? p.fdv),
    twitter: str(p.twitter ?? p.twitterHandle),
    url: str(p.url ?? p.website),
    description: str(p.description),
    listedAt: num(p.listedAt ?? p.listed_at ?? p.createdAt),
    audits: p.audits ?? p.audit_links ?? null,
    forks: num(p.forks ?? p.forkCount),
    parentProtocol: str(p.parentProtocol ?? p.parent),
    symbol: str(p.symbol ?? p.tokenSymbol),
    token: str(p.token ?? p.tokenAddress ?? p.address),
    raw: p,
  };
}

function hasToken(p: Proto): boolean {
  if (p.token) return true;
  if (p.symbol) return true;
  const r = p.raw || {};
  for (const k of ["token", "tokenAddress", "address", "gecko_id", "geckoId", "cmcId", "symbol", "tokens"]) {
    const v = r[k];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) { if (v.length) return true; continue; }
    if (typeof v === "string") { if (str(v)) return true; continue; }
    if (typeof v === "number") { if (Number.isFinite(v) && v > 0) return true; }
  }
  return false;
}

function isWrappedOrStaked(p: Proto, all: Proto[]): { wrapped: boolean; reason: string } {
  const n = p.name.toLowerCase();
  const cat = String(p.category ?? "").toLowerCase();
  for (const h of WRAPPED_HINTS) {
    if (n.includes(h)) return { wrapped: true, reason: `name matches "${h}"` };
  }
  if (DERIVATIVE_CATEGORY.test(cat) && DERIVATIVE_NAME.test(n)) {
    return { wrapped: true, reason: `category ${cat} derivative` };
  }
  if (p.parentProtocol) {
    const target = p.parentProtocol.toLowerCase();
    const parent = all.find((x) => x.slug === p.parentProtocol || x.name.toLowerCase() === target);
    if (parent && hasToken(parent)) return { wrapped: true, reason: `derivative of ${parent.name}` };
  }
  return { wrapped: false, reason: "" };
}

function scoreProto(p: Proto): { value: number; parts: Record<string, number> } {
  const tvl = p.tvl ?? 0;
  const mcap = p.mcap ?? 0;
  const tvlScore = tvl > 0 ? Math.log10(1 + tvl) * 22 : 0;
  const mcapScore = mcap > 0 ? Math.log10(1 + mcap) * 14 : 0;
  const chainScore = Math.min(p.chains.length * 4, 24);
  const catBonus = STRONG_CATEGORY.test(String(p.category ?? "")) ? 18 : 6;
  const age = p.listedAt ? Math.max(0, (Date.now() / 1000 - p.listedAt) / 86400) : 365;
  const ageScore = Math.min(Math.log10(1 + age) * 6, 30);
  const auditScore = p.audits ? Math.min(Array.isArray(p.audits) ? p.audits.length * 4 : 8, 20) : 0;
  const forkPenalty = Math.min((p.forks ?? 0) * 1.5, 20);
  const social = p.twitter ? 6 : 0;
  const parts = { tvlScore, mcapScore, chainScore, catBonus, ageScore, auditScore, social, forkPenalty };
  const value = Math.max(0, tvlScore + mcapScore + chainScore + catBonus + ageScore + auditScore + social - forkPenalty);
  return { value: Math.round(value * 100) / 100, parts };
}

function farmPlan(p: Proto, value: number): string[] {
  const steps: string[] = [];
  const tvl = p.tvl ?? 0;
  const chains = p.chains;
  steps.push(`Track ${p.name} on ${chains.length ? chains.join(", ") : "its primary chain"} via DefiLlama and the team's socials for token announcements.`);
  if (tvl > 0) {
    steps.push(`Provide liquidity or use the protocol with a small position (TVL ~$${Math.round(tvl).toLocaleString("en-US")}) to qualify for a potential airdrop snapshot.`);
  } else {
    steps.push(`Engage early before TVL grows: test the product on testnet/mainnet with a small amount.`);
  }
  if (p.twitter) steps.push(`Follow ${p.twitter} and join the community to catch quests, points programs and allowlists.`);
  if (p.url) steps.push(`Register on ${p.url} and complete any points/quest campaigns.`);
  steps.push(`Keep activity consistent across ${Math.max(1, Math.min(3, chains.length || 1))} chain(s) and document wallet addresses used.`);
  steps.push(`Set alerts for token launch keywords; implied value score ${value.toFixed(1)} suggests ${value > 90 ? "high" : value > 50 ? "medium" : "speculative"} upside.`);
  return steps;
}

function buildBoard(snapshot: { file: string; data: any }): any {
  const rawList = extractList(snapshot.data);
  const all = rawList.map(normalize);
  const seen = new Set<string>();
  const rows: BoardRow[] = [];
  for (const p of all) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    if (hasToken(p)) continue;
    if (isWrappedOrStaked(p, all).wrapped) continue;
    const { value, parts } = scoreProto(p);
    rows.push({
      rank: 0,
      name: p.name,
      slug: p.slug,
      category: p.category ?? "unknown",
      chains: p.chains,
      tvl: p.tvl,
      mcap: p.mcap,
      twitter: p.twitter,
      url: p.url,
      description: p.description,
      impliedValue: value,
      scoreParts: parts,
      farmPlan: farmPlan(p, value),
      tokenless: true,
      wrappedReason: null,
    });
  }
  rows.sort((a, b) => b.impliedValue - a.impliedValue || (b.tvl ?? 0) - (a.tvl ?? 0));
  rows.forEach((r, i) => (r.rank = i + 1));
  return {
    generatedAt: new Date().toISOString(),
    snapshotFile: relative(ROOT, snapshot.file) || snapshot.file,
    totalProtocols: all.length,
    tokenlessCount: rows.length,
    rows,
  };
}

function esc(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderDashboard(board: any): string {
  const rows: BoardRow[] = board.rows;
  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
  const chains = Array.from(new Set(rows.flatMap((r) => r.chains))).sort();
  const dataJs = JSON.stringify(rows).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#121821;--line:#1f2937;--txt:#e5e7eb;--mut:#9ca3af;--acc:#22d3ee;--good:#34d399;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
header{padding:18px 24px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
h1{font-size:20px;margin:0}h1 span{color:var(--acc)}
.stat{color:var(--mut);font-size:12px}.stat b{color:var(--txt)}
main{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:0;height:calc(100vh - 64px)}
@media(max-width:900px){main{grid-template-columns:1fr;height:auto}}
#list{overflow:auto;padding:12px 16px}
#detail{overflow:auto;border-left:1px solid var(--line);padding:16px;background:var(--panel)}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
input,select{background:#0f1520;border:1px solid var(--line);color:var(--txt);padding:6px 10px;border-radius:6px;font-size:13px}
input{flex:1;min-width:160px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{position:sticky;top:0;background:var(--bg);text-align:left;color:var(--mut);font-weight:500;padding:8px 6px;border-bottom:1px solid var(--line);cursor:pointer}
td{padding:8px 6px;border-bottom:1px solid #151c26;vertical-align:top}
tr.row{cursor:pointer}tr.row:hover{background:#0f1520}tr.sel{background:#0e2230}
.rank{color:var(--mut);width:36px}.name{font-weight:600}.cat{color:var(--mut);font-size:11px}
.val{color:var(--acc);font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.bar{height:4px;background:#1f2937;border-radius:2px;margin-top:4px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#0891b2,#22d3ee)}
.tag{display:inline-block;font-size:10px;padding:1px 6px;border:1px solid var(--line);border-radius:10px;color:var(--mut);margin-right:4px}
#detail h2{margin:0 0 4px;font-size:18px}#detail .sub{color:var(--mut);font-size:12px;margin-bottom:12px}
.kv{display:grid;grid-template-columns:110px 1fr;gap:4px 8px;font-size:13px;margin:12px 0}.kv b{color:var(--mut);font-weight:500}
ol{padding-left:18px}ol li{margin:6px 0}
a{color:var(--acc)}.empty{color:var(--mut);padding:24px}
</style></head><body>
<header><h1>Token Launch <span>Radar</span></h1>
<div class="stat"><b>${board.totalProtocols}</b> protocols scanned · <b>${board.tokenlessCount}</b> tokenless candidates</div>
<div class="stat">generated ${esc(board.generatedAt)}</div></header>
<main>
<section id="list">
<div class="controls">
<input id="q" placeholder="Search protocol, category, chain…">
<select id="cat"><option value="">All categories</option>${categories.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
<select id="chain"><option value="">All chains</option>${chains.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
<select id="minv"><option value="0">Any value</option><option value="50">Value ≥ 50</option><option value="80">Value ≥ 80</option><option value="100">Value ≥ 100</option></select>
</div>
<table><thead><tr><th>#</th><th>Protocol</th><th>Chains</th><th style="text-align:right">TVL</th><th style="text-align:right">Implied value</th></tr></thead>
<tbody id="tbody"></tbody></table>
</section>
<aside id="detail"><div class="empty">Select a protocol to see its detail view and farm plan.</div></aside>
</main>
<script>
const ROWS=${dataJs};
const els={q:document.getElementById('q'),cat:document.getElementById('cat'),chain:document.getElementById('chain'),minv:document.getElementById('minv'),tbody:document.getElementById('tbody'),detail:document.getElementById('detail')};
let sel=null;
function fmt(n){if(n==null)return '—';if(n>=1e9)return '$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return '$'+(n/1e6).toFixed(2)+'M';if(n>=1e3)return '$'+(n/1e3).toFixed(1)+'K';return '$'+Math.round(n)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function filtered(){const q=els.q.value.toLowerCase(),c=els.cat.value,ch=els.chain.value,mv=Number(els.minv.value)||0;
return ROWS.filter(r=>r.impliedValue>=mv&&(!c||r.category===c)&&(!ch||r.chains.includes(ch))&&(!q||(r.name+' '+r.category+' '+r.chains.join(' ')+' '+(r.description||'')).toLowerCase().includes(q)))}
function render(){const rows=filtered();const max=Math.max(1,...ROWS.map(r=>r.impliedValue));
els.tbody.innerHTML=rows.length?rows.map(r=>'<tr class="row'+(sel===r.slug?' sel':'')+'" data-slug="'+esc(r.slug)+'"><td class="rank">'+r.rank+'</td><td><div class="name">'+esc(r.name)+'</div><div class="cat">'+esc(r.category)+'</div></td><td>'+r.chains.slice(0,3).map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'</td><td style="text-align:right;color:var(--mut)">'+fmt(r.tvl)+'</td><td class="val">'+r.impliedValue.toFixed(1)+'<div