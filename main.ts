import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || resolve(__dirname, "out");
mkdirSync(OUT, { recursive: true });

type Proto = {
  name: string;
  slug: string;
  category: string;
  chains: string[];
  tvl: number;
  mcap: number;
  twitter?: string;
  url?: string;
  description: string;
  listedAt: number;
  audits?: unknown;
  [k: string]: unknown;
};

type Class = "no-token" | "has-token" | "wrapped-staked";

function num(x: unknown): number {
  if (x == null) return 0;
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (typeof x === "boolean") return x ? 1 : 0;
  const n = parseFloat(String(x).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.length > 0) as string[];
  if (typeof v === "string" && v.length > 0) return [v];
  return [];
}

function findSnapshot(): { path: string; data: unknown } {
  const candidates: string[] = [];
  const envPath = process.env.MAKEFUN_SNAPSHOT || process.env.SNAPSHOT_PATH;
  if (envPath) candidates.push(envPath);
  const roots = [
    process.cwd(),
    __dirname,
    join(__dirname, ".."),
    join(__dirname, "data"),
    join(__dirname, "snapshot"),
    join(process.cwd(), "data"),
  ];
  const seen = new Set<string>();
  for (const r of roots) {
    if (seen.has(r)) continue;
    seen.add(r);
    let entries: string[];
    try {
      if (!existsSync(r) || !statSync(r).isDirectory()) continue;
      entries = readdirSync(r);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (/snapshot|protocols|defillama|llama/i.test(f) && /\.json$/i.test(f)) {
        candidates.push(join(r, f));
      }
    }
  }
  const errors: string[] = [];
  for (const c of candidates) {
    try {
      const raw = readFileSync(c, "utf8");
      const data = JSON.parse(raw);
      return { path: c, data };
    } catch (e) {
      errors.push(`${c}: ${(e as Error).message}`);
    }
  }
  const detail = errors.length ? ` Tried:\n${errors.join("\n")}` : "";
  throw new Error(`No snapshot JSON found. Set MAKEFUN_SNAPSHOT.${detail}`);
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.protocols)) return o.protocols;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function normalize(data: unknown): Proto[] {
  const arr = extractArray(data);
  const out: Proto[] = [];
  const seenSlugs = new Set<string>();
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, any>;
    const name = String(p.name ?? p.slug ?? "").trim();
    if (!name) continue;
    let slug = typeof p.slug === "string" && p.slug ? slugify(p.slug) : slugify(name);
    if (seenSlugs.has(slug)) {
      let i = 2;
      while (seenSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    seenSlugs.add(slug);
    const chains = asStringArray(p.chains ?? p.chain);
    const category =
      typeof p.category === "string" && p.category
        ? p.category
        : Array.isArray(p.categories) && typeof p.categories[0] === "string"
          ? p.categories[0]
          : "Other";
    const twitter =
      typeof p.twitter === "string" ? p.twitter : typeof p.twitterHandle === "string" ? p.twitterHandle : undefined;
    const url = typeof p.url === "string" ? p.url : typeof p.website === "string" ? p.website : undefined;
    out.push({
      ...p,
      name,
      slug,
      category,
      chains,
      tvl: num(p.tvl ?? p.tvlUsd ?? p.tvl_usd ?? p.tvlUSD ?? p.tvlTotal),
      mcap: num(p.mcap ?? p.marketCap ?? p.market_cap ?? p.fdv ?? p.mcapp),
      twitter,
      url,
      description: typeof p.description === "string" ? p.description : "",
      listedAt: num(p.listedAt ?? p.listed_at),
      audits: p.audits ?? p.audit_links,
    });
  }
  return out;
}

// ---- classification ----
const WRAPPED_RE =
  /(wrapped|staked|restaked|liquid stak|\blsd\b|\blrt\b|receipt|bridged|wormhole|portal|canonical|derivative)/i;
const HAS_TOKEN_HINTS = /(token|coin|ticker|symbol|gecko_?id|tokenAddress)/i;

function hasToken(p: Proto): boolean {
  for (const k of Object.keys(p)) {
    if (!HAS_TOKEN_HINTS.test(k)) continue;
    const v = (p as Record<string, unknown>)[k];
    if (v == null || v === "" || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return p.mcap > 0;
}

function isWrappedOrStaked(p: Proto): boolean {
  if (WRAPPED_RE.test(p.name)) return true;
  const desc = p.description.toLowerCase();
  return /\b(wrapped|staked|restaked|liquid staking|receipt token|derivative of)\b/.test(desc);
}

function classify(p: Proto): Class {
  if (hasToken(p)) return "has-token";
  if (isWrappedOrStaked(p)) return "wrapped-staked";
  return "no-token";
}

// ---- implied value ----
function categoryMultiplier(cat: string): number {
  const c = cat.toLowerCase();
  if (/dex|exchange|amm/.test(c)) return 1.35;
  if (/lending|cdp/.test(c)) return 1.3;
  if (/perp|derivative|options/.test(c)) return 1.45;
  if (/yield|farm|vault/.test(c)) return 1.1;
  if (/bridge|cross-chain|interoperab/.test(c)) return 1.15;
  if (/rwa|real world/.test(c)) return 1.5;
  if (/liquid staking|lsd|restaking/.test(c)) return 1.25;
  if (/launchpad|incubator/.test(c)) return 1.2;
  if (/nft|gaming|metaverse/.test(c)) return 0.85;
  if (/insurance/.test(c)) return 0.9;
  if (/oracle/.test(c)) return 1.2;
  return 1.0;
}

function impliedValue(p: Proto): { value: number; breakdown: Record<string, number> } {
  const tvl = Math.max(0, p.tvl);
  const base = tvl * 0.35;
  const catMult = categoryMultiplier(p.category);
  const chainBonus = 1 + Math.min(0.4, Math.max(1, p.chains.length) * 0.05);
  const ageDays = p.listedAt > 0 ? Math.max(0, (Date.now() / 1000 - p.listedAt) / 86400) : 0;
  const maturity = ageDays > 0 ? Math.min(1.25, 0.8 + Math.log10(1 + ageDays) * 0.15) : 1.0;
  const auditBonus = p.audits ? 1.1 : 1.0;
  const socialBonus = p.twitter ? 1.05 : 1.0;
  const value = base * catMult * chainBonus * maturity * auditBonus * socialBonus;
  return {
    value: Math.round(value),
    breakdown: {
      base: Math.round(base),
      catMult,
      chainBonus,
      maturity,
      auditBonus,
      socialBonus,
    },
  };
}

function farmPlan(p: Proto, value: number): string[] {
  const steps: string[] = [];
  const cat = p.category.toLowerCase();
  if (p.url) steps.push(`Open ${p.url} and connect a fresh wallet.`);
  else steps.push(`Find ${p.name} on ${p.chains[0] || "its main chain"} and connect a fresh wallet.`);
  if (/dex|exchange|amm/.test(cat)) steps.push("Provide liquidity to a blue-chip pair, then trade small volumes weekly.");
  else if (/lending|cdp/.test(cat)) steps.push("Supply a stablecoin, borrow a little, and repay to build usage history.");
  else if (/perp|derivative|options/.test(cat)) steps.push("Open and close a small perp/option position weekly to qualify.");
  else if (/bridge|cross-chain|interoperab/.test(cat)) steps.push("Bridge a small amount back and forth across supported chains.");
  else if (/liquid staking|lsd|restaking/.test(cat)) steps.push("Stake a small amount and hold the receipt token.");
  else if (/yield|farm|vault/.test(cat)) steps.push("Deposit into a conservative vault and compound weekly.");
  else if (/rwa|real world/.test(cat)) steps.push("Complete KYC if offered and hold a small position.");
  else steps.push("Use the protocol's core action weekly with small amounts.");
  if (p.twitter) {
    steps.push(`Follow @${p.twitter.replace(/^@/, "")} and join the Discord/Telegram for early announcements.`);
  }
  steps.push(
    `Track TVL (currently $${Math.round(p.tvl).toLocaleString()}) — a token launch is often hinted when TVL grows past $${Math.round(p.tvl * 1.5).toLocaleString()}.`,
  );
  steps.push(`Estimated launch value: ~$${value.toLocaleString()}.`);
  return steps;
}

// ---- main ----
function main() {
  const { path, data } = findSnapshot();
  const protos = normalize(data);
  if (protos.length === 0) {
    throw new Error(`Snapshot at ${path} contained no protocols.`);
  }

  const rows: any[] = [];
  const counts = { "no-token": 0, "has-token": 0, "wrapped-staked": 0 } as Record<Class, number>;
  for (const p of protos) {
    const cls = classify(p);
    counts[cls]++;
    const iv = impliedValue(p);
    rows.push({
      name: p.name,
      slug: p.slug,
      category: p.category,
      chains: p.chains,
      tvl: p.tvl,
      mcap: p.mcap,
      class: cls,
      impliedValue: iv.value,
      breakdown: iv.breakdown,
      farmPlan: cls === "no-token" ? farmPlan(p, iv.value) : [],
      url: p.url,
      twitter: p.twitter,
      description: p.description,
    });
  }

  const watchlist = rows
    .filter((r) => r.class === "no-token")
    .sort((a, b) => b.impliedValue - a.impliedValue || a.name.localeCompare(b.name));

  const generatedAt = new Date().toISOString();
  const board = {
    generatedAt,
    source: path,
    totalProtocols: rows.length,
    watchlistCount: watchlist.length,
    rows: watchlist,
  };
  writeFileSync(join(OUT, "board.json"), JSON.stringify(board, null, 2));

  const dossier = {
    generatedAt,
    source: path,
    totals: {
      protocols: rows.length,
      noToken: counts["no-token"],
      hasToken: counts["has-token"],
      wrappedStaked: counts["wrapped-staked"],
    },
    top: watchlist.slice(0, 25).map((r) => ({
      name: r.name,
      impliedValue: r.impliedValue,
      tvl: r.tvl,
      category: r.category,
    })),
    methodology: {
      value: "0.35 * TVL * category multiplier * chain bonus * maturity * audit bonus * social bonus",
      classification:
        "has-token if token hints present; else wrapped-staked if name/desc matches wrapped/staked patterns; else no-token",
    },
  };
  writeFileSync(join(OUT, "dossier.json"), JSON.stringify(dossier, null, 2));

  const dash = { generatedAt, rows: watchlist, all: rows };
  writeFileSync(join(OUT, "dashboard-data.json"), JSON.stringify(dash));

  const dashDir = join(OUT, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "index.html"), dashboardHtml());
  writeFileSync(join(dashDir, "data.json"), JSON.stringify(dash));

  console.log(`Wrote board.json (${watchlist.length} rows), dossier.json, dashboard/`);
}

function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Launch Radar</title>
<style>
:root{--bg:#0b0f14;--panel:#121821;--line:#1f2a37;--txt:#e6edf3;--mut:#8b98a5;--acc:#3fb950;--acc2:#58a6ff}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--txt)}
header{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0}.badge{background:var(--panel);border:1px solid var(--line);padding:2px 8px;border-radius:999px;color:var(--mut);font-size:12px}
main{padding:16px 20px;display:grid;gap:16px;grid-template-columns:minmax(0,1fr) 420px}
@media(max-width:900px){main{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);font-size:13px}
th{color:var(--mut);font-weight:600;cursor:pointer;user-select:none}
tr:hover td{background:#151d28;cursor:pointer}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}
.panel h2{margin:0 0 8px;font-size:15px}
input,select{background:#0d131b;border:1px solid var(--line);color:var(--txt);padding:6px 8px;border-radius:6px;font:inherit}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.steps li{margin:4px 0}.muted{color:var(--mut)}.val{color:var(--acc);font-weight:600}
</style></head><body>
<header><h1>🛰️ Token Launch Radar</h1><span class="badge" id="count">loading…</span><span class="badge">no-token protocols ranked by implied launch value</span></header>
<main>
<div>
  <div class="filters">
    <input id="q" placeholder="Search name / category…" style="flex:1;min-width:160px">
    <select id="cat"><option value="">All categories</option></select>
    <select id="chain"><option value="">All chains</option></select>
  </div>
  <table><thead><tr>
    <th data-k="name">Protocol</th><th data-k="category">Category</th><th data-k="tvl" class="num">TVL</th><th data-k="impliedValue" class="num">Implied value</th>
  </tr></thead><tbody id="rows"></tbody></table>
</div>
<div class="panel" id="detail"><h2>Select a protocol</h2><p class="muted">Click a row to see the detail view and farm plan.</p></div>
</main>
<script>
let DATA=null, sortK="impliedValue", sortDir=-1, sel=null;
const fmt=n=>n>=1e9?(n/1e9).toFixed(2)+"B":n>=1e6?(n/1e6).toFixed(2)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(Math.round(n||0));
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function boot(){
  try{
    const r=await fetch("data.json");DATA=await r.json();
  }catch(e){
    document.getElementById("count").textContent="failed to load data.json";
    return;
  }
  const cats=[...new Set(DATA.rows.map(x=>x.category))].sort();
  const chains=[...new Set(DATA.rows.flatMap(x=>x.chains||[]))].sort();
  for(const c of cats)cat.add(new Option(c,c));
  for(const c of chains)chain.add(new Option(c,c));
  count.textContent=DATA.rows.length+" watchlist / "+DATA.all.length+" protocols";
  render();
}
function render(){
  const q=document.getElementById("q").value.toLowerCase();
  const c=document.getElementById("cat").value, ch=document.getElementById("chain").value;
  let rows=DATA.rows.filter(r=>(!q||r.name.toLowerCase().includes(q)||(r.category||"").toLowerCase().includes(q))&&(!c||r.category===c)&&(!ch||(r.chains||[]).includes(ch)));
  rows.sort((a,b)=>{const x=a[sortK],y=b[sortK];return (typeof x==="string"?x.localeCompare(y):(x-y))*sortDir;});
  document.getElementById("rows").innerHTML=rows.map(r=>\`<tr data-slug="\${esc(r.slug)}"><td>\${esc(r.name)}</td><td class="muted">\${esc(r.category)}</td><td class="num">$\${fmt(r.tvl)}</td><td class="num val">$\${fmt(r.impliedValue)}</td></tr>\`).join("");
  document.querySelectorAll("#rows tr").forEach(tr=>tr.onclick=()=>{sel=DATA.rows.find(x=>x.slug===tr.dataset.slug);showDetail();});
}
function showDetail(){
  if(!sel)return;
  const d=document.getElementById("detail");
  d.innerHTML=\`<h2>\${esc(sel.name)}</h2>
    <p class="muted">\${esc(sel.category)} · \${esc((sel.chains||[]).join(", ")||"—")}</p>
    <p><b>TVL:</b> $\${fmt(sel.tvl)} &nbsp; <b>Implied value:</b> <span class="val">$\${fmt(sel.impliedValue)}</span></p>
    <p class="muted">\${esc(sel.description||"")}</p>
    <h2>Farm plan</h2><ol class="steps">\${(sel.farmPlan||[]).map(s=>\`<li>\${esc(s)}</li>\`).join("")}</ol>\`;
}
document.getElementById("q").oninput=render;
document.getElementById("cat").onchange=render;
document.getElementById("chain").onchange=render;
document.querySelectorAll("th[data-k]").forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortK===k)sortDir*=-1;else{sortK=k;sortDir=-1;}render();});
boot();
</script></body></html>`;
}

try {
  main();
} catch (e) {
  console.error(`token-radar: ${(e as Error).message}`);
  process.exitCode = 1;
}