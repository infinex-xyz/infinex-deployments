import { ethers } from "ethers";

// Contract ABIs
// (Generally only support views for smoke testing.)

function getterAbi(
  name: string,
  type: string,
  internalType?: string,
): ethers.InterfaceAbi {
  return [
    {
      type: "function",
      name,
      inputs: [],
      outputs: [
        {
          name: "",
          type,
          internalType: internalType ?? type,
        },
      ],
      stateMutability: "view",
    },
  ];
}

function mappingAbi(
  name: string,
  keyType: string,
  valueType: string,
): ethers.InterfaceAbi {
  return [
    {
      type: "function",
      name,
      inputs: [
        {
          name: "",
          type: keyType,
          internalType: keyType,
        },
      ],
      outputs: [
        {
          name: "",
          type: valueType,
          internalType: valueType,
        },
      ],
      stateMutability: "view",
    },
  ];
}

// Common

export const ownable2StepAbi: ethers.InterfaceAbi = [
  ...getterAbi("owner", "address"),
  ...getterAbi("pendingOwner", "address"),
];

export const pointsAbi: ethers.InterfaceAbi = getterAbi("name", "string");

export const erc165Abi: ethers.InterfaceAbi = mappingAbi(
  "supportsInterface",
  "bytes4",
  "bool",
);

export const erc20Abi: ethers.InterfaceAbi = [
  ...mappingAbi("balanceOf", "address", "uint256"),
  ...getterAbi("symbol", "string"),
  ...getterAbi("decimals", "uint8"),
];

export const pointsProxyAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...pointsAbi,
];

// Third party

export const USDCBeaconAbi: ethers.InterfaceAbi = [
  ...getterAbi("USDC", "address"),
];

export const pythEntropyAbi: ethers.InterfaceAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "provider",
        type: "address",
      },
    ],
    name: "getProviderInfo",
    outputs: [
      {
        components: [
          {
            internalType: "uint128",
            name: "feeInWei",
            type: "uint128",
          },
          {
            internalType: "uint128",
            name: "accruedFeesInWei",
            type: "uint128",
          },
          {
            internalType: "bytes32",
            name: "originalCommitment",
            type: "bytes32",
          },
          {
            internalType: "uint64",
            name: "originalCommitmentSequenceNumber",
            type: "uint64",
          },
          {
            internalType: "bytes",
            name: "commitmentMetadata",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "uri",
            type: "bytes",
          },
          {
            internalType: "uint64",
            name: "endSequenceNumber",
            type: "uint64",
          },
          {
            internalType: "uint64",
            name: "sequenceNumber",
            type: "uint64",
          },
          {
            internalType: "bytes32",
            name: "currentCommitment",
            type: "bytes32",
          },
          {
            internalType: "uint64",
            name: "currentCommitmentSequenceNumber",
            type: "uint64",
          },
          {
            internalType: "address",
            name: "feeManager",
            type: "address",
          },
        ],
        internalType: "struct EntropyStructs.ProviderInfo",
        name: "info",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// Infinex Multichain

export const accountFactoryAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...getterAbi("canCreateAccount", "bool"),
  ...getterAbi("canPredictAddress", "bool"),
  ...getterAbi(
    "infinexProtocolConfigBeacon",
    "address",
    "contract IInfinexProtocolConfigBeacon",
  ),
];

export const protocolConfigBeaconAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...USDCBeaconAbi,
  ...getterAbi("TRUSTED_FORWARDER", "address"),
  ...getterAbi("revenuePool", "address"),
  ...getterAbi("appRegistry", "address"),
  ...getterAbi("getLatestAccountImplementation", "address"),
  ...getterAbi("getLatestInfinexProtocolConfigBeacon", "address"),
  ...mappingAbi("isTrustedRecoveryKeeper", "address", "bool"),
];

export const forwarderAbi: ethers.InterfaceAbi = [
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      {
        name: "fields",
        type: "bytes1",
        internalType: "bytes1",
      },
      {
        name: "name",
        type: "string",
        internalType: "string",
      },
      {
        name: "version",
        type: "string",
        internalType: "string",
      },
      {
        name: "chainId",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "verifyingContract",
        type: "address",
        internalType: "address",
      },
      {
        name: "salt",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "extensions",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
];

export const appRegistryAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...getterAbi("appAccountInterface", "bytes4"),
  ...getterAbi("appBeaconInterface", "bytes4"),
  ...mappingAbi("appBeacons", "address", "bool"),
];

export const curveStableswapAppBeaconAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...erc165Abi,
  ...USDCBeaconAbi,
];

// Craterun

export const keepersAbi: ethers.InterfaceAbi = mappingAbi(
  "authorizedKeepers",
  "address",
  "bool",
);

export const crateOpenerAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...keepersAbi,
  ...getterAbi("remainingCrates", "uint256"),
];

export const ctpStakingRewardsAbi: ethers.InterfaceAbi = [
  ...ownable2StepAbi,
  ...keepersAbi,
];
