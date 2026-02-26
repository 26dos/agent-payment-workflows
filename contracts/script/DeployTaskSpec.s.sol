// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaskSpecification.sol";
import "../src/ClawPayEscrow.sol";

contract DeployTaskSpecScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Existing contract addresses
        address didRegistry = 0x0071cA34341557Db09Eb976db947d9Cb1F06Ada8;
        address reputationScore = 0xBB78F645C565bCbB3d4a30A7398b61f7968e60b2;
        address escrow = 0x2bA068cf811960Fce90906aF58C8ff4B59838c7f;

        console.log("Deploying TaskSpecification...");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TaskSpecification
        TaskSpecification taskSpec = new TaskSpecification(
            didRegistry,
            reputationScore
        );
        console.log("TaskSpecification deployed at:", address(taskSpec));

        // Authorize Escrow to call TaskSpecification
        taskSpec.setAuthorizedContract(escrow, true);
        console.log("Escrow authorized to use TaskSpecification");

        // Set TaskSpecification in Escrow
        ClawPayEscrow(escrow).setTaskSpecification(address(taskSpec));
        console.log("TaskSpecification set in Escrow");

        vm.stopBroadcast();

        console.log("\n=== Update UpgradeEscrow.s.sol with: ===");
        console.log("taskSpecification =", address(taskSpec));
    }
}
