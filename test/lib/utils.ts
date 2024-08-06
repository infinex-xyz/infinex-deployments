import { evmChains, type EvmChains } from "@infinex/infinex-sdk/src/types";
import * as toml from "smol-toml";
import fs from "node:fs/promises";
import dotenv from "dotenv";
import * as viem from "viem";
import * as chains from "viem/chains";

export { evmChains, type EvmChains } from "@infinex/infinex-sdk/src/types";

export const envs = ["testnets", "staging", "mainnets"] as const;
export type Env = (typeof envs)[number];

const platformApiUrls = {
  testnets: "https://api.app.test.infinex.xyz",
  staging: "https://api.app.staging.infinex.xyz",
  mainnets: "https://api.app.infinex.xyz",
};

const chainById = Object.fromEntries(
  Object.values(chains).map((c) => [c.id, c]),
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
  path: string,
): Promise<Record<string, string>> {
  const doc = await fs.readFile(path, { encoding: "utf8" });
  return dotenv.parse(doc);
}

export async function loadLocalConfig({
  evmChainEnv,
}: {
  evmChainEnv: string;
}) {
  if (!["testnet", "mainnet"].includes(evmChainEnv)) {
    throw new Error(
      `Invalid EVM chain environment from Platform API: ${evmChainEnv}`,
    );
  }
  const doc = await fs.readFile(`./.env.${evmChainEnv}`, { encoding: "utf8" });
  const envVars = dotenv.parse(doc);
  return {
    clients: {
      arbitrum: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_ARBITRUM_URL}${envVars.RPC_ARBITRUM_API_KEY}`,
        ),
      }),
      base: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_BASE_URL}${envVars.RPC_BASE_API_KEY}`,
        ),
      }),
      ethereum: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_ETHEREUM_URL}${envVars.RPC_ETHEREUM_API_KEY}`,
        ),
      }),
      optimism: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_OPTIMISM_URL}${envVars.RPC_OPTIMISM_API_KEY}`,
        ),
      }),
      polygon: viem.createPublicClient({
        transport: viem.http(
          `${envVars.RPC_POLYGON_URL}${envVars.RPC_POLYGON_API_KEY}`,
        ),
      }),
    },
  };
}

export type Client = viem.PublicClient<viem.HttpTransport>;
export function getClient(chain: EvmChains): Client {
  return localConfig.clients[chain];
}

export const env = getEnv();
export const platformConfig = await getPlatformConfig(env);
export const localConfig = await loadLocalConfig(platformConfig);
