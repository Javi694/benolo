import type { TranslationStrings } from "@/data/content";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  access_token: string;
  leagues: string[];
  totalStaked: number;
  totalEarnings: number;
  activeBets: number;
  role?: string;
}

export interface LeagueSummary {
  id: string;
  name: string;
  entryFee?: number;
  participants?: number;
  maxParticipants?: number | null;
  endDate?: string;
  strategy?: string | null;
  strategyId?: string | null;
  commissionBps?: number | null;
  vaultAddress?: string | null;
  featured?: boolean;
  description?: string | null;
  code?: string;
  championship?: string | null;
  currency?: string;
  status?: string;
  rewardDistribution?: string;
  canLeave?: boolean;
  creatorId?: string;
  isPublic?: boolean;
  isPaid?: boolean;
  createdAt?: string;
  signupDeadline?: string | null;
  durationType?: string | null;
  durationValue?: number | null;
  startCondition?: string | null;
  startAt?: string | null;
  startMinParticipants?: number | null;
  startedAt?: string | null;
  investmentProtocol?: string | null;
  investmentApyRange?: string | null;
  investmentRiskLevel?: string | null;
  earlyExitPenaltyRate?: number | null;
  rewardDistributionCustom?: Record<string, unknown> | null;
  hasStarted?: boolean;
  [key: string]: unknown;
}

export interface CreatedLeagueSummary extends LeagueSummary {
  code: string;
}

export interface LeagueMatch {
  id: string;
  leagueId: string;
  externalRef?: string | null;
  homeTeam: string;
  awayTeam: string;
  startAt: string;
  status: "upcoming" | "live" | "completed";
  homeScore?: number | null;
  awayScore?: number | null;
  metadata?: Record<string, unknown> | null;
  // Raw fields from Supabase rows (snake_case) for convenience when mapping
  home_team?: string;
  away_team?: string;
  start_at?: string;
  status_raw?: string;
}

export interface LeaguePrediction {
  id: number;
  matchId: string;
  leagueId: string;
  userId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  confident?: boolean;
  points?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViewHandlers {
  onCreateLeague: () => void;
  onJoinLeague: () => void;
  onViewLeague: (league: LeagueSummary) => void;
  onViewWallet: () => void;
  onViewBetting: (league?: LeagueSummary | string | null) => void;
}

export interface TranslationAwareProps {
  translations: TranslationStrings;
  language: string;
}
