export interface RawRaise {
  date?: number | string;
  amount?: number | null;
  round?: string | null;
  leadInvestors?: string[];
  otherInvestors?: string[];
  valuation?: number | string | null;
}

export interface RawProtocol {
  id: string;
  name: string;
  slug: string;
  symbol?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  address?: string | null;
  parentProtocol?: string | null;
  parentProtocolId?: string | null;
  category?: string | null;
  tvl?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  chains?: string[];
  chainTvls?: Record<string, number>;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  staking?: number | null;
  pool2?: number | null;
  borrowed?: number | null;
  url?: string | null;
  description?: string | null;
  twitter?: string | null;
  audits?: string | number | null;
  audit_links?: string[] | null;
  listedAt?: number | null;
  oracles?: string[] | null;
  forkedFrom?: string[] | null;
  module?: string | null;
  raises?: RawRaise[];
  fees24h?: number | null;
  fees7d?: number | null;
  fees30d?: number | null;
  revenue24h?: number | null;
  revenue7d?: number | null;
  revenue30d?: number | null;
  volume24h?: number | null;
  volume7d?: number | null;
  volume30d?: number | null;
  hasToken?: boolean | null;
  token?: string | null;
  [key: string]: unknown;
}

export interface RawParentProtocol {
  id: string;
  name?: string;
  slug?: string;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  address?: string | null;
  symbol?: string | null;
  mcap?: number | null;
  chains?: string[];
  [key: string]: unknown;
}

export type FilterReason =
  | "live_gecko_id"
  | "live_cmc_id"
  | "live_mcap"
  | "live_symbol"
  | "live_token_address"
  | "live_has_token_flag"
  | "tokenized_parent_protocol"
  | "tokenized_brand_derivative"
  | "wrapped_asset_product"
  | "staked_derivative_product"
  | "tokenized_chain_bridge"
  | "cex_reserve_tracker"
  | "tradfi_custodial_product"
  | "dead_or_zero_activity";

export interface FilterDecision {
  slug: string;
  name: string;
  eligible: boolean;
  reasons: FilterReason[];
  signals: string[];
  normalizedParent: string | null;
  derivativeOf: string | null;
  confidence: number;
  isWatchlist: boolean;
}

export interface ParentTokenIndex {
  tokenizedParents: Map<string, string>;
  tokenizedSlugs: Map<string, string>;
  parentNames: Map<string, string>;
}

export interface FilterOptions {
  parentProtocols?: readonly RawParentProtocol[];
  watchlistSlugs?: ReadonlySet<string>;
  minTvlUsd?: number;
}

export interface FilterSummary {
  total: number;
  eligibleCount: number;
  excludedCount: number;
  reasonCounts: Record<string, number>;
  watchlistTotal: number;
  watchlistIncluded: number;
  watchlistExcluded: string[];
}

export interface FilterBatchResult {
  eligible: RawProtocol[];
  excluded: RawProtocol[];
  decisions: Map<string, FilterDecision>;
  summary: FilterSummary;
}

const PLACEHOLDER_TOKENS = new Set([
  "", "-", "--", "0", "?", "none", "null", "undefined", "unknown",
  "n/a", "na", "tbd", "tba", "no", "false", "points", "pts",
]);

const KNOWN_CUSTODIAL_OR_CEX_PARENTS = new Set([
  "binance", "coinbase", "okx", "bybit", "bitget", "kraken", "kucoin", "gate",
  "gate.io", "htx", "huobi", "crypto.com", "bitfinex", "gemini", "robinhood",
  "paypal", "tether", "circle", "paxos", "blackrock", "franklin-templeton",
  "wisdomtree", "21co", "21shares", "first-digital", "societe-generale",
]);

const WRAPPED_OR_LST_EXACT_SLUGS = new Set([
  "wbtc", "wrapped-bitcoin", "weth", "wrapped-ether", "wsol", "wrapped-solana",
  "wbnb", "wavax", "wmatic", "wpol", "cbbtc", "coinbase-wrapped-btc", "cbeth",
  "coinbase-wrapped-staked-eth", "cbxrp", "cbdoge", "cbada", "cbltc", "btcb",
  "binance-bitcoin", "wbeth", "binance-staked-eth", "bnsol", "binance-staked-sol",
  "bbsol", "bybit-staked-sol", "bgsol", "bitget-staked-sol", "kraken-staked-eth",
  "tbtc", "renbtc", "hbtc", "huobi-btc", "steth", "wsteth", "reth", "meth",
  "mantle-staked-eth", "frxeth", "sfrxeth", "jupsol", "jupiter-staked-sol",
  "buidl", "blackrock-buidl", "benji", "usyc", "xaut", "tether-gold", "paxg",
  "paxos-gold", "pyusd", "paypal-usd", "fdusd",
]);

const PRODUCT_SUB_SUFFIXES = new Set([
  "v1", "v2", "v3", "v4", "v5", "amm", "clmm", "dex", "swap", "perps", "perp",
  "perpetuals", "perpetual-exchange", "lending", "lend", "borrow", "staking",
  "staked", "liquid", "liquid-staking", "restaking", "earn", "vaults", "vault",
  "bridge", "pool", "pools", "farm", "yield", "markets", "market", "spot",
  "futures", "options", "launchpad", "pro", "lite", "classic", "legacy",
  "eth", "btc", "sol", "usd",
]);

const MAJOR_TOKENIZED_CHAIN_BRIDGES = new Set([
  "ethereum", "bitcoin", "solana", "avalanche", "polygon", "arbitrum", "optimism",
  "bnb", "bsc", "fantom", "sonic", "near", "tron", "ton", "sui", "aptos",
  "cosmos", "celo", "gnosis", "cronos", "starknet", "zksync", "mantle", "metis",
  "ronin", "cardano", "polkadot", "algorand", "hedera", "kava", "sei",
  "injective", "celestia",
]);

const WRAPPED_NAME_RE =
  /\b(wrapped|bridged|pegged|mapped)\s+(bitcoin|btc|ether|ethereum|eth|solana|sol|bnb|avax|matic|pol|usdc|usdt|dai|sui|ton|xrp|doge|ada|ltc|tokens?|assets?)\b/i;
const LEADING_WRAPPED_RE = /^wrapped\s+/i;
const STAKED_ASSET_NAME_RE =
  /\b(staked|liquid\s+staked|restaked)\s+(eth|ether|ethereum|btc|bitcoin|sol|solana|bnb|avax|matic|pol|sui|ton|apt|near|atom|ftm|s|tia|inj|sei|ada|dot|trx|cro|kava|osmo|hype|bera|usde|usds|dai|usdc|usdt|usd|xrp|link|aave|gmx|pendle|jup|ray|ena|eigen)\b/i;
const CEX_PRODUCT_NAME_RE =
  /^(binance|coinbase|okx|bybit|bitget|kraken|kucoin|gate(\.io)?|htx|huobi|crypto\.com|bitfinex|robinhood|gemini)\s+(staked|wrapped|liquid|bridged|btc|eth|sol|usd|earn|yield|staking|restaking|wallet|dex|bridge|bitcoin|ether)/i;
const TRADFI_ISSUER_NAME_RE =
  /^(blackrock|franklin\s+templeton|wisdomtree|paypal|tether|circle|paxos|societe\s+generale|ubs|jpmorgan|fidelity|vanguard|goldman|hamilton\s+lane|apollo|vaneck|21shares|21\.co|grayscale|bitwise|first\s+digital)\b/i;
const WRAPPER_DESC_RE =
  /\b(1:1\s+backed\s+wrapped|wrapped\s+version\s+of|wrapped\s+representation\s+of|custodial\s+wrapped|liquid\s+staking\s+token\s+(issued|backed)\s+by\s+(binance|coinbase|bybit|bitget|okx|kraken))\b/i;

function parsePositiveFinite(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

export function normalizeSlug(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeParentId(value?: string | null): string | null {
  const cleaned = normalizeSlug(value).replace(/^parent#/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function isPlaceholderTokenValue(value?: string | number | null): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value) || value <= 0;
  return PLACEHOLDER_TOKENS.has(String(value).trim().toLowerCase());
}

export function isValidTokenAddress(address?: string | null): boolean {
  if (isPlaceholderTokenValue(address)) return false;
  const raw = String(address).trim();
  if (/^https?:\/\//i.test(raw)) return false;
  const colonIdx = raw.indexOf(":");
  const body = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : raw;
  if (body.length < 8 || isPlaceholderTokenValue(body)) return false;
  return !/^0x0+(?:dead)?$/i.test(body);
}

export function detectDirectToken(
  protocol: Pick<
    RawProtocol,
    "gecko_id" | "cmcId" | "mcap" | "symbol" | "address" | "hasToken"
  >
): Array<{ reason: FilterReason; detail: string }> {
  const hits: Array<{ reason: FilterReason; detail: string }> = [];

  if (!isPlaceholderTokenValue(protocol.gecko_id)) {
    hits.push({ reason: "live_gecko_id", detail: `gecko_id=${String(protocol.gecko_id).trim()}` });
  }
  if (!isPlaceholderTokenValue(protocol.cmcId)) {
    hits.push({ reason: "live_cmc_id", detail: `cmcId=${String(protocol.cmcId).trim()}` });
  }
  const mcap = parsePositiveFinite(protocol.mcap);
  if (mcap > 0) {
    hits.push({ reason: "live_mcap", detail: `mcap=$${Math.round(mcap)}` });
  }
  if (!isPlaceholderTokenValue(protocol.symbol)) {
    hits.push({ reason: "live_symbol", detail: `symbol=${String(protocol.symbol).trim()}` });
  }
  if (isValidTokenAddress(protocol.address)) {
    hits.push({ reason: "live_token_address", detail: `address=${String(protocol.address).trim()}` });
  }
  if (protocol.hasToken === true) {
    hits.push({ reason: "live_has_token_flag", detail: "hasToken=true" });
  }

  return hits;
}

export function buildParentIndex(
  protocols: readonly RawProtocol[],
  parentProtocols: readonly RawParentProtocol[] = []
): ParentTokenIndex {
  const tokenizedParents = new Map<string, string>();
  const tokenizedSlugs = new Map<string, string>();
  const parentNames = new Map<string, string>();

  for (const pp of parentProtocols) {
    if (!pp) continue;
    const keys = new Set<string>();
    const idKey = normalizeParentId(pp.id);
    const slugKey = normalizeParentId(pp.slug);
    if (idKey) keys.add(idKey);
    if (slugKey) keys.add(slugKey);
    if (keys.size === 0) continue;

    const hasToken = detectDirectToken(pp).length > 0;
    const label = !isPlaceholderTokenValue(pp.symbol)
      ? String(pp.symbol).trim()
      : String(pp.gecko_id || pp.name || idKey || slugKey).trim();

    for (const key of keys) {
      if (pp.name) parentNames.set(key, pp.name);
      if (hasToken) {
        tokenizedParents.set(key, label);
        tokenizedSlugs.set(key, label);
      }
    }
  }

  for (const p of protocols) {
    if (!p) continue;
    const slug = normalizeSlug(p.slug || p.id);
    const parentKey = normalizeParentId(p.parentProtocol ?? p.parentProtocolId);
    if (detectDirectToken(p).length === 0) continue;

    const label = !isPlaceholderTokenValue(p.symbol)
      ? `${p.name} (${String(p.symbol).trim()})`
      : `${p.name} (${String(p.gecko_id || "token").trim()})`;

    if (slug) tokenizedSlugs.set(slug, label);
    if (parentKey && !tokenizedParents.has(parentKey)) {
      tokenizedParents.set(parentKey, label);
    }
  }

  for (const p of protocols) {
    if (!p) continue;
    const parentKey = normalizeParentId(p.parentProtocol ?? p.parentProtocolId);
    if (parentKey && !tokenizedParents.has(parentKey) && tokenizedSlugs.has(parentKey)) {
      tokenizedParents.set(parentKey, tokenizedSlugs.get(parentKey)!);
    }
  }

  return { tokenizedParents, tokenizedSlugs, parentNames };
}

function findTokenizedBrandBase(slug: string, index: ParentTokenIndex): string | null {
  const parts = slug.split("-").filter((part) => part.length > 0);
  if (parts.length < 2) return null;

  for (let split = parts.length - 1; split >= 1; split--) {
    const base = parts.slice(0, split).join("-");
    if (base.length < 4) continue;
    const tail = parts.slice(split);
    const joinedSuffix = tail.join("-");
    const suffixMatches =
      PRODUCT_SUB_SUFFIXES.has(joinedSuffix) ||
      tail.every((segment) => PRODUCT_SUB_SUFFIXES.has(segment));
    if (!suffixMatches) continue;
    const hit = index.tokenizedSlugs.get(base) ?? index.tokenizedParents.get(base);
    if (hit) return hit;
  }
  return null;
}

function isTokenizedChainBridge(
  protocol: RawProtocol,
  index: ParentTokenIndex
): string | null {
  const cat = normalizeSlug(protocol.category);
  if (cat !== "canonical bridge" && cat !== "bridge") return null;

  const name = String(protocol.name ?? "").trim();
  const slug = normalizeSlug(protocol.slug);
  const isBridgeNamed = /\bbridge\b/i.test(name) || slug.endsWith("-bridge");
  if (!isBridgeNamed && cat !== "canonical bridge") return null;

  const prefix = slug
    .replace(/-(canonical-)?bridge$/, "")
    .replace(/-(pos|one|era|chain|mainnet)$/, "");
  if (!prefix) return null;

  if (
    MAJOR_TOKENIZED_CHAIN_BRIDGES.has(prefix) ||
    index.tokenizedSlugs.has(prefix) ||
    index.tokenizedParents.has(prefix)
  ) {
    return prefix;
  }
  return null;
}

function hasAnyActivity(protocol: RawProtocol, minTvlUsd: number): boolean {
  const safeMinTvl = Number.isFinite(minTvlUsd) && minTvlUsd > 0 ? minTvlUsd : 0;
  if (parsePositiveFinite(protocol.tvl) > safeMinTvl) return true;
  const metrics = [
    protocol.fees24h, protocol.fees7d, protocol.fees30d,
    protocol.revenue24h, protocol.revenue7d, protocol.revenue30d,
    protocol.volume24h, protocol.volume7d, protocol.volume30d,
  ];
  for (const m of metrics) {
    if (parsePositiveFinite(m) > 0) return true;
  }
  if (safeMinTvl === 0 && parsePositiveFinite(protocol.borrowed) > 0) return true;
  return Array.isArray(protocol.raises) && protocol.raises.length > 0;
}

export function classifyProtocol(
  protocol: RawProtocol,
  index: ParentTokenIndex,
  options: FilterOptions = {}
): FilterDecision {
  const slug = normalizeSlug(protocol.slug || protocol.id);
  const name = String(protocol.name ?? slug).trim() || slug;
  const category = normalizeSlug(protocol.category);
  const desc = String(protocol.description ?? "");
  const normalizedParent = normalizeParentId(protocol.parentProtocol ?? protocol.parentProtocolId);
  const isWatchlist = Boolean(slug && options.watchlistSlugs?.has(slug));
  const minTvlUsd = options.minTvlUsd ?? 0;

  const reasons: FilterReason[] = [];
  const reasonSet = new Set<FilterReason>();
  const signals: string[] = [];
  let derivativeOf: string | null = null;

  const addReason = (reason: FilterReason, signal: string): void => {
    if (!reasonSet.has(reason)) {
      reasonSet.add(reason);
      reasons.push(reason);
    }
    signals.push(signal);
  };

  const directHits = detectDirectToken(protocol);
  for (const hit of directHits) {
    addReason(hit.reason, `Live token indicator: ${hit.detail}`);
  }

  if (normalizedParent) {
    const parentToken = index.tokenizedParents.get(normalizedParent);
    if (parentToken) {
      derivativeOf = parentToken;
      addReason(
        "tokenized_parent_protocol",
        `Parent protocol "${normalizedParent}" already trades via ${parentToken}`
      );
    } else if (KNOWN_CUSTODIAL_OR_CEX_PARENTS.has(normalizedParent)) {
      derivativeOf = normalizedParent;
      addReason(
        "tokenized_parent_protocol",
        `Parent entity "${normalizedParent}" is a custodial/CEX or corporate issuer`
      );
    }
  }

  if (reasons.length === 0) {
    const brandHit = findTokenizedBrandBase(slug, index);
    if (brandHit) {
      derivativeOf = brandHit;
      addReason(
        "tokenized_brand_derivative",
        `Sub-product slug matches tokenized protocol family: ${brandHit}`
      );
    }
  }

  if (category === "cex") {
    addReason("cex_reserve_tracker", "Category is CEX reserve tracker");
  }

  if (
    category === "wrapped" ||
    category === "wrapped tokens" ||
    WRAPPED_OR_LST_EXACT_SLUGS.has(slug) ||
    LEADING_WRAPPED_RE.test(name) ||
    WRAPPED_NAME_RE.test(name) ||
    WRAPPER_DESC_RE.test(desc)
  ) {
    derivativeOf = derivativeOf ?? "wrapped-traded-asset";
    addReason(
      "wrapped_asset_product",
      "Identified as a wrapped or 1:1 backed derivative of a traded asset"
    );
  }

  if (STAKED_ASSET_NAME_RE.test(name) || CEX_PRODUCT_NAME_RE.test(name)) {
    derivativeOf = derivativeOf ?? "staked-traded-asset";
    addReason(
      "staked_derivative_product",
      "Identified as a staked or CEX-issued derivative of a traded asset"
    );
  }

  if (TRADFI_ISSUER_NAME_RE.test(name)) {
    derivativeOf = derivativeOf ?? (name.split(/\s+/)[0] || "tradfi");
    addReason(
      "tradfi_custodial_product",
      "Identified as a TradFi or corporate custodial product"
    );
  }

  const bridgeChain = isTokenizedChainBridge(protocol, index);
  if (bridgeChain) {
    derivativeOf = derivativeOf ?? bridgeChain;
    addReason(
      "tokenized_chain_bridge",
      `Canonical bridge for already-tokenized chain (${bridgeChain})`
    );
  }

  if (!isWatchlist && reasons.length === 0 && !hasAnyActivity(protocol, minTvlUsd)) {
    addReason(
      "dead_or_zero_activity",
      "No positive TVL, fee, volume, or funding activity recorded"
    );
  }

  const eligible = reasons.length === 0;
  let confidence = eligible
    ? 0.94
    : directHits.length > 0
      ? 0.99
      : reasons.length === 1 && reasons[0] === "dead_or_zero_activity"
        ? 0.92
        : 0.97;

  if (eligible) {
    signals.push("No symbol, CoinGecko ID, CMC ID, market cap, or token contract recorded");
    if (normalizedParent) {
      signals.push(`Parent "${normalizedParent}" has no live token in snapshot`);
    }
    if (parsePositiveFinite(protocol.pool2) > 0) {
      confidence = Math.min(confidence, 0.72);
      signals.push("Note: non-zero pool2 TVL recorded; verify no unlisted governance token");
    }
    if (parsePositiveFinite(protocol.staking) > 0) {
      confidence = Math.min(confidence, 0.78);
      signals.push("Note: non-zero staking TVL recorded; verify no unlisted governance token");
    }
    if (isWatchlist) {
      signals.push("Confirmed on radar watchlist");
    }
  }

  return {
    slug,
    name,
    eligible,
    reasons,
    signals,
    normalizedParent,
    derivativeOf,
    confidence,
    isWatchlist,
  };
}

export function filterProtocols(
  protocols: readonly RawProtocol[],
  options: FilterOptions = {}
): FilterBatchResult {
  const safeProtocols = Array.isArray(protocols) ? protocols : [];
  const index = buildParentIndex(safeProtocols, options.parentProtocols);

  let normalizedWatchlist: ReadonlySet<string> | undefined;
  if (options.watchlistSlugs && options.watchlistSlugs.size > 0) {
    const norm = new Set<string>();
    for (const entry of options.watchlistSlugs) {
      const clean = normalizeSlug(entry);
      if (clean) norm.add(clean);
    }
    normalizedWatchlist = norm;
  }

  const effectiveOptions: FilterOptions = {
    ...options,
    watchlistSlugs: normalizedWatchlist,
  };

  const eligible: RawProtocol[] = [];
  const excluded: RawProtocol[] = [];
  const decisions = new Map<string, FilterDecision>();
  const reasonCounts: Record<string, number> = {};
  const watchlistExcludedSet = new Set<string>();
  let watchlistTotal = 0;
  let watchlistIncluded = 0;

  for (let i = 0; i < safeProtocols.length; i++) {
    const protocol = safeProtocols[i];
    if (!protocol) continue;
    const decision = classifyProtocol(protocol, index, effectiveOptions);
    decisions.set(decision.slug || `protocol-${i}`, decision);

    if (decision.isWatchlist) watchlistTotal += 1;

    if (decision.eligible) {
      eligible.push(protocol);
      if (decision.isWatchlist) watchlistIncluded += 1;
    } else {
      excluded.push(protocol);
      if (decision.isWatchlist && decision.slug) {
        watchlistExcludedSet.add(decision.slug);
      }
      for (const reason of decision.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      }
    }
  }

  const sortedReasons: Record<string, number> = {};
  for (const key of Object.keys(reasonCounts).sort()) {
    sortedReasons[key] = reasonCounts[key];
  }

  return {
    eligible,
    excluded,
    decisions,
    summary: {
      total: eligible.length + excluded.length,
      eligibleCount: eligible.length,
      excludedCount: excluded.length,
      reasonCounts: sortedReasons,
      watchlistTotal,
      watchlistIncluded,
      watchlistExcluded: Array.from(watchlistExcludedSet).sort(),
    },
  };
}