export type FarmCategoryKey =
  | "perps"
  | "lending"
  | "dex"
  | "restaking"
  | "bridge"
  | "yield"
  | "consumer"
  | "general";

export type RiskSeverity = "high" | "medium" | "low";
export type RiskLevel = "Low" | "Moderate" | "Elevated" | "High";
export type EfficiencyGrade = "S" | "A" | "B" | "C" | "D";
export type StepPriority = "core" | "multiplier" | "sybil-hygiene";

export interface FarmStep {
  step: number;
  title: string;
  action: string;
  cadence: string;
  estimatedCostUsd: number;
  priority: StepPriority;
}

export interface RiskFlag {
  code: string;
  severity: RiskSeverity;
  label: string;
  detail: string;
}

export interface CapitalEfficiency {
  score: number;
  grade: EfficiencyGrade;
  impliedAirdropYieldPct: number;
  minRecommendedCapitalUsd: number;
  capitalLockup: string;
  effortLevel: "Low" | "Medium" | "High";
  summary: string;
}

export interface FarmPlan {
  categoryKey: FarmCategoryKey;
  primaryChain: string;
  strategyHeadline: string;
  estimatedMonthlyGasUsd: number;
  targetEpochs: string;
  steps: FarmStep[];
  capitalEfficiency: CapitalEfficiency;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
  sybilChecklist: string[];
}

export interface FarmPlanInput {
  name: string;
  slug?: string;
  category?: string;
  chains?: string[];
  chain?: string;
  tvl?: number;
  tvlChange7d?: number;
  change_7d?: number;
  tvlChange30d?: number;
  change_1m?: number;
  fees30d?: number;
  revenue30d?: number;
  volume30d?: number;
  impliedFdv?: number;
  impliedValue?: number;
  estimatedFdv?: number;
  airdropPct?: number;
  audits?: number | string;
  ageDays?: number;
  pointsProgram?: boolean;
  fundingUsd?: number;
}

const CHAIN_TX_COST_USD: Record<string, number> = {
  ethereum: 4.5,
  bitcoin: 3.0,
  arbitrum: 0.08,
  optimism: 0.06,
  base: 0.04,
  polygon: 0.03,
  solana: 0.01,
  sui: 0.01,
  aptos: 0.01,
  avalanche: 0.12,
  bsc: 0.1,
  hyperliquid: 0.01,
  blast: 0.05,
  scroll: 0.12,
  linea: 0.12,
  zksync: 0.09,
  starknet: 0.07,
  berachain: 0.05,
  monad: 0.02,
  sonic: 0.02,
  mantle: 0.04,
  sei: 0.02,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

export function normalizeFarmCategory(category?: string): FarmCategoryKey {
  const c = (category ?? "").toLowerCase();
  if (/perp|deriv|option|future|synth/.test(c)) return "perps";
  if (/lend|cdp|borrow|credit|money/.test(c)) return "lending";
  if (/dex|amm|swap|aggregat|liquidity|orderbook/.test(c)) return "dex";
  if (/restak|liquid stak|staking|lrt|lst/.test(c)) return "restaking";
  if (/bridge|cross|chain|rollup|l2|interop/.test(c)) return "bridge";
  if (/yield|farm|vault|rwa|basis|structured/.test(c)) return "yield";
  if (/predict|nft|game|social|sofi|launch|pay|oracle|mev|wallet/.test(c)) {
    return "consumer";
  }
  return "general";
}

export function resolvePrimaryChain(input: FarmPlanInput): string {
  if (input.chain && input.chain.trim().length > 0 && input.chain !== "Multi-Chain") {
    return input.chain.trim();
  }
  if (input.chains && input.chains.length > 0) {
    const sorted = [...input.chains].filter(Boolean);
    const preferred = sorted.find((ch) => ch.toLowerCase() !== "ethereum");
    return preferred ?? sorted[0] ?? "Ethereum";
  }
  return "Ethereum";
}

export function estimateChainTxGasUsd(chain: string): number {
  const key = chain.toLowerCase().replace(/\s+/g, "");
  for (const [k, cost] of Object.entries(CHAIN_TX_COST_USD)) {
    if (key.includes(k)) return cost;
  }
  return 0.25;
}

interface StepBlueprint {
  title: string;
  action: (name: string, chain: string, minCap: string) => string;
  cadence: string;
  txMultiplier: number;
  priority: StepPriority;
}

const CATEGORY_PLAYBOOKS: Record<
  FarmCategoryKey,
  {
    headline: string;
    lockup: string;
    effort: "Low" | "Medium" | "High";
    velocityBonus: number;
    steps: StepBlueprint[];
  }
> = {
  perps: {
    headline: "Volume, open-interest persistence, and vault LP farming",
    lockup: "None (liquid)",
    effort: "High",
    velocityBonus: 22,
    steps: [
      {
        title: "Fund margin account",
        action: (n, c, cap) =>
          `Deposit ${cap}+ USDC or native collateral into ${n} on ${c} from an aged wallet.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Build organic maker/taker volume",
        action: (n) =>
          `Trade liquid majors on ${n} using limit orders to minimize fees; hold positions >15 minutes to pass wash-trade filters.`,
        cadence: "2-3x weekly",
        txMultiplier: 8,
        priority: "core",
      },
      {
        title: "Maintain open interest across epochs",
        action: (n) =>
          `Keep a hedged delta-neutral or modest directional position open on ${n} across weekly funding snapshots.`,
        cadence: "Weekly",
        txMultiplier: 4,
        priority: "multiplier",
      },
      {
        title: "Allocate to protocol liquidity vault",
        action: (n) =>
          `If ${n} runs a house LP/HLP vault, park 25-40% of farming capital there to earn passive points and fee share.`,
        cadence: "Bi-weekly review",
        txMultiplier: 2,
        priority: "multiplier",
      },
    ],
  },
  lending: {
    headline: "Collateral supply, safe borrow loops, and snapshot retention",
    lockup: "Short (1-7d)",
    effort: "Low",
    velocityBonus: 10,
    steps: [
      {
        title: "Supply flagship collateral",
        action: (n, c, cap) =>
          `Deposit ${cap}+ in blue-chip assets (ETH, WBTC, or USDC) into core ${n} markets on ${c}.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Activate conservative borrow multiplier",
        action: (n) =>
          `Borrow correlated or stable assets on ${n} below 55% LTV; keep health factor >1.6 to prevent liquidation cascades.`,
        cadence: "Weekly monitor",
        txMultiplier: 2,
        priority: "multiplier",
      },
      {
        title: "Diversify across isolated vaults",
        action: (n) =>
          `Split a portion of deposits across curated or points-boosted ${n} markets rather than a single pool.`,
        cadence: "Bi-weekly",
        txMultiplier: 2,
        priority: "multiplier",
      },
      {
        title: "Log recurring repayments",
        action: (n) =>
          `Repay or rebalance small amounts on ${n} across distinct months to record sustained borrower tenure.`,
        cadence: "Monthly",
        txMultiplier: 2,
        priority: "sybil-hygiene",
      },
    ],
  },
  dex: {
    headline: "Correlated LP depth, recurring routing volume, and order variety",
    lockup: "None (liquid)",
    effort: "Medium",
    velocityBonus: 16,
    steps: [
      {
        title: "Provide low-IL liquidity",
        action: (n, c, cap) =>
          `Add ${cap}+ to a correlated stable or LST/ETH pool on ${n} (${c}) with active fee APR.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Execute recurring organic swaps",
        action: (n) =>
          `Route weekly swaps across at least 3 token pairs on ${n}, varying trade sizes rather than identical round numbers.`,
        cadence: "Weekly",
        txMultiplier: 6,
        priority: "core",
      },
      {
        title: "Use advanced order types",
        action: (n) =>
          `Place limit orders, TWAPs, or cross-chain swaps if supported by ${n} to qualify for power-user tiers.`,
        cadence: "Bi-weekly",
        txMultiplier: 3,
        priority: "multiplier",
      },
      {
        title: "Hold LP through snapshot windows",
        action: (n) =>
          `Avoid rapid deposit-withdraw cycling; keep ${n} LP positions live for at least 30 continuous days.`,
        cadence: "Continuous",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
    ],
  },
  restaking: {
    headline: "Receipt token minting and stacked DeFi points composability",
    lockup: "Long (7-30d queue)",
    effort: "Low",
    velocityBonus: 12,
    steps: [
      {
        title: "Mint or stake native receipt token",
        action: (n, c, cap) =>
          `Stake ${cap}+ via ${n} on ${c} directly (minting on-protocol often earns higher credit than DEX buys).`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Stack yield in integrated DeFi",
        action: (n) =>
          `Deploy the ${n} receipt token into whitelisted Pendle LP/YT pools or lending markets for 2x-5x points stacking.`,
        cadence: "Bi-weekly review",
        txMultiplier: 3,
        priority: "multiplier",
      },
      {
        title: "Verify delegation and exit liquidity",
        action: (n) =>
          `Delegate to active, non-saturated operators on ${n} and monitor secondary-market peg discount before sizing up.`,
        cadence: "Monthly",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
      {
        title: "Claim or compound epoch rewards",
        action: (n) =>
          `Check ${n} points dashboard weekly and sign referral/epoch attestations when required.`,
        cadence: "Weekly",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
    ],
  },
  bridge: {
    headline: "Multi-route volume, destination activity, and active-month streaks",
    lockup: "None (liquid)",
    effort: "Medium",
    velocityBonus: 20,
    steps: [
      {
        title: "Bridge meaningful initial capital",
        action: (n, c, cap) =>
          `Bridge ${cap}+ into or via ${n} using ${c} as a primary leg; avoid dust transfers under $100.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Diversify source and destination routes",
        action: (n) =>
          `Complete transfers across at least 3 distinct chain pairs on ${n} over separate weeks to prove organic usage.`,
        cadence: "Weekly",
        txMultiplier: 5,
        priority: "core",
      },
      {
        title: "Interact on destination apps",
        action: (n) =>
          `Leave a residual balance on the destination chain after using ${n} and execute 2-3 native swaps or deposits.`,
        cadence: "Bi-weekly",
        txMultiplier: 4,
        priority: "multiplier",
      },
      {
        title: "Maintain multi-month cadence",
        action: (n) =>
          `Space ${n} bridge transactions across 3+ consecutive calendar months to clear duration-based anti-sybil filters.`,
        cadence: "Monthly",
        txMultiplier: 2,
        priority: "sybil-hygiene",
      },
    ],
  },
  yield: {
    headline: "Vault TVL duration, points-boosted tranches, and fee alignment",
    lockup: "Medium (7-30d)",
    effort: "Low",
    velocityBonus: 11,
    steps: [
      {
        title: "Enter flagship vault",
        action: (n, c, cap) =>
          `Deposit ${cap}+ into ${n}'s highest-liquidity audited vault on ${c} to minimize smart-contract surface.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Evaluate points vs fixed-yield split",
        action: (n) =>
          `Compare base APY against points multiplier on ${n}; allocate 70% to principal-safe vaults and 30% to boosted tranches.`,
        cadence: "Bi-weekly review",
        txMultiplier: 2,
        priority: "multiplier",
      },
      {
        title: "Reinvest accrued yield",
        action: (n) =>
          `Harvest or roll maturing positions on ${n} to maintain continuous TVL-weighted points accrual.`,
        cadence: "Monthly",
        txMultiplier: 2,
        priority: "multiplier",
      },
      {
        title: "Track strategy counterparty exposure",
        action: (n) =>
          `Review ${n} underlying collateral allocations monthly and cap exposure to single-custodian yield sources.`,
        cadence: "Monthly",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
    ],
  },
  consumer: {
    headline: "Consistent active epochs, maker liquidity, and identity hygiene",
    lockup: "None (liquid)",
    effort: "Medium",
    velocityBonus: 18,
    steps: [
      {
        title: "Complete verified onboarding",
        action: (n, c, cap) =>
          `Fund ${n} on ${c} with ${cap}+ and link standard profile handles if the protocol rewards verified identity.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Build steady weekly participation",
        action: (n) =>
          `Log active positions, orders, or predictions on ${n} across distinct markets each week rather than single-day bursts.`,
        cadence: "Weekly",
        txMultiplier: 6,
        priority: "core",
      },
      {
        title: "Earn maker or liquidity rewards",
        action: (n) =>
          `Post resting limit orders or liquidity quotes on ${n} where spread incentives or reward pools exist.`,
        cadence: "Bi-weekly",
        txMultiplier: 4,
        priority: "multiplier",
      },
      {
        title: "Avoid sybil clustering patterns",
        action: (n) =>
          `Never fund multiple ${n} wallets from the same on-chain source; preserve organic profit/loss variance.`,
        cadence: "Continuous",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
    ],
  },
  general: {
    headline: "Core vault deposit, multi-epoch usage, and governance readiness",
    lockup: "Short (1-7d)",
    effort: "Low",
    velocityBonus: 10,
    steps: [
      {
        title: "Establish core protocol position",
        action: (n, c, cap) =>
          `Deploy ${cap}+ into ${n}'s flagship product on ${c} using a wallet with prior mainnet history.`,
        cadence: "One-time setup",
        txMultiplier: 2,
        priority: "core",
      },
      {
        title: "Use secondary protocol modules",
        action: (n) =>
          `Interact with at least two distinct smart contracts or features on ${n} to broaden user-tier eligibility.`,
        cadence: "Bi-weekly",
        txMultiplier: 3,
        priority: "multiplier",
      },
      {
        title: "Sustain weekly on-chain cadence",
        action: (n) =>
          `Execute at least one meaningful rebalance, claim, or deposit on ${n} every 2 weeks across 3+ months.`,
        cadence: "Bi-weekly",
        txMultiplier: 3,
        priority: "core",
      },
      {
        title: "Monitor snapshot announcements",
        action: (n) =>
          `Track ${n} governance proposals, Discord announcements, and points season cutoffs before withdrawing liquidity.`,
        cadence: "Weekly",
        txMultiplier: 1,
        priority: "sybil-hygiene",
      },
    ],
  },
};

export function assessRiskFlags(
  input: FarmPlanInput,
  categoryKey: FarmCategoryKey,
  txGasUsd: number,
): { riskFlags: RiskFlag[]; riskScore: number; riskLevel: RiskLevel } {
  const flags: RiskFlag[] = [];
  const tvl = input.tvl ?? 0;
  const ch7 = input.tvlChange7d ?? input.change_7d ?? 0;
  const ch30 = input.tvlChange30d ?? input.change_1m ?? 0;
  const auditsNum =
    typeof input.audits === "number"
      ? input.audits
      : typeof input.audits === "string"
        ? Number.parseInt(input.audits, 10) || 0
        : 0;

  if (auditsNum <= 0) {
    flags.push({
      code: "UNAUDITED_OR_UNLISTED",
      severity: "high",
      label: "Audit unverified",
      detail: "DefiLlama snapshot lists 0 audits; cap capital to risk-tolerant allocation.",
    });
  }

  if (tvl < 10_000_000) {
    flags.push({
      code: "LOW_TVL_DEPTH",
      severity: tvl < 2_500_000 ? "high" : "medium",
      label: "Thin TVL depth",
      detail: `Protocol TVL is ${fmtUsd(tvl)}; higher smart-contract and exit liquidity risk.`,
    });
  } else if (tvl > 2_000_000_000) {
    flags.push({
      code: "WHALE_DILUTION",
      severity: "medium",
      label: "Heavy TVL saturation",
      detail: `${fmtUsd(tvl)} TVL means smaller wallets face severe points dilution unless tiered.`,
    });
  }

  if (ch7 <= -20 || ch30 <= -35) {
    flags.push({
      code: "SHARP_TVL_OUTFLOW",
      severity: "high",
      label: "TVL drawdown",
      detail: `Recent TVL contraction (7d: ${ch7.toFixed(1)}%, 30d: ${ch30.toFixed(1)}%) signals fading momentum.`,
    });
  }

  if (categoryKey === "restaking" || categoryKey === "yield") {
    flags.push({
      code: "EXIT_QUEUE_RISK",
      severity: "medium",
      label: "Redemption / depeg risk",
      detail: "Withdrawal queues or vault lockups can trap capital during volatility.",
    });
  }

  if (txGasUsd >= 3.0) {
    flags.push({
      code: "HIGH_GAS_DRAG",
      severity: "medium",
      label: "High L1 gas cost",
      detail: `Estimated ~${fmtUsd(txGasUsd)} per tx on primary chain; small farms lose EV to fees.`,
    });
  }

  if ((input.fees30d ?? 0) <= 0 && (input.revenue30d ?? 0) <= 0 && tvl > 25_000_000) {
    flags.push({
      code: "UNPROVEN_MONETIZATION",
      severity: "low",
      label: "No tracked fee revenue",
      detail: "No 30d fee stream recorded in snapshot; FDV hinges largely on TVL narrative.",
    });
  }

  if (input.ageDays !== undefined && input.ageDays < 90) {
    flags.push({
      code: "EARLY_STAGE_CODE",
      severity: "medium",
      label: "Young protocol (<90d)",
      detail: `Only ${Math.round(input.ageDays)} days tracked; battle-testing is still limited.`,
    });
  }

  if (flags.length === 0) {
    flags.push({
      code: "STANDARD_DEFI_RISK",
      severity: "low",
      label: "Standard smart-contract risk",
      detail: "Audited with resilient TVL; observe normal wallet hygiene and diversification.",
    });
  }

  let score = 15;
  for (const f of flags) {
    if (f.severity === "high") score += 26;
    else if (f.severity === "medium") score += 14;
    else score += 5;
  }
  score = clamp(score, 10, 95);

  const riskLevel: RiskLevel =
    score >= 70 ? "High" : score >= 50 ? "Elevated" : score >= 30 ? "Moderate" : "Low";

  return { riskFlags: flags, riskScore: score, riskLevel };
}

export function computeCapitalEfficiency(
  input: FarmPlanInput,
  categoryKey: FarmCategoryKey,
  monthlyGasUsd: number,
): CapitalEfficiency {
  const playbook = CATEGORY_PLAYBOOKS[categoryKey];
  const tvl = Math.max(input.tvl ?? 1_000_000, 1_000_000);
  const fdv = input.impliedFdv ?? input.impliedValue ?? input.estimatedFdv ?? tvl * 0.4;
  const airdropShare = clamp(input.airdropPct ?? 0.08, 0.02, 0.2);
  const airdropPool = fdv * airdropShare;

  const rawYieldPct = (airdropPool / tvl) * 100;
  const impliedAirdropYieldPct = round2(clamp(rawYieldPct, 0.25, 180));

  const minRecommendedCapitalUsd =
    monthlyGasUsd >= 25
      ? 5000
      : monthlyGasUsd >= 8
        ? 2000
        : categoryKey === "perps" || categoryKey === "bridge" || categoryKey === "consumer"
          ? 500
          : 1000;

  const yieldScore = clamp(Math.log10(impliedAirdropYieldPct + 1) * 34, 5, 65);
  const gasPenalty = clamp((monthlyGasUsd / Math.max(minRecommendedCapitalUsd, 500)) * 320, 0, 22);
  const pointsBonus = input.pointsProgram ? 6 : 0;
  const score = Math.round(clamp(yieldScore + playbook.velocityBonus + pointsBonus - gasPenalty, 12, 98));

  const grade: EfficiencyGrade =
    score >= 82 ? "S" : score >= 68 ? "A" : score >= 52 ? "B" : score >= 36 ? "C" : "D";

  const summary =
    grade === "S" || grade === "A"
      ? `High EV per dollar (~${impliedAirdropYieldPct}% implied pool/TVL ratio) with ${playbook.lockup.toLowerCase()} lockup.`
      : grade === "B"
        ? `Balanced risk/reward (~${impliedAirdropYieldPct}% pool/TVL) best suited for ${fmtUsd(minRecommendedCapitalUsd)}+ allocations.`
        : `Capital-heavy or saturated farm (~${impliedAirdropYieldPct}% pool/TVL); prioritize only for passive yield stacking.`;

  return {
    score,
    grade,
    impliedAirdropYieldPct,
    minRecommendedCapitalUsd,
    capitalLockup: playbook.lockup,
    effortLevel: playbook.effort,
    summary,
  };
}

export function buildFarmPlan(input: FarmPlanInput): FarmPlan {
  const categoryKey = normalizeFarmCategory(input.category);
  const primaryChain = resolvePrimaryChain(input);
  const txGasUsd = estimateChainTxGasUsd(primaryChain);
  const playbook = CATEGORY_PLAYBOOKS[categoryKey];

  const totalMonthlyTx = playbook.steps.reduce((acc, s) => acc + s.txMultiplier, 0);
  const estimatedMonthlyGasUsd = round2(totalMonthlyTx * txGasUsd);

  const capitalEfficiency = computeCapitalEfficiency(input, categoryKey, estimatedMonthlyGasUsd);
  const { riskFlags, riskScore, riskLevel } = assessRiskFlags(input, categoryKey, txGasUsd);
  const minCapLabel = fmtUsd(capitalEfficiency.minRecommendedCapitalUsd);

  const steps: FarmStep[] = playbook.steps.map((bp, idx) => ({
    step: idx + 1,
    title: bp.title,
    action: bp.action(input.name, primaryChain, minCapLabel),
    cadence: bp.cadence,
    estimatedCostUsd: round2(bp.txMultiplier * txGasUsd),
    priority: bp.priority,
  }));

  const targetEpochs =
    categoryKey === "bridge" || categoryKey === "consumer"
      ? "8-12 active weeks across 3+ months"
      : categoryKey === "perps" || categoryKey === "dex"
        ? "6-10 weekly epochs with sustained volume"
        : "30-90 days continuous TVL duration";

  const sybilChecklist = [
    `Fund wallet independently on ${primaryChain} with prior on-chain history (>30 days aged).`,
    "Avoid identical round-number deposits or synchronized timestamps across wallets.",
    "Keep non-dust native gas balance and maintain activity across distinct calendar months.",
  ];

  return {
    categoryKey,
    primaryChain,
    strategyHeadline: playbook.headline,
    estimatedMonthlyGasUsd,
    targetEpochs,
    steps,
    capitalEfficiency,
    riskScore,
    riskLevel,
    riskFlags,
    sybilChecklist,
  };
}

export const generateFarmPlan = buildFarmPlan;
export const createFarmPlan = buildFarmPlan;