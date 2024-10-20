import 'dotenv/config';

import { createContext } from './common';

async function main() {
  // Load environment variables
  const BATCHES_TO_PROCESS = parseInt(process.env.BATCHES_TO_PROCESS || '100');
  const TIER_TO_PROCESS = parseInt(process.env.TIER_TO_PROCESS || '1');
  const MAX_GAS_THRESHOLD = BigInt(process.env.MAX_GAS_THRESHOLD || '15000000000');
  const WAIT_TIME = parseInt(process.env.WAIT_TIME || '30000');

  const { account, publicClient, walletClient, patronDistributor } = createContext();

  console.log('Processing tier', TIER_TO_PROCESS);
  console.log('Processing', BATCHES_TO_PROCESS, 'batches');
  console.log('Using RPC URL:', publicClient.transport.url);
  console.log('Using PATRON_DISTRIBUTOR_ADDRESS:', patronDistributor.address);

  let totalGasUsed: bigint = 0n;
  let numberOfTransactions = 0;
  let NFTsDistributed = 0n;
  let maxGas = 0n;

  let distributeTx: any;
  const initalBalance: bigint = await publicClient.getBalance({
    address: account.address,
  });
  console.log('Initial ETH balance:', initalBalance);
  const batchSize = await publicClient.readContract({
    address: patronDistributor.address,
    abi: patronDistributor.abi,
    functionName: 'batchSize',
  });
  let maxFeePerGas, maxPriorityFeePerGas, tierRecipients;

  for (let i = 0; i < BATCHES_TO_PROCESS; i++) {
    try {
      tierRecipients = await publicClient.readContract({
        address: patronDistributor.address,
        abi: patronDistributor.abi,
        functionName: 'getRecipientAddressesByTier',
        args: [TIER_TO_PROCESS],
      });
      console.log(
        'number of tier',
        TIER_TO_PROCESS,
        ' Recipients',
        tierRecipients.length,
      );

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const gasEstimate = await publicClient.estimateFeesPerGas();
        maxFeePerGas = gasEstimate.maxFeePerGas;
        maxPriorityFeePerGas = gasEstimate.maxPriorityFeePerGas;

        if (maxFeePerGas <= MAX_GAS_THRESHOLD) {
          break;
        }

        console.log(
          `Gas price too high (${maxFeePerGas}). Waiting ${WAIT_TIME / 1000} seconds...`,
        );
        await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));
      }
      if (tierRecipients.length > 0) {
        distributeTx = await walletClient.writeContract({
          address: patronDistributor.address,
          abi: patronDistributor.abi,
          functionName: 'distributeNextBatch',
          args: [TIER_TO_PROCESS],
        });
        const distributeReceipt = await publicClient.waitForTransactionReceipt({
          hash: distributeTx,
        });
        totalGasUsed += distributeReceipt.gasUsed;
        numberOfTransactions++;
        NFTsDistributed += batchSize;
        if (distributeReceipt.gasUsed > maxGas) {
          maxGas = distributeReceipt.gasUsed;
        }
        console.log(
          `Transaction ${numberOfTransactions} complete: Total gas used: ${totalGasUsed}, Max gas: ${maxGas}, Recent gas: ${distributeReceipt.gasUsed}, NFTs distributed: ${NFTsDistributed}`,
        );
        await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));
      } else {
        break;
      }
    } catch (error) {
      console.error('Error distributing NFTs:', error);
      return;
    }
    // Add a 15-second wait between iterations
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  const finalBalance: bigint = await publicClient.getBalance({
    address: account.address,
  });
  console.log('Final ETH balance:', finalBalance);
  console.log(
    'Total ETH spent:',
    ((initalBalance - finalBalance) / BigInt(1e18)).toString() + ' ETH',
  );
  console.log('Total transactions:', numberOfTransactions);
  console.log('Total gas used:', totalGasUsed);
  console.log('NFTsDistributed:', NFTsDistributed);
  console.log('batchSize:', batchSize);
  console.log('NFTsDistributed / batchSize:', NFTsDistributed / batchSize);
  console.log(
    'Total ETH spent / NFTsDistributed:',
    (initalBalance - finalBalance) / NFTsDistributed,
  );
  console.log('maxGas:', maxGas);
  console.log('Average gas used per NFT:', totalGasUsed / NFTsDistributed);
  console.log(
    'Average gas used per transaction:',
    totalGasUsed / BigInt(numberOfTransactions),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
