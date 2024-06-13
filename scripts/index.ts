import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import * as path from 'path';
import { Command } from 'commander';
import { types, utils } from '@infinex/infinex-sdk';
import { Abi, Address } from 'viem';

type Artifacts = { address: Address; abi: Abi; contractName: string }[];

const program = new Command();

const PackageScopeDefault = 'infinex-multichain';
const PackageVersionDefault = 'latest';
const PackagePresetsDefault = 'O2';

const IncludeChainsDefault = [
  'arbitrum',
  'optimism',
  'polygon',
  'ethereum',
  'base',
  'ethereum-sepolia',
  'optimism-sepolia',
  'arbitrum-sepolia',
  'base-sepolia',
  'polygon-sepolia',
] as types.EvmChains[];

const InfinexContractsAddressFilter = [
  'AccountFactory',
  'InfinexProtocolConfigBeacon',
  'Forwarder',
];

program
  .option('--package-scope <scope>', 'Package scope', PackageScopeDefault)
  .option(
    '--package-version <version>',
    'Package version',
    PackageVersionDefault,
  )
  .option('--package-preset <preset>', 'Package preset', PackagePresetsDefault)
  .option('--include-chains <chains...>', 'Chains to include', (val) =>
    val.split(',').map((x) => x.trim()),
  );

program.parse(process.argv);

const options = program.opts();

const PackageScope = options.packageScope;
const PackageVersion = options.packageVersion;
const PackagePreset = options.packagePreset;

const IncludeChains = options?.includeChains?.length
  ? options.includeChains
  : IncludeChainsDefault;

type Presets = 'O2' | 'APPS';

interface CannonDeployment {
  chainId: keyof typeof types.ChainNameMapping | string;
  preset: Presets;
  name: string;
  version: string;
}

const splitOnCapital = (str: string) =>
  str.split(/(?=[A-Z])/).map((part: string) => part.trim());

const capitalize = (arr: string[]) => arr.map((x) => x.toUpperCase());

async function executeCannonInspect(
  packageRef: string,
  chainId: keyof typeof types.ChainNameMapping | string,
) {
  const outputDeploymentsPath = path.resolve(__dirname, './deployments');
  const command = `cannon inspect ${packageRef} -c ${chainId} --write-deployments ${outputDeploymentsPath}/${packageRef}-${chainId}`;
  console.log(`Executing: ${command}`);

  return await new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(error);
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    },
  );
}

async function processOutput(chainId: keyof typeof types.ChainNameMapping) {
  const deploymentsPath = path.resolve(__dirname, './deployments');

  const deploymentFolders = (await fs.readdir(deploymentsPath)).filter((str) =>
    str.match(/infinex/),
  );

  return await Promise.all(
    deploymentFolders
      .filter((deployment) => deployment.match(new RegExp(`-${chainId}$`)))
      .map(async (deployment) => {
        const deploymentPath = path.resolve(deploymentsPath, deployment);
        const innerPath = await fs.readdir(deploymentPath);
        const contractFiles = await fs.readdir(
          path.resolve(deploymentPath, innerPath[0]),
        );
        return await Promise.all(
          contractFiles.map(async (contract) => {
            const json = await fs.readFile(
              path.resolve(deploymentPath, innerPath[0], contract),
              'utf-8',
            );

            const data = JSON.parse(json);

            return {
              address: data.address,
              abi: data.abi,
              contractName: contract.split('.')[0],
            };
          }),
        );
      }),
  );
}

type Results = Record<string, Record<keyof typeof types.ChainNameMapping, Artifacts>>;

async function getPublishedContracts(versions: CannonDeployment[]) {
  const results: Results = {};

  await Promise.all(
    versions.map(async (deployment) => {
      const { name, version, preset, chainId } = deployment;
      const packageRef = `${name}:${version}@${preset}`;
      await executeCannonInspect(packageRef, chainId);

      if (!results[version]) {
        // @ts-expect-error ignore
        results[version] = {};
      }
      // @ts-expect-error ignore
      results[version][chainId] = (await processOutput(chainId)).flat();
    }),
  );

  return results;
}

function formatOutput(artifacts: Results): string {
  let output = `# Scope: ${PackageScope} \n\n`;
  output += `## Version: ${PackageVersion} \n\n`;
  output += `## Preset: ${PackagePreset} \n\n`;

  for (const [, versionData] of Object.entries(artifacts)) {
    for (const [chainId, chainDeployments] of Object.entries(versionData)) {
      // @ts-expect-error ignore
      const chainName = types.TestnetChainNameMapping[Number(chainId)];

      // @ts-expect-error ignore
      output += `### Chain: ${types.ChainNameMapping[Number(chainId)]}\n\n`;

      const filteredContracts = chainDeployments.filter((d) => {
        return InfinexContractsAddressFilter.includes(d.contractName);
      });

      for (const deployment of filteredContracts) {
        const contractName = capitalize(
          splitOnCapital(deployment.contractName),
        ).join('_');
        output += `${chainName.toUpperCase()}_${contractName}_ADDRESS='${deployment.address}'\n`;
      }
      output += '\n';
    }
  }

  return output;
}

const versionedDeployments: CannonDeployment[] = Object.entries(
  types.ChainNameMapping,
)
  .filter(([, chainName]) => IncludeChains.includes(chainName as types.EvmChains))
  .map(([chainId]) => ({
    chainId: chainId,
    preset: PackagePreset,
    name: PackageScope,
    version: PackageVersion,
  }));

const allDeployments = [...versionedDeployments];

const outputPath = path.resolve(__dirname, './deployments');

(async () => {
  await fs.mkdir(outputPath, { recursive: true });
  const artifacts = await getPublishedContracts(allDeployments);
  const formattedOutput = formatOutput(artifacts);
  const filePath = path.join(outputPath, 'addresses.txt');
  await fs.writeFile(filePath, formattedOutput);
})();
