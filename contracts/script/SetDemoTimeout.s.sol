// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ClawPayEscrow.sol";

contract SetDemoTimeout is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address escrowAddress = vm.envAddress("ESCROW_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ClawPayEscrow escrow = ClawPayEscrow(escrowAddress);
        
        // Set demo timeouts: 5 minutes each
        uint256 demoTimeout = 5 minutes;
        
        escrow.setDisputeTimeout(demoTimeout);
        escrow.setCompletionTimeout(demoTimeout);
        
        console.log("Demo timeouts set to 5 minutes");
        console.log("Dispute timeout:", escrow.disputeTimeout());
        console.log("Completion timeout:", escrow.completionTimeout());
        
        vm.stopBroadcast();
    }
}
