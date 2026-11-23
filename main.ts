import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Raw = Record<string, any>;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR || HERE);
const MIN_ROWS = 100;
const MAX_DESC = 400;

function safeReadJson(p: string): any | null {
  try {
    if (!statSync(p).isFile()) return null;
    const txt = readFileSync(p, "utf8");
    if (!txt.trim()) return null;
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function normalizeSnapshot(j: any): Raw[] {
  if (Array.isArray(j)) return j.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (!j || typeof j !== "object") return [];
  if (Array.isArray(j.protocols)) return j.protocols.filter((x: any) => x && typeof x === "object");
  if (Array.isArray(j.data)) return j.data.filter((x: any) => x && typeof x === "object");
  if (Array.isArray(j.rows)) return j.rows.filter((x: any) => x && typeof x === "object");
  const vals = Object.values(j);
  if (vals.length && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
    return vals as Raw[];
  }
  return [];
}

function findSnapshot(): Raw[] {
  const candidates = [
    join(HERE, "vendor", "snapshot.json"),
    join(HERE, "snapshot.json"),
    join(HERE, "data", "snapshot.json"),
    join(HERE, "vendor", "protocols.json"),
    join(HERE, "data", "protocols.json"),
  ];
  for (const p of candidates) {
    const j = safeReadJson(p);
    if (j == null) continue;
    const rows = normalizeSnapshot(j);
    if (rows.length) return rows;
  }
  const dirs = [join(HERE, "vendor"), join(HERE, "data"), HERE];
  let best: Raw[] = [];
  for (const d of dirs) {
    let files: string[];
    try {
      if (!existsSync(d) || !statSync(d).isDirectory()) continue;
      files = readdirSync(d).filter((f) => /\.json$/i.test(f)).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const j = safeReadJson(join(d, f));
      if (j == null) continue;
      const rows = normalizeSnapshot(j);
      if (rows.length > best.length) best = rows;
      if (best.length >= MIN_ROWS) return best;
    }
  }
  return best;
}

const WRAPPED_HINTS = [
  "wrapped", "staked", "stake", "lst", "lrt", "restaked", "restaking", "liquid staking",
  "liquid staked", "receipt", "vault share", "yield bearing", "yield-bearing", "bridged",
  "pegged", "synthetic", "derivative", "claim token", "receipt token", "rebasing",
];

function isWrappedOrStaked(p: Raw): boolean {
  if (p.parentProtocol || p.parent || p.isParentOf) return true;
  if (p.isWrapped === true || p.wrapped === true || p.isStaked === true) return true;
  if (p.tokenType && /wrapped|staked|liquid|receipt/i.test(String(p.tokenType))) return true;
  const cat = String(p.category ?? "").toLowerCase();
  if (cat.includes("liquid staking") || cat.includes("restaking") || cat.includes("bridge")) return true;
  const name = String(p.name ?? "").toLowerCase();
  for (const h of WRAPPED_HINTS) {
    if (name.includes(h)) return true;
  }
  const desc = String(p.description ?? "").toLowerCase();
  if (/\bwrapped\b|\bstaked\b|\brestaked\b/.test(desc)) return true;
  return false;
}

function hasToken(p: Raw): boolean {
  if (p.hasToken === true || p.token === true) return true;
  if (p.tokenSymbol && String(p.tokenSymbol).trim()) return true;
  if (Array.isArray(p.tokens) && p.tokens.length > 0) return true;
  if (p.token && typeof p.token === "object") return true;
  if (p.gecko_id && String(p.gecko_id).trim()) return true;
  if (Array.isArray(p.tokenList) && p.tokenList.length) return true;
  return false;
}

function num(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function sumTvls(v: any): number {
  if (Array.isArray(v)) {
    let s = 0;
    for (const c of v) s += num(c?.tvl ?? c);
    return s;
  }
  if (v && typeof v === "object") {
    let s = 0;
    for (const x of Object.values(v)) s += num(x);
    return s;
  }
  return 0;
}

function tvlOf(p: Raw): number {
  const cands = [p.tvl, p.currentChainTvl, p.totalTvl, p.tvlUsd].map(num);
  const chainSum = sumTvls(p.chainTvls);
  if (chainSum > 0) cands.push(chainSum);
  return Math.max(0, ...cands);
}

function chainsOf(p: Raw): string[] {
  if (Array.isArray(p.chains)) return p.chains.map(String).filter(Boolean);
  if (Array.isArray(p.chain)) return p.chain.map(String).filter(Boolean);
  if (typeof p.chain === "string" && p.chain.trim()) return [p.chain];
  if (p.chainTvls && typeof p.chainTvls === "object" && !Array.isArray(p.chainTvls)) {
    return Object.keys(p.chainTvls);
  }
  return [];
}

function categoryOf(p: Raw): string {
  const c = String(p.category ?? p.sector ?? "").trim();
  return c || "Other";
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "protocol";
}

const CATEGORY_MULT: Record<string, number> = {
  "dexes": 0.55, "dex": 0.55, "lending": 0.45, "cdp": 0.4, "liquid staking": 0.35,
  "restaking": 0.35, "yield": 0.3, "yield aggregator": 0.3, "perps": 0.6, "derivatives": 0.5,
  "bridge": 0.3, "chain": 0.9, "l1": 0.9, "l2": 0.8, "rwa": 0.5, "stablecoin": 0.4,
  "options": 0.4, "insurance": 0.3, "oracle": 0.4, "nft marketplace": 0.25, "gaming": 0.2,
  "social": 0.2, "launchpad": 0.35, "staking pool": 0.3, "farm": 0.2, "indexes": 0.3,
};

function categoryMult(cat: string): number {
  const c = cat.toLowerCase();
  if (CATEGORY_MULT[c] != null) return CATEGORY_MULT[c];
  for (const k of Object.keys(CATEGORY_MULT)) if (c.includes(k)) return CATEGORY_MULT[k];
  return 0.25;
}

function impliedValue(tvl: number, cat: string, chains: number, ageDays: number): number {
  const base = tvl * categoryMult(cat);
  const chainBonus = 1 + Math.min(0.5, Math.max(0, chains - 1) * 0.08);
  const maturity = ageDays > 0 ? Math.min(1.25, 0.7 + Math.log10(1 + ageDays) * 0.25) : 1;
  return Math.round(base * chainBonus * maturity);
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

function farmPlan(name: string, cat: string, chains: string[], tvl: number, value: number): string[] {
  const steps: string[] = [];
  const topChains = chains.slice(0, 3).join(", ") || "its main chain";
  steps.push(`Watch ${name} on ${topChains}: follow its docs, blog and X account for a points or testnet announcement.`);
  if (/dex|lending|perps|derivatives|yield|staking|restaking/i.test(cat)) {
    steps.push(`Supply real liquidity or collateral on ${name} (TVL ~$${fmtUsd(tvl)}) to earn protocol points that usually convert to an airdrop.`);
    steps.push(`Do a few genuine swaps/borrows/repays across weeks; keep positions open so snapshots catch them.`);
  } else if (/chain|l1|l2/i.test(cat)) {
    steps.push(`Bridge a small amount to ${name}, use its native DEX and lend/borrow to build on-chain history.`);
    steps.push(`Run a validator or light node if the network allows it; node runners are often whitelisted.`);
  } else {
    steps.push(`Use ${name} for real: deposit, mint or trade a modest amount and keep activity recurring.`);
  }
  steps.push(`Join ${name}'s Discord/Telegram and complete any quest or role that gates the allocation.`);
  steps.push(`Track implied launch value ~$${fmtUsd(value)}; size your farm cost well below it.`);
  return steps;
}

function ageDaysOf(p: Raw, nowMs: number): number {
  const listed = num(p.listedAt ?? p.listed_at ?? p.createdAt ?? p.created_at);
  if (listed <= 0) return 0;
  const secs = listed > 1e12 ? listed / 1000 : listed;
  return Math.max(0, (nowMs / 1000 - secs) / 86400);
}

function buildRows(raw: Raw[], nowMs: number): any[] {
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const name = String(p.name ?? p.protocol ?? "").trim();
    if (!name) continue;
    const id = String(p.id ?? p.slug ?? slugify(name));
    if (seen.has(id)) continue;
    seen.add(id);
    if (hasToken(p)) continue;
    if (isWrappedOrStaked(p)) continue;
    const tvl = tvlOf(p);
    if (tvl <= 0) continue;
    const cat = categoryOf(p);
    const chains = chainsOf(p);
    const ageDays = ageDaysOf(p, nowMs);
    const value = impliedValue(tvl, cat, chains.length, ageDays);
    const url = typeof p.url === "string" ? p.url : typeof p.website === "string" ? p.website : null;
    rows.push({
      id,
      slug: slugify(name),
      name,
      category: cat,
      chains,
      tvl,
      tvlUsd: tvl,
      impliedValueUsd: value,
      impliedValue: value,
      ageDays: Math.round(ageDays),
      url,
      description: String(p.description ?? "").slice(0, MAX_DESC),
      farmPlan: farmPlan(name, cat, chains, tvl, value),
    });
  }
  rows.sort((a, b) => b.impliedValue - a.impliedValue || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const STYLE = `
:root{--bg:#0b0e14;--panel:#121722;--line:#1f2937;--txt:#e5e7eb;--mut:#94a3b8;--acc:#22d3ee;--good:#34d399}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
header{padding:22px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0f1520,#0b0e14)}
h1{margin:0;font-size:22px}h1 span{color:var(--acc)}
.sub{color:var(--mut);margin-top:4px}
.wrap{padding:18px 24px;max-width:1200px;margin:0 auto}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
input,select{background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:8px 10px;border-radius:8px;font-size:13px}
input{min-width:240px}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:9px 10px;text-align:left;border-bottom:1px solid var(--line);font-size:13px}
th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
tr:hover td{background:#161d2b}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.num{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;padding:1px 7px;border-radius:999px;background:#1e293b;color:var(--mut);font-size:11px;margin:1px 2px}
.val{color:var(--good);font-weight:600}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px}
.kv{display:grid;grid-template-columns:160px 1fr;gap:6px 12px}.kv b{color:var(--mut);font-weight:500}
ol{padding-left:20px}li{margin:6px 0}
.hidden{display:none}
`;

const SCRIPT = `
(function(){
var q=document.getElementById('q'),c=document.getElementById('cat'),cnt=document.getElementById('cnt');
if(!q||!c)return;
function apply(){
  var t=(q.value||'').toLowerCase(),cat=c.value,n=0;
  var rows=document.querySelectorAll('tbody tr');
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var ok=(!t||(r.dataset.name||'').indexOf(t)>=0)&&(!cat||r.dataset.cat===cat);
    r.classList.toggle('hidden',!ok);
    if(ok)n++;
  }
  if(cnt)cnt.textContent=n+' shown';
}
q.addEventListener('input',apply);c.addEventListener('change',apply);apply();
})();
`;

function renderDashboard(board: any): string {
  const cats = [...new Set(board.rows.map((r: any) => r.category))].sort();
  const rowsHtml = board.rows.map((r: any) => `
<tr data-name="${esc(r.name.toLowerCase())}" data-cat="${esc(r.category)}">
<td class="num">${r.rank}</td>
<td><a href="protocol/${esc(r.slug)}.html">${esc(r.name)}</a></td>
<td><span class="tag">${esc(r.category)}</span></td>
<td>${r.chains.slice(0, 3).map((c: string) => `<span class="tag">${esc(c)}</span>`).join("") || "-"}</td>
<td class="num">$${fmtUsd(r.tvl)}</td>
<td class="num val">$${fmtUsd(r.impliedValue)}</td>
</tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Token Launch Radar</title><style>${STYLE}</style></head>
<body><header><h1>Token <span>Launch Radar</span></h1><div class="sub">${board.count} untokenized protocols ranked by implied launch value &middot; total ~$${fmtUsd(board.totalImpliedValueUsd)} &middot; ${esc(board.generatedAt)}</div></header>
<div class="wrap"><div class="bar"><input id="q" placeholder="Filter by name..."><select id="cat"><option value="">All categories</option>${cats.map((c: string) => `<option>${esc(c)}</option>`).join("")}</select><span class="sub" id="cnt"></span></div>
<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">Implied value</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
<script>${SCRIPT}</script></body></html>`;
}

function renderDetail(r: any, board: any): string {
  const url = safeUrl(r.url);
  const urlRow = url ? `<b>Website</b><span><a href="${esc(url)}" rel="noopener noreferrer">${esc(url)}</a></span>` : "";
  const desc = r.description ? `<p style="color:var(--mut);margin-top:12px">${esc(r.description)}</p>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.name)} - Token Launch Radar</title><style>${STYLE}</style></head>
<body><header><h1>${esc(r.name)}</h1><div class="sub">Rank #${r.rank} of ${board.count} &middot; <a href="../index.html">&larr; back to board</a></div></header>
<div class="wrap">
<div class="card"><div class="kv">
<b>Category</b><span>${esc(r.category)}</span>
<b>Chains</b><span>${r.chains.map((c: string) => `<span class="tag">${esc(c)}</span>`).join("") || "-"}</span>
<b>TVL</b><span>$${fmtUsd(r.tvl)}</span>
<b>Implied launch value</b><span class="val">$${fmtUsd(r.impliedValue)}</span>
<b>Age</b><span>${r.ageDays ? r.ageDays + " days" : "unknown"}</span>
${urlRow}
</div>${desc}</div>
<div class="card"><h2 style="margin-top:0;font-size:16px">How to farm it</h2><ol>${r.farmPlan.map((s: string) => `<li>${esc(s)}</li>`).join("")}</ol></div>
</div></body></html>`;
}

function main() {
  const raw = findSnapshot();
  if (!raw.length) {
    console.error("Token Launch Radar: no snapshot found (expected vendor/snapshot.json or similar).");
    process.exitCode = 1;
    return;
  }
  const now = Date.now();
  const rows = buildRows(raw, now);

  const board = {
    generatedAt: new Date(now).toISOString(),
    title: "Token Launch Radar",
    count: rows.length,
    totalImpliedValueUsd: rows.reduce((s, r) => s + r.impliedValue, 0),
    rows,
  };

  mkdirSync(OUT, { recursive: true });
  const boardJson = JSON.stringify(board, null, 2);
  writeFileSync(join(OUT, "board.json"), boardJson);

  const dashDir = join(OUT, "dashboard");
  mkdirSync(dashDir, { recursive: true });
  writeFileSync(join(dashDir, "board.json"), boardJson);
  writeFileSync(join(dashDir, "index.html"), renderDashboard(board));

  const