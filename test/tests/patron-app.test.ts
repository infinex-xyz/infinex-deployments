

import { env,loadToml, getClient, getNetworkName, getContractSDK, getEnvConfig } from "../lib/utils";
import { PatronPurchaseAppBeacon,
         PatronPointOfPurchase, 
         PatronPurchaseVault, 
         } from '../lib/abis';
import { describe, expect, test } from "vitest";
import { Address } from "viem";
import { evmChainKeys } from "@infinex/evm-sdk";

// Hardcoded additional assets for assertions
const hardcodedAssets: Record<string, Record<number, Address[]>> = {
    assets: {
      42161: [
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" // WETH
        ],
      8453: [
        "0x4200000000000000000000000000000000000006" // WETH
        ],
      1: [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" // WETH
        ],
      10: [
        "0x4200000000000000000000000000000000000006" // WETH
        ],
      137: [
        "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" // WETH
    ],
    },
  };
  

describe.concurrent.each(evmChainKeys.filter((x) => x !== "blast"))(
    `Patron Purchase (%s ${env})`,
    async (chainName) => {
        console.log(chainName);
        var config: any;

        const CHAIN = chainName.toUpperCase();
        const client = getClient(chainName);
        const chainId = await client.getChainId();
        const networkName = await getNetworkName(client);
        const configDir = `../infinex-patron/patron-purchase-app/${env}`
        const envConfig = getEnvConfig(env);

        if(env === "mainnets") {
            config = await loadToml(
                `${configDir}/infinex-patron.${networkName}.toml`
            )
        } else {
            config = await loadToml(
                `${configDir}/infinex-patron-test.${networkName}.toml`
            )
        }

        const patronPurchaseAppBeacon = getContractSDK(
             envConfig,
             client,
             `${CHAIN}_PATRON_PURCHASE_APP_BEACON`,
             PatronPurchaseAppBeacon
        );

        const patronPointOfPurchase = getContractSDK(
            envConfig,
            client,
            `${CHAIN}_PATRON_POINT_OF_PURCHASE`,
            PatronPointOfPurchase
        )

        let tokenList:Address[] = [];
        let signersList:Address[] = [];
        let vaultList:Address[] = [];

        const patronVars = config.var.PATRON;

        for (let key in patronVars) {
            if(patronVars.hasOwnProperty(key)) {
                if(key.includes('TOKEN') || key.includes('ETHER')) {
                    tokenList.push(patronVars[key]);
                }
                if(key.includes('AUTHORIZED_SIGNER')) {
                    signersList.push(patronVars[key]);
                }
                if(key.includes('VAULT') || key.includes('MULTISIG')) { // testnet vaults have to be hardcoded.
                    vaultList.push(patronVars[key]);
                }
            }
        }

        let extraAssets:Address[] = hardcodedAssets.assets[chainId] ?? [];

        if(!extraAssets.length)
            tokenList = [...tokenList, ...extraAssets];


        // Expect the beacon points to the correct point of purchase
        expect(await patronPurchaseAppBeacon.read.patronPointOfPurchase()).toBe(patronPointOfPurchase.address);

        // Expect

        test("Supported Tokens, set correctly", async () => {
            for(let i = 0; i < tokenList.length; i++) {
                expect(await patronPointOfPurchase.read.isAuthorizedPurchaseToken([tokenList[i]])).toBe(true);
            }
        });

        test("Authorized Signer, set correctly", async () => {
            for(let i = 0; i < signersList.length; i++) {
                expect(await patronPointOfPurchase.read.isAuthorizedSigner([signersList[i]])).toBe(true);
            }
        });

        test("Authorized Vaults, set correctly", async () => {
            for(let i = 0; i < vaultList.length; i++) {
                expect(await patronPointOfPurchase.read.authorizedPurchaseVaults([i])).toBe(vaultList[i]);
            }
        });

        test("Check Ownership Transferred Successfully App Beacon", async () => {
          const owner = await patronPurchaseAppBeacon.read.owner();
          const expectedOwner = vaultList[0];
          expect(owner).toBe(expectedOwner);
        });

        test("Check Ownership Transferred Successfully Patron Point of Purchase", async () => {
            const owner = await patronPointOfPurchase.read.owner();
            const expectedOwner = vaultList[0];
            expect(owner).toBe(expectedOwner);
        });

    }
)