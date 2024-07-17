import {
  env,
  evmChains,
  EvmChains,
  getProvider,
  loadAddresses,
  loadToml,
  platformConfig,
} from "../lib/utils";
import {
  accountFactoryAbi,
  appRegistryAbi,
  curveStableswapAppBeaconAbi,
  erc20Abi,
  forwarderAbi,
  protocolConfigBeaconAbi,
} from "../lib/abis";
import { describe, expect, test } from "vitest";
import { ethers } from "ethers";

async function getNetworkName(provider: ethers.Provider): Promise<string> {
  const name = (await provider.getNetwork()).name;
  if (name.startsWith("matic")) return name.replace("matic", "polygon");
  if (name === "mainnet") return "ethereum";
  return name;
}

describe.concurrent.each(Object.keys(evmChains))(
  `Multichain (%s ${env})`,
  async (chain) => {
    const CHAIN = chain.toUpperCase();
    const provider = getProvider(chain as EvmChains);
    const networkName = await getNetworkName(provider);
    const configDir = `../infinex-multichain/${env}`;

    const addresses = await loadAddresses(`${configDir}/ADDRESSES.txt`);
    const accountFactoryAddress = addresses[`${CHAIN}_ACCOUNT_FACTORY_ADDRESS`];
    const forwarderAddress = addresses[`${CHAIN}_FORWARDER_ADDRESS`];
    const accountsRouterV1Address =
      addresses[`${CHAIN}_ACCOUNTS_ROUTER_V1_ADDRESS`];
    const accountsRouterV2Address =
      addresses[`${CHAIN}_ACCOUNTS_ROUTER_V2_ADDRESS`];
    const appRegistryAddress = addresses[`${CHAIN}_APP_REGISTRY`];
    const curveStableswapAppBeaconAddress =
      addresses[`${CHAIN}_CURVE_STABLESWAP_APP_BEACON`];
    const protocolConfigBeaconAddress =
      addresses[`${CHAIN}_INFINEX_PROTOCOL_CONFIG_BEACON_ADDRESS`];

    const accountFactory = new ethers.Contract(
      accountFactoryAddress,
      accountFactoryAbi,
      provider,
    );
    const appRegistry = new ethers.Contract(
      appRegistryAddress,
      appRegistryAbi,
      provider,
    );
    const curveStableswapAppBeacon = new ethers.Contract(
      curveStableswapAppBeaconAddress,
      curveStableswapAppBeaconAbi,
      provider,
    );
    const forwarder = new ethers.Contract(
      forwarderAddress,
      forwarderAbi,
      provider,
    );
    const protocolConfigBeacon = new ethers.Contract(
      protocolConfigBeaconAddress,
      protocolConfigBeaconAbi,
      provider,
    );

    const appsConfig = await loadToml(
      `${configDir}/infinex-multichain-apps-${networkName}.toml`,
    );

    const config = await loadToml(
      `${configDir}/infinex-multichain-${networkName}.toml`,
    );

    async function isContract(address: string): Promise<boolean> {
      return (await provider.getCode(address)) !== "0x";
    }

    async function checkUSDCAddress(address: string) {
      const USDC = new ethers.Contract(address, erc20Abi, provider);
      expect(await USDC.symbol()).toBe("USDC");
    }

    test("Account factory is a deployed contract", async () => {
      expect(await isContract(accountFactoryAddress)).toBe(true);
    });

    test("Account factory can predict address", async () => {
      expect(await accountFactory.canPredictAddress()).toBe(true);
    });

    test("Account factory can create account", async () => {
      expect(await accountFactory.canCreateAccount()).toBe(true);
    });

    test("Account factory has been promoted to latest", async () => {
      const latestAddress =
        await protocolConfigBeacon.getLatestAccountImplementation();
      expect(accountFactoryAddress).toBe(latestAddress);
    });

    test("Account factory uses latest beacon", async () => {
      const beaconAddress = await accountFactory.infinexProtocolConfigBeacon();
      expect(await isContract(beaconAddress)).toBe(true);
      const beacon = new ethers.Contract(
        beaconAddress,
        protocolConfigBeaconAbi,
        provider,
      );
      const latestAddress = await beacon.getLatestInfinexProtocolConfigBeacon();
      expect(latestAddress).toBe(beaconAddress);
    });

    test("Forwarder is a deployed contract", async () => {
      expect(await isContract(forwarderAddress)).toBe(true);
    });

    test("Forwarder is valid", async () => {
      const domain = await forwarder.eip712Domain();
      const chainId = (await provider.getNetwork()).chainId;
      expect(domain.name).toBe("InfinexERC2771Forwarder");
      expect(domain.chainId).toBe(chainId);
      const verifyingContractAddress = domain.verifyingContract;
      expect(await isContract(verifyingContractAddress));
    });

    test("Accounts router v1 is a deployed contract", async ({ skip }) => {
      // FIXME: we're missing some of these addresses from config
      if (!accountsRouterV1Address) skip();
      expect(await isContract(accountsRouterV1Address)).toBe(true);
    });

    test("Accounts router v2 is a deployed contract", async ({ skip }) => {
      // FIXME: we're missing some of these addresses from config
      if (!accountsRouterV2Address) skip();
      expect(await isContract(accountsRouterV2Address)).toBe(true);
    });

    test("Protocol config beacon is a deployed contract", async () => {
      expect(await isContract(protocolConfigBeaconAddress)).toBe(true);
    });

    test("Protocol config beacon has revenue pool from config", async () => {
      const revenuePoolAddress =
        appsConfig.var.Deploy.REVENUE_POOL ?? config.var.deploy.REVENUE_POOL;
      expect(await protocolConfigBeacon.revenuePool()).toBe(revenuePoolAddress);
    });

    test("Protocol config beacon points to valid USDC contract", async () => {
      const USDCAddress = await protocolConfigBeacon.USDC();
      await checkUSDCAddress(USDCAddress);
    });

    test("Protocol config beacon points to valid app registry contract", async () => {
      const address = await protocolConfigBeacon.appRegistry();
      expect(await isContract(address)).toBe(true);
      const contract = new ethers.Contract(address, appRegistryAbi, provider);
      const owner = await contract.owner();
      expect(ethers.isAddress(owner)).toBe(true);
    });

    test("Protocol config beacon recognises recovery keeper address from Platform app", async () => {
      const keeperAddress = platformConfig.recoveryKeeperAddress;
      expect(
        await protocolConfigBeacon.isTrustedRecoveryKeeper(keeperAddress),
      ).toBe(true);
    });

    test("Protocol config beacon has been promoted to latest", async () => {
      const latestAddress =
        await protocolConfigBeacon.getLatestInfinexProtocolConfigBeacon();
      expect(protocolConfigBeaconAddress).toBe(latestAddress);
    });

    test("App registry is a deployed contract", async () => {
      expect(await isContract(appRegistryAddress)).toBe(true);
    });

    test("App registry owner matches config", async () => {
      const owner = await appRegistry.owner();
      const deployVars = appsConfig.var.Deploy;
      if (env === "mainnets") {
        expect(deployVars.MULTI_SIG).toBeTypeOf("string");
      }
      const expectedOwner = deployVars.MULTI_SIG ?? deployVars.DEPLOYER;
      expect(owner).toBe(expectedOwner);
    });

    test("App registry has no pending owner", async () => {
      const pending = await appRegistry.pendingOwner();
      expect(pending).toMatch(/^0x0+/);
    });

    test("App registry app beacon interface supported by curve stableswap app beacon", async () => {
      const appBeaconInterface = await appRegistry.appBeaconInterface();
      expect(
        await curveStableswapAppBeacon.supportsInterface(appBeaconInterface),
      ).toBe(true);
    });

    test("Curve stableswap app beacon is a deployed contract", async () => {
      expect(await isContract(curveStableswapAppBeaconAddress)).toBe(true);
    });

    test("Curve stableswap app beacon owner matches config", async () => {
      const owner = await curveStableswapAppBeacon.owner();
      const deployVars = appsConfig.var.Deploy;
      if (env === "mainnets") {
        expect(deployVars.MULTI_SIG).toBeTypeOf("string");
      }
      const expectedOwner = deployVars.MULTI_SIG ?? deployVars.DEPLOYER;
      expect(owner).toBe(expectedOwner);
    });

    test("Curve stableswap app beacon has no pending owner", async () => {
      const pending = await curveStableswapAppBeacon.pendingOwner();
      expect(pending).toMatch(/^0x0+/);
    });

    test("Curve stableswap app beacon points to valid USDC contract", async () => {
      const USDCAddress = await curveStableswapAppBeacon.USDC();
      await checkUSDCAddress(USDCAddress);
    });

    test("Curve stableswap app beacon is recognised by app registry", async () => {
      expect(
        await appRegistry.appBeacons(curveStableswapAppBeaconAddress),
      ).toBe(true);
    });
  },
);
