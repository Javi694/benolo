import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables manquantes pour log-transaction");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Payload JSON invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const leagueId = payload.leagueId as string | undefined;
  const action = payload.action as string | undefined;
  const txHash = payload.txHash as string | undefined;
  const walletAddress = payload.walletAddress as string | undefined;
  const chainId = payload.chainId as number | undefined;
  const metadata = payload.metadata as Record<string, unknown> | undefined;

  if (!leagueId || !action || !txHash) {
    return new Response(JSON.stringify({ error: "leagueId, action et txHash sont obligatoires" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase non configuré" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const { error } = await supabase.from("league_transactions").insert({
    league_id: leagueId,
    action,
    tx_hash: txHash,
    wallet_address: walletAddress ?? null,
    chain_id: chainId ?? null,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("log-transaction::insert", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
