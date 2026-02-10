// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DIDRegistry.sol";
import "./ReputationScore.sol";
import "./DynamicPricing.sol";
import "./InsurancePool.sol";

/**
 * @title ClawPayEscrow
 * @dev Core escrow contract for ClawPay - handles task creation, fund locking, and settlement
 */
contract ClawPayEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum TaskStatus {
        Created, // Task created, funds locked
        Accepted, // Provider accepted
        Completed, // Requester confirmed completion
        Disputed, // Under dispute
        Resolved, // Dispute resolved
        Cancelled, // Cancelled before acceptance
        Expired // Expired without completion
    }

    // ============ Structs ============

    struct Task {
        bytes32 requesterDID; // Requester's Agent DID
        bytes32 providerDID; // Provider's Agent DID
        uint256 baseFee; // Base fee in USD1
        uint256 finalAmount; // Final calculated amount
        uint256 insurancePremium; // Premium collected for insurance
        uint8 complexity; // Task complexity level
        TaskStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 completedAt;
        uint256 expiryTime; // When task expires if not completed
        string metadata; // Task description/metadata (IPFS hash or JSON)
    }

    struct Dispute {
        bytes32 raisedBy; // DID that raised the dispute
        string reason;
        uint256 raisedAt;
        uint8 requesterPercent; // Resolution: % to requester (0-100)
        bool resolved;
    }

    // ============ State Variables ============

    IERC20 public usd1Token;
    DIDRegistry public didRegistry;
    ReputationScore public reputationScore;
    DynamicPricing public dynamicPricing;
    InsurancePool public insurancePool;

    // Task storage
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Dispute) public disputes;
    uint256 public taskCount;

    // Task expiry duration (default 7 days)
    uint256 public defaultExpiryDuration = 7 days;

    // Protocol fee (in basis points, 10 = 0.1%)
    uint256 public protocolFeeBps = 10;
    address public protocolFeeRecipient;

    // Premium split: what % of premium goes to pool vs refund on success
    uint256 public premiumToPoolPercent = 20; // 20% to pool, 80% refund on success

    // ============ Events ============

    event TaskCreated(
        uint256 indexed taskId,
        bytes32 indexed requesterDID,
        bytes32 indexed providerDID,
        uint256 baseFee,
        uint256 finalAmount,
        uint8 complexity
    );

    event TaskAccepted(uint256 indexed taskId, bytes32 indexed providerDID, uint256 acceptedAt);

    event TaskCompleted(uint256 indexed taskId, uint256 amountPaid, uint256 protocolFee);

    event TaskCancelled(uint256 indexed taskId, bytes32 cancelledBy);

    event TaskExpired(uint256 indexed taskId);

    event DisputeRaised(uint256 indexed taskId, bytes32 indexed raisedBy, string reason);

    event DisputeResolved(uint256 indexed taskId, uint8 requesterPercent, uint256 requesterAmount, uint256 providerAmount);

    // ============ Modifiers ============

    modifier taskExists(uint256 taskId) {
        require(taskId < taskCount, "ClawPayEscrow: task does not exist");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usd1Token,
        address _didRegistry,
        address _reputationScore,
        address _dynamicPricing,
        address _insurancePool
    ) Ownable(msg.sender) {
        usd1Token = IERC20(_usd1Token);
        didRegistry = DIDRegistry(_didRegistry);
        reputationScore = ReputationScore(_reputationScore);
        dynamicPricing = DynamicPricing(_dynamicPricing);
        insurancePool = InsurancePool(_insurancePool);
        protocolFeeRecipient = msg.sender;
    }

    // ============ Admin Functions ============

    function setProtocolFee(uint256 _feeBps, address _recipient) external onlyOwner {
        require(_feeBps <= 100, "ClawPayEscrow: max 1% fee");
        protocolFeeBps = _feeBps;
        protocolFeeRecipient = _recipient;
    }

    function setDefaultExpiryDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours && _duration <= 30 days, "ClawPayEscrow: invalid duration");
        defaultExpiryDuration = _duration;
    }

    function setPremiumToPoolPercent(uint256 _percent) external onlyOwner {
        require(_percent <= 100, "ClawPayEscrow: invalid percent");
        premiumToPoolPercent = _percent;
    }

    function setContracts(
        address _didRegistry,
        address _reputationScore,
        address _dynamicPricing,
        address _insurancePool
    ) external onlyOwner {
        didRegistry = DIDRegistry(_didRegistry);
        reputationScore = ReputationScore(_reputationScore);
        dynamicPricing = DynamicPricing(_dynamicPricing);
        insurancePool = InsurancePool(_insurancePool);
    }

    // ============ Task Creation ============

    /**
     * @dev Create a new escrow task
     * @param requesterDID Requester's Agent DID
     * @param providerDID Provider's Agent DID
     * @param baseFee Base fee in USD1 (6 decimals)
     * @param complexity Task complexity (1, 2, or 3)
     * @param metadata Task metadata (description, IPFS hash, etc.)
     * @return taskId The created task ID
     */
    function createTask(
        bytes32 requesterDID,
        bytes32 providerDID,
        uint256 baseFee,
        uint8 complexity,
        string calldata metadata
    ) external nonReentrant returns (uint256 taskId) {
        // Validate DIDs
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(requesterDID);
        DIDRegistry.AgentDID memory provider = didRegistry.getAgentDID(providerDID);
        require(requester.active, "ClawPayEscrow: requester DID not active");
        require(provider.active, "ClawPayEscrow: provider DID not active");

        // Verify sender is the requester's owner
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(requester.humanDID);
        require(humanDID.owner == msg.sender, "ClawPayEscrow: not requester owner");

        // Validate mandate
        require(didRegistry.validateMandate(requesterDID, baseFee), "ClawPayEscrow: mandate validation failed");

        // Calculate final price with dynamic pricing
        (uint256 finalAmount, uint256 kRep, uint256 kComp, uint256 kSD) =
            dynamicPricing.calculatePriceDetailed(providerDID, baseFee, complexity);

        // Calculate insurance premium if applicable
        uint256 premium = dynamicPricing.calculateInsurancePremium(providerDID, baseFee);

        // Total amount to lock = finalAmount + premium
        uint256 totalLock = finalAmount + premium;

        // Transfer funds from sender to escrow
        usd1Token.safeTransferFrom(msg.sender, address(this), totalLock);

        // Record spending against mandate
        didRegistry.recordSpending(requesterDID, totalLock);

        // Create task
        taskId = taskCount++;
        tasks[taskId] = Task({
            requesterDID: requesterDID,
            providerDID: providerDID,
            baseFee: baseFee,
            finalAmount: finalAmount,
            insurancePremium: premium,
            complexity: complexity,
            status: TaskStatus.Created,
            createdAt: block.timestamp,
            acceptedAt: 0,
            completedAt: 0,
            expiryTime: block.timestamp + defaultExpiryDuration,
            metadata: metadata
        });

        // Update pricing queue
        dynamicPricing.incrementPendingTasks();

        emit TaskCreated(taskId, requesterDID, providerDID, baseFee, finalAmount, complexity);
    }

    // ============ Task Lifecycle ============

    /**
     * @dev Provider accepts a task
     */
    function acceptTask(uint256 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "ClawPayEscrow: invalid status");
        require(block.timestamp < task.expiryTime, "ClawPayEscrow: task expired");

        // Verify sender is the provider's owner
        DIDRegistry.AgentDID memory provider = didRegistry.getAgentDID(task.providerDID);
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(provider.humanDID);
        require(humanDID.owner == msg.sender, "ClawPayEscrow: not provider owner");

        task.status = TaskStatus.Accepted;
        task.acceptedAt = block.timestamp;

        emit TaskAccepted(taskId, task.providerDID, block.timestamp);
    }

    /**
     * @dev Requester confirms task completion and releases funds
     */
    function completeTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "ClawPayEscrow: not accepted");

        // Verify sender is the requester's owner
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(task.requesterDID);
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(requester.humanDID);
        require(humanDID.owner == msg.sender, "ClawPayEscrow: not requester owner");

        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        // Calculate protocol fee
        uint256 protocolFee = (task.finalAmount * protocolFeeBps) / 10000;
        uint256 providerPayment = task.finalAmount - protocolFee;

        // Get provider's owner address
        DIDRegistry.AgentDID memory provider = didRegistry.getAgentDID(task.providerDID);
        DIDRegistry.HumanDID memory providerHuman = didRegistry.getHumanDID(provider.humanDID);

        // Pay provider
        usd1Token.safeTransfer(providerHuman.owner, providerPayment);

        // Pay protocol fee
        if (protocolFee > 0) {
            usd1Token.safeTransfer(protocolFeeRecipient, protocolFee);
        }

        // Handle insurance premium
        if (task.insurancePremium > 0) {
            uint256 toPool = (task.insurancePremium * premiumToPoolPercent) / 100;
            uint256 refund = task.insurancePremium - toPool;

            // Send portion to insurance pool
            if (toPool > 0) {
                usd1Token.approve(address(insurancePool), toPool);
                insurancePool.depositPremium(bytes32(taskId), toPool);
            }

            // Refund rest to requester
            if (refund > 0) {
                usd1Token.safeTransfer(humanDID.owner, refund);
            }
        }

        // Update reputation scores
        reputationScore.recordTaskSuccess(task.requesterDID, task.providerDID, task.finalAmount);

        // Update pricing queue
        dynamicPricing.decrementPendingTasks();

        emit TaskCompleted(taskId, providerPayment, protocolFee);
    }

    /**
     * @dev Cancel a task (only before acceptance)
     */
    function cancelTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "ClawPayEscrow: cannot cancel");

        // Verify sender is the requester's owner
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(task.requesterDID);
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(requester.humanDID);
        require(humanDID.owner == msg.sender, "ClawPayEscrow: not requester owner");

        task.status = TaskStatus.Cancelled;

        // Refund full amount to requester
        uint256 refundAmount = task.finalAmount + task.insurancePremium;
        usd1Token.safeTransfer(humanDID.owner, refundAmount);

        // Update pricing queue
        dynamicPricing.decrementPendingTasks();

        emit TaskCancelled(taskId, task.requesterDID);
    }

    /**
     * @dev Claim expired task (refund to requester)
     */
    function claimExpired(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "ClawPayEscrow: invalid status");
        require(block.timestamp >= task.expiryTime, "ClawPayEscrow: not expired");

        task.status = TaskStatus.Expired;

        // Refund to requester
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(task.requesterDID);
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(requester.humanDID);

        uint256 refundAmount = task.finalAmount + task.insurancePremium;
        usd1Token.safeTransfer(humanDID.owner, refundAmount);

        dynamicPricing.decrementPendingTasks();

        emit TaskExpired(taskId);
    }

    // ============ Dispute Handling ============

    /**
     * @dev Raise a dispute on an accepted task
     */
    function raiseDispute(uint256 taskId, string calldata reason) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "ClawPayEscrow: cannot dispute");

        // Verify sender is either requester or provider owner
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(task.requesterDID);
        DIDRegistry.AgentDID memory provider = didRegistry.getAgentDID(task.providerDID);
        DIDRegistry.HumanDID memory requesterHuman = didRegistry.getHumanDID(requester.humanDID);
        DIDRegistry.HumanDID memory providerHuman = didRegistry.getHumanDID(provider.humanDID);

        bytes32 raisedBy;
        if (msg.sender == requesterHuman.owner) {
            raisedBy = task.requesterDID;
        } else if (msg.sender == providerHuman.owner) {
            raisedBy = task.providerDID;
        } else {
            revert("ClawPayEscrow: not authorized");
        }

        task.status = TaskStatus.Disputed;

        disputes[taskId] = Dispute({
            raisedBy: raisedBy,
            reason: reason,
            raisedAt: block.timestamp,
            requesterPercent: 0,
            resolved: false
        });

        emit DisputeRaised(taskId, raisedBy, reason);
    }

    /**
     * @dev Resolve a dispute (admin/arbitrator only)
     * @param taskId The task ID
     * @param requesterPercent Percentage to return to requester (0-100)
     */
    function resolveDispute(uint256 taskId, uint8 requesterPercent) external nonReentrant onlyOwner taskExists(taskId) {
        Task storage task = tasks[taskId];
        Dispute storage dispute = disputes[taskId];

        require(task.status == TaskStatus.Disputed, "ClawPayEscrow: not disputed");
        require(!dispute.resolved, "ClawPayEscrow: already resolved");
        require(requesterPercent <= 100, "ClawPayEscrow: invalid percent");

        task.status = TaskStatus.Resolved;
        dispute.resolved = true;
        dispute.requesterPercent = requesterPercent;

        // Get addresses
        DIDRegistry.AgentDID memory requester = didRegistry.getAgentDID(task.requesterDID);
        DIDRegistry.AgentDID memory provider = didRegistry.getAgentDID(task.providerDID);
        DIDRegistry.HumanDID memory requesterHuman = didRegistry.getHumanDID(requester.humanDID);
        DIDRegistry.HumanDID memory providerHuman = didRegistry.getHumanDID(provider.humanDID);

        // Calculate amounts
        uint256 totalAmount = task.finalAmount;
        uint256 requesterAmount = (totalAmount * requesterPercent) / 100;
        uint256 providerAmount = totalAmount - requesterAmount;

        // Transfer amounts
        if (requesterAmount > 0) {
            usd1Token.safeTransfer(requesterHuman.owner, requesterAmount);
        }
        if (providerAmount > 0) {
            usd1Token.safeTransfer(providerHuman.owner, providerAmount);
        }

        // Insurance premium goes to pool on disputes
        if (task.insurancePremium > 0) {
            usd1Token.approve(address(insurancePool), task.insurancePremium);
            insurancePool.depositPremium(bytes32(taskId), task.insurancePremium);
        }

        // Update reputation - penalize the party at fault
        uint8 severity = requesterPercent > 50 ? 2 : 1; // Moderate if provider mostly at fault
        if (requesterPercent > 50) {
            reputationScore.recordDispute(task.providerDID, severity);
        } else if (requesterPercent < 50) {
            reputationScore.recordDispute(task.requesterDID, severity);
        }
        // If 50/50, no reputation impact

        dynamicPricing.decrementPendingTasks();

        emit DisputeResolved(taskId, requesterPercent, requesterAmount, providerAmount);
    }

    // ============ View Functions ============

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getDispute(uint256 taskId) external view returns (Dispute memory) {
        return disputes[taskId];
    }

    function getTasksByStatus(TaskStatus status, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory taskIds)
    {
        uint256[] memory tempIds = new uint256[](limit);
        uint256 count = 0;
        uint256 skipped = 0;

        for (uint256 i = 0; i < taskCount && count < limit; i++) {
            if (tasks[i].status == status) {
                if (skipped >= offset) {
                    tempIds[count] = i;
                    count++;
                } else {
                    skipped++;
                }
            }
        }

        // Resize array
        taskIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            taskIds[i] = tempIds[i];
        }
    }

    /**
     * @dev Get tasks for a specific DID (as requester or provider)
     */
    function getTasksByDID(bytes32 did, bool asRequester, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory taskIds)
    {
        uint256[] memory tempIds = new uint256[](limit);
        uint256 count = 0;
        uint256 skipped = 0;

        for (uint256 i = 0; i < taskCount && count < limit; i++) {
            bool matches = asRequester ? tasks[i].requesterDID == did : tasks[i].providerDID == did;
            if (matches) {
                if (skipped >= offset) {
                    tempIds[count] = i;
                    count++;
                } else {
                    skipped++;
                }
            }
        }

        taskIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            taskIds[i] = tempIds[i];
        }
    }
}
