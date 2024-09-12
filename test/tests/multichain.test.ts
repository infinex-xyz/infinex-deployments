import {
  accountInitialProxyImplementationAddress,
  env,
  getAddressSDK,
  getChainById,
  getClient,
  getContractSDK,
  getEnvConfig,
  getNetworkName,
  loadToml,
  officialCircleBridgeAddress,
  officialCircleMinterAddress,
  officialUSDCAddress,
  officialWormholeCircleBridgeAddress,
  officialWormholeCoreAddress,
  platformConfig,
  renderEjsExpression,
} from "../lib/utils";
import {
  AccountFactoryAbi,
  Erc20Abi,
  InfinexERC2771ForwarderAbi,
  InfinexProtocolConfigBeaconAbi,
  AppRegistry,
  InfinexProtocolConfigBeacon,
  AccountsRouter,
} from "../lib/abis";
import { describe, expect, test } from "vitest";
import * as viem from "viem";
import { EvmChainKey, evmChainKeys } from "@infinex/evm-sdk";

describe.concurrent.each(Object.values(evmChainKeys))(
  `Multichain (%s ${env})`,
  async (chainName) => {
    console.log("chainName", chainName);
    const CHAIN = chainName.toUpperCase();
    const client = getClient(chainName as EvmChainKey);
    const chainId = await client.getChainId();
    const chain = getChainById(chainId);
    const networkName = await getNetworkName(client);
    const configDir = `../infinex-multichain/${env}`;
    const envConfig = getEnvConfig(env);

    const accountFactory = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_ACCOUNT_FACTORY_ADDRESS`,
      AccountFactoryAbi
    );
    const appRegistry = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_APP_REGISTRY_ADDRESS`,
      AppRegistry
    );
    const forwarder = getContractSDK(
      envConfig,
      client,
      `${CHAIN}_FORWARDER_ADDRESS`,
      InfinexERC2771ForwarderAbi
    );
    const protocolConfigBeaconV1 = viem.getContract({
      // @ts-ignore
      address: envConfig[`${chainName}InfinexProtocolConfigBeacons`][0],
      abi: InfinexProtocolConfigBeaconAbi,
      client,
    });
    const protocolConfigBeaconV2 = viem.getContract({
      // @ts-ignore
      address: envConfig[`${chainName}InfinexProtocolConfigBeacons`][1],
      abi: InfinexProtocolConfigBeaconAbi,
      client,
    });
    const latestProtocolConfigBeacon = viem.getContract({
      // @ts-ignore
      address: envConfig[`${chainName}InfinexProtocolConfigBeacons`][2],
      abi: InfinexProtocolConfigBeacon,
      client,
    });

    const latestAccountRouter = viem.getContract({
      // @ts-ignore
      address: envConfig[`${chainName}AccountsRouters`][2],
      abi: AccountsRouter,
      client,
    }).address;

    const config = await loadToml(
      `${configDir}/infinex-multichain-${networkName}.toml`
    );

    async function isContract(address: `0x${string}`): Promise<boolean> {
      return (await client.getCode({ address })) !== "0x";
    }

    describe("Initial Deployment", () => {
      describe("Account Factory", () => {
        test("is a deployed contract", async () => {
          expect(await isContract(accountFactory.address)).toBe(true);
        });

        test("can predict address", async () => {
          expect(await accountFactory.read.canPredictAddress()).toBe(true);
        });

        test("can create account", async () => {
          expect(await accountFactory.read.canCreateAccount()).toBe(true);
        });
      });

      describe("Forwarder", () => {
        test("is a deployed contract", async () => {
          expect(await isContract(forwarder.address)).toBe(true);
        });
      });

      describe("App Registry", () => {
        test("is a deployed contract", async () => {
          expect(await isContract(appRegistry.address)).toBe(true);
        });
      });

      describe("Infinex Protocol Config Beacon", () => {
        test("points to expected forwarder contract", async () => {
          const address =
            await latestProtocolConfigBeacon.read.TRUSTED_FORWARDER();
          expect(address).toBe(forwarder.address);
        });

        test("points to expected app registry contract", async () => {
          const address = await latestProtocolConfigBeacon.read.appRegistry();
          expect(address).toBe(appRegistry.address);
        });

        test("recognises recovery keeper address from Platform app", async () => {
          const keeperAddress = platformConfig.recoveryKeeperAddress;
          expect(
            await latestProtocolConfigBeacon.read.isTrustedRecoveryKeeper([
              keeperAddress,
            ])
          ).toBe(true);
          if (env !== "mainnets") {
            // dev wallet is also a recovery keeper until we're able to run recovery tests solely in platform
            const devWallet = "0x6298551D56F825B3b6c3350D32129Ffd3cFb198C";
            expect(
              await latestProtocolConfigBeacon.read.isTrustedRecoveryKeeper([
                devWallet,
              ])
            ).toBe(true);
          }
        });

        test("funds recovery is active", async () => {
          expect(
            await latestProtocolConfigBeacon.read.fundsRecoveryActive()
          ).toBe(true);
        });

        test("has revenue pool from config", async () => {
          const revenuePoolAddress =
            config.var.Deploy.REVENUE_POOL ?? config.var.deploy.REVENUE_POOL;
          expect(await latestProtocolConfigBeacon.read.revenuePool()).toBe(
            revenuePoolAddress
          );
        });

        test("has expected withdrawal fee", async () => {
          const withdrawalFee = renderEjsExpression(
            config.var.Deploy.WITHDRAWAL_FEE_USDC
          );
          expect(
            await latestProtocolConfigBeacon.read.withdrawalFeeUSDC()
          ).toBe(BigInt(withdrawalFee));
        });

        test("points to valid USDC contract", async () => {
          const USDCAddress = await latestProtocolConfigBeacon.read.USDC();
          expect(USDCAddress).toBe(officialUSDCAddress(chainId));
        });

        test("circle bridge configuration set correctly", async () => {
          const circleBridge =
            await latestProtocolConfigBeacon.read.getCircleBridge();
          const circleMinter =
            await latestProtocolConfigBeacon.read.getCircleMinter();
          const defaultCCTPDomain =
            await latestProtocolConfigBeacon.read.getDefaultDestinationCCTPDomain();
          expect(circleBridge).toBe(officialCircleBridgeAddress(chainId));
          expect(circleMinter).toBe(officialCircleMinterAddress(chainId));
          expect(defaultCCTPDomain).toBe(6);
        });

        test("wormhole circle bridge configuration set correctly", async () => {
          const wormholeCircleBridge =
            await latestProtocolConfigBeacon.read.getWormholeCircleBridge();
          const defaultWormholeDomain =
            await latestProtocolConfigBeacon.read.getDefaultDestinationWormholeChainId();
          expect(wormholeCircleBridge).toBe(
            officialWormholeCircleBridgeAddress(chainId)
          );
          if (env === "testnets") {
            expect(defaultWormholeDomain).toBe(10004);
          } else {
            expect(defaultWormholeDomain).toBe(30);
          }
        });

        test("points to expected initial proxy implementation", async () => {
          const initialProxyImplementation =
            await latestProtocolConfigBeacon.read.getInitialProxyImplementation();
          expect(initialProxyImplementation).toBe(
            accountInitialProxyImplementationAddress(env)
          );
        });

        test("points to expected account implementation contract", async () => {
          const address =
            await latestProtocolConfigBeacon.read.getLatestAccountImplementation();
          expect(address).toBe(latestAccountRouter);
        });

        test("is set to itself as latest", async () => {
          const latestAddress =
            await latestProtocolConfigBeacon.read.getLatestInfinexProtocolConfigBeacon();
          expect(latestProtocolConfigBeacon.address).toBe(latestAddress);
        });

        test("has supported evm cctp domains", async () => {
          const supportedEVMCCTPDomains = [0, 2, 3, 6, 7];
          for (const domain of supportedEVMCCTPDomains) {
            expect(
              await latestProtocolConfigBeacon.read.isSupportedEVMCCTPDomain([
                domain,
              ])
            ).toBe(true);
          }
        });

        test("has supported evm wormhole chain ids", async () => {
          const supportedEVMWormholeChainIds: Record<
            string,
            Record<number, number>
          > = {
            testnets: {
              421614: 10003,
              84532: 10004,
              11155111: 10002,
              11155420: 10005,
              80002: 10007,
            },
            staging: {
              42161: 23,
              84531: 30,
              1: 2,
              10: 24,
              137: 5,
            },
            mainnets: {
              42161: 23,
              84531: 30,
              1: 2,
              10: 24,
              137: 5,
            },
          };
          for (const chainId of Object.keys(
            supportedEVMWormholeChainIds[env]
          ) as unknown as number[]) {
            const domain = supportedEVMWormholeChainIds[env][chainId];
            expect(
              await latestProtocolConfigBeacon.read.isSupportedEVMWormholeChainId(
                [domain]
              )
            ).toBe(true);
          }
        });

        test("has correct solana configuration", async () => {
          const solanaCCTPDomain =
            await latestProtocolConfigBeacon.read.solanaCCTPDestinationDomain();
          expect(solanaCCTPDomain).toBe(5);
        });

        test("has correct wormhole core contract", async () => {
          expect(await latestProtocolConfigBeacon.read.WORMHOLE_CORE()).toBe(
            officialWormholeCoreAddress(chainId)
          );
        });
      });
    });

    describe("Council executed steps completed", () => {
      test("account factory uses latest beacon", async () => {
        const beaconAddress =
          await accountFactory.read.infinexProtocolConfigBeacon();
        expect(latestProtocolConfigBeacon.address).toBe(beaconAddress);
      });

      test("v2 beacon pointing to latest beacon", async () => {
        const beaconAddress =
          await protocolConfigBeaconV2.read.getLatestInfinexProtocolConfigBeacon();
        expect(latestProtocolConfigBeacon.address).toBe(beaconAddress);
      });

      test("v1 beacon pointing to latest beacon", async () => {
        const beaconAddress =
          await protocolConfigBeaconV1.read.getLatestInfinexProtocolConfigBeacon();
        expect(latestProtocolConfigBeacon.address).toBe(beaconAddress);
      });

      describe("Ownership", () => {
        test("owner matches config", async () => {
          const owner = await accountFactory.read.owner();
          const deployVars = config.var.Deploy;
          if (env === "mainnets") {
            expect(deployVars.MULTISIG).toBeTypeOf("string");
          }
          const expectedOwner = deployVars.MULTISIG ?? deployVars.DEPLOYER;
          expect(owner).toBe(expectedOwner);
        });

        test("app registry owner matches config", async () => {
          const owner = await appRegistry.read.owner();
          const deployVars = config.var.Deploy;
          if (env === "mainnets") {
            expect(deployVars.MULTISIG).toBeTypeOf("string");
          }
          const expectedOwner = deployVars.MULTISIG ?? deployVars.DEPLOYER;
          expect(owner).toBe(expectedOwner);
        });

        test("Infinex Protocol Config Beacon owner matches config", async () => {
          const owner = await latestProtocolConfigBeacon.read.owner();
          const deployVars = config.var.Deploy;
          if (env === "mainnets") {
            expect(deployVars.MULTISIG).toBeTypeOf("string");
          }
          const expectedOwner = deployVars.MULTISIG ?? deployVars.DEPLOYER;
          expect(owner).toBe(expectedOwner);
        });

        test("Account Factory has no pending owner", async () => {
          const pending = await accountFactory.read.pendingOwner();
          expect(pending).toMatch(/^0x0+/);
        });

        test("App registry has no pending owner", async () => {
          const pending = await appRegistry.read.pendingOwner();
          expect(pending).toMatch(/^0x0+/);
        });

        test("v1 beacon has no pending owner", async () => {
          const pending = await protocolConfigBeaconV1.read.pendingOwner();
          expect(pending).toMatch(/^0x0+/);
        });

        test("v2 beacon has no pending owner", async () => {
          const pending = await protocolConfigBeaconV2.read.pendingOwner();
          expect(pending).toMatch(/^0x0+/);
        });

        test("latest beacon has no pending owner", async () => {
          const pending = await latestProtocolConfigBeacon.read.pendingOwner();
          expect(pending).toMatch(/^0x0+/);
        });
      });
    });
  }
);
