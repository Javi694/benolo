import { isAddress } from "viem";

const rawFactory = process.env.NEXT_PUBLIC_LEAGUE_FACTORY_ADDRESS ?? "";
const rawUsdc = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

export const leagueFactoryAddress = isAddress(rawFactory) ? (rawFactory as `0x${string}`) : null;
export const usdcTokenAddress = isAddress(rawUsdc) ? (rawUsdc as `0x${string}`) : null;

if (rawFactory && !leagueFactoryAddress) {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_LEAGUE_FACTORY_ADDRESS invalide");
}

if (rawUsdc && !usdcTokenAddress) {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_USDC_ADDRESS invalide");
}
