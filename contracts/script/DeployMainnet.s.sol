// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DualDIDRegistry.sol";
import "../src/ReputationScore.sol";
import "../src/DynamicPricing.sol";
import "../src/InsurancePool.sol";
import "../src/ClawPayEscrow.sol";
import "../src/PremiumDIDAuction.sol";
import "../src/IncentiveSystem.sol";
import "../src/TaskSpecification.sol";

contract DeployMainnetScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address usd1 = vm.envAddress("USD1_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address incentivePool = vm.envAddress("INCENTIVE_POOL_ADDRESS");
        address operations = vm.envAddress("OPERATIONS_ADDRESS");

        console.log("=== BSC Mainnet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("USD1:", usd1);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DualDIDRegistry
        DualDIDRegistry dualDIDRegistry = new DualDIDRegistry(treasury);
        console.log("1. DualDIDRegistry deployed at:", address(dualDIDRegistry));

        // 2. Deploy ReputationScore
        ReputationScore reputationScore = new ReputationScore(address(dualDIDRegistry));
        console.log("2. ReputationScore deployed at:", address(reputationScore));

        // 3. Deploy DynamicPricing
        DynamicPricing dynamicPricing = new DynamicPricing(address(reputationScore));
        console.log("3. DynamicPricing deployed at:", address(dynamicPricing));

        // 4. Deploy InsurancePool
        InsurancePool insurancePool = new InsurancePool(usd1);
        console.log("4. InsurancePool deployed at:", address(insurancePool));

        // 5. Deploy IncentiveSystem
        IncentiveSystem incentiveSystem = new IncentiveSystem(address(dualDIDRegistry), address(reputationScore));
        console.log("5. IncentiveSystem deployed at:", address(incentiveSystem));

        // 6. Deploy TaskSpecification
        TaskSpecification taskSpecification = new TaskSpecification(address(dualDIDRegistry), address(reputationScore));
        console.log("6. TaskSpecification deployed at:", address(taskSpecification));

        // 7. Deploy PremiumDIDAuction
        PremiumDIDAuction premiumDIDAuction = new PremiumDIDAuction(
            address(dualDIDRegistry),
            treasury,
            incentivePool,
            operations
        );
        console.log("7. PremiumDIDAuction deployed at:", address(premiumDIDAuction));

        // 8. Deploy ClawPayEscrow
        ClawPayEscrow escrow = new ClawPayEscrow(
            usd1,
            address(dualDIDRegistry),
            address(reputationScore),
            address(dynamicPricing),
            address(insurancePool)
        );
        console.log("8. ClawPayEscrow deployed at:", address(escrow));

        // ============ Setup Permissions ============
        console.log("\n=== Setting up permissions ===");

        // ReputationScore permissions
        reputationScore.setAuthorizedUpdater(address(escrow), true);
        console.log("- Escrow authorized in ReputationScore");

        // InsurancePool permissions
        insurancePool.setAuthorizedContract(address(escrow), true);
        console.log("- Escrow authorized in InsurancePool");

        // DynamicPricing permissions
        dynamicPricing.setAuthorizedContract(address(escrow), true);
        console.log("- Escrow authorized in DynamicPricing");

        // TaskSpecification permissions
        taskSpecification.setAuthorizedContract(address(escrow), true);
        console.log("- Escrow authorized in TaskSpecification");

        // IncentiveSystem permissions
        incentiveSystem.setAuthorizedCaller(address(escrow), true);
        console.log("- Escrow authorized in IncentiveSystem");

        // DualDIDRegistry - authorize auction contract
        dualDIDRegistry.setAuthorizedContract(address(premiumDIDAuction), true);
        console.log("- PremiumDIDAuction authorized in DualDIDRegistry");

        // PremiumDIDAuction - set USD1 as supported payment token
        premiumDIDAuction.setPaymentToken(usd1, true);
        console.log("- USD1 set as payment token in PremiumDIDAuction");

        // DualDIDRegistry - set USD1 as supported payment token
        dualDIDRegistry.setPaymentToken(usd1, true);
        console.log("- USD1 set as payment token in DualDIDRegistry");

        // Set escrow contract reference in ClawPayEscrow
        escrow.setIncentiveSystem(address(incentiveSystem));
        escrow.setTaskSpecification(address(taskSpecification));
        console.log("- IncentiveSystem and TaskSpecification set in Escrow");

        // ============ Configure Production Settings ============
        console.log("\n=== Configuring production settings ===");

        // Set auction duration to 2 days
        premiumDIDAuction.setShortDisplayIdAuctionDuration(2 days);
        console.log("- Auction duration set to 2 days");

        // Set transfer fee to 1%
        dualDIDRegistry.setTransferFeeBps(100);
        console.log("- Transfer fee set to 1%");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("=== MAINNET DEPLOYMENT SUMMARY ===");
        console.log("========================================");
        console.log("DualDIDRegistry:    ", address(dualDIDRegistry));
        console.log("ReputationScore:    ", address(reputationScore));
        console.log("DynamicPricing:     ", address(dynamicPricing));
        console.log("InsurancePool:      ", address(insurancePool));
        console.log("IncentiveSystem:    ", address(incentiveSystem));
        console.log("TaskSpecification:  ", address(taskSpecification));
        console.log("PremiumDIDAuction:  ", address(premiumDIDAuction));
        console.log("ClawPayEscrow:      ", address(escrow));
        console.log("========================================");
        console.log("USD1 Token:         ", usd1);
        console.log("Treasury:           ", treasury);
        console.log("Auction Duration:    2 days");
        console.log("Transfer Fee:        1%");
        console.log("========================================");
    }
}
