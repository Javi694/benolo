#!/usr/bin/env ts-node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function triggerSync(leagueId: string) {
  console.log(`Triggering sync for league ${leagueId}...`);
  const { data, error } = await supabase.functions.invoke("sync-matches", {
    body: { leagueId },
  });

  if (error) {
    console.error(`Failed to sync league ${leagueId}:`, error.message);
    return;
  }

  console.log(`Sync completed for ${leagueId}`, data ?? {});
}

async function main() {
  const leagueIds = process.argv.slice(2);

  if (leagueIds.length === 0) {
    console.error("Usage: ts-node scripts/import-fixtures.ts <league-id> [<league-id> ...]");
    process.exit(1);
  }

  for (const leagueId of leagueIds) {
    await triggerSync(leagueId);
  }
}

void main();
