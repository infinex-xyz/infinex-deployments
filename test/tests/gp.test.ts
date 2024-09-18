import { describe, expect, test } from "vitest";
import { EvmChainKey } from "@infinex/evm-sdk";

import {
  env,
  getContractSDK,
  getEnvConfig,
  getClient,
  getNetworkName,
} from "../lib/utils";

import { GovernancePoints, GPDistributor } from "../lib/abis";

// Define the chain sets for different environments
const chainSets: Record<string, EvmChainKey[]> = {
  testnets: ["base"], // Only Base for testnets
  staging: ["base"], // Base for staging
  mainnets: ["base"], // Base for mainnets
};

function multisigAddress(env: string): `0x${string}` {
  const multisig: Record<string, `0x${string}`> = {
    mainnets: "0x7299aF061A210157f7AcaEaDa22534ae3b72C956",
    staging: "0x715453251C2FA71cbA3F9159e4862D01D016b579",
    testnets: "0x6298551D56F825B3b6c3350D32129Ffd3cFb198C",
  };
  return multisig[env];
}

function keeperAddress(env: string): `0x${string}` {
  const keeper: Record<string, `0x${string}`> = {
    mainnets: "0x6876Ee98388035240A22C1a2d99D1aE8609A3a56",
    staging: "0x62CC9F28Be32ccFDac3826316E65C2E2B0836D17",
    testnets: "0x6298551D56F825B3b6c3350D32129Ffd3cFb198C",
  };
  return keeper[env];
}

const DEPLOYER = "0x6298551D56F825B3b6c3350D32129Ffd3cFb198C";

// Determine the appropriate chain set based on the environment
const appRegistryChains = chainSets[env] || [];

describe.concurrent.each(Object.values(appRegistryChains))(
  `GovernancePoints (%s ${env})`,
  async (chainName) => {
    const CHAIN = chainName.toUpperCase();
    const client = getClient(chainName);

    // Load the environment-specific configuration
    const envConfig = getEnvConfig(env);

    const gpProxy = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_GOVERNANCE_POINTS_PROXY_ADDRESS`,
      GovernancePoints
    );

    const gpDistributor = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_GP_DISTRIBUTOR_ADDRESS`,
      GPDistributor
    );

    async function isContract(address: `0x${string}`): Promise<boolean> {
      return (await client.getCode({ address })) !== "0x";
    }

    describe("GovernancePoints", () => {
      test("is a deployed contract", async () => {
        expect(await isContract(gpProxy.address)).toBe(true);
      });

      test("has the correct ERC20 implementation", async () => {
        expect(await gpProxy.read.symbol()).toBe(
          env === "testnets" ? "Infinex Governance Points" : "XGP"
        );
        expect(await gpProxy.read.name()).toBe("Infinex Governance Points");
        expect(await gpProxy.read.decimals()).toBe(18);
      });

      test("has authorised transfers only enabled", async () => {
        expect(await gpProxy.read.isAuthorisedTransfersOnlyEnabled()).toBe(
          true
        );
      });

      test("has the correct authorised minter", async () => {
        const expectedMinter =
          env === "testnets" ? DEPLOYER : multisigAddress(env);
        expect(await gpProxy.read.isAuthorisedMinter([expectedMinter])).toBe(
          true
        );
      });

      test("has the GPDistributor added as an authorised transferrer", async () => {
        expect(
          await gpProxy.read.isAuthorisedTransferer([gpDistributor.address])
        ).toBe(true);
      });

      test("has the correct owner", async () => {
        const owner = await gpProxy.read.owner();
        const expectedOwner = multisigAddress(env);
        expect(owner).toBe(expectedOwner);
      });
    });

    describe("GPDistributor", () => {
      test("is a deployed contract", async () => {
        expect(await isContract(gpDistributor.address)).toBe(true);
      });

      test("has the correct owner", async () => {
        const owner = await gpDistributor.read.owner();
        const expectedOwner = multisigAddress(env);
        expect(owner).toBe(expectedOwner);
      });

      test("has the correct GPToken address", async () => {
        expect(await gpDistributor.read.GPToken()).toBe(gpProxy.address);
      });

      test("has the correct authorised keeper", async () => {
        const expectedKeeper = keeperAddress(env);
        expect(
          await gpDistributor.read.authorizedKeepers([expectedKeeper])
        ).toBe(true);
      });
    });
  }
);
