#!/usr/bin/env ts-node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

type LeagueRow = {
  id: string;
  name: string;
  championship: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const championshipMockMatches: Record<string, Array<{ home: string; away: string; daysFromNow: number }>> = {
  "premier-league": [
    { home: "Arsenal", away: "Chelsea", daysFromNow: 2 },
    { home: "Liverpool", away: "Manchester City", daysFromNow: 5 },
  ],
  "champions-league": [
    { home: "Real Madrid", away: "Bayern", daysFromNow: 3 },
    { home: "PSG", away: "Barcelona", daysFromNow: 7 },
  ],
};

const fallbackMatches = [
  { home: "Demo Home", away: "Demo Away", daysFromNow: 2 },
  { home: "Placeholder", away: "Sample", daysFromNow: 4 },
];

async function seedMatches(league: LeagueRow) {
  const blueprint = championshipMockMatches[league.championship ?? ""] ?? fallbackMatches;

  for (const match of blueprint) {
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + match.daysFromNow);

    const { error } = await supabase
      .from("league_matches")
      .insert({
        league_id: league.id,
        home_team: match.home,
        away_team: match.away,
        start_at: startAt.toISOString(),
        status: "upcoming",
      });

    if (error) {
      console.error(`Failed to insert match for league ${league.name}:`, error.message);
    } else {
      console.log(`Added ${match.home} vs ${match.away} to ${league.name}`);
    }
  }
}

async function main() {
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name, championship")
    .limit(5);

  if (error || !leagues) {
    console.error("Unable to load leagues:", error?.message ?? "unknown error");
    process.exit(1);
  }

  for (const league of leagues as LeagueRow[]) {
    await seedMatches(league);
  }
}

void main().then(() => {
  console.log("Done seeding matches");
});
