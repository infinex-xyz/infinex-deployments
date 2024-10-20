import 'dotenv/config';

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

import { PatronDistributor } from './PatronDistributor';

async function main() {
  // Load environment variables
  const RPC_URL = process.env.RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PATRON_DISTRIBUTOR_ADDRESS = process.env.PATRON_DISTRIBUTOR_ADDRESS;
  const BATCHES_TO_PROCESS = parseInt(process.env.BATCHES_TO_PROCESS || '100');
  const TIER_TO_PROCESS = parseInt(process.env.TIER_TO_PROCESS || '1');
  const MAX_GAS_THRESHOLD = BigInt(process.env.MAX_GAS_THRESHOLD || '15000000000');
  const WAIT_TIME = parseInt(process.env.WAIT_TIME || '30000');

  if (!RPC_URL || !PRIVATE_KEY || !PATRON_DISTRIBUTOR_ADDRESS || !MAX_GAS_THRESHOLD || !WAIT_TIME) {
    throw new Error('Missing required environment variables');
  }

  console.log('Processing tier', TIER_TO_PROCESS);
  console.log('Processing', BATCHES_TO_PROCESS, 'batches');
  console.log('Using RPC URL:', RPC_URL);
  console.log('Using PATRON_DISTRIBUTOR_ADDRESS:', PATRON_DISTRIBUTOR_ADDRESS);

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

  const patronDistributor = {
    address: PATRON_DISTRIBUTOR_ADDRESS as `0x${string}`,
    abi: PatronDistributor,
  };

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
          address: PATRON_DISTRIBUTOR_ADDRESS as `0x${string}`,
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
