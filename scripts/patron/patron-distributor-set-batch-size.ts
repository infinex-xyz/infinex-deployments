import 'dotenv/config';

import { createContext } from './common';

async function main() {
  const BATCH_SIZE = process.env.BATCH_SIZE;

  if (!BATCH_SIZE) {
    throw new Error('Missing BATCH_SIZE environment variable');
  }

  const { account, publicClient, walletClient, patronDistributor } = createContext();
  
  let totalGasUsed: bigint = 0n;
  // Read initial ETH balance
  const initialBalance = await publicClient.getBalance({
    address: account.address,
  });
  console.log(`Initial ETH balance: ${initialBalance} wei`);

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
