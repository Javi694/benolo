"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Trophy,
  Users,
  DollarSign,
  Target,
  Coins,
  ArrowLeft,
  Shield,
  Calendar,
  BarChart3,
  Zap,
  LogOut,
  AlertTriangle,
  Loader2,
  Percent,
} from "lucide-react";

import { CHAMPIONSHIPS, DEFI_STRATEGIES, translations as defaultTranslations } from "@/data/content";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { hasLeagueStarted } from "@/lib/leagues/start";
import type { LeagueMatch, LeagueSummary } from "@/types/app";

interface LeaderboardEntry {
  user_id: string;
  total_points: number;
  predictions_count?: number;
  correct_count?: number;
  displayName?: string | null;
}

interface LeagueDetailProps {
  league: LeagueSummary;
  user?: any;
  onBack: () => void;
  onViewBetting?: (league?: LeagueSummary | string | null) => void;
  translations?: any;
  language?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export function LeagueDetail({ league, user, onBack, onViewBetting, translations, language = "en" }: LeagueDetailProps) {
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const supabase = supabaseBrowserClient;

  const computedParticipants = Number(league?.participants ?? 0);
  const leagueHasStarted = useMemo(() => hasLeagueStarted(league), [league]);

  useEffect(() => {
    if (!supabase || !league?.id) {
      setLoadingMatches(false);
      setMatches([]);
      return;
    }

    let active = true;
    const fetchMatches = async () => {
      setLoadingMatches(true);
      setMatchesError(null);

      const { data, error } = await supabase
        .from("league_matches")
        .select("id, home_team, away_team, start_at, status, home_score, away_score")
        .eq("league_id", league.id)
        .order("start_at", { ascending: true });

      if (!active) {
        return;
      }

      if (error) {
        setMatchesError(error.message);
        setMatches([]);
      } else {
        setMatches(
          (data ?? []).map((row) => ({
            id: row.id,
            leagueId: league.id,
            homeTeam: row.home_team,
            awayTeam: row.away_team,
            startAt: row.start_at,
            status: row.status,
            homeScore: row.home_score,
            awayScore: row.away_score,
          } as LeagueMatch)),
        );
      }

      setLoadingMatches(false);
    };

    void fetchMatches();

    return () => {
      active = false;
    };
  }, [league?.id, supabase]);

  useEffect(() => {
    if (!supabase || !league?.id) {
      setLeaderboard([]);
      setLoadingLeaderboard(false);
      return;
    }

    let active = true;

    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      setLeaderboardError(null);

      const { data, error } = await supabase
        .from("league_leaderboard")
        .select("league_id, user_id, total_points, predictions_count, correct_count")
        .eq("league_id", league.id)
        .order("total_points", { ascending: false })
        .limit(20);

      if (!active) {
        return;
      }

      if (error) {
        setLeaderboardError(error.message);
        setLeaderboard([]);
      } else {
        let rows: LeaderboardEntry[] = (data ?? []) as LeaderboardEntry[];
        const userIds = Array.from(
          new Set(rows.map((row) => row.user_id).filter(Boolean)),
        );

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", userIds);

          if (profileError) {
            setLeaderboardError(profileError.message);
          } else {
            const nameById = new Map<string, string | null>();
            (profileRows ?? []).forEach((profile: any) => {
              nameById.set(profile.id as string, profile.display_name ?? null);
            });

            rows = rows.map((row) => ({
              ...row,
              displayName: nameById.get(row.user_id) ?? null,
            }));
          }
        }

        setLeaderboard(rows);
      }

      setLoadingLeaderboard(false);
    };

    void fetchLeaderboard();

    return () => {
      active = false;
    };
  }, [league?.id, supabase]);

  if (!league) {
    return null;
  }

  const t = translations || defaultTranslations?.[language] || defaultTranslations?.en || {};

  const formatCommissionBps = (bps: number | null | undefined): string => {
    if (bps == null) {
      return "—";
    }
    const percent = bps / 100;
    return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(2)}%`;
  };

  const creatorId = league?.creatorId ?? league?.creator_id;
  const isOwner = Boolean(user?.id && creatorId && user?.id === creatorId);

  const championship =
    CHAMPIONSHIPS.find((item) => item.id === league.championship) ||
    {
      id: "custom",
      name: league.championship || "Custom league",
      logo: "🏆",
      country: "",
    };

  const strategyFromCatalog = league.strategy
    ? DEFI_STRATEGIES.find((item) => item.id === league.strategy)
    : null;

  const entryFeeValue = Number(league.entryFee ?? 0);
  const participantsCount = computedParticipants;
  const totalPool = entryFeeValue > 0 && participantsCount > 0 ? entryFeeValue * participantsCount : 0;
  const isFreeLeague = entryFeeValue === 0;
  const isPrivateLeague = league.isPublic === false;
  const signupDeadline = league.signupDeadline ? new Date(league.signupDeadline) : null;
  const durationLabel =
    league.durationType === "matchdays"
      ? `${league.durationValue ?? 0} ${t.matchdayCount || "matchdays"}`
      : (t.fullSeason || "Full season");
  const investmentName = league.investmentProtocol || strategyFromCatalog?.name || t.investmentStrategy || "Strategy";
  const investmentApy = league.investmentApyRange || strategyFromCatalog?.apyRange || "—";
  const investmentRisk = league.investmentRiskLevel || strategyFromCatalog?.risk || "—";
  const commissionValue =
    league.commissionBps != null
      ? formatCommissionBps(league.commissionBps)
      : formatCommissionBps(strategyFromCatalog?.commissionBps ?? null);

  const earlyExitInfo = league.canLeave
    ? `${league.earlyExitPenaltyRate ?? 0}% ${t.penaltyPercentage || "penalty"}`
    : (t.no || "Not allowed");

  const handleDeployModalConfirm = async () => {
    setDeployLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setDeployLoading(false);
    setDeployDialogOpen(false);
  };

  const quickStats = [
    {
      label: t.entryFee || "Entry Fee",
      value: isFreeLeague ? (t.freeEntry || "Free") : formatCurrency(entryFeeValue),
      icon: Coins,
      color: "text-slate-700",
    },
    {
      label: t.participants || "Players",
      value: participantsCount > 0 ? String(participantsCount) : "—",
      icon: Users,
      color: "text-slate-700",
    },
    {
      label: t.totalPool || "Total Pool",
      value: totalPool > 0 ? formatCurrency(totalPool) : "—",
      icon: DollarSign,
      color: "text-slate-700",
    },
    {
      label: t.signupDeadline || "Signup deadline",
      value: signupDeadline ? signupDeadline.toLocaleString() : "—",
      icon: Calendar,
      color: "text-slate-700",
    },
    {
      label: t.investmentStrategy || "Strategy",
      value: isFreeLeague ? (t.justForFun || "Fun mode") : investmentName,
      icon: Shield,
      color: "text-slate-700",
    },
    {
      label: t.benoloCommission || "Benolo commission",
      value: commissionValue,
      icon: Percent,
      color: "text-emerald-600",
    },
    {
      label: t.earlyExitQuestion || "Early exit",
      value: earlyExitInfo,
      icon: LogOut,
      color: league.canLeave ? "text-amber-600" : "text-slate-600",
    },
  ];

  return (
    <>
      <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.smartContractNext || "Deploy payout smart contract"}</DialogTitle>
            <DialogDescription>
              {t.smartContractSummary || "Review the parameters before signing the deployment transaction."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>{t.entryFee || "Entry Fee"}</span>
              <span className="font-semibold text-slate-900">{formatCurrency(entryFeeValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t.investmentStrategy || "Strategy"}</span>
              <span className="font-semibold text-slate-900">{investmentName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t.earlyExitQuestion || "Early exit"}</span>
              <span className="font-semibold text-slate-900">{earlyExitInfo}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.smartContractDisclaimer || "This preview does not execute on-chain actions yet. Use this flow to validate requirements."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployDialogOpen(false)}>
              {t.cancel || "Cancel"}
            </Button>
            <Button onClick={handleDeployModalConfirm} disabled={deployLoading} className="gap-2">
              {deployLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deployNow || "Simulate deployment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="border-slate-300 hover:bg-slate-50">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.backToDashboard || "Back to Dashboard"}
        </Button>
      </div>

      <Card className="border-2 border-slate-200 bg-white shadow-lg">
        <CardHeader className="pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-4xl">
                {championship.logo}
              </div>
              <div>
                <CardTitle className="mb-2 text-4xl font-bold text-slate-900">{league.name}</CardTitle>
                <CardDescription className="mb-3 text-xl text-slate-600">
                  {league.description || `${championship.name} predictions league`}
                </CardDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-600">
                    <Shield className="mr-1 h-3 w-3" /> Benolo Protocol
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {isPrivateLeague ? (t.privateLeagueTitle || "Private league") : (t.publicLeagueTitle || "Public league")}
                  </Badge>
                  <Badge variant="secondary" className={isFreeLeague ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}>
                    {isFreeLeague ? (t.freeLeague || "Free league") : (t.paidLeague || "Paid league")}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {durationLabel}
                  </Badge>
                  {signupDeadline && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      {t.signupDeadline || "Deadline"}: {signupDeadline.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {!isFreeLeague && (
              <div className="space-y-2 text-right">
                <div className="text-4xl font-bold text-green-600">{investmentApy}</div>
                <div className="text-lg text-slate-500">{t.currentYield || "Current APY"}</div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-left">
                  <p className="text-xs uppercase tracking-wide text-green-700">{t.investmentStrategy || "Investment Strategy"}</p>
                  <p className="text-sm font-semibold text-green-900">{investmentName}</p>
                  <p className="text-xs text-green-700">{t.risk || "Risk"}: {investmentRisk}</p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {quickStats.map((stat) => (
              <Card key={stat.label} className="border border-slate-200 bg-slate-50 text-center shadow-sm">
                <CardContent className="space-y-1 py-4">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className={`text-lg font-semibold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {league.isPaid && isOwner && (
        <Card className="border border-emerald-200 bg-emerald-50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Shield className="h-5 w-5" />
              {t.smartContractReady || "Prepare smart contract deployment"}
            </CardTitle>
            <CardDescription className="text-emerald-700">
              {t.smartContractReadyDesc || "Review and sign the transaction to activate the protected vault."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-emerald-800">
              {t.smartContractReminder || "Only the league creator can deploy the contract."}
            </div>
            <Button onClick={() => setDeployDialogOpen(true)} className="gap-2">
              <Shield className="h-4 w-4" />
              {t.launchDeployment || "Launch deployment"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1">
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Trophy className="mr-2 h-4 w-4" />
            {t.leaderboard || "Leaderboard"}
          </TabsTrigger>
          <TabsTrigger value="matches" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <Calendar className="mr-2 h-4 w-4" />
            {t.matches || "Matches"}
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
            <BarChart3 className="mr-2 h-4 w-4" />
            {t.statistics || "Statistics"}
          </TabsTrigger>
        <TabsTrigger value="info" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
          <Shield className="mr-2 h-4 w-4" />
          {t.leagueInfo || "League Info"}
        </TabsTrigger>
      </TabsList>

      {!leagueHasStarted && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span>
              {league.startCondition === "participants"
                ? (t.leaguePendingParticipants || "Cette ligue ouvrira dès que le seuil de joueurs sera atteint.")
                : (t.leaguePendingDate || "Les pronostics seront disponibles à la date de lancement programmée.")}
            </span>
            {league.startCondition === "participants" && league.startMinParticipants != null && (
              <span className="mt-1 block text-xs">
                {t.leaguePendingParticipantsProgress
                  ? t.leaguePendingParticipantsProgress
                      .replace('{current}', String(participantsCount))
                      .replace('{target}', String(league.startMinParticipants ?? 0))
                  : `${participantsCount}/${league.startMinParticipants} players joined`}
              </span>
            )}
            {league.startCondition !== "participants" && (league.startAt || league.signupDeadline) && (
              <span className="mt-1 block text-xs">
                {t.leaguePendingDateInfo
                  ? t.leaguePendingDateInfo.replace('{date}', new Date((league.startAt ?? league.signupDeadline) as string).toLocaleString())
                  : `Launch date: ${new Date((league.startAt ?? league.signupDeadline) as string).toLocaleString()}`}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <TabsContent value="leaderboard">
          <Card className="border-2 border-slate-200 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                <Trophy className="h-6 w-6 text-amber-500" />
                {t.leaderboard || "League Leaderboard"}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {t.leaderboardComingSoon || "Top predictors by total points."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaderboardError && (
                <Alert variant="destructive">
                  <AlertDescription>{leaderboardError}</AlertDescription>
                </Alert>
              )}

              {loadingLeaderboard ? (
                <div className="flex min-h-[120px] items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t.loading || "Loading"}
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="space-y-4 text-sm text-slate-600">
                  <p>{t.leaderboardInfo || "No predictions have been scored yet."}</p>
                  {onViewBetting && (
                    <Button onClick={() => onViewBetting(league)} className="gap-2">
                      <Target className="h-4 w-4" />
                      {t.makePredictions || "Make Predictions"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">{t.rank || "Rank"}</th>
                        <th className="px-3 py-2">{t.player || "Player"}</th>
                        <th className="px-3 py-2 text-right">{t.points || "Points"}</th>
                        <th className="px-3 py-2 text-right">{t.predictions || "Predictions"}</th>
                        <th className="px-3 py-2 text-right">{t.accuracy || "Accuracy"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {leaderboard.map((entry, index) => {
                        const totalPreds = Number(entry.predictions_count ?? 0);
                        const correctPreds = Number(entry.correct_count ?? 0);
                        const accuracy = totalPreds > 0 ? (correctPreds / totalPreds) * 100 : 0;
                        return (
                          <tr key={`${entry.user_id}-${index}`} className="bg-slate-50 hover:bg-slate-100">
                            <td className="px-3 py-2">
                              <Badge className="h-8 w-8 justify-center rounded-full">
                                {index + 1}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">
                                {entry.displayName ?? entry.user_id}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {entry.user_id}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-base font-semibold text-emerald-600">
                              {Math.round(Number(entry.total_points ?? 0))} pts
                            </td>
                            <td className="px-3 py-2 text-right">
                              {totalPreds}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {totalPreds > 0 ? `${accuracy.toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches">
          <Card className="border-2 border-slate-200 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                <Calendar className="h-6 w-6 text-blue-500" />
                {t.matches || "Matches"}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {t.matchesComingSoon || "Track fixtures attached to this league."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchesError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {matchesError}
                </div>
              )}

              {loadingMatches ? (
                <div className="flex min-h-[120px] items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t.loading || "Loading"}
                </div>
              ) : matches.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {t.matchesInfo || "Add fixtures to your league to start tracking predictions."}
                </p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div key={match.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {match.homeTeam} vs {match.awayTeam}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(match.startAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">
                          {match.status ?? "upcoming"}
                        </Badge>
                        {match.homeScore != null && match.awayScore != null && (
                          <Badge className="bg-emerald-500/10 text-emerald-700">
                            {match.homeScore} - {match.awayScore}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card className="border-2 border-slate-200 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <BarChart3 className="h-5 w-5" />
                {t.statistics || "Statistics"}
              </CardTitle>
              <CardDescription className="text-slate-600">
                {t.statisticsComingSoon || "Analytics for accuracy, ROI and yield distribution are on the roadmap."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                {t.statisticsInfo || "Once the scoring service is connected you will see detailed charts and insights here."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <div className="grid gap-6 md:grid-cols-2">
            {!isFreeLeague && (
              <Card className="border-2 border-green-200 bg-green-50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-green-900">
                    <Shield className="h-5 w-5" />
                    {t.investmentStrategy || "Investment Strategy"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-green-900">{investmentName}</h4>
                    <p className="text-sm text-green-700">
                      {strategyFromCatalog?.description ||
                        t.investmentDescription ||
                        "Funds are automatically invested. At the end of the league everyone retrieves the principal and winners share the yield."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {t.currentYield || "APY"}: {investmentApy}
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {t.risk || "Risk"}: {investmentRisk}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-100 p-4 text-sm text-green-800">
                    <strong>💡 {t.howItWorks || "How it works"}:</strong> {t.investmentDescription || "Your USDC is automatically invested using this strategy. At the end of the league, everyone gets their principal back and winners share the generated yield."}
                  </div>
                </CardContent>
              </Card>
            )}

            {isFreeLeague && (
              <Card className="border-2 border-blue-200 bg-blue-50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-blue-900">
                    <Trophy className="h-5 w-5" />
                    {t.freeLeague || "Free league"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-700">
                    {t.freeLeagueDescription || "This is a practice league – enjoy predictions without locking USDC."}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="border-2 border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Zap className="h-5 w-5" />
                  {t.rewardDistribution || "Reward distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">
                  {t.rewardDistributionDesc || "Benolo shares the generated yield with top performers according to the rules defined at creation."}
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {league.rewardDistribution === "custom" && Array.isArray(league.rewardDistributionCustom) && league.rewardDistributionCustom.length > 0 ? (
                    <ul className="space-y-1">
                      {league.rewardDistributionCustom.map((entry: any, index: number) => (
                        <li key={`reward-${index}`}>
                          #{entry.rank}: {entry.percentage}%
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>{league.rewardDistribution || t.rewardDistribution || "Winner-takes-all"}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 bg-amber-50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  {t.earlyExitQuestion || "Early exit"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-amber-800">
                <p>{earlyExitInfo}</p>
                {league.canLeave ? (
                  <p>{t.leaveLeagueDesc || "Players leaving early will incur the configured penalty which is added to the yield pool."}</p>
                ) : (
                  <p>{t.leaveLeagueWarning || "Once the league starts, funds remain locked until the end."}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
