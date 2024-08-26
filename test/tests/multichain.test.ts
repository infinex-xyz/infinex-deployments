import {
  Client,
  env,
  evmChains,
  EvmChains,
  getChainById,
  getClient,
  loadAddresses,
  loadToml,
  platformConfig,
} from "../lib/utils";
import {
  AccountFactoryAbi,
  AppRegistryAbi,
  CurveStableSwapAppBeaconAbi,
  Erc20Abi,
  InfinexERC2771ForwarderAbi,
  InfinexProtocolConfigBeaconAbi,
} from "../lib/abis";
import { describe, expect, test } from "vitest";
import * as viem from "viem";

async function getNetworkName(client: Client): Promise<string> {
  const chainId = await client.getChainId();
  const chain = getChainById(chainId);
  const name = chain.name.toLowerCase().replace(/ /g, "-");
  if (name === "op-mainnet") return "optimism";
  if (name === "arbitrum-one") return "arbitrum";
  if (name.startsWith("op-")) return name.replace("op-", "optimism-");
  if (name.startsWith("matic")) return name.replace("matic", "polygon");
  if (name.endsWith("-mainnet")) return name.replace("-mainnet", "");
  if (name === "mainnet") return "ethereum";
  return name;
}

describe.concurrent.each(Object.keys(evmChains))(
  `Multichain (%s ${env})`,
  async (chain) => {
    const CHAIN = chain.toUpperCase();
    const client = getClient(chain as EvmChains);
    const networkName = await getNetworkName(client);
    const configDir = `../infinex-multichain/${env}`;

    const addresses = await loadAddresses(`${configDir}/ADDRESSES.txt`);
    function getContract<Abi extends viem.Abi>(varName: string, abi: Abi) {
      const address = viem.getAddress(addresses[varName]);
      return viem.getContract({ address, abi, client });
    }
    const accountFactory = getContract(
      `${CHAIN}_ACCOUNT_FACTORY_ADDRESS`,
      AccountFactoryAbi
    );
    const appRegistry = getContract(`${CHAIN}_APP_REGISTRY`, AppRegistryAbi);
    const forwarder = getContract(
      `${CHAIN}_FORWARDER_ADDRESS`,
      InfinexERC2771ForwarderAbi
    );
    const protocolConfigBeacon = getContract(
      `${CHAIN}_INFINEX_PROTOCOL_CONFIG_BEACON_ADDRESS`,
      InfinexProtocolConfigBeaconAbi
    );

    function getAddress(varName: string): `0x${string}` | undefined {
      const value = addresses[varName];
      if (!value) return undefined;
      return viem.getAddress(value);
    }
    const accountsRouterV1Address = getAddress(
      `${CHAIN}_ACCOUNTS_ROUTER_V1_ADDRESS`
    );
    const accountsRouterV2Address = getAddress(
      `${CHAIN}_ACCOUNTS_ROUTER_V2_ADDRESS`
    );

    const config = await loadToml(
      `${configDir}/infinex-multichain-${networkName}.toml`
    );

    async function isContract(address: `0x${string}`): Promise<boolean> {
      return (await client.getCode({ address })) !== "0x";
    }

    async function checkUSDCAddress(address: `0x${string}`) {
      const USDC = viem.getContract({ address, abi: Erc20Abi, client });
      expect(await USDC.read.symbol()).toBe("USDC");
    }

    test("Account factory is a deployed contract", async () => {
      expect(await isContract(accountFactory.address)).toBe(true);
    });

    test("Account factory can predict address", async () => {
      expect(await accountFactory.read.canPredictAddress()).toBe(true);
    });

    test("Account factory can create account", async () => {
      expect(await accountFactory.read.canCreateAccount()).toBe(true);
    });

    test("Account factory has been promoted to latest", async () => {
      const latestAddress =
        await protocolConfigBeacon.read.getLatestAccountImplementation();
      expect(accountFactory.address).toBe(latestAddress);
    });

    test("Account factory uses latest beacon", async () => {
      const beaconAddress =
        await accountFactory.read.infinexProtocolConfigBeacon();
      expect(await isContract(beaconAddress)).toBe(true);
      const beacon = viem.getContract({
        address: beaconAddress,
        abi: InfinexProtocolConfigBeaconAbi,
        client,
      });
      const latestAddress =
        await beacon.read.getLatestInfinexProtocolConfigBeacon();
      expect(latestAddress).toBe(beaconAddress);
    });

    test("Forwarder is a deployed contract", async () => {
      expect(await isContract(forwarder.address)).toBe(true);
    });

    test("Forwarder is valid", async () => {
      const { domain } = await client.getEip712Domain({
        address: forwarder.address,
      });
      const chainId = await client.getChainId();
      expect(domain.name).toBe("InfinexERC2771Forwarder");
      expect(domain.chainId).toBe(chainId);
      expect(await isContract(domain.verifyingContract));
    });

    test("Accounts router v1 is a deployed contract", async ({ skip }) => {
      // FIXME: we're missing some of these addresses from config
      if (!accountsRouterV1Address) {
        skip();
        // skip() doesn't return, but this makes TypeScript happy
        return;
      }
      expect(await isContract(accountsRouterV1Address)).toBe(true);
    });

    test("Accounts router v2 is a deployed contract", async ({ skip }) => {
      // FIXME: we're missing some of these addresses from config
      if (!accountsRouterV2Address) {
        skip();
        // skip() doesn't return, but this makes TypeScript happy
        return;
      }
      expect(await isContract(accountsRouterV2Address)).toBe(true);
    });

    test("Protocol config beacon is a deployed contract", async () => {
      expect(await isContract(protocolConfigBeacon.address)).toBe(true);
    });

    test("Protocol config beacon has revenue pool from config", async () => {
      const revenuePoolAddress =
        config.var.Deploy.REVENUE_POOL ?? config.var.deploy.REVENUE_POOL;
      expect(await protocolConfigBeacon.read.revenuePool()).toBe(
        revenuePoolAddress
      );
    });

    test("Protocol config beacon points to valid USDC contract", async () => {
      const USDCAddress = await protocolConfigBeacon.read.USDC();
      await checkUSDCAddress(USDCAddress);
    });

    test("Protocol config beacon points to valid app registry contract", async () => {
      const address = await protocolConfigBeacon.read.appRegistry();
      expect(await isContract(address)).toBe(true);
      const contract = viem.getContract({
        address,
        abi: AppRegistryAbi,
        client,
      });
      const owner = await contract.read.owner();
      expect(viem.isAddress(owner)).toBe(true);
    });

    test("Protocol config beacon recognises recovery keeper address from Platform app", async () => {
      const keeperAddress = platformConfig.recoveryKeeperAddress;
      expect(
        await protocolConfigBeacon.read.isTrustedRecoveryKeeper([keeperAddress])
      ).toBe(true);
    });

    test("Protocol config beacon has been promoted to latest", async () => {
      const latestAddress =
        await protocolConfigBeacon.read.getLatestInfinexProtocolConfigBeacon();
      expect(protocolConfigBeacon.address).toBe(latestAddress);
    });

    test("App registry is a deployed contract", async () => {
      expect(await isContract(appRegistry.address)).toBe(true);
    });

    test("App registry owner matches config", async () => {
      const owner = await appRegistry.read.owner();
      const deployVars = config.var.Deploy;
      if (env === "mainnets") {
        expect(deployVars.MULTI_SIG).toBeTypeOf("string");
      }
      const expectedOwner = deployVars.MULTI_SIG ?? deployVars.DEPLOYER;
      expect(owner).toBe(expectedOwner);
    });

    test("App registry has no pending owner", async () => {
      const pending = await appRegistry.read.pendingOwner();
      expect(pending).toMatch(/^0x0+/);
    });
  }
);
