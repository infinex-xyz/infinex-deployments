import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { PatronDistributor } from './PatronDistributor';

async function main() {
  // Load environment variables
  const RPC_URL = process.env.RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const PATRON_DISTRIBUTOR_ADDRESS = process.env.PATRON_DISTRIBUTOR_ADDRESS;
  const PATRON_NFT_ADDRESS = process.env.PATRON_NFT_ADDRESS;
  const PATRON_VESTING_ADDRESS = process.env.PATRON_VESTING_ADDRESS;

  if (
    !RPC_URL ||
    !PRIVATE_KEY ||
    !PATRON_DISTRIBUTOR_ADDRESS ||
    !PATRON_NFT_ADDRESS ||
    !PATRON_VESTING_ADDRESS
  ) {
    throw new Error('Missing required environment variables');
  }

  // Create clients
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
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

  const patronNft = PATRON_NFT_ADDRESS as `0x${string}`;
  const vestingContract = PATRON_VESTING_ADDRESS as `0x${string}`;

  const registerPatronNFTTx = await walletClient.writeContract({
    address: patronDistributor.address,
    abi: patronDistributor.abi,
    functionName: 'setPatronNft',
    args: [patronNft],
  });
  const registerPatronNFTTxReceipt =
    await publicClient.waitForTransactionReceipt({ hash: registerPatronNFTTx });
  console.log(
    `Registered patron NFT. Transaction status: ${registerPatronNFTTxReceipt.status}`,
  );
  totalGasUsed += registerPatronNFTTxReceipt.gasUsed;
  console.log(`Total gas used: ${totalGasUsed}`);

  const registerVestingContractTx = await walletClient.writeContract({
    address: patronDistributor.address,
    abi: patronDistributor.abi,
    functionName: 'setPatronVesting',
    args: [vestingContract],
  });
  const registerVestingContractTxReceipt =
    await publicClient.waitForTransactionReceipt({
      hash: registerVestingContractTx,
    });
  console.log(
    `Registered vesting contract. Transaction status: ${registerVestingContractTxReceipt.status}`,
  );
  totalGasUsed += registerVestingContractTxReceipt.gasUsed;
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
