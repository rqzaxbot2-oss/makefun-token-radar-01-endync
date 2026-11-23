import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

type AnyRec = Record<string, any>;

const OUT = process.env.MAKEFUN_OUTPUT_DIR || process.cwd();
const SNAP_CANDIDATES = [
  "snapshot.json",
  "data/snapshot.json",
  "vendor/snapshot.json",
  "vendor/makefun-board.ts",
  "input/snapshot.json",
  "protocols.json",
];

function findSnapshot(): AnyRec {
  for (const p of SNAP_CANDIDATES) {
    const full = join(process.cwd(), p);
    if (existsSync(full)) {
      const txt = readFileSync(full, "utf8");
      try {
        const j = JSON.parse(txt);
        return j;
      } catch {
        // vendor/makefun-board.ts may embed JSON; try extracting
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            return JSON.parse(m[0]);
          } catch {}
        }
      }
    }
  }
  // search shallowly for json files
  try {
    for (const f of readdirSync(process.cwd())) {
      if (f.endsWith(".json")) {
        try {
          const j = JSON.parse(readFileSync(join(process.cwd(), f), "utf8"));
          if (Array.isArray(j) || Array.isArray(j.protocols) || Array.isArray(j.data)) return j;
        } catch {}
      }
    }
  } catch {}
  return { protocols: [] };
}

function asArray(snap: AnyRec): AnyRec[] {
  if (Array.isArray(snap)) return snap;
  for (const k of ["protocols", "data", "rows", "items", "list"]) {
    if (Array.isArray(snap[k])) return snap[k];
  }
  // object keyed by protocol name
  const vals = Object.values(snap).filter((v) => v && typeof v === "object");
  if (vals.length && vals.every((v) => (v as AnyRec).name || (v as AnyRec).slug)) return vals as AnyRec[];
  return [];
}

const WRAPPED_RE = /\b(wrapped|staked|stake|restaked|restaking|liquid staking|liquid staked|bridged|lp token|receipt|voucher|w?steth|w?steth|wbeth|reth|cbeth|sfrxeth|weth|wbtc|wsteth|lsd|lst)\b/i;
const TOKEN_FIELDS = ["token", "tokens", "tokenSymbol", "symbol", "token_symbol", "hasToken", "gecko_id", "geckoid", "cmcId", "cmc_id", "tokenTicker", "ticker"];

function hasToken(p: AnyRec): boolean {
  for (const f of TOKEN_FIELDS) {
    const v = p[f];
    if (v == null) continue;
    if (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" && v.trim() !== "-") return true;
    if (typeof v === "boolean" && v) return true;
    if (Array.isArray(v) && v.length > 0) return true;
    if (typeof v === "object" && Object.keys(v).length > 0) return true;
  }
  // gecko/cmc nested
  if (p.gecko_id || p.geckoid || p.cmcId) return true;
  return false;
}

function isWrappedOrStaked(p: AnyRec): boolean {
  const name = String(p.name || p.slug || "");
  const cat = String(p.category || p.categories || "");
  const desc = String(p.description || "");
  const parent = String(p.parentProtocol || p.parent || p.forkedFrom || "");
  if (WRAPPED_RE.test(name)) return true;
  if (/\b(wrapped|staked|restaked|liquid staking|bridged)\b/i.test(cat)) return true;
  if (parent && parent.trim()) return true;
  if (/\b(wrapped|staked|receipt token|voucher)\b/i.test(desc)) return true;
  return false;
}

function num(v: any): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[$,]/g, ""));
    if (isFinite(n)) return n;
  }
  return 0;
}

function tvlOf(p: AnyRec): number {
  const cands = [p.tvl, p.tvlUsd, p.tvl_usd, p.totalTvl, p.totalTVL, p.currentChainTvls];
  for (const c of cands) {
    if (typeof c === "number") return c;
    if (c && typeof c === "object") {
      const s = Object.values(c).reduce((a: number, b: any) => a + num(b), 0);
      if (s > 0) return s;
    }
    if (typeof c === "string") {
      const n = num(c);
      if (n > 0) return n;
    }
  }
  // chainTvls
  if (p.chainTvls && typeof p.chainTvls === "object") {
    let s = 0;
    for (const v of Object.values(p.chainTvls)) {
      if (typeof v === "number") s += v;
      else if (v && typeof v === "object") for (const x of Object.values(v as AnyRec)) s += num(x);
    }
    return s;
  }
  return 0;
}

function revOf(p: AnyRec): number {
  const cands = [p.revenue, p.revenue24h, p.revenue_24h, p.fees24h, p.fees_24h, p.fees, p.annualizedFees, p.annualizedRevenue];
  for (const c of cands) {
    const n = num(c);
    if (n > 0) return n;
  }
  return 0;
}

function score(p: AnyRec): { value: number; parts: AnyRec } {
  const tvl = tvlOf(p);
  const rev = revOf(p);
  const chains = Array.isArray(p.chains) ? p.chains.length : num(p.chains) || 1;
  const ageDays = num(p.ageDays || p.age || 0);
  // implied FDV heuristic: TVL multiple + revenue multiple + chain breadth + maturity
  const tvlPart = Math.log10(1 + tvl) * 9;
  const revPart = Math.log10(1 + rev) * 12;
  const chainPart = Math.min(chains, 20) * 0.6;
  const maturity = ageDays > 0 ? Math.min(ageDays / 365, 3) * 1.5 : 1;
  const raw = tvlPart + revPart + chainPart + maturity;
  const value = Math.round(raw * 100) / 100;
  return { value, parts: { tvl, rev, chains, ageDays, tvlPart, revPart, chainPart, maturity } };
}

function farmPlan(p: AnyRec, value: number, parts: AnyRec): string[] {
  const steps: string[] = [];
  const name = String(p.name || p.slug || "protocol");
  const chains = Array.isArray(p.chains) ? p.chains.slice(0, 3) : [];
  steps.push(`Track ${name} on DefiLlama and its official docs/X for a token announcement or points program.`);
  if (chains.length) steps.push(`Bridge/position liquidity on ${chains.join(", ")} to interact with ${name} before any snapshot.`);
  else steps.push(`Position liquidity on the chain(s) ${name} runs on before any points snapshot.`);
  if (parts.tvl > 0) steps.push(`Provide liquidity or lend/borrow on ${name} (TVL ~$${Math.round(parts.tvl).toLocaleString()}) to earn exposure and potential airdrop weight.`);
  steps.push(`Check for a points/quest program; complete on-chain actions weekly and keep a wallet log.`);
  steps.push(`Watch for a governance forum or Snapshot vote that precedes a token launch; vote if eligible.`);
  if (value >= 15) steps.push(`High implied value (${value}): consider dedicated wallets and sustained volume, not one-off transactions.`);
  else steps.push(`Moderate implied value (${value}): farm with a small, diversified allocation.`);
  return steps;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "protocol";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function main() {
  const snap = findSnapshot();
  const all = asArray(snap);
  const rows: AnyRec[] = [];
  const seen = new Set<string>();
  for (const p of all) {
    if (!p || typeof p !== "object") continue;
    const name = String(p.name || p.slug || p.id || "");
    if (!name) continue;
    const slug = slugify(String(p.slug || name));
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (hasToken(p)) continue;
    if (isWrappedOrStaked(p)) continue;
    const { value, parts } = score(p);
    rows.push({
      rank: 0,
      slug,
      name,
      category: String(p.category || p.categories || "Unknown"),
      chains: Array.isArray(p.chains) ? p.chains : [],
      tvl: Math.round(parts.tvl),
      revenue: Math.round(parts.rev),
      impliedValue: value,
      scoreParts: parts,
      farmPlan: farmPlan(p, value, parts),
      url: `https://defillama.com/protocol/${encodeURIComponent(String(p.slug || name))}`,
    });
  }
  rows.sort((a, b) => b.impliedValue - a.impliedValue || b.tvl - a.tvl);
  rows.forEach((r, i) => (r.rank = i + 1));

  mkdirSync(OUT, { recursive: true });
  const board = {
    generatedAt: new Date().toISOString(),
    source: "DefiLlama sealed snapshot",
    totalProtocols: all.length,
    tokenlessCount: rows.length,
    rows,
  };
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));

  // dashboard
  const dash = join(OUT, "dashboard");
  mkdirSync(dash, { recursive: true });
  const rowsJson = JSON.stringify(rows);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#121a23;--line:#1f2b38;--txt:#e6edf3;--mut:#8b98a5;--acc:#3fb950;--hot:#f0883e}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
header{padding:18px 22px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}
h1{font-size:20px;margin:0}h1 span{color:var(--acc)}.sub{color:var(--mut);font-size:12px}
main{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:0;height:calc(100vh - 62px)}
#list{overflow:auto;border-right:1px solid var(--line)}
#detail{overflow:auto;padding:18px 22px}
.bar{position:sticky;top:0;background:var(--bg);padding:10px 14px;border-bottom:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap;z-index:2}
input,select{background:var(--panel);color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:7px 9px;font:inherit}
input{flex:1;min-width:120px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);font-size:13px}
th{color:var(--mut);font-weight:600;position:sticky;top:52px;background:var(--bg);z-index:1}
tr.row{cursor:pointer}tr.row:hover{background:#16202b}tr.sel{background:#1b2a38}
.rk{color:var(--mut);width:44px}.val{color:var(--hot);font-weight:700;text-align:right}
.tag{display:inline-block;background:#1b2a38;border-radius:4px;padding:1px 7px;font-size:11px;color:var(--mut);margin-right:4px}
h2{margin:0 0 4px;font-size:22px}.muted{color:var(--mut)}
.kv{display:grid;grid-template-columns:130px 1fr;gap:6px 12px;margin:14px 0}
.kv div:nth-child(odd){color:var(--mut)}
ol{padding-left:20px}ol li{margin:6px 0}
a{color:#58a6ff}
.pill{background:var(--acc);color:#04140a;border-radius:999px;padding:2px 10px;font-weight:700;font-size:12px}
</style></head><body>
<header><h1>Token Launch <span>Radar</span></h1><div class="sub" id="meta"></div></header>
<main>
<div id="list"><div class="bar">
<input id="q" placeholder="Search protocol, category, chain…" autocomplete="off">
<select id="cat"><option value="">All categories</option></select>
<select id="chain"><option value="">All chains</option></select>
<select id="sort"><option value="value">Sort: implied value</option><option value="tvl">Sort: TVL</option><option value="name">Sort: name</option></select>
</div>
<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th style="text-align:right">Implied</th></tr></thead><tbody id="tb"></tbody></table></div>
<div id="detail"><p class="muted">Select a protocol to see its detail view and farm plan.</p></div>
</main>
<script>
const ROWS=${rowsJson};
const $=s=>document.querySelector(s);
const cats=[...new Set(ROWS.map(r=>r.category))].sort();
const chains=[...new Set(ROWS.flatMap(r=>r.chains))].sort();
cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;$('#cat').append(o)});
chains.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;$('#chain').append(o)});
$('#meta').textContent=ROWS.length+' tokenless protocols ranked by implied launch value';
function fmt(n){return n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n)}
function filtered(){
  const q=$('#q').value.toLowerCase(),cat=$('#cat').value,ch=$('#chain').value,sort=$('#sort').value;
  let out=ROWS.filter(r=>{
    if(cat&&r.category!==cat)return false;
    if(ch&&!r.chains.includes(ch))return false;
    if(q){const hay=(r.name+' '+r.category+' '+r.chains.join(' ')).toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
  if(sort==='tvl')out.sort((a,b)=>b.tvl-a.tvl);else if(sort==='name')out.sort((a,b)=>a.name.localeCompare(b.name));else out.sort((a,b)=>b.impliedValue-a.impliedValue);
  return out;
}
function render(){
  const rows=filtered(),tb=$('#tb');tb.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');tr.className='row';tr.dataset.slug=r.slug;
    tr.innerHTML='<td class="rk">'+r.rank+'</td><td><strong>'+r.name+'</strong></td><td><span class="tag">'+r.category+'</span></td><td class="val">'+r.impliedValue.toFixed(1)+'</td>';
    tr.onclick=()=>{document.querySelectorAll('tr.sel').forEach(x=>x.classList.remove('sel'));tr.classList.add('sel');show(r)};
    tb.append(tr);
  });
  if(!rows.length)tb.innerHTML='<tr><td colspan="4" class="muted" style="padding:20px">No protocols match this filter.</td></tr>';
}
function show(r){
  const d=$('#detail');
  d.innerHTML='<h2>'+r.name+' <span class="pill">#'+r.rank+'</span></h2>'+
   '<div class="muted">'+r.category+' · '+r.chains.join(', ')+'</div>'+
   '<div class="kv">'+
   '<div>Implied value</div><div><strong style="color:var(--hot)">'+r.impliedValue.toFixed(2)+'</strong></div>'+
   '<div>TVL</div><div>$'+fmt(r.tvl)+'</div>'+
   '<div>Revenue / fees</div><div>$'+fmt(r.revenue)+'</div>'+
   '<div>Chains</div><div>'+r.chains.length+'</div>'+
   '<div>DefiLlama</div><div><a href="'+r.url+'" target="_blank" rel="noopener">'+r.url+'</a></div>'+
   '</div><h3>Farm plan</h3><ol>'+r.farmPlan.map(s=>'<li>'+s+'</li>').join('')+'</ol>';
}
['q','cat','chain','sort'].forEach(id=>$('#'+id).addEventListener('input',render));
render();
</script></body></html>`;
  writeFileSync(join(dash, "index.html"), html);

  // dossier
  const dossier = {
    format: "makefun-board/1",
    generatedAt: board.generatedAt,
    summary: {
      protocolsScanned: all.length,
      tokenless: rows.length,
      topImpliedValue: rows[0]?.impliedValue ?? 0,
      medianTvl: rows.length ? rows.map((r) => r.tvl).sort((a, b) => a - b)[Math.floor(rows.length / 2)] : 0,
    },
    methodology: {
      detection: "A protocol is tokenless when no token/symbol/gecko/cmc field is set, and it is not a wrapped, staked, restaked or bridged product (name, category, description or parentProtocol).",
      scoring: "impliedValue = 9*log10(1+TVL) + 12*log10(1+revenue) + 0.6*min(chains,20) + maturity(age).",
    },
    rows: rows.map((r) => ({ rank: r.rank, name: r.name, slug: r.slug, impliedValue: r.impliedValue, tvl: r.tvl, revenue: r.revenue, farmPlan: r.farmPlan })),
  };
  writeFileSync(join(OUT, "dossier.json"), JSON.stringify(dossier, null, 2));

  console.log(`Scanned ${all.length} protocols; ${rows.length} tokenless; top: ${rows[0]?.name ?? "none"} (${rows[0]?.impliedValue ?? 0})`);
}

main();