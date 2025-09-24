"use client";

import { useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Address, Hex } from "viem";

import { leagueFactoryAbi } from "../abi/leagueFactory";

export interface CreateLeagueContractParams {
  leagueId: Hex;
  creator: Address;
  asset: Address;
  entryAmount: bigint;
  exitPenaltyBps: number;
  commissionBps: number;
  strategyId: Hex;
  canEarlyExit: boolean;
}

export interface CreateLeagueArgs {
  factoryAddress: Address;
  params: CreateLeagueContractParams;
}

export interface CreateLeagueResult {
  hash: Hex;
  vaultAddress: Address;
}

export const useLeagueFactoryCreate = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const createLeague = useCallback(
    async ({ factoryAddress, params }: CreateLeagueArgs): Promise<CreateLeagueResult> => {
      if (!address) {
        throw new Error("Wallet non connectée");
      }

      if (!publicClient) {
        throw new Error("Client wagmi non initialisé");
      }

      const simulation = await publicClient.simulateContract({
        account: address,
        address: factoryAddress,
        abi: leagueFactoryAbi,
        functionName: "createLeague",
        args: [params],
      });

      const hash = await writeContractAsync(simulation.request);

      await publicClient.waitForTransactionReceipt({ hash });

      return {
        hash,
        vaultAddress: simulation.result,
      };
    },
    [address, publicClient, writeContractAsync],
  );

  return { createLeague };
};
