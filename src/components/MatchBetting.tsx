"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  Shield,
  Users,
  XCircle,
} from "lucide-react";

import { supabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
  DemoUser,
  LeagueSummary,
  TranslationAwareProps,
} from "@/types/app";

interface LeagueInfo {
  id: string;
  name: string;
  championship?: string | null;
  createdAt?: string | null;
  startAt?: string | null;
  startedAt?: string | null;
}

interface MatchRecord {
  id: string;
  league_id: string;
  external_ref?: string | null;
  home_team: string;
  away_team: string;
  start_at: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  home_score?: number | null;
  away_score?: number | null;
}

interface PredictionRow {
  match_id: string;
  league_id: string;
  home_score: number | null;
  away_score: number | null;
  confident: boolean | null;
  points?: number | null;
  status?: string | null;
  updated_at?: string | null;
}

interface StoredPredictionMeta {
  matchId: string;
  leagueId: string;
  points?: number | null;
  status?: string | null;
  updatedAt?: string | null;
}

interface PredictionState {
  homeScore: string;
  awayScore: string;
  confident: boolean;
}

interface AggregatedLeagueMatch {
  matchId: string;
  leagueId: string;
  leagueName: string;
  leagueCreatedAt?: string | null;
  leagueStartAt?: string | null;
  status: string;
  startAt: string;
  locked: boolean;
  matchHomeScore?: number | null;
  matchAwayScore?: number | null;
}

interface AggregatedMatch {
  unifiedId: string;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  startAt: string;
  matchday?: number | null;
  competitionName?: string | null;
  competitionCode?: string | null;
  leagues: AggregatedLeagueMatch[];
}

interface MatchSection {
  id: string;
  label: string;
  description?: string;
  matches: AggregatedMatch[];
  sortKey: number;
}

interface MatchBettingProps extends TranslationAwareProps {
  user: DemoUser | null;
  selectedLeague: LeagueSummary | null;
  onBack: () => void;
}

const MATCH_LOCK_STATUSES = new Set([
  "live",
  "in_play",
  "finished",
  "completed",
  "canceled",
  "postponed",
]);

const createPredictionKey = (matchId: string, leagueId: string) => `${matchId}:${leagueId}`;

const parseScoreInput = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 3);

const formatMatchDate = (isoString: string) =>
  new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const timeUntilMatch = (isoString: string) => {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) {
    return "En cours";
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

const isLocked = (status: string | null | undefined, startAt: string) => {
  const normalized = (status ?? "").toLowerCase();
  if (MATCH_LOCK_STATUSES.has(normalized)) {
    return true;
  }
  const kickoff = new Date(startAt).getTime();
  if (Number.isNaN(kickoff)) {
    return false;
  }
  return kickoff <= Date.now();
};

const shouldAppearInHistory = (entry: AggregatedLeagueMatch) => {
  if (!entry.locked) {
    return false;
  }
  if (!entry.leagueCreatedAt && !entry.leagueStartAt) {
    return true;
  }
  const referenceDate = entry.leagueStartAt ?? entry.leagueCreatedAt;
  if (!referenceDate) {
    return true;
  }
  const kickoff = new Date(entry.startAt).getTime();
  const reference = new Date(referenceDate).getTime();
  if (Number.isNaN(kickoff) || Number.isNaN(reference)) {
    return true;
  }
  return kickoff >= reference;
};

const buildSections = (
  matches: AggregatedMatch[],
  t: MatchBettingProps["translations"],
) => {
  const sections = new Map<string, MatchSection>();

  matches.forEach((match) => {
    const competition = match.competitionName ?? t.defaultCompetitionLabel ?? "Compétition";
    const matchday = match.matchday != null ? Number(match.matchday) : null;
    const sectionKey = `${match.competitionCode ?? competition}::${matchday ?? "autres"}`;
    const labelBase = competition.trim() === "" ? "Compétition" : competition;
    const label = matchday != null
      ? `${labelBase} — ${t.matchdayTitle ? t.matchdayTitle.replace("{number}", String(matchday)) : `Journée ${matchday}`}`
      : labelBase;

    const existing = sections.get(sectionKey);
    const matchSort = new Date(match.startAt).getTime();

    if (existing) {
      existing.matches.push(match);
      if (matchSort < existing.sortKey) {
        existing.sortKey = matchSort;
      }
      return;
    }

    sections.set(sectionKey, {
      id: sectionKey,
      label,
      matches: [match],
      sortKey: matchSort,
    });
  });

  return Array.from(sections.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((section) => ({
      ...section,
      matches: section.matches.sort((a, b) => {
        const aDate = new Date(a.startAt).getTime();
        const bDate = new Date(b.startAt).getTime();
        if (aDate === bDate) {
          return a.homeTeam.localeCompare(b.homeTeam);
        }
        return aDate - bDate;
      }),
    }));
};

const teamCrest = (metadata: Record<string, unknown> | null | undefined, key: "homeCrest" | "awayCrest") => {
  if (!metadata) {
    return null;
  }
  const value = metadata[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
};

const metadataNumber = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  if (!metadata) {
    return null;
  }
  const raw = metadata[key];
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const metadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  if (!metadata) {
    return null;
  }
  const raw = metadata[key];
  if (typeof raw === "string") {
    return raw;
  }
  return null;
};

export function MatchBetting({
  user,
  selectedLeague,
  onBack,
  translations: t,
}: MatchBettingProps) {
  const supabase = supabaseBrowserClient;

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(user && supabase));
  const [leagueInfos, setLeagueInfos] = useState<Record<string, LeagueInfo>>({});
  const [matchRows, setMatchRows] = useState<MatchRecord[]>([]);
  const [predictionStates, setPredictionStates] = useState<Record<string, PredictionState>>({});
  const [predictionMeta, setPredictionMeta] = useState<Record<string, StoredPredictionMeta>>({});
  const [activeLeagueIds, setActiveLeagueIds] = useState<string[]>([]);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latestPayload = useRef<Map<string, { matchId: string; leagueId: string; homeScore: number; awayScore: number }>>(new Map());
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [saveErrorMessage, setSaveErrorMessage] = useState<Record<string, string | null>>({});

  const allLeagueIds = useMemo(
    () => Object.keys(leagueInfos),
    [leagueInfos],
  );

  const leagueList = useMemo(
    () => allLeagueIds.map((id) => leagueInfos[id]).filter(Boolean),
    [allLeagueIds, leagueInfos],
  );

  useEffect(() => {
    if (!user?.id || !supabase) {
      setLeagueInfos({});
      setMatchRows([]);
      setPredictionStates({});
      setPredictionMeta({});
      setActiveLeagueIds([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setFetchError(null);

      const leagueIdSet = new Set<string>();

      if (selectedLeague?.id) {
        leagueIdSet.add(selectedLeague.id);
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);

      if (membershipError) {
        if (!isMounted) {
          return;
        }
        setFetchError(membershipError.message);
        setLeagueInfos({});
        setMatchRows([]);
        setPredictionStates({});
        setPredictionMeta({});
        setActiveLeagueIds([]);
        setLoading(false);
        return;
      }

      (membershipRows ?? []).forEach((row: { league_id: string | null }) => {
        if (row.league_id) {
          leagueIdSet.add(row.league_id);
        }
      });

      const leagueIds = Array.from(leagueIdSet);

      if (leagueIds.length === 0) {
        if (!isMounted) {
          return;
        }
        setLeagueInfos({});
        setMatchRows([]);
        setPredictionStates({});
        setPredictionMeta({});
        setActiveLeagueIds([]);
        setLoading(false);
        return;
      }

      const { data: leaguesData, error: leaguesError } = await supabase
        .from("leagues")
        .select("id, name, championship, created_at, start_at, started_at")
        .in("id", leagueIds);

      if (leaguesError) {
        if (!isMounted) {
          return;
        }
        setFetchError(leaguesError.message);
        setLeagueInfos({});
        setMatchRows([]);
        setPredictionStates({});
        setPredictionMeta({});
        setActiveLeagueIds([]);
        setLoading(false);
        return;
      }

      const infoMap: Record<string, LeagueInfo> = {};
      (leaguesData ?? []).forEach((row: any) => {
        infoMap[row.id as string] = {
          id: row.id as string,
          name: (row.name as string) ?? "Benolo League",
          championship: row.championship ?? null,
          createdAt: row.created_at ?? null,
          startAt: row.start_at ?? null,
          startedAt: row.started_at ?? null,
        };
      });

      const { data: matchesData, error: matchesError } = await supabase
        .from("league_matches")
        .select(
          "id, league_id, external_ref, home_team, away_team, start_at, status, metadata, home_score, away_score",
        )
        .in("league_id", leagueIds)
        .order("start_at", { ascending: true });

      if (matchesError) {
        if (!isMounted) {
          return;
        }
        setFetchError(matchesError.message);
        setLeagueInfos(infoMap);
        setMatchRows([]);
        setPredictionStates({});
        setPredictionMeta({});
        setActiveLeagueIds((prev) => {
          if (selectedLeague?.id && leagueIds.includes(selectedLeague.id)) {
            return [selectedLeague.id];
          }
          const validPrev = prev.filter((id) => leagueIds.includes(id));
          return validPrev.length > 0 ? validPrev : leagueIds;
        });
        setLoading(false);
        return;
      }

      const { data: predictionsData, error: predictionsError } = await supabase
        .from("league_predictions")
        .select("match_id, league_id, home_score, away_score, confident, points, status, updated_at")
        .eq("user_id", user.id)
        .in("league_id", leagueIds);

      if (predictionsError) {
        if (!isMounted) {
          return;
        }
        setFetchError(predictionsError.message);
        setLeagueInfos(infoMap);
        setMatchRows((matchesData ?? []) as MatchRecord[]);
        setPredictionStates({});
        setPredictionMeta({});
        setActiveLeagueIds((prev) => {
          if (selectedLeague?.id && leagueIds.includes(selectedLeague.id)) {
            return [selectedLeague.id];
          }
          const validPrev = prev.filter((id) => leagueIds.includes(id));
          return validPrev.length > 0 ? validPrev : leagueIds;
        });
        setLoading(false);
        return;
      }

      if (!isMounted) {
        return;
      }

      const nextPredictionState: Record<string, PredictionState> = {};
      const nextPredictionMeta: Record<string, StoredPredictionMeta> = {};

      (predictionsData ?? []).forEach((row: PredictionRow) => {
        if (!row.match_id || !row.league_id) {
          return;
        }
        const key = createPredictionKey(row.match_id, row.league_id);
        nextPredictionState[key] = {
          homeScore: row.home_score != null ? String(row.home_score) : "",
          awayScore: row.away_score != null ? String(row.away_score) : "",
          confident: Boolean(row.confident),
        };
        nextPredictionMeta[key] = {
          matchId: row.match_id,
          leagueId: row.league_id,
          points: row.points ?? null,
          status: row.status ?? null,
          updatedAt: row.updated_at ?? null,
        };
      });

      setLeagueInfos(infoMap);
      setMatchRows((matchesData ?? []) as MatchRecord[]);
      setPredictionStates(nextPredictionState);
      setPredictionMeta(nextPredictionMeta);
      setActiveLeagueIds((prev) => {
        if (selectedLeague?.id && leagueIds.includes(selectedLeague.id)) {
          return [selectedLeague.id];
        }
        const validPrev = prev.filter((id) => leagueIds.includes(id));
        return validPrev.length > 0 ? validPrev : leagueIds;
      });
      setLoading(false);
    };

    void fetchData();

    const timersRef = saveTimers.current;
    const payloadRef = latestPayload.current;

    return () => {
      isMounted = false;
      timersRef.forEach((timer) => {
        clearTimeout(timer);
      });
      timersRef.clear();
      payloadRef.clear();
    };
  }, [selectedLeague?.id, supabase, user?.id]);

  useEffect(() => {
    if (!selectedLeague?.id) {
      return;
    }
    if (!leagueInfos[selectedLeague.id]) {
      return;
    }
    setActiveLeagueIds((prev) => {
      if (prev.length === 1 && prev[0] === selectedLeague.id) {
        return prev;
      }
      return [selectedLeague.id];
    });
  }, [leagueInfos, selectedLeague?.id]);

  const filteredMatches = useMemo(() => {
    if (activeLeagueIds.length === 0) {
      return matchRows;
    }
    const activeSet = new Set(activeLeagueIds);
    return matchRows.filter((row) => activeSet.has(row.league_id));
  }, [activeLeagueIds, matchRows]);

  const aggregatedMatches = useMemo(() => {
    const map = new Map<string, AggregatedMatch>();

    filteredMatches.forEach((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const externalId = typeof row.external_ref === "string" && row.external_ref.trim() !== ""
        ? row.external_ref.trim()
        : `${row.home_team.toLowerCase()}::${row.away_team.toLowerCase()}::${new Date(row.start_at).toISOString()}`;
      const key = externalId;

      const league = leagueInfos[row.league_id];
      const matchday = metadataNumber(metadata, "matchday");
      const competitionName = metadataString(metadata, "competitionName") ?? metadataString(metadata, "competition") ?? league?.championship ?? null;
      const competitionCode = metadataString(metadata, "competitionCode") ?? null;

      const locked = isLocked(row.status, row.start_at);
      const leagueEntry: AggregatedLeagueMatch = {
        matchId: row.id,
        leagueId: row.league_id,
        leagueName: league?.name ?? "Benolo League",
        leagueCreatedAt: league?.createdAt ?? null,
        leagueStartAt: league?.startedAt ?? league?.startAt ?? null,
        status: row.status,
        startAt: row.start_at,
        locked,
        matchHomeScore: row.home_score ?? null,
        matchAwayScore: row.away_score ?? null,
      };

      const crestHome = teamCrest(metadata, "homeCrest");
      const crestAway = teamCrest(metadata, "awayCrest");

      const existing = map.get(key);
      if (existing) {
        existing.leagues.push(leagueEntry);
        if (new Date(row.start_at).getTime() < new Date(existing.startAt).getTime()) {
          existing.startAt = row.start_at;
        }
        if (!existing.homeCrest && crestHome) {
          existing.homeCrest = crestHome;
        }
        if (!existing.awayCrest && crestAway) {
          existing.awayCrest = crestAway;
        }
        return;
      }

      map.set(key, {
        unifiedId: key,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeCrest: crestHome,
        awayCrest: crestAway,
        startAt: row.start_at,
        matchday,
        competitionName,
        competitionCode,
        leagues: [leagueEntry],
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const aDate = new Date(a.startAt).getTime();
      const bDate = new Date(b.startAt).getTime();
      if (aDate === bDate) {
        return a.homeTeam.localeCompare(b.homeTeam);
      }
      return aDate - bDate;
    });
  }, [filteredMatches, leagueInfos]);

  const upcomingMatches = useMemo(() => aggregatedMatches
    .map((match) => ({
      ...match,
      leagues: match.leagues.filter((entry) => !entry.locked),
    }))
    .filter((match) => match.leagues.length > 0), [aggregatedMatches]);

  const historyMatches = useMemo(() => aggregatedMatches
    .map((match) => ({
      ...match,
      leagues: match.leagues.filter((entry) => shouldAppearInHistory(entry)),
    }))
    .filter((match) => match.leagues.length > 0), [aggregatedMatches]);

  const upcomingSections = useMemo(
    () => buildSections(upcomingMatches, t),
    [t, upcomingMatches],
  );

  const historySections = useMemo(
    () => buildSections(historyMatches, t),
    [t, historyMatches],
  );

  const defaultUpcomingOpen = useMemo(() => {
    if (upcomingSections.length === 0) {
      return [] as string[];
    }
    const [firstSection] = upcomingSections;
    return [firstSection.id];
  }, [upcomingSections]);

  const scheduleSave = useCallback((matchId: string, leagueId: string, state: PredictionState) => {
    const key = createPredictionKey(matchId, leagueId);

    if (state.homeScore === "" || state.awayScore === "") {
      return;
    }

    const homeScore = Number.parseInt(state.homeScore, 10);
    const awayScore = Number.parseInt(state.awayScore, 10);

    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      return;
    }

    latestPayload.current.set(key, { matchId, leagueId, homeScore, awayScore });

    if (saveTimers.current.has(key)) {
      clearTimeout(saveTimers.current.get(key));
    }

    const timer = setTimeout(() => {
      void (async () => {
        if (!supabase || !user?.id) {
          setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
          setSaveErrorMessage((prev) => ({ ...prev, [key]: t.supabaseUnavailable || "Impossible d'enregistrer pour le moment." }));
          return;
        }

        const payload = latestPayload.current.get(key);
        if (!payload) {
          return;
        }

        setSaveStatus((prev) => ({ ...prev, [key]: "saving" }));
        setSaveErrorMessage((prev) => ({ ...prev, [key]: null }));

        const { error } = await supabase
          .from("league_predictions")
          .upsert(
            {
              match_id: payload.matchId,
              league_id: payload.leagueId,
              user_id: user.id,
              home_score: payload.homeScore,
              away_score: payload.awayScore,
              confident: false,
            },
            { onConflict: "match_id,user_id" },
          );

        if (error) {
          setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
          setSaveErrorMessage((prev) => ({ ...prev, [key]: error.message }));
          return;
        }

        setSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
        setSaveErrorMessage((prev) => ({ ...prev, [key]: null }));
        setPredictionMeta((prev) => ({
          ...prev,
          [key]: {
            matchId: payload.matchId,
            leagueId: payload.leagueId,
            points: prev[key]?.points ?? null,
            status: prev[key]?.status ?? "pending",
            updatedAt: new Date().toISOString(),
          },
        }));

        setTimeout(() => {
          setSaveStatus((prev) => ({
            ...prev,
            [key]: "idle",
          }));
        }, 2000);
      })();
    }, 600);

    saveTimers.current.set(key, timer);
  }, [supabase, t.supabaseUnavailable, user?.id]);

  const handleScoreChange = useCallback((matchId: string, leagueId: string, side: "home" | "away", rawValue: string) => {
    setPredictionStates((prev) => {
      const key = createPredictionKey(matchId, leagueId);
      const nextValue = parseScoreInput(rawValue);
      const previous = prev[key];
      const updated: PredictionState = {
        homeScore: previous?.homeScore ?? "",
        awayScore: previous?.awayScore ?? "",
        confident: previous?.confident ?? false,
      };
      if (side === "home") {
        updated.homeScore = nextValue;
      } else {
        updated.awayScore = nextValue;
      }

      scheduleSave(matchId, leagueId, updated);

      return {
        ...prev,
        [key]: updated,
      };
    });
  }, [scheduleSave]);


  useEffect(() => {
    const timersRef = saveTimers.current;

    return () => {
      timersRef.forEach((timer) => clearTimeout(timer));
      timersRef.clear();
    };
  }, []);

  const handleBlur = useCallback((matchId: string, leagueId: string) => {
    const key = createPredictionKey(matchId, leagueId);
    const state = predictionStates[key];
    if (!state) {
      return;
    }
    scheduleSave(matchId, leagueId, state);
  }, [predictionStates, scheduleSave]);

  const copyPredictionAcrossLeagues = useCallback((match: AggregatedMatch, sourceLeagueId: string) => {
    const sourceEntry = match.leagues.find((entry) => entry.leagueId === sourceLeagueId);
    if (!sourceEntry) {
      return;
    }
    const sourceKey = createPredictionKey(sourceEntry.matchId, sourceEntry.leagueId);
    const sourceState = predictionStates[sourceKey];
    if (!sourceState || sourceState.homeScore === "" || sourceState.awayScore === "") {
      window.alert(t.copyPredictionMissing || "Renseigne les deux scores avant de copier le pronostic.");
      return;
    }

    const sanitizedHome = parseScoreInput(sourceState.homeScore);
    const sanitizedAway = parseScoreInput(sourceState.awayScore);

    match.leagues.forEach((entry) => {
      if (entry.leagueId === sourceLeagueId) {
        return;
      }
      if (entry.locked) {
        return;
      }
      const targetKey = createPredictionKey(entry.matchId, entry.leagueId);
      const nextState: PredictionState = {
        homeScore: sanitizedHome,
        awayScore: sanitizedAway,
        confident: predictionStates[targetKey]?.confident ?? false,
      };
      setPredictionStates((prev) => ({
        ...prev,
        [targetKey]: nextState,
      }));
      setTimeout(() => {
        scheduleSave(entry.matchId, entry.leagueId, nextState);
      }, 0);
    });
  }, [predictionStates, scheduleSave, t.copyPredictionMissing]);

  const renderPredictionStatus = (key: string) => {
    const status = saveStatus[key];
    const message = saveErrorMessage[key];
    if (status === "saving") {
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
          <Loader2 className="size-3 animate-spin" />
          {t.savingPrediction || "Enregistrement..."}
        </Badge>
      );
    }
    if (status === "saved") {
      return (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700">
          <Check className="size-3" />
          {t.predictionSaved || "Sauvegardé"}
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3" />
          {message ?? t.predictionSaveFailed || "Erreur"}
        </Badge>
      );
    }
    return null;
  };

  const renderLeagueFilters = () => {
    if (leagueList.length <= 1) {
      return null;
    }

    const selectedSet = new Set(activeLeagueIds);
    const showAll = activeLeagueIds.length === 0 || activeLeagueIds.length === leagueList.length;

    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Shield className="size-3.5" />
          {t.leagueFiltersLabel || "Ligues visibles"}
        </div>
        <ToggleGroup
          type="multiple"
          className="flex flex-wrap gap-2"
          value={showAll ? leagueList.map((league) => league.id) : activeLeagueIds}
          onValueChange={(value) => {
            if (value.length === leagueList.length) {
              setActiveLeagueIds([]);
              return;
            }
            if (value.length === 0) {
              setActiveLeagueIds(leagueList.map((league) => league.id));
              return;
            }
            setActiveLeagueIds(value);
          }}
        >
          {leagueList.map((league) => (
            <ToggleGroupItem
              key={league.id}
              value={league.id}
              className="data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700"
            >
              {league.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => {
            if (selectedSet.size === leagueList.length) {
              setActiveLeagueIds([leagueList[0].id]);
            } else {
              setActiveLeagueIds(leagueList.map((league) => league.id));
            }
          }}
        >
          {selectedSet.size === leagueList.length
            ? (t.leagueFilterFocusOne || "Ne garder qu'une ligue")
            : (t.leagueFilterAll || "Tout afficher")}
        </Button>
      </div>
    );
  };

  const renderMatchCard = (match: AggregatedMatch, tab: "upcoming" | "history") => {
    return (
      <Card key={match.unifiedId} className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {match.competitionName ?? t.defaultCompetitionLabel ?? "Compétition"}
              <ChevronRight className="size-3" />
              {match.matchday != null
                ? (t.matchdayTitle ? t.matchdayTitle.replace("{number}", String(match.matchday)) : `Journée ${match.matchday}`)
                : (t.matchdayUnknown || "Prochaines rencontres")}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {formatMatchDate(match.startAt)}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="flex flex-col items-center gap-3 text-center">
              {match.homeCrest ? (
                <Image
                  src={match.homeCrest}
                  alt={match.homeTeam}
                  width={56}
                  height={56}
                  className="size-14 rounded-full border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="size-14 rounded-full border border-dashed border-slate-200 bg-slate-50" />
              )}
              <span className="text-sm font-semibold text-slate-700 max-w-[140px]">
                {match.homeTeam}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">vs</span>
              {tab === "upcoming" ? (
                <Badge className="gap-1 bg-emerald-100 text-emerald-700">
                  <Users className="size-3" />
                  {timeUntilMatch(match.startAt)}
                </Badge>
              ) : (
                <Badge className="gap-1 bg-slate-200 text-slate-600">
                  {t.matchFinished || "Terminé"}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-center gap-3 text-center">
              {match.awayCrest ? (
                <Image
                  src={match.awayCrest}
                  alt={match.awayTeam}
                  width={56}
                  height={56}
                  className="size-14 rounded-full border border-slate-200 bg-white object-contain p-1"
                />
              ) : (
                <div className="size-14 rounded-full border border-dashed border-slate-200 bg-slate-50" />
              )}
              <span className="text-sm font-semibold text-slate-700 max-w-[140px]">
                {match.awayTeam}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {match.leagues.map((entry) => {
            const key = createPredictionKey(entry.matchId, entry.leagueId);
            const prediction = predictionStates[key] ?? { homeScore: "", awayScore: "", confident: false };
            const meta = predictionMeta[key];
            const statusBadge = renderPredictionStatus(key);

            return (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {entry.leagueName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.locked
                        ? (t.predictionLocked || "Pronostic verrouillé")
                        : (t.predictionOpen || "Pronostic ouvert")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge}
                    {tab === "upcoming" && match.leagues.length > 1 && !entry.locked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() => copyPredictionAcrossLeagues(match, entry.leagueId)}
                      >
                        <Copy className="size-3.5" />
                        {t.copyPrediction || "Répliquer le résultat sur les autres ligues"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <Separator className="my-4" />

                {tab === "upcoming" ? (
                  <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                    <div className="flex flex-col items-center gap-2 text-center md:items-start md:text-left">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {match.homeTeam}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        max={99}
                        value={prediction.homeScore}
                        onChange={(event) => handleScoreChange(entry.matchId, entry.leagueId, "home", event.target.value)}
                        onBlur={() => handleBlur(entry.matchId, entry.leagueId)}
                        disabled={entry.locked}
                        className="w-full max-w-[120px] text-center text-lg"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                      <span>{t.predictionSeparator || "Score"}</span>
                      <Separator orientation="vertical" className="h-10" />
                    </div>
                    <div className="flex flex-col items-center gap-2 text-center md:items-end md:text-right">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {match.awayTeam}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        max={99}
                        value={prediction.awayScore}
                        onChange={(event) => handleScoreChange(entry.matchId, entry.leagueId, "away", event.target.value)}
                        onBlur={() => handleBlur(entry.matchId, entry.leagueId)}
                        disabled={entry.locked}
                        className="w-full max-w-[120px] text-center text-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                    <div className="rounded-lg bg-slate-50 p-4 text-sm md:text-left">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {t.yourPrediction || "Ton pronostic"}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">
                        {prediction.homeScore !== "" && prediction.awayScore !== ""
                          ? `${prediction.homeScore} - ${prediction.awayScore}`
                          : t.predictionMissing || "Non renseigné"}
                      </p>
                      {meta?.points != null ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t.pointsEarned
                            ? t.pointsEarned.replace("{points}", String(meta.points))
                            : `Points gagnés : ${meta.points}`}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-center">
                      <Separator orientation="vertical" className="h-16" />
                    </div>
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm md:text-right">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {t.finalScore || "Score final"}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-800">
                        {entry.matchHomeScore != null && entry.matchAwayScore != null
                          ? `${entry.matchHomeScore} - ${entry.matchAwayScore}`
                          : t.finalScorePending || "En attente"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const renderMatches = (sections: MatchSection[], tab: "upcoming" | "history") => {
    if (fetchError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      );
    }

    if (loading) {
      return (
        <div className="flex min-h-[160px] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          {t.loading || "Chargement"}
        </div>
      );
    }

    if (sections.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground">
          {tab === "upcoming"
            ? (t.noUpcomingMatches || "Aucun match disponible pour vos ligues.")
            : (t.noHistoryMatches || "Encore aucun match terminé depuis ton inscription.")}
        </div>
      );
    }

    const defaultOpen = tab === "upcoming" ? defaultUpcomingOpen : [sections[0].id];

    return (
      <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="rounded-xl border border-slate-200 bg-white">
            <AccordionTrigger className="px-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-slate-800">{section.label}</span>
                {section.description ? (
                  <span className="text-xs text-muted-foreground">{section.description}</span>
                ) : null}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-4">
              {section.matches.map((match) => renderMatchCard(match, tab))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wider text-emerald-500">
            {t.betting || "Pronostics"}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            {t.predictionCenterTitle || "Centre des pronostics"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.predictionCenterSubtitle || "Retrouve tous tes matchs Benolo et saisis tes pronostics en un seul endroit."}
          </p>
        </div>
        <Button variant="outline" onClick={onBack} className="gap-2">
          {t.backToDashboard || "Retour"}
        </Button>
      </div>

      {renderLeagueFilters()}

      <Card className="shadow-md">
        <Tabs defaultValue="upcoming" className="w-full">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl">
                {t.predictionTabsTitle || "Tes rencontres"}
              </CardTitle>
              <CardDescription>
                {t.predictionTabsDescription || "Les matchs disponibles sont regroupés par compétition et par journée."}
              </CardDescription>
            </div>
            <TabsList>
              <TabsTrigger value="upcoming">
                {t.availableMatches || "À venir"}
              </TabsTrigger>
              <TabsTrigger value="history">
                {t.history || "Historique"}
              </TabsTrigger>
              <TabsTrigger value="rules">
                {t.rules || "Règles"}
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="space-y-6">
            <TabsContent value="upcoming" className="space-y-6">
              {renderMatches(upcomingSections, "upcoming")}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              {renderMatches(historySections, "history")}
            </TabsContent>

            <TabsContent value="rules" className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {t.scoringOverview || "Barème de points"}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.scoringOverviewDesc || "3 points pour le bon vainqueur ou nul, +3 points supplémentaires pour le score exact."}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
