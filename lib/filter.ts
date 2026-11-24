export interface ProtocolLike {
  id?: string | number;
  name?: string | null;
  slug?: string | null;
  symbol?: string | null;
  address?: string | null;
  gecko_id?: string | null;
  geckoId?: string | null;
  cmcId?: string | number | null;
  cmc_id?: string | number | null;
  mcap?: number | null;
  marketCap?: number | null;
  fdv?: number | null;
  tvl?: number | null;
  category?: string | null;
  parentProtocol?: string | null;
  parent_protocol?: string | null;
  parentProtocolId?: string | null;
  description?: string | null;
  url?: string | null;
  chains?: readonly string[];
  chainTvls?: Record<string, number>;
  listedAt?: number | null;
  tokenless?: boolean;
  hasToken?: boolean;
  [key: string]: unknown;
}

export type ExclusionReason =
  | "traded_token"
  | "parent_has_token"
  | "brand_has_token"
  | "wrapped_derivative"
  | "staked_derivative"
  | "receipt_derivative"
  | "custodian_product"
  | "excluded_category"
  | "below_min_tvl";

export interface FilterDecision {
  eligible: boolean;
  tokenless: boolean;
  reason: ExclusionReason | "eligible";
  reasons: ExclusionReason[];
  detail: string;
  signals: string[];
  matchedParent?: string;
}

export interface ExcludedProtocol<T extends ProtocolLike = ProtocolLike> {
  protocol: T;
  decision: FilterDecision;
}

export interface TradedIndex {
  tradedSlugs: Set<string>;
  tradedParents: Set<string>;
  tradedBrandPrefixes: Set<string>;
  tradedSymbols: Set<string>;
  tradedNames: Set<string>;
}

export interface FilterOptions {
  minTvl?: number;
  watchlist?: ReadonlySet<string> | readonly string[];
  excludeCategories?: ReadonlySet<string> | readonly string[];
  extraTradedSlugs?: ReadonlySet<string> | readonly string[];
  extraTradedParents?: ReadonlySet<string> | readonly string[];
}

export interface FilterStats {
  total: number;
  eligible: number;
  excluded: number;
  byReason: Record<ExclusionReason, number>;
}

export interface FilterResult<T extends ProtocolLike = ProtocolLike> {
  included: T[];
  tokenless: T[];
  candidates: T[];
  excluded: ExcludedProtocol<T>[];
  decisions: Map<string, FilterDecision>;
  stats: FilterStats;
  tradedIndex: TradedIndex;
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "-",
  "--",
  "---",
  "none",
  "n/a",
  "na",
  "null",
  "undefined",
  "?",
  "tbd",
  "tba",
  "soon",
  "points",
  "pts",
  "xp",
  "0",
  "0x0",
  "0x0000000000000000000000000000000000000000",
]);

const DEFAULT_EXCLUDED_CATEGORIES = new Set([
  "cex",
  "canonical bridge",
  "wrapped asset",
  "bridged asset",
  "wrapper",
  "treasury",
  "reserve",
  "foundation",
]);

const GENERIC_BRAND_WORDS = new Set([
  "base", "core", "prime", "open", "meta", "next", "zero", "one", "omni",
  "hyper", "super", "ultra", "liquid", "stake", "swap", "lend", "yield",
  "vault", "bridge", "chain", "coin", "token", "crypto", "defi", "web3",
  "alpha", "delta", "sigma", "gamma", "omega", "nexus", "pulse", "orbit",
  "nova", "apex", "edge", "peak", "unit", "grid", "flow", "wave", "spark",
  "drift", "boost", "margin", "credit", "index", "stable", "dollar", "cash",
  "gold", "silver", "layer", "point", "relay", "light", "extend", "order",
  "trade", "market", "world", "global", "clear", "true", "real", "blue",
  "red", "sun", "moon", "star", "iron", "stone", "fluid", "solid", "smart",
  "fast", "safe", "free", "pure", "deep", "high", "wide", "long", "short",
  "first", "multi", "cross", "inter", "extra", "micro", "macro", "mega",
  "giga", "terra", "astro", "cyber", "pixel", "block", "hash", "mint",
  "burn", "pool", "farm", "bank", "fund", "labs", "studio", "network",
  "finance", "protocol", "exchange", "capital", "ventures", "money", "pay",
]);

const CUSTODIAN_PREFIXES = new Set([
  "binance", "coinbase", "okx", "bybit", "kraken", "bitget", "kucoin",
  "gate", "htx", "huobi", "gemini", "bitfinex", "bitstamp", "robinhood",
  "upbit", "bithumb", "mexc", "hashkey", "bitgo", "anchorage", "fireblocks",
  "copper", "ledger", "figment", "kiln", "blockdaemon", "everstake",
  "allnodes", "infstones", "crypto-com", "chorus-one", "p2p-org",
]);

const MAJOR_ASSETS_PATTERN =
  "btc|bitcoin|eth|ether|ethereum|sol|solana|bnb|avax|avalanche|matic|pol|" +
  "polygon|sui|apt|aptos|ton|near|atom|cosmos|dot|polkadot|tia|celestia|" +
  "inj|injective|sei|hype|hyperliquid|usdc|usdt|dai|usds|usde|frax|crv|" +
  "curve|cvx|convex|pendle|aave|uni|uniswap|gmx|ena|ethena|cake|mnt|" +
  "mantle|ftm|fantom|osmo|osmosis|tao|bittensor|trx|tron|ada|cardano|xrp|" +
  "doge|ltc|link|chainlink|bera|arb|op|strk|zro|eigen|ldo|rpl|jto|jup|ray|" +
  "orca|aero|velo|snx|mkr|sky|comp|bal|yfi|dydx|kava|cro";

const BRAND_STRIP_SUFFIX_RE =
  /-(?:v\d+|amm|dex|clmm|cpmm|dlmm|swap|stableswap|lend|lending|borrow|perps?|perpetuals?|futures|options|margin|spot|earn|vaults?|yield|staking|staked|liquid|liquid-staking|restaking|restaked|wrapped|bridge|pools?|farms?|cash|pay|card|launch|launchpad|launchlab|safety-module|module|dca|limit|aggregator|router|wallet|pro|lite|core|prime|plus|institutional|rwa|treasury|stablecoin|cex|finance|protocol|network|exchange|dao)$/;

const PRODUCT_REST_RE =
  /^(?:v\d+|amm|dex|clmm|cpmm|dlmm|swap|stableswap|lend|lending|borrow|perps?|perpetuals?|futures|options|margin|spot|earn|vaults?|yield|staking|staked|liquid|restaking|restaked|wrapped|bridged|pegged|bridge|pools?|farms?|cash|pay|card|launch|launchpad|launchlab|safety|module|dca|limit|aggregator|router|pro|lite|prime|plus|institutional|rwa|treasury|stable|stablecoin|usde|usdtb|gho|crvusd|llamalend|infinity|lsts?|hlp|glp|jlp|flp|vlp|alp|dlp|slp|mlp|eth|btc|sol|bnb|avax|hype|sui|ton|atom|tia|matic|pol|usdc|usdt|dai)(?:-|$)/;

const WRAPPED_NAME_RE = new RegExp(
  `(?:^(?:wrapped|bridged|pegged|canonical)[\\s-]+|` +
  `\\b(?:wrapped|bridged|pegged|canonical)\\s+(?:${MAJOR_ASSETS_PATTERN})\\b|` +
  `\\b(?:${MAJOR_ASSETS_PATTERN})\\s+(?:wrapper|wrapped)\\b)`,
  "i"
);

const STAKED_NAME_RE = new RegExp(
  `(?:^(?:liquid[\\s-]+)?(?:re)?staked[\\s-]+|` +
  `\\b(?:liquid[\\s-]+)?(?:re)?staked\\s+(?:${MAJOR_ASSETS_PATTERN})\\b|` +
  `\\b(?:${MAJOR_ASSETS_PATTERN})\\s+(?:liquid\\s+)?(?:re)?stak(?:ed|ing)\\s+(?:token|derivative|wrapper)\\b)`,
  "i"
);

const RECEIPT_NAME_RE =
  /\b(?:receipt\s+token|vault\s+share|lp\s+wrapper|liquid\s+locker|ve-?wrapper|vote-?escrowed\s+wrapper|staking\s+derivative|wrapped\s+staked)\b/i;

const DERIVATIVE_TICKER_CASE_RE =
  /^(?:w|st|wst|cb|wb|r|m|cm|b|bb|bn|bg|ok|k|t|h|e|we|ez|rs|sw|rsw|os|frx|sfrx|ankr|px|apx|yn|ls|ha|af|am|th|ts|li|lh|gg|milk|jito|jup|uni|pump|enzo|solv|s|a|c|y|x|ve|vl|cvx|sd|u|o)(?:BTC|ETH|SOL|BNB|AVAX|MATIC|POL|SUI|APT|TON|NEAR|ATOM|TIA|DOT|INJ|SEI|HYPE|USDe|USDE|USDC|USDT|DAI|USDS|FRAX|CRV|CVX|PENDLE|AAVE|UNI|GMX|ENA|CAKE|MNT|OSMO|TAO|BTCB)$/;

const DERIVATIVE_TICKER_CI_RE =
  /^(?:wst|cb|wb|bb|bn|bg|we|ez|rsw|frx|sfrx|ankr|apx|jito|jup|cvx|milk|st|btcb)(?:btc|eth|sol|bnb|avax|matic|sui|apt|ton|near|atom|tia|hype|usde|dai|usds|frax|crv|cvx|pendle)$|^w(?:btc|eth|sol|bnb|avax|matic|sui|hype)$/i;

const CUSTODIAN_PRODUCT_RE = new RegExp(
  `\\b(?:staked|staking|restaked|wrapped|bridged|pegged|earn|vault|custody|bitcoin|ether|ethereum|solana|${MAJOR_ASSETS_PATTERN})\\b`,
  "i"
);

const SUBJECT_DERIVATIVE_DESC_RE = new RegExp(
  `(?:^|[.;]\\s*)(?:[a-z0-9.+-]+\\s+)?(?:is\\s+a|represents\\s+a|serves\\s+as\\s+a)?\\s*` +
  `(?:1:1\\s+backed\\s+|custodial\\s+)?` +
  `(wrapped|bridged|pegged|synthetic|staked|liquid[\\s-]+staked|restaked|receipt)\\s+` +
  `(?:token|asset|version|representation|derivative|equivalent|product|wrapper|coin)\\s+` +
  `(?:of|for|backed\\s+by)\\s+(?:${MAJOR_ASSETS_PATTERN}|a\\s+staked|an\\s+existing)`,
  "i"
);

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeSlug(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^parent#/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeParentId(value: unknown): string {
  const raw = normalizeText(value).toLowerCase();
  if (!raw || PLACEHOLDER_VALUES.has(raw)) return "";
  return normalizeSlug(raw.replace(/^parent#/, ""));
}

export function isPlaceholderSymbol(symbol: unknown): boolean {
  const raw = normalizeText(symbol).toLowerCase();
  return !raw || PLACEHOLDER_VALUES.has(raw);
}

function isMeaningfulString(value: unknown): boolean {
  const raw = normalizeText(value).toLowerCase();
  return raw.length > 0 && !PLACEHOLDER_VALUES.has(raw);
}

function getNumeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNormalizedSet(input?: ReadonlySet<string> | readonly string[]): Set<string> {
  const out = new Set<string>();
  if (!input) return out;
  for (const item of input) {
    const norm = normalizeSlug(item);
    if (norm) out.add(norm);
  }
  return out;
}

function toCategorySet(input?: ReadonlySet<string> | readonly string[]): Set<string> {
  const out = new Set(DEFAULT_EXCLUDED_CATEGORIES);
  if (!input) return out;
  for (const item of input) {
    const norm = normalizeText(item).toLowerCase();
    if (norm) out.add(norm);
  }
  return out;
}

function stripBrandBase(slug: string): string {
  let cur = slug;
  for (let i = 0; i < 3; i++) {
    const next = cur.replace(BRAND_STRIP_SUFFIX_RE, "");
    if (next === cur || next.length < 3) break;
    cur = next;
  }
  return cur;
}

export function hasTradedToken(protocol: ProtocolLike): { traded: boolean; signals: string[] } {
  const signals: string[] = [];
  if (protocol.hasToken === true || protocol.tokenless === false) {
    signals.push("explicit_token_flag");
  }
  if (isMeaningfulString(protocol.gecko_id ?? protocol.geckoId)) {
    signals.push("gecko_id");
  }
  if (isMeaningfulString(protocol.cmcId ?? protocol.cmc_id)) {
    signals.push("cmc_id");
  }
  if (getNumeric(protocol.mcap ?? protocol.marketCap) > 0) {
    signals.push("positive_mcap");
  }
  if (isMeaningfulString(protocol.address)) {
    signals.push("token_address");
  }
  if (!isPlaceholderSymbol(protocol.symbol)) {
    signals.push("token_symbol");
  }
  return { traded: signals.length > 0, signals };
}

export function buildTradedIndex(
  protocols: readonly ProtocolLike[],
  options?: FilterOptions
): TradedIndex {
  const tradedSlugs = toNormalizedSet(options?.extraTradedSlugs);
  const tradedParents = toNormalizedSet(options?.extraTradedParents);
  const tradedBrandPrefixes = new Set<string>();
  const tradedSymbols = new Set<string>();
  const tradedNames = new Set<string>();

  for (const slug of tradedSlugs) {
    const base = stripBrandBase(slug);
    if (base.length >= 4 && !GENERIC_BRAND_WORDS.has(base)) {
      tradedBrandPrefixes.add(base);
    }
  }
  for (const parent of tradedParents) {
    if (parent.length >= 4 && !GENERIC_BRAND_WORDS.has(parent)) {
      tradedBrandPrefixes.add(parent);
    }
  }

  for (const p of protocols) {
    const check = hasTradedToken(p);
    if (!check.traded) continue;

    const slug = normalizeSlug(p.slug ?? p.name);
    const nameSlug = normalizeSlug(p.name);
    const parent = normalizeParentId(p.parentProtocol ?? p.parent_protocol ?? p.parentProtocolId);
    const strongSignal =
      check.signals.includes("gecko_id") ||
      check.signals.includes("cmc_id") ||
      check.signals.includes("positive_mcap");

    if (slug) tradedSlugs.add(slug);
    if (nameSlug) tradedNames.add(nameSlug);
    if (parent) {
      tradedParents.add(parent);
      if (parent.length >= 4 && !GENERIC_BRAND_WORDS.has(parent)) {
        tradedBrandPrefixes.add(parent);
      }
    }

    if (slug) {
      const base = stripBrandBase(slug);
      const canAddPrefix = strongSignal || base === slug;
      if (canAddPrefix && base.length >= 4 && !GENERIC_BRAND_WORDS.has(base)) {
        tradedBrandPrefixes.add(base);
      }
    }

    if (!isPlaceholderSymbol(p.symbol)) {
      const sym = normalizeText(p.symbol).toUpperCase();
      if (sym.length >= 3) tradedSymbols.add(sym);
    }
  }

  return { tradedSlugs, tradedParents, tradedBrandPrefixes, tradedSymbols, tradedNames };
}

function matchTradedBrandPrefix(slug: string, index: TradedIndex): string | undefined {
  if (!slug || !slug.includes("-")) return undefined;
  const parts = slug.split("-");
  const maxPrefixParts = Math.min(3, parts.length - 1);
  for (let i = 1; i <= maxPrefixParts; i++) {
    const prefix = parts.slice(0, i).join("-");
    if (!index.tradedBrandPrefixes.has(prefix)) continue;
    const rest = parts.slice(i).join("-");
    if (PRODUCT_REST_RE.test(rest)) {
      return prefix;
    }
  }
  return undefined;
}

function isCustodianProduct(name: string, slug: string): string | undefined {
  const parts = slug.split("-");
  const head1 = parts[0] ?? "";
  const head2 = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "";
  const matched = CUSTODIAN_PREFIXES.has(head2)
    ? head2
    : CUSTODIAN_PREFIXES.has(head1)
      ? head1
      : undefined;
  if (!matched) return undefined;
  if (CUSTODIAN_PRODUCT_RE.test(name) || CUSTODIAN_PRODUCT_RE.test(slug.replace(/-/g, " "))) {
    return matched;
  }
  return undefined;
}

export function detectDerivative(
  protocol: ProtocolLike,
  index: TradedIndex
): { reason: ExclusionReason; detail: string; signals: string[] } | null {
  const name = normalizeText(protocol.name);
  const slug = normalizeSlug(protocol.slug ?? protocol.name);
  const slugWords = slug.replace(/-/g, " ");
  const desc = normalizeText(protocol.description);
  const compactName = name.replace(/\s+/g, "");

  if (WRAPPED_NAME_RE.test(name) || WRAPPED_NAME_RE.test(slugWords)) {
    return {
      reason: "wrapped_derivative",
      detail: `Wrapped or bridged asset product (${name || slug})`,
      signals: ["wrapped_name_pattern"],
    };
  }

  if (STAKED_NAME_RE.test(name) || STAKED_NAME_RE.test(slugWords)) {
    return {
      reason: "staked_derivative",
      detail: `Staked or liquid-staked derivative of a traded asset (${name || slug})`,
      signals: ["staked_name_pattern"],
    };
  }

  if (RECEIPT_NAME_RE.test(name) || RECEIPT_NAME_RE.test(slugWords)) {
    return {
      reason: "receipt_derivative",
      detail: `Receipt or wrapper derivative product (${name || slug})`,
      signals: ["receipt_name_pattern"],
    };
  }

  if (
    (compactName.length >= 4 && compactName.length <= 16 && DERIVATIVE_TICKER_CASE_RE.test(compactName)) ||
    DERIVATIVE_TICKER_CI_RE.test(slug)
  ) {
    const isStaked = /^(?:st|wst|r|m|cm|b|bb|bn|bg|e|we|ez|rs|sw|rsw|os|frx|sfrx|ankr|ls|ha|af|am|th|ts|li|lh|gg|milk|jito|jup|s)/i.test(
      compactName || slug
    );
    return {
      reason: isStaked ? "staked_derivative" : "wrapped_derivative",
      detail: `Derivative ticker product (${name || slug})`,
      signals: ["derivative_ticker_pattern"],
    };
  }

  const custodian = isCustodianProduct(name, slug);
  if (custodian) {
    return {
      reason: "custodian_product",
      detail: `Exchange or custodian wrapper/staking product (${custodian})`,
      signals: [`custodian:${custodian}`],
    };
  }

  const descMatch = SUBJECT_DERIVATIVE_DESC_RE.exec(desc);
  if (descMatch) {
    const kind = (descMatch[1] ?? "").toLowerCase();
    const reason: ExclusionReason =
      kind.includes("stak") ? "staked_derivative"
        : kind.includes("receipt") ? "receipt_derivative"
          : "wrapped_derivative";
    return {
      reason,
      detail: `Description identifies a ${kind} derivative of an existing asset`,
      signals: [`description_${reason}`],
    };
  }

  const baseSlug = stripBrandBase(slug);
  if (baseSlug !== slug && index.tradedSlugs.has(baseSlug) && !GENERIC_BRAND_WORDS.has(baseSlug)) {
    return {
      reason: "receipt_derivative",
      detail: `Sub-product derivative of traded protocol (${baseSlug})`,
      signals: [`traded_base_slug:${baseSlug}`],
    };
  }

  return null;
}

export function classifyProtocol(
  protocol: ProtocolLike,
  index: TradedIndex,
  options?: FilterOptions
): FilterDecision {
  const reasons: ExclusionReason[] = [];
  const signals: string[] = [];
  const details: string[] = [];
  let matchedParent: string | undefined;

  const slug = normalizeSlug(protocol.slug ?? protocol.name);
  const category = normalizeText(protocol.category).toLowerCase();
  const excludedCategories = toCategorySet(options?.excludeCategories);
  const watchlist = toNormalizedSet(options?.watchlist);
  const inWatchlist = slug !== "" && watchlist.has(slug);

  const direct = hasTradedToken(protocol);
  if (direct.traded) {
    reasons.push("traded_token");
    signals.push(...direct.signals);
    details.push(`Records a traded token (${direct.signals.join(", ")})`);
  }

  const parent = normalizeParentId(
    protocol.parentProtocol ?? protocol.parent_protocol ?? protocol.parentProtocolId
  );
  if (parent && (index.tradedParents.has(parent) || index.tradedSlugs.has(parent))) {
    reasons.push("parent_has_token");
    signals.push(`parent:${parent}`);
    matchedParent = parent;
    details.push(`Parent protocol already trades a token (${parent})`);
  } else {
    const brandMatch = matchTradedBrandPrefix(slug, index);
    if (brandMatch) {
      reasons.push("brand_has_token");
      signals.push(`brand:${brandMatch}`);
      matchedParent = brandMatch;
      details.push(`Product variant of traded protocol (${brandMatch})`);
    }
  }

  if (category && excludedCategories.has(category)) {
    reasons.push("excluded_category");
    signals.push(`category:${category}`);
    details.push(`Excluded non-launch category (${protocol.category})`);
  }

  const derivative = detectDerivative(protocol, index);
  if (derivative) {
    reasons.push(derivative.reason);
    signals.push(...derivative.signals);
    details.push(derivative.detail);
  }

  const minTvl = options?.minTvl ?? 0;
  const tvl = getNumeric(protocol.tvl);
  if (minTvl > 0 && tvl < minTvl && !inWatchlist) {
    reasons.push("below_min_tvl");
    signals.push(`tvl:${tvl}`);
    details.push(`TVL ${tvl} below minimum ${minTvl}`);
  }

  const eligible = reasons.length === 0;
  return {
    eligible,
    tokenless: eligible,
    reason: eligible ? "eligible" : reasons[0]!,
    reasons,
    detail: eligible ? "Genuinely tokenless independent protocol" : details.join("; "),
    signals,
    ...(matchedParent ? { matchedParent } : {}),
  };
}

export function isTokenlessProtocol(
  protocol: ProtocolLike,
  index?: TradedIndex,
  options?: FilterOptions
): boolean {
  const effectiveIndex = index ?? buildTradedIndex([protocol], options);
  return classifyProtocol(protocol, effectiveIndex, options).eligible;
}

export function isWrappedOrStakedDerivative(
  protocol: ProtocolLike,
  index?: TradedIndex
): boolean {
  const effectiveIndex = index ?? buildTradedIndex([protocol]);
  return detectDerivative(protocol, effectiveIndex) !== null;
}

function emptyReasonCounts(): Record<ExclusionReason, number> {
  return {
    traded_token: 0,
    parent_has_token: 0,
    brand_has_token: 0,
    wrapped_derivative: 0,
    staked_derivative: 0,
    receipt_derivative: 0,
    custodian_product: 0,
    excluded_category: 0,
    below_min_tvl: 0,
  };
}

export function filterProtocols<T extends ProtocolLike>(
  protocols: readonly T[],
  options?: FilterOptions
): FilterResult<T> {
  const tradedIndex = buildTradedIndex(protocols, options);
  const included: T[] = [];
  const excluded: ExcludedProtocol<T>[] = [];
  const decisions = new Map<string, FilterDecision>();
  const byReason = emptyReasonCounts();

  for (let i = 0; i < protocols.length; i++) {
    const protocol = protocols[i]!;
    const key = normalizeSlug(protocol.slug ?? protocol.name) || `protocol-${i}`;
    const decision = classifyProtocol(protocol, tradedIndex, options);
    decisions.set(key, decision);
    if (decision.eligible) {
      included.push(protocol);
    } else {
      excluded.push({ protocol, decision });
      if (decision.reason !== "eligible") {
        byReason[decision.reason] += 1;
      }
    }
  }

  return {
    included,
    tokenless: included,
    candidates: included,
    excluded,
    decisions,
    stats: {
      total: protocols.length,
      eligible: included.length,
      excluded: excluded.length,
      byReason,
    },
    tradedIndex,
  };
}

export const filterTokenlessProtocols = filterProtocols;

export function selectTokenlessProtocols<T extends ProtocolLike>(
  protocols: readonly T[],
  options?: FilterOptions
): T[] {
  return filterProtocols(protocols, options).included;
}