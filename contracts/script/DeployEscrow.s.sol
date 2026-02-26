// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ClawPayEscrow.sol";
import "../src/ReputationScore.sol";
import "../src/InsurancePool.sol";

contract DeployEscrowScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Contract addresses
        address usd1 = 0x8b4C6b67976D9863FD56f6fFF140e501d838a758;
        address dualDIDRegistry = 0x9A919E20Ae135BAfC12bb7620cff5F2d4c8FCd69;
        address reputationScore = 0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2;
        address dynamicPricing = 0x28dBC4F5d362A3778F5492f1623C1777e8b24529;
        address insurancePool = 0x8E0Ea2482196e4CcFDdB601E007BCa9AFe71Df75;

        console.log("Deploying new ClawPayEscrow with deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        ClawPayEscrow escrow = new ClawPayEscrow(
            usd1,
            dualDIDRegistry,
            reputationScore,
            dynamicPricing,
            insurancePool
        );
        console.log("New ClawPayEscrow deployed at:", address(escrow));

        ReputationScore(reputationScore).setAuthorizedUpdater(address(escrow), true);
        console.log("Escrow authorized to update reputation scores");

        InsurancePool(insurancePool).setAuthorizedContract(address(escrow), true);
        console.log("Escrow authorized to use insurance pool");

        escrow.setArbitrationWallet(deployer);
        console.log("Arbitration wallet set to:", deployer);

        vm.stopBroadcast();

        console.log("\n=== Update your .env files with: ===");
        console.log("ESCROW_ADDRESS=", address(escrow));
    }
}
