import {
  env,
  getChainById,
  getClient,
  loadAddresses,
  loadToml,
  platformConfig,
} from "../lib/utils";
import {
  CrateOpenerAbi,
  CtPStakingRewardsAbi,
  CratePointsAbi,
  PythEntropyAbi,
} from "../lib/abis";
import { describe, expect, test } from "vitest";
import * as viem from "viem";

describe.concurrent(`Craterun (${env})`, async () => {
  const client = getClient("base");
  const chainId = await client.getChainId();
  const chain = getChainById(chainId);
  const networkName = chain.name.toLowerCase().replace(" ", "-");
  const configDir = `../craterun/${env}`;

  const addresses = await loadAddresses(`${configDir}/ADDRESSES.txt`);
  const openerAddress = viem.getAddress(
    addresses.BASE_CRATE_OPENER ?? addresses.BASE_SEPOLIA_CRATE_OPENER,
  );
  const pointsProxyAddress = viem.getAddress(
    addresses.BASE_CRATEPOINTS_PROXY ??
      addresses.BASE_SEPOLIA_CRATEPOINTS_PROXY,
  );
  const ctpStakingRewardsAddress = viem.getAddress(
    addresses.BASE_CTP_STAKING_REWARDS ??
      addresses.BASE_SEPOLIA_CTP_STAKING_REWARDS,
  );

  const opener = viem.getContract({
    address: openerAddress,
    abi: CrateOpenerAbi,
    client,
  });
  const pointsProxy = viem.getContract({
    address: pointsProxyAddress,
    abi: CratePointsAbi,
    client,
  });
  const ctpStakingRewards = viem.getContract({
    address: ctpStakingRewardsAddress,
    abi: CtPStakingRewardsAbi,
    client,
  });

  const config = await loadToml(
    `${configDir}/infinex-craterun-${networkName}.toml`,
  );

  async function isContract(address: `0x${string}`): Promise<boolean> {
    return (await client.getCode({ address })) !== "0x";
  }

  test("Opener is a deployed contract", async () => {
    expect(await isContract(openerAddress)).toBe(true);
  });

  test("Opener owner matches config", async () => {
    const owner = await opener.read.owner();
    const deployVars = config.var.Deploy;
    if (env === "mainnets") {
      expect(deployVars.CRATERUN_MULTI_SIG).toBeTypeOf("string");
    }
    const expectedOwner =
      deployVars.CRATERUN_MULTI_SIG ?? deployVars.CRATERUN_DEPLOYER;
    expect(owner).toBe(expectedOwner);
  });

  test("Opener has no pending owner", async () => {
    const pending = await opener.read.pendingOwner();
    expect(pending).toMatch(/^0x0+/);
  });

  test("Opener crates seem valid", async () => {
    const totalCrates = Number(
      config.clone.InfinexCraterun.options.TOTAL_CRATES,
    );
    expect(totalCrates).toBeGreaterThan(0);
    const remainingCrates = await opener.read.remainingCrates();
    expect(remainingCrates).toBeLessThanOrEqual(totalCrates);
    // Remove after Craterun is complete
    expect(remainingCrates).toBeGreaterThan(0);
  });

  test("Points proxy is a deployed contract", async () => {
    expect(await isContract(pointsProxyAddress)).toBe(true);
  });

  test("Points proxy points name configured", async () => {
    const name = config.var.Deploy.CRATE_POINTS_NAME;
    expect(name).toMatch(/[A-Za-z]+/);
    const deployedName: string = await pointsProxy.read.name();
    expect(name).toBe(deployedName);
  });

  test("CTP staking rewards is a deployed contract", async () => {
    expect(await isContract(ctpStakingRewardsAddress)).toBe(true);
  });

  test("Opener recognises keeper from Platform app", async () => {
    const keeperAddress = platformConfig.stakingKeeperSignerAddress;
    const isAuthorized: boolean = await opener.read.authorizedKeepers([
      keeperAddress,
    ]);
    expect(isAuthorized).toBe(true);
  });

  test("CTP staking rewards recognises keeper", async () => {
    const keeperAddress = platformConfig.stakingKeeperSignerAddress;
    const isAuthorized = await ctpStakingRewards.read.authorizedKeepers([
      keeperAddress,
    ]);
    expect(isAuthorized).toBe(true);
  });

  test("Pyth Entropy configuration looks valid", async () => {
    const address = config.clone.InfinexCraterun.options.ENTROPY_;
    const entropyProvider =
      config.clone.InfinexCraterun.options.ENTROPY_PROVIDER;
    expect(await isContract(address)).toBe(true);
    const entropy = viem.getContract({ address, abi: PythEntropyAbi, client });
    const entropyProviderInfo = await entropy.read.getProviderInfo([
      entropyProvider,
    ]);
    const feeManagerAddress = entropyProviderInfo.feeManager;
    expect(viem.isAddress(feeManagerAddress)).toBe(true);
  });
});
