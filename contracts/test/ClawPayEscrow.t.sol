// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/USD1Mock.sol";
import "../src/DIDRegistry.sol";
import "../src/ReputationScore.sol";
import "../src/DynamicPricing.sol";
import "../src/InsurancePool.sol";
import "../src/ClawPayEscrow.sol";

contract ClawPayEscrowTest is Test {
    USD1Mock public usd1;
    DIDRegistry public didRegistry;
    ReputationScore public reputationScore;
    DynamicPricing public dynamicPricing;
    InsurancePool public insurancePool;
    ClawPayEscrow public escrow;

    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);

    bytes32 public aliceHumanDID;
    bytes32 public bobHumanDID;
    bytes32 public aliceAgentDID;
    bytes32 public bobAgentDID;

    function setUp() public {
        // Deploy contracts
        usd1 = new USD1Mock();
        didRegistry = new DIDRegistry();
        reputationScore = new ReputationScore(address(didRegistry));
        dynamicPricing = new DynamicPricing(address(reputationScore));
        insurancePool = new InsurancePool(address(usd1));
        escrow = new ClawPayEscrow(
            address(usd1),
            address(didRegistry),
            address(reputationScore),
            address(dynamicPricing),
            address(insurancePool)
        );

        // Setup permissions
        reputationScore.setAuthorizedUpdater(address(escrow), true);
        insurancePool.setAuthorizedContract(address(escrow), true);

        // Setup Alice
        vm.startPrank(alice);
        aliceHumanDID = didRegistry.registerHumanDID('{"name":"Alice"}');
        aliceAgentDID = didRegistry.registerAgentDID(aliceHumanDID, "AliceAgent");
        didRegistry.createMandate(aliceAgentDID, 1000 * 1e6, 100 * 1e6, block.timestamp + 30 days);
        vm.stopPrank();

        // Setup Bob
        vm.startPrank(bob);
        bobHumanDID = didRegistry.registerHumanDID('{"name":"Bob"}');
        bobAgentDID = didRegistry.registerAgentDID(bobHumanDID, "BobAgent");
        didRegistry.createMandate(bobAgentDID, 1000 * 1e6, 100 * 1e6, block.timestamp + 30 days);
        vm.stopPrank();

        // Give Alice some USD1
        usd1.mint(alice, 10000 * 1e6);

        // Initialize reputation scores
        reputationScore.initializeHumanScore(aliceHumanDID);
        reputationScore.initializeHumanScore(bobHumanDID);
        reputationScore.initializeAgentScore(aliceAgentDID);
        reputationScore.initializeAgentScore(bobAgentDID);
    }

    function test_CreateTask() public {
        uint256 baseFee = 10 * 1e6; // 10 USD1

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);

        uint256 taskId = escrow.createTask(
            aliceAgentDID,
            bobAgentDID,
            baseFee,
            1, // L1 complexity
            "Test task"
        );
        vm.stopPrank();

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(task.requesterDID, aliceAgentDID);
        assertEq(task.providerDID, bobAgentDID);
        assertEq(task.baseFee, baseFee);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Created));
    }

    function test_AcceptTask() public {
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);
        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test task");
        vm.stopPrank();

        vm.prank(bob);
        escrow.acceptTask(taskId);

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Accepted));
        assertTrue(task.acceptedAt > 0);
    }

    function test_CompleteTask() public {
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);
        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test task");
        vm.stopPrank();

        vm.prank(bob);
        escrow.acceptTask(taskId);

        uint256 bobBalanceBefore = usd1.balanceOf(bob);

        vm.prank(alice);
        escrow.completeTask(taskId);

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Completed));

        // Bob should have received payment (minus protocol fee)
        uint256 expectedPayment = task.finalAmount - (task.finalAmount * 10 / 10000);
        assertEq(usd1.balanceOf(bob), bobBalanceBefore + expectedPayment);
    }

    function test_CancelTask() public {
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);
        uint256 aliceBalanceBefore = usd1.balanceOf(alice);

        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test task");
        uint256 aliceBalanceAfterCreate = usd1.balanceOf(alice);

        escrow.cancelTask(taskId);
        vm.stopPrank();

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Cancelled));

        // Alice should get full refund
        assertEq(usd1.balanceOf(alice), aliceBalanceBefore);
    }

    function test_RaiseDispute() public {
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);
        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test task");
        vm.stopPrank();

        vm.prank(bob);
        escrow.acceptTask(taskId);

        vm.prank(alice);
        escrow.raiseDispute(taskId, "Work not delivered");

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Disputed));

        ClawPayEscrow.Dispute memory dispute = escrow.getDispute(taskId);
        assertEq(dispute.raisedBy, aliceAgentDID);
        assertFalse(dispute.resolved);
    }

    function test_ResolveDispute() public {
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);
        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test task");
        vm.stopPrank();

        vm.prank(bob);
        escrow.acceptTask(taskId);

        vm.prank(alice);
        escrow.raiseDispute(taskId, "Work not delivered");

        ClawPayEscrow.Task memory taskBefore = escrow.getTask(taskId);
        uint256 aliceBalanceBefore = usd1.balanceOf(alice);
        uint256 bobBalanceBefore = usd1.balanceOf(bob);

        // Resolve: 70% to requester, 30% to provider
        escrow.resolveDispute(taskId, 70);

        ClawPayEscrow.Task memory task = escrow.getTask(taskId);
        assertEq(uint8(task.status), uint8(ClawPayEscrow.TaskStatus.Resolved));

        // Check distributions
        uint256 expectedAlice = (taskBefore.finalAmount * 70) / 100;
        uint256 expectedBob = taskBefore.finalAmount - expectedAlice;

        assertEq(usd1.balanceOf(alice), aliceBalanceBefore + expectedAlice);
        assertEq(usd1.balanceOf(bob), bobBalanceBefore + expectedBob);
    }

    function test_DynamicPricing() public {
        // Test that complexity affects pricing
        uint256 baseFee = 10 * 1e6;

        uint256 priceL1 = dynamicPricing.calculatePrice(bobAgentDID, baseFee, 1);
        uint256 priceL2 = dynamicPricing.calculatePrice(bobAgentDID, baseFee, 2);
        uint256 priceL3 = dynamicPricing.calculatePrice(bobAgentDID, baseFee, 3);

        // L2 should be 1.5x L1, L3 should be 2.5x L1
        assertEq(priceL2, priceL1 * 15 / 10);
        assertEq(priceL3, priceL1 * 25 / 10);
    }

    function test_ReputationScoring() public {
        // Initial score should be 75.00 (7500 with 2 decimals)
        uint256 aliceScore = reputationScore.getHumanScore(aliceHumanDID);
        assertEq(aliceScore, 7500);

        // Final score should be weighted
        uint256 finalScore = reputationScore.getFinalScore(aliceAgentDID);
        // (7500 * 0.7) + (7500 * 0.3) = 7500
        assertEq(finalScore, 7500);
    }

    function test_MandateValidation() public {
        // Create task within mandate limits
        uint256 baseFee = 10 * 1e6;

        vm.startPrank(alice);
        usd1.approve(address(escrow), 100 * 1e6);

        // Should succeed
        uint256 taskId = escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test");
        assertTrue(taskId == 0);
        vm.stopPrank();
    }

    function test_MandateValidation_ExceedsSingleLimit() public {
        uint256 baseFee = 200 * 1e6; // Exceeds single limit of 100

        vm.startPrank(alice);
        usd1.approve(address(escrow), 300 * 1e6);

        vm.expectRevert("ClawPayEscrow: mandate validation failed");
        escrow.createTask(aliceAgentDID, bobAgentDID, baseFee, 1, "Test");
        vm.stopPrank();
    }
}
