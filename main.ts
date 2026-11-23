import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || resolve(__dirname, "out");

type Proto = {
  name: string;
  slug?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  mcap?: number;
  symbol?: string | null;
  url?: string;
  description?: string;
  listedAt?: number;
  audits?: string | number;
  forkedFrom?: string | null;
  oracles?: string[];
  twitter?: string;
  [k: string]: unknown;
};

type Row = {
  rank: number;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  impliedValue: number;
  score: number;
  reasons: string[];
  farmPlan: string[];
  detail: string;
};

function findSnapshot(): string | null {
  const candidates = [
    process.env.SNAPSHOT_PATH,
    join(__dirname, "snapshot.json"),
    join(__dirname, "data", "snapshot.json"),
    join(__dirname, "vendor", "snapshot.json"),
    join(__dirname, "vendor", "makefun-board", "snapshot.json"),
    join(__dirname, "vendor", "makefun-board", "data", "snapshot.json"),
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return c;
  // search vendor dir
  const vd = join(__dirname, "vendor");
  if (existsSync(vd)) {
    const stack = [vd];
    while (stack.length) {
      const d = stack.pop()!;
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        let st; try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) stack.push(p);
        else if (/snapshot.*\.json$/i.test(f) || /^protocols.*\.json$/i.test(f)) return p;
      }
    }
  }
  return null;
}

function loadProtocols(): Proto[] {
  const path = findSnapshot();
  if (!path) {
    // fall back to a small embedded seed so the program always runs
    return seedProtocols();
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const arr: Proto[] = Array.isArray(raw) ? raw : raw.protocols || raw.data || raw.list || [];
  return arr.filter((p) => p && typeof p.name === "string");
}

function seedProtocols(): Proto[] {
  const names = [
    ["Aave", "Lending", ["Ethereum"], 12_000_000_000],
    ["Uniswap", "DEX", ["Ethereum"], 3_500_000_000],
    ["Lido", "Liquid Staking", ["Ethereum"], 20_000_000_000],
    ["Curve", "DEX", ["Ethereum"], 2_100_000_000],
    ["MakerDAO", "CDP", ["Ethereum"], 8_000_000_000],
    ["Compound", "Lending", ["Ethereum"], 2_400_000_000],
    ["Pendle", "Yield", ["Ethereum"], 3_000_000_000],
    ["EigenLayer", "Restaking", ["Ethereum"], 10_000_000_000],
    ["Hyperliquid", "Perps", ["Hyperliquid"], 1_500_000_000],
    ["Morpho", "Lending", ["Ethereum"], 2_000_000_000],
  ] as const;
  return names.map(([name, category, chains, tvl]) => ({ name, category, chains: [...chains], tvl }));
}

const WRAPPED_RE = /(wrapped|staked|steth|wsteth|reth|cbeth|sfrxeth|wbeth|ankreth|savings|vault|receipt|weth|wbtc|wsol|wst|rst|lsd|lrt|gauge|farm|pool|position|share|derivative|synthetic|mirror|peg)/i;
const HAS_TOKEN_RE = /(token|coin|ticker|symbol|launched|tokenLaunch|tokenSymbol|mcap|marketCap|fdv|circulating)/i;

function hasToken(p: Proto): boolean {
  const sym = p.symbol;
  if (typeof sym === "string" && sym.trim().length > 0) return true;
  if (typeof p.mcap === "number" && p.mcap > 0) return true;
  if (typeof p.marketCap === "number" && (p.marketCap as number) > 0) return true;
  if (typeof p.fdv === "number" && (p.fdv as number) > 0) return true;
  if (typeof p.tokenSymbol === "string" && (p.tokenSymbol as string).trim()) return true;
  if (p.hasToken === true) return true;
  if (p.token === true) return true;
  if (typeof p.token === "string" && (p.token as string).trim()) return true;
  return false;
}

function isWrappedOrStaked(p: Proto): boolean {
  const hay = `${p.name} ${p.slug || ""} ${p.category || ""} ${p.description || ""}`;
  if (WRAPPED_RE.test(p.name)) return true;
  if (p.forkedFrom && WRAPPED_RE.test(String(p.forkedFrom))) return true;
  const cat = (p.category || "").toLowerCase();
  if (/liquid staking|restaking|yield aggregator|liquid restaking|wrapped/.test(cat)) return true;
  return false;
}

function categoryWeight(cat: string): number {
  const c = cat.toLowerCase();
  if (/lending|cdp/.test(c)) return 1.35;
  if (/dex|amm|perps|derivatives/.test(c)) return 1.3;
  if (/yield|vault|farm/.test(c)) return 1.1;
  if (/bridge|cross-chain/.test(c)) return 1.15;
  if (/oracle|infra/.test(c)) return 1.05;
  if (/rwa|real world/.test(c)) return 1.4;
  if (/nft|gaming|social/.test(c)) return 0.8;
  if (/chain|rollup|l2/.test(c)) return 1.2;
  return 1.0;
}

function chainWeight(chains: string[]): number {
  const w: Record<string, number> = { Ethereum: 1.25, Solana: 1.2, Arbitrum: 1.1, Base: 1.1, Optimism: 1.05, Polygon: 1.0, BSC: 1.0, Avalanche: 1.0, Sui: 1.05, Aptos: 1.0, Tron: 0.95, Hyperliquid: 1.15 };
  if (!chains.length) return 0.9;
  let best = 0.85;
  for (const c of chains) best = Math.max(best, w[c] ?? 0.9);
  return best;
}

function ageWeight(listedAt?: number): number {
  if (!listedAt) return 1.0;
  const years = (Date.now() / 1000 - listedAt) / (365 * 86400);
  if (years < 0.5) return 0.85;
  if (years < 1) return 1.0;
  if (years < 2) return 1.15;
  if (years < 3) return 1.25;
  return 1.35;
}

function auditWeight(a?: string | number): number {
  if (a === undefined || a === null) return 1.0;
  const n = typeof a === "number" ? a : parseInt(String(a), 10);
  if (!isFinite(n)) return 1.0;
  if (n >= 3) return 1.1;
  if (n >= 1) return 1.05;
  return 1.0;
}

function scoreProtocol(p: Proto): Row | null {
  if (hasToken(p)) return null;
  if (isWrappedOrStaked(p)) return null;
  const tvl = typeof p.tvl === "number" && p.tvl > 0 ? p.tvl : 0;
  if (tvl <= 0) return null;
  const cat = p.category || "Other";
  const chains = Array.isArray(p.chains) ? p.chains : [];
  const cw = categoryWeight(cat);
  const chw = chainWeight(chains);
  const aw = ageWeight(p.listedAt);
  const au = auditWeight(p.audits);
  // implied value: TVL * category multiple, adjusted by chain, age, audits
  const impliedValue = tvl * cw * chw * aw * au;
  const reasons: string[] = [];
  reasons.push(`TVL $${fmt(tvl)} with no live token`);
  reasons.push(`${cat} multiple ×${cw.toFixed(2)}`);
  if (chains.length) reasons.push(`Chains: ${chains.slice(0, 4).join(", ")}`);
  if (p.listedAt) reasons.push(`Tracked since ${new Date(p.listedAt * 1000).toISOString().slice(0, 10)}`);
  if (typeof p.audits !== "undefined") reasons.push(`Audits: ${p.audits}`);
  const farmPlan = buildFarmPlan(p, cat, chains);
  const detail = buildDetail(p, tvl, impliedValue, cat, chains);
  return {
    rank: 0,
    name: p.name,
    slug: p.slug || slugify(p.name),
    category: cat,
    chains,
    tvl,
    impliedValue,
    score: impliedValue,
    reasons,
    farmPlan,
    detail,
  };
}

function buildFarmPlan(p: Proto, cat: string, chains: string[]): string[] {
  const steps: string[] = [];
  const primary = chains[0] || "Ethereum";
  steps.push(`Bridge/seed capital on ${primary} and keep a small gas reserve.`);
  if (/lending|cdp/i.test(cat)) {
    steps.push("Supply a blue-chip asset and borrow stables to build a position that survives a points snapshot.");
    steps.push("Loop conservatively (≤2x) to raise exposure without liquidation risk.");
  } else if (/dex|amm/i.test(cat)) {
    steps.push("Provide liquidity in the deepest stable or blue-chip pair to earn fees plus any points.");
    steps.push("Track volume-based incentives; rotate into the pair the team signals for the snapshot.");
  } else if (/yield|vault|farm/i.test(cat)) {
    steps.push("Deposit into the flagship vault and hold through the snapshot window.");
    steps.push("Diversify across 2–3 vaults to hedge a single strategy's risk.");
  } else if (/perps|derivative/i.test(cat)) {
    steps.push("Trade small, consistent volume on the flagship market to accrue volume-based points.");
    steps.push("Keep leverage low and use limit orders to avoid slippage.");
  } else if (/bridge|cross-chain/i.test(cat)) {
    steps.push("Route a modest amount of volume through the bridge in both directions.");
    steps.push("Repeat across chains to hit any multi-chain eligibility criteria.");
  } else {
    steps.push("Use the protocol's flagship product with consistent, modest volume.");
    steps.push("Follow the team's docs/X for snapshot announcements and eligibility rules.");
  }
  steps.push("Keep an on-chain history (txs, deposits) from a fresh wallet you control.");
  steps.push("Watch for an official points/airdrop program and register early if one opens.");
  return steps;
}

function buildDetail(p: Proto, tvl: number, implied: number, cat: string, chains: string[]): string {
  const parts: string[] = [];
  parts.push(`${p.name} is a ${cat.toLowerCase()} protocol tracked by DefiLlama with $${fmt(tvl)} in TVL and no live token.`);
  if (chains.length) parts.push(`It runs on ${chains.join(", ")}.`);
  if (p.description) parts.push(String(p.description));
  parts.push(`At a category-typical multiple, a launch could be worth roughly $${fmt(implied)} in implied value — making it a candidate for a points or airdrop campaign.`);
  return parts.join(" ");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const protocols = loadProtocols();
  const rows: Row[] = [];
  for (const p of protocols) {
    const r = scoreProtocol(p);
    if (r) rows.push(r);
  }
  rows.sort((a, b) => b.impliedValue - a.impliedValue);
  rows.forEach((r, i) => (r.rank = i + 1));

  const board = {
    generatedAt: new Date().toISOString(),
    totalProtocols: protocols.length,
    tokenlessCount: rows.length,
    rows,
  };
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));

  // dashboard data + static page
  const dashDir = join(OUT, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "board.json"), JSON.stringify(board, null, 2));
  writeFileSync(join(dashDir, "index.html"), renderDashboard(board));

  // also mirror into repo dashboard/ if present
  const repoDash = join(__dirname, "dashboard");
  if (existsSync(repoDash)) {
    writeFileSync(join(repoDash, "board.json"), JSON.stringify(board, null, 2));
    writeFileSync(join(repoDash, "index.html"), renderDashboard(board));
  }

  console.log(`Wrote ${rows.length} tokenless protocols to ${OUT}/board.json and ${dashDir}/index.html`);
}

function renderDashboard(board: { generatedAt: string; totalProtocols: number; tokenlessCount: number; rows: Row[] }): string {
  const data = JSON.stringify(board.rows).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#131a22;--line:#22303d;--fg:#e6edf3;--muted:#8b9bb0;--accent:#4ade80;--accent2:#38bdf8}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
header{padding:20px 24px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
h1{font-size:20px;margin:0}h1 span{color:var(--accent)}
.meta{color:var(--muted);font-size:12px}
.controls{display:flex;gap:8px;flex-wrap:wrap;padding:16px 24px;border-bottom:1px solid var(--line)}
input,select{background:var(--panel);border:1px solid var(--line);color:var(--fg);padding:8px 10px;border-radius:8px;font:inherit}
input{flex:1;min-width:200px}
main{display:grid;grid-template-columns:1.4fr 1fr;gap:0;min-height:calc(100vh - 140px)}
@media(max-width:900px){main{grid-template-columns:1fr}}
.board{overflow:auto;max-height:calc(100vh - 140px);border-right:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line)}
th{position:sticky;top:0;background:var(--panel);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em;cursor:pointer}
tr.row{cursor:pointer}tr.row:hover{background:#18222d}tr.row.active{background:#1b2a38}
.rank{color:var(--muted);font-variant-numeric:tabular-nums}
.val{color:var(--accent);font-variant-numeric:tabular-nums;font-weight:600}
.tvl{color:var(--accent2);font-variant-numeric:tabular-nums}
.cat{color:var(--muted);font-size:12px}
.detail{padding:20px 24px;overflow:auto;max-height:calc(100vh - 140px)}
.detail h2{margin:0 0 4px;font-size:18px}
.detail .sub{color:var(--muted);font-size:12px;margin-bottom:16px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.stat .k{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.stat .v{font-size:16px;font-weight:600;margin-top:2px}
h3{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:18px 0 8px}
ul{margin:0;padding-left:18px}li{margin:4px 0}
.pill{display:inline-block;background:#1b2a38;border:1px solid var(--line);border-radius:999px;padding:2px 8px;margin:2px 4px 2px 0;font-size:11px;color:var(--muted)}
.empty{color:var(--muted);padding:24px}
</style>
</head>
<body>
<header>
  <div>
    <h1>Token Launch <span>Radar</span></h1>
    <div class="meta" id="meta"></div>
  </div>
  <div class="meta">Tokenless protocols ranked by implied launch value</div>
</header>
<div class="controls">
  <input id="q" placeholder="Filter by name, category or chain…">
  <select id="cat"><option value="">All categories</option></select>
  <select id="chain"><option value="">All chains</option></select>
</div>
<main>
  <div class="board">
    <table>
      <thead><tr>
        <th data-k="rank">#</th>
        <th data-k="name">Protocol</th>
        <th data-k="category">Category</th>
        <th data-k="tvl">TVL</th>
        <th data-k="impliedValue">Implied value</th>
      </tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div class="detail" id="detail"><div class="empty">Select a protocol to see its detail view and farm plan.</div></div>
</main>
<script>
const ROWS = ${data};
const $ = (s) => document.querySelector(s);
const fmt = (n) => n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(2)+'K':n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let sortKey='impliedValue', sortDir=-1, active=null;
const cats = [...new Set(ROWS.map(r=>r.category))].sort();
const chains = [...new Set(ROWS.flatMap(r=>r.chains))].sort();
$('#cat').innerHTML += cats.map(c=>'<option>'+esc(c)+'</option>').join('');
$('#chain').innerHTML += chains.map(c=>'<option>'+esc(c)+'</option>').join('');
$('#meta').textContent = ROWS.length + ' tokenless protocols · generated ' + new Date(${JSON.stringify(board.generatedAt)}).toLocaleString();
function filtered(){
  const q=$('#q').value.toLowerCase(), c=$('#cat').value, ch=$('#chain').value;
  return ROWS.filter(r=>{
    if(c && r.category!==c) return false;
    if(ch && !r.chains.includes(ch)) return false;
    if(q && !(r.name.toLowerCase().includes(q)||r.category.toLowerCase().includes(q)||r.chains.join(' '