#!/usr/bin/env ts-node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computePredictionPoints } from "../src/lib/scoring/points";

dotenv.config({ path: ".env.local" });

type LeagueWithMatches = {
  id: string;
  matches: Array<{ id: string; home_score: number | null; away_score: number | null }>;
};

type PredictionRow = {
  id: number;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  confident: boolean | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchLeaguesWithMatches() {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, league_matches(id, home_score, away_score)")
    .limit(10);

  if (error || !data) {
    console.error(error?.message ?? "Unable to fetch leagues");
    process.exit(1);
  }

  return data as unknown as LeagueWithMatches[];
}

async function fetchPredictions(matchId: string) {
  const { data, error } = await supabase
    .from("league_predictions")
    .select("id, match_id, home_score, away_score, confident")
    .eq("match_id", matchId);

  if (error) {
    console.error(`Unable to fetch predictions for match ${matchId}`, error.message);
    return [];
  }

  return (data ?? []) as PredictionRow[];
}

async function updatePoints() {
  const leagues = await fetchLeaguesWithMatches();
  for (const league of leagues) {
    for (const match of league.matches) {
      if (match.home_score == null || match.away_score == null) {
        continue;
      }

      const predictions = await fetchPredictions(match.id);
      for (const prediction of predictions) {
        const points = computePredictionPoints({
          predictedHome: prediction.home_score,
          predictedAway: prediction.away_score,
          actualHome: match.home_score,
          actualAway: match.away_score,
          confident: Boolean(prediction.confident),
        });
        const { error } = await supabase
          .from("league_predictions")
          .update({ points, status: "submitted" })
          .eq("id", prediction.id);
        if (error) {
          console.error(`Unable to update prediction ${prediction.id}`, error.message);
        } else {
          console.log(`Updated prediction ${prediction.id} with ${points} pts`);
        }
      }
    }
  }
}

void updatePoints().then(() => {
  console.log("Leaderboard recomputed.");
});
