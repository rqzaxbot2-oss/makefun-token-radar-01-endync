export type FilterStatus = "eligible" | "excluded" | "watchlist_forced";

export type ExclusionCode =
  | "HAS_GECKO_ID"
  | "HAS_CMC_ID"
  | "HAS_MCAP"
  | "HAS_FDV"
  | "HAS_VALID_SYMBOL"
  | "HAS_TOKEN_ADDRESS"
  | "WRAPPED_OR_STAKED_PRODUCT"
  | "PARENT_HAS_TOKEN"
  | "CEX_OR_NON_PROTOCOL"
  | "ZERO_OR_DUST_TVL"
  | "DUPLICATE_SLUG"
  | "STABLECOIN_WRAPPER"
  | "SYNTHETIC_DERIVATIVE";

export type ConfidenceTier = "high" | "medium" | "low";

export type LaunchReadinessTier = "imminent" | "high" | "moderate" | "early";

export type FarmDifficulty = "beginner" | "intermediate" | "advanced";

export type RiskLevel = "low" | "medium" | "high";

export type CapitalTier = "under_1k" | "1k_to_10k" | "10k_to_100k" | "100k_plus";

export type ValuationMethod =
  | "tvl_multiple"
  | "fees_multiple"
  | "revenue_multiple"
  | "volume_multiple"
  | "raise_anchor"
  | "growth_momentum";

export type FarmRiskType =
  | "smart_contract"
  | "impermanent_loss"
  | "liquidation"
  | "bridge"
  | "sybil"
  | "lockup"
  | "oracle"
  | "regulatory";

export interface RaiseRecord {
  date?: number | string | null;
  name?: string;
  round?: string | null;
  amount?: number | null;
  chains?: string[];
  sector?: string | null;
  category?: string | null;
  valuation?: number | null;
  leadInvestors?: string[];
  otherInvestors?: string[];
}

export interface RawProtocol {
  id?: string;
  name: string;
  slug: string;
  symbol?: string | null;
  address?: string | null;
  url?: string | null;
  description?: string | null;
  chain?: string | null;
  chains?: string[];
  logo?: string | null;
  audits?: string | number | null;
  audit_note?: string | null;
  gecko_id?: string | null;
  cmcId?: string | number | null;
  category?: string | null;
  tvl?: number | null;
  chainTvls?: Record<string, number>;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  mcap?: number | null;
  fdv?: number | null;
  parentProtocol?: string | null;
  parentProtocolSlug?: string | null;
  forkedFrom?: string[];
  twitter?: string | null;
  github?: string[];
  oracles?: string[];
  listedAt?: number | null;
  raises?: RaiseRecord[];
  fees24h?: number | null;
  fees7d?: number | null;
  fees30d?: number | null;
  feesAnnualized?: number | null;
  revenue24h?: number | null;
  revenue7d?: number | null;
  revenue30d?: number | null;
  revenueAnnualized?: number | null;
  volume24h?: number | null;
  volume7d?: number | null;
  volume30d?: number | null;
  holdersRevenue30d?: number | null;
  treasury?: number | null;
  staking?: number | null;
  borrowed?: number | null;
  pool2?: number | null;
  isWatchlist?: boolean;
  watchlistNote?: string | null;
  pointsProgram?: boolean;
  airdropHints?: string[];
}

export interface WatchlistEntry {
  slug: string;
  name?: string;
  category?: string;
  note?: string;
  priority?: number;
}

export interface SnapshotMetadata {
  snapshotDate: string;
  source?: string;
  protocolCount?: number;
  version?: string;
}

export interface ProtocolSnapshot {
  meta?: SnapshotMetadata;
  protocols: RawProtocol[];
  watchlist?: Array<string | WatchlistEntry>;
  raises?: RaiseRecord[];
}

export interface FilterSignal {
  rule: string;
  triggered: boolean;
  evidence: string;
  weight?: number;
}

export interface FilterAuditEntry {
  slug: string;
  name: string;
  category: string;
  tvl: number;
  status: FilterStatus;
  exclusionCodes: ExclusionCode[];
  reasons: string[];
  signals: FilterSignal[];
  isWatchlist: boolean;
  parentSlug: string | null;
  detectedTokenRef: string | null;
}

export interface FilterAuditSummary {
  totalScanned: number;
  totalEligible: number;
  totalExcluded: number;
  watchlistCount: number;
  watchlistCovered: number;
  exclusionCounts: Record<string, number>;
  entries: FilterAuditEntry[];
}

export interface PeerComparable {
  slug: string;
  name: string;
  symbol: string;
  category: string;
  tvl: number;
  fdv: number;
  mcap: number;
  feesAnnualized: number;
  revenueAnnualized: number;
  volumeAnnualized: number;
  fdvToTvl: number;
  fdvToFees: number | null;
  fdvToRevenue: number | null;
}

export interface CategoryBenchmark {
  category: string;
  peerCount: number;
  medianFdvToTvl: number;
  p25FdvToTvl: number;
  p75FdvToTvl: number;
  medianFdvToFees: number | null;
  medianFdvToRevenue: number | null;
  medianFdvToVolume: number | null;
  topPeers: PeerComparable[];
}

export interface ValuationComponent {
  method: ValuationMethod;
  label: string;
  weight: number;
  rawEstimateUsd: number;
  weightedContributionUsd: number;
  multipleUsed: number | null;
  inputMetricUsd: number;
  note: string;
}

export interface ImpliedValuation {
  impliedFdvUsd: number;
  lowFdvUsd: number;
  midFdvUsd: number;
  highFdvUsd: number;
  impliedAirdropPoolPct: number;
  impliedAirdropPoolUsd: number;
  impliedTgeFloatPct: number;
  impliedInitialMcapUsd: number;
  fdvToTvlMultiple: number;
  fdvToFeesMultiple: number | null;
  confidence: ConfidenceTier;
  confidenceScore: number;
  methodologySummary: string;
  components: ValuationComponent[];
  categoryBenchmark: CategoryBenchmark;
  peers: PeerComparable[];
}

export interface ScoreBreakdown {
  totalScore: number;
  valuationScore: number;
  tractionScore: number;
  revenueScore: number;
  momentumScore: number;
  fundingScore: number;
  farmabilityScore: number;
  launchReadinessScore: number;
  launchReadinessTier: LaunchReadinessTier;
  drivers: string[];
}

export interface FarmStep {
  stepNumber: number;
  title: string;
  action: string;
  targetChains: string[];
  estimatedGasUsd: number;
  capitalRequirement: string;
  frequency: string;
  expectedSignal: string;
  verificationTip: string;
}

export interface FarmRiskItem {
  type: FarmRiskType;
  severity: RiskLevel;
  description: string;
  mitigation: string;
}

export interface FarmPlan {
  strategyName: string;
  summary: string;
  difficulty: FarmDifficulty;
  riskLevel: RiskLevel;
  recommendedCapitalTier: CapitalTier;
  minRecommendedCapitalUsd: number;
  estimatedTimeMinutesPerWeek: number;
  lockupDays: number;
  pointsActive: boolean;
  sybilResistanceTips: string[];
  targetChains: string[];
  steps: FarmStep[];
  risks: FarmRiskItem[];
  expectedYieldNote: string;
}

export interface ProtocolBoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string;
  url: string;
  twitter: string | null;
  logo: string | null;
  description: string;
  chains: string[];
  primaryChain: string;
  isWatchlist: boolean;
  tvlUsd: number;
  tvlChange1dPct: number | null;
  tvlChange7dPct: number | null;
  feesAnnualizedUsd: number;
  revenueAnnualizedUsd: number;
  volume30dUsd: number;
  totalRaisedUsd: number;
  leadInvestors: string[];
  auditsCount: number;
  listedAt: number | null;
  impliedFdvUsd: number;
  impliedFdvLowUsd: number;
  impliedFdvHighUsd: number;
  impliedAirdropPoolUsd: number;
  impliedAirdropPoolPct: number;
  confidence: ConfidenceTier;
  launchReadiness: LaunchReadinessTier;
  radarScore: number;
  valuation: ImpliedValuation;
  scoreBreakdown: ScoreBreakdown;
  farmPlan: FarmPlan;
  filterAudit: FilterAuditEntry;
  tags: string[];
}

export interface BoardSummaryStats {
  totalRanked: number;
  watchlistTotal: number;
  watchlistIncluded: number;
  totalImpliedFdvUsd: number;
  medianImpliedFdvUsd: number;
  totalTvlUsd: number;
  totalImpliedAirdropPoolUsd: number;
  topCategory: string;
  categoryCounts: Record<string, number>;
  chainCounts: Record<string, number>;
  readinessCounts: Record<LaunchReadinessTier, number>;
}

export interface BoardOutput {
  schemaVersion: string;
  generatedAt: string;
  snapshotDate: string;
  methodology: string;
  stats: BoardSummaryStats;
  categories: string[];
  chains: string[];
  benchmarks: CategoryBenchmark[];
  filterSummary: Omit<FilterAuditSummary, "entries">;
  rows: ProtocolBoardRow[];
}

export interface DossierArtifact {
  schemaVersion: string;
  generatedAt: string;
  title: string;
  totalProtocolsScanned: number;
  totalEligible: number;
  totalRanked: number;
  watchlistCovered: number;
  topTenSlugs: string[];
  medianImpliedFdvUsd: number;
  totalImpliedFdvUsd: number;
  methodologyHighlights: string[];
  filesGenerated: string[];
}