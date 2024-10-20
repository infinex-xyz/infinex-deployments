import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet} from 'viem/chains';

import { PatronDistributor } from './PatronDistributor';

async function main() {
  // Load environment variables
  const RPC_URL = process.env.RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PATRON_DISTRIBUTOR_ADDRESS = process.env.PATRON_DISTRIBUTOR_ADDRESS;
  const BATCH_SIZE = process.env.BATCH_SIZE;

  if (
    !RPC_URL ||
    !PRIVATE_KEY ||
    !PATRON_DISTRIBUTOR_ADDRESS ||
    !BATCH_SIZE
  ) {
    throw new Error('Missing required environment variables');
  }

  // Create clients
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(RPC_URL),
  });
  let totalGasUsed: bigint = 0n;
  // Read initial ETH balance
  const initialBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(`Initial ETH balance: ${initialBalance} wei`);

  const patronDistributor = {
    address: PATRON_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: PatronDistributor,
  };

  // Get batch size from command line argument
  const batchSize = BigInt(BATCH_SIZE);

  // Set batch size
  const setBatchSizeTx = await walletClient.writeContract({
    address: patronDistributor.address,
    abi: patronDistributor.abi,
    functionName: 'setBatchSize',
    args: [batchSize],
  });
  const setBatchSizeTxReceipt = await publicClient.waitForTransactionReceipt({
    hash: setBatchSizeTx,
  });
  console.log(
    `Set batch size to ${batchSize}. Transaction status: ${setBatchSizeTxReceipt.status}`,
  );
  totalGasUsed += setBatchSizeTxReceipt.gasUsed;
  console.log(`Total gas used: ${totalGasUsed}`);
  const finalBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(`Final ETH balance: ${finalBalance} wei`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
