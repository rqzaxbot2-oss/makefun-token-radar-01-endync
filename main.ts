import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";

type Snap = Record<string, any>;

const OUT = process.env.MAKEFUN_OUTPUT_DIR || process.cwd();
const SNAP_DIRS = ["snapshot", "data", "vendor", "input", "."];

function findSnapshot(): { path: string; data: Snap } | null {
  const candidates: string[] = [];
  for (const d of SNAP_DIRS) {
    const p = join(process.cwd(), d);
    if (!existsSync(p)) continue;
    let entries: string[] = [];
    try { entries = readdirSync(p); } catch { continue; }
    for (const e of entries) {
      if (!/\.json$/i.test(e)) continue;
      const full = join(p, e);
      try { if (!statSync(full).isFile()) continue; } catch { continue; }
      candidates.push(full);
    }
  }
  const prefer = candidates.find((c) => /snapshot|defillama|protocol/i.test(basename(c)));
  const ordered = prefer ? [prefer, ...candidates.filter((c) => c !== prefer)] : candidates;
  for (const c of ordered) {
    try {
      const raw = JSON.parse(readFileSync(c, "utf8"));
      const arr = extractProtocols(raw);
      if (arr.length > 0) return { path: c, data: raw };
    } catch { /* skip */ }
  }
  return null;
}

function extractProtocols(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  for (const k of ["protocols", "data", "items", "rows", "protocolsData"]) {
    if (Array.isArray(raw[k])) return raw[k];
  }
  // object keyed by slug
  const vals = Object.values(raw).filter((v) => v && typeof v === "object" && ("name" in (v as any) || "slug" in (v as any)));
  return vals as any[];
}

const WRAPPED_RE = /\b(wrapped|staked|stake|restaked|restaking|liquid staking|lst|lsd|vault|receipt|derivative|bridged|weth|wbtc|steth|reth|cbeth|sfrxeth|susde|susds|ausdc|ausdt|cusdc|cusdt|yv|gauge|pt-|yt-|eigenpie|kelp|renzo|ether\.fi)\b/i;
const TOKEN_FIELDS = ["symbol", "gecko_id", "tokenSymbol", "token", "tokenSymbols", "tokens"];

function hasToken(p: any): boolean {
  for (const f of TOKEN_FIELDS) {
    const v = p[f];
    if (v == null) continue;
    if (typeof v === "string" && v.trim() !== "") return true;
    if (Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim() !== "")) return true;
    if (typeof v === "object" && Object.keys(v).length > 0) return true;
  }
  const cat = String(p.category || "").toLowerCase();
  if (/liquid staking|restaking|yield aggregator|bridge/.test(cat) && p.parentProtocol) return true;
  return false;
}

function isWrappedOrStaked(p: any): boolean {
  const name = String(p.name || "");
  const slug = String(p.slug || "");
  const cat = String(p.category || "").toLowerCase();
  if (p.parentProtocol && String(p.parentProtocol).trim() !== "") return true;
  if (p.listedAt != null && p.parentProtocol) return true;
  if (WRAPPED_RE.test(name) || WRAPPED_RE.test(slug)) return true;
  if (/liquid staking|restaking|liquid restaking/.test(cat)) return true;
  return false;
}

function num(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-eE]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function tvlOf(p: any): number {
  const cands = [p.tvl, p.tvlUsd, p.totalLiquidityUSD, p.currentChainTvls];
  for (const c of cands) {
    if (typeof c === "number" && c > 0) return c;
    if (c && typeof c === "object") {
      const s = Object.values(c).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
      if (s > 0) return s;
    }
  }
  return 0;
}

function chainsOf(p: any): string[] {
  if (Array.isArray(p.chains)) return p.chains.map(String);
  if (p.chainTvls && typeof p.chainTvls === "object") return Object.keys(p.chainTvls);
  if (typeof p.chain === "string") return [p.chain];
  return [];
}

function categoryOf(p: any): string {
  return String(p.category || p.categoryName || "Uncategorized");
}

// Implied launch value: TVL-weighted with category multipliers and momentum.
const CAT_MULT: Record<string, number> = {
  "Dexes": 1.35, "DEX": 1.35, "Lending": 1.3, "Perp DEX": 1.5, "Derivatives": 1.4,
  "Yield": 1.15, "Yield Aggregator": 1.1, "CDP": 1.2, "RWA": 1.6, "Bridge": 1.05,
  "Liquid Staking": 0.9, "Restaking": 0.95, "Options": 1.2, "Insurance": 0.85,
  "Farm": 0.7, "Gaming": 0.8, "NFT Marketplace": 0.75, "Launchpad": 1.1,
  "Oracle": 1.25, "Payments": 1.0, "Privacy": 0.9, "Social": 0.7, "Prediction Market": 1.3,
  "Algo-Stables": 0.95, "Synthetics": 1.1, "Indexes": 0.9, "Cross Chain": 1.0,
};

function catMultiplier(cat: string): number {
  if (CAT_MULT[cat]) return CAT_MULT[cat];
  for (const k of Object.keys(CAT_MULT)) if (cat.toLowerCase().includes(k.toLowerCase())) return CAT_MULT[k];
  return 1.0;
}

function momentum(p: any): number {
  const c = num(p.change_1d ?? p.change1d);
  const w = num(p.change_7d ?? p.change7d);
  const m = num(p.change_1m ?? p.change1m);
  const raw = c * 0.15 + w * 0.35 + m * 0.5;
  return Math.max(0.6, Math.min(1.6, 1 + raw / 100));
}

function impliedValue(p: any): { value: number; tvl: number; mult: number; mom: number } {
  const tvl = tvlOf(p);
  const mult = catMultiplier(categoryOf(p));
  const mom = momentum(p);
  // FDV heuristic: protocols with no token typically IPO at ~0.2x-0.6x TVL.
  const base = tvl * 0.35;
  const value = Math.round(base * mult * mom);
  return { value, tvl, mult, mom };
}

function farmPlan(p: any, tvl: number, chains: string[]): string[] {
  const cat = categoryOf(p);
  const steps: string[] = [];
  const chain = chains[0] || "its main chain";
  steps.push(`Bridge/on-ramp to ${chain} and fund a wallet with native gas plus the protocol's core asset.`);
  if (/dex|perp|derivatives/i.test(cat)) {
    steps.push(`Provide liquidity or trade on ${p.name} to earn volume points; keep positions small to limit IL.`);
    steps.push(`Track the protocol's points/leaderboard page weekly and snapshot your position before any announced cutoff.`);
  } else if (/lending|cdp/i.test(cat)) {
    steps.push(`Supply a stable or blue-chip asset to ${p.name} and borrow conservatively to compound points without liquidation risk.`);
    steps.push(`Loop only within safe LTV; keep a health factor above 2.0.`);
  } else if (/yield|farm|vault/i.test(cat)) {
    steps.push(`Deposit into ${p.name}'s highest-TVL vault with a token you already hold to accrue yield plus potential airdrop weight.`);
  } else if (/rwa|oracle|payments|bridge/i.test(cat)) {
    steps.push(`Use ${p.name} for real activity (transfer, quote, or settle) since infra protocols often weight usage over TVL.`);
  } else {
    steps.push(`Interact with ${p.name} through its main product to register on-chain activity.`);
  }
  steps.push(`Follow ${p.name}'s official channels for a token announcement; do not pay for "guaranteed" allocations.`);
  if (tvl > 0) steps.push(`Current TVL ~$${Math.round(tvl).toLocaleString("en-US")}; larger TVL usually means a larger implied launch.`);
  return steps;
}

function main() {
  const snap = findSnapshot();
  const protocols: any[] = snap ? extractProtocols(snap.data) : [];

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const p of protocols) {
    if (!p || typeof p !== "object") continue;
    const name = String(p.name || p.slug || "").trim();
    if (!name) continue;
    const slug = String(p.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (hasToken(p)) continue;
    if (isWrappedOrStaked(p)) continue;
    const { value, tvl, mult, mom } = impliedValue(p);
    const chains = chainsOf(p);
    const cat = categoryOf(p);
    rows.push({
      slug,
      name,
      category: cat,
      chains,
      tvl,
      impliedValueUsd: value,
      categoryMultiplier: Number(mult.toFixed(3)),
      momentumMultiplier: Number(mom.toFixed(3)),
      farmPlan: farmPlan(p, tvl, chains),
      url: p.url || p.website || null,
      description: String(p.description || "").slice(0, 400),
    });
  }

  rows.sort((a, b) => b.impliedValueUsd - a.impliedValueUsd || b.tvl - a.tvl);
  rows.forEach((r, i) => (r.rank = i + 1));

  const board = {
    generatedAt: new Date().toISOString(),
    source: snap ? basename(snap.path) : "none",
    totalProtocolsScanned: protocols.length,
    watchlistCount: rows.length,
    rows,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));

  // dossier.json from vendor/makefun-board.ts if present
  const dossierPath = join(process.cwd(), "vendor", "makefun-board.ts");
  let dossier: any = {
    format: "makefun-dossier/1",
    board: "board.json",
    generatedAt: board.generatedAt,
    summary: {
      scanned: protocols.length,
      watchlist: rows.length,
      top: rows.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, impliedValueUsd: r.impliedValueUsd })),
    },
  };
  if (existsSync(dossierPath)) {
    try {
      const src = readFileSync(dossierPath, "utf8");
      dossier.vendor = { path: "vendor/makefun-board.ts", bytes: src.length, sha256Hint: src.length };
    } catch { /* ignore */ }
  }
  writeFileSync(join(OUT, "dossier.json"), JSON.stringify(dossier, null, 2));

  writeDashboard(board);
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function writeDashboard(board: any) {
  const dir = join(OUT, "dashboard");
  mkdirSync(dir, { recursive: true });
  const data = JSON.stringify(board);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#121821;--line:#1e2733;--fg:#e6edf3;--mut:#8b98a5;--acc:#3fb950;--hot:#f85149;--warm:#d29922}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
header{padding:18px 22px;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
h1{font-size:18px;margin:0}h1 span{color:var(--acc)}
.meta{color:var(--mut);font-size:12px}
main{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:0;height:calc(100vh - 62px)}
#board{overflow:auto;border-right:1px solid var(--line)}
#detail{overflow:auto;padding:18px}
.bar{padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:2}
input,select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}
input{flex:1;min-width:160px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:53px;background:var(--bg)}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--panel)}tbody tr.sel{background:#17202b}
td.name{white-space:normal;max-width:280px}
.val{color:var(--acc);font-variant-numeric:tabular-nums}
.tvl{color:var(--mut);font-variant-numeric:tabular-nums}
.pill{display:inline-block;padding:1px 7px;border-radius:10px;background:var(--panel);border:1px solid var(--line);font-size:11px;color:var(--mut)}
.hot{color:var(--hot)}.warm{color:var(--warm)}
#detail h2{margin:0 0 4px;font-size:17px}
#detail .sub{color:var(--mut);font-size:12px;margin-bottom:14px}
.kv{display:grid;grid-template-columns:120px 1fr;gap:6px 10px;margin:12px 0;font-size:13px}
.kv div:nth-child(odd){color:var(--mut)}
ol{padding-left:18px}ol li{margin:6px 0}
.empty{color:var(--mut);padding:24px}
@media(max-width:900px){main{grid-template-columns:1fr;height:auto}#board{border-right:none}}
</style></head>
<body>
<header><h1>Token Launch <span>Radar</span></h1><div class="meta" id="meta"></div></header>
<main>
<div id="board">
  <div class="bar">
    <input id="q" placeholder="Search protocol, chain, category…">
    <select id="cat"><option value="">All categories</option></select>
    <select id="chain"><option value="">All chains</option></select>
    <select id="sort">
      <option value="value">Sort: implied value</option>
      <option value="tvl">Sort: TVL</option>
      <option value="name">Sort: name</option>
      <option value="rank">Sort: rank</option>
    </select>
  </div>
  <table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th>TVL</th><th>Implied launch</th></tr></thead>
  <tbody id="rows"></tbody></table>
</div>
<div id="detail"><div class="empty">Select a protocol to see its detail view and farm plan.</div></div>
</main>
<script>
const BOARD = ${data};
const $ = (s) => document.querySelector(s);
const fmt = (n) => n >= 1e9 ? '$'+(n/1e9).toFixed(2)+'B' : n >= 1e6 ? '$'+(n/1e6).toFixed(2)+'M' : n >= 1e3 ? '$'+(n/1e3).toFixed(1)+'K' : '$'+Math.round(n);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('#meta').textContent = BOARD.watchlistCount + ' untokenized protocols · ' + BOARD.totalProtocolsScanned + ' scanned · source ' + BOARD.source;
const cats = [...new Set(BOARD.rows.map(r => r.category))].sort();
for (const c of cats) { const o=document.createElement('option'); o.value=c; o.textContent=c; $('#cat').appendChild(o); }
const chains = [...new Set(BOARD.rows.flatMap(r => r.chains))].sort();
for (const c of chains) { const o=document.createElement('option'); o.value=c; o.textContent=c; $('#chain').appendChild(o); }
let selected = BOARD.rows[0] ? BOARD.rows[0].slug : null;
function render() {
  const q = $('#q').value.toLowerCase().trim();
  const cat = $('#cat').value, chain = $('#chain').value, sort = $('#sort').value;
  let rows = BOARD.rows.filter(r =>
    (!q || (r.name+' '+r.category+' '+r.chains.join(' ')).toLowerCase().includes(q)) &&
    (!cat || r.category === cat) && (!chain || r.chains.includes(chain)));
  const key = {value:'impliedValueUsd', tvl:'tvl', name:'name', rank:'rank'}[sort];
  rows = rows.slice().sort((a,b) => sort==='name' ? a.name.localeCompare(b.name) : (a[key] - b[key]) * (sort==='rank'?1:-1));
  const tb = $('#rows'); tb.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.slug === selected) tr.className = 'sel';
    const heat = r.impliedValueUsd > 1e9 ? 'hot' : r.impliedValueUsd > 1e8 ? 'warm' : '';
    tr.innerHTML = '<td>'+r.rank+'</td><td class="name">'+esc(r.name)+'</td><td><span class="pill">'+esc(r.category)+'</span></td><td>'+esc(r.chains.slice(0,3).join(', ')||'—')+'</td><td class="tvl">'+fmt(r.tvl)+'</td><td class="val '+heat+'">'+fmt(r.impliedValueUsd)+'</td>';
    tr.onclick = () => { selected = r.slug; render(); detail(r); };
    tb.appendChild(tr);
  }
  if (!rows.length) tb.innerHTML = '<tr><td colspan="6" class="empty">No protocols match the filter.</td></tr>';
}
function detail(r) {
  const d = $('#detail');
  d.innerHTML = '<h2>'+esc(r.name)+'</h2><div class="sub">Rank #'+r.rank+' · '+esc(r.category)+' · '+(r.chains.length?esc(r.chains.join(', ')):'chain unknown')+'</div>'+
    '<div class="kv"><div>Implied launch value</div><div class="val">'+fmt(r.impliedValueUsd)+'</div>'+
    '<div>TVL</div><div>'+fmt(r.tvl)+'</div>'+
    '<div>Category multiplier</div><div>'+r.categoryMultiplier+'×</div>'+
    '<div>Momentum multiplier</div><div>'+r.momentumMultiplier+'×</div>'+
    (r.url?'<div