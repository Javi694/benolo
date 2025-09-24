"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Target,
  Trophy,
  Users,
  Zap,
  Loader2,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { hasLeagueStarted } from "@/lib/leagues/start";
import type {
  DemoUser,
  LeagueSummary,
  TranslationAwareProps,
  LeagueMatch,
  LeaguePrediction,
} from "@/types/app";

interface DemoMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  status: "upcoming" | "live" | "finished";
}

interface PredictionState {
  homeScore: string;
  awayScore: string;
  confident: boolean;
}

interface LeaderboardEntry {
  user_id: string;
  total_points: number;
  displayName?: string | null;
}

interface MatchBettingProps extends TranslationAwareProps {
  user: DemoUser | null;
  selectedLeague: LeagueSummary | null;
  onBack: () => void;
}

const formatMatchDate = (isoString: string) =>
  new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const timeUntilMatch = (isoString: string) => {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) {
    return "Starting";
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

const mapRowToMatch = (row: Partial<LeagueMatch> & { id: string }): DemoMatch => ({
  id: row.id,
  homeTeam: row.homeTeam ?? row.home_team ?? "Home",
  awayTeam: row.awayTeam ?? row.away_team ?? "Away",
  matchDate: row.startAt ?? row.start_at ?? new Date().toISOString(),
  status:
    row.status === "live" || row.status === "completed"
      ? row.status
      : "upcoming",
});

export function MatchBetting({
  user,
  selectedLeague,
  onBack,
  translations: t,
}: MatchBettingProps) {
  const supabase = supabaseBrowserClient;
  const [activeTab, setActiveTab] = useState("available");
  const [autoStake, setAutoStake] = useState(true);
  const [matches, setMatches] = useState<DemoMatch[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionState>>({});
  const [loadingMatches, setLoadingMatches] = useState<boolean>(Boolean(supabase && selectedLeague?.id));
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(Boolean(supabase && selectedLeague?.id));
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const resetPredictions = useCallback(() => {
    setPredictions({});
  }, []);

  useEffect(() => {
    resetPredictions();
    setLeaderboard([]);
    setLeaderboardError(null);
  }, [selectedLeague?.id, resetPredictions]);

  useEffect(() => {
    if (!selectedLeague?.id) {
      setMatches([]);
      setLoadingMatches(false);
      return;
    }

    if (!supabase) {
      setMatches([]);
      setMatchesError("Supabase is not configured.");
      setLoadingMatches(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoadingMatches(true);
      setMatchesError(null);

      const { data: matchRows, error: matchesErr } = await supabase
        .from("league_matches")
        .select("id, home_team, away_team, start_at, status")
        .eq("league_id", selectedLeague.id)
        .order("start_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (matchesErr) {
        setMatchesError(matchesErr.message);
        setMatches([]);
        setLoadingMatches(false);
        return;
      }

      const transformed = (matchRows ?? []).map((row: any) =>
        mapRowToMatch({ ...row, startAt: row.start_at }),
      );

      setMatches(transformed);

      if (user?.id) {
        const { data: predictionRows, error: predictionsErr } = await supabase
          .from("league_predictions")
          .select("match_id, home_score, away_score, confident")
          .eq("league_id", selectedLeague.id)
          .eq("user_id", user.id);

        if (isMounted) {
          if (predictionsErr) {
            setMatchesError(predictionsErr.message);
          } else {
            const initial: Record<string, PredictionState> = {};
            (predictionRows ?? []).forEach((prediction: any) => {
              initial[prediction.match_id] = {
                homeScore: prediction.home_score?.toString() ?? "",
                awayScore: prediction.away_score?.toString() ?? "",
                confident: Boolean(prediction.confident),
              };
            });
            setPredictions(initial);
          }
        }
      }

      setLoadingMatches(false);
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [selectedLeague?.id, supabase, user?.id]);

  useEffect(() => {
    if (!selectedLeague?.id || !supabase) {
      setLeaderboard([]);
      setLoadingLeaderboard(false);
      return;
    }

    let isMounted = true;

    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      setLeaderboardError(null);

      const { data, error } = await supabase
        .from("league_leaderboard")
        .select("league_id, user_id, total_points")
        .eq("league_id", selectedLeague.id)
        .order("total_points", { ascending: false })
        .limit(10);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLeaderboardError(error.message);
        setLeaderboard([]);
      } else {
        let rows: LeaderboardEntry[] = (data ?? []) as LeaderboardEntry[];
        const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));

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
      isMounted = false;
    };
  }, [selectedLeague?.id, supabase]);

  const handlePredictionChange = (
    matchId: string,
    field: keyof PredictionState,
    value: string | boolean,
  ) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        homeScore: prev[matchId]?.homeScore ?? "",
        awayScore: prev[matchId]?.awayScore ?? "",
        confident: prev[matchId]?.confident ?? false,
        ...prev[matchId],
        [field]: value,
      },
    }));
  };

  const leagueHasStarted = useMemo(() => hasLeagueStarted(selectedLeague), [selectedLeague]);

  const isMatchLocked = useCallback((match: DemoMatch) => {
    if (match.status === "live" || match.status === "finished" || match.status === "completed") {
      return true;
    }

    const startAt = new Date(match.matchDate).getTime();
    if (Number.isNaN(startAt)) {
      return false;
    }

    return startAt <= Date.now();
  }, []);

  const leagueLocked = !leagueHasStarted;
  const participantTarget = selectedLeague?.startMinParticipants ?? null;
  const participantsNow = Number(selectedLeague?.participants ?? 0);

  const canSubmit = (match: DemoMatch) => {
    if (leagueLocked || isMatchLocked(match)) {
      return false;
    }
    const prediction = predictions[match.id];
    if (!prediction) return false;
    return prediction.homeScore !== "" && prediction.awayScore !== "";
  };

  const submitPrediction = async (match: DemoMatch) => {
    if (leagueLocked) {
      window.alert(t.leagueNotStarted || "Les pronostics ouvriront dès le lancement de la ligue." );
      return;
    }

    if (isMatchLocked(match)) {
      window.alert(t.predictionClosed || "Predictions are closed for this match.");
      return;
    }

    if (!canSubmit(match)) {
      window.alert(t.fillScores || "Please enter a prediction for both teams.");
      return;
    }

    const current = predictions[match.id];
    if (!current) {
      return;
    }

    const homeScore = Number(current.homeScore);
    const awayScore = Number(current.awayScore);

    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      window.alert(t.invalidScores || "Invalid scores provided.");
      return;
    }

    if (!supabase || !user || !selectedLeague?.id) {
      window.alert(t.predictionSavedLocally || "Prediction saved locally." );
      return;
    }

    setSavingMatchId(match.id);
    const { error } = await supabase
      .from("league_predictions")
      .upsert({
        match_id: match.id,
        league_id: selectedLeague.id,
        user_id: user.id,
        home_score: homeScore,
        away_score: awayScore,
        confident: current.confident,
      });
    setSavingMatchId(null);

    if (error) {
      window.alert(error.message);
    } else {
      window.alert(t.predictionSaved || "Prediction saved!");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wider text-emerald-500">
            {t.betting || "Betting"}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            {selectedLeague?.name || "Match Center"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.bettingIntro || "Upcoming fixtures synced with your Benolo league."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2">
            {t.backToDashboard || "Back to dashboard"}
          </Button>
          <Button className="gap-2">
            <Zap className="h-4 w-4" />
            {t.quickStake || "Quick stake"}
          </Button>
        </div>
      </div>

      <Card className="shadow-md">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl">{t.predictionOptions || "Prediction options"}</CardTitle>
              <CardDescription>
                {t.predictionOptionsDesc || "Place score predictions and manage your staking preferences."}
              </CardDescription>
            </div>
            <TabsList>
              <TabsTrigger value="available">{t.availableMatches || "Available"}</TabsTrigger>
              <TabsTrigger value="history">{t.history || "History"}</TabsTrigger>
              <TabsTrigger value="rules">{t.rules || "Rules"}</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="available" className="space-y-6">
              {matchesError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {matchesError}
                </div>
              )}

              {leagueLocked && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <span>
                      {selectedLeague?.startCondition === "participants"
                        ? (t.leagueStartAfterParticipantsDesc || "Cette ligue s'ouvrira dès que le seuil de joueurs sera atteint.")
                        : (t.leagueStartAfterDateDesc || "Cette ligue ouvrira automatiquement à la date programmée.")}
                    </span>
                    {selectedLeague?.startCondition === "participants" && participantTarget != null && (
                      <span className="mt-1 block text-xs">
                        {t.leaguePendingParticipantsProgress
                          ? t.leaguePendingParticipantsProgress
                              .replace('{current}', String(participantsNow))
                              .replace('{target}', String(participantTarget))
                          : `${participantsNow}/${participantTarget} players joined`}
                      </span>
                    )}
                    {selectedLeague?.startCondition !== "participants" && (selectedLeague?.startAt || selectedLeague?.signupDeadline) && (
                      <span className="mt-1 block text-xs">
                        {t.leaguePendingDateInfo
                          ? t.leaguePendingDateInfo.replace('{date}', new Date((selectedLeague.startAt ?? selectedLeague.signupDeadline) as string).toLocaleString())
                          : `Launch date: ${new Date((selectedLeague.startAt ?? selectedLeague.signupDeadline) as string).toLocaleString()}`}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {loadingMatches ? (
                <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t.loading || "Loading"}
                </div>
              ) : matches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                  {t.noMatches || "No matches available for this league yet."}
                </div>
              ) : (
                matches.map((match) => {
                  const locked = leagueLocked || isMatchLocked(match);
                  const prediction = predictions[match.id];
                  return (
                    <div
                      key={match.id}
                      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm uppercase text-muted-foreground">
                            {selectedLeague?.championship || t.match || "Match"}
                          </p>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {match.homeTeam} vs {match.awayTeam}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <Badge className="gap-1 bg-emerald-500/10 text-emerald-600">
                            <Clock className="h-3 w-3" />
                            {timeUntilMatch(match.matchDate)}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {formatMatchDate(match.matchDate)}
                          </p>
                          {locked && (
                            <Badge className="bg-rose-100 text-rose-700">
                              {t.predictionClosed || "Predictions closed"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor={`home-${match.id}`}>{t.homeScore || "Home score"}</Label>
                          <Input
                            id={`home-${match.id}`}
                            value={prediction?.homeScore ?? ""}
                            onChange={(event) =>
                              handlePredictionChange(match.id, "homeScore", event.target.value)
                            }
                            placeholder="2"
                            inputMode="numeric"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`away-${match.id}`}>{t.awayScore || "Away score"}</Label>
                          <Input
                            id={`away-${match.id}`}
                            value={prediction?.awayScore ?? ""}
                            onChange={(event) =>
                              handlePredictionChange(match.id, "awayScore", event.target.value)
                            }
                            placeholder="1"
                            inputMode="numeric"
                            disabled={locked}
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t.confidence || "Confidence"}
                              </p>
                              <p className="text-sm font-medium text-slate-900">
                                {t.confidenceHint || "Boost your yield"}
                              </p>
                            </div>
                            <Switch
                              checked={prediction?.confident ?? false}
                              onCheckedChange={(value) => handlePredictionChange(match.id, "confident", value)}
                              disabled={locked}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {t.actions || "Actions"}
                          </Label>
                          <Button
                            className="w-full gap-2"
                            onClick={() => void submitPrediction(match)}
                            disabled={locked || !canSubmit(match) || savingMatchId === match.id}
                          >
                            {savingMatchId === match.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Target className="h-4 w-4" />
                            )}
                            {t.submitPrediction || "Submit prediction"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="history">
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
                {t.historyComingSoon || "Prediction history will appear once matches are settled."}
              </div>
            </TabsContent>

            <TabsContent value="rules" className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {t.scoringOverview || "Scoring overview"}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.scoringOverviewDesc || "Exact rules will be announced when the scoring engine goes live."}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.benoloStaking || "Benolo staking"}</CardTitle>
            <CardDescription>
              {t.benoloStakingDesc || "Automate your USDC staking per prediction."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{t.autoStake || "Auto stake"}</p>
                <p className="text-xs text-muted-foreground">
                  {t.autoStakeDesc || "Allocate a small portion of your balance when confidence is enabled."}
                </p>
              </div>
              <Switch checked={autoStake} onCheckedChange={setAutoStake} />
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-muted-foreground">
              {t.stakingInfo || "Benolo keeps your principal safe. Only yields are redistributed to top predictors."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.leaderboardSnapshot || "Leaderboard snapshot"}</CardTitle>
            <CardDescription>
              {t.leaderboardSnapshotDesc || "Top predictors for this league."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaderboardError && (
              <Alert variant="destructive">
                <AlertDescription>{leaderboardError}</AlertDescription>
              </Alert>
            )}
            {loadingLeaderboard ? (
              <div className="flex items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.loading || "Loading"}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.leaderboardSnapshotInfo || "Be the first to submit a prediction."}
              </p>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={`${entry.user_id}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge className="h-8 w-8 justify-center rounded-full">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {entry.displayName ?? entry.user_id}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.user_id}</p>
                    </div>
                  </div>
                  <div className="text-right font-semibold text-emerald-600">
                    {Math.round(Number(entry.total_points ?? 0))} pts
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
