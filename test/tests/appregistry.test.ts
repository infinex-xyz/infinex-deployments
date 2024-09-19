import {
  env,
  getAddressSDK,
  getChainById,
  getClient,
  getContractSDK,
  getEnvConfig,
} from "../lib/utils";
import { AppRegistry } from "../lib/abis";
import { describe, expect, test } from "vitest";
import { EvmChainKey } from "@infinex/evm-sdk";

// Define the chain sets for different environments
const chainSets: Record<string, EvmChainKey[]> = {
  testnets: ["ethereum"], // Only Ethereum for testnets
  staging: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for staging
  mainnets: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for mainnets
};

// Determine the appropriate chain set based on the environment
const appRegistryChains = chainSets[env] || [];

describe.concurrent.each(appRegistryChains)(
  `App Registry (%s ${env})`,
  async (chainName) => {
    const CHAIN = chainName.toUpperCase();
    const client = getClient(chainName);

    // Load the environment-specific configuration
    const envConfig = getEnvConfig(env);

    const appRegistry = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_APP_REGISTRY_ADDRESS`,
      AppRegistry
    );
    const curveAppBeaconAddress = getAddressSDK(
      envConfig,
      `${CHAIN}_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS`
    );

    // Define allowed apps per environment
    const allowedApps: `0x${string}`[] = [];
    allowedApps.push(curveAppBeaconAddress!);

    test("App Registry has all allowed apps set", async () => {
      for (const app of allowedApps) {
        const isAuthorized: boolean = await appRegistry.read.appBeacons([app]);
        expect(isAuthorized).toBe(true);
      }
    });
  }
);
