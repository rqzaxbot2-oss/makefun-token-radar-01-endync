export type FarmDifficulty = "Low" | "Medium" | "High";
export type RiskSeverity = "low" | "medium" | "high";
export type FarmCategoryBucket =
  | "dex"
  | "perps"
  | "lending"
  | "staking"
  | "bridge"
  | "yield"
  | "prediction"
  | "launchpad"
  | "wallet"
  | "chain"
  | "rwa"
  | "nft"
  | "generic";

export interface FarmProtocolInput {
  slug?: string | null;
  name: string;
  category?: string | null;
  chain?: string | null;
  chains?: string[] | null;
  tvl?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  fees24h?: number | null;
  revenue24h?: number | null;
  impliedFdv?: number | null;
  impliedAirdropUsd?: number | null;
  airdropPct?: number | null;
  score?: number | null;
  audits?: string | number | null;
  listedAt?: number | null;
  chainTvls?: Record<string, number> | null;
}

export interface FarmStep {
  order: number;
  title: string;
  action: string;
  targetMetric: string;
  estimatedTimeMin: number;
  categoryTag: string;
}

export interface CapitalTierPlan {
  tier: "Starter" | "Core" | "Whale";
  rangeUsd: string;
  allocation: string;
  estGasMonthlyUsd: number;
  expectedShareNote: string;
}

export interface RiskFlag {
  code: string;
  severity: RiskSeverity;
  label: string;
  mitigation: string;
}

export interface CadencePlan {
  frequency: string;
  minActiveWeeks: number;
  recommendedTxPerWeek: number;
  snapshotWindow: string;
}

export interface FarmPlan {
  archetype: FarmCategoryBucket;
  strategyName: string;
  difficulty: FarmDifficulty;
  effortScore: number;
  sybilSensitivity: FarmDifficulty;
  primaryChain: string;
  supportedChains: string[];
  cadence: CadencePlan;
  capitalTiers: CapitalTierPlan[];
  steps: FarmStep[];
  riskFlags: RiskFlag[];
  airdropCatalysts: string[];
  summary: string;
}

interface PlaybookCtx {
  name: string;
  chain: string;
  tvlText: string;
  altChain: string;
}

interface ArchetypeTemplate {
  strategyName: string;
  difficulty: FarmDifficulty;
  sybilSensitivity: FarmDifficulty;
  frequency: string;
  minActiveWeeks: number;
  txPerWeek: number;
  gasMult: number;
  tierAlloc: [string, string, string];
  baseRisk: RiskFlag;
  steps: (ctx: PlaybookCtx) => Omit<FarmStep, "order">[];
}

interface ProtocolOverride {
  strategyName: string;
  snapshotWindow: string;
  firstStep: Omit<FarmStep, "order">;
  catalyst: string;
}

const LOW_FEE_CHAINS = new Set([
  "solana", "base", "arbitrum", "optimism", "polygon", "sui", "aptos",
  "hyperliquid", "monad", "abstract", "ink", "soneium", "linea", "scroll",
  "zksync era", "starknet", "avalanche", "bsc", "sei", "berachain", "sonic",
  "blast", "mantle", "mode", "eclipse", "fuel", "movement", "unichain",
]);

const PROTOCOL_OVERRIDES: Record<string, ProtocolOverride> = {
  polymarket: {
    strategyName: "CLOB Maker Liquidity & Open-Interest Farming",
    snapshotWindow: "Q2-Q4 catalyst window (post-regulatory clarity)",
    firstStep: {
      title: "Post Two-Sided Limit Orders on High-Volume Markets",
      action: "Provide resting maker bids/asks within 1-2c of mid on top macro and crypto markets on Polygon.",
      targetMetric: ">$10k cumulative filled volume + $500+ resting OI",
      estimatedTimeMin: 15,
      categoryTag: "liquidity",
    },
    catalyst: "Category-leading prediction market volume and active trader base",
  },
  pump: {
    strategyName: "Fee-Weighted Spot & Launchpad Activity",
    snapshotWindow: "High-priority TGE watch (peak fee velocity)",
    firstStep: {
      title: "Route Organic Spot & Bonding-Curve Trades",
      action: "Execute disciplined trades across graduated and bonding pools via native UI rather than third-party bots.",
      targetMetric: "20+ distinct sessions across 6+ weeks",
      estimatedTimeMin: 12,
      categoryTag: "volume",
    },
    catalyst: "Top-tier protocol revenue generation drives fee-rebate airdrop thesis",
  },
  meteora: {
    strategyName: "DLMM Fee Generation & Dynamic Vault Points",
    snapshotWindow: "Active points season (TGE imminent)",
    firstStep: {
      title: "Deploy Tight-Bin DLMM Liquidity on SOL/Stable Pairs",
      action: "Open active DLMM positions in high-turnover Solana pairs and rebalance bins weekly to maximize fee points.",
      targetMetric: "$25+ weekly LP fees earned + active Dynamic Vault deposit",
      estimatedTimeMin: 18,
      categoryTag: "lp",
    },
    catalyst: "Explicit LP fee-weighted points program on Solana",
  },
  symbiotic: {
    strategyName: "Multi-Vault Collateral Restaking & DeFi Composability",
    snapshotWindow: "Post-mainnet slashing activation window",
    firstStep: {
      title: "Deposit LST/LRT Collateral into Capped Curated Vaults",
      action: "Stake wstETH or sUSDe into active Symbiotic vaults and route receipt tokens into secondary yield markets.",
      targetMetric: "Continuous deposit held >= 60 days",
      estimatedTimeMin: 12,
      categoryTag: "restake",
    },
    catalyst: "Leading modular restaking TVL without a native governance token",
  },
  lombard: {
    strategyName: "LBTC Minting & Cross-DeFi BTCfi Looping",
    snapshotWindow: "Mid-term TGE (Lux points accumulation)",
    firstStep: {
      title: "Mint LBTC and Deploy into Partner Lending/DEX Pools",
      action: "Convert BTC to LBTC and supply into high-multiplier DeFi integrations rather than holding idle in wallet.",
      targetMetric: "Active LBTC DeFi LP/lending multiplier >= 2x",
      estimatedTimeMin: 20,
      categoryTag: "btcfi",
    },
    catalyst: "Dominant liquid-staked Bitcoin footprint across EVM chains",
  },
  paradex: {
    strategyName: "Perp OI Maintenance & Gigavault Yield Capture",
    snapshotWindow: "Active XP epoch schedule",
    firstStep: {
      title: "Combine Maker Perp Volume with Vault Margin",
      action: "Trade zero-fee maker perps while maintaining hedged open interest and allocating idle USDC to the vault.",
      targetMetric: "Weekly XP consistency over 8+ epochs",
      estimatedTimeMin: 15,
      categoryTag: "perps",
    },
    catalyst: "Structured weekly XP program tied to volume and TVL",
  },
  lighter: {
    strategyName: "Orderbook Market-Making & Perp Point Farming",
    snapshotWindow: "Private-to-public mainnet points phase",
    firstStep: {
      title: "Maintain Tight Maker Quotes and Balanced Perp OI",
      action: "Use limit orders on major BTC/ETH/SOL perp books while keeping delta hedged across an external venue.",
      targetMetric: "Consistent weekly maker fills + zero wash-trade loops",
      estimatedTimeMin: 15,
      categoryTag: "perps",
    },
    catalyst: "Rapidly scaling verifiable zk-orderbook perp volume",
  },
  relay: {
    strategyName: "Multi-Corridor Instant Bridge & Swap Cadence",
    snapshotWindow: "Mid-term infrastructure token watch",
    firstStep: {
      title: "Bridge Across 5+ Distinct L2 Corridors Organically",
      action: "Use Relay as primary cross-chain router between Base, Arbitrum, Optimism, and Solana with varied ticket sizes.",
      targetMetric: "15+ bridges across 5+ chains and 6+ distinct weeks",
      estimatedTimeMin: 8,
      categoryTag: "bridge",
    },
    catalyst: "High organic cross-chain fill count and solver revenue",
  },
  jumper: {
    strategyName: "LI.FI Multi-Chain Aggregator XP & Loyalty Pass",
    snapshotWindow: "Loyalty Pass seasonal milestone window",
    firstStep: {
      title: "Route Cross-Chain Swaps via Jumper UI for Loyalty XP",
      action: "Consolidate routine L2 swaps and bridges through Jumper to climb monthly Loyalty Pass tiers.",
      targetMetric: "Top Loyalty Pass tier + 4+ source chains",
      estimatedTimeMin: 10,
      categoryTag: "bridge",
    },
    catalyst: "Explicit Loyalty Pass XP tracking across LI.FI routers",
  },
  base: {
    strategyName: "Ecosystem Native Usage, LP Depth & Builder Footprint",
    snapshotWindow: "Speculative long-horizon L2 decentralization watch",
    firstStep: {
      title: "Establish Deep On-Chain History Across Core Base dApps",
      action: "Bridge via canonical bridge, supply liquidity on native DEXs/lending markets, and interact across 10+ contracts.",
      targetMetric: "12+ active months, 20+ contracts, durable DeFi TVL",
      estimatedTimeMin: 15,
      categoryTag: "ecosystem",
    },
    catalyst: "Largest EVM L2 activity footprint if governance decentralizes",
  },
  linea: {
    strategyName: "LXP-L Liquidity Provision & Native DeFi Retention",
    snapshotWindow: "Near-term TGE watch (post-Surge campaign)",
    firstStep: {
      title: "Maintain Sticky Core DeFi Liquidity on Linea",
      action: "Supply ETH or stables in leading Linea lending and DEX pools while keeping weekly native tx cadence.",
      targetMetric: "Durable TVL + verified Proof-of-Humanity wallet",
      estimatedTimeMin: 12,
      categoryTag: "ecosystem",
    },
    catalyst: "Multi-season LXP and LXP-L campaigns signaling token distribution",
  },
  abstract: {
    strategyName: "Consumer App XP & Weekly Portal Streak",
    snapshotWindow: "Active XP seasons",
    firstStep: {
      title: "Complete Weekly Portal Quests & Native App Interactions",
      action: "Fund Abstract Global Wallet, swap on native DEXs, and engage with featured consumer apps every week.",
      targetMetric: "8+ consecutive weekly XP drops",
      estimatedTimeMin: 12,
      categoryTag: "ecosystem",
    },
    catalyst: "Live weekly XP leaderboard on ZK consumer rollup",
  },
  opensea: {
    strategyName: "OS2 Cross-Chain Marketplace & Token Swap Activity",
    snapshotWindow: "Confirmed SEA token launch window",
    firstStep: {
      title: "Trade Collections & Place Collection Offers on OS2",
      action: "Generate organic marketplace bids, listings, and OS2 token swaps across supported chains without self-trading.",
      targetMetric: "Active OS2 XP rank across 6+ weeks",
      estimatedTimeMin: 12,
      categoryTag: "nft",
    },
    catalyst: "Confirmed SEA token plan rewarding historical and OS2 activity",
  },
  resolv: {
    strategyName: "USR Stablecoin Yield & Pendle Point Multiplier",
    snapshotWindow: "Active points epoch window",
    firstStep: {
      title: "Mint/Hold USR and Deploy into Boosted LP/Pendle Pools",
      action: "Convert USDC into USR or RLP and pair in whitelisted pools to stack base yield plus protocol points.",
      targetMetric: "Continuous USR/RLP position >= 45 days",
      estimatedTimeMin: 12,
      categoryTag: "yield",
    },
    catalyst: "Delta-neutral stablecoin TVL surge with active points tracking",
  },
  rabby: {
    strategyName: "Native In-Wallet Swap & Gas Top-Up Points",
    snapshotWindow: "Ongoing Rabby Points campaign",
    firstStep: {
      title: "Execute Periodic In-Wallet Swaps & Claim Weekly Points",
      action: "Route organic L2 swaps through Rabby Swap and use GasAccount top-ups while maintaining clean wallet hygiene.",
      targetMetric: "Weekly swap cadence + claimed Rabby Points",
      estimatedTimeMin: 6,
      categoryTag: "wallet",
    },
    catalyst: "Live wallet points program backed by DeBank ecosystem",
  },
  metamask: {
    strategyName: "Portfolio Swap, Bridge & Staking Footprint",
    snapshotWindow: "Long-horizon decentralization watch",
    firstStep: {
      title: "Use MetaMask Portfolio Swaps, Bridge & Native Staking",
      action: "Execute moderate-size swaps and bridges on low-fee L2s via MetaMask Portfolio to establish multi-quarter history.",
      targetMetric: "$5k+ cumulative Portfolio volume across 3+ chains",
      estimatedTimeMin: 10,
      categoryTag: "wallet",
    },
    catalyst: "Dominant Web3 wallet fee engine with recurring token speculation",
  },
  backpack: {
    strategyName: "Exchange Volume, Lending Yield & Wallet Synergy",
    snapshotWindow: "Active seasonal rank program",
    firstStep: {
      title: "Generate Spot/Perp Volume and Enable Auto-Lend Collateral",
      action: "Trade liquid pairs on Backpack Exchange while keeping margin lent out and pairing activity with Backpack Wallet.",
      targetMetric: "Consistent seasonal volume rank across 6+ weeks",
      estimatedTimeMin: 15,
      categoryTag: "perps",
    },
    catalyst: "Seasonal rank system across exchange and Solana wallet stack",
  },
};

const ARCHETYPES: Record<FarmCategoryBucket, ArchetypeTemplate> = {
  dex: {
    strategyName: "Concentrated LP Fee Farming & Organic Swap Cadence",
    difficulty: "Medium",
    sybilSensitivity: "Medium",
    frequency: "Weekly rebalance & swap",
    minActiveWeeks: 8,
    txPerWeek: 3,
    gasMult: 1.2,
    tierAlloc: [
      "70% wide-range blue-chip LP, 30% weekly spot swaps",
      "60% active concentrated LP, 25% stable LP, 15% swap volume",
      "50% multi-tier CLMM ranges, 35% stable pools, 15% fee-tier routing",
    ],
    baseRisk: {
      code: "IMPERMANENT_LOSS",
      severity: "medium",
      label: "Impermanent Loss on Volatile Ranges",
      mitigation: "Favor correlated pairs (stables/LSTs) or keep range width >= +/-15%.",
    },
    steps: (c) => [
      { title: `Onboard Liquidity to ${c.chain}`, action: `Bridge core assets (ETH/USDC/SOL) onto ${c.chain} using a native or canonical route.`, targetMetric: "Clean funded address with >= 3 prior chain txs", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Seed Fee-Generating Core LP Position", action: `Supply liquidity to ${c.name}'s top fee-generating pool (current protocol TVL ${c.tvlText}) and keep position in range.`, targetMetric: "Hold active LP >= 30 days earning real fees", estimatedTimeMin: 12, categoryTag: "lp" },
      { title: "Build Multi-Week Organic Swap History", action: `Route routine spot swaps across 3+ token pairs on ${c.name} UI with varied ticket sizes.`, targetMetric: "15+ swaps across >= 6 distinct weeks", estimatedTimeMin: 8, categoryTag: "volume" },
      { title: "Harvest & Compound Fees Periodically", action: "Claim accrued LP fees and test limit/TWAP order modules if available to qualify for power-user multipliers.", targetMetric: "2+ feature modules used + fee harvest tx", estimatedTimeMin: 6, categoryTag: "retention" },
    ],
  },
  perps: {
    strategyName: "Delta-Neutral Maker Volume & Vault Liquidity",
    difficulty: "High",
    sybilSensitivity: "High",
    frequency: "2-3 sessions/week",
    minActiveWeeks: 8,
    txPerWeek: 5,
    gasMult: 1.0,
    tierAlloc: [
      "60% protocol liquidity vault, 40% low-leverage (<=2x) maker trades",
      "50% hedged perp margin (<=3x), 50% HLP/protocol vault",
      "45% multi-pair maker OI hedged externally, 55% vault liquidity",
    ],
    baseRisk: {
      code: "LIQUIDATION_AND_FUNDING",
      severity: "high",
      label: "Leverage Liquidation & Funding Bleed",
      mitigation: "Cap leverage at <=3x, hedge directional delta externally, and avoid negative funding traps.",
    },
    steps: (c) => [
      { title: `Deposit Margin Collateral on ${c.chain}`, action: `Fund your ${c.name} margin account with USDC/USDT on ${c.chain} and enable sub-account risk caps.`, targetMetric: "Active margin balance maintained across epochs", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Generate Maker-Weighted Perp Volume", action: `Place resting limit orders on liquid BTC/ETH/SOL perp markets on ${c.name} to capture maker fee rebates and volume points.`, targetMetric: "Weekly volume >= 10x deposited collateral", estimatedTimeMin: 20, categoryTag: "volume" },
      { title: "Hold Genuine Open Interest Overnight", action: "Maintain delta-hedged positions for 12-48h rather than instant open/close loops that trigger wash-trade filters.", targetMetric: "Average hold duration >= 12h per trade", estimatedTimeMin: 10, categoryTag: "oi" },
      { title: "Allocate Idle Margin to Protocol Vault", action: `Deposit idle stablecoins into ${c.name}'s LP/market-making vault if offered to earn passive points and fee yield.`, targetMetric: "Sticky vault deposit >= 30 days", estimatedTimeMin: 8, categoryTag: "vault" },
    ],
  },
  lending: {
    strategyName: "Clean Supply-Borrow Utilization & Health Buffer",
    difficulty: "Low",
    sybilSensitivity: "Low",
    frequency: "Bi-weekly review",
    minActiveWeeks: 10,
    txPerWeek: 1,
    gasMult: 1.1,
    tierAlloc: [
      "100% single-sided blue-chip supply (no risky leverage)",
      "70% blue-chip supply, 30% conservative correlated borrow (<45% LTV)",
      "60% multi-market supply, 40% e-Mode LST/stable borrow loop",
    ],
    baseRisk: {
      code: "BORROW_LIQUIDATION",
      severity: "medium",
      label: "Rate Spikes & Collateral Liquidation",
      mitigation: "Keep Health Factor > 1.65 and monitor utilization caps during volatility.",
    },
    steps: (c) => [
      { title: `Supply Core Blue-Chip Collateral on ${c.chain}`, action: `Deposit ETH, WBTC, or USDC into ${c.name}'s deepest lending market (TVL ${c.tvlText}).`, targetMetric: "Supply balance held continuously >= 45 days", estimatedTimeMin: 10, categoryTag: "supply" },
      { title: "Execute Conservative Correlated Borrow", action: "Borrow <=40% LTV in a correlated asset or stablecoin to trigger borrower point multipliers safely.", targetMetric: "Active borrow position with Health Factor > 1.65", estimatedTimeMin: 10, categoryTag: "borrow" },
      { title: "Re-Deploy Borrowed Capital Productively", action: `Route borrowed stables into an integrated yield vault or LP on ${c.chain} instead of idling.`, targetMetric: "Zero circular dust loops; positive net APY", estimatedTimeMin: 10, categoryTag: "loop" },
      { title: "Perform Bi-Weekly Repay/Top-Up Hygiene", action: "Accrue interest cleanly and execute periodic partial repayments to demonstrate active stewardship.", targetMetric: "4+ lifecycle txs over >= 8 weeks", estimatedTimeMin: 6, categoryTag: "retention" },
    ],
  },
  staking: {
    strategyName: "Native Minting & Secondary DeFi Multiplier Loop",
    difficulty: "Low",
    sybilSensitivity: "Low",
    frequency: "Monthly rebalance",
    minActiveWeeks: 12,
    txPerWeek: 1,
    gasMult: 1.15,
    tierAlloc: [
      "100% native mint & hold LST/LRT on low-fee L2",
      "60% DeFi LP/lending integration, 40% native staked receipt",
      "50% Pendle/yield-market LP, 35% money-market collateral, 15% liquid reserve",
    ],
    baseRisk: {
      code: "DEPEG_AND_EXIT_QUEUE",
      severity: "medium",
      label: "Withdrawal Queue Delay & Secondary Depeg",
      mitigation: "Check DEX exit depth before sizing and avoid leveraged LRT loops near peg stress.",
    },
    steps: (c) => [
      { title: `Mint ${c.name} Staked Receipt Directly`, action: `Stake native collateral via ${c.name}'s official mint contract on ${c.chain} rather than buying on thin DEXs if mint bonus applies.`, targetMetric: "Direct protocol mint tx on-chain", estimatedTimeMin: 10, categoryTag: "mint" },
      { title: "Deploy Receipt into Boosted DeFi Pools", action: `Supply your minted token into whitelisted DEX LP, lending, or yield-splitting pools on ${c.chain} for 2x-4x points.`, targetMetric: "Active DeFi composability multiplier", estimatedTimeMin: 15, categoryTag: "multiplier" },
      { title: "Hold Through Full Epoch Snapshots", action: "Avoid withdrawing before epoch boundaries; staking protocols heavily weight time-weighted TVL.", targetMetric: "Continuous time-weighted balance >= 60 days", estimatedTimeMin: 5, categoryTag: "retention" },
      { title: "Track Redemption Queue & Re-Stake Rewards", action: "Monitor validator/operator yield and re-deploy accrued rewards across at least one secondary chain if supported.", targetMetric: "Verified points accrual & clean exit path", estimatedTimeMin: 6, categoryTag: "monitor" },
    ],
  },
  bridge: {
    strategyName: "Multi-Corridor Organic Routing & Weekly Cadence",
    difficulty: "Low",
    sybilSensitivity: "High",
    frequency: "Weekly varied corridor",
    minActiveWeeks: 10,
    txPerWeek: 2,
    gasMult: 0.9,
    tierAlloc: [
      "100% rotating working capital ($250-$1k) across L2s",
      "80% working capital bridging across 5+ chains, 20% gas reserves",
      "70% institutional-size transfers ($5k+) across L1/L2, 30% LP/solver pool",
    ],
    baseRisk: {
      code: "SYBIL_ROUNDTRIP_FILTER",
      severity: "high",
      label: "Strict Sybil & Round-Trip Clustering",
      mitigation: "Never ping-pong identical amounts back and forth; spend funds on destination dApps between bridges.",
    },
    steps: (c) => [
      { title: "Map 4-6 Distinct Source/Destination Corridors", action: `Plan organic transfers through ${c.name} linking ${c.chain}, ${c.altChain}, and at least two other active L2s.`, targetMetric: ">= 4 unique chains touched", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Execute Varied-Size Weekly Bridges", action: "Bridge non-round ticket sizes with natural 3-7 day spacing instead of bursting all volume in one weekend.", targetMetric: "12+ bridges across >= 8 distinct weeks", estimatedTimeMin: 8, categoryTag: "volume" },
      { title: "Perform Destination On-Chain Activity", action: "After each bridge arrival, execute at least one swap or deposit on the destination chain before bridging onward.", targetMetric: "Zero back-to-back round-trip transfers", estimatedTimeMin: 8, categoryTag: "hygiene" },
      { title: "Provide Bridge Liquidity (Optional Multiplier)", action: `If ${c.name} offers passive liquidity pools, allocate a small core stake to earn fee share + LP weight.`, targetMetric: "Combined user + LP eligibility", estimatedTimeMin: 10, categoryTag: "lp" },
    ],
  },
  yield: {
    strategyName: "Core Vault Retention & Yield-Token Optimization",
    difficulty: "Medium",
    sybilSensitivity: "Low",
    frequency: "Bi-weekly maturity check",
    minActiveWeeks: 10,
    txPerWeek: 1,
    gasMult: 1.0,
    tierAlloc: [
      "100% liquid stablecoin or ETH yield vault",
      "70% core vault deposit, 30% fixed-yield/LP pool",
      "60% multi-vault strategy, 25% LP, 15% YT points boost (capped risk)",
    ],
    baseRisk: {
      code: "STRATEGY_AND_PEG_RISK",
      severity: "medium",
      label: "Underlying Strategy & Stablecoin Peg Exposure",
      mitigation: "Inspect underlying collateral backing and cap exposure to unbacked or locked vaults.",
    },
    steps: (c) => [
      { title: `Audit Vault Backing & Fee Structure on ${c.chain}`, action: `Select ${c.name}'s highest-liquidity vault on ${c.chain} (TVL ${c.tvlText}) with transparent yield sources.`, targetMetric: "Liquid vault with clear redemption terms", estimatedTimeMin: 10, categoryTag: "diligence" },
      { title: "Establish Sticky Time-Weighted Deposit", action: "Deposit core capital and avoid churning in/out so time-weighted point accruals compound uninterrupted.", targetMetric: "Continuous deposit >= 45 days", estimatedTimeMin: 10, categoryTag: "deposit" },
      { title: "Stack Partner Ecosystem Multipliers", action: "Check whether receipt tokens can be paired on integrated DEXs or money markets for dual points.", targetMetric: "Active secondary integration if net APY positive", estimatedTimeMin: 12, categoryTag: "multiplier" },
      { title: "Roll Maturing Epochs Cleanly", action: "Re-allocate before pool maturity dates so idle capital does not lose point accrual velocity.", targetMetric: "Zero idle gap across epoch rollovers", estimatedTimeMin: 8, categoryTag: "retention" },
    ],
  },
  prediction: {
    strategyName: "Two-Sided Liquidity & Liquid Market Volume",
    difficulty: "Medium",
    sybilSensitivity: "High",
    frequency: "2 sessions/week",
    minActiveWeeks: 8,
    txPerWeek: 4,
    gasMult: 0.7,
    tierAlloc: [
      "100% high-liquidity binary markets with tight spreads",
      "70% resting maker limit orders, 30% directional/hedged OI",
      "60% multi-market maker quotes, 40% high-conviction OI positions",
    ],
    baseRisk: {
      code: "BINARY_EVENT_LOSS",
      severity: "high",
      label: "Binary Resolution Loss & Wash-Trade Disqualification",
      mitigation: "Avoid illiquid long-tail markets and never self-match across wallets.",
    },
    steps: (c) => [
      { title: `Fund Trading Wallet on ${c.chain}`, action: `Deposit USDC onto ${c.name} on ${c.chain} and focus strictly on deep markets with <2% bid-ask spreads.`, targetMetric: "Funded active trader profile", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Post Resting Maker Limit Orders", action: "Capture spread and liquidity rewards by placing passive bids/asks near midpoint rather than crossing wide spreads.", targetMetric: "Weekly maker fill volume + tight spread uptime", estimatedTimeMin: 15, categoryTag: "liquidity" },
      { title: "Hold Open Interest Across Categories", action: "Maintain real positions across 5+ distinct markets (macro, crypto, sports) through resolution cycles.", targetMetric: ">= 10 distinct markets traded across 6+ weeks", estimatedTimeMin: 12, categoryTag: "diversity" },
      { title: "Claim Winnings & Re-Deploy Organically", action: "Redeem settled shares promptly and maintain steady weekly active equity.", targetMetric: "Consistent weekly OI and volume", estimatedTimeMin: 6, categoryTag: "retention" },
    ],
  },
  launchpad: {
    strategyName: "Fee-Generating Native App & Discovery Cadence",
    difficulty: "Medium",
    sybilSensitivity: "High",
    frequency: "Weekly sessions",
    minActiveWeeks: 8,
    txPerWeek: 3,
    gasMult: 0.8,
    tierAlloc: [
      "100% small capped-risk spot trades on high-liquidity launches",
      "75% graduated-pool liquidity/swaps, 25% capped launch entries",
      "70% fee-generating swaps & LP, 30% diversified primary participation",
    ],
    baseRisk: {
      code: "TOKEN_RUG_VOLATILITY",
      severity: "high",
      label: "Extreme Launch Asset Volatility & Rug Exposure",
      mitigation: "Size individual launch tickets at <=2% of bankroll and favor graduated liquid pools.",
    },
    steps: (c) => [
      { title: `Use ${c.name} Native Interface Directly`, action: `Execute trades directly through ${c.name}'s official frontend on ${c.chain} so fee attribution credits your wallet.`, targetMetric: "Direct protocol fee contribution recorded", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Build Multi-Week Fee & Volume Footprint", action: "Trade liquid graduated pools with tight stop-losses to accumulate protocol fee share without chasing illiquid microcaps.", targetMetric: "$50+ cumulative protocol fees paid across 6+ weeks", estimatedTimeMin: 15, categoryTag: "volume" },
      { title: "Engage Secondary Platform Modules", action: "Use staking, watchlist, or creator/referral utilities native to the app to widen eligibility criteria.", targetMetric: "2+ native features used", estimatedTimeMin: 8, categoryTag: "diversity" },
      { title: "Preserve Capital with Strict Take-Profit Rules", action: "Sweep gains back to base currency weekly so airdrop upside is not erased by token drawdowns.", targetMetric: "Positive or flat realized PnL", estimatedTimeMin: 8, categoryTag: "risk" },
    ],
  },
  wallet: {
    strategyName: "In-Wallet Swap, Bridge & Multi-Chain Hygiene",
    difficulty: "Low",
    sybilSensitivity: "High",
    frequency: "Weekly routine swap",
    minActiveWeeks: 10,
    txPerWeek: 2,
    gasMult: 0.8,
    tierAlloc: [
      "100% routine L2 swaps ($50-$250 tickets)",
      "80% weekly L2 swaps, 20% cross-chain bridge routing",
      "70% high-ticket blue-chip swaps, 30% native staking/bridge",
    ],
    baseRisk: {
      code: "FEE_DRAG_AND_SYBIL",
      severity: "medium",
      label: "Router Markup Fee Drag & Sybil Pruning",
      mitigation: "Route swaps on low-fee L2s and consolidate activity onto 1-2 aged primary wallets.",
    },
    steps: (c) => [
      { title: `Activate ${c.name} on an Aged Primary Address`, action: "Import or run a wallet with real prior mainnet/L2 history rather than spinning up fresh zero-history wallets.", targetMetric: "Aged wallet with real on-chain footprint", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Route Weekly Swaps via Native Aggregator", action: `Swap liquid pairs on ${c.chain} inside ${c.name}'s built-in swap module to generate direct fee attribution.`, targetMetric: "$2.5k+ cumulative in-wallet swap volume", estimatedTimeMin: 8, categoryTag: "volume" },
      { title: "Use Built-In Bridge & Gas Features", action: "Execute at least 3 cross-chain bridges and use native gas/staking tools if available.", targetMetric: "3+ native wallet modules exercised", estimatedTimeMin: 10, categoryTag: "diversity" },
      { title: "Claim Points & Maintain Monthly Streak", action: "Check in weekly to claim any loyalty points and keep active-month count uninterrupted.", targetMetric: "8+ active weeks / 3+ active months", estimatedTimeMin: 5, categoryTag: "retention" },
    ],
  },
  chain: {
    strategyName: "Canonical Bridge, Multi-dApp Diversity & Sticky TVL",
    difficulty: "Medium",
    sybilSensitivity: "High",
    frequency: "Weekly 2-3 dApp txs",
    minActiveWeeks: 12,
    txPerWeek: 3,
    gasMult: 0.9,
    tierAlloc: [
      "60% native lending/LP TVL, 40% weekly dApp exploration",
      "70% core DeFi TVL across 2 protocols, 30% weekly multi-contract cadence",
      "80% sticky blue-chip TVL across top 3 native protocols, 20% governance/NFTs",
    ],
    baseRisk: {
      code: "STRICT_L2_SYBIL_CRITERIA",
      severity: "high",
      label: "Multi-Factor L2 Sybil & Minimum-Balance Cutoffs",
      mitigation: "Bridge canonically once, hold real TVL (>=30d), and interact with 10+ distinct verified contracts.",
    },
    steps: (c) => [
      { title: `Bridge via ${c.name} Canonical Bridge`, action: `Send an initial meaningful deposit directly through ${c.name}'s official bridge to lock in canonical-bridge eligibility.`, targetMetric: "1+ canonical bridge tx recorded", estimatedTimeMin: 12, categoryTag: "bridge" },
      { title: "Anchor Sticky Native DeFi TVL", action: `Supply ETH or stablecoins into top-2 native DEX and lending protocols on ${c.name}.`, targetMetric: "Continuous native TVL held >= 45 days", estimatedTimeMin: 15, categoryTag: "tvl" },
      { title: "Build Contract & Active-Month Diversity", action: "Interact weekly across swaps, lending, domains, and consumer apps to cross common 10-contract / 3-month thresholds.", targetMetric: "12+ unique contracts across >= 3 distinct months", estimatedTimeMin: 12, categoryTag: "diversity" },
      { title: "Verify Identity / Ecosystem Quests", action: "Complete any official proof-of-humanity, passport, or ecosystem badge checks before snapshots close.", targetMetric: "Verified human / ecosystem badge status", estimatedTimeMin: 10, categoryTag: "identity" },
    ],
  },
  rwa: {
    strategyName: "Institutional Yield Holding & DeFi Collateral Composability",
    difficulty: "Low",
    sybilSensitivity: "Low",
    frequency: "Monthly check",
    minActiveWeeks: 12,
    txPerWeek: 1,
    gasMult: 1.1,
    tierAlloc: [
      "100% permissionless RWA yield token hold on L2",
      "70% permissionless RWA hold, 30% DeFi lending collateral",
      "60% primary KYC mint/vault, 40% DeFi money-market integration",
    ],
    baseRisk: {
      code: "KYC_AND_GEO_RESTRICTIONS",
      severity: "medium",
      label: "Geo-Blocking & KYC Airdrop Eligibility Limits",
      mitigation: "Verify jurisdictional eligibility before committing large capital for token upside.",
    },
    steps: (c) => [
      { title: `Acquire ${c.name} Yield Asset on ${c.chain}`, action: `Mint or swap into ${c.name}'s yield-bearing RWA token on ${c.chain} while confirming fee and redemption mechanics.`, targetMetric: "Active on-chain balance", estimatedTimeMin: 12, categoryTag: "setup" },
      { title: "Deploy into Whitelisted DeFi Integrations", action: "Supply the RWA token as collateral or stable-pair LP to capture partner points on top of T-bill yield.", targetMetric: "Active DeFi multiplier >= 30 days", estimatedTimeMin: 12, categoryTag: "multiplier" },
      { title: "Hold Through Quarterly Yield Cycles", action: "Maintain uninterrupted balance across quarterly snapshots with minimal churn.", targetMetric: "Continuous holding >= 60 days", estimatedTimeMin: 5, categoryTag: "retention" },
      { title: "Review Compliance & Claim Readiness", action: "Track governance announcements and verify non-restricted claim pathway ahead of TGE.", targetMetric: "Confirmed eligibility status", estimatedTimeMin: 6, categoryTag: "compliance" },
    ],
  },
  nft: {
    strategyName: "Organic Bid Depth & Cross-Chain Collection Volume",
    difficulty: "Medium",
    sybilSensitivity: "High",
    frequency: "Weekly bids & trades",
    minActiveWeeks: 8,
    txPerWeek: 3,
    gasMult: 0.9,
    tierAlloc: [
      "100% low-fee L2/Solana liquid collection bids",
      "70% collection-offer liquidity, 30% organic flips/swaps",
      "60% blue-chip bid depth, 40% cross-chain marketplace volume",
    ],
    baseRisk: {
      code: "FLOOR_ILLIQUIDITY",
      severity: "high",
      label: "NFT Floor Drawdowns & Bid Fill Adverse Selection",
      mitigation: "Bid below floor on high-volume collections and cap single-collection exposure.",
    },
    steps: (c) => [
      { title: `Place Tight Collection Offers on ${c.name}`, action: `Post active bids near floor on top-10 liquid collections on ${c.chain} to earn liquidity/maker loyalty.`, targetMetric: "Active bid uptime across >= 6 weeks", estimatedTimeMin: 12, categoryTag: "liquidity" },
      { title: "Execute Genuine Multi-Collection Volume", action: "Buy and list across distinct liquid collections without ever trading between self-controlled wallets.", targetMetric: "5+ distinct collections traded", estimatedTimeMin: 12, categoryTag: "volume" },
      { title: "Exercise Native Token Swap / Aggregator Tools", action: `Use any token swap or cross-chain checkout features built into ${c.name}.`, targetMetric: "Multi-feature platform usage", estimatedTimeMin: 8, categoryTag: "diversity" },
      { title: "Keep Royalty & Listing Hygiene Clean", action: "Avoid rapid cancel-spamming; honor clean order fills to stay out of wash-trade filters.", targetMetric: "High organic quality score", estimatedTimeMin: 6, categoryTag: "hygiene" },
    ],
  },
  generic: {
    strategyName: "Core Liquidity Retention & Multi-Week Protocol Usage",
    difficulty: "Medium",
    sybilSensitivity: "Medium",
    frequency: "Weekly interaction",
    minActiveWeeks: 8,
    txPerWeek: 2,
    gasMult: 1.0,
    tierAlloc: [
      "100% core deposit + weekly native interaction",
      "75% sticky protocol TVL, 25% active feature exploration",
      "80% core capital deposit, 20% partner DeFi integrations",
    ],
    baseRisk: {
      code: "EXECUTION_AND_TIMING",
      severity: "medium",
      label: "Uncertain Token Timeline & Opportunity Cost",
      mitigation: "Prioritize deposits that earn real base yield so capital remains productive if TGE slips.",
    },
    steps: (c) => [
      { title: `Onboard Clean Capital to ${c.chain}`, action: `Fund an established wallet on ${c.chain} and verify official ${c.name} app URLs and contract addresses.`, targetMetric: "Verified contract interaction", estimatedTimeMin: 8, categoryTag: "setup" },
      { title: "Commit Core Sticky TVL", action: `Deposit capital into ${c.name}'s primary pool/vault (current TVL ${c.tvlText}) and hold through snapshot cycles.`, targetMetric: "Continuous deposit >= 45 days", estimatedTimeMin: 12, categoryTag: "tvl" },
      { title: "Maintain Multi-Week Feature Cadence", action: `Interact with at least 2 core modules on ${c.name} weekly with organic sizing.`, targetMetric: "12+ txs across >= 6 distinct weeks", estimatedTimeMin: 10, categoryTag: "cadence" },
      { title: "Capture Partner & Governance Signals", action: "Join official points trackers, guild/badge verifications, or testnet milestones if live.", targetMetric: "All eligibility checkpoints completed", estimatedTimeMin: 6, categoryTag: "retention" },
    ],
  },
};

function norm(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function pickChains(input: FarmProtocolInput): { primary: string; supported: string[] } {
  const fromMap: Array<[string, number]> = [];
  if (input.chainTvls) {
    for (const [k, v] of Object.entries(input.chainTvls)) {
      const low = k.toLowerCase();
      if (low.includes("-") || low === "borrowed" || low === "staking" || low === "pool2" || low === "offers") {
        continue;
      }
      if (typeof v === "number" && v > 0) fromMap.push([k, v]);
    }
  }
  fromMap.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rawList = [
    ...fromMap.map(([k]) => k),
    ...(input.chains ?? []),
    ...(input.chain ? [input.chain] : []),
  ].filter((c) => c && c !== "Multi-Chain");
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const c of rawList) {
    const key = norm(c);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  const primary = unique[0] ?? "Ethereum";
  return { primary, supported: unique.length ? unique.slice(0, 6) : [primary] };
}

export function classifyFarmCategory(category?: string | null, name?: string | null): FarmCategoryBucket {
  const c = norm(category);
  const n = norm(name);
  if (c.includes("prediction") || n.includes("polymarket") || n.includes("kalshi")) return "prediction";
  if (c.includes("perp") || c.includes("derivative") || c.includes("option") || c.includes("synthetics")) return "perps";
  if (c.includes("dex") || c.includes("amm") || c.includes("liquidity manager")) return "dex";
  if (c.includes("lending") || c.includes("cdp") || c.includes("borrow")) return "lending";
  if (c.includes("restaking") || c.includes("liquid staking") || c.includes("staking")) return "staking";
  if (c.includes("bridge") || c.includes("cross chain")) return "bridge";
  if (c.includes("launchpad") || c.includes("telegram") || c.includes("trading app") || c.includes("bot")) return "launchpad";
  if (c.includes("wallet") || n.includes("rabby") || n.includes("metamask")) return "wallet";
  if (c.includes("rwa")) return "rwa";
  if (c.includes("nft")) return "nft";
  if (c.includes("chain") || c.includes("rollup") || c.includes("l2")) return "chain";
  if (c.includes("yield") || c.includes("basis") || c.includes("farm") || c.includes("vault")) return "yield";
  return "generic";
}

function findOverride(input: FarmProtocolInput): ProtocolOverride | undefined {
  const slug = norm(input.slug);
  const name = norm(input.name);
  if (PROTOCOL_OVERRIDES[slug]) return PROTOCOL_OVERRIDES[slug];
  for (const [k, v] of Object.entries(PROTOCOL_OVERRIDES)) {
    if (slug.startsWith(`${k}-`) || name === k || name.startsWith(`${k} `)) return v;
  }
  return undefined;
}

function computeRiskFlags(
  input: FarmProtocolInput,
  archetype: ArchetypeTemplate,
  primaryChain: string,
): RiskFlag[] {
  const flags: RiskFlag[] = [archetype.baseRisk];
  const tvl = input.tvl ?? 0;
  const ch7 = input.change_7d ?? 0;
  const ch30 = input.change_1m ?? 0;
  const audits = input.audits;
  const isLowFee = LOW_FEE_CHAINS.has(norm(primaryChain));

  if (tvl >= 500e6 || ch30 > 120) {
    flags.push({
      code: "FARMER_CROWDING",
      severity: tvl >= 1.5e9 ? "high" : "medium",
      label: "Heavy TVL Crowding & Point Dilution",
      mitigation: "Focus on fee-generating or active LP tiers rather than passive whale-dominated pools.",
    });
  } else if (tvl > 0 && tvl < 15e6) {
    flags.push({
      code: "EARLY_STAGE_TVL",
      severity: "high",
      label: "Thin Liquidity & Early Smart-Contract Risk",
      mitigation: "Cap allocation at <=5% of farming bankroll until TVL and audit depth mature.",
    });
  }

  if (!isLowFee && norm(primaryChain) === "ethereum") {
    flags.push({
      code: "MAINNET_GAS_DRAG",
      severity: "medium",
      label: "Ethereum L1 Gas Drag on Small Wallets",
      mitigation: "Batch interactions during <15 gwei windows or farm via supported L2 deployments.",
    });
  }

  if (audits === 0 || audits === "0" || audits === null || audits === undefined || audits === "") {
    flags.push({
      code: "AUDIT_UNVERIFIED",
      severity: "medium",
      label: "No Verified Audit Count in Snapshot",
      mitigation: "Verify recent independent audit reports and revoke unlimited token approvals after use.",
    });
  }

  if (ch7 > 60 || ch7 < -35) {
    flags.push({
      code: "TVL_VOLATILITY",
      severity: "low",
      label: ch7 > 60 ? "Rapid Mercenary TVL Inflow Spike" : "Sharp 7d TVL Outflow",
      mitigation: "Verify whether yield incentives or campaign changes triggered the abrupt capital shift.",
    });
  }

  const order: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  const dedup = new Map<string, RiskFlag>();
  for (const f of flags) if (!dedup.has(f.code)) dedup.set(f.code, f);
  return [...dedup.values()].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 4);
}

function buildCapitalTiers(
  archetype: ArchetypeTemplate,
  primaryChain: string,
  impliedAirdropUsd: number,
  tvl: number,
): CapitalTierPlan[] {
  const lowFee = LOW_FEE_CHAINS.has(norm(primaryChain));
  const baseGas = lowFee ? 3 : 28;
  const starterGas = Math.max(1, Math.round(baseGas * archetype.gasMult));
  const coreGas = Math.max(2, Math.round(baseGas * archetype.gasMult * 1.6));
  const whaleGas = Math.max(4, Math.round(baseGas * archetype.gasMult * 2.5));
  const poolNote = impliedAirdropUsd > 0 ? `Est. pool ${fmtUsd(impliedAirdropUsd)}` : "Uncapped upside";
  const dilution = tvl > 500e6 ? "high TVL competition" : tvl > 50e6 ? "balanced TVL competition" : "early low-dilution window";
  return [
    {
      tier: "Starter",
      rangeUsd: "$250 - $1,000",
      allocation: archetype.tierAlloc[0],
      estGasMonthlyUsd: starterGas,
      expectedShareNote: `Targets base eligibility & anti-sybil floor (${dilution}).`,
    },
    {
      tier: "Core",
      rangeUsd: "$2,500 - $15,000",
      allocation: archetype.tierAlloc[1],
      estGasMonthlyUsd: coreGas,
      expectedShareNote: `Optimal risk-adjusted tier for top-10% wallet rank (${poolNote}).`,
    },
    {
      tier: "Whale",
      rangeUsd: "$25,000+",
      allocation: archetype.tierAlloc[2],
      estGasMonthlyUsd: whaleGas,
      expectedShareNote: `Captures TVL/volume leaderboard weight with fee-yield cushion (${poolNote}).`,
    },
  ];
}

function buildCatalysts(input: FarmProtocolInput, override?: ProtocolOverride): string[] {
  const out: string[] = [];
  if (override?.catalyst) out.push(override.catalyst);
  const tvl = input.tvl ?? 0;
  const fees = input.fees24h ?? 0;
  const ch30 = input.change_1m ?? 0;
  if (fees >= 50_000) out.push(`Strong organic fee engine (${fmtUsd(fees * 365)} annualized run-rate)`);
  if (tvl >= 100e6) out.push(`Deep institutional-grade TVL base (${fmtUsd(tvl)})`);
  if (ch30 >= 25) out.push(`Accelerating 30d capital inflow (+${ch30.toFixed(0)}%)`);
  if ((input.chains?.length ?? 0) >= 3) out.push(`Multi-chain footprint across ${input.chains?.length} networks`);
  if (out.length === 0) out.push("Tokenless market positioning with open early-adopter distribution window");
  return out.slice(0, 3);
}

export function buildFarmPlan(input: FarmProtocolInput): FarmPlan {
  const bucket = classifyFarmCategory(input.category, input.name);
  const archetype = ARCHETYPES[bucket];
  const override = findOverride(input);
  const { primary, supported } = pickChains(input);
  const altChain = supported[1] ?? (norm(primary) === "arbitrum" ? "Base" : "Arbitrum");
  const tvl = Math.max(0, input.tvl ?? 0);
  const impliedFdv = Math.max(0, input.impliedFdv ?? 0);
  const impliedAirdrop = Math.max(0, input.impliedAirdropUsd ?? 0);

  const ctx: PlaybookCtx = { name: input.name, chain: primary, tvlText: fmtUsd(tvl), altChain };
  const rawSteps = archetype.steps(ctx);
  const mergedSteps = override ? [override.firstStep, ...rawSteps.slice(1)] : rawSteps;
  const steps: FarmStep[] = mergedSteps.map((s, idx) => ({ order: idx + 1, ...s }));

  const lowFee = LOW_FEE_CHAINS.has(norm(primary));
  const diffBase = archetype.difficulty === "High" ? 72 : archetype.difficulty === "Medium" ? 50 : 30;
  const effortScore = Math.min(95, Math.max(20, diffBase + (lowFee ? 0 : 10) + archetype.txPerWeek * 3));

  const snapshotWindow =
    override?.snapshotWindow ??
    (tvl >= 250e6 || (input.fees24h ?? 0) >= 100_000
      ? "Near-to-mid term TGE window (3-6 months)"
      : tvl >= 30e6
        ? "Mid-term accumulation window (6-9 months)"
        : "Early positioning window (6-12+ months)");

  const riskFlags = computeRiskFlags(input, archetype, primary);
  const capitalTiers = buildCapitalTiers(archetype, primary, impliedAirdrop, tvl);
  const airdropCatalysts = buildCatalysts(input, override);
  const strategyName = override?.strategyName ?? archetype.strategyName;

  const fdvClause = impliedFdv > 0 ? ` against an implied ${fmtUsd(impliedFdv)} FDV` : "";
  const summary = `${strategyName} on ${primary}: sustain ${archetype.frequency.toLowerCase()} for ${archetype.minActiveWeeks}+ weeks to capture ${input.name} launch upside${fdvClause}.`;

  return {
    archetype: bucket,
    strategyName,
    difficulty: archetype.difficulty,
    effortScore,
    sybilSensitivity: archetype.sybilSensitivity,
    primaryChain: primary,
    supportedChains: supported,
    cadence: {
      frequency: archetype.frequency,
      minActiveWeeks: archetype.minActiveWeeks,
      recommendedTxPerWeek: archetype.txPerWeek,
      snapshotWindow,
    },
    capitalTiers,
    steps,
    riskFlags,
    airdropCatalysts,
    summary,
  };
}

export function formatFarmSummaryLine(plan: FarmPlan): string {
  const highRisks = plan.riskFlags.filter((r) => r.severity === "high").length;
  return `${plan.strategyName} · ${plan.primaryChain} · ${plan.difficulty} effort (${plan.cadence.minActiveWeeks}w+) · ${highRisks} high-risk flag${highRisks === 1 ? "" : "s"}`;
}