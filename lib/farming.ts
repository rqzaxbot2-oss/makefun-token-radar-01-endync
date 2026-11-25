export type StrategyArchetype =
  | "dex-lp"
  | "perps-volume"
  | "lending-loop"
  | "restaking-points"
  | "bridge-routing"
  | "yield-vault"
  | "cdp-stablecoin"
  | "prediction-market"
  | "rwa-deposit"
  | "launchpad-social"
  | "general-usage";

export type RiskLevel = "Low" | "Medium" | "High";

export interface FarmProtocolInput {
  name: string;
  slug: string;
  category?: string | null;
  chains?: string[] | null;
  chain?: string | null;
  tvl?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  url?: string | null;
  description?: string | null;
  audits?: string | number | null;
  forkedFrom?: string[] | null;
  listedAt?: number | null;
  impliedFdv?: number | null;
  impliedValuation?: number | null;
  airdropPoolUsd?: number | null;
  airdropProbability?: number | null;
  launchScore?: number | null;
  isWatchlist?: boolean;
}

export interface FarmStep {
  order: number;
  title: string;
  action: string;
  rationale: string;
  cadence: string;
  gasNote: string;
}

export interface CapitalTier {
  tier: "Starter" | "Core" | "Whale";
  capitalRange: string;
  targetAllocation: string;
  tactic: string;
  expectedMultiplier: string;
  estRoiBand: string;
}

export interface RiskNote {
  level: RiskLevel;
  category: string;
  detail: string;
  mitigation: string;
}

export interface FarmPlan {
  protocol: string;
  slug: string;
  strategyArchetype: StrategyArchetype;
  archetypeLabel: string;
  summary: string;
  difficulty: RiskLevel;
  effortScore: number;
  timeCommitment: string;
  recommendedChains: string[];
  estimatedAirdropPct: number;
  steps: FarmStep[];
  capitalTiers: CapitalTier[];
  riskNotes: RiskNote[];
  sybilChecklist: string[];
  exitTriggers: string[];
}

interface ArchetypeTemplate {
  label: string;
  difficulty: RiskLevel;
  effortScore: number;
  timeCommitment: string;
  airdropPct: number;
  summaryVerb: string;
  steps: (ctx: PlanContext) => FarmStep[];
  tactics: { starter: string; core: string; whale: string };
  baseRisks: RiskNote[];
}

interface PlanContext {
  name: string;
  primaryChain: string;
  altChain: string;
  tvlM: number;
  gasHint: string;
  isLowFee: boolean;
  hasPointsSignal: boolean;
}

const LOW_FEE_CHAINS = new Set([
  "solana", "base", "arbitrum", "optimism", "sui", "aptos", "polygon",
  "avalanche", "bsc", "linea", "scroll", "zksync era", "blast", "mantle",
  "sei", "berachain", "hyperliquid", "sonic", "unichain", "ink", "abstract",
]);

const CHAIN_PRIORITY = [
  "Base", "Arbitrum", "Solana", "Optimism", "Sui", "Ethereum",
  "Hyperliquid", "Berachain", "Sonic", "Linea", "Scroll", "BSC", "Avalanche",
];

function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function normalizeChains(p: FarmProtocolInput): string[] {
  const raw: string[] = [];
  if (Array.isArray(p.chains)) {
    for (const c of p.chains) {
      if (typeof c === "string" && c.trim() && c !== "Multi-Chain") raw.push(c.trim());
    }
  }
  if (raw.length === 0 && typeof p.chain === "string" && p.chain.trim() && p.chain !== "Multi-Chain") {
    raw.push(p.chain.trim());
  }
  if (raw.length === 0) return ["Ethereum"];
  const unique = Array.from(new Set(raw));
  unique.sort((a, b) => {
    const ia = CHAIN_PRIORITY.indexOf(a);
    const ib = CHAIN_PRIORITY.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return unique.slice(0, 4);
}

export function classifyStrategy(p: FarmProtocolInput): StrategyArchetype {
  const cat = (p.category ?? "").toLowerCase();
  const text = `${p.name} ${p.slug} ${p.description ?? ""}`.toLowerCase();

  if (cat.includes("prediction") || /\b(polymarket|prediction market|event contract|betting)\b/.test(text)) {
    return "prediction-market";
  }
  if (cat.includes("derivative") || cat.includes("perp") || cat.includes("options") || cat.includes("basis") || /\b(perp|perpetual|orderbook|leverage|futures)\b/.test(text)) {
    return "perps-volume";
  }
  if (cat.includes("restaking") || cat.includes("liquid staking") || /\b(restak|lrt|avs|btc staking|solayer|symbiotic|karak|babylon|lombard)\b/.test(text)) {
    return "restaking-points";
  }
  if (cat.includes("bridge") || cat.includes("cross chain") || /\b(bridge|cross-chain|interoperability|intent|relay|jumper|orbiter)\b/.test(text)) {
    return "bridge-routing";
  }
  if (cat.includes("lending") || cat.includes("uncollateralized") || /\b(borrow|money market|lending|credit market)\b/.test(text)) {
    return "lending-loop";
  }
  if (cat.includes("cdp") || cat.includes("algo-stables") || /\b(cdp|mint stablecoin|synthetic dollar|overcollateralized)\b/.test(text)) {
    return "cdp-stablecoin";
  }
  if (cat.includes("rwa") || /\b(treasury|t-bill|real world asset|tokenized bond|credit fund)\b/.test(text)) {
    return "rwa-deposit";
  }
  if (cat.includes("dex") || cat.includes("liquidity") || /\b(amm|clmm|dlmm|swap|liquidity pool|aggregator)\b/.test(text)) {
    return "dex-lp";
  }
  if (cat.includes("yield") || cat.includes("farm") || cat.includes("vault") || /\b(vault|yield tokenization|auto-compound|curator)\b/.test(text)) {
    return "yield-vault";
  }
  if (cat.includes("launchpad") || cat.includes("nft") || cat.includes("social") || cat.includes("gaming") || /\b(launchpad|meme|socialfi|wallet|mint)\b/.test(text)) {
    return "launchpad-social";
  }
  return "general-usage";
}

const TEMPLATES: Record<StrategyArchetype, ArchetypeTemplate> = {
  "dex-lp": {
    label: "DEX Swap & Concentrated LP",
    difficulty: "Medium",
    effortScore: 6,
    timeCommitment: "20 min setup + weekly rebalance",
    airdropPct: 7,
    summaryVerb: "combining recurring organic swaps with sticky liquidity provision",
    steps: (c) => [
      { order: 1, title: `Onboard on ${c.primaryChain}`, action: `Bridge or fund wallet on ${c.primaryChain} and execute 3-5 organic swaps across blue-chip pairs on ${c.name}.`, rationale: "Establishes early trader history and distinct active weeks.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 2, title: "Deploy Sticky LP Position", action: `Supply liquidity to a high-fee stable or correlated pair (e.g. USDC/USDT or LST/ETH) on ${c.name} and hold 30+ days.`, rationale: "DEX drops heavily weight time-weighted TVL over wash-traded swaps.", cadence: "Bi-weekly rebalance", gasNote: c.gasHint },
      { order: 3, title: "Exercise Advanced Features", action: `Use limit orders, routing, or concentrated range tools on ${c.name}${c.altChain ? ` and repeat a small swap on ${c.altChain}` : ""}.`, rationale: "Multi-feature and multi-chain usage often unlocks bonus tier multipliers.", cadence: "Monthly", gasNote: c.gasHint },
      { order: 4, title: "Claim & Track Epoch Points", action: `Connect to ${c.name}'s portfolio/points tab, verify referral or season multipliers, and compound fees periodically.`, rationale: "Ensures wallet eligibility before unannounced snapshot cutoffs.", cadence: "Weekly check-in", gasNote: "Off-chain / minimal gas" },
    ],
    tactics: {
      starter: "80% correlated-pair LP + $500-$1.5k cumulative organic swap volume across 4+ weeks.",
      core: "Split 70% stable/LST LP and 30% volatile blue-chip range LP; maintain top-20% active-week streak.",
      whale: "Run wide-range concentrated LP on top fee pools plus cross-chain volume routing to capture fee-share rebates.",
    },
    baseRisks: [
      { level: "Medium", category: "Impermanent Loss", detail: "Tight concentrated ranges suffer divergence loss during volatility spikes.", mitigation: "Anchor core farming capital in stablecoin or correlated LST pairs." },
    ],
  },
  "perps-volume": {
    label: "Perpetuals Volume & Vault Farming",
    difficulty: "High",
    effortScore: 8,
    timeCommitment: "30-45 min/week active trading",
    airdropPct: 10,
    summaryVerb: "accumulating maker volume, open interest duration, and HLP/LP vault deposits",
    steps: (c) => [
      { order: 1, title: "Fund Margin Account", action: `Deposit USDC collateral into ${c.name} on ${c.primaryChain} and enable one-click trading keys.`, rationale: "Perp protocols track net deposits alongside volume tiers.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Build Organic Maker Volume", action: `Place post-only limit orders on BTC/ETH majors on ${c.name}, holding positions for hours rather than seconds.`, rationale: "Post-only orders minimize fees and avoid anti-wash-trading filters.", cadence: "2-3x per week", gasNote: "Usually gasless off-chain CLOB" },
      { order: 3, title: "Deposit into Counterparty LP Vault", action: `Allocate 30-50% of budget into ${c.name}'s liquidity/market-making vault if available.`, rationale: "Passive vault TVL earns steady points while offsetting trading fee burn.", cadence: "Hold 30+ days", gasNote: c.gasHint },
      { order: 4, title: "Maintain Open Interest & PnL Hygiene", action: `Keep modest delta-neutral or hedged exposure across multiple epochs without self-trading.`, rationale: "Season formulas increasingly reward sustained OI and real fee contribution.", cadence: "Weekly review", gasNote: "Off-chain" },
    ],
    tactics: {
      starter: "Deposit $500-$1k; generate $25k-$75k maker volume over 6+ weeks using low-leverage major pairs.",
      core: "60% LP vault + 40% active margin targeting $250k-$1M maker volume with delta-neutral spot hedges.",
      whale: "Multi-epoch OI farming paired with basis/funding arbitrage and LP vault staking for fee-rebate tiering.",
    },
    baseRisks: [
      { level: "High", category: "Liquidation & Fee Drag", detail: "Excessive leverage or taker fees can exceed eventual airdrop value.", mitigation: "Cap leverage at 2-3x, prefer post-only limits, and monitor funding rates." },
    ],
  },
  "lending-loop": {
    label: "Money Market Supply & Conservative Looping",
    difficulty: "Medium",
    effortScore: 5,
    timeCommitment: "15 min setup + weekly health check",
    airdropPct: 6,
    summaryVerb: "supplying blue-chip collateral and running conservative correlated borrow loops",
    steps: (c) => [
      { order: 1, title: `Supply Core Collateral on ${c.primaryChain}`, action: `Deposit ETH, LST, or USDC into ${c.name}'s primary lending pool.`, rationale: "Base supply deposits qualify for lender points with minimal overhead.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Activate Borrower Multiplier", action: `Borrow a correlated asset (e.g. ETH against wstETH, or USDT against USDC) at <=55% LTV on ${c.name}.`, rationale: "Borrowers typically receive 2x-4x higher points weight than passive suppliers.", cadence: "Hold 30+ days", gasNote: c.gasHint },
      { order: 3, title: "Optional 1.5x-2x E-Mode Loop", action: `Redeposit borrowed correlated asset into ${c.name} or a partnered yield vault only when net APY > -1%.`, rationale: "Boosts effective TVL footprint while keeping liquidation distance wide.", cadence: "Bi-weekly check", gasNote: c.gasHint },
      { order: 4, title: "Monitor Utilization & Rates", action: `Check borrow APR spikes and repay/adjust before utilization crosses 90%.`, rationale: "Prevents rate-spike bleed and protects health factor during drawdowns.", cadence: "Weekly", gasNote: c.gasHint },
    ],
    tactics: {
      starter: "Pure supply + tiny 25% LTV correlated borrow to trigger both lender and borrower criteria.",
      core: "Correlated E-Mode loop at 2x effective collateral, targeting net-positive or near-zero carry.",
      whale: "Split across isolated and core markets; pair borrowed stables with yield-bearing collateral for positive spread.",
    },
    baseRisks: [
      { level: "Medium", category: "Borrow Rate Spikes & Depeg", detail: "High pool utilization can invert carry or tighten liquidation thresholds.", mitigation: "Keep health factor > 1.6 and avoid volatile collateral against stablecoin debt." },
    ],
  },
  "restaking-points": {
    label: "Restaking & Multi-Stack Points",
    difficulty: "Low",
    effortScore: 4,
    timeCommitment: "15 min setup + monthly check",
    airdropPct: 7,
    summaryVerb: "minting liquid restaking receipts and stacking ecosystem DeFi multipliers",
    steps: (c) => [
      { order: 1, title: `Mint or Stake via ${c.name}`, action: `Deposit native ETH, BTC wrapper, or SOL into ${c.name} on ${c.primaryChain} to receive its receipt token.`, rationale: "Direct minting registers on-chain early-depositor provenance.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Stack Secondary DeFi Multiplier", action: `Deploy receipt token into a partnered DEX pool, lending market, or YT/LP vault offering 2x-3x ${c.name} points.`, rationale: "Composability integrations multiply points per dollar without adding principal.", cadence: "Hold 45+ days", gasNote: c.gasHint },
      { order: 3, title: "Delegate or Select Operator/AVS", action: `Complete operator/vault delegation step inside ${c.name} if supported.`, rationale: "Protocols often gate bonus tiers behind active security delegation.", cadence: "One-time", gasNote: c.gasHint },
      { order: 4, title: "Plan Exit Liquidity Path", action: `Verify native unbonding queue duration vs secondary DEX pool depth before sizing up.`, rationale: "Avoids steep discounts when farmers rush exits post-snapshot.", cadence: "Monthly check", gasNote: "Off-chain" },
    ],
    tactics: {
      starter: "Direct stake on L2/Solana to save gas; hold receipt token in wallet or simple LP.",
      core: "50% direct stake + 50% partnered LP/lending integration for dual-protocol airdrop stacking.",
      whale: "Diversify across 2-3 curated vaults/operators; hedge LST/LRT peg risk and track native withdrawal windows.",
    },
    baseRisks: [
      { level: "Medium", category: "Unbonding Queue & Peg Discount", detail: "Withdrawal queues can lock funds 7-21 days while secondary pools trade below NAV.", mitigation: "Size only with capital tolerant of a 30-day lockup and check DEX exit depth." },
    ],
  },
  "bridge-routing": {
    label: "Cross-Chain Routing & Volume Consistency",
    difficulty: "Low",
    effortScore: 5,
    timeCommitment: "10 min/week across active chains",
    airdropPct: 6,
    summaryVerb: "building organic multi-chain transfer count, distinct chain pairs, and steady volume",
    steps: (c) => [
      { order: 1, title: "Establish Source-Destination Diversity", action: `Bridge assets via ${c.name} across at least 3-4 distinct chains starting with ${c.primaryChain}${c.altChain ? ` and ${c.altChain}` : ""}.`, rationale: "Bridge drops score unique chain-pair diversity alongside raw volume.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 2, title: "Space Out Active Weeks", action: `Execute 1-2 real transfers per week over 6+ distinct weeks rather than batching in one day.`, rationale: "Anti-sybil filters aggressively prune single-day burst farmers.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 3, title: "Mix Assets & Gas Refuel Tools", action: `Transfer both ETH/SOL and stablecoins and try ${c.name}'s swap-and-bridge or gas refuel feature.`, rationale: "Using auxiliary modules signals genuine user behavior.", cadence: "Bi-weekly", gasNote: c.gasHint },
      { order: 4, title: "Optional Liquidity Provision", action: `If ${c.name} offers bridge LP pools, park idle stables for passive fee + points accrual.`, rationale: "Bridge LPs often receive a dedicated allocation bucket.", cadence: "Hold 30+ days", gasNote: c.gasHint },
    ],
    tactics: {
      starter: "$2k-$5k cumulative volume across 10+ spaced transactions on cheap L2 routes.",
      core: "$15k-$50k cumulative volume across 4+ chains plus small bridge-pool LP if available.",
      whale: "$100k+ organic treasury rebalancing via the router plus meaningful passive bridge liquidity.",
    },
    baseRisks: [
      { level: "Medium", category: "Bridge & Messaging Risk", detail: "Cross-chain relayers and liquidity pools face heightened exploit surface.", mitigation: "Transfer in tranches and never leave excess token approvals open." },
    ],
  },
  "yield-vault": {
    label: "Curated Vault & Yield Tokenization",
    difficulty: "Low",
    effortScore: 4,
    timeCommitment: "15 min setup + bi-weekly harvest check",
    airdropPct: 6,
    summaryVerb: "parking productive capital in flagship vaults and compounding protocol points",
    steps: (c) => [
      { order: 1, title: `Deposit into Flagship ${c.name} Vault`, action: `Select the highest-TVL audited stablecoin or ETH vault on ${c.name} (${c.primaryChain}).`, rationale: "Core vaults earn baseline points with lower strategy-failure risk.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Utilize Receipt Composability", action: `Use the vault share token as collateral or liquidity in an ecosystem partner if boosted.`, rationale: "Stacked incentives lift effective yield even if TGE is delayed.", cadence: "Hold 30+ days", gasNote: c.gasHint },
      { order: 3, title: "Test Secondary Strategy Module", action: `Allocate 10-20% to a second vault or yield-splitting pool on ${c.name}.`, rationale: "Multi-vault interaction often qualifies for power-user tiers.", cadence: "Monthly", gasNote: c.gasHint },
      { order: 4, title: "Audit Fee & Lockup Terms", action: `Confirm performance fees, withdrawal cooldowns, and underlying strategy exposure.`, rationale: "Prevents unexpected slippage or lockups near token generation.", cadence: "Bi-weekly", gasNote: "Off-chain" },
    ],
    tactics: {
      starter: "Single deposit in the lowest-fee stablecoin or LST vault held continuously for 60+ days.",
      core: "70% flagship stable/ETH vault + 30% boosted partner vault or fixed-yield tranche.",
      whale: "Diversify across multiple curated strategies while monitoring vault caps and share-price oracle updates.",
    },
    baseRisks: [
      { level: "Medium", category: "Strategy Stack Risk", detail: "Vaults compound smart-contract risk across both curator and underlying protocols.", mitigation: "Verify underlying venues and cap exposure to newly launched strategies." },
    ],
  },
  "cdp-stablecoin": {
    label: "CDP Minting & Stablecoin Utility",
    difficulty: "Medium",
    effortScore: 6,
    timeCommitment: "20 min setup + weekly ratio check",
    airdropPct: 7,
    summaryVerb: "minting protocol stablecoins and seeding stability pools or DEX liquidity",
    steps: (c) => [
      { order: 1, title: "Open Conservative CDP Vault", action: `Deposit blue-chip collateral on ${c.name} (${c.primaryChain}) and mint its native stablecoin at >200% collateral ratio.`, rationale: "Minters drive core protocol supply and receive top emission weights.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Deploy Minted Stablecoin", action: `Stake minted stablecoin in ${c.name}'s Stability Pool or pair it with USDC on a top DEX.`, rationale: "Protocols heavily reward peg-supporting liquidity over idle minted balances.", cadence: "Hold 30+ days", gasNote: c.gasHint },
      { order: 3, title: "Maintain Safe Collateral Buffer", action: `Set price alerts and keep collateral ratio well above redemption/liquidation bands.`, rationale: "Protects against sudden volatility wicks and forced redemptions.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 4, title: "Claim Yield & Repay Flexibly", action: `Compound stability-pool yields and keep debt active across epoch snapshots.`, rationale: "Time-weighted debt + LP duration maximizes allocation share.", cadence: "Bi-weekly", gasNote: c.gasHint },
    ],
    tactics: {
      starter: "Buy protocol stablecoin on DEX and stake in Stability Pool if minting minimums are high.",
      core: "Mint at 220%+ CR and deploy 100% of minted stablecoin into the rewarded Stability/DEX pool.",
      whale: "Run yield-bearing collateral CDP paired with concentrated stablecoin LP to earn dual swap + points yield.",
    },
    baseRisks: [
      { level: "Medium", category: "Redemption & Depeg Risk", detail: "CDP stablecoins can trade below $1 during stress or face collateral redemptions.", mitigation: "Maintain top-quartile collateral ratios and avoid looping unpegged stables." },
    ],
  },
  "prediction-market": {
    label: "Prediction Market Liquidity & Active Volume",
    difficulty: "Medium",
    effortScore: 6,
    timeCommitment: "20-30 min/week",
    airdropPct: 8,
    summaryVerb: "providing resting limit-order liquidity and trading diverse high-volume markets",
    steps: (c) => [
      { order: 1, title: "Fund & Verify Active Profile", action: `Deposit USDC on ${c.name} (${c.primaryChain}) and complete profile setup.`, rationale: "Clean account history distinguishes organic traders from sybil farms.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Trade Across Distinct Categories", action: `Take measured positions across 5+ diverse markets (crypto, macro, sports, politics) over multiple weeks.`, rationale: "Breadth of resolved markets and active weeks is a classic airdrop filter.", cadence: "Weekly", gasNote: "Usually gasless relayer" },
      { order: 3, title: "Farm Limit-Order Liquidity Rewards", action: `Place resting maker limit orders near mid-price on liquid markets on ${c.name}.`, rationale: "Maker liquidity rebates offset spread costs while building volume.", cadence: "2x per week", gasNote: "Off-chain" },
      { order: 4, title: "Hold to Resolution & Avoid Wash Pairs", action: `Let genuine positions settle naturally rather than buying both Yes/No sides identically.`, rationale: "Symmetric self-hedging is trivially flagged by sybil analytics.", cadence: "Ongoing", gasNote: "Off-chain" },
    ],
    tactics: {
      starter: "$300-$1k bankroll taking small high-conviction or near-certainty yield positions across 10+ markets.",
      core: "$2.5k-$10k split between liquidity-reward limit orders and short-dated high-probability carry markets.",
      whale: "Automated spread quoting across liquid orderbooks paired with hedged macro/crypto event positions.",
    },
    baseRisks: [
      { level: "High", category: "Outcome & Oracle Dispute Risk", detail: "Binary markets can lose 100% on surprise outcomes or ambiguous resolution criteria.", mitigation: "Read market resolution rules carefully and cap any single outcome at 5-10% of bankroll." },
    ],
  },
  "rwa-deposit": {
    label: "RWA Yield & Institutional Stablecoin Farming",
    difficulty: "Low",
    effortScore: 3,
    timeCommitment: "15 min setup + monthly check",
    airdropPct: 5,
    summaryVerb: "holding yield-bearing RWA receipts and deploying them into permissionless DeFi pools",
    steps: (c) => [
      { order: 1, title: "Acquire RWA Receipt Token", action: `Mint directly on ${c.name} (if eligible) or swap into its permissionless wrapped RWA token on ${c.primaryChain}.`, rationale: "Yield-bearing RWA holdings earn real T-bill/credit APY while farming points.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Deploy into Whitelisted DeFi Pools", action: `Provide liquidity or collateralize the RWA token in partnered DEX/lending venues.`, rationale: "DeFi composability boosts point multipliers over passive holding.", cadence: "Hold 60+ days", gasNote: c.gasHint },
      { order: 3, title: "Verify Eligibility & Jurisdiction Rules", action: `Confirm token claim eligibility rules and whether KYC is required for TGE distribution.`, rationale: "RWA protocols frequently enforce stricter claim compliance at TGE.", cadence: "One-time", gasNote: "Off-chain" },
    ],
    tactics: {
      starter: "Buy wrapped RWA token on L2 DEX and hold continuously to capture real yield + baseline drop.",
      core: "Pair RWA token with USDC in a low-IL stable LP pool for swap fees plus boosted protocol points.",
      whale: "Direct primary minting plus multi-venue DeFi collateral deployment for capital-efficient carry.",
    },
    baseRisks: [
      { level: "Medium", category: "Custodial & KYC Gating", detail: "Off-chain custodians and regional claim restrictions can impact token distribution.", mitigation: "Review custodian attestations and confirm jurisdictional claim eligibility early." },
    ],
  },
  "launchpad-social": {
    label: "Ecosystem Participation & Fee-Generating Activity",
    difficulty: "Medium",
    effortScore: 6,
    timeCommitment: "20 min/week",
    airdropPct: 8,
    summaryVerb: "generating consistent fee-paying transactions, streaks, and ecosystem engagement",
    steps: (c) => [
      { order: 1, title: `Create On-Chain Footprint on ${c.name}`, action: `Execute small real trades, mints, or launches on ${c.name} (${c.primaryChain}) across separate days.`, rationale: "Consumer apps reward real fee payers and repeat retention over pure TVL.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 2, title: "Use Native Wallet / Built-In Swap", action: `Route at least a portion of normal activity through ${c.name}'s native interface rather than third-party contracts.`, rationale: "Interface fee attribution is commonly used to rank power users.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 3, title: "Build Multi-Month Streak", action: `Keep wallet active across 4-8 distinct weeks with varied transaction sizes.`, rationale: "Retention cohorts heavily separate organic users from airdrop scripts.", cadence: "Weekly", gasNote: c.gasHint },
    ],
    tactics: {
      starter: "Focus on consistent weekly transactions and low-cost feature exploration; cap speculative trade size.",
      core: "Route routine swaps/mints natively to accumulate meaningful protocol fees paid without overtrading.",
      whale: "Target top-1% fee-contributor or liquidity-creator leaderboard tiers where snapshot allocations concentrate.",
    },
    baseRisks: [
      { level: "High", category: "Speculative Asset Volatility", detail: "Launchpad and consumer assets exhibit sharp drawdowns.", mitigation: "Treat farming fees as a fixed budget and avoid holding illiquid micro-caps." },
    ],
  },
  "general-usage": {
    label: "Core Protocol Usage & Multi-Epoch Presence",
    difficulty: "Low",
    effortScore: 5,
    timeCommitment: "15 min/week",
    airdropPct: 6,
    summaryVerb: "maintaining sustained TVL participation and recurring core contract interactions",
    steps: (c) => [
      { order: 1, title: `Establish Core Deposit on ${c.name}`, action: `Deposit blue-chip assets into ${c.name}'s main contract on ${c.primaryChain} and hold 30+ days.`, rationale: "Time-weighted TVL remains the single most reliable pre-token signal.", cadence: "One-time", gasNote: c.gasHint },
      { order: 2, title: "Interact Across Multiple Epochs", action: `Perform periodic deposits, claims, or swaps across 4+ distinct weeks.`, rationale: "Demonstrates sustained user retention prior to snapshot.", cadence: "Weekly", gasNote: c.gasHint },
      { order: 3, title: "Explore Partner Integrations", action: `Use ${c.name} across ${c.altChain ? `${c.altChain} or ` : ""}ecosystem partner apps and verify points/badges.`, rationale: "Cross-product usage frequently unlocks loyalty multipliers.", cadence: "Bi-weekly", gasNote: c.gasHint },
    ],
    tactics: {
      starter: "Maintain a modest sticky deposit + 4+ active weeks on the cheapest supported chain.",
      core: "Commit productive capital to primary pools while tracking epoch leaderboards and partner boosts.",
      whale: "Split across top audited pools to stay in top-5% depositor bracket while controlling protocol concentration.",
    },
    baseRisks: [
      { level: "Medium", category: "Undefined Token Timeline", detail: "Protocols without an announced token can remain tokenless indefinitely.", mitigation: "Prioritize deposits that earn competitive native yield independent of an airdrop." },
    ],
  },
};

function buildCapitalTiers(
  p: FarmProtocolInput,
  tpl: ArchetypeTemplate,
  tvl: number,
  airdropPool: number
): CapitalTier[] {
  const dilutionRatio = tvl > 0 && airdropPool > 0 ? airdropPool / tvl : 0.04;
  const clampPct = (v: number) => `${Math.max(2, Math.min(85, Math.round(v * 100)))}%`;
  const lowBand = clampPct(dilutionRatio * 0.6);
  const midBand = clampPct(dilutionRatio * 1.15);
  const highBand = clampPct(dilutionRatio * 1.9);
  const whaleNote = tvl < 25_000_000
    ? "Cap at <=2% of pool TVL to avoid liquidity trap"
    : "Target top-5% points/volume tier";

  return [
    {
      tier: "Starter",
      capitalRange: "$250 – $1,000",
      targetAllocation: "Single low-gas chain, 1 core position",
      tactic: tpl.tactics.starter,
      expectedMultiplier: "1.0x – 1.5x (baseline + streak)",
      estRoiBand: `${lowBand} – ${midBand} annualized eq.`,
    },
    {
      tier: "Core",
      capitalRange: "$2,500 – $15,000",
      targetAllocation: "70% sticky TVL / 30% active multiplier",
      tactic: tpl.tactics.core,
      expectedMultiplier: "1.5x – 3.0x (LP + partner boost)",
      estRoiBand: `${midBand} – ${highBand} annualized eq.`,
    },
    {
      tier: "Whale",
      capitalRange: "$25,000+",
      targetAllocation: `${whaleNote}; diversify pools`,
      tactic: tpl.tactics.whale,
      expectedMultiplier: "2.5x – 4.0x (fee/tier rebates)",
      estRoiBand: `${lowBand} – ${highBand} (size-adjusted)`,
    },
  ];
}

function buildRiskNotes(p: FarmProtocolInput, tpl: ArchetypeTemplate, tvl: number, chains: string[]): RiskNote[] {
  const notes: RiskNote[] = [...tpl.baseRisks];

  const auditStr = String(p.audits ?? "").trim();
  if (!auditStr || auditStr === "0" || auditStr.toLowerCase() === "false") {
    notes.push({
      level: "High",
      category: "Audit Coverage",
      detail: "DefiLlama snapshot lists no verified security audit count for this protocol.",
      mitigation: "Restrict allocation to speculative budget, verify live contracts, and revoke unused approvals.",
    });
  } else {
    notes.push({
      level: "Low",
      category: "Smart Contract Baseline",
      detail: `Snapshot records audit metadata (${auditStr}), though audited contracts still carry exploit risk.`,
      mitigation: "Avoid brand-new unaudited periphery vaults and diversify across protocols.",
    });
  }

  if (tvl < 15_000_000) {
    notes.push({
      level: "High",
      category: "Early-Stage TVL Depth",
      detail: `TVL of ${formatUsdCompact(tvl)} implies thin exit liquidity and higher protocol survival risk.`,
      mitigation: "Size modestly (<2% of pool TVL) and prioritize liquid base assets.",
    });
  } else if (tvl > 750_000_000) {
    notes.push({
      level: "Medium",
      category: "Points Dilution",
      detail: `Large TVL (${formatUsdCompact(tvl)}) means passive whale capital heavily dilutes small deposits.`,
      mitigation: "Focus on active multipliers (borrowing, volume, partner LPs) rather than idle deposits.",
    });
  }

  if (Array.isArray(p.forkedFrom) && p.forkedFrom.length > 0) {
    notes.push({
      level: "Medium",
      category: "Codebase Fork Risk",
      detail: `Forked from ${p.forkedFrom.slice(0, 2).join(", ")}; custom modifications can introduce subtle bugs.`,
      mitigation: "Prefer vanilla pools that closely match battle-tested upstream contracts.",
    });
  }

  if (chains.length === 1 && chains[0] === "Ethereum") {
    notes.push({
      level: "Medium",
      category: "Mainnet Gas Drag",
      detail: "Ethereum L1 gas can erode net ROI on sub-$2,500 farming positions.",
      mitigation: "Batch interactions during <10 gwei windows and favor long-duration passive deposits.",
    });
  }

  return notes;
}

export function generateFarmPlan(protocol: FarmProtocolInput): FarmPlan {
  const archetype = classifyStrategy(protocol);
  const tpl = TEMPLATES[archetype];
  const chains = normalizeChains(protocol);
  const primaryChain = chains[0];
  const altChain = chains[1] ?? "";
  const tvl = Math.max(0, Number(protocol.tvl ?? 0) || 0);
  const tvlM = tvl / 1e6;
  const isLowFee = LOW_FEE_CHAINS.has(primaryChain.toLowerCase());
  const gasHint = isLowFee
    ? `Low gas on ${primaryChain} (<$0.25/tx)`
    : `Mainnet gas on ${primaryChain} (batch during low-gwei windows)`;
  const hasPointsSignal = /\b(point|season|epoch|reward|xp|airdrop)\b/i.test(
    `${protocol.name} ${protocol.description ?? ""}`
  );

  const impliedFdv = Number(protocol.impliedFdv ?? protocol.impliedValuation ?? 0) || tvl * 0.45;
  const airdropPool = Number(protocol.airdropPoolUsd ?? 0) || impliedFdv * (tpl.airdropPct / 100);

  const ctx: PlanContext = {
    name: protocol.name,
    primaryChain,
    altChain,
    tvlM,
    gasHint,
    isLowFee,
    hasPointsSignal,
  };

  const fdvNote = impliedFdv > 0 ? ` (~${formatUsdCompact(impliedFdv)} implied FDV)` : "";
  const pointsNote = hasPointsSignal ? " Explicit points/season signals detected." : "";
  const summary = `Farm ${protocol.name} on ${primaryChain} by ${tpl.summaryVerb}. Current TVL sits at ${formatUsdCompact(tvl)}${fdvNote}.${pointsNote}`;

  return {
    protocol: protocol.name,
    slug: protocol.slug,
    strategyArchetype: archetype,
    archetypeLabel: tpl.label,
    summary,
    difficulty: tpl.difficulty,
    effortScore: tpl.effortScore,
    timeCommitment: tpl.timeCommitment,
    recommendedChains: chains,
    estimatedAirdropPct: tpl.airdropPct,
    steps: tpl.steps(ctx),
    capitalTiers: buildCapitalTiers(protocol, tpl, tvl, airdropPool),
    riskNotes: buildRiskNotes(protocol, tpl, tvl, chains),
    sybilChecklist: [
      `Fund your ${primaryChain} wallet from a distinct CEX or main wallet with prior on-chain history.`,
      "Avoid identical round-number deposits or synchronized multi-wallet transfers.",
      "Maintain organic activity across at least 4-6 distinct calendar weeks before TGE.",
      "Keep a minimum native gas balance and avoid draining 100% of funds immediately after minting.",
    ],
    exitTriggers: [
      "Official TGE snapshot announcement or confirmed end of points season.",
      "Protocol TVL drops >40% in 7 days or security incident alert on underlying contracts.",
      "Net carry turns deeply negative (>10% annualized fee/borrow bleed) relative to implied pool share.",
    ],
  };
}

export const buildFarmPlan = generateFarmPlan;

export function formatFarmStepsText(plan: FarmPlan): string[] {
  return plan.steps.map((s) => `${s.order}. ${s.title}: ${s.action} (${s.cadence})`);
}