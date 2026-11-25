export interface RaiseRecord {
  amount?: number | null;
  date?: number | null;
  round?: string | null;
  leadInvestors?: string[] | null;
  otherInvestors?: string[] | null;
}

export interface RawProtocol {
  id?: string | number | null;
  name?: string | null;
  slug?: string | null;
  symbol?: string | null;
  address?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  category?: string | null;
  chains?: string[] | null;
  chain?: string | null;
  tvl?: number | null;
  chainTvls?: Record<string, number> | null;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  parentProtocol?: string | null;
  parentProtocolSlug?: string | null;
  url?: string | null;
  description?: string | null;
  twitter?: string | null;
  audits?: string | number | null;
  audit_links?: string[] | null;
  listedAt?: number | null;
  raises?: RaiseRecord[] | null;
  fees24h?: number | null;
  fees7d?: number | null;
  fees30d?: number | null;
  revenue24h?: number | null;
  revenue7d?: number | null;
  revenue30d?: number | null;
  volume24h?: number | null;
  volume7d?: number | null;
  volume30d?: number | null;
  users24h?: number | null;
  oracles?: string[] | null;
  forkedFrom?: string[] | null;
  module?: string | null;
  staking?: number | null;
  pool2?: number | null;
}

export interface ParentProtocolRecord {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  symbol?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  mcap?: number | null;
  address?: string | null;
  twitter?: string | null;
  url?: string | null;
  description?: string | null;
}

export type FilterReason =
  | "tokenless_eligible"
  | "watchlist_override"
  | "has_live_token"
  | "tokenized_parent"
  | "wrapped_or_staked_derivative"
  | "excluded_category"
  | "inactive_or_low_tvl"
  | "duplicate_slug";

export interface FilteredProtocol {
  protocol: RawProtocol;
  slug: string;
  name: string;
  parentId: string | null;
  isWatchlist: boolean;
  watchlistKey: string | null;
  filterReason: FilterReason;
  tokenSignals: string[];
  derivativeSignals: string[];
}

export interface TokenizedIndex {
  tokenizedParents: Set<string>;
  tokenizedBrands: Set<string>;
  tokenizedSlugs: Set<string>;
  tokenizedSymbols: Set<string>;
}

export interface FilterSummary {
  totalScanned: number;
  eligibleCount: number;
  excludedCount: number;
  excludedByReason: Record<FilterReason, number>;
  watchlistTotal: number;
  watchlistMatched: string[];
  watchlistMissing: string[];
}

export interface FilterOptions {
  watchlist?: string[];
  minTvl?: number;
  parentProtocols?: ParentProtocolRecord[];
}

export interface FilterResult {
  eligible: FilteredProtocol[];
  excluded: FilteredProtocol[];
  summary: FilterSummary;
  tokenizedIndex: TokenizedIndex;
}

const PLACEHOLDER_SYMBOLS = new Set([
  "",
  "-",
  "--",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "tba",
  "tbd",
  "soon",
  "unknown",
]);

const EXCLUDED_CATEGORIES = new Set(["cex"]);

const KNOWN_TRADING_ASSETS = new Set([
  "btc", "bitcoin", "eth", "ether", "ethereum", "sol", "solana", "bnb",
  "avax", "avalanche", "matic", "pol", "polygon", "arb", "arbitrum",
  "op", "optimism", "sui", "apt", "aptos", "ton", "trx", "tron", "ada",
  "cardano", "dot", "polkadot", "atom", "cosmos", "near", "ftm", "fantom",
  "sonic", "cro", "cronos", "inj", "injective", "sei", "tia", "celestia",
  "strk", "starknet", "tao", "bittensor", "xrp", "ripple", "doge", "ltc",
  "bch", "link", "aave", "uni", "ldo", "rpl", "crv", "cvx", "mkr", "sky",
  "ena", "usde", "jto", "mnde", "ethfi", "eigen", "pendle", "gmx", "snx",
  "cake", "sushi", "bal", "comp", "yfi", "mnt", "mantle", "hype", "okb",
  "bgb", "kcs", "gt", "wbt", "usdc", "usdt", "dai", "frax", "frxeth",
  "steth", "wsteth", "reth", "cbeth", "cbbtc", "wbtc", "weth", "wsol",
  "jitosol", "msol", "bsol", "bnsol", "bbsol", "meth", "sfrxeth", "susde",
  "bera", "berachain", "move", "kaia", "hbar", "hedera", "icp", "fil",
  "filecoin", "xlm", "algo", "algorand", "vet", "egld", "xtz", "tezos",
  "eos", "flow", "kava", "osmo", "osmosis", "rune", "thorchain", "cfx",
  "core", "ron", "ronin", "imx", "blur", "ape", "sand", "mana", "axs",
  "gala", "ldo", "fxs", "frx", "pyth", "jup", "drift", "kmno", "ray",
  "orca", "bonk", "wif", "pengu", "ondo", "usdy", "ousg", "solv",
]);

const KNOWN_TOKENIZED_ISSUERS = new Set([
  "binance", "coinbase", "bybit", "okx", "bitget", "kraken", "kucoin",
  "gate", "htx", "huobi", "bitfinex", "crypto.com", "cryptocom", "gemini",
  "bitstamp", "mexc", "upbit", "deribit", "bitmex", "robinhood", "bitgo",
  "paxos", "circle", "tether", "ripple", "grayscale", "blackrock",
  "fidelity", "wisdomtree", "franklin", "mantle", "frax", "lido",
  "rocket-pool", "rocket pool", "jito", "marinade", "ether.fi", "etherfi",
  "eigenlayer", "ethena", "aave", "uniswap", "compound", "curve", "convex",
  "maker", "makerdao", "sky", "spark", "pendle", "gmx", "jupiter", "drift",
  "kamino", "sanctum", "pancakeswap", "sushiswap", "balancer", "synthetix",
  "dydx", "ankr", "stader", "benqi", "stakewise", "origin", "swell",
  "renzo", "puffer", "venus", "justlend", "radiant", "morpho", "ondo",
  "solv", "yearn", "convex", "velodrome", "aerodrome", "camelot", "raydium",
  "orca", "trader-joe", "trader joe", "lfj", "benqi", "silo", "euler",
  "fluid", "instadapp", "lista", "alchemix", "abracadabra", "liquity",
  "threshold", "badger", "maple", "centrifuge", "goldfinch", "clearpool",
  "truefi", "ribbon", "aevo", "lyra", "derive", "vertex", "gains",
  "kwenta", "perpetual", "mux", "apollox", "level", "stargate", "wormhole",
  "layerzero", "axelar", "across", "synapse", "celer", "hop", "connext",
  "everclear", "debridge", "biconomy", "safe", "gnosis", "cow", "1inch",
  "paraswap", "velora", "kyber", "kyberswap", "odos", "openocean",
]);

const BRAND_STRIP_SUFFIXES = [
  "protocol", "finance", "network", "exchange", "swap", "dex", "dao",
  "labs", "app", "core", "pro", "lite", "classic", "legacy", "v1", "v2",
  "v3", "v4", "v5", "staking", "restaking", "lending", "lend", "yield",
  "vaults", "vault", "bridge", "markets", "market", "amm", "clmm", "dlmm",
  "perps", "perp", "options", "futures", "money", "capital", "fi",
];

const PRODUCT_DERIVATIVE_TOKENS = new Set([
  "staked", "wrapped", "bridged", "restaked", "liquid", "lst", "lrt",
  "native", "canonical", "synthetic", "staking", "restaking", "wrapper",
  "v1", "v2", "v3", "v4", "v5", "perp", "perps", "lend", "lending", "dex",
  "amm", "swap", "vault", "vaults", "earn", "yield", "pool", "pools",
  "farm", "bridge", "clmm", "dlmm", "orderbook", "options", "futures",
  "spot", "market", "markets", "stablecoin", "cdp", "treasury", "rwa",
  "credit", "borrow", "margin", "pro", "lite", "prime", "plus", "max",
  "boost", "core", "classic", "legacy", "ether", "bitcoin", "solana",
]);

const SHORT_ALLOWED_BRANDS = new Set(["gmx", "okx", "bnb", "htx", "cow", "lfj", "sky"]);

const WRAPPER_DESCRIPTION_PATTERNS = [
  /\bwrapped version of\b/i,
  /\b1:1 backed wrapped\b/i,
  /\bwrapped representation of\b/i,
  /\bcanonical wrapped\b/i,
  /\bliquid staked version of\b/i,
  /\bstaked version of\b/i,
  /\bwrapped token representing\b/i,
];

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^parent#/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractParentKey(parentProtocol: string | null | undefined): string | null {
  if (!parentProtocol || typeof parentProtocol !== "string") return null;
  const trimmed = parentProtocol.trim().toLowerCase();
  if (!trimmed || trimmed === "-" || trimmed === "null") return null;
  return normalizeSlug(trimmed);
}

function isMeaningfulString(val: string | number | null | undefined): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s.length > 0 && !PLACEHOLDER_SYMBOLS.has(s);
}

function extractBrandStem(slugOrName: string): string | null {
  const parts = normalizeSlug(slugOrName).split("-").filter(Boolean);
  while (parts.length > 1 && BRAND_STRIP_SUFFIXES.includes(parts[parts.length - 1])) {
    parts.pop();
  }
  const stem = parts.join("-");
  if (!stem) return null;
  if (stem.length < 4 && !SHORT_ALLOWED_BRANDS.has(stem)) return null;
  return stem;
}

export function hasLiveToken(
  protocol: Pick<RawProtocol, "symbol" | "gecko_id" | "cmcId" | "mcap" | "address">
): { hasToken: boolean; signals: string[] } {
  const signals: string[] = [];

  if (isMeaningfulString(protocol.gecko_id)) {
    signals.push(`gecko_id:${String(protocol.gecko_id).trim()}`);
  }
  if (isMeaningfulString(protocol.cmcId) && String(protocol.cmcId).trim() !== "0") {
    signals.push(`cmcId:${String(protocol.cmcId).trim()}`);
  }
  if (typeof protocol.mcap === "number" && Number.isFinite(protocol.mcap) && protocol.mcap > 0) {
    signals.push(`mcap:${Math.round(protocol.mcap)}`);
  }
  if (isMeaningfulString(protocol.address)) {
    signals.push("token_address");
  }
  if (isMeaningfulString(protocol.symbol)) {
    signals.push(`symbol:${String(protocol.symbol).trim().toUpperCase()}`);
  }

  return { hasToken: signals.length > 0, signals };
}

export function buildTokenizedIndex(
  protocols: RawProtocol[],
  parentProtocols: ParentProtocolRecord[] = []
): TokenizedIndex {
  const tokenizedParents = new Set<string>();
  const tokenizedBrands = new Set<string>(KNOWN_TOKENIZED_ISSUERS);
  const tokenizedSlugs = new Set<string>();
  const tokenizedSymbols = new Set<string>(KNOWN_TRADING_ASSETS);

  for (const parent of parentProtocols) {
    const check = hasLiveToken(parent);
    const key = extractParentKey(parent.id ?? parent.slug ?? parent.name);
    if (check.hasToken && key) {
      tokenizedParents.add(key);
      tokenizedSlugs.add(key);
      const stem = extractBrandStem(key);
      if (stem) tokenizedBrands.add(stem);
      if (isMeaningfulString(parent.symbol)) {
        tokenizedSymbols.add(String(parent.symbol).trim().toLowerCase());
      }
    }
  }

  for (const protocol of protocols) {
    const check = hasLiveToken(protocol);
    if (!check.hasToken) continue;

    const slug = normalizeSlug(protocol.slug ?? protocol.name ?? "");
    if (slug) {
      tokenizedSlugs.add(slug);
      const stem = extractBrandStem(slug);
      if (stem) tokenizedBrands.add(stem);
    }

    const parentKey = extractParentKey(protocol.parentProtocol ?? protocol.parentProtocolSlug);
    if (parentKey) {
      tokenizedParents.add(parentKey);
      const pStem = extractBrandStem(parentKey);
      if (pStem) tokenizedBrands.add(pStem);
    }

    if (isMeaningfulString(protocol.symbol)) {
      const sym = String(protocol.symbol).trim().toLowerCase();
      if (sym.length >= 2) tokenizedSymbols.add(sym);
    }
  }

  return { tokenizedParents, tokenizedBrands, tokenizedSlugs, tokenizedSymbols };
}

export function detectWrappedOrStakedDerivative(
  protocol: RawProtocol,
  index: TokenizedIndex
): { isDerivative: boolean; signals: string[]; reason: FilterReason | null } {
  const signals: string[] = [];
  const slug = normalizeSlug(protocol.slug ?? protocol.name ?? "");
  const name = normalizeName(protocol.name ?? protocol.slug ?? "");
  const tokens = slug.split("-").filter(Boolean);
  const parentKey = extractParentKey(protocol.parentProtocol ?? protocol.parentProtocolSlug);

  if (parentKey && index.tokenizedParents.has(parentKey)) {
    signals.push(`tokenized_parent:${parentKey}`);
    return { isDerivative: true, signals, reason: "tokenized_parent" };
  }

  // Direct wrapped/staked/bridged single-asset naming (e.g. "Wrapped Bitcoin", "Staked USDe")
  if (
    tokens.length >= 2 &&
    (tokens[0] === "wrapped" || tokens[0] === "staked" || tokens[0] === "bridged" || tokens[0] === "canonical")
  ) {
    const restHasTradingAsset = tokens.slice(1).some((t) => KNOWN_TRADING_ASSETS.has(t));
    if (restHasTradingAsset || tokens.length <= 3) {
      signals.push(`direct_wrapper_prefix:${tokens[0]}`);
      return { isDerivative: true, signals, reason: "wrapped_or_staked_derivative" };
    }
  }

  // "<Brand> Staked <Asset>" / "<Brand> Wrapped <Asset>" / "<Brand> Liquid Staked <Asset>"
  for (let i = 0; i < tokens.length - 1; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];
    if (
      (cur === "wrapped" || cur === "staked" || cur === "bridged" || cur === "restaked") &&
      KNOWN_TRADING_ASSETS.has(next)
    ) {
      signals.push(`asset_wrapper_phrase:${cur}-${next}`);
      return { isDerivative: true, signals, reason: "wrapped_or_staked_derivative" };
    }
  }

  // Brand prefix matching a tokenized protocol or CEX issuer
  for (let len = Math.min(2, tokens.length - 1); len >= 1; len--) {
    const prefix = tokens.slice(0, len).join("-");
    const remainder = tokens.slice(len);
    if (!index.tokenizedBrands.has(prefix) && !index.tokenizedSlugs.has(prefix)) continue;

    const hasDerivativeOrProductWord = remainder.some(
      (t) => PRODUCT_DERIVATIVE_TOKENS.has(t) || KNOWN_TRADING_ASSETS.has(t)
    );
    if (hasDerivativeOrProductWord) {
      const isWrapper = remainder.some(
        (t) =>
          t === "wrapped" ||
          t === "staked" ||
          t === "bridged" ||
          t === "restaked" ||
          t === "lst" ||
          t === "lrt" ||
          KNOWN_TRADING_ASSETS.has(t)
      );
      signals.push(`tokenized_brand_product:${prefix}->${remainder.join("-")}`);
      return {
        isDerivative: true,
        signals,
        reason: isWrapper ? "wrapped_or_staked_derivative" : "tokenized_parent",
      };
    }
  }

  // Canonical bridges of already-tokenized L1/L2 networks
  const categoryLower = (protocol.category ?? "").trim().toLowerCase();
  if (categoryLower === "canonical bridge") {
    const first = tokens[0] ?? "";
    if (KNOWN_TRADING_ASSETS.has(first) || index.tokenizedBrands.has(first)) {
      signals.push(`tokenized_canonical_bridge:${first}`);
      return { isDerivative: true, signals, reason: "wrapped_or_staked_derivative" };
    }
  }

  // Explicit 1:1 wrapped description check
  const desc = protocol.description ?? "";
  if (desc) {
    for (const pattern of WRAPPER_DESCRIPTION_PATTERNS) {
      if (pattern.test(desc)) {
        signals.push(`description_wrapper_match`);
        return { isDerivative: true, signals, reason: "wrapped_or_staked_derivative" };
      }
    }
  }

  // Exact match of normalized name against a tokenized issuer with wrapped/staked cue
  for (const issuer of KNOWN_TOKENIZED_ISSUERS) {
    if (
      (name.startsWith(`${issuer} `) || slug.startsWith(`${issuer}-`)) &&
      (name.includes("staked") || name.includes("wrapped") || name.includes("bridged"))
    ) {
      signals.push(`issuer_derivative:${issuer}`);
      return { isDerivative: true, signals, reason: "wrapped_or_staked_derivative" };
    }
  }

  return { isDerivative: false, signals, reason: null };
}

function hasEconomicActivity(protocol: RawProtocol, minTvl: number): boolean {
  const tvl = typeof protocol.tvl === "number" && Number.isFinite(protocol.tvl) ? protocol.tvl : 0;
  if (tvl >= Math.max(minTvl, 1)) return true;

  const metricFields = [
    protocol.fees24h,
    protocol.fees7d,
    protocol.fees30d,
    protocol.revenue24h,
    protocol.revenue7d,
    protocol.revenue30d,
    protocol.volume24h,
    protocol.volume7d,
    protocol.volume30d,
  ];
  for (const m of metricFields) {
    if (typeof m === "number" && Number.isFinite(m) && m > 0) return true;
  }
  if (Array.isArray(protocol.raises) && protocol.raises.length > 0) return true;
  return minTvl <= 0 && tvl >= 0;
}

export function filterProtocols(
  protocols: RawProtocol[],
  options: FilterOptions = {}
): FilterResult {
  const minTvl = options.minTvl ?? 0;
  const watchlistRaw = options.watchlist ?? [];
  const watchlistMap = new Map<string, string>();
  for (const entry of watchlistRaw) {
    const key = normalizeSlug(entry);
    if (key && !watchlistMap.has(key)) {
      watchlistMap.set(key, entry);
    }
  }

  const tokenizedIndex = buildTokenizedIndex(protocols, options.parentProtocols ?? []);

  const excludedByReason: Record<FilterReason, number> = {
    tokenless_eligible: 0,
    watchlist_override: 0,
    has_live_token: 0,
    tokenized_parent: 0,
    wrapped_or_staked_derivative: 0,
    excluded_category: 0,
    inactive_or_low_tvl: 0,
    duplicate_slug: 0,
  };

  // Deduplicate deterministically by slug, preferring higher TVL
  const deduped = new Map<string, RawProtocol>();
  const duplicates: RawProtocol[] = [];

  const sortedInput = [...protocols].sort((a, b) => {
    const sa = normalizeSlug(a.slug ?? a.name ?? String(a.id ?? ""));
    const sb = normalizeSlug(b.slug ?? b.name ?? String(b.id ?? ""));
    if (sa !== sb) return sa.localeCompare(sb);
    return (b.tvl ?? 0) - (a.tvl ?? 0);
  });

  for (const proto of sortedInput) {
    const slug = normalizeSlug(proto.slug ?? proto.name ?? String(proto.id ?? ""));
    if (!slug) continue;
    const existing = deduped.get(slug);
    if (!existing) {
      deduped.set(slug, proto);
    } else if ((proto.tvl ?? 0) > (existing.tvl ?? 0)) {
      duplicates.push(existing);
      deduped.set(slug, proto);
    } else {
      duplicates.push(proto);
    }
  }

  const eligible: FilteredProtocol[] = [];
  const excluded: FilteredProtocol[] = [];
  const matchedWatchlistKeys = new Set<string>();

  for (const dup of duplicates) {
    const slug = normalizeSlug(dup.slug ?? dup.name ?? String(dup.id ?? ""));
    excludedByReason.duplicate_slug += 1;
    excluded.push({
      protocol: dup,
      slug,
      name: (dup.name ?? slug).trim(),
      parentId: extractParentKey(dup.parentProtocol ?? dup.parentProtocolSlug),
      isWatchlist: false,
      watchlistKey: null,
      filterReason: "duplicate_slug",
      tokenSignals: [],
      derivativeSignals: [],
    });
  }

  for (const [slug, proto] of deduped.entries()) {
    const name = (proto.name ?? slug).trim();
    const nameSlug = normalizeSlug(name);
    const parentId = extractParentKey(proto.parentProtocol ?? proto.parentProtocolSlug);

    const watchlistKey =
      watchlistMap.get(slug) ??
      watchlistMap.get(nameSlug) ??
      (parentId ? watchlistMap.get(parentId) ?? null : null);
    const isWatchlist = watchlistKey !== null;
    if (isWatchlist && watchlistKey) {
      matchedWatchlistKeys.add(normalizeSlug(watchlistKey));
    }

    const tokenCheck = hasLiveToken(proto);
    const derivCheck = detectWrappedOrStakedDerivative(proto, tokenizedIndex);
    const categoryLower = (proto.category ?? "").trim().toLowerCase();
    const isExcludedCategory = EXCLUDED_CATEGORIES.has(categoryLower);
    const isActive = hasEconomicActivity(proto, minTvl);

    let rejectReason: FilterReason | null = null;
    if (tokenCheck.hasToken) {
      rejectReason = "has_live_token";
    } else if (isExcludedCategory) {
      rejectReason = "excluded_category";
    } else if (derivCheck.isDerivative && derivCheck.reason) {
      rejectReason = derivCheck.reason;
    } else if (!isActive) {
      rejectReason = "inactive_or_low_tvl";
    }

    if (rejectReason === null) {
      excludedByReason.tokenless_eligible += 1;
      eligible.push({
        protocol: proto,
        slug,
        name,
        parentId,
        isWatchlist,
        watchlistKey,
        filterReason: "tokenless_eligible",
        tokenSignals: tokenCheck.signals,
        derivativeSignals: derivCheck.signals,
      });
    } else if (isWatchlist) {
      excludedByReason.watchlist_override += 1;
      eligible.push({
        protocol: proto,
        slug,
        name,
        parentId,
        isWatchlist: true,
        watchlistKey,
        filterReason: "watchlist_override",
        tokenSignals: tokenCheck.signals,
        derivativeSignals: derivCheck.signals,
      });
    } else {
      excludedByReason[rejectReason] += 1;
      excluded.push({
        protocol: proto,
        slug,
        name,
        parentId,
        isWatchlist: false,
        watchlistKey: null,
        filterReason: rejectReason,
        tokenSignals: tokenCheck.signals,
        derivativeSignals: derivCheck.signals,
      });
    }
  }

  eligible.sort((a, b) => {
    const tvlDiff = (b.protocol.tvl ?? 0) - (a.protocol.tvl ?? 0);
    if (tvlDiff !== 0) return tvlDiff;
    return a.slug.localeCompare(b.slug);
  });

  excluded.sort((a, b) => a.slug.localeCompare(b.slug));

  const watchlistMatched: string[] = [];
  const watchlistMissing: string[] = [];
  for (const [normKey, rawLabel] of watchlistMap.entries()) {
    if (matchedWatchlistKeys.has(normKey)) {
      watchlistMatched.push(rawLabel);
    } else {
      watchlistMissing.push(rawLabel);
    }
  }
  watchlistMatched.sort((a, b) => a.localeCompare(b));
  watchlistMissing.sort((a, b) => a.localeCompare(b));

  return {
    eligible,
    excluded,
    tokenizedIndex,
    summary: {
      totalScanned: protocols.length,
      eligibleCount: eligible.length,
      excludedCount: excluded.length,
      excludedByReason,
      watchlistTotal: watchlistMap.size,
      watchlistMatched,
      watchlistMissing,
    },
  };
}