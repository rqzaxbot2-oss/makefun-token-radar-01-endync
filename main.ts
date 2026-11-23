import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// ---------- types ----------
type Proto = {
  name: string;
  slug?: string;
  symbol?: string;
  category?: string;
  chains?: string[];
  tvl?: number;
  mcap?: number;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
  url?: string;
  description?: string;
  listedAt?: number;
  audits?: string | number;
  twitter?: string;
  parentProtocol?: string;
};

type Row = {
  rank: number;
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  impliedValue: number;
  launchScore: number;
  reason: string;
  farmPlan: string[];
  url: string;
};

// ---------- helpers ----------
const OUT = process.env.MAKEFUN_OUTPUT_DIR || resolve(".");
const ROOT = process.cwd();

function readJSON(p: string): any {
  return JSON.parse(readFileSync(p, "utf8"));
}

function findSnapshot(): any {
  const candidates = [
    join(ROOT, "snapshot.json"),
    join(ROOT, "data", "snapshot.json"),
    join(ROOT, "vendor", "snapshot.json"),
    join(ROOT, "protocols.json"),
    join(ROOT, "data", "protocols.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return readJSON(c);
  // scan for any json with a protocols/list array
  const walk = (dir: string, depth = 0): string | null => {
    if (depth > 3) return null;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return null; }
    for (const e of entries) {
      if (e.startsWith(".") || e === "node_modules" || e === "dashboard" || e === "screenshots") continue;
      const p = join(dir, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { const r = walk(p, depth + 1); if (r) return r; }
      else if (e.endsWith(".json") && st.size > 1000) {
        try {
          const j = readJSON(p);
          const arr = Array.isArray(j) ? j : j.protocols || j.data || j.list;
          if (Array.isArray(arr) && arr.length > 20 && arr[0] && (arr[0].tvl !== undefined || arr[0].name)) return p;
        } catch {}
      }
    }
    return null;
  };
  const found = walk(ROOT);
  if (found) return readJSON(found);
  throw new Error("no snapshot found");
}

function normList(j: any): Proto[] {
  const arr = Array.isArray(j) ? j : j.protocols || j.data || j.list || [];
  return arr.map((p: any) => ({
    name: String(p.name || p.slug || ""),
    slug: p.slug || String(p.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    symbol: p.symbol,
    category: p.category || "Uncategorized",
    chains: Array.isArray(p.chains) ? p.chains : p.chain ? [p.chain] : [],
    tvl: Number(p.tvl ?? p.tvlUsd ?? 0),
    mcap: Number(p.mcap ?? p.marketCap ?? 0),
    change_1d: Number(p.change_1d ?? p.change1d ?? 0),
    change_7d: Number(p.change_7d ?? p.change7d ?? 0),
    change_1m: Number(p.change_1m ?? p.change1m ?? 0),
    url: p.url || "",
    description: p.description || "",
    listedAt: Number(p.listedAt || 0),
    audits: p.audits,
    twitter: p.twitter,
    parentProtocol: p.parentProtocol,
  }));
}

// wrapped / staked detection
const WRAPPED_RE = /(^|\b)(wrapped|staked|stake|restaked|restaking|liquid staking|liquid restaking|bridged|vault|receipt|weth|wbtc|wsol|wsteth|reth|cbeth|sfrxeth|ankreth|stmatic|savax|wavax|wbnb|wftm|wmatic|wpol|wxdai|wglmr|wkava|wcro|wone|wmovr|wmetis|wcelo|wklay|wfil|wop|warb|wusdc|wusdt|weth|wbtc|steth|stsol|jitosol|msol|bsol|bnsol|susd|susds|susde|stusd|sfrxeth|ezeth|weeth|rseth|wstusd|usdy|usde|susde|sdeusd|susdg|wusdm|sfrax|sfrxusd|frxeth|sfrxeth|meth|sweth|reth|wbeth|tbtc|wstbtc|stbtc|sbtc|wsteth|steth|wstksc|wstusd|wstksc|wstksc|wsom|wsei|wcore|wiota|wzkl|wrose|wklay|wemix|wbnb|wcro|wftm|wavax|wmovr|wone|wglmr|wcelo|wkava|wpol|wmatic|wxdai|warb|wop|wfil|wmetis|wbnb|weth|wbtc|wsol|wusdc|wusdt|wusdc\.e|weth\.e|wbtc\.e|wavax|wbnb|wftm|wmatic|wxdai|wglmr|wkava|wcro|wone|wmovr|wmetis|wcelo|wklay|wfil|wop|warb|wzkl|wrose|wsei|wcore|wiota|wsom|wemix|wzkl|wrose)/i;
const STAKED_RE = /(staked|staking|restak|restaked|liquid|vault|receipt|wrapped|weth|wbtc|wsteth|steth|reth|cbeth|sfrxeth|ankreth|stmatic|savax|wavax|wbnb|wftm|wmatic|wpol|wxdai|wglmr|wkava|wcro|wone|wmovr|wmetis|wcelo|wklay|wfil|wop|warb|wusdc|wusdt|weth|wbtc|steth|stsol|jitosol|msol|bsol|bnsol|susd|susds|susde|stusd|sfrxeth|ezeth|weeth|rseth|wstusd|usdy|usde|susde|sdeusd|susdg|wusdm|sfrax|sfrxusd|frxeth|sfrxeth|meth|sweth|reth|wbeth|tbtc|wstbtc|stbtc|sbtc|wsteth|steth|wstksc|wstusd|wstksc|wstksc|wsom|wsei|wcore|wiota|wzkl|wrose|wklay|wemix|wbnb|wcro|wftm|wavax|wmovr|wone|wglmr|wcelo|wkava|wpol|wmatic|wxdai|warb|wop|wfil|wmetis|wbnb|weth|wbtc|wsol|wusdc|wusdt|wusdc\.e|weth\.e|wbtc\.e|wavax|wbnb|wftm|wmatic|wxdai|wglmr|wkava|wcro|wone|wmovr|wmetis|wcelo|wklay|wfil|wop|warb|wzkl|wrose|wsei|wcore|wiota|wsom|wemix|wzkl|wrose)/i;

function isWrappedOrStaked(p: Proto): boolean {
  const n = p.name.toLowerCase();
  const s = (p.symbol || "").toLowerCase();
  if (WRAPPED_RE.test(n) || STAKED_RE.test(n)) return true;
  if (s && (WRAPPED_RE.test(s) || STAKED_RE.test(s))) return true;
  if (p.parentProtocol) return true;
  return false;
}

function hasToken(p: Proto): boolean {
  // DefiLlama: protocols with a token usually have mcap>0 or symbol set
  if (p.mcap && p.mcap > 0) return true;
  if (p.symbol && p.symbol.trim().length > 0) return true;
  return false;
}

function impliedValue(p: Proto): number {
  // rough: TVL * category multiple, adjusted for momentum
  const tvl = Math.max(0, p.tvl || 0);
  const cat = (p.category || "").toLowerCase();
  let mult = 0.5;
  if (cat.includes("dex")) mult = 0.9;
  else if (cat.includes("lending")) mult = 0.8;
  else if (cat.includes("liquid staking")) mult = 1.1;
  else if (cat.includes("bridge")) mult = 0.6;
  else if (cat.includes("yield")) mult = 0.5;
  else if (cat.includes("perpetual") || cat.includes("derivative")) mult = 1.0;
  else if (cat.includes("cdp")) mult = 0.7;
  else if (cat.includes("rwa")) mult = 1.2;
  else if (cat.includes("restaking")) mult = 1.3;
  else if (cat.includes("oracle")) mult = 0.4;
  const mom = 1 + Math.max(-0.3, Math.min(0.5, (p.change_7d || 0) / 100));
  return Math.round(tvl * mult * mom);
}

function launchScore(p: Proto, implied: number): number {
  const tvl = Math.max(0, p.tvl || 0);
  const age = p.listedAt ? Math.max(0, (Date.now() / 1000 - p.listedAt) / 86400) : 365;
  const ageBoost = age > 180 ? 1.15 : age > 90 ? 1.05 : 1.0;
  const mom = 1 + Math.max(-0.2, Math.min(0.4, (p.change_1m || 0) / 200));
  const chains = (p.chains || []).length;
  const chainBoost = 1 + Math.min(0.2, chains * 0.03);
  return Math.round(implied * ageBoost * mom * chainBoost);
}

function farmPlan(p: Proto, implied: number): string[] {
  const cat = (p.category || "").toLowerCase();
  const plan: string[] = [];
  plan.push(`Track ${p.name} on DefiLlama and its official channels for a token announcement or points program.`);
  if (cat.includes("dex") || cat.includes("perpetual")) {
    plan.push("Provide liquidity to the main pool and trade weekly to build volume for a potential airdrop.");
  } else if (cat.includes("lending") || cat.includes("cdp")) {
    plan.push("Supply and borrow against collateral to accumulate usage; keep positions healthy.");
  } else if (cat.includes("liquid staking") || cat.includes("restaking")) {
    plan.push("Stake native assets through the protocol and hold the receipt token to earn points.");
  } else if (cat.includes("bridge")) {
    plan.push("Bridge assets across supported chains and return to build cross-chain volume.");
  } else if (cat.includes("yield") || cat.includes("vault")) {
    plan.push("Deposit into the flagship vaults and compound rewards regularly.");
  } else {
    plan.push("Use the protocol's core product weekly and keep a wallet history of genuine activity.");
  }
  plan.push(`Estimated launch value ~$${implied.toLocaleString()} based on TVL and category multiples.`);
  if (implied > 50_000_000) plan.push("High-value candidate: prioritize early, sustained usage and governance participation.");
  else if (implied > 10_000_000) plan.push("Mid-tier candidate: worth steady farming with a dedicated wallet.");
  else plan.push("Lower implied value: farm opportunistically alongside higher-ranked protocols.");
  return plan;
}

// ---------- build ----------
function build() {
  const raw = findSnapshot();
  const protos = normList(raw);
  const untok = protos.filter((p) => !hasToken(p) && !isWrappedOrStaked(p) && (p.tvl || 0) > 0);

  const rows: Row[] = untok
    .map((p) => {
      const implied = impliedValue(p);
      return {
        rank: 0,
        name: p.name,
        slug: p.slug || "",
        category: p.category || "Uncategorized",
        chains: p.chains || [],
        tvl: Math.round(p.tvl || 0),
        impliedValue: implied,
        launchScore: launchScore(p, implied),
        reason: `${p.name} records no token and is not a wrapped/staked derivative; TVL $${Math.round(p.tvl || 0).toLocaleString()} in ${p.category}.`,
        farmPlan: farmPlan(p, implied),
        url: p.url || `https://defillama.com/protocol/${p.slug}`,
      };
    })
    .sort((a, b) => b.launchScore - a.launchScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const board = {
    generatedAt: new Date().toISOString(),
    totalProtocols: protos.length,
    untokenized: rows.length,
    rows,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));

  // dashboard
  const dashDir = join(OUT, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "index.html"), renderDashboard(board));
  writeFileSync(join(dashDir, "board.json"), JSON.stringify(board));

  // copy vendor board if present
  const vendorSrc = join(ROOT, "vendor", "makefun-board.ts");
  if (existsSync(vendorSrc)) {
    mkdirSync(join(OUT, "vendor"), { recursive: true });
    writeFileSync(join(OUT, "vendor", "makefun-board.ts"), readFileSync(vendorSrc));
  }

  console.log(`wrote board.json with ${rows.length} rows to ${OUT}`);
}

function renderDashboard(board: any): string {
  const data = JSON.stringify(board);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#121821;--line:#1f2a37;--txt:#e6edf3;--mut:#8b98a5;--acc:#3fb950;--hot:#f0883e}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
header{padding:18px 24px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0}h1 span{color:var(--acc)}
.stat{color:var(--mut);font-size:12px}.stat b{color:var(--txt)}
main{display:grid;grid-template-columns:1fr 420px;gap:0;height:calc(100vh - 64px)}
#list{overflow:auto;padding:12px 24px}
#detail{overflow:auto;border-left:1px solid var(--line);padding:18px;background:var(--panel)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);font-size:13px}
th{color:var(--mut);font-weight:600;position:sticky;top:0;background:var(--bg);cursor:pointer}
tr.row{cursor:pointer}tr.row:hover{background:#161d27}tr.sel{background:#1a2433}
.rank{color:var(--mut);width:44px}.name{font-weight:600}.cat{color:var(--mut);font-size:12px}
.val{color:var(--acc);font-variant-numeric:tabular-nums}.tvl{color:var(--mut);font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:1px 7px;border-radius:10px;background:#1f2a37;color:var(--mut);font-size:11px;margin-left:6px}
input,select{background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:7px 10px;border-radius:6px;font-size:13px}
.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
h2{margin:0 0 4px;font-size:20px}.sub{color:var(--mut);font-size:12px;margin-bottom:14px}
.kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13px;margin-bottom:16px}
.kv div:nth-child(odd){color:var(--mut)}
ol{padding-left:18px}ol li{margin-bottom:6px}
.pill{display:inline-block;background:#16202c;border:1px solid var(--line);border-radius:6px;padding:2px 8px;margin:2px;font-size:11px;color:var(--mut)}
a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}
.empty{color:var(--mut);padding:40px;text-align:center}
@media(max-width:900px){main{grid-template-columns:1fr}#detail{border-left:none;border-top:1px solid var(--line)}}
</style></head><body>
<header><h1>Token <span>Launch Radar</span></h1>
<div class="stat">protocols <b id="s1"></b></div>
<div class="stat">untokenized <b id="s2"></b></div>
<div class="stat">generated <b id="s3"></b></div></header>
<main><section id="list">
<div class="filters">
<input id="q" placeholder="search name / category / chain" style="flex:1;min-width:180px">
<select id="cat"><option value="">all categories</option></select>
<select id="sort">
<option value="launchScore">sort: launch score</option>
<option value="impliedValue">sort: implied value</option>
<option value="tvl">sort: TVL</option>
<option value="name">sort: name</option>
</select>
</div>
<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>TVL</th><th>Implied value</th><th>Score</th></tr></thead>
<tbody id="tbody"></tbody></table>
</section>
<section id="detail"><div class="empty">Select a protocol to see its launch case and farm plan.</div></section>
</main>
<script>
const BOARD=${data};
const rows=BOARD.rows;
document.getElementById('s1').textContent=BOARD.totalProtocols;
document.getElementById('s2').textContent=BOARD.untokenized;
document.getElementById('s3').textContent=new Date(BOARD.generatedAt).toLocaleString();
const cats=[...new Set(rows.map(r=>r.category))].sort();
const catSel=document.getElementById('cat');
cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;catSel.appendChild(o)});
const fmt=n=>'$'+Math.round(n).toLocaleString();
let state={q:'',cat:'',sort:'launchScore',sel:null};
function filtered(){
  let r=rows.filter(x=>{
    if(state.cat&&x.category!==state.cat)return false;
    if(state.q){const q=state.q.toLowerCase();const hay=(x.name+' '+x.category+' '+x.chains.join(' ')).toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
  const s=state.sort;
  r=r.slice().sort((a,b)=>s==='name'?a.name.localeCompare(b.name):(b[s]-a[s]));
  return r;
}
function renderList(){
  const r=filtered();const tb=document.getElementById('tbody');tb.innerHTML='';
  if(!r.length){tb.innerHTML='<tr><td colspan="6" class="empty">No protocols match.</td></tr>';return}
  r.forEach(x=>{
    const tr=document.createElement('tr');tr.className='row'+(state.sel===x.slug?' sel':'');
    tr.innerHTML='<td class="rank">