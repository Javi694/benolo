"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Coins,
  DollarSign,
  Medal,
  Percent,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  Eye,
  Plus,
  Clock,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type {
  DemoUser,
  LeagueSummary,
  TranslationAwareProps,
} from "@/types/app";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { logLeagueTransaction } from "@/lib/supabase/leagues";
import { useLeagueVaultActions } from "@/lib/wagmi/hooks/useLeagueVaultActions";
import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { leagueVaultAbi } from "@/lib/wagmi/abi/leagueVault";
import { hasLeagueStarted } from "@/lib/leagues/start";

interface UserLeague extends LeagueSummary {
  sport: string;
  championship: string;
  participants: number;
  maxParticipants: number | null;
  entryFee: number;
  totalPool: number;
  estimatedRewards: number;
  currentYield: number;
  totalEarnings?: number;
  myRank: number;
  status: "pending" | "active" | "completed";
  endDate: string;
  matchesLeft: number;
  correctPredictions: number;
  totalPredictions: number;
  strategy: string | null;
  myInvestment: number;
  currentValue: number;
  roi: number;
  finalReward?: number;
  bestScore: number;
  hasStarted: boolean;
  vaultAddress?: string | null;
}

interface DashboardProps extends TranslationAwareProps {
  user: DemoUser;
  onViewLeague: (league: LeagueSummary) => void;
  onCreateLeague: () => void;
  onJoinLeague: () => void;
  onViewWallet: () => void;
  onViewBetting: (league?: LeagueSummary | string | null) => void;
}

interface UserStats {
  totalInvested: number;
  currentValue: number;
  totalRewards: number;
  accuracy: number;
  averageRank: number;
  podiumFinishes: number;
  activeLeagues: number;
  completedLeagues: number;
  totalPredictions: number;
  correctPredictions: number;
  averageROI: number;
  totalEarnings: number;
}

interface LeagueRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  entry_fee: number | null;
  currency: string | null;
  status: string | null;
  reward_distribution: string | null;
  reward_distribution_custom: any;
  can_leave: boolean | null;
  strategy: string | null;
  strategy_id: string | null;
  commission_bps: number | null;
  max_members: number | null;
  championship: string | null;
  creator_id: string;
  created_at: string;
  end_at: string | null;
  start_at: string | null;
  is_public: boolean | null;
  is_paid: boolean | null;
  signup_deadline: string | null;
  duration_type: string | null;
  duration_value: number | null;
  investment_protocol: string | null;
  investment_apy_range: string | null;
  investment_risk_level: string | null;
  early_exit_penalty_rate: number | null;
  vault_address: string | null;
  start_condition: string | null;
  start_min_participants: number | null;
  started_at: string | null;
}

const inferSportFromChampionship = (championshipId: string | null): string => {
  if (!championshipId) {
    return "football";
  }

  if (championshipId === "nba") {
    return "basketball";
  }

  if (championshipId === "nfl") {
    return "american-football";
  }

  return "football";
};

const computeStats = (leagues: UserLeague[]): UserStats => {
  const activeLeagues = leagues.filter((league) => league.status === "active");
  const completedLeagues = leagues.filter(
    (league) => league.status === "completed",
  );

  const totalInvested = leagues.reduce(
    (sum, league) => sum + league.myInvestment,
    0,
  );
  const currentValue = activeLeagues.reduce(
    (sum, league) => sum + league.currentValue,
    0,
  );
  const totalRewards = completedLeagues.reduce(
    (sum, league) => sum + (league.finalReward ?? 0),
    0,
  );

  const totalPredictions = leagues.reduce(
    (sum, league) => sum + league.totalPredictions,
    0,
  );
  const correctPredictions = leagues.reduce(
    (sum, league) => sum + league.correctPredictions,
    0,
  );

  const accuracy =
    totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
  const averageRank =
    leagues.length > 0
      ? leagues.reduce((sum, league) => sum + league.myRank, 0) / leagues.length
      : 0;

  const podiumFinishes = leagues.filter((league) => league.myRank <= 3).length;
  const roiLeagues = leagues.filter((league) => league.myInvestment > 0);
  const averageROI =
    roiLeagues.length > 0
      ?
        roiLeagues.reduce((sum, league) => sum + league.roi, 0) /
          roiLeagues.length
      : 0;

  return {
    totalInvested,
    currentValue,
    totalRewards,
    accuracy,
    averageRank,
    podiumFinishes,
    activeLeagues: activeLeagues.length,
    completedLeagues: completedLeagues.length,
    totalPredictions,
    correctPredictions,
    averageROI,
    totalEarnings: currentValue + totalRewards - totalInvested,
  };
};

export function Dashboard({
  user,
  onViewLeague,
  onCreateLeague,
  onJoinLeague,
  onViewWallet,
  onViewBetting,
  translations: t,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [userLeagues, setUserLeagues] = useState<UserLeague[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState<boolean>(Boolean(supabaseBrowserClient));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<Array<{ userId: string; displayName: string | null; points: number }>>([]);

  useEffect(() => {
    const supabase = supabaseBrowserClient;
    if (!supabase) {
      setLoadingLeagues(false);
      setUserLeagues([]);
      return;
    }

    let isMounted = true;

    const computeEndDate = (row: LeagueRow): string => {
      if (row.end_at) {
        return row.end_at;
      }
      const base = row.signup_deadline ?? row.start_at ?? row.created_at;
      if (row.duration_type === "matchdays" && row.duration_value && row.duration_value > 0) {
        const baseDate = new Date(base);
        const approxDays = Math.max(row.duration_value, 1) * 7;
        baseDate.setDate(baseDate.getDate() + approxDays);
        return baseDate.toISOString();
      }
      return row.end_at ?? row.created_at;
    };

    const mapLeagueRowToUserLeague = (
      league: LeagueRow,
      memberCount: number,
      bestScore: number,
    ): UserLeague => {
      const entryFee = Number(league.entry_fee ?? 0);
      const participants = Math.max(memberCount, 1);
      const derivedEndDate = computeEndDate(league);
      const startCondition = league.start_condition ?? "date";
      const startAt = league.start_at ?? null;
      const startMinParticipants = league.start_min_participants != null
        ? Number(league.start_min_participants)
        : null;

      const started = hasLeagueStarted({
        startCondition,
        startMinParticipants,
        startAt,
        signupDeadline: league.signup_deadline,
        participants,
        status: league.status,
      });

      const status = league.status === "completed"
        ? "completed"
        : started
          ? "active"
          : "pending";

      const hasStarted = started;

      return {
        id: league.id,
        name: league.name,
        sport: inferSportFromChampionship(league.championship),
        championship: league.championship ?? "custom",
        createdAt: league.created_at,
        participants,
        maxParticipants: league.max_members ?? null,
        entryFee,
        totalPool: entryFee * participants,
        estimatedRewards: entryFee * 0.1,
        currentYield: 0,
        myRank: bestScore > 0 ? 1 : 99,
        status,
        endDate: derivedEndDate,
        matchesLeft: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        strategy: league.strategy,
        myInvestment: entryFee,
        currentValue: entryFee,
        roi: 0,
        totalEarnings: 0,
        description: league.description ?? "",
        bestScore,
        isPublic: league.is_public ?? true,
        isPaid: league.is_paid ?? false,
        signupDeadline: league.signup_deadline,
        durationType: league.duration_type,
        durationValue: league.duration_value ?? null,
        startCondition,
        startAt,
        startMinParticipants,
        startedAt: league.started_at ?? null,
        hasStarted,
        investmentProtocol: league.investment_protocol,
        investmentApyRange: league.investment_apy_range,
        investmentRiskLevel: league.investment_risk_level,
        earlyExitPenaltyRate: league.early_exit_penalty_rate ?? null,
        rewardDistribution: league.reward_distribution ?? undefined,
        rewardDistributionCustom: league.reward_distribution_custom,
        vaultAddress: league.vault_address ?? null,
      };
    };

    const fetchLeagues = async () => {
      setLoadingLeagues(true);
      setFetchError(null);

      const { data: membershipData, error: membershipError } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);

      if (membershipError) {
        if (!isMounted) {
          return;
        }
        setFetchError(membershipError.message);
        setLoadingLeagues(false);
        return;
      }

      const leagueIds = Array.from(
        new Set((membershipData ?? []).map((item) => item.league_id).filter(Boolean)),
      ) as string[];

      if (leagueIds.length === 0) {
        if (!isMounted) {
          return;
        }
        setUserLeagues([]);
        setLoadingLeagues(false);
        return;
      }

      const { data: leaguesData, error: leaguesError } = await supabase
        .from("leagues")
        .select(
          "id, code, name, description, entry_fee, currency, status, reward_distribution, reward_distribution_custom, can_leave, strategy, strategy_id, commission_bps, max_members, championship, creator_id, created_at, end_at, start_at, is_public, is_paid, signup_deadline, duration_type, duration_value, investment_protocol, investment_apy_range, investment_risk_level, early_exit_penalty_rate, start_condition, start_min_participants, started_at, vault_address",
        )
        .in("id", leagueIds);

      if (leaguesError) {
        if (!isMounted) {
          return;
        }
        setFetchError(leaguesError.message);
        setLoadingLeagues(false);
        return;
      }

      const countsByLeague: Record<string, number> = {};
    const { data: membersData, error: membersError } = await supabase
      .from("league_members")
      .select("league_id")
      .in("league_id", leagueIds);

      if (membersError) {
        if (!isMounted) {
          return;
        }
        setFetchError(membersError.message);
        setLoadingLeagues(false);
        return;
      }

      (membersData ?? []).forEach((row) => {
        const leagueId = row.league_id as string;
        countsByLeague[leagueId] = (countsByLeague[leagueId] ?? 0) + 1;
      });

    if (!isMounted) {
      return;
    }

      const { data: leaderboardRows, error: leaderboardError } = await supabase
        .from("league_leaderboard")
        .select("league_id, user_id, total_points")
        .in("league_id", leagueIds);

      if (leaderboardError) {
        if (!isMounted) {
          return;
        }
        setFetchError(leaderboardError.message);
        setLoadingLeagues(false);
        return;
      }

      const rows = leaderboardRows ?? [];
      const bestScoresByLeague = new Map<string, number>();
      rows.forEach((row: any) => {
        const current = bestScoresByLeague.get(row.league_id) ?? 0;
        const points = Number(row.total_points ?? 0);
        if (points > current) {
          bestScoresByLeague.set(row.league_id, points);
        }
      });

      const userIds = Array.from(new Set(rows.map((row: any) => row.user_id).filter(Boolean)));
      const nameById = new Map<string, string | null>();

      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        (profileRows ?? []).forEach((profile: any) => {
          nameById.set(profile.id as string, profile.display_name ?? null);
        });
      }

      const aggregatedPlayers = new Map<string, { points: number; displayName: string | null }>();
      rows.forEach((row: any) => {
        const existing = aggregatedPlayers.get(row.user_id);
        const points = Number(row.total_points ?? 0);
        const displayName = nameById.get(row.user_id) ?? null;
        if (!existing || points > existing.points) {
          aggregatedPlayers.set(row.user_id, { points, displayName });
        }
      });
      const topPlayersList = Array.from(aggregatedPlayers.entries())
        .map(([userId, value]) => ({ userId, displayName: value.displayName, points: value.points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);

      const mapped = (leaguesData ?? []).map((league) =>
        mapLeagueRowToUserLeague(
          league as LeagueRow,
          countsByLeague[league.id] ?? 1,
          bestScoresByLeague.get(league.id) ?? 0,
        ),
      );
      setUserLeagues(mapped);
      setTopPlayers(topPlayersList);
      setLoadingLeagues(false);
    };

    void fetchLeagues();

    return () => {
      isMounted = false;
    };
  }, [user.id]);

  const stats = useMemo(() => computeStats(userLeagues), [userLeagues]);

  const activeLeagues = userLeagues.filter(
    (league) => league.status === "active",
  );
  const completedLeagues = userLeagues.filter(
    (league) => league.status === "completed",
  );

  const rankBadge = (rank: number) => {
    if (rank === 1) {
      return {
        icon: "🥇",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        text: "1st Place",
      };
    }
    if (rank === 2) {
      return {
        icon: "🥈",
        color: "bg-slate-100 text-slate-800 border-slate-300",
        text: "2nd Place",
      };
    }
    if (rank === 3) {
      return {
        icon: "🥉",
        color: "bg-orange-100 text-orange-800 border-orange-300",
        text: "3rd Place",
      };
    }
    return {
      icon: `#${rank}`,
      color: "bg-slate-100 text-slate-800 border-slate-300",
      text: `${rank}th Place`,
    };
  };

  const statusBadge = (status: UserLeague["status"]) => {
    if (status === "active") {
      return {
        text: t.activeStatus || "Active",
        color: "bg-green-100 text-green-800 border-green-300",
      };
    }
    if (status === "pending") {
      return {
        text: t.pendingStatus || "Pending",
        color: "bg-amber-100 text-amber-700 border-amber-300",
      };
    }
    return {
      text: t.completedStatus || "Completed",
      color: "bg-slate-100 text-slate-800 border-slate-300",
    };
  };

  const quickActions = [
    {
      label: t.createLeague || "Create League",
      description: "Launch a new Benolo league",
      icon: <Plus className="h-4 w-4" />,
      action: onCreateLeague,
    },
    {
      label: t.joinLeague || "Join League",
      description: "Browse open communities",
      icon: <Users className="h-4 w-4" />,
      action: onJoinLeague,
    },
    {
      label: t.wallet || "Wallet",
      description: "Check your Benolo balance",
      icon: <Coins className="h-4 w-4" />,
      action: onViewWallet,
    },
    {
      label: t.betting || "Betting",
      description: "Enter prediction center",
      icon: <Target className="h-4 w-4" />,
      action: () => onViewBetting(),
    },
  ];

  return (
    <div className="space-y-8">
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-t-4 border-emerald-500 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t.totalInvested || "Total Invested"}</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              ${stats.totalInvested.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t.currentValue || "Current Value"}
            </div>
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              {stats.averageROI.toFixed(1)}%
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-blue-500 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t.totalEarnings || "Total Earnings"}</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              ${stats.totalEarnings.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t.totalRewards || "Yield Rewards"}
            </div>
            <Badge className="gap-1 bg-blue-500/10 text-blue-600">
              <Sparkles className="h-3 w-3" />
              ${stats.totalRewards.toFixed(2)}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-purple-500 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>
              {t.accuracy || "Prediction Accuracy"}
            </CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {stats.accuracy.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {stats.correctPredictions}/{stats.totalPredictions} correct
            </div>
            <Badge className="gap-1 bg-purple-500/10 text-purple-600">
              <Target className="h-3 w-3" />
              {t.trend || "Trend"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-amber-500 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t.myLeagues || "Active Leagues"}</CardDescription>
            <CardTitle className="text-3xl font-semibold">
              {stats.activeLeagues}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t.completedLeagues || "Completed"}: {stats.completedLeagues}
            </div>
            <Badge className="gap-1 bg-amber-500/10 text-amber-600">
              <Trophy className="h-3 w-3" />
              {stats.podiumFinishes} podiums
            </Badge>
          </CardContent>
        </Card>
      </div>

      {topPlayers.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t.leaderboard || "Leaderboard"}</CardTitle>
              <CardDescription>
                {t.leaderboardSnapshotDesc || "Top performers across your leagues"}
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600">
              <Trophy className="mr-1 h-3 w-3" />
              {t.glory || "Glory"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPlayers.map((player, index) => (
              <div key={player.userId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Badge className="h-8 w-8 justify-center rounded-full">{index + 1}</Badge>
                  <div>
                    <p className="font-semibold text-slate-900">{player.displayName ?? player.userId}</p>
                    <p className="text-xs text-muted-foreground font-mono">{player.userId}</p>
                  </div>
                </div>
                <div className="text-right font-semibold text-emerald-600">
                  {Math.round(player.points)} pts
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="shadow-md">
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t.myDashboard || "My Dashboard"}</CardTitle>
              <CardDescription>
                {t.personalStats || "Your Benolo performance at a glance"}
              </CardDescription>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="sm:w-auto">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="space-y-6">
            <Tabs value={activeTab}>
              <TabsContent value="overview" className="space-y-6">
                {loadingLeagues ? (
                  <div className="flex min-h-[200px] items-center justify-center text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t.loading || "Loading..."}
                  </div>
                ) : userLeagues.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                    <Trophy className="h-10 w-10 text-slate-400" />
                    <p className="text-sm">{t.createFirst || "No leagues yet. Create your first league!"}</p>
                    <Button onClick={onCreateLeague} className="gap-2">
                      <Plus className="h-4 w-4" />
                      {t.createLeague || "Create League"}
                    </Button>
                  </div>
                ) : userLeagues.map((league) => {
                  const rank = rankBadge(league.myRank);
                  const status = statusBadge(league.status);
                  const entryFeeLabel = league.entryFee > 0 ? `$${league.entryFee}` : (t.freeEntry || 'FREE');
                  const participantsLabel = typeof league.participants === 'number' && league.participants > 0
                    ? `${league.participants}${league.maxParticipants ? `/${league.maxParticipants}` : ''}`
                    : '—';
                  const deadlineLabel = league.signupDeadline ? new Date(league.signupDeadline).toLocaleString() : null;
                  const durationLabel =
                    league.durationType === 'matchdays'
                      ? `${league.durationValue ?? 0} ${t.matchdayCount || 'matchdays'}`
                      : (t.fullSeason || 'Full season');

                  return (
                    <div
                      key={league.id}
                      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-emerald-500" />
                            <h3 className="text-lg font-semibold text-slate-900">
                              {league.name}
                            </h3>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {league.championship}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={status.color}>{status.text}</Badge>
                          <Badge className={rank.color}>{rank.icon} {rank.text}</Badge>
                          <Badge className="bg-emerald-500/10 text-emerald-600">
                            {league.currentYield.toFixed(1)}% APY
                          </Badge>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            {league.isPublic === false ? (t.privateLeagueTitle || 'Private') : (t.publicLeagueTitle || 'Public')}
                          </Badge>
                          <Badge variant="secondary" className={league.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>
                            {league.isPaid ? (t.paidLeague || 'Paid') : (t.freeLeague || 'Free')}
                          </Badge>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                            {durationLabel}
                          </Badge>
                          {deadlineLabel && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              {t.signupDeadline || 'Deadline'}: {deadlineLabel}
                            </Badge>
                          )}
                          {!league.hasStarted && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                              {league.startCondition === 'participants'
                                ? (t.leaguePendingParticipantsShort || 'En attente de joueurs')
                                : (t.leaguePendingDateShort || 'En attente du lancement')}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-dashed border-slate-200 p-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-3 w-3" />
                            {t.entryFee || "Entry Fee"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {entryFeeLabel}
                          </p>
                        </div>
                        <div className="rounded-lg border border-dashed border-slate-200 p-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            {t.participants || "Participants"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {participantsLabel}
                          </p>
                        </div>
                        <div className="rounded-lg border border-dashed border-slate-200 p-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {t.endDate || "End Date"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {new Date(league.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="rounded-lg border border-dashed border-slate-200 p-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            {t.currentYield || "Current Yield"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {league.roi.toFixed(1)}%
                          </p>
                        </div>
                        <div className="rounded-lg border border-dashed border-slate-200 p-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Trophy className="h-3 w-3" />
                            {t.bestScore || "Best Score"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {Math.round(league.bestScore)} pts
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button size="sm" onClick={() => onViewLeague(league)} className="gap-2">
                          <Eye className="h-4 w-4" />
                          {t.leagueInfo || "League Info"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onViewBetting(league)}
                          className="gap-2"
                        >
                          <Target className="h-4 w-4" />
                          {t.makePredictions || "Make Predictions"}
                        </Button>
                        {league.isPaid && league.vaultAddress && (
                          <ClaimYieldButton leagueId={league.id} vaultAddress={league.vaultAddress} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="active" className="space-y-4">
                {activeLeagues.map((league) => (
                  <Card key={league.id} className="border-l-4 border-emerald-500 bg-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{league.name}</CardTitle>
                      <CardDescription>
                        {t.matches || "Matches"}: {league.matchesLeft}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <Progress value={Math.min(100, (league.correctPredictions / Math.max(league.totalPredictions, 1)) * 100)} className="w-32" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {league.correctPredictions}/{league.totalPredictions} correct
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.currentYield || "Current Yield"}: {league.currentYield.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <Button onClick={() => onViewBetting(league)} className="gap-2">
                        <Zap className="h-4 w-4" />
                        {t.makePredictions || "Make Predictions"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedLeagues.map((league) => (
                  <Card key={league.id} className="border-l-4 border-slate-400 bg-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{league.name}</CardTitle>
                      <CardDescription>
                        {t.totalRewards || "Yield Rewards"}: ${
                          (league.finalReward ?? 0).toFixed(2)
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Medal className="h-4 w-4 text-amber-500" />
                          Final rank: {league.myRank}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-slate-500" />
                          ROI: {league.roi.toFixed(1)}%
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewLeague(league)}
                        className="gap-2"
                      >
                        <ChevronRight className="h-4 w-4" />
                        {t.leagueInfo || "League Info"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>{t.quickActions || "Quick Actions"}</CardTitle>
              <CardDescription>
                {t.getStarted || "Manage your Benolo journey"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="w-full justify-between gap-3 rounded-xl border-slate-200 py-5 text-left hover:border-emerald-500 hover:bg-emerald-500/5"
                  onClick={action.action}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      {action.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{action.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>{t.leagueStats || "League Stats"}</CardTitle>
              <CardDescription>
                {t.statistics || "Performance overview"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Average rank</p>
                  <p className="text-xl font-semibold">{stats.averageRank.toFixed(1)}</p>
                </div>
                <Star className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Podium finishes</p>
                  <p className="text-xl font-semibold">{stats.podiumFinishes}</p>
                </div>
                <Trophy className="h-8 w-8 text-amber-500" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Yield generated</p>
                  <p className="text-xl font-semibold">
                    ${stats.totalRewards.toFixed(2)}
                  </p>
                </div>
                <Coins className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-white">
                Secure DeFi infrastructure
              </CardTitle>
              <CardDescription className="text-slate-200">
                Benolo protects your USDC while generating sustainable yield
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-emerald-400" />
                <p>100% principal protection</p>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-emerald-400" />
                <p>Automated yield distribution</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-emerald-400" />
                <p>Real-time portfolio tracking</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface ClaimYieldButtonProps {
  leagueId: string;
  vaultAddress: string;
}

function ClaimYieldButton({ leagueId, vaultAddress }: ClaimYieldButtonProps) {
  const { address } = useAccount();
  const { claim } = useLeagueVaultActions(vaultAddress as Address);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claimant = (address ?? "0x0000000000000000000000000000000000000000") as Address;
  const {
    data: claimableData,
    refetch: refetchClaimable,
    isPending: claimablePending,
  } = useReadContract({
    address: vaultAddress as Address,
    abi: leagueVaultAbi,
    functionName: "claimable",
    args: [claimant],
    query: {
      enabled: Boolean(address),
    },
  });
  const claimableTuple = claimableData as readonly [bigint, bigint] | undefined;
  const claimablePrincipal = claimableTuple ? Number(claimableTuple[0]) : 0;
  const claimableYield = claimableTuple ? Number(claimableTuple[1]) : 0;
  const { data: statusRaw } = useReadContract({
    address: vaultAddress as Address,
    abi: leagueVaultAbi,
    functionName: "status",
  });
  const status = typeof statusRaw === "number" ? statusRaw : Number(statusRaw ?? 0);
  const canClaim = status === 5; // DISTRIBUTED

  const handleClaim = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const hash = await claim();
      setFeedback(`Transaction envoyée : ${hash.slice(0, 10)}…`);
      await logLeagueTransaction({
        leagueId,
        action: "claim",
        txHash: hash,
        walletAddress: address ?? undefined,
        chainId: 8453,
        metadata: { vaultAddress },
      });
      await refetchClaimable();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de réclamer les fonds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        className="gap-2"
        onClick={handleClaim}
        disabled={loading || !address || !canClaim}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        Réclamer mes fonds
      </Button>
      {!address && (
        <span className="text-xs text-amber-600">
          Connecte ton wallet pour réclamer tes gains
        </span>
      )}
      {!canClaim && (
        <span className="text-xs text-muted-foreground">
          Les retraits seront possibles une fois la ligue en mode &ldquo;Distributed&rdquo;.
        </span>
      )}
      {address && canClaim && (
        <span className="text-xs text-muted-foreground">
          {claimablePending ? "Lecture des montants..." : `Principal: ${(claimablePrincipal / 1e6).toFixed(2)} USDC · Yield: ${(claimableYield / 1e6).toFixed(2)} USDC`}
        </span>
      )}
      {feedback && <span className="text-xs text-emerald-600">{feedback}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
