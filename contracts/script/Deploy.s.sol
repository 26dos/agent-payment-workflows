// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/USD1Mock.sol";
import "../src/DIDRegistry.sol";
import "../src/ReputationScore.sol";
import "../src/DynamicPricing.sol";
import "../src/InsurancePool.sol";
import "../src/ClawPayEscrow.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts with deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy USD1Mock
        USD1Mock usd1 = new USD1Mock();
        console.log("USD1Mock deployed at:", address(usd1));

        // 2. Deploy DIDRegistry
        DIDRegistry didRegistry = new DIDRegistry();
        console.log("DIDRegistry deployed at:", address(didRegistry));

        // 3. Deploy ReputationScore
        ReputationScore reputationScore = new ReputationScore(address(didRegistry));
        console.log("ReputationScore deployed at:", address(reputationScore));

        // 4. Deploy DynamicPricing
        DynamicPricing dynamicPricing = new DynamicPricing(address(reputationScore));
        console.log("DynamicPricing deployed at:", address(dynamicPricing));

        // 5. Deploy InsurancePool
        InsurancePool insurancePool = new InsurancePool(address(usd1));
        console.log("InsurancePool deployed at:", address(insurancePool));

        // 6. Deploy ClawPayEscrow
        ClawPayEscrow escrow = new ClawPayEscrow(
            address(usd1),
            address(didRegistry),
            address(reputationScore),
            address(dynamicPricing),
            address(insurancePool)
        );
        console.log("ClawPayEscrow deployed at:", address(escrow));

        // 7. Setup permissions
        // Authorize Escrow to update reputation scores
        reputationScore.setAuthorizedUpdater(address(escrow), true);
        console.log("Escrow authorized to update reputation scores");

        // Authorize Escrow to use insurance pool
        insurancePool.setAuthorizedContract(address(escrow), true);
        console.log("Escrow authorized to use insurance pool");

        vm.stopBroadcast();

        // Output deployment addresses for frontend config
        console.log("\n=== Deployment Summary ===");
        console.log("USD1Mock:", address(usd1));
        console.log("DIDRegistry:", address(didRegistry));
        console.log("ReputationScore:", address(reputationScore));
        console.log("DynamicPricing:", address(dynamicPricing));
        console.log("InsurancePool:", address(insurancePool));
        console.log("ClawPayEscrow:", address(escrow));
    }
}
