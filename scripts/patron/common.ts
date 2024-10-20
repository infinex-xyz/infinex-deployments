import 'dotenv/config';

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { PatronDistributor } from './PatronDistributor';

export function createContext() {
  const RPC_URL = process.env.RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PATRON_DISTRIBUTOR_ADDRESS = process.env.PATRON_DISTRIBUTOR_ADDRESS;
  const CHAIN = process.env.CHAIN === 'sepolia' ? sepolia : mainnet;


  if (!RPC_URL || !PRIVATE_KEY || !PATRON_DISTRIBUTOR_ADDRESS) {
    throw new Error('Missing required environment variables');
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  const patronDistributor = {
    address: PATRON_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: PatronDistributor,
  };

  return { account, publicClient, walletClient, patronDistributor };
}