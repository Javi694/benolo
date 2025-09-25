export type MatchStatus = "upcoming" | "live" | "completed";

export interface ProviderFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status?: string | null;
  homeScore?: number | null | undefined;
  awayScore?: number | null | undefined;
  metadata?: Record<string, unknown> | null;
}

export interface NormalizedFixture {
  externalRef: string;
  homeTeam: string;
  awayTeam: string;
  startAt: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  rawStatus?: string | null;
  providerMeta?: Record<string, unknown> | null;
}

export interface ExistingMatchSnapshot {
  start_at: string;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  metadata?: Record<string, unknown> | null;
}

const COMPLETED_MARKERS = new Set([
  "ft",
  "full_time",
  "ended",
  "finished",
  "completed",
  "match_finished",
  "after_pens",
  "pen",
  "aet",
  "final",
  "finalized",
  "terminated",
]);

const LIVE_MARKERS = new Set([
  "live",
  "in_play",
  "inprogress",
  "1h",
  "2h",
  "ht",
  "et",
  "p",
  "pause",
  "paused",
  "halftime",
  "second_half",
  "first_half",
  "extra_time",
  "suspended",
]);

const UPCOMING_MARKERS = new Set([
  "ns",
  "not_started",
  "scheduled",
  "timed",
  "tbd",
  "to_be_defined",
  "postponed",
  "delayed",
  "cancelled",
  "canceled",
]);

const toNumberOrNull = (value: unknown): number | null => {
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

const normalizeIsoString = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return new Date().toISOString();
  }
  return new Date(timestamp).toISOString();
};

export const mapProviderStatus = (
  providerStatus: string | null | undefined,
  startAt: string,
  homeScore: number | null,
  awayScore: number | null,
  now: Date = new Date(),
): MatchStatus => {
  const normalizedStatus = providerStatus?.toLowerCase().trim() ?? null;
  const startTime = Date.parse(startAt);
  const hasFinalScore = homeScore != null && awayScore != null;

  if (normalizedStatus && COMPLETED_MARKERS.has(normalizedStatus)) {
    return "completed";
  }

  if (hasFinalScore && (!normalizedStatus || !UPCOMING_MARKERS.has(normalizedStatus))) {
    return "completed";
  }

  if (normalizedStatus && LIVE_MARKERS.has(normalizedStatus)) {
    return "live";
  }

  const hasStarted = !Number.isNaN(startTime) && startTime <= now.getTime();

  if (hasStarted && !normalizedStatus) {
    return hasFinalScore ? "completed" : "live";
  }

  if (hasStarted && normalizedStatus && !UPCOMING_MARKERS.has(normalizedStatus)) {
    return hasFinalScore ? "completed" : "live";
  }

  return "upcoming";
};

export const normalizeFixture = (
  fixture: ProviderFixture,
  referenceDate: Date = new Date(),
): NormalizedFixture => {
  const homeScore = toNumberOrNull(fixture.homeScore);
  const awayScore = toNumberOrNull(fixture.awayScore);
  const startAt = normalizeIsoString(fixture.startTime);

  return {
    externalRef: fixture.id,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    startAt,
    status: mapProviderStatus(fixture.status, startAt, homeScore, awayScore, referenceDate),
    homeScore,
    awayScore,
    rawStatus: fixture.status ?? null,
    providerMeta: fixture.metadata ?? null,
  };
};

const extractLogo = (metadata: Record<string, unknown> | null | undefined, key: string): string => {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

export const hasMatchChanged = (
  existing: ExistingMatchSnapshot | null | undefined,
  normalized: NormalizedFixture,
): boolean => {
  if (!existing) {
    return true;
  }

  const existingStatus = existing.status ?? "upcoming";
  const existingHomeLogo = extractLogo(existing.metadata ?? null, "homeCrest");
  const existingAwayLogo = extractLogo(existing.metadata ?? null, "awayCrest");
  const normalizedHomeLogo = extractLogo(normalized.providerMeta ?? null, "homeCrest");
  const normalizedAwayLogo = extractLogo(normalized.providerMeta ?? null, "awayCrest");

  return (
    normalizeIsoString(existing.start_at) !== normalized.startAt ||
    existingStatus !== normalized.status ||
    (existing.home_score ?? null) !== (normalized.homeScore ?? null) ||
    (existing.away_score ?? null) !== (normalized.awayScore ?? null) ||
    existingHomeLogo !== normalizedHomeLogo ||
    existingAwayLogo !== normalizedAwayLogo
  );
};

export interface MatchUpsertPayload {
  league_id: string;
  home_team: string;
  away_team: string;
  start_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  external_ref: string;
  metadata: Record<string, unknown>;
}

export const buildUpsertPayload = (
  leagueId: string,
  normalized: NormalizedFixture,
  provider: string,
): MatchUpsertPayload => ({
  league_id: leagueId,
  home_team: normalized.homeTeam,
  away_team: normalized.awayTeam,
  start_at: normalized.startAt,
  status: normalized.status,
  home_score: normalized.homeScore,
  away_score: normalized.awayScore,
  external_ref: normalized.externalRef,
  metadata: {
    provider,
    provider_status: normalized.rawStatus ?? null,
    ...(normalized.providerMeta ?? {}),
  },
});
