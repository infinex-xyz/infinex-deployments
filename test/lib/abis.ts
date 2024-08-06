import { Abi, parseAbi } from "viem";
export * from "@infinex/infinex-sdk/src/abis";

// Contract ABIs
// (Generally only support views for smoke testing.)

export { erc20Abi as Erc20Abi } from "viem";

// Common

const ownable2StepSigs = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
] as const;
export const Ownable2StepAbi = parseAbi(ownable2StepSigs);

// Third party

export const PythEntropyAbi = parseAbi([
  `struct ProviderInfo { uint128 feeInWei; uint128 accruedFeesInWei; bytes32 originalCommitment; uint64 originalCommitmentSequenceNumber; bytes commitmentMetadata; bytes uri; uint64 endSequenceNumber; bytes32 currentCommitment; uint64 currentCommitmentSequenceNumber; address feeManager; }`,
  "function getProviderInfo(address) view returns (ProviderInfo)",
]);

// Infinex Multichain

export const AppRegistryAbi = parseAbi([
  ...ownable2StepSigs,
  "function appAccountInterface() view returns (bytes4)",
  "function appBeaconInterface() view returns (bytes4)",
  "function appBeacons(address) view returns (bool)",
]);
