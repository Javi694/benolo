export type ProviderDriver = "api-football" | "football-data" | "mock";

export interface ChampionshipProviderConfig {
  provider: ProviderDriver;
  leagueId?: number;
  competitionCode?: string;
  season?: number;
  timezone?: string;
  apiToken?: string;
}

export const CHAMPIONSHIP_PROVIDER_CONFIG: Record<string, ChampionshipProviderConfig> = {
  "premier-league": { provider: "api-football", leagueId: 39, season: 2025 },
  "champions-league": {
    provider: "football-data",
    competitionCode: "CL",
    season: 2025,
    apiToken: "c59106a6fdba48e297233264838fa836",
  },
  "la-liga": { provider: "api-football", leagueId: 140, season: 2025 },
  "serie-a": { provider: "api-football", leagueId: 135, season: 2025 },
  "bundesliga": { provider: "api-football", leagueId: 78, season: 2025 },
  "ligue-1": {
    provider: "football-data",
    competitionCode: "FL1",
    season: 2025,
    apiToken: "c59106a6fdba48e297233264838fa836",
  },
  nba: { provider: "mock" },
  nfl: { provider: "mock" },
};
