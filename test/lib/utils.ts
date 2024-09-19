import * as toml from "smol-toml";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import * as viem from "viem";
import * as chains from "viem/chains";
import { ChainKey } from "@infinex/evm-sdk/src";
import testEnv from "@infinex/evm-sdk/env/test";
import stagingEnv from "@infinex/evm-sdk/env/staging";
import prodEnv from "@infinex/evm-sdk/env/prod";
import ejs from "ejs";

export { evmChainKeys } from "@infinex/evm-sdk/";

export const envs = ["testnets", "staging", "mainnets"] as const;
export type Env = (typeof envs)[number];

const platformApiUrls = {
  testnets: "https://api.app.test.infinex.xyz",
  staging: "https://api.app.staging.infinex.xyz",
  mainnets: "https://api.app.infinex.xyz",
};

const chainById = Object.fromEntries(
  Object.values(chains).map((c) => [c.id, c])
);
export function getChainById(id: number): viem.Chain {
  const ret = chainById[id];
  if (!ret) throw Error(`Chain ${id} not supported by viem`);
  return ret;
}

export function getEnv(): Env {
  const env = process.env.ENV;
  if (!envs.some((e) => e === env))
    throw Error(`Invalid env "${env}". Must be one of ${envs.join(", ")}`);
  return env as Env;
}

export type InfinexAddresses = {
  owner: `0x${string}`;
  revenuePool: `0x${string}`;
};

export async function getPlatformConfig(env: Env) {
  const url = `${platformApiUrls[env]}/public/config`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });
  return (await response.json()).config;
}

export async function loadToml(path: string): Promise<any> {
  const doc = await fs.readFile(path, { encoding: "utf8" });
  return toml.parse(doc);
}

export async function loadAddresses(
  path: string
): Promise<Record<string, string>> {
  const doc = await fs.readFile(path, { encoding: "utf8" });
  return dotenv.parse(doc);
}

export function renderEjsExpression(expression: string): string {
  const context = {
    parseUnits: (value: string, decimals: number) =>
      viem.parseUnits(value, decimals),
  };
  return ejs.render(expression, context);
}

export async function loadLocalConfig({
  evmChainEnv,
}: {
  evmChainEnv: string;
}) {
  if (!["testnet", "mainnet"].includes(evmChainEnv)) {
    throw new Error(
      `Invalid EVM chain environment from Platform API: ${evmChainEnv}`
    );
  }
  const doc = await fs.readFile(`./.env.${evmChainEnv}`, { encoding: "utf8" });
  const envVars = dotenv.parse(doc);
  return {
    clients: {
      arbitrum: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_ARBITRUM_URL}${envVars.RPC_ARBITRUM_API_KEY}`
        ),
      }),
      base: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_BASE_URL}${envVars.RPC_BASE_API_KEY}`
        ),
      }),
      ethereum: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_ETHEREUM_URL}${envVars.RPC_ETHEREUM_API_KEY}`
        ),
      }),
      optimism: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_OPTIMISM_URL}${envVars.RPC_OPTIMISM_API_KEY}`
        ),
      }),
      polygon: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_POLYGON_URL}${envVars.RPC_POLYGON_API_KEY}`
        ),
      }),
    },
  };
}

export const getEnvConfig = (env: string) => {
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

export function getContractSDK<Abi extends viem.Abi>(
  env: ReturnType<typeof getEnvConfig>,
  client: Client,
  varName: string,
  abi: Abi
) {
  // @ts-ignore
  const address = viem.getAddress(env[varName]);
  return viem.getContract({ address, abi, client });
}

export function getAddressSDK(
  env: ReturnType<typeof getEnvConfig>,
  varName: string
): `0x${string}` | undefined {
  // @ts-ignore
  const value = env[varName];
  if (!value) return undefined;
  return viem.getAddress(value);
}

export async function getNetworkName(client: Client): Promise<string> {
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

export type Client = viem.PublicClient<viem.HttpTransport>;
export function getClient(chain: ChainKey): Client {
  return localConfig.clients[chain];
}

export const env = getEnv();
export const platformConfig = await getPlatformConfig(env);
export const localConfig = await loadLocalConfig(platformConfig);

export function officialUSDCAddress(chainId: number) {
  const officialUSDC: Record<number, `0x${string}`> = {
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  };
  return officialUSDC[chainId];
}

export function officialCircleBridgeAddress(chainId: number): `0x${string}` {
  const officialCircleBridge: Record<number, `0x${string}`> = {
    42161: "0x19330d10D9Cc8751218eaf51E8885D058642E08A",
    8453: "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962",
    1: "0xBd3fa81B58Ba92a82136038B25aDec7066af3155",
    10: "0x2B4069517957735bE00ceE0fadAE88a26365528f",
    137: "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE",
    421614: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    84532: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    11155111: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    11155420: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    80002: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
  };
  return officialCircleBridge[chainId];
}

export function officialCircleMinterAddress(chainId: number): `0x${string}` {
  const officialCircleMinter: Record<number, `0x${string}`> = {
    42161: "0xE7Ed1fa7f45D05C508232aa32649D89b73b8bA48",
    8453: "0xe45B133ddc64bE80252b0e9c75A8E74EF280eEd6",
    1: "0xc4922d64a24675E16e1586e3e3Aa56C06fABe907",
    10: "0x33E76C5C31cb928dc6FE6487AB3b2C0769B1A1e3",
    137: "0x10f7835F827D6Cf035115E10c50A853d7FB2D2EC",
    421614: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
    84532: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
    11155111: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
    11155420: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
    80002: "0xE997d7d2F6E065a9A93Fa2175E878Fb9081F1f0A",
  };
  return officialCircleMinter[chainId];
}

export function officialWormholeCircleBridgeAddress(
  chainId: number
): `0x${string}` {
  const officialWormholeCircleBridge: Record<number, `0x${string}`> = {
    42161: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    8453: "0x03faBB06Fa052557143dC28eFCFc63FC12843f1D",
    1: "0xAaDA05BD399372f0b0463744C09113c137636f6a",
    10: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    137: "0x0FF28217dCc90372345954563486528aa865cDd6",
    421614: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    84532: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    11155111: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    11155420: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
    80002: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c",
  };
  return officialWormholeCircleBridge[chainId];
}

export function officialWormholeCoreAddress(chainId: number): `0x${string}` {
  const officialWormholeCore: Record<number, `0x${string}`> = {
    42161: "0xa5f208e072434bC67592E4C49C1B991BA79BCA46",
    8453: "0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6",
    1: "0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B",
    10: "0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722",
    137: "0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7",
    421614: "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
    84532: "0x79A1027a6A159502049F10906D333EC57E95F083",
    11155111: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
    11155420: "0x31377888146f3253211EFEf5c676D41ECe7D58Fe",
    80002: "0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35",
  };
  return officialWormholeCore[chainId];
}

export function accountInitialProxyImplementationAddress(
  env: string
): `0x${string}` {
  const accountInitialProxyImplementation: Record<string, `0x${string}`> = {
    testnets: "0xCFB0cB896de761C313BBd690E3fCebf6B3c6a1E5",
    staging: "0x24FcfF8c69F04D0f5a3Cf150CAe858f7E0F624cD",
    mainnets: "0xc69347cDF339cc0c89BFC71C0a535d653eCC28b4",
  };
  return accountInitialProxyImplementation[env];
}
