import {
  env,
  getChainById,
  getClient,
  getNetworkName,
  loadToml,
  officialUSDCAddress,
} from "../lib/utils";
import {env as sdkEnv, EvmChainKey} from "@infinex/evm-sdk";
import { CurveStableSwapAppBeaconAbi } from "../lib/abis";
import { describe, expect, test } from "vitest";
import * as viem from "viem";

const {dev: testEnv, staging: stagingEnv, prod: prodEnv} = sdkEnv;

// Hardcoded addresses for assertions
const hardcodedAddresses: Record<string, Record<number, `0x${string}`>> = {
  factory: {
    42161: "0x9AF14D26075f142eb3F292D5065EB3faa646167b",
    8453: "0xd2002373543Ce3527023C75e7518C274A51ce712",
    1: "0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf",
    10: "0x5eeE3091f747E60a045a2E715a4c71e600e31F6E",
    137: "0x1764ee18e8B3ccA4787249Ceb249356192594585",
    11155111: "0xfb37b8D939FFa77114005e61CFc2e543d6F49A81",
  },
};

// Define supported pools for different environments and chains
const supportedPools: Record<string, Record<number, `0x${string}`[]>> = {
  testnets: {
    11155111: [
      "0xeEf7894341be733c8D8805c54C369E1297e3c86e", // USDC-USDEToken
      "0xF937A1E8f0D6b1B5133351a28cA42bbA3d56BFa4", // USDCToken - USDEToken
    ],
  },
  staging: {
    1: ["0x02950460E2b9529D0E00284A5fA2d7bDF3fA4d72"], // USDC-USDe
    42161: ["0x1c34204FCFE5314Dcf53BE2671C02c35DB58B4e3"], // USDC-USDe
  },
  mainnets: {
    1: ["0x02950460E2b9529D0E00284A5fA2d7bDF3fA4d72"], // USDC-USDe
    42161: ["0x1c34204FCFE5314Dcf53BE2671C02c35DB58B4e3"], // USDC-USDe
  },
};

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
const chainSets: Record<string, EvmChainKey[]> = {
  testnets: ["ethereum"], // Only Ethereum for testnets
  staging: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for staging
  mainnets: ["ethereum", "arbitrum"], // Ethereum and Arbitrum for mainnets
};

// Determine the appropriate chain set based on the environment
const appRegistryChains = chainSets[env] || [];

describe.concurrent.each(appRegistryChains)(
  `Curve App (%s ${env})`,
  async (chainName) => {
    const client = getClient(chainName);
    const chainId = await client.getChainId();
    const chain = getChainById(chainId);
    // const networkName = chain.name.toLowerCase().replace(" ", "-");
    const networkName = await getNetworkName(client);
    const configDir = `../infinex-multichain/${env}`;
    var config: any;

    if (env === "mainnets") {
      config = await loadToml(
        `${configDir}/infinex-curve-app.${networkName}.toml`
      );
    } else {
      config = await loadToml(      
        `${configDir}/infinex-curve-app-test.${networkName}.toml`
      );
    }

    // Load the environment-specific configuration
    const envConfig = getEnvConfig(env);

    const curveAppBeaconAddress = {
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
    if (!curveAppBeaconAddress) {
      throw new Error(
        `No Curve App Beacon address found for network: ${networkName}`
      );
    }

    const curveAppBeacon = viem.getContract({
      address: curveAppBeaconAddress,
      abi: CurveStableSwapAppBeaconAbi,
      client,
    });

    const factory = hardcodedAddresses.factory[chainId];
    const pools = supportedPools[env][chainId] || [];

    test("Curve app beacon has right USDC set", async () => {
      const beaconUSDC = await curveAppBeacon.read.USDC();
      expect(beaconUSDC).toBe(officialUSDCAddress(chainId));
    });

    test("Curve app beacon has right owner set", async () => {
      const owner = await curveAppBeacon.read.owner();
      const deployVars = config.var.Deploy;
      if (env !== "testnets") {
        expect(deployVars.MULTISIG).toBeTypeOf("string");
      }
      const expectedOwner = deployVars.MULTISIG ?? deployVars.DEPLOYER;
      expect(owner).toBe(expectedOwner);
    });

    test("Curve app beacon has right factory set", async () => {
      const beaconFactory =
        await curveAppBeacon.read.curveStableswapFactoryNG();
      expect(beaconFactory).toBe(factory);
    });

    test("Curve app beacon has supported pools set", async () => {
      for (const pool of pools) {
        expect(await curveAppBeacon.read.isSupportedPool([pool])).toBe(true);
      }
    });
  }
);
