// vendor/makefun-board.ts
// Kit-provided board/dossier helper used by main.ts.
// Pure standard library. No network. Deterministic.

export type ProtocolRow = {
  slug: string;
  name: string;
  chain: string;
  category: string;
  tvl: number;
  hasToken: boolean;
  isWrappedOrStaked: boolean;
  impliedValue: number;
  farmPlan: FarmStep[];
  notes: string;
};

export type FarmStep = {
  step: number;
  action: string;
  why: string;
};

export type Dossier = {
  format: string;
  generatedAt: string;
  totalProtocols: number;
  watchlistCount: number;
  rows: ProtocolRow[];
  summary: {
    topSlug: string;
    topName: string;
    topValue: number;
    medianValue: number;
    totalImpliedValue: number;
  };
};

export type BoardInput = {
  protocols: Array<{
    slug: string;
    name: string;
    chain?: string;
    category?: string;
    tvl?: number;
    hasToken?: boolean;
    isWrappedOrStaked?: boolean;
  }>;
};

const WRAPPED_HINTS = [
  "wrapped",
  "staked",
  "stake",
  "restaked",
  "restaking",
  "liquid staking",
  "lst",
  "lrt",
  "vault",
  "receipt",
  "a-token",
  "atoken",
  "c-token",
  "ctoken",
  "g-token",
  "gtoken",
  "yield bearing",
  "yield-bearing",
  "rebasing",
  "bridged",
  "canonical bridge",
  "pegged",
];

const STABLE_HINTS = ["usdc", "usdt", "dai", "frax", "lusd", "crvusd", "gho", "usde", "susde"];

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

export function looksWrappedOrStaked(name: string, slug: string, category: string): boolean {
  const hay = `${norm(name)} ${norm(slug)} ${norm(category)}`;
  for (const h of WRAPPED_HINTS) {
    if (hay.includes(h)) return true;
  }
  return false;
}

export function looksStable(name: string, slug: string): boolean {
  const hay = `${norm(name)} ${norm(slug)}`;
  for (const s of STABLE_HINTS) {
    if (hay.includes(s)) return true;
  }
  return false;
}

// Implied value heuristic: a launch is worth roughly a fraction of TVL,
// scaled by category and by whether the protocol is a base asset issuer.
export function impliedValueFor(row: {
  tvl: number;
  category: string;
  name: string;
  slug: string;
}): number {
  const tvl = Math.max(0, Number(row.tvl) || 0);
  if (tvl <= 0) return 0;
  const cat = norm(row.category);
  let mult = 0.06;
  if (cat.includes("dex")) mult = 0.09;
  else if (cat.includes("lending")) mult = 0.08;
  else if (cat.includes("perp") || cat.includes("derivative")) mult = 0.1;
  else if (cat.includes("yield") || cat.includes("farm")) mult = 0.07;
  else if (cat.includes("bridge")) mult = 0.05;
  else if (cat.includes("liquid staking") || cat.includes("restaking")) mult = 0.04;
  else if (cat.includes("rwa")) mult = 0.11;
  else if (cat.includes("cdp") || cat.includes("stablecoin")) mult = 0.12;
  else if (cat.includes("options")) mult = 0.08;
  else if (cat.includes("insurance")) mult = 0.06;
  if (looksStable(row.name, row.slug)) mult *= 0.6;
  // Diminishing returns on very large TVL.
  const scale = Math.log10(1 + tvl / 1_000_000) / Math.log10(1 + 1_000_000);
  const damp = 1 / (1 + Math.max(0, scale - 1) * 0.35);
  return Math.round(tvl * mult * damp);
}

export function farmPlanFor(row: {
  slug: string;
  name: string;
  chain: string;
  category: string;
  tvl: number;
}): FarmStep[] {
  const steps: FarmStep[] = [];
  const cat = norm(row.category);
  steps.push({
    step: 1,
    action: `Open ${row.name} on ${row.chain || "its main chain"} and connect a fresh wallet with a small gas balance.`,
    why: "A fresh wallet keeps any future airdrop snapshot clean and avoids sybil filters that penalise reused addresses.",
  });
  if (cat.includes("dex") || cat.includes("perp")) {
    steps.push({
      step: 2,
      action: `Provide liquidity or trade on ${row.name} with a stable pair first, then a volatile pair.`,
      why: "Volume plus liquidity depth is the most common points formula for DEX and perp launches.",
    });
  } else if (cat.includes("lending") || cat.includes("cdp")) {
    steps.push({
      step: 2,
      action: `Supply a blue-chip asset to ${row.name}, borrow a small amount, and repay over a few weeks.`,
      why: "Lending protocols reward both supply and borrow sides; repaying shows real usage rather than a one-shot deposit.",
    });
  } else if (cat.includes("bridge")) {
    steps.push({
      step: 2,
      action: `Bridge a modest amount through ${row.name} in both directions over separate days.`,
      why: "Bridges weight unique users and two-way flow; single-direction hops are often filtered out.",
    });
  } else {
    steps.push({
      step: 2,
      action: `Use ${row.name}'s core product with a small position and keep it active for several weeks.`,
      why: "Sustained usage across epochs beats a single large deposit in most launch allocations.",
    });
  }
  steps.push({
    step: 3,
    action: `Return weekly to ${row.name}, add a little more, and record every transaction hash.`,
    why: "Consistency across epochs is the strongest signal for a launch allocation; keep receipts in case of a claim form.",
  });
  steps.push({
    step: 4,
    action: `Follow ${row.name}'s official channels for a points or testnet program and complete any quests early.`,
    why: "Early quests usually carry a multiplier; late entries often get a flat, smaller share.",
  });
  return steps;
}

export function buildBoard(input: BoardInput): ProtocolRow[] {
  const rows: ProtocolRow[] = [];
  for (const p of input.protocols || []) {
    const slug = String(p.slug || "").trim();
    const name = String(p.name || slug).trim();
    if (!slug) continue;
    const chain = String(p.chain || "multi").trim();
    const category = String(p.category || "other").trim();
    const tvl = Math.max(0, Number(p.tvl) || 0);
    const hasToken = Boolean(p.hasToken);
    const wrapped = Boolean(p.isWrappedOrStaked) || looksWrappedOrStaked(name, slug, category);
    const impliedValue = hasToken || wrapped ? 0 : impliedValueFor({ tvl, category, name, slug });
    rows.push({
      slug,
      name,
      chain,
      category,
      tvl,
      hasToken,
      isWrappedOrStaked: wrapped,
      impliedValue,
      farmPlan: hasToken || wrapped ? [] : farmPlanFor({ slug, name, chain, category, tvl }),
      notes: hasToken
        ? "Already has a token."
        : wrapped
          ? "Wrapped or staked product of an existing token."
          : "No token recorded; launch candidate.",
    });
  }
  rows.sort((a, b) => {
    if (b.impliedValue !== a.impliedValue) return b.impliedValue - a.impliedValue;
    if (b.tvl !== a.tvl) return b.tvl - a.tvl;
    return a.slug.localeCompare(b.slug);
  });
  return rows;
}

export function watchlist(rows: ProtocolRow[]): ProtocolRow[] {
  return rows.filter((r) => !r.hasToken && !r.isWrappedOrStaked);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function buildDossier(input: BoardInput, generatedAt?: string): Dossier {
  const all = buildBoard(input);
  const wl = watchlist(all);
  const values = wl.map((r) => r.impliedValue).filter((v) => v > 0);
  const top = wl[0];
  return {
    format: "makefun-board/1",
    generatedAt: generatedAt || new Date(0).toISOString(),
    totalProtocols: all.length,
    watchlistCount: wl.length,
    rows: all,
    summary: {
      topSlug: top ? top.slug : "",
      topName: top ? top.name : "",
      topValue: top ? top.impliedValue : 0,
      medianValue: median(values),
      totalImpliedValue: values.reduce((a, b) => a + b, 0),
    },
  };
}

export function renderBoardMarkdown(dossier: Dossier, limit = 100): string {
  const lines: string[] = [];
  lines.push(`# Token Launch Radar`);
  lines.push("");
  lines.push(`Generated: ${dossier.generatedAt}`);
  lines.push(`Protocols: ${dossier.totalProtocols} | Watchlist: ${dossier.watchlistCount}`);
  lines.push("");
  lines.push(`| # | Protocol | Chain | Category | TVL | Implied Value |`);
  lines.push(`|---|----------|-------|----------|-----|---------------|`);
  const wl = watchlist(dossier.rows).slice(0, limit);
  wl.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.name} | ${r.chain} | ${r.category} | $${Math.round(r.tvl).toLocaleString("en-US")} | $${r.impliedValue.toLocaleString("en-US")} |`,
    );
  });
  return lines.join("\n");
}

export function renderDetailMarkdown(row: ProtocolRow): string {
  const lines: string[] = [];
  lines.push(`# ${row.name}`);
  lines.push("");
  lines.push(`- Slug: ${row.slug}`);
  lines.push(`- Chain: ${row.chain}`);
  lines.push(`- Category: ${row.category}`);
  lines.push(`- TVL: $${Math.round(row.tvl).toLocaleString("en-US")}`);
  lines.push(`- Has token: ${row.hasToken}`);
  lines.push(`- Wrapped/staked: ${row.isWrappedOrStaked}`);
  lines.push(`- Implied launch value: $${row.impliedValue.toLocaleString("en-US")}`);
  lines.push("");
  lines.push(`## Farm plan`);
  lines.push("");
  if (!row.farmPlan.length) {
    lines.push(row.notes);
  } else {
    for (const s of row.farmPlan) {
      lines.push(`${s.step}. **${s.action}** — ${s.why}`);
    }
  }
  return lines.join("\n");
}

export const BOARD_VERSION = "makefun-board/1";