import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import * as path from "path";
import { Command } from "commander";
import { ethereum, types, utils } from "@infinex/infinex-sdk";
import { Abi, Address, FilterTypeNotSupportedError } from "viem";
import { glob } from "glob";
import { deployContract } from "viem/zksync";

type Artifacts = { address: Address; abi: Abi; contractName: string, upgraded: boolean, version: 'OLD' | 'NEW' }[];

const program = new Command();

const PackageScopeDefault = "infinex-multichain";
const PackageVersionDefault = "latest";
const PackagePresetsDefault = "O2";

const IncludeChainsDefault = [
  "arbitrum",
  "optimism",
  "polygon",
  "ethereum",
  "base",
  "ethereum-sepolia",
  "optimism-sepolia",
  "arbitrum-sepolia",
  "base-sepolia",
  "polygon-sepolia",
] as const;

const InfinexContractsAddressFilter = [
  "AccountFactory",
  "InfinexProtocolConfigBeacon",
  "AccountsRouter",
  "Forwarder"
];

program
  .option("--package-scope <scope>", "Package scope", PackageScopeDefault)
  .option(
    "--package-version <version>",
    "Package version",
    PackageVersionDefault
  )
  .option("--package-preset <preset>", "Package preset", PackagePresetsDefault)
  .option("--include-chains <chains...>", "Chains to include", (val) =>
    val.split(",").map((x) => x.trim())
  )
  .option("--testnet", "Include testnet chains", false);

program.parse(process.argv);

const options = program.opts();

const PackageScope = options.packageScope;
const PackageVersion = options.packageVersion;
const PackagePreset = options.packagePreset;
const Testnet = options.testnet;

let IncludeChains = options?.includeChains?.length
  ? options.includeChains
  : IncludeChainsDefault;

IncludeChains = IncludeChains.filter((chain: string) => {
  if (Testnet) {
    return chain.match(/sepolia/);
  } else {
    return chain.match(/sepolia/) === null;
  }
});

type Presets = "O2" | "APPS";

interface CannonDeployment {
  chainId: keyof typeof types.ChainNameMapping | string;
  preset: Presets;
  name: string;
  version: string;
}

async function executeCannonInspect(
  packageRef: string,
  chainId: keyof typeof types.ChainNameMapping | string
) {
  const outputDeploymentsPath = path.resolve(__dirname, "./deployments");
  const command = `cannon inspect ${packageRef} -c ${String(chainId)} --write-deployments ${outputDeploymentsPath}/${packageRef}-${String(chainId)}`;
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
    }
  );
}
async function dedupeJsonFiles(files: string[]) {
  const seenAddresses = new Map();
  const paths = new Map();

  for (const file of files) {
    const filePath = path.resolve(file);
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const key = filePath.includes('infinexOld') 
      ? `${path.basename(filePath, '.json')}$OLD` 
      : `${path.basename(filePath, '.json')}$NEW`;

    seenAddresses.set(key, data.address);
    paths.set(key, filePath);
  }

  const upgraded = {};
  const unchanged = {};
  const filePaths = {};

  for (const [key, newAddress] of seenAddresses.entries()) {
    if (key.endsWith('$NEW')) {
      const oldKey = key.replace('$NEW', '$OLD');
      const oldAddress = seenAddresses.get(oldKey);

      if (oldAddress && oldAddress !== newAddress) {
        upgraded[oldKey] = oldAddress;
        upgraded[key] = newAddress;
        filePaths[oldKey] = paths.get(oldKey);
        filePaths[key] = paths.get(key);
      } else if (oldAddress) {
        unchanged[oldKey] = oldAddress;
        unchanged[key] = newAddress;
        filePaths[oldKey] = paths.get(oldKey);
        filePaths[key] = paths.get(key);
      }
    }
  }

  return { upgraded, unchanged, filePaths };
}

async function processOutput(chainId: string) {
  const deploymentsPath = path.resolve(__dirname, "./deployments");
  const deploymentFolders = await fs.readdir(deploymentsPath);
  const regex = new RegExp(`${PackageScope}:${PackageVersion}@${PackagePreset}-\\d+`);

  const filteredDeploymentFolders = deploymentFolders.filter((str) => {
    return str.match(new RegExp(regex, "igm"));
  });

  const results = await Promise.all(
    filteredDeploymentFolders
      .filter((deployment) => deployment.match(new RegExp(`-${String(chainId)}$`)))
      .map(async (deployment) => {
        const deploymentPath = path.resolve(deploymentsPath, deployment);

        const jsonFiles = await glob('**/*.json', { cwd: deploymentPath, absolute: true });

        const { upgraded, unchanged, filePaths } = await dedupeJsonFiles(jsonFiles);

        return await Promise.all(
          Object.entries(filePaths).map(async ([key, filePath]) => {
            const contractPath = path.resolve(filePath as string);

            const json = await fs.readFile(contractPath, "utf-8");
            const data = JSON.parse(json);
            const contractName = path.basename(contractPath, '.json');
            const isUpgraded = upgraded.hasOwnProperty(key);

            return {
              address: data.address,
              abi: data.abi,
              contractName,
              version: key.endsWith('$NEW') ? 'NEW' : 'OLD',
              upgraded: isUpgraded,
            };
          })
        );
      })
  );

  return results.flat();
}

type Results = Record<
  string,
  Record<keyof typeof types.ChainNameMapping, Artifacts>
>;

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
    })
  );

  return results;
}

function capitalize(words: string[]): string[] {
  return words.map(word => word.toUpperCase());
}

function splitOnCapital(str: string): string[] {
  return str.split(/(?=[A-Z])/);
}

function formatOutput(artifacts: Results): string {
  let output = `# Scope: ${PackageScope} \n\n`;
  output += `## Version: ${PackageVersion} \n\n`;
  output += `## Preset: ${PackagePreset} \n\n`;

  for (const [, versionData] of Object.entries(artifacts)) {
    for (const [chainId, chainDeployments] of Object.entries(versionData)) {

      // @ts-expect-error ignore
      const chainNameKey = types.TestnetChainNameMapping[Number(chainId)];

      // @ts-expect-error ignore
      output += `### Chain: ${types.ChainNameMapping[Number(chainId)]}\n\n`;

      const filteredContracts = chainDeployments.filter((d) => {
        return InfinexContractsAddressFilter.includes(d.contractName);
      });


      for (const deployment of filteredContracts) {
        const contractName = capitalize(
          splitOnCapital(deployment.contractName)
        ).join("_");

        if (deployment.version === 'NEW' && deployment.upgraded && deployment.contractName !== 'InfinexProtocolConfigBeacon') {
          const oldContract = filteredContracts.find((d) => d.contractName === deployment.contractName && d.version === 'OLD');
          const newContract = filteredContracts.find((d) => d.contractName === deployment.contractName && d.version === 'NEW');
          
          output += `${chainNameKey.toUpperCase()}_${contractName}_${"V1"}_ADDRESS=${oldContract?.address}\n`;
          output += `${chainNameKey.toUpperCase()}_${contractName}_${"V2"}_ADDRESS=${newContract?.address}\n`;
        } else if (deployment.version === 'OLD' && !deployment.upgraded) {
          output += `${chainNameKey.toUpperCase()}_${contractName}_ADDRESS=${deployment.address}\n`;
        } else if (deployment.version === 'NEW' && deployment.upgraded && deployment.contractName === 'InfinexProtocolConfigBeacon') { // @YINGLI Remove this later should have both beacons
          output += `${chainNameKey.toUpperCase()}_${contractName}_ADDRESS=${deployment.address}\n`;
        }
      }
      output += "\n";
    }
  }

  return output;
}

const versionedDeployments: CannonDeployment[] = Object.entries(
  types.ChainNameMapping
)
  .filter(([, chainName]) =>
    IncludeChains.includes(chainName as types.EvmChains)
  )
  .map(([chainId]) => ({
    chainId: chainId,
    preset: PackagePreset,
    name: PackageScope,
    version: PackageVersion,
  }));

const allDeployments = [...versionedDeployments];

const outputPath = path.resolve(__dirname, "./deployments");

(async () => {
  await fs.mkdir(outputPath, { recursive: true });
  const artifacts = await getPublishedContracts(allDeployments);
  const formattedOutput = formatOutput(artifacts);
  const filePath = path.join(outputPath, "addresses.txt");
  await fs.writeFile(filePath, formattedOutput);
})();
