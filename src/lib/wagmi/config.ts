import { base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect based connectors may fail.",
  );
}

const chains = [base] as const;

export const wagmiConfig = getDefaultConfig({
  chains,
  appName: "Benolo",
  projectId,
  ssr: true,
});
