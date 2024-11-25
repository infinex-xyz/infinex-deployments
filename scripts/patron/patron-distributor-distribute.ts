import "dotenv/config";

import { createContext } from "./common";
import { formatEther, formatGwei, parseGwei } from "viem";

async function main() {
  // Load environment variables
  const BATCHES_TO_PROCESS = process.env.BATCHES_TO_PROCESS
    ? parseInt(process.env.BATCHES_TO_PROCESS)
    : Infinity;
  const TIER_TO_PROCESS = parseInt(process.env.TIER_TO_PROCESS || "1");
  const MAX_GAS_THRESHOLD = BigInt(
    process.env.MAX_GAS_THRESHOLD || "15000000000"
  );
  const WAIT_TIME = parseInt(process.env.WAIT_TIME || "13000");

  const { account, publicClient, walletClient, patronDistributor } =
    createContext();

  console.log("Processing tier", TIER_TO_PROCESS);
  console.log("Using RPC URL:", publicClient.transport.url);
  console.log("Using PATRON_DISTRIBUTOR_ADDRESS:", patronDistributor.address);

  let totalGasUsed: bigint = 0n;
  let numberOfTransactions = 0;
  let NFTsDistributed = 0n;
  let maxGas = 0n;

  let distributeTx: `0x${string}`;
  const initialBalance: bigint = await publicClient.getBalance({
    address: account.address,
  });
  console.log("Initial ETH balance:", formatEther(initialBalance) + " ETH");
  const batchSize = await publicClient.readContract({
    address: patronDistributor.address,
    abi: patronDistributor.abi,
    functionName: "batchSize",
  });
  let maxFeePerGas, tierRecipients;
  const maxPriorityFeePerGas = parseGwei("0.05");

  console.log(`Starting distribution process...`);
  let batchCount = 0;
  while (batchCount < BATCHES_TO_PROCESS) {
    console.log(`Processing batch ${batchCount + 1}`);
    try {
      tierRecipients = await publicClient.readContract({
        address: patronDistributor.address,
        abi: patronDistributor.abi,
        functionName: "getRecipientAddressesByTier",
        args: [TIER_TO_PROCESS],
      });
      console.log(
        "number of tier",
        TIER_TO_PROCESS,
        " Recipients",
        tierRecipients.length
      );

      if (tierRecipients.length === 0) {
        console.log("No more recipients to process. Exiting loop.");
        break;
      }

      const gasEstimate = await publicClient.estimateFeesPerGas();
      maxFeePerGas = gasEstimate.maxFeePerGas;

      console.log(
        "Estimated max fee per gas:",
        formatGwei(maxFeePerGas || 0n),
        "Gwei"
      );
      console.log(
        "Using max priority fee per gas:",
        formatGwei(maxPriorityFeePerGas),
        "Gwei"
      );

      while (maxFeePerGas && maxFeePerGas > MAX_GAS_THRESHOLD) {
        console.log(
          `Gas price too high (${formatGwei(maxFeePerGas)} Gwei). Waiting ${
            WAIT_TIME / 1000
          } seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, WAIT_TIME));
        const newGasEstimate = await publicClient.estimateFeesPerGas();
        maxFeePerGas = newGasEstimate.maxFeePerGas;
      }

      // Simulate the transaction before sending
      let gasEstimation;
      try {
        gasEstimation = await publicClient.estimateContractGas({
          address: patronDistributor.address,
          abi: patronDistributor.abi,
          functionName: "distributeNextBatch",
          args: [TIER_TO_PROCESS],
          account: account.address,
        });
        console.log("Estimated gas:", gasEstimation.toString());
      } catch (simulationError) {
        console.error("Gas estimation failed:", simulationError);
        throw new Error("Gas estimation failed");
      }

      try {
        await publicClient.simulateContract({
          address: patronDistributor.address,
          abi: patronDistributor.abi,
          functionName: "distributeNextBatch",
          args: [TIER_TO_PROCESS],
          account: account.address,
        });
      } catch (simulationError) {
        console.error("Transaction simulation failed:", simulationError);
        throw new Error("Transaction simulation failed");
      }

      walletClient.sendTransaction({
        to: patronDistributor.address,
        data: patronDistributor.abi.encodeFunctionData("distributeNextBatch", [TIER_TO_PROCESS]),
        maxPriorityFeePerGas,
        gas: gasEstimation,
        
      })

      console.log("Distributing next batch...");
      distributeTx = await walletClient.writeContract({
        address: patronDistributor.address,
        abi: patronDistributor.abi,
        functionName: "distributeNextBatch",
        args: [TIER_TO_PROCESS],
        maxPriorityFeePerGas,
        gas: gasEstimation,
      });
      console.log("Transaction hash:", distributeTx);
      let distributeReceipt;
      try {
        distributeReceipt = await publicClient.waitForTransactionReceipt({
          hash: distributeTx,
        });
        if (distributeReceipt.status === "reverted") {
          console.error(distributeReceipt);
          throw new Error("Transaction reverted");
        }
      } catch (error) {
        console.error("Error in transaction:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        }
        throw error; // Re-throw the error to be caught by the outer try-catch block
      }

      totalGasUsed += distributeReceipt.gasUsed;
      numberOfTransactions++;
      NFTsDistributed += batchSize;
      if (distributeReceipt.gasUsed > maxGas) {
        maxGas = distributeReceipt.gasUsed;
      }
      console.log(
        `Transaction ${numberOfTransactions} complete: Transaction fee: ${
          maxFeePerGas ? formatEther(totalGasUsed * maxFeePerGas) : "N/A"
        } ETH, Gas price: ${
          maxFeePerGas ? formatGwei(maxFeePerGas) : "N/A"
        } Gwei, NFTs distributed: ${NFTsDistributed}`
      );
      batchCount++;
    } catch (error) {
      console.error("Error distributing NFTs:", error);
      break;
    }
  }

  console.log(
    `Distribution process completed. Processed ${numberOfTransactions} batches.`
  );

  const finalBalance: bigint = await publicClient.getBalance({
    address: account.address,
  });
  console.log("Final ETH balance:", formatEther(finalBalance) + " ETH");
  console.log(
    "Total ETH spent:",
    formatEther(initialBalance - finalBalance) + " ETH"
  );
  console.log("Total transactions:", numberOfTransactions);
  console.log(
    "Transaction fee:",
    maxFeePerGas ? formatEther(totalGasUsed * maxFeePerGas) + " ETH" : "N/A"
  );
  console.log("NFTsDistributed:", NFTsDistributed);
  console.log("batchSize:", batchSize);
  console.log(
    "NFTsDistributed / batchSize:",
    batchSize !== 0n ? NFTsDistributed / batchSize : "N/A"
  );
  console.log(
    "Total ETH spent / NFTsDistributed:",
    NFTsDistributed !== 0n
      ? formatEther((initialBalance - finalBalance) / NFTsDistributed) + " ETH"
      : "N/A"
  );
  console.log(
    "Max gas fee:",
    maxFeePerGas ? formatEther(maxGas * maxFeePerGas) + " ETH" : "N/A"
  );
  console.log(
    "Average gas used per NFT:",
    NFTsDistributed !== 0n && maxFeePerGas
      ? formatEther((totalGasUsed * maxFeePerGas) / NFTsDistributed) + " ETH"
      : "N/A"
  );
  console.log(
    "Average gas used per transaction:",
    numberOfTransactions !== 0 && maxFeePerGas
      ? formatEther(
          (totalGasUsed * maxFeePerGas) / BigInt(numberOfTransactions)
        ) + " ETH"
      : "N/A"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
