// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/USD1Mock.sol";
import "../src/DualDIDRegistry.sol";
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

        // 2. Deploy DualDIDRegistry
        DualDIDRegistry dualDIDRegistry = new DualDIDRegistry(deployer);
        console.log("DualDIDRegistry deployed at:", address(dualDIDRegistry));

        // 3. Deploy ReputationScore (using address(0) for old DIDRegistry)
        ReputationScore reputationScore = new ReputationScore(address(0));
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
            address(dualDIDRegistry),
            address(reputationScore),
            address(dynamicPricing),
            address(insurancePool)
        );
        console.log("ClawPayEscrow deployed at:", address(escrow));

        // 7. Setup permissions
        reputationScore.setAuthorizedUpdater(address(escrow), true);
        console.log("Escrow authorized to update reputation scores");

        insurancePool.setAuthorizedContract(address(escrow), true);
        console.log("Escrow authorized to use insurance pool");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("USD1Mock:", address(usd1));
        console.log("DualDIDRegistry:", address(dualDIDRegistry));
        console.log("ReputationScore:", address(reputationScore));
        console.log("DynamicPricing:", address(dynamicPricing));
        console.log("InsurancePool:", address(insurancePool));
        console.log("ClawPayEscrow:", address(escrow));
    }
}
