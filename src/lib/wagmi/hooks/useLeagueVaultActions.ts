"use client";

import { useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Address, Hex } from "viem";

import { leagueVaultAbi } from "../abi/leagueVault";

export interface WinnerShareInput {
  account: Address;
  shareBps: number;
}

const encodeShares = (shares: WinnerShareInput[]) =>
  shares.map((share) => ({ account: share.account, shareBps: BigInt(share.shareBps) }));

export const useLeagueVaultActions = (vaultAddress?: Address | null) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const simulateAndSend = useCallback(
    async (functionName: string, args: any[] = []) => {
      if (!vaultAddress) {
        throw new Error("Adresse du vault manquante");
      }
      if (!address) {
        throw new Error("Connecte ton wallet pour continuer");
      }
      if (!publicClient) {
        throw new Error("Client wagmi indisponible");
      }

      const simulation = await publicClient!.simulateContract({
        account: address!,
        address: vaultAddress!,
        abi: leagueVaultAbi,
        functionName,
        args,
      });

      const hash = await writeContractAsync(simulation.request);
      await publicClient!.waitForTransactionReceipt({ hash });
      return hash;
    },
    [address, publicClient, vaultAddress, writeContractAsync],
  );

  const lock = useCallback(async () => simulateAndSend("lock"), [simulateAndSend]);

  const settle = useCallback(
    async (data: Hex = "0x") => simulateAndSend("settle", [data]),
    [simulateAndSend],
  );

  const openClaims = useCallback(async () => simulateAndSend("openClaims"), [simulateAndSend]);

  const claim = useCallback(async () => simulateAndSend("claim"), [simulateAndSend]);

  const claimCommission = useCallback(
    async (to: Address) => simulateAndSend("claimCommission", [to]),
    [simulateAndSend],
  );

  const setWinners = useCallback(
    async (shares: WinnerShareInput[]) => simulateAndSend("setWinners", [encodeShares(shares)]),
    [simulateAndSend],
  );

  return {
    lock,
    settle,
    setWinners,
    openClaims,
    claim,
    claimCommission,
  };
};
