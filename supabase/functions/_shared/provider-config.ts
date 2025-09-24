export type ProviderDriver = "api-football" | "mock";

export interface ChampionshipProviderConfig {
  provider: ProviderDriver;
  leagueId?: number;
  season?: number;
  timezone?: string;
}

export const CHAMPIONSHIP_PROVIDER_CONFIG: Record<string, ChampionshipProviderConfig> = {
  "premier-league": { provider: "api-football", leagueId: 39, season: 2025 },
  "champions-league": { provider: "api-football", leagueId: 2, season: 2025 },
  "la-liga": { provider: "api-football", leagueId: 140, season: 2025 },
  "serie-a": { provider: "api-football", leagueId: 135, season: 2025 },
  "bundesliga": { provider: "api-football", leagueId: 78, season: 2025 },
  "ligue-1": { provider: "api-football", leagueId: 61, season: 2025 },
  nba: { provider: "mock" },
  nfl: { provider: "mock" },
};
