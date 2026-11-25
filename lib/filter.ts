export interface RawProtocol {
  id?: string | number;
  name?: string;
  slug?: string;
  symbol?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  tvl?: number | null;
  chainTvls?: Record<string, number> | null;
  chains?: string[] | null;
  chain?: string | null;
  category?: string | null;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  url?: string | null;
  description?: string | null;
  twitter?: string | null;
  parentProtocol?: string | null;
  parentProtocolSlug?: string | null;
  audits?: string | number | null;
  audit_links?: string[] | null;
  listedAt?: number | null;
  oracles?: string[] | null;
  forkedFrom?: string[] | null;
  totalRaised?: number | null;
  raises?: RawRaise[] | null;
  module?: string | null;
}

export interface RawParentProtocol {
  id?: string;
  name?: string;
  slug?: string;
  symbol?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  mcap?: number | null;
  fdv?: number | null;
}

export interface RawRaise {
  name?: string;
  slug?: string;
  defillamaId?: string | number | null;
  amount?: number | null;
  date?: number | null;
  leadInvestors?: string[] | null;
  otherInvestors?: string[] | null;
  round?: string | null;
}

export interface ParsedSnapshot {
  protocols: RawProtocol[];
  parentProtocols: RawParentProtocol[];
  raises: RawRaise[];
  watchlist: string[];
  snapshotMeta: {
    source: string;
    protocolCount: number;
    snapshotTime: number | null;
  };
}

export interface FilteredProtocol {
  id: string;
  slug: string;
  name: string;
  category: string;
  chains: string[];
  primaryChain: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change1h: number | null;
  change1d: number | null;
  change7d: number | null;
  listedAt: number | null;
  audits: number;
  auditLinks: string[];
  url: string;
  twitter: string;
  description: string;
  parentProtocol: string | null;
  forkedFrom: string[];
  oracles: string[];
  totalRaisedUsd: number;
  raisesCount: number;
  leadInvestors: string[];
  isWatchlist: boolean;
  tokenStatusReason: string;
  flags: string[];
}

export interface TokenizedComp {
  slug: string;
  name: string;
  symbol: string;
  category: string;
  chains: string[];
  tvl: number;
  mcap: number;
  fdv: number | null;
  mcapToTvl: number;
  listedAt: number | null;
}

export interface ExclusionSummary {
  totalInput: number;
  kept: number;
  excludedHasToken: number;
  excludedParentToken: number;
  excludedWrappedOrStaked: number;
  excludedCexOrNonProtocol: number;
  excludedZeroTvl: number;
  excludedDuplicate: number;
  watchlistTotal: number;
  watchlistMatched: number;
  watchlistKept: number;
  watchlistMissing: string[];
}

export interface FilterResult {
  candidates: FilteredProtocol[];
  tokenizedComps: TokenizedComp[];
  summary: ExclusionSummary;
  excludedSamples: Array<{ slug: string; name: string; reason: string; tvl: number }>;
}

const EMPTY_MARKERS = new Set(["", "-", "--", "none", "null", "n/a", "na", "tbd", "tba", "?", "unknown", "0"]);

const NON_CHAIN_TVL_KEYS = new Set([
  "staking",
  "pool2",
  "borrowed",
  "vesting",
  "treasury",
  "offers",
  "doublecounted",
  "liquidstaking",
  "dcandlsoverlap",
]);

const NON_PROTOCOL_CATEGORIES = new Set(["cex", "chain"]);

const SUBPRODUCT_SUFFIX_RE =
  /^(v\d+|earn|lend|lending|borrow|perps?|dex|swap|amm|clmm|vaults?|stak(ed|ing)|wrapped|bridge|pools?|markets?|yield|rwa|treasury|savings|cdp|liquid|restaking|lst|lrt|pro|prime|launchpad|pad|usde|usds|usd|eth|btc|sol)\b/i;

const WRAPPED_NAME_RE =
  /^(wrapped|bridged|binance-peg|pegged)\s+|\bwrapped\s+(btc|bitcoin|eth|ether|ethereum|sol|solana|avax|matic|pol|bnb|sui|apt|ton|trx|tron|near|ftm|ada|xrp|doge|ltc|atom|dot|hype|staked|usdc|usdt)\b/i;

const STAKED_ASSET_RE =
  /\b(liquid\s+)?staked\s+(eth|ether|ethereum|sol|solana|btc|bitcoin|avax|matic|pol|bnb|sui|apt|aptos|ton|trx|near|ftm|atom|dot|tia|inj|sei|osmo|kava|hype|usdc|usdt|usde|dai|ena|ldo|aave|crv|cvx|pendle|jup|bonk|ray)\b/i;

const EXCHANGE_WRAPPER_RE =
  /\b(binance|coinbase|kraken|bybit|okx|bitget|kucoin|gate(\.io)?|huobi|htx|crypto\.com|bitfinex|gemini|upbit|robinhood|mexc|bingx|bitstamp)\s+(staked|wrapped|liquid|btc|eth|sol|bnb|earn|vault|lst)\b/i;

const WRAPPED_TICKER_RE =
  /\b(wbtc|weth|wsol|cbeth|cbbtc|wbeth|meth|jupsol|bbsol|bnsol|hsol|psol|steth|reth|frxeth|sfrxeth|eeth|weeth|ezeth|rseth|pufeth|sweth|oeth|oseth|ankreth|stsol|msol|jitosol|savax|stmatic|maticx|sttia|statom|sdai|susde|susds|stusdt|tbtc|renbtc|hbtc)\b/i;

const WRAPPED_DESC_RE =
  /\b(is a wrapped version of|1:1 backed wrapped|canonical wrapped|liquid staking token issued by (binance|coinbase|kraken|bybit|okx|bitget))\b/i;

export function normalizeKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function compactKey(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isMeaningfulString(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return !EMPTY_MARKERS.has(s);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function cleanChainTvls(raw: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const keys = Object.keys(raw).sort();
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (NON_CHAIN_TVL_KEYS.has(lower)) continue;
    if (lower.includes("-")) {
      const suffix = lower.slice(lower.lastIndexOf("-") + 1);
      if (NON_CHAIN_TVL_KEYS.has(suffix)) continue;
    }
    const num = toFiniteNumber(raw[key]);
    if (num !== null && num > 0) {
      out[key] = Math.round(num * 100) / 100;
    }
  }
  return out;
}

function resolveTvl(raw: RawProtocol, chainTvls: Record<string, number>): number {
  const direct = toFiniteNumber(raw.tvl);
  if (direct !== null && direct >= 0) return direct;
  let sum = 0;
  for (const v of Object.values(chainTvls)) sum += v;
  return sum;
}

function resolveChains(raw: RawProtocol, chainTvls: Record<string, number>): string[] {
  const set = new Set<string>();
  if (Array.isArray(raw.chains)) {
    for (const c of raw.chains) {
      if (typeof c === "string" && c.trim() && c.trim().toLowerCase() !== "multi-chain") {
        set.add(c.trim());
      }
    }
  }
  for (const c of Object.keys(chainTvls)) {
    if (c.trim()) set.add(c.trim());
  }
  if (set.size === 0 && typeof raw.chain === "string" && raw.chain.trim()) {
    set.add(raw.chain.trim());
  }
  return Array.from(set).sort((a, b) => (chainTvls[b] ?? 0) - (chainTvls[a] ?? 0) || a.localeCompare(b));
}

function hasDirectToken(raw: RawProtocol | RawParentProtocol): { hasToken: boolean; reason: string } {
  const mcap = toFiniteNumber(raw.mcap);
  if (mcap !== null && mcap > 0) return { hasToken: true, reason: "live_mcap" };
  if (isMeaningfulString(raw.gecko_id)) return { hasToken: true, reason: "gecko_id" };
  if (isMeaningfulString(raw.cmcId)) return { hasToken: true, reason: "cmc_id" };
  if (isMeaningfulString(raw.symbol)) return { hasToken: true, reason: "token_symbol" };
  return { hasToken: false, reason: "no_token_recorded" };
}

function detectWrappedOrStaked(raw: RawProtocol): string | null {
  const name = (raw.name ?? "").trim();
  const slug = (raw.slug ?? "").trim();
  const desc = (raw.description ?? "").trim();
  if (EXCHANGE_WRAPPER_RE.test(name)) return "exchange_staked_or_wrapped_product";
  if (WRAPPED_NAME_RE.test(name)) return "wrapped_or_bridged_asset";
  if (STAKED_ASSET_RE.test(name)) return "staked_derivative_of_traded_asset";
  if (WRAPPED_TICKER_RE.test(name) || WRAPPED_TICKER_RE.test(slug)) return "known_wrapped_or_staked_ticker";
  if (WRAPPED_DESC_RE.test(desc)) return "wrapped_asset_description";
  return null;
}

function parseAuditsCount(raw: RawProtocol): number {
  const links = Array.isArray(raw.audit_links) ? raw.audit_links.filter((s) => typeof s === "string" && s.trim()) : [];
  const num = toFiniteNumber(raw.audits);
  if (num !== null && num > 0) return Math.max(Math.round(num), links.length);
  return links.length;
}

export function parseSnapshot(rawInput: unknown, source = "snapshot"): ParsedSnapshot {
  if (Array.isArray(rawInput)) {
    return {
      protocols: rawInput as RawProtocol[],
      parentProtocols: [],
      raises: [],
      watchlist: [],
      snapshotMeta: { source, protocolCount: rawInput.length, snapshotTime: null },
    };
  }
  if (!rawInput || typeof rawInput !== "object") {
    return {
      protocols: [],
      parentProtocols: [],
      raises: [],
      watchlist: [],
      snapshotMeta: { source, protocolCount: 0, snapshotTime: null },
    };
  }
  const obj = rawInput as Record<string, unknown>;
  const protocols = Array.isArray(obj.protocols)
    ? (obj.protocols as RawProtocol[])
    : Array.isArray(obj.data)
      ? (obj.data as RawProtocol[])
      : [];
  const parentProtocols = Array.isArray(obj.parentProtocols)
    ? (obj.parentProtocols as RawParentProtocol[])
    : Array.isArray(obj.parents)
      ? (obj.parents as RawParentProtocol[])
      : [];
  const raises = Array.isArray(obj.raises) ? (obj.raises as RawRaise[]) : [];
  const rawWatchlist = Array.isArray(obj.watchlist) ? obj.watchlist : [];
  const watchlist = rawWatchlist
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        return String(rec.slug ?? rec.name ?? rec.id ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);

  const timeCandidate = toFiniteNumber(obj.snapshotTime ?? obj.timestamp ?? obj.generatedAtUnix);
  return {
    protocols,
    parentProtocols,
    raises,
    watchlist,
    snapshotMeta: { source, protocolCount: protocols.length, snapshotTime: timeCandidate },
  };
}

interface RaiseAggregate {
  totalUsd: number;
  count: number;
  investors: Set<string>;
}

function indexRaises(raises: RawRaise[]): Map<string, RaiseAggregate> {
  const map = new Map<string, RaiseAggregate>();
  const addKey = (key: string, amountUsd: number, investors: string[]) => {
    if (!key) return;
    let agg = map.get(key);
    if (!agg) {
      agg = { totalUsd: 0, count: 0, investors: new Set<string>() };
      map.set(key, agg);
    }
    agg.totalUsd += amountUsd;
    agg.count += 1;
    for (const inv of investors) {
      if (inv && inv.trim()) agg.investors.add(inv.trim());
    }
  };

  for (const r of raises) {
    const rawAmt = toFiniteNumber(r.amount);
    if (rawAmt === null || rawAmt <= 0) continue;
    const amountUsd = rawAmt < 10_000 ? rawAmt * 1_000_000 : rawAmt;
    const investors = [
      ...(Array.isArray(r.leadInvestors) ? r.leadInvestors : []),
      ...(Array.isArray(r.otherInvestors) ? r.otherInvestors.slice(0, 3) : []),
    ];
    const keys = new Set<string>([
      normalizeKey(r.slug),
      normalizeKey(r.name),
      compactKey(r.name),
      r.defillamaId !== null && r.defillamaId !== undefined ? `id:${String(r.defillamaId)}` : "",
    ]);
    for (const k of keys) addKey(k, amountUsd, investors);
  }
  return map;
}

export function filterTokenlessProtocols(
  snapshot: ParsedSnapshot,
  externalWatchlist: string[] = []
): FilterResult {
  const combinedWatchlistRaw = [...snapshot.watchlist, ...externalWatchlist].filter(Boolean);
  const watchlistEntries: Array<{ raw: string; norm: string; compact: string }> = [];
  const seenWatch = new Set<string>();
  for (const entry of combinedWatchlistRaw) {
    const norm = normalizeKey(entry);
    if (!norm || seenWatch.has(norm)) continue;
    seenWatch.add(norm);
    watchlistEntries.push({ raw: entry, norm, compact: compactKey(entry) });
  }
  const watchNormSet = new Set(watchlistEntries.map((w) => w.norm));
  const watchCompactSet = new Set(watchlistEntries.map((w) => w.compact));
  const matchedWatchNorms = new Set<string>();
  const keptWatchNorms = new Set<string>();

  const tokenizedParentIds = new Set<string>();
  const tokenizedParentSlugs = new Set<string>();
  const tokenizedBrandNames = new Set<string>();

  for (const parent of snapshot.parentProtocols) {
    if (hasDirectToken(parent).hasToken) {
      if (parent.id) tokenizedParentIds.add(parent.id.toLowerCase());
      if (parent.slug) tokenizedParentSlugs.add(normalizeKey(parent.slug));
      if (parent.name && parent.name.trim().length >= 4) {
        tokenizedBrandNames.add(parent.name.trim().toLowerCase());
      }
    }
  }

  for (const raw of snapshot.protocols) {
    const tokenCheck = hasDirectToken(raw);
    if (!tokenCheck.hasToken) continue;
    if (raw.parentProtocol) tokenizedParentIds.add(raw.parentProtocol.toLowerCase());
    if (raw.parentProtocolSlug) tokenizedParentSlugs.add(normalizeKey(raw.parentProtocolSlug));
    const mcap = toFiniteNumber(raw.mcap) ?? 0;
    const tvl = toFiniteNumber(raw.tvl) ?? 0;
    if ((mcap > 1_000_000 || tvl > 10_000_000) && raw.name && raw.name.trim().length >= 4) {
      tokenizedBrandNames.add(raw.name.trim().toLowerCase());
    }
  }

  const brandList = Array.from(tokenizedBrandNames).sort((a, b) => b.length - a.length);
  const raiseMap = indexRaises(snapshot.raises);

  const candidates: FilteredProtocol[] = [];
  const tokenizedComps: TokenizedComp[] = [];
  const excludedSamples: Array<{ slug: string; name: string; reason: string; tvl: number }> = [];
  const seenSlugs = new Set<string>();

  const summary: ExclusionSummary = {
    totalInput: snapshot.protocols.length,
    kept: 0,
    excludedHasToken: 0,
    excludedParentToken: 0,
    excludedWrappedOrStaked: 0,
    excludedCexOrNonProtocol: 0,
    excludedZeroTvl: 0,
    excludedDuplicate: 0,
    watchlistTotal: watchlistEntries.length,
    watchlistMatched: 0,
    watchlistKept: 0,
    watchlistMissing: [],
  };

  for (const raw of snapshot.protocols) {
    const name = (raw.name ?? raw.slug ?? "").trim();
    const slug = normalizeKey(raw.slug || name || String(raw.id ?? ""));
    if (!slug || !name) continue;

    const normName = normalizeKey(name);
    const compName = compactKey(name);
    const compSlug = compactKey(slug);
    const idStr = raw.id !== undefined && raw.id !== null ? String(raw.id) : slug;

    const isWatchlist =
      watchNormSet.has(slug) ||
      watchNormSet.has(normName) ||
      watchCompactSet.has(compSlug) ||
      watchCompactSet.has(compName);

    const matchedWatchKey = watchNormSet.has(slug)
      ? slug
      : watchNormSet.has(normName)
        ? normName
        : watchlistEntries.find((w) => w.compact === compSlug || w.compact === compName)?.norm ?? null;

    if (matchedWatchKey) matchedWatchNorms.add(matchedWatchKey);

    const chainTvls = cleanChainTvls(raw.chainTvls);
    const tvl = resolveTvl(raw, chainTvls);
    const chains = resolveChains(raw, chainTvls);
    const category = (raw.category ?? "Uncategorized").trim() || "Uncategorized";
    const catLower = category.toLowerCase();

    if (seenSlugs.has(slug)) {
      summary.excludedDuplicate += 1;
      continue;
    }
    seenSlugs.add(slug);

    const tokenCheck = hasDirectToken(raw);
    if (tokenCheck.hasToken) {
      const mcap = toFiniteNumber(raw.mcap);
      if (mcap !== null && mcap > 0 && tvl >= 100_000 && !NON_PROTOCOL_CATEGORIES.has(catLower)) {
        const fdv = toFiniteNumber(raw.fdv);
        tokenizedComps.push({
          slug,
          name,
          symbol: String(raw.symbol ?? "").trim().toUpperCase(),
          category,
          chains,
          tvl,
          mcap,
          fdv: fdv !== null && fdv > 0 ? fdv : null,
          mcapToTvl: mcap / tvl,
          listedAt: toFiniteNumber(raw.listedAt),
        });
      }
      if (!isWatchlist) {
        summary.excludedHasToken += 1;
        if (tvl >= 5_000_000) excludedSamples.push({ slug, name, reason: tokenCheck.reason, tvl });
        continue;
      }
    }

    if (!isWatchlist && NON_PROTOCOL_CATEGORIES.has(catLower)) {
      summary.excludedCexOrNonProtocol += 1;
      if (tvl >= 5_000_000) excludedSamples.push({ slug, name, reason: `category_${catLower}`, tvl });
      continue;
    }

    const parentId = raw.parentProtocol ? raw.parentProtocol.toLowerCase() : null;
    const parentSlug = raw.parentProtocolSlug ? normalizeKey(raw.parentProtocolSlug) : null;
    let parentTokenReason: string | null = null;
    if (parentId && tokenizedParentIds.has(parentId)) {
      parentTokenReason = "parent_protocol_has_token";
    } else if (parentSlug && tokenizedParentSlugs.has(parentSlug)) {
      parentTokenReason = "parent_slug_has_token";
    } else {
      const lowerName = name.toLowerCase();
      for (const brand of brandList) {
        if (lowerName.startsWith(`${brand} `)) {
          const rest = lowerName.slice(brand.length + 1).trim();
          if (SUBPRODUCT_SUFFIX_RE.test(rest)) {
            parentTokenReason = `subproduct_of_${brand}`;
            break;
          }
        }
      }
    }

    if (parentTokenReason && !isWatchlist) {
      summary.excludedParentToken += 1;
      if (tvl >= 5_000_000) excludedSamples.push({ slug, name, reason: parentTokenReason, tvl });
      continue;
    }

    const wrappedReason = detectWrappedOrStaked(raw);
    if (wrappedReason && !isWatchlist) {
      summary.excludedWrappedOrStaked += 1;
      if (tvl >= 1_000_000) excludedSamples.push({ slug, name, reason: wrappedReason, tvl });
      continue;
    }

    if (!isWatchlist && tvl <= 0) {
      summary.excludedZeroTvl += 1;
      continue;
    }

    const raiseAgg =
      raiseMap.get(`id:${idStr}`) ??
      raiseMap.get(slug) ??
      raiseMap.get(normName) ??
      raiseMap.get(compName) ??
      null;
    const inlineRaises = Array.isArray(raw.raises) ? raw.raises : [];
    let totalRaisedUsd = raiseAgg?.totalUsd ?? 0;
    let raisesCount = raiseAgg?.count ?? 0;
    const investorSet = new Set<string>(raiseAgg ? Array.from(raiseAgg.investors) : []);

    if (totalRaisedUsd === 0 && inlineRaises.length > 0) {
      for (const r of inlineRaises) {
        const amt = toFiniteNumber(r.amount);
        if (amt !== null && amt > 0) {
          totalRaisedUsd += amt < 10_000 ? amt * 1_000_000 : amt;
          raisesCount += 1;
        }
        for (const inv of r.leadInvestors ?? []) {
          if (inv && inv.trim()) investorSet.add(inv.trim());
        }
      }
    }
    const directRaised = toFiniteNumber(raw.totalRaised);
    if (totalRaisedUsd === 0 && directRaised !== null && directRaised > 0) {
      totalRaisedUsd = directRaised < 10_000 ? directRaised * 1_000_000 : directRaised;
      raisesCount = Math.max(raisesCount, 1);
    }

    const flags: string[] = [];
    if (isWatchlist) flags.push("watchlist");
    if (tokenCheck.hasToken) flags.push(`watchlist_override:${tokenCheck.reason}`);
    if (parentTokenReason) flags.push(`watchlist_override:${parentTokenReason}`);
    if (wrappedReason) flags.push(`watchlist_override:${wrappedReason}`);
    if (tvl === 0) flags.push("zero_tvl");

    const auditLinks = Array.isArray(raw.audit_links)
      ? raw.audit_links.filter((s): s is string => typeof s === "string" && s.trim().length > 0).sort()
      : [];

    candidates.push({
      id: idStr,
      slug,
      name,
      category,
      chains,
      primaryChain: chains[0] ?? (raw.chain?.trim() || "Multi-Chain"),
      tvl,
      chainTvls,
      change1h: toFiniteNumber(raw.change_1h),
      change1d: toFiniteNumber(raw.change_1d),
      change7d: toFiniteNumber(raw.change_7d),
      listedAt: toFiniteNumber(raw.listedAt),
      audits: parseAuditsCount(raw),
      auditLinks,
      url: (raw.url ?? "").trim(),
      twitter: (raw.twitter ?? "").trim().replace(/^@/, ""),
      description: (raw.description ?? "").trim(),
      parentProtocol: raw.parentProtocol ? raw.parentProtocol.trim() : null,
      forkedFrom: Array.isArray(raw.forkedFrom) ? raw.forkedFrom.filter(Boolean).sort() : [],
      oracles: Array.isArray(raw.oracles) ? raw.oracles.filter(Boolean).sort() : [],
      totalRaisedUsd: Math.round(totalRaisedUsd),
      raisesCount,
      leadInvestors: Array.from(investorSet).sort().slice(0, 6),
      isWatchlist,
      tokenStatusReason: tokenCheck.hasToken ? tokenCheck.reason : "verified_tokenless",
      flags,
    });

    if (matchedWatchKey) keptWatchNorms.add(matchedWatchKey);
  }

  candidates.sort((a, b) => b.tvl - a.tvl || a.slug.localeCompare(b.slug));
  tokenizedComps.sort((a, b) => b.mcap - a.mcap || a.slug.localeCompare(b.slug));
  excludedSamples.sort((a, b) => b.tvl - a.tvl || a.slug.localeCompare(b.slug));

  summary.kept = candidates.length;
  summary.watchlistMatched = matchedWatchNorms.size;
  summary.watchlistKept = keptWatchNorms.size;
  summary.watchlistMissing = watchlistEntries
    .filter((w) => !matchedWatchNorms.has(w.norm))
    .map((w) => w.raw)
    .sort();

  return {
    candidates,
    tokenizedComps,
    summary,
    excludedSamples: excludedSamples.slice(0, 40),
  };
}