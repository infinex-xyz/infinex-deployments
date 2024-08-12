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


## useful commands
 ```
  CANNON_REGISTRY_PRIORITY=local pnpm cannon alter --chain-id 421614  --subpkg clone.infinex infinex-multichain:0.1.7@O2 mark-complete deploy.Forwarder deploy.AccountFactory invoke.AccountFactoryInitialize deploy.InitialProxyImplementation
  ```
   generates an IPFS url that can be upgraded from if steps are executing that shouldn't. Cannon checks and redeploys a contract if the bytecode has changed, which can be for many reasons, including a different compiler version.

   e.g. upgrade to function would reference the generated ipfs url 

```
 CANNON_REGISTRY_PRIORITY=local pnpm cannon build infinex-multichain/testnet/infinex-multichain-arbitrum-sepolia.toml --chain-id 421614 --private-key  XXXX --upgrade-from @ipfs:QmcU78qLgucSaPerrJqYEaanMCNVZhZbBgSiyGgcyvcpy3
```

also, when publishing, adding ` --tags 1.0.0` ensures that a package only gets published with the specified space separated tags, and not default which includes latest

## Debugging Tips

You can run javascript in the cannonfile string arguments, which allows you to log the variables to the console. By including the OR symbol, it'll both log it and use the value.
`args = ["<%= console.log(JSON.stringify(imports, null, 2)) || imports.latestVersion.imports.infinex.contracts.InfinexProtocolConfigBeacon.address %>"]`