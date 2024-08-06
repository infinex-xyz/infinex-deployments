# Infinex Deployments

This is a GitOps repo for deployment of the [Infinex](https://www.github.com/infinex-io/infinex-contracts) protocol.

## Deployment Guide

- build the toolchain container `podman build --tag localhost/evm-contracts-toolchain:latest .`
- Run `./run pnpm install` to install all the dependencies
- Run `./run pnpm cannon setup` and ensure you have a reliable IPFS url for publishing. Recommended to use "https://au-east.repo.usecannon.com".
- After publishing new versions of the provisioned package [Infinex](https://usecannon.com/packages/infinex), bump the version throughout the cannonfiles to match.
- If deploying to a new chain, create a new toml file following the  naming convention: `infinex-multichain-chain-toml`.

	Eg: `infinex-multichain-base-goerli.toml`

### Pre-deployment checks

	Each network should have its own cannnonfile.
- Add new settings and invoke actions as necessary.
- Increment the version number and update the values in the network-specific multi-chain cannonfiles as desired. The main version should match Infinex version, and if it is a configuration change on the same version use a dash. Eg:
	- Version: 3.3.5
  - Version with config changes: 3.3.5-1
- Check that the addresses and settings match the chain and intended wallets are correct.
- To make sure a toml file setup is correct the build command can be run using the `--dry-run` option. This will simulate a build and won't publish anything.

`./run pnpm cannon build TOML_FILE --chain-id CHAIN_ID --provider-url PROVIDER_URL --dry-run`

- When everything is building correctly and the contracts are ready to be deployed the build command can be run using `--private-key` in order to specify the private key of the deployer wallet. Please note that the wallet should have ETH on the targeted chain.

- If the deployment is an upgrade from a previous version, the `--upgrade-from infinex-multichain:PREVIOUS_VERSION` command will be required. This command will most likely be required for every new deployment of a package.

`./run pnpm cannon build TOML_FILE --chain-id CHAIN_ID --provider-url PROVIDER_URL --private-key PRIVATE_KEY --upgrade-from infinex-multichain:PREVIOUS_VERSION`

## Publish a new deployment on Cannon

When a deployment is successful the last step is to publish it to Cannon. It can be done using the `cannon publish` command:

`./run pnpm cannon publish infinex-multichain:VERSION --chain-id CHAIN_ID --private-key PRIVATE_KEY`

with:
- VERSION: the version of the package. Eg: `infinex-multichain:0.0.1`.
- PRIVATE_KEY: a wallet owning the rights to publish to the Cannon registry.

Note: publishing to Cannon registry happens on Ethereum Mainnet, meaning the wallet needs to have ETH, even if the deployment happened on another chain.


## Deployment and actions involving a Multisig

- If any of the invoke actions require the signer to be a different wallet from the deployer (usually when a contract is owned by a multisig), Cannon will still deploy the contracts and save the transactions it cannot execute for later. When the deployment ends a warning will show up asking the user to run a pin command:

`./run pnpm cannon pin ipfs://IPFS_HASH`

- Make sure to save the IPFS hash for later as it will be needed to complete the deployment.

- Go to https://usecannon.com/deploy

- In the settings section (the cogwheel icon in the top right), paste the IPFS URL used for the deployment. Note: this is the IPFS hash used in the local cannon config, not the one which was pinned in the step before.

- In the `Queue Cannonfile` tab, provide:
	- Cannonfile: the Github URL pointing to the toml file used with the deployment. Because of a current caching issue, it is usually safer to use a new branch every time. This branch can then be merged after the deployment is complete. Make sure the Github repository is public otherwise the website won't be able to access the file.
	- Partial Deployment Data: the IPFS hash saved in the previous step.

- Make sure that the website's network is switched to the correct chain (the one the deployment was targeting) and that a wallet with rights to execute (owner or signer in a multisig) is connected.

- After all the data is fetched (it can take several minutes) the Preview Transactions to Queue button is enabled. This will allow the signers to execute the remaining transactions and complete the deployment.

- In the "Sign & Execute" tab, the list of all transactions will be visible.

- It is possible for the wallet with publishing rights to click on "Publish to Registry" in a transaction page. As explained in the Publishing section, publishing to the Cannon registry will happen on Mainnet. So for the button to be enabled, the website will need to be connected on Ethereum Mainnet.

## Verifying contracts

It is possible for Cannon to verify freshly deployed contracts, using the following command:

`./run pnpm cannon verify infinex-multichain:VERSION -c CHAIN_ID --api-key ETHERSCAN_KEY`


## How to upgrade a package where the implementation being used for a proxy has changed
This process involves multiple steps, not just a simple `--upgrade-from` due to the proxy bytecode differing with a new implementation. This makes cannon think that the proxy needs to be deployed again, since the bytecode has changed.

1. Build the cannonfile in the contracts repo as normal.

2. In the deployments repo (this repo), update the deployment cannonfile to use the new version of the locally built cannonfile. This means setting the `source` and `target` of the clone step to use the package name of the cannonfile from the contracts repo. e.g. `source = "infinex-governance-points:2.0.0@stw"`

3. When building the new deployment, cannon will think that it needs to retry some of the steps which it has already completed in the previous deployment. To solve this, we use `cannon alter` to tell the new deployment that it doesn't need to do those steps. This is the command you'll need to run:

```
pnpm cannon alter --subpkg [CLONE_STEP_FROM_DEPLOYMENT_FILE] [PACKAGE_TO_UPGRADE_FROM] mark-complete [CANNON_STEP_TO_SKIP] --chain-id [CHAIN_ID_OF_DEPLOYMENT]
```

Let's break down what this command is doing. We are running `cannon alter` on the `PACKAGE_TO_UPGRADE_FROM`. What this does is marks the steps from the `PACKAGE_TO_UPGRADE_FROM` that don't need to be repeated when upgrading from it. You need to specify the `CLONE_STEP_FROM_DEPLOYMENT_FILE` to tell cannon where to find the `CANNON_STEP_TO_SKIP`, since this is where the step is being imported from.


e.g. To mark the `GovernancePointsProxy` deploy step in the previous deployment so that it doesn't attempt it again in the new deployment, run this command:

```
pnpm cannon alter --subpkg clone.InfinexGovernancePoints infinex-gp:0.1.7@StW mark-complete deploy.GovernancePointsProxy --chain-id 84532
```

At no point should you be referencing the locally built cannonfile. This should only be referenced in the deployment file in the source/target of the clone.

4. The output of the alter command should be an ipfs url. If it comes up with `Cannot read properties of null`, that means you've got an invalid reference somewhere. Now you are ready to run the `build` command using the output from the `alter` command.

```
pnpm cannon build [FILE_PATH_OF_DEPLOYMENT_FILE] --chain-id [CHAIN_ID_OF_DEPLOYMENT] --registry-priority local --upgrade-from @ipfs:[IPFS_CONTENT_HASH] --private-key [PRIVATE_KEY] 
```

Let's break down what this command is doing. `cannon build` is deploying the `FILE_PATH_OF_DEPLOYMENT_FILE` cannonfile to the `CHAIN_ID_OF_DEPLOYMENT` specified. When it does so, we want the steps it's importing from the `clone` source/target to be sourced from our local `registry-priority` so it finds our newly built local package, rather than try to look for it on the cannon registry, because it hasn't been published yet. We specify `upgrade-from` to tell cannon that we will be upgrading this from an existing deployment and that it doesn't need to run all the steps. It looks at `IPFS_CONTENT_HASH`, the output of `alter`, to know which steps it doesn't need to repeat. `PRIVATE_KEY` is the key used to deploy these contracts.

e.g. To deploy the new version of governance points on base sepolia, here's what it would look like.

```
pnpm cannon build infinex-governance-points/testnets/infinex-governance-points-base-sepolia.toml --chain-id 84532 --registry-priority local --upgrade-from @ipfs:QmWkKsLAAew35yVUbjkCBUtWWHGvyXHALZkZG8iTTBj4r3 --private-key [PRIVATE_KEY] 
```

## useful commands
 ```
  pnpm cannon alter --chain-id 421614 --subpkg clone.infinex infinex-multichain:0.1.7@O2 mark-complete deploy.Forwarder deploy.AccountFactory invoke.AccountFactoryInitialize deploy.InitialProxyImplementation
  ```
   generates an IPFS url that can be upgraded from if steps are executing that shouldn't. Cannon checks and redeploys a contract if the bytecode has changed, which can be for many reasons, including a different compiler version.

   e.g. upgrade to function would reference the generated ipfs url 

```
 pnpm cannon build infinex-multichain/testnet/infinex-multichain-arbitrum-sepolia.toml --chain-id 421614 --private-key  XXXX --upgrade-from @ipfs:QmcU78qLgucSaPerrJqYEaanMCNVZhZbBgSiyGgcyvcpy3 --registry-priority local
```

also, when publishing, adding ` --tags 1.0.0` ensures that a package only gets published with the specified space separated tags, and not default which includes latest


