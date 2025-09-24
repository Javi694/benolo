#!/usr/bin/env ts-node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computePredictionPoints } from "../src/lib/scoring/points";

dotenv.config({ path: ".env.local" });

type LeaguePredictionRow = {
  league_id: string;
  user_id: string;
  home_score: number | null;
  away_score: number | null;
  match_id: string;
  confident: boolean | null;
};

type MatchRow = {
  id: string;
  home_score: number | null;
  away_score: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function computeLeaderboard(leagueId: string) {
  const { data: matches, error: matchesError } = await supabase
    .from("league_matches")
    .select("id, home_score, away_score")
    .eq("league_id", leagueId);

  if (matchesError || !matches) {
    console.error("Unable to fetch matches", matchesError?.message);
    return;
  }

  const matchesMap = new Map<string, MatchRow>();
  matches.forEach((row) => matchesMap.set(row.id, row as MatchRow));

  const { data: predictions, error: predictionsError } = await supabase
    .from("league_predictions")
    .select("match_id, league_id, user_id, home_score, away_score, confident")
    .eq("league_id", leagueId);

  if (predictionsError || !predictions) {
    console.error("Unable to fetch predictions", predictionsError?.message);
    return;
  }

  const totals = new Map<string, number>();
  predictions.forEach((predictionRow) => {
    const match = matchesMap.get(predictionRow.match_id);
    const points = computePredictionPoints({
      predictedHome: predictionRow.home_score,
      predictedAway: predictionRow.away_score,
      actualHome: match?.home_score,
      actualAway: match?.away_score,
      confident: Boolean(predictionRow.confident),
    });
    const current = totals.get(predictionRow.user_id) ?? 0;
    totals.set(predictionRow.user_id, current + points);
  });

  const leaderboard = Array.from(totals.entries())
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score);

  console.log(`Leaderboard for league ${leagueId}`);
  console.table(leaderboard);
}

async function main() {
  const leagueId = process.argv[2];
  if (!leagueId) {
    console.error("Usage: ts-node scripts/compute-leaderboard.ts <leagueId>");
    process.exit(1);
  }

  await computeLeaderboard(leagueId);
}

void main();
