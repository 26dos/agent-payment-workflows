// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DualDIDRegistry.sol";
import "../src/PremiumDIDAuction.sol";

contract DeployDualDIDScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying DualDID contracts with deployer:", deployer);

        // Use existing USD1 address from env or default
        address usd1Address = vm.envOr("USD1_ADDRESS", address(0x8b4C6b67976D9863FD56f6fFF140e501d838a758));
        
        // Treasury, incentive pool, operations addresses (use deployer for testing)
        address treasury = deployer;
        address incentivePool = deployer;
        address operations = deployer;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DualDIDRegistry
        DualDIDRegistry dualDIDRegistry = new DualDIDRegistry(treasury);
        console.log("DualDIDRegistry deployed at:", address(dualDIDRegistry));

        // 2. Add USD1 as supported payment token
        dualDIDRegistry.setPaymentToken(usd1Address, true);
        console.log("USD1 added as payment token:", usd1Address);

        // 3. Deploy PremiumDIDAuction
        PremiumDIDAuction premiumDIDAuction = new PremiumDIDAuction(
            address(dualDIDRegistry),
            treasury,
            incentivePool,
            operations
        );
        console.log("PremiumDIDAuction deployed at:", address(premiumDIDAuction));

        // 4. Add USD1 as supported payment token in auction
        premiumDIDAuction.setPaymentToken(usd1Address, true);
        console.log("USD1 added as auction payment token");

        // 5. Authorize auction contract to manage DIDs
        dualDIDRegistry.setAuthorizedContract(address(premiumDIDAuction), true);
        console.log("PremiumDIDAuction authorized in DualDIDRegistry");

        // 6. Create some sample premium DIDs for testing
        console.log("\nCreating sample premium DIDs...");
        
        // SSS tier
        dualDIDRegistry.createPremiumDID("0001-AAAA", DualDIDRegistry.DIDTier.TierSSS);
        console.log("Created SSS tier: 0001-AAAA");
        
        // SS tier
        dualDIDRegistry.createPremiumDID("1234-ABCD", DualDIDRegistry.DIDTier.TierSS);
        console.log("Created SS tier: 1234-ABCD");
        
        // S tier
        dualDIDRegistry.createPremiumDID("0088-LUCK", DualDIDRegistry.DIDTier.TierS);
        console.log("Created S tier: 0088-LUCK");
        
        // A tier
        dualDIDRegistry.createPremiumDID("1000-KING", DualDIDRegistry.DIDTier.TierA);
        console.log("Created A tier: 1000-KING");
        
        // B tier
        dualDIDRegistry.createPremiumDID("0123-ABBA", DualDIDRegistry.DIDTier.TierB);
        console.log("Created B tier: 0123-ABBA");

        vm.stopBroadcast();

        // Output deployment addresses
        console.log("\n=== DualDID Deployment Summary ===");
        console.log("DualDIDRegistry:", address(dualDIDRegistry));
        console.log("PremiumDIDAuction:", address(premiumDIDAuction));
        console.log("Treasury:", treasury);
        console.log("IncentivePool:", incentivePool);
        console.log("Operations:", operations);
        console.log("\nUpdate frontend/.env.local with:");
        console.log("NEXT_PUBLIC_DUAL_DID_REGISTRY_ADDRESS=", address(dualDIDRegistry));
        console.log("NEXT_PUBLIC_PREMIUM_DID_AUCTION_ADDRESS=", address(premiumDIDAuction));
    }
}
