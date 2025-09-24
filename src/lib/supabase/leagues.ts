"use client";

import { supabaseBrowserClient } from "./client";

export async function updateLeagueVaultAddress(leagueId: string, vaultAddress: string) {
  if (!supabaseBrowserClient) {
    throw new Error("Supabase non configuré côté client");
  }

  const { error } = await supabaseBrowserClient
    .from("leagues")
    .update({ vault_address: vaultAddress })
    .eq("id", leagueId);

  if (error) {
    throw error;
  }
}

export async function deleteLeagueById(leagueId: string) {
  if (!supabaseBrowserClient) {
    throw new Error("Supabase non configuré côté client");
  }

  const { error } = await supabaseBrowserClient.from("leagues").delete().eq("id", leagueId);
  if (error) {
    throw error;
  }
}

interface LogTransactionPayload {
  leagueId: string;
  action: string;
  txHash: string;
  walletAddress?: string;
  chainId?: number;
  metadata?: Record<string, unknown>;
}

export async function logLeagueTransaction(payload: LogTransactionPayload) {
  if (!supabaseBrowserClient) {
    throw new Error("Supabase non configuré côté client");
  }

  const { error } = await supabaseBrowserClient.functions.invoke("log-transaction", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message ?? "Échec de la journalisation de la transaction");
  }
}
