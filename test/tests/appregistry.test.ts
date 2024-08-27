import {
  env,
  getChainById,
  getClient,
} from "../lib/utils";
import testEnv from "@infinex/evm-sdk/env/test";
import stagingEnv from "@infinex/evm-sdk/env/staging";
import prodEnv from "@infinex/evm-sdk/env/prod";
import { AppRegistry } from "../lib/abis";
import { describe, expect, test } from "vitest";
import * as viem from "viem";
import { ChainKey } from "@infinex/evm-sdk/src";

// Determine the appropriate environment configuration based on `env`
const getEnvConfig = (env: string) => {
  switch (env) {
    case "testnets":
      return testEnv;
    case "staging":
      return stagingEnv;
    case "mainnets":
      return prodEnv;
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
};

// Define the chain sets for different environments
const chainSets: Record<string, ChainKey[]> = {
  testnets: ["ethereum"], // Only Ethereum for testnets
  staging: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for staging
  mainnets: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for mainnets
};

// Determine the appropriate chain set based on the environment
const appRegistryChains = chainSets[env] || [];

describe.concurrent.each(appRegistryChains)(
  `App Registry (%s ${env})`,
  async (chainName) => {
    const client = getClient(chainName);
    const chainId = await client.getChainId();
    const chain = getChainById(chainId);
    const networkName = chain.name.toLowerCase().replace(" ", "-");

    // Load the environment-specific configuration
    const envConfig = getEnvConfig(env);

    // Get the correct address based on the chainId
    const appRegistryAddress = {
      42161: envConfig.ARBITRUM_APP_REGISTRY_ADDRESS,
      8453: envConfig.BASE_APP_REGISTRY_ADDRESS,
      1: envConfig.ETHEREUM_APP_REGISTRY_ADDRESS,
      10: envConfig.OPTIMISM_APP_REGISTRY_ADDRESS,
      137: envConfig.POLYGON_APP_REGISTRY_ADDRESS,
      421614: envConfig.ARBITRUM_APP_REGISTRY_ADDRESS,
      84532: envConfig.BASE_APP_REGISTRY_ADDRESS,
      11155111: envConfig.ETHEREUM_APP_REGISTRY_ADDRESS,
      11155420: envConfig.OPTIMISM_APP_REGISTRY_ADDRESS,
      80002: envConfig.POLYGON_APP_REGISTRY_ADDRESS,
    }[chainId];

    const curveAppBeacon = {
      42161: envConfig.ARBITRUM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      8453: envConfig.BASE_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      1: envConfig.ETHEREUM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      10: envConfig.OPTIMISM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      137: envConfig.POLYGON_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      421614: envConfig.ARBITRUM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      84532: envConfig.BASE_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      11155111: envConfig.ETHEREUM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      11155420: envConfig.OPTIMISM_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
      80002: envConfig.POLYGON_CURVE_STABLE_SWAP_APP_BEACON_ADDRESS,
    }[chainId];

    // Check if address is available for the current network
    if (!appRegistryAddress) {
      throw new Error(
        `No App Registry address found for network: ${networkName}`
      );
    }

    const appRegistry = viem.getContract({
      address: appRegistryAddress,
      abi: AppRegistry,
      client,
    });

    // Define allowed apps per environment
    const allowedApps: `0x${string}`[] = [];
    allowedApps.push(curveAppBeacon!);

    test("App Registry has all allowed apps set", async () => {
      for (const app of allowedApps) {
        const isAuthorized: boolean = await appRegistry.read.appBeacons([app]);
        expect(isAuthorized).toBe(true);
      }
    });
  }
);
