export interface FarmStep {
  order: number;
  action: string;
  detail: string;
  targetMetric: string;
  cadence: string;
  estimatedGasUsd: number;
  priority: "core" | "multiplier" | "optional";
}

export interface CapitalTier {
  tier: "starter" | "active" | "whale";
  label: string;
  minUsd: number;
  maxUsd: number;
  strategy: string;
  estimatedYieldNote: string;
}

export interface RiskNote {
  level: "low" | "medium" | "high";
  category: string;
  summary: string;
}

export interface FarmPlan {
  strategyTitle: string;
  difficulty: "low" | "medium" | "high";
  timeHorizon: string;
  recommendedChain: string;
  sybilDefenseNote: string;
  estimatedSetupCostUsd: number;
  steps: FarmStep[];
  capitalTiers: CapitalTier[];
  catalystTags: string[];
  riskNotes: RiskNote[];
  summary: string;
}

export interface FarmProtocolInput {
  name: string;
  slug?: string;
  category?: string;
  chains?: string[];
  chain?: string;
  tvl?: number;
  impliedFdv?: number;
  impliedValue?: number;
  airdropPoolUsd?: number;
  fundingUsd?: number;
  change_7d?: number | null;
  change_1m?: number | null;
  url?: string;
  description?: string;
  audited?: boolean;
  isWatchlist?: boolean;
  score?: number;
  launchWindow?: string;
}

interface ChainProfile {
  name: string;
  txGasUsd: number;
  speed: "fast" | "medium";
  priorityRank: number;
  bridgeHint: string;
}

interface CategoryPlaybook {
  key: string;
  title: string;
  difficulty: "low" | "medium" | "high";
  sybilNote: string;
  steps: (p: { name: string; chain: string; gas: number; bridge: string }) => FarmStep[];
  risks: RiskNote[];
}

const CHAIN_PROFILES: Record<string, ChainProfile> = {
  ethereum: { name: "Ethereum", txGasUsd: 4.5, speed: "medium", priorityRank: 45, bridgeHint: "Fund directly on Ethereum mainnet during off-peak UTC hours to limit gas drag" },
  arbitrum: { name: "Arbitrum", txGasUsd: 0.08, speed: "fast", priorityRank: 92, bridgeHint: "Bridge ETH/USDC to Arbitrum via canonical or low-fee intent bridge" },
  base: { name: "Base", txGasUsd: 0.03, speed: "fast", priorityRank: 96, bridgeHint: "Bridge ETH/USDC onto Base for sub-cent execution and high tx cadence" },
  optimism: { name: "Optimism", txGasUsd: 0.05, speed: "fast", priorityRank: 88, bridgeHint: "Bridge ETH/USDC to OP Mainnet for low-cost recurring interactions" },
  solana: { name: "Solana", txGasUsd: 0.01, speed: "fast", priorityRank: 95, bridgeHint: "Fund a native Solana wallet with SOL and USDC to keep rent and fees negligible" },
  sui: { name: "Sui", txGasUsd: 0.01, speed: "fast", priorityRank: 90, bridgeHint: "Bridge USDC/SUI into a native Sui wallet for fast parallel execution" },
  aptos: { name: "Aptos", txGasUsd: 0.01, speed: "fast", priorityRank: 84, bridgeHint: "Fund an Aptos wallet with APT and native USDC" },
  hyperliquid: { name: "Hyperliquid", txGasUsd: 0.01, speed: "fast", priorityRank: 94, bridgeHint: "Deposit USDC from Arbitrum into Hyperliquid spot/perp or HyperEVM" },
  berachain: { name: "Berachain", txGasUsd: 0.04, speed: "fast", priorityRank: 89, bridgeHint: "Bridge HONEY/ETH onto Berachain to stack protocol and PoL incentives" },
  sonic: { name: "Sonic", txGasUsd: 0.02, speed: "fast", priorityRank: 87, bridgeHint: "Bridge S or USDC to Sonic to capture ecosystem points alongside protocol usage" },
  linea: { name: "Linea", txGasUsd: 0.12, speed: "fast", priorityRank: 83, bridgeHint: "Bridge ETH via Linea canonical bridge to align with ecosystem snapshots" },
  scroll: { name: "Scroll", txGasUsd: 0.1, speed: "fast", priorityRank: 80, bridgeHint: "Bridge ETH/USDC to Scroll for low-cost zkEVM interaction history" },
  "zksync era": { name: "zkSync Era", txGasUsd: 0.1, speed: "fast", priorityRank: 81, bridgeHint: "Bridge ETH/USDC onto zkSync Era and maintain weekly active periods" },
  starknet: { name: "Starknet", txGasUsd: 0.08, speed: "fast", priorityRank: 82, bridgeHint: "Fund a Starknet smart wallet with ETH/STRK and USDC" },
  polygon: { name: "Polygon", txGasUsd: 0.03, speed: "fast", priorityRank: 78, bridgeHint: "Fund with POL and native USDC on Polygon PoS" },
  avalanche: { name: "Avalanche", txGasUsd: 0.08, speed: "fast", priorityRank: 79, bridgeHint: "Fund Avalanche C-Chain with AVAX and USDC" },
  bsc: { name: "BSC", txGasUsd: 0.06, speed: "fast", priorityRank: 76, bridgeHint: "Fund BNB Smart Chain with BNB and USDT/USDC" },
  mantle: { name: "Mantle", txGasUsd: 0.04, speed: "fast", priorityRank: 82, bridgeHint: "Bridge MNT/ETH to Mantle for low-fee DeFi farming" },
  blast: { name: "Blast", txGasUsd: 0.06, speed: "fast", priorityRank: 77, bridgeHint: "Bridge ETH/USDB to Blast for native yield plus protocol multipliers" },
  abstract: { name: "Abstract", txGasUsd: 0.04, speed: "fast", priorityRank: 91, bridgeHint: "Fund Abstract Global Wallet with ETH to stack XP and protocol activity" },
  ink: { name: "Ink", txGasUsd: 0.03, speed: "fast", priorityRank: 88, bridgeHint: "Bridge ETH to Ink via Superchain bridge to farm chain and app catalysts" },
  unichain: { name: "Unichain", txGasUsd: 0.03, speed: "fast", priorityRank: 90, bridgeHint: "Bridge ETH/USDC to Unichain via Superchain bridge for fast LP and swaps" },
  monad: { name: "Monad", txGasUsd: 0.02, speed: "fast", priorityRank: 93, bridgeHint: "Fund Monad wallet early to build native transaction longevity" },
  megaeth: { name: "MegaETH", txGasUsd: 0.02, speed: "fast", priorityRank: 93, bridgeHint: "Bridge ETH to MegaETH to build high-frequency organic usage" },
  bitcoin: { name: "Bitcoin", txGasUsd: 3.5, speed: "medium", priorityRank: 40, bridgeHint: "Use a dedicated Taproot/native SegWit wallet and consolidate UTXOs when mempool fees dip" },
  ton: { name: "TON", txGasUsd: 0.05, speed: "fast", priorityRank: 75, bridgeHint: "Fund Tonkeeper with TON and USDt for native Telegram/TON DeFi" },
};

function getChainProfile(chainName: string): ChainProfile {
  const key = chainName.trim().toLowerCase();
  if (CHAIN_PROFILES[key]) return CHAIN_PROFILES[key];
  return {
    name: chainName || "Ethereum",
    txGasUsd: 0.15,
    speed: "fast",
    priorityRank: 70,
    bridgeHint: `Bridge gas token and stablecoins to ${chainName || "the primary chain"} via the official route`,
  };
}

export function selectBestChain(chains?: string[], fallbackChain?: string): string {
  const list = (chains ?? []).filter((c) => Boolean(c && c.trim() && c.toLowerCase() !== "multi-chain"));
  if (list.length === 0) return fallbackChain && fallbackChain.trim() ? fallbackChain.trim() : "Ethereum";
  const sorted = [...list].sort((a, b) => {
    const pa = getChainProfile(a).priorityRank;
    const pb = getChainProfile(b).priorityRank;
    if (pb !== pa) return pb - pa;
    return a.localeCompare(b);
  });
  return sorted[0];
}

function normalizeCategoryKey(category?: string, description?: string): string {
  const text = `${category ?? ""} ${description ?? ""}`.toLowerCase();
  if (/perp|derivative|option|futures|margin|synthetics/.test(text)) return "derivatives";
  if (/restak|liquid staking|lst|lrt|staking pool/.test(text)) return "restaking";
  if (/lend|borrow|cdp|money market|credit/.test(text)) return "lending";
  if (/bridge|cross.?chain|interop|messaging|intent/.test(text)) return "bridge";
  if (/prediction|betting|polymarket|forecast/.test(text)) return "prediction";
  if (/rwa|treasury|real world|t-bill|tokenized/.test(text)) return "rwa";
  if (/yield|vault|aggregator|farm|basis|structured/.test(text)) return "yield";
  if (/dex|amm|swap|liquidity|orderbook|clmm/.test(text)) return "dex";
  if (/launchpad|nft|gaming|social|depin|ai|privacy|payment|wallet/.test(text)) return "consumer";
  return "general";
}

const PLAYBOOKS: Record<string, CategoryPlaybook> = {
  derivatives: {
    key: "derivatives",
    title: "Perp Volume & Vault Liquidity Farm",
    difficulty: "high",
    sybilNote: "Avoid self-hedging identical entry/exit timestamps across linked wallets; vary position size, pairs, and hold duration (15m+).",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Fund ${name} margin account on ${chain}`, detail: `${bridge}, then deposit USDC or native collateral into ${name} margin.`, targetMetric: ">= $250 initial margin", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: "Build organic perp volume & open interest", detail: `Execute limit-order trades on top liquid pairs on ${name} to capture maker rebates, volume points, and OI snapshots.`, targetMetric: "$10k-$100k monthly notional", cadence: "2-3 sessions/week", estimatedGasUsd: gas * 8, priority: "core" },
      { order: 3, action: "Allocate to protocol liquidity / HLP-style vault", detail: `Stake idle USDC into ${name}'s counterparty or market-making vault if available for passive daily point accrual.`, targetMetric: "20-40% of farm capital", cadence: "Hold 30+ days", estimatedGasUsd: gas * 2, priority: "multiplier" },
      { order: 4, action: "Maintain multi-epoch consistency & referral tier", detail: `Keep at least 1 active trade per weekly epoch and bind an active referral/fee-discount code before TGE snapshot.`, targetMetric: "6+ consecutive active weeks", cadence: "Weekly", estimatedGasUsd: gas * 2, priority: "optional" },
    ],
    risks: [
      { level: "high", category: "Market & Liquidation", summary: "Leverage and adverse funding swings can erase expected airdrop EV; stick to 1x-3x hedged or low-delta maker orders." },
      { level: "medium", category: "Wash-Trading Filter", summary: "Perp protocols aggressively penalize zero-hold wash trades and identical-IP wallet clusters at TGE." },
    ],
  },
  dex: {
    key: "dex",
    title: "Concentrated LP & Organic Swap Cadence",
    difficulty: "medium",
    sybilNote: "Space swaps across distinct days and pairs; avoid round-trip swaps back to the same asset within the same block.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Onboard capital to ${chain}`, detail: `${bridge} and verify official ${name} router contracts before approving spend limits.`, targetMetric: "Gas buffer + working stables/ETH", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Provide productive LP on ${name}`, detail: `Deploy liquidity into high-fee correlated or blue-chip pools (e.g. ETH/USDC or stable/stable) to earn real fees and LP snapshots.`, targetMetric: "In-range LP held >= 30 days", cadence: "Rebalance bi-weekly", estimatedGasUsd: gas * 3, priority: "core" },
      { order: 3, action: "Generate recurring swap & limit-order activity", detail: `Route genuine portfolio rebalances through ${name} across 3+ pairs to hit both volume and unique-week thresholds.`, targetMetric: ">= 8 active weeks & 3+ pairs", cadence: "Weekly", estimatedGasUsd: gas * 4, priority: "multiplier" },
      { order: 4, action: "Claim quests, badges & partner integrations", detail: `Check ${name}'s points dashboard or partner aggregators for boosted pools and early-user roles.`, targetMetric: "All core campaign badges", cadence: "Bi-weekly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "Impermanent Loss", summary: "Tight concentrated ranges amplify IL during volatile regimes; prefer correlated pairs for pure airdrop farming." },
      { level: "medium", category: "Smart Contract", summary: "Custom AMM hooks and router approvals should be capped to exact deposit amounts." },
    ],
  },
  lending: {
    key: "lending",
    title: "Supply-Borrow Points & Health-Factor Farm",
    difficulty: "medium",
    sybilNote: "Keep positions open across multiple snapshots rather than flash-depositing before rumored cutoff dates.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Prepare blue-chip collateral on ${chain}`, detail: `${bridge} using liquid assets (ETH, LSTs, WBTC, or USDC) accepted by ${name}.`, targetMetric: "Clean collateral wallet", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Supply core collateral to ${name}`, detail: `Deposit collateral into highest-multiplier or lowest-utilization markets on ${name} to establish time-weighted TVL.`, targetMetric: "Continuous supply >= 45 days", cadence: "Hold & monitor weekly", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 3, action: "Execute conservative borrow / correlated loop", detail: `Borrow a correlated asset at <= 55% LTV (e.g. borrow ETH against LST or stables against yield stables) to unlock borrow-side multipliers.`, targetMetric: "Health factor >= 1.65", cadence: "Review weekly", estimatedGasUsd: gas * 3, priority: "multiplier" },
      { order: 4, action: "Participate in governance or risk-curated vaults", detail: `Vote on Snapshot proposals or allocate a slice to curated earn vaults tied to ${name}.`, targetMetric: "On-chain governance + vault tx", cadence: "Monthly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "high", category: "Liquidation & Depeg", summary: "Oracle lag or LST depegs can liquidate looped positions; monitor borrow APR spikes and maintain a wide health margin." },
      { level: "medium", category: "Utilization Lock", summary: "100% pool utilization can temporarily delay withdrawals during market stress." },
    ],
  },
  restaking: {
    key: "restaking",
    title: "Liquid Restaking & DeFi Composability Stack",
    difficulty: "low",
    sybilNote: "Holding an LRT/LST in a DeFi integration (lending/LP/Pendle-style YT/LP) typically earns 2x-3x base staking points.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Stage base staking asset on ${chain}`, detail: `${bridge} with ETH, SOL, BTC wrapper, or native chain token supported by ${name}.`, targetMetric: "Base asset ready", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Mint ${name} staking / restaking receipt token`, detail: `Stake directly through ${name}'s native deposit contract (not just secondary DEX buys) to qualify for native minter bonuses.`, targetMetric: "Direct mint + hold >= 60 days", cadence: "Hold", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 3, action: "Deploy receipt token into partner DeFi integrations", detail: `Supply the ${name} receipt token into whitelisted lending, LP, or fixed-yield pools to stack protocol + partner points.`, targetMetric: "2x+ composability multiplier", cadence: "Review bi-weekly", estimatedGasUsd: gas * 3, priority: "multiplier" },
      { order: 4, action: "Track unstaking queue & epoch snapshots", detail: `Note withdrawal cooldown windows before TGE so you can rotate liquidity cleanly if secondary discounts widen.`, targetMetric: "Exit plan documented", cadence: "Monthly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "Slashing & Queue Delay", summary: "Unstaking queues can span 7-21 days; secondary DEX exits may trade at a 1%-4% discount during stress." },
      { level: "medium", category: "Stacked Contract Risk", summary: "Nesting LRTs inside external lending or yield protocols compounds smart contract exposure." },
    ],
  },
  bridge: {
    key: "bridge",
    title: "Multi-Corridor Bridge & Volume Consistency Farm",
    difficulty: "low",
    sybilNote: "Bridge realistic amounts across 3+ distinct chains over multiple months; avoid bouncing identical sums back and forth.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Prepare multi-chain gas starting on ${chain}`, detail: `${bridge} and hold small gas balances on at least 2 destination chains.`, targetMetric: "3+ active chains funded", cadence: "One-time setup", estimatedGasUsd: gas * 3, priority: "core" },
      { order: 2, action: `Route organic transfers through ${name}`, detail: `Use ${name} across diverse source/destination corridors for actual portfolio moves rather than ping-pong transfers.`, targetMetric: ">= 10 transfers across 3+ chains", cadence: "Weekly", estimatedGasUsd: gas * 6, priority: "core" },
      { order: 3, action: "Provide bridge LP or relayer liquidity", detail: `If ${name} offers permissionless stablecoin/ETH bridge pools, supply steady liquidity to capture LP-tier allocations.`, targetMetric: "LP held >= 30 days", cadence: "Hold", estimatedGasUsd: gas * 2, priority: "multiplier" },
      { order: 4, action: "Test secondary features & message passing", detail: `Interact with swap-and-bridge, refuel, or omnichain NFT/message features to hit feature-diversity criteria.`, targetMetric: "2+ product modules used", cadence: "Monthly", estimatedGasUsd: gas * 2, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "Bridge Security", summary: "Cross-chain messaging and solver contracts carry elevated exploit risk; avoid leaving excessive idle funds in unaudited pools." },
      { level: "medium", category: "Sybil Filtering", summary: "Bridges heavily filter single-day farmers and wallets funded from the same centralized sub-account." },
    ],
  },
  yield: {
    key: "yield",
    title: "Time-Weighted Vault & Yield Tokenization Farm",
    difficulty: "low",
    sybilNote: "Early TVL cohorts and sustained time-weighted balances outperform last-minute whale deposits.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Fund stablecoin or base yield asset on ${chain}`, detail: `${bridge} so entry/exit fees stay under 0.5% of expected yield.`, targetMetric: "Yield collateral ready", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Deposit into ${name}'s flagship vault`, detail: `Enter audited, high-liquidity strategies on ${name} to accumulate continuous time-weighted points and organic APY.`, targetMetric: "Continuous deposit >= 45 days", cadence: "Hold & monitor", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 3, action: "Use boosted maturity / lock or partner pools", detail: `Evaluate short lockup vaults or yield-token LP integrations where point multipliers outweigh liquidity lock risk.`, targetMetric: "Selective 1.5x-3x boost", cadence: "Monthly roll", estimatedGasUsd: gas * 2, priority: "multiplier" },
      { order: 4, action: "Compound rewards & verify epoch accrual", detail: `Confirm points/shares accrue cleanly on-chain and avoid withdrawing right before epoch settlement.`, targetMetric: "Zero missed epochs", cadence: "Bi-weekly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "Strategy Dependency", summary: "Underlying yield sources (basis trades, lending rates, external protocols) can compress or incur drawdowns." },
      { level: "low", category: "Opportunity Cost", summary: "Lockups may strand capital if a higher-EV TGE catalyst opens elsewhere." },
    ],
  },
  prediction: {
    key: "prediction",
    title: "High-Turnover Market Making & Liquidity Farm",
    difficulty: "medium",
    sybilNote: "Trade genuinely diverse markets with realistic hold periods; avoid opposing-side self-matching across wallets.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Fund ${name} trading wallet on ${chain}`, detail: `${bridge} with USDC collateral to trade spot prediction markets cleanly.`, targetMetric: "Collateral deposited", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: "Place resting limit orders near mid-price", detail: `Quote two-sided or near-spread limit orders on liquid ${name} markets to earn liquidity rewards and volume credit.`, targetMetric: ">= 15 distinct markets traded", cadence: "Weekly", estimatedGasUsd: gas * 4, priority: "core" },
      { order: 3, action: "Build consistent active weeks & PnL hygiene", detail: `Hold positions through resolution on high-conviction or near-certain short-dated markets to show organic user behavior.`, targetMetric: "6+ active weeks", cadence: "Weekly", estimatedGasUsd: gas * 3, priority: "multiplier" },
      { order: 4, action: "Claim resolutions & track leaderboard rank", detail: `Redeem winning shares promptly and recycle liquidity into new event categories (crypto, macro, sports).`, targetMetric: "3+ market categories", cadence: "Bi-weekly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "high", category: "Binary Outcome & Resolution", summary: "Disputed oracle resolutions and binary swings can cause sudden losses; keep position sizes small per market." },
      { level: "medium", category: "Geo / Compliance Gating", summary: "Some prediction venues restrict TGE claims by jurisdiction; verify eligibility rules early." },
    ],
  },
  rwa: {
    key: "rwa",
    title: "Yield-Bearing RWA Collateral & Ecosystem Farm",
    difficulty: "low",
    sybilNote: "RWA protocols favor steady capital duration and verified DeFi composability over high-frequency wallet churn.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Check eligibility & fund USDC on ${chain}`, detail: `${bridge} and verify whether ${name} requires allowlisting or offers permissionless DeFi wrappers.`, targetMetric: "USDC ready on-chain", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Mint or hold ${name}'s yield-bearing RWA asset`, detail: `Hold ${name}'s tokenized treasury/credit asset directly to earn baseline T-bill/credit yield while farming pre-TGE points.`, targetMetric: "Hold >= 60 days", cadence: "Hold", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 3, action: "Use RWA token as DeFi collateral or LP", detail: `Deploy the ${name} token into whitelisted stable pools or lending markets to stack real yield and points.`, targetMetric: "Active DeFi collateral", cadence: "Review monthly", estimatedGasUsd: gas * 2, priority: "multiplier" },
      { order: 4, action: "Monitor redemption windows & mint caps", detail: `Track primary mint/redemption settlement cutoffs so liquidity remains accessible near TGE.`, targetMetric: "Redemption path verified", cadence: "Monthly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "KYC & Geo Restrictions", summary: "Institutional RWA platforms may apply KYC or jurisdictional exclusions at token claim." },
      { level: "low", category: "Custodian / Issuer Risk", summary: "Off-chain collateral relies on issuer legal structure and redemption liquidity." },
    ],
  },
  consumer: {
    key: "consumer",
    title: "Early Adopter Engagement & On-Chain Streak Farm",
    difficulty: "low",
    sybilNote: "Maintain an aged wallet with natural tx diversity, social/profile completion, and multi-week streaks.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Set up profile & fund wallet on ${chain}`, detail: `${bridge} and register your main wallet profile on ${name}.`, targetMetric: "Verified active profile", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Complete core on-chain actions on ${name}`, detail: `Execute primary product flows (mint, trade, stake, or deploy) on ${name} across separate calendar weeks.`, targetMetric: "4+ unique active weeks", cadence: "Weekly", estimatedGasUsd: gas * 4, priority: "core" },
      { order: 3, action: "Unlock tiered milestones & community roles", detail: `Complete official quests, testnet-to-mainnet migrations, or creator/collector tiers tied to ${name}.`, targetMetric: "Top-quartile milestone tier", cadence: "Bi-weekly", estimatedGasUsd: gas * 2, priority: "multiplier" },
      { order: 4, action: "Maintain organic retention through TGE window", detail: `Keep periodic on-chain touches after hitting milestones so activity does not look scripted.`, targetMetric: "Continuous monthly activity", cadence: "Monthly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "Allocation Skew", summary: "Consumer and social drops can heavily weight top creators, NFT holders, or verified humans over pure tx count." },
      { level: "low", category: "Points Dilution", summary: "Zero-capital campaigns attract heavy bot competition unless paired with on-chain spend or TVL." },
    ],
  },
  general: {
    key: "general",
    title: "Core Protocol Usage & Multi-Epoch Snapshot Farm",
    difficulty: "medium",
    sybilNote: "Focus on meaningful TVL duration, distinct active months, and multiple contract interactions from one clean main wallet.",
    steps: ({ name, chain, gas, bridge }) => [
      { order: 1, action: `Onboard funds to ${chain}`, detail: `${bridge} and bookmark verified ${name} app and contract addresses.`, targetMetric: "Wallet funded", cadence: "One-time setup", estimatedGasUsd: gas * 2, priority: "core" },
      { order: 2, action: `Use ${name}'s flagship on-chain product`, detail: `Commit working capital to ${name}'s primary liquidity, staking, or settlement contract for sustained time-weighted credit.`, targetMetric: "Active position >= 30 days", cadence: "Hold & touch weekly", estimatedGasUsd: gas * 3, priority: "core" },
      { order: 3, action: "Diversify across secondary features & chains", detail: `Interact with additional ${name} modules or deployments to strengthen power-user eligibility.`, targetMetric: "2+ features & 6+ active weeks", cadence: "Bi-weekly", estimatedGasUsd: gas * 3, priority: "multiplier" },
      { order: 4, action: "Participate in governance & official campaigns", detail: `Join ${name} governance votes, feedback epochs, or ecosystem campaigns before TGE.`, targetMetric: "Community & governance proof", cadence: "Monthly", estimatedGasUsd: gas, priority: "optional" },
    ],
    risks: [
      { level: "medium", category: "No Guaranteed Token", summary: "Some profitable DeFi teams delay TGE indefinitely or distribute tokens primarily to equity/ecosystem partners." },
      { level: "medium", category: "Smart Contract", summary: "Verify audit reports and cap ERC-20 token approvals before scaling size." },
    ],
  },
};

function buildCapitalTiers(tvl: number, chain: ChainProfile, catKey: string): CapitalTier[] {
  const isHighGas = chain.txGasUsd >= 1.5;
  const starterMin = isHighGas ? 500 : 100;
  const starterMax = isHighGas ? 2500 : 1000;
  const activeMin = isHighGas ? 2500 : 1000;
  const activeMax = tvl >= 250_000_000 ? 25000 : 15000;
  const whaleMin = activeMax;
  const whaleMax = tvl >= 500_000_000 ? 250000 : 100000;

  const isVolumeCat = catKey === "derivatives" || catKey === "dex" || catKey === "bridge" || catKey === "prediction";

  return [
    {
      tier: "starter",
      label: "Starter / Eligibility",
      minUsd: starterMin,
      maxUsd: starterMax,
      strategy: isVolumeCat
        ? `Prioritize weekly active-streak count, feature breadth, and low-slippage volume on ${chain.name} while keeping fees under 2% of principal.`
        : `Focus on minimum threshold TVL duration (45+ days) on ${chain.name} and zero-cost governance/quest multipliers.`,
      estimatedYieldNote: isHighGas
        ? "Batch transactions on weekends; gas drag is material below $500."
        : "Targets baseline eligibility tier with minimal fee overhead.",
    },
    {
      tier: "active",
      label: "Active / Top-Decile",
      minUsd: activeMin,
      maxUsd: activeMax,
      strategy: isVolumeCat
        ? `Combine steady weekly volume with a 30% passive LP/vault anchor on ${chain.name} to qualify for both volume and TVL buckets.`
        : `Split capital across flagship deposit + 1 partner DeFi multiplier (LP or safe correlated borrow) to target top-10% leaderboard rank.`,
      estimatedYieldNote: "Optimal risk-adjusted EV sweet spot for most pre-TGE drops.",
    },
    {
      tier: "whale",
      label: "Whale / Size-Weighted",
      minUsd: whaleMin,
      maxUsd: whaleMax,
      strategy: tvl >= 250_000_000
        ? `Scale into audited blue-chip pools or vaults to capture linear TVL-weighted points while hedging directional asset exposure.`
        : `Cap allocation below 1% of protocol TVL to manage smart-contract concentration while securing top-1% points rank.`,
      estimatedYieldNote: "Watch for linear vs tiered airdrop caps; avoid over-concentrating past diminishing-return tiers.",
    },
  ];
}

function buildCatalystTags(input: FarmProtocolInput, chain: ChainProfile, catKey: string): string[] {
  const tags: string[] = [];
  const tvl = Number(input.tvl ?? 0);
  const fdv = Number(input.impliedFdv ?? input.impliedValue ?? 0);
  const change7d = typeof input.change_7d === "number" ? input.change_7d : null;
  const change1m = typeof input.change_1m === "number" ? input.change_1m : null;
  const desc = (input.description ?? "").toLowerCase();
  const chainCount = (input.chains ?? []).length;

  if (input.isWatchlist) tags.push("Watchlist Priority");
  if (fdv >= 1_000_000_000) tags.push("Unicorn FDV Potential");
  else if (fdv >= 250_000_000) tags.push("Mid-Cap TGE Target");
  if (tvl >= 500_000_000) tags.push("Deep TVL Moat");
  else if (tvl > 0 && tvl < 50_000_000) tags.push("Early-Stage Low Dilution");
  if (change7d !== null && change7d >= 15) tags.push("TVL Breakout (+7d)");
  else if (change1m !== null && change1m >= 35) tags.push("30d Inflow Surge");
  if ((input.fundingUsd ?? 0) >= 15_000_000) tags.push("VC-Backed");
  if (chainCount >= 4) tags.push("Multi-Chain Scale");
  if (chain.txGasUsd <= 0.1) tags.push("Low-Gas Friendly");
  if (/point|season|xp|reward|epoch|airdrop/.test(desc)) tags.push("Points Meta Signal");
  if (catKey === "derivatives") tags.push("Perp Volume Meta");
  if (catKey === "restaking") tags.push("Restaking Composability");
  if (catKey === "rwa") tags.push("RWA Institutional Yield");
  if (tags.length === 0) tags.push("Pre-TGE Organic Usage");

  return tags.slice(0, 5);
}

function buildDynamicRisks(input: FarmProtocolInput, chain: ChainProfile, baseRisks: RiskNote[]): RiskNote[] {
  const risks: RiskNote[] = [...baseRisks];
  const tvl = Number(input.tvl ?? 0);
  const change1m = typeof input.change_1m === "number" ? input.change_1m : null;

  if (tvl > 0 && tvl < 15_000_000) {
    risks.push({
      level: "high",
      category: "Early TVL & Audit Maturity",
      summary: `Sub-$15M TVL signals earlier battle-testing; size positions conservatively and verify active audits.`,
    });
  } else if (tvl >= 1_000_000_000) {
    risks.push({
      level: "medium",
      category: "Whale Dilution",
      summary: `Billion-dollar TVL means linear point allocations favor larger wallets; combine duration with activity multipliers.`,
    });
  }

  if (chain.txGasUsd >= 1.5) {
    risks.push({
      level: "medium",
      category: "Gas Fee Drag",
      summary: `Operating on ${chain.name} incurs higher gas per tx (~$${chain.txGasUsd.toFixed(2)}); avoid micro-deposits or frequent compounding.`,
    });
  }

  if (change1m !== null && change1m <= -25) {
    risks.push({
      level: "medium",
      category: "TVL Outflow Momentum",
      summary: `30-day TVL declined ${Math.abs(change1m).toFixed(1)}%; check whether incentives rotated or an unlock/migration is underway.`,
    });
  }

  return risks.slice(0, 4);
}

function inferTimeHorizon(tvl: number, fdv: number, launchWindow?: string): string {
  if (launchWindow && launchWindow.trim()) return launchWindow.trim();
  if (tvl >= 500_000_000 || fdv >= 1_000_000_000) return "1-4 months (Near-Term TGE Candidate)";
  if (tvl >= 75_000_000 || fdv >= 200_000_000) return "2-6 months (Mid-Term TGE Window)";
  return "3-9 months (Early Positioning Horizon)";
}

export function buildFarmPlan(input: FarmProtocolInput): FarmPlan {
  const name = input.name?.trim() || "Protocol";
  const recommendedChain = selectBestChain(input.chains, input.chain);
  const chainProfile = getChainProfile(recommendedChain);
  const catKey = normalizeCategoryKey(input.category, input.description);
  const playbook = PLAYBOOKS[catKey] ?? PLAYBOOKS.general;

  const tvl = Number(input.tvl ?? 0);
  const fdv = Number(input.impliedFdv ?? input.impliedValue ?? 0);
  const steps = playbook.steps({
    name,
    chain: chainProfile.name,
    gas: Number(chainProfile.txGasUsd.toFixed(2)),
    bridge: chainProfile.bridgeHint,
  });

  const estimatedSetupCostUsd = Number(
    steps.reduce((acc, s) => acc + s.estimatedGasUsd, 0).toFixed(2)
  );
  const capitalTiers = buildCapitalTiers(tvl, chainProfile, catKey);
  const catalystTags = buildCatalystTags(input, chainProfile, catKey);
  const riskNotes = buildDynamicRisks(input, chainProfile, playbook.risks);
  const timeHorizon = inferTimeHorizon(tvl, fdv, input.launchWindow);

  const summary =
    `Farm ${name} on ${chainProfile.name} using a ${playbook.title.toLowerCase()} approach: ` +
    `prioritize ${steps[1]?.action.toLowerCase() ?? "core on-chain usage"} with ` +
    `~$${estimatedSetupCostUsd.toFixed(2)} est. cycle gas and ${timeHorizon.toLowerCase()}.`;

  return {
    strategyTitle: playbook.title,
    difficulty: playbook.difficulty,
    timeHorizon,
    recommendedChain: chainProfile.name,
    sybilDefenseNote: playbook.sybilNote,
    estimatedSetupCostUsd,
    steps,
    capitalTiers,
    catalystTags,
    riskNotes,
    summary,
  };
}

export const generateFarmPlan = buildFarmPlan;

export function formatFarmPlanMarkdown(plan: FarmPlan, protocolName: string): string {
  const stepLines = plan.steps.map(
    (s) => `${s.order}. **${s.action}** (${s.priority}, ${s.cadence}) — ${s.detail} Target: ${s.targetMetric}.`
  );
  const riskLines = plan.riskNotes.map(
    (r) => `- [${r.level.toUpperCase()}] **${r.category}**: ${r.summary}`
  );
  return [
    `### ${protocolName} — ${plan.strategyTitle}`,
    `Chain: **${plan.recommendedChain}** | Difficulty: **${plan.difficulty}** | Horizon: **${plan.timeHorizon}**`,
    `Catalysts: ${plan.catalystTags.join(", ")}`,
    "",
    ...stepLines,
    "",
    `Sybil Hygiene: ${plan.sybilDefenseNote}`,
    "",
    ...riskLines,
  ].join("\n");
}