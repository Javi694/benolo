#!/usr/bin/env ts-node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

interface Fixture {
  id: string;
  league: string;
  home: string;
  away: string;
  startTime: string;
}

type LeagueConfig = {
  leagueId: string;
  championship: string;
  providerCode: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const mockFixtures: Fixture[] = [
  {
    id: "fixture-1",
    league: "premier-league",
    home: "Arsenal",
    away: "Chelsea",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "fixture-2",
    league: "premier-league",
    home: "Liverpool",
    away: "Manchester City",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
  },
];

async function fetchFixtures(providerCode: string): Promise<Fixture[]> {
  console.log(`Fetching fixtures for provider ${providerCode} (mock)`);
  return mockFixtures.filter((fixture) => fixture.league === providerCode);
}

async function importFixturesForLeague(config: LeagueConfig) {
  const fixtures = await fetchFixtures(config.providerCode);
  for (const fixture of fixtures) {
    const startAt = new Date(fixture.startTime).toISOString();
    const { error } = await supabase
      .from("league_matches")
      .insert({
        league_id: config.leagueId,
        home_team: fixture.home,
        away_team: fixture.away,
        start_at: startAt,
        status: "upcoming",
        external_ref: fixture.id,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        console.log(`Fixture ${fixture.id} already imported for league ${config.leagueId}`);
      } else {
        console.error(`Failed to insert fixture ${fixture.id}:`, error.message);
      }
    } else {
      console.log(`Imported fixture ${fixture.home} vs ${fixture.away}`);
    }
  }
}

async function main() {
  const targetLeagues: LeagueConfig[] = process.argv.slice(2).map((arg) => {
    const [leagueId, providerCode] = arg.split(":");
    return {
      leagueId,
      championship: providerCode,
      providerCode,
    };
  });

  if (targetLeagues.length === 0) {
    console.error("Usage: ts-node scripts/import-fixtures.ts <leagueId>:<providerCode>");
    process.exit(1);
  }

  for (const config of targetLeagues) {
    await importFixturesForLeague(config);
  }
}

void main();
