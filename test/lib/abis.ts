import { Abi, parseAbi } from "viem";

// Contract ABIs
// (Generally only support views for smoke testing.)

export { erc20Abi } from "viem";

// Common

const ownable2StepSigs = [
  "function owner() view returns (address)",
  "function pendingOwner() view returns (address)",
] as const;
export const ownable2StepAbi = parseAbi(ownable2StepSigs);

export const pointsSigs = ["function name() view returns (string)"] as const;
export const pointsAbi = parseAbi(pointsSigs);

const erc165Sigs = [
  "function supportsInterface(bytes4) view returns (bool)",
] as const;
export const erc165Abi = parseAbi(erc165Sigs);

export const pointsProxyAbi = parseAbi([...ownable2StepSigs, ...pointsSigs]);

// Third party

const USDCBeaconSigs = ["function USDC() view returns (address)"] as const;
export const USDCBeaconAbi = parseAbi(USDCBeaconSigs);

export const pythEntropyAbi = parseAbi([
  `struct ProviderInfo { uint128 feeInWei; uint128 accruedFeesInWei; bytes32 originalCommitment; uint64 originalCommitmentSequenceNumber; bytes commitmentMetadata; bytes uri; uint64 endSequenceNumber; bytes32 currentCommitment; uint64 currentCommitmentSequenceNumber; address feeManager; }`,
  "function getProviderInfo(address) view returns (ProviderInfo)",
]);

// Infinex Multichain

export const accountFactoryAbi = parseAbi([
  ...ownable2StepSigs,
  "function canCreateAccount() view returns (bool)",
  "function canPredictAddress() view returns (bool)",
  "function infinexProtocolConfigBeacon() view returns (address)",
]);

export const protocolConfigBeaconAbi = parseAbi([
  ...ownable2StepSigs,
  ...USDCBeaconSigs,
  "function TRUSTED_FORWARDER() view returns (address)",
  "function revenuePool() view returns (address)",
  "function appRegistry() view returns (address)",
  "function getLatestAccountImplementation() view returns (address)",
  "function getLatestInfinexProtocolConfigBeacon() view returns (address)",
  "function isTrustedRecoveryKeeper(address) view returns (bool)",
]);

export const forwarderAbi: Abi = [] as const;

export const appRegistryAbi = parseAbi([
  ...ownable2StepSigs,
  "function appAccountInterface() view returns (bytes4)",
  "function appBeaconInterface() view returns (bytes4)",
  "function appBeacons(address) view returns (bool)",
]);

export const curveStableswapAppBeaconAbi = parseAbi([
  ...ownable2StepSigs,
  ...erc165Sigs,
  ...USDCBeaconSigs,
]);

// Craterun

const keepersSigs = [
  "function authorizedKeepers(address) view returns (bool)",
] as const;
export const keepersAbi = parseAbi(keepersSigs);

export const crateOpenerAbi = parseAbi([
  ...ownable2StepSigs,
  ...keepersSigs,
  "function remainingCrates() view returns (uint256)",
]);

export const ctpStakingRewardsAbi = parseAbi([
  ...ownable2StepSigs,
  ...keepersSigs,
]);
