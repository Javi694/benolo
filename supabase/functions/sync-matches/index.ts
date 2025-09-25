// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import {
  normalizeFixture,
  buildUpsertPayload,
  hasMatchChanged,
  type ProviderFixture,
  type NormalizedFixture,
  type ExistingMatchSnapshot,
} from "../_shared/match-sync.ts";

import {
  CHAMPIONSHIP_PROVIDER_CONFIG,
  type ChampionshipProviderConfig,
} from "../_shared/provider-config.ts";

interface LeagueRow {
  id: string;
  name: string;
  championship: string | null;
  status: string | null;
}

interface LeagueMatchRow extends ExistingMatchSnapshot {
  id: string;
  external_ref: string | null;
  metadata: Record<string, unknown> | null;
}

interface SyncSummary {
  leagueId: string;
  leagueName: string;
  inserted: number;
  updated: number;
  skipped: boolean;
  message?: string;
}

interface SyncOptions {
  seasonOverride?: number | null;
}

const respondJson = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

const ensureEnv = (...keys: string[]): string => {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) {
      return value;
    }
  }
  throw new Error(`Missing environment variable. Checked keys: ${keys.join(", ")}`);
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const parseIntEnv = (key: string, fallback: number): number => {
  const value = Deno.env.get(key);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fetchMockFixtures = async (leagueId: string): Promise<ProviderFixture[]> => {
  const base = new Date();
  const dayMs = 1000 * 60 * 60 * 24;
  return [
    {
      id: `${leagueId}-mock-1`,
      homeTeam: "Demo FC",
      awayTeam: "Sample United",
      startTime: new Date(base.getTime() + dayMs).toISOString(),
      status: "NS",
      homeScore: null,
      awayScore: null,
    },
    {
      id: `${leagueId}-mock-2`,
      homeTeam: "Placeholder Town",
      awayTeam: "Fallback City",
      startTime: new Date(base.getTime() + dayMs * 2).toISOString(),
      status: "NS",
      homeScore: null,
      awayScore: null,
    },
  ];
};

const pickScoreValue = (value: any): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const fetchApiFootballFixtures = async (
  config: ChampionshipProviderConfig,
  now: Date,
  options: SyncOptions = {},
): Promise<ProviderFixture[]> => {
  const seasonOverride = options?.seasonOverride;
  const season = seasonOverride ?? config.season;

  if (!config.leagueId || !season) {
    throw new Error("api-football config requires leagueId and season");
  }

  const apiKey = ensureEnv("SPORTS_DATA_API_KEY", "EDGE_SPORTS_DATA_API_KEY");
  const baseUrl = Deno.env.get("SPORTS_DATA_API_URL") ?? "https://v3.football.api-sports.io";
  const lookback = parseIntEnv("SPORTS_DATA_LOOKBACK_DAYS", 2);
  const lookahead = parseIntEnv("SPORTS_DATA_LOOKAHEAD_DAYS", 7);
  const from = new Date(now.getTime());
  from.setDate(from.getDate() - lookback);
  const to = new Date(now.getTime());
  to.setDate(to.getDate() + lookahead);

  const params = new URLSearchParams({
    league: String(config.leagueId),
    season: String(season),
    from: formatDate(from),
    to: formatDate(to),
  });

  const endpoint = `${baseUrl.replace(/\/$/, "")}/fixtures?${params.toString()}`;

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`api-football request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const fixtures = Array.isArray(payload?.response) ? payload.response : [];

  return fixtures.map((entry: any) => {
    const fixture = entry?.fixture ?? {};
    const teams = entry?.teams ?? {};
    const score = entry?.score ?? {};
    const goals = entry?.goals ?? {};

    const homeTeam = teams?.home?.name ?? "Home";
    const awayTeam = teams?.away?.name ?? "Away";

    const fullTime = score?.fulltime ?? {};
    const extraTime = score?.extratime ?? {};
    const penalties = score?.penalty ?? {};

    const homeScore = pickScoreValue(
      fullTime?.home ?? extraTime?.home ?? penalties?.home ?? goals?.home,
    );
    const awayScore = pickScoreValue(
      fullTime?.away ?? extraTime?.away ?? penalties?.away ?? goals?.away,
    );

    const metadata: Record<string, unknown> = {};
    if (fixture?.status?.long) {
      metadata.provider_status_long = fixture.status.long;
    }
    if (entry?.league?.round) {
      metadata.round = entry.league.round;
    }
    if (fixture?.venue?.name) {
      metadata.venue = fixture.venue.name;
    }
    if (teams?.home?.logo) {
      metadata.homeCrest = teams.home.logo;
    }
    if (teams?.away?.logo) {
      metadata.awayCrest = teams.away.logo;
    }

    return {
      id: String(fixture?.id ?? entry?.id ?? crypto.randomUUID()),
      homeTeam,
      awayTeam,
      startTime: fixture?.date ?? new Date().toISOString(),
      status: fixture?.status?.short ?? fixture?.status?.long ?? null,
      homeScore,
      awayScore,
      metadata,
    } satisfies ProviderFixture;
  });
};

interface FootballDataTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
}

interface FootballDataScoreValue {
  home: number | null;
  away: number | null;
}

interface FootballDataScore {
  fullTime?: FootballDataScoreValue | null;
  halfTime?: FootballDataScoreValue | null;
  extraTime?: FootballDataScoreValue | null;
  penalties?: FootballDataScoreValue | null;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: FootballDataScore | null;
  odds?: { msg?: string | null } | null;
  referees?: Array<{
    id?: number;
    name?: string | null;
    type?: string | null;
    nationality?: string | null;
  }> | null;
  area?: { id?: number; name?: string | null; code?: string | null } | null;
  competition?: { id?: number; name?: string | null; code?: string | null } | null;
  season?: {
    id?: number;
    startDate?: string | null;
    endDate?: string | null;
    currentMatchday?: number | null;
  } | null;
}

interface FootballDataResponse {
  filters?: Record<string, unknown> | null;
  resultSet?: Record<string, unknown> | null;
  competition?: Record<string, unknown> | null;
  matches?: FootballDataMatch[] | null;
}

const fetchFootballDataFixtures = async (
  config: ChampionshipProviderConfig,
  _now: Date,
  options: SyncOptions = {},
): Promise<ProviderFixture[]> => {
  const seasonOverride = options?.seasonOverride;
  const season = seasonOverride ?? config.season;

  if (!config.competitionCode) {
    throw new Error("football-data config requires competitionCode");
  }

  const apiKey = (config.apiToken && config.apiToken.trim() !== "")
    ? config.apiToken.trim()
    : ensureEnv("FOOTBALL_DATA_API_KEY", "EDGE_FOOTBALL_DATA_API_KEY");
  const baseUrl = Deno.env.get("FOOTBALL_DATA_BASE_URL") ?? "https://api.football-data.org/v4";

  const params = new URLSearchParams();
  if (season) {
    params.set("season", String(season));
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/competitions/${config.competitionCode}/matches${
    params.size > 0 ? `?${params.toString()}` : ""
  }`;

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "X-Auth-Token": apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`football-data request failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as FootballDataResponse;
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];

  const filters = (payload?.filters ?? {}) as Record<string, unknown>;
  const resultSet = (payload?.resultSet ?? {}) as Record<string, unknown>;

  return matches.map((match) => {
    const score = match.score ?? {};
    const competition = match.competition ?? payload?.competition ?? {};
    const metadata: Record<string, unknown> = {};

    if (match.matchday != null) metadata.matchday = match.matchday;
    if (match.stage) metadata.stage = match.stage;
    if (match.group) metadata.group = match.group;
    if (match.lastUpdated) metadata.lastUpdated = match.lastUpdated;
    if (competition?.code) metadata.competitionCode = competition.code;
    if (competition?.name) metadata.competitionName = competition.name;
    if (match.season?.startDate) metadata.seasonStart = match.season.startDate;
    if (match.season?.endDate) metadata.seasonEnd = match.season.endDate;
    if (match.season?.currentMatchday != null) metadata.currentMatchday = match.season.currentMatchday;
    if (filters?.season) metadata.filterSeason = filters.season;
    if (filters?.matchday) metadata.filterMatchday = filters.matchday;
    if (resultSet?.first) metadata.rangeStart = resultSet.first;
    if (resultSet?.last) metadata.rangeEnd = resultSet.last;
    if (resultSet?.count != null) metadata.rangeCount = resultSet.count;
    if (match.area?.name) metadata.area = match.area.name;
    if (match.odds?.msg) metadata.oddsMessage = match.odds.msg;
    if (Array.isArray(match.referees) && match.referees.length > 0) {
      metadata.referees = match.referees.map((ref) => ({
        id: ref?.id ?? null,
        name: ref?.name ?? null,
        type: ref?.type ?? null,
        nationality: ref?.nationality ?? null,
      }));
    }
    if (match.homeTeam?.crest) {
      metadata.homeCrest = match.homeTeam.crest;
    }
    if (match.awayTeam?.crest) {
      metadata.awayCrest = match.awayTeam.crest;
    }

    const homeScore = pickScoreValue(
      score?.fullTime?.home ?? score?.extraTime?.home ?? score?.penalties?.home ?? null,
    );
    const awayScore = pickScoreValue(
      score?.fullTime?.away ?? score?.extraTime?.away ?? score?.penalties?.away ?? null,
    );

    const homeTeamName = match.homeTeam?.name ?? match.homeTeam?.shortName ?? "Home";
    const awayTeamName = match.awayTeam?.name ?? match.awayTeam?.shortName ?? "Away";

    return {
      id: String(match.id ?? crypto.randomUUID()),
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      startTime: match.utcDate ?? new Date().toISOString(),
      status: match.status ?? null,
      homeScore,
      awayScore,
      metadata,
    } satisfies ProviderFixture;
  });
};

const fetchFixturesForConfig = async (
  leagueId: string,
  config: ChampionshipProviderConfig,
  now: Date,
  options: SyncOptions = {},
): Promise<ProviderFixture[]> => {
  if (config.provider === "mock") {
    return fetchMockFixtures(leagueId);
  }
  if (config.provider === "api-football") {
    return fetchApiFootballFixtures(config, now, options);
  }
  if (config.provider === "football-data") {
    return fetchFootballDataFixtures(config, now, options);
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
};

const syncLeagueMatches = async (
  supabase: SupabaseClient,
  league: LeagueRow,
  config: ChampionshipProviderConfig,
  now: Date,
  options: SyncOptions = {},
): Promise<SyncSummary> => {
  const fixtures = await fetchFixturesForConfig(league.id, config, now, options);

  if (fixtures.length === 0) {
    return {
      leagueId: league.id,
      leagueName: league.name,
      inserted: 0,
      updated: 0,
      skipped: false,
      message: "No fixtures returned by provider",
    };
  }

  const normalizedFixtures: NormalizedFixture[] = fixtures.map((fixture) =>
    normalizeFixture(fixture, now)
  );

  const { data: matchRows, error: matchesError } = await supabase
    .from("league_matches")
    .select("id, external_ref, start_at, status, home_score, away_score, metadata")
    .eq("league_id", league.id);

  if (matchesError) {
    throw new Error(`Failed to load existing matches: ${matchesError.message}`);
  }

  const existingByRef = new Map<string, LeagueMatchRow>();
  (matchRows ?? []).forEach((row: any) => {
    if (row?.external_ref) {
      existingByRef.set(String(row.external_ref), {
        id: row.id,
        external_ref: String(row.external_ref),
        start_at: row.start_at,
        status: row.status,
        home_score: row.home_score,
        away_score: row.away_score,
        metadata: row.metadata ?? null,
      });
    }
  });

  const inserts: ReturnType<typeof buildUpsertPayload>[] = [];
  const updatesBuffer: Array<{ id: string; payload: ReturnType<typeof buildUpsertPayload> }> = [];

  normalizedFixtures.forEach((normalized) => {
    const existing = existingByRef.get(normalized.externalRef);
    const payload = buildUpsertPayload(league.id, normalized, config.provider);

    if (!existing) {
      inserts.push(payload);
      return;
    }

    if (hasMatchChanged(existing, normalized)) {
      updatesBuffer.push({ id: existing.id, payload });
    }
  });

  if (inserts.length > 0) {
    const { error } = await supabase.from("league_matches").insert(inserts);
    if (error) {
      throw new Error(`Failed to insert matches: ${error.message}`);
    }
  }

  for (const entry of updatesBuffer) {
    const { error } = await supabase
      .from("league_matches")
      .update({
        home_team: entry.payload.home_team,
        away_team: entry.payload.away_team,
        start_at: entry.payload.start_at,
        status: entry.payload.status,
        home_score: entry.payload.home_score,
        away_score: entry.payload.away_score,
        metadata: entry.payload.metadata,
      })
      .eq("id", entry.id);

    if (error) {
      throw new Error(`Failed to update match ${entry.id}: ${error.message}`);
    }
  }

  const { error: completionError } = await supabase.rpc("evaluate_league_completion", {
    p_league_id: league.id,
  });

  if (completionError) {
    throw new Error(`Failed to evaluate league completion: ${completionError.message}`);
  }

  return {
    leagueId: league.id,
    leagueName: league.name,
    inserted: inserts.length,
    updated: updatesBuffer.length,
    skipped: false,
  };
};

const authenticateRequest = (req: Request) => {
  const secret = Deno.env.get("SYNC_MATCHES_SECRET");
  if (!secret) {
    return true;
  }

  const normalizedSecret = secret.trim();
  if (normalizedSecret === "") {
    return true;
  }

  const candidateHeaders = [
    req.headers.get("x-sync-secret"),
    req.headers.get("x-benolo-sync-secret"),
    req.headers.get("authorization"),
    req.headers.get("Authorization"),
  ].filter(Boolean) as string[];

  for (const value of candidateHeaders) {
    const trimmed = value.trim();
    if (trimmed === normalizedSecret || trimmed === `Bearer ${normalizedSecret}`) {
      return true;
    }
  }

  return false;
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return respondJson({ error: "Method not allowed" }, 405);
    }

    if (!authenticateRequest(req)) {
      return respondJson({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = ensureEnv("SUPABASE_URL", "EDGE_SUPABASE_URL");
    const supabaseKey = ensureEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "EDGE_SUPABASE_SERVICE_ROLE_KEY",
    );
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const requestUrl = new URL(req.url);
    const paramsIds: string[] = [];

    const leagueIdFromQuery = requestUrl.searchParams.get("leagueId");
    if (leagueIdFromQuery) {
      paramsIds.push(leagueIdFromQuery);
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body?.leagueId === "string") {
      paramsIds.push(body.leagueId);
    }
    if (Array.isArray(body?.leagueIds)) {
      body.leagueIds.forEach((value: unknown) => {
        if (typeof value === "string") {
          paramsIds.push(value);
        }
      });
    }

    const targetIds = Array.from(new Set(paramsIds));

    let leaguesQuery = supabase
      .from("leagues")
      .select("id, name, championship, status")
      .not("championship", "is", null);

    if (targetIds.length > 0) {
      leaguesQuery = leaguesQuery.in("id", targetIds);
    }

    const { data: leagues, error: leaguesError } = await leaguesQuery;

    if (leaguesError) {
      throw new Error(`Failed to fetch leagues: ${leaguesError.message}`);
    }

    const leagueRows: LeagueRow[] = (leagues ?? []) as LeagueRow[];

    if (leagueRows.length === 0) {
      return respondJson({ processed: 0, results: [] });
    }

    const summaries: SyncSummary[] = [];

    for (const league of leagueRows) {
      const config = league.championship
        ? CHAMPIONSHIP_PROVIDER_CONFIG[league.championship]
        : undefined;

      if (!config) {
        summaries.push({
          leagueId: league.id,
          leagueName: league.name,
          inserted: 0,
          updated: 0,
          skipped: true,
          message: `No provider mapping for championship ${league.championship}`,
        });
        continue;
      }

      try {
        const summary = await syncLeagueMatches(supabase, league, config, now);
        summaries.push(summary);
      } catch (error) {
        console.error(`Failed to sync league ${league.id}:`, error);
        summaries.push({
          leagueId: league.id,
          leagueName: league.name,
          inserted: 0,
          updated: 0,
          skipped: true,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return respondJson({ processed: summaries.length, results: summaries });
  } catch (error) {
    console.error("sync-matches edge function failed", error);
    return respondJson({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
