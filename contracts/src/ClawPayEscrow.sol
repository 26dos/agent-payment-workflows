// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DualDIDRegistry.sol";
import "./ReputationScore.sol";
import "./DynamicPricing.sol";
import "./InsurancePool.sol";
import "./IncentiveSystem.sol";
import "./TaskSpecification.sol";

/**
 * @title ClawPayEscrow
 * @dev Core escrow contract for ClawPay - uses DualDIDRegistry only
 */
contract ClawPayEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum TaskStatus {
        Created,
        Accepted,
        Completed,
        Disputed,
        Resolved,
        Cancelled,
        Expired
    }

    // ============ Structs ============

    struct Task {
        bytes32 requesterDID;
        bytes32 providerDID;
        uint256 baseFee;
        uint256 finalAmount;
        uint256 insurancePremium;
        uint8 complexity;
        TaskStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        uint256 completedAt;
        uint256 expiryTime;
        string metadata;
    }

    struct Dispute {
        bytes32 raisedBy;
        string reason;
        uint256 raisedAt;
        uint8 requesterPercent;
        bool resolved;
    }

    // ============ State Variables ============

    IERC20 public usd1Token;
    DualDIDRegistry public dualDIDRegistry;
    ReputationScore public reputationScore;
    DynamicPricing public dynamicPricing;
    InsurancePool public insurancePool;
    IncentiveSystem public incentiveSystem;
    TaskSpecification public taskSpecification;

    mapping(uint256 => Task) public tasks;
    mapping(uint256 => Dispute) public disputes;
    uint256 public taskCount;

    uint256 public defaultExpiryDuration = 7 days;
    uint256 public protocolFeeBps = 10;
    address public protocolFeeRecipient;
    uint256 public premiumToPoolPercent = 20;
    uint256 public maxBatchSize = 10;
    uint256 public disputeTimeout = 5 minutes;
    uint256 public completionTimeout = 5 minutes;
    address public arbitrationWallet;

    // ============ Events ============

    event TaskCreated(uint256 indexed taskId, bytes32 indexed requesterDID, bytes32 indexed providerDID, uint256 baseFee, uint256 finalAmount, uint8 complexity);
    event TaskAccepted(uint256 indexed taskId, bytes32 indexed providerDID, uint256 acceptedAt);
    event TaskCompleted(uint256 indexed taskId, uint256 amountPaid, uint256 protocolFee);
    event TaskCancelled(uint256 indexed taskId, bytes32 cancelledBy);
    event TaskExpired(uint256 indexed taskId);
    event DisputeRaised(uint256 indexed taskId, bytes32 indexed raisedBy, string reason);
    event DisputeResolved(uint256 indexed taskId, uint8 requesterPercent, uint256 requesterAmount, uint256 providerAmount);
    event AutoArbitrationTriggered(uint256 indexed taskId, uint8 requesterPercent, string reason);
    event TaskResultSubmitted(uint256 indexed taskId, bytes32 indexed providerDID, bytes32 resultHash);
    event TaskWithSpecCreated(uint256 indexed taskId, bytes32 specificationId);

    // ============ Modifiers ============

    modifier taskExists(uint256 taskId) {
        require(taskId < taskCount, "Escrow: task not exist");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usd1Token,
        address _dualDIDRegistry,
        address _reputationScore,
        address _dynamicPricing,
        address _insurancePool
    ) Ownable(msg.sender) {
        usd1Token = IERC20(_usd1Token);
        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
        reputationScore = ReputationScore(_reputationScore);
        dynamicPricing = DynamicPricing(_dynamicPricing);
        insurancePool = InsurancePool(_insurancePool);
        protocolFeeRecipient = msg.sender;
    }

    // ============ Internal Helpers ============

    function _getSubDIDOwner(bytes32 subDID) internal view returns (address) {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        require(sub.active, "Escrow: DID not active");
        DualDIDRegistry.OnChainDID memory parent = dualDIDRegistry.getOnChainDID(sub.parentOnChainDID);
        return parent.walletAddress;
    }

    function _validateSubDID(bytes32 subDID) internal view returns (bool, address) {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        if (!sub.active) return (false, address(0));
        DualDIDRegistry.OnChainDID memory parent = dualDIDRegistry.getOnChainDID(sub.parentOnChainDID);
        return (true, parent.walletAddress);
    }

    // ============ Admin Functions ============

    function setProtocolFee(uint256 _feeBps, address _recipient) external onlyOwner {
        require(_feeBps <= 100, "Escrow: max 1%");
        protocolFeeBps = _feeBps;
        protocolFeeRecipient = _recipient;
    }

    function setDefaultExpiryDuration(uint256 _duration) external onlyOwner {
        require(_duration >= 1 hours && _duration <= 30 days, "Escrow: invalid");
        defaultExpiryDuration = _duration;
    }

    function setPremiumToPoolPercent(uint256 _percent) external onlyOwner {
        require(_percent <= 100, "Escrow: invalid");
        premiumToPoolPercent = _percent;
    }

    function setMaxBatchSize(uint256 _maxSize) external onlyOwner {
        require(_maxSize >= 1 && _maxSize <= 50, "Escrow: 1-50");
        maxBatchSize = _maxSize;
    }

    function setArbitrationWallet(address _wallet) external onlyOwner {
        arbitrationWallet = _wallet;
    }

    function setDisputeTimeout(uint256 _timeout) external onlyOwner {
        disputeTimeout = _timeout;
    }

    function setCompletionTimeout(uint256 _timeout) external onlyOwner {
        completionTimeout = _timeout;
    }

    function setDualDIDRegistry(address _addr) external onlyOwner {
        dualDIDRegistry = DualDIDRegistry(_addr);
    }

    function setIncentiveSystem(address _addr) external onlyOwner {
        incentiveSystem = IncentiveSystem(_addr);
    }

    function setTaskSpecification(address _addr) external onlyOwner {
        taskSpecification = TaskSpecification(_addr);
    }

    function setContracts(address _rep, address _pricing, address _insurance) external onlyOwner {
        reputationScore = ReputationScore(_rep);
        dynamicPricing = DynamicPricing(_pricing);
        insurancePool = InsurancePool(_insurance);
    }

    // ============ Task Creation ============

    function createOpenTask(
        bytes32 requesterDID,
        uint256 baseFee,
        uint8 complexity,
        string calldata metadata
    ) external nonReentrant returns (uint256 taskId) {
        address owner = _getSubDIDOwner(requesterDID);
        require(owner == msg.sender, "Escrow: not owner");

        uint256 finalAmount = baseFee;
        uint256 premium = (baseFee * 5) / 100;
        uint256 totalLock = finalAmount + premium;

        usd1Token.safeTransferFrom(msg.sender, address(this), totalLock);

        taskId = taskCount++;
        tasks[taskId] = Task({
            requesterDID: requesterDID,
            providerDID: bytes32(0),
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

        dynamicPricing.incrementPendingTasks();
        emit TaskCreated(taskId, requesterDID, bytes32(0), baseFee, finalAmount, complexity);
    }

    function createTaskWithSpec(
        bytes32 requesterDID,
        bytes32 providerDID,
        uint256 baseFee,
        uint8 complexity,
        TaskSpecification.TaskType taskType,
        uint256 acceptanceDeadline,
        uint256 completionDeadline,
        uint256 minReputationScore,
        string calldata metadataIPFS
    ) external nonReentrant returns (uint256 taskId) {
        require(address(taskSpecification) != address(0), "Escrow: no spec");

        address owner = _getSubDIDOwner(requesterDID);
        require(owner == msg.sender, "Escrow: not owner");

        uint256 finalAmount;
        uint256 premium;

        if (providerDID != bytes32(0)) {
            (bool valid,) = _validateSubDID(providerDID);
            require(valid, "Escrow: provider invalid");
            if (minReputationScore > 0) {
                uint256 score = reputationScore.getFinalScore(providerDID);
                require(score >= minReputationScore, "Escrow: low rep");
            }
            (finalAmount,,,) = dynamicPricing.calculatePriceDetailed(providerDID, baseFee, complexity);
            premium = dynamicPricing.calculateInsurancePremium(providerDID, baseFee);
        } else {
            finalAmount = baseFee;
            premium = (baseFee * 5) / 100;
        }

        uint256 totalLock = finalAmount + premium;
        usd1Token.safeTransferFrom(msg.sender, address(this), totalLock);

        taskId = taskCount++;
        bytes32 specId = bytes32(taskId);

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
            expiryTime: acceptanceDeadline,
            metadata: metadataIPFS
        });

        taskSpecification.createSimpleSpecification(specId, requesterDID, taskType, acceptanceDeadline, completionDeadline, minReputationScore, metadataIPFS);
        dynamicPricing.incrementPendingTasks();

        emit TaskCreated(taskId, requesterDID, providerDID, baseFee, finalAmount, complexity);
        emit TaskWithSpecCreated(taskId, specId);
    }

    // ============ Task Lifecycle ============

    function acceptOpenTask(uint256 taskId, bytes32 providerDID) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Escrow: invalid");
        require(task.providerDID == bytes32(0), "Escrow: not open");
        require(block.timestamp < task.expiryTime, "Escrow: expired");

        address owner = _getSubDIDOwner(providerDID);
        require(owner == msg.sender, "Escrow: not owner");

        task.providerDID = providerDID;
        task.status = TaskStatus.Accepted;
        task.acceptedAt = block.timestamp;
        emit TaskAccepted(taskId, providerDID, block.timestamp);
    }

    function acceptTask(uint256 taskId) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Escrow: invalid");
        require(block.timestamp < task.expiryTime, "Escrow: expired");

        address owner = _getSubDIDOwner(task.providerDID);
        require(owner == msg.sender, "Escrow: not owner");

        task.status = TaskStatus.Accepted;
        task.acceptedAt = block.timestamp;
        emit TaskAccepted(taskId, task.providerDID, block.timestamp);
    }

    function completeTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "Escrow: not accepted");

        address requesterOwner = _getSubDIDOwner(task.requesterDID);
        require(requesterOwner == msg.sender, "Escrow: not owner");

        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        uint256 protocolFee = (task.finalAmount * protocolFeeBps) / 10000;
        uint256 providerPayment = task.finalAmount - protocolFee;

        address providerOwner = _getSubDIDOwner(task.providerDID);
        usd1Token.safeTransfer(providerOwner, providerPayment);

        if (protocolFee > 0) {
            usd1Token.safeTransfer(protocolFeeRecipient, protocolFee);
        }

        if (task.insurancePremium > 0) {
            uint256 toPool = (task.insurancePremium * premiumToPoolPercent) / 100;
            uint256 refund = task.insurancePremium - toPool;
            if (toPool > 0) {
                usd1Token.approve(address(insurancePool), toPool);
                insurancePool.depositPremium(bytes32(taskId), toPool);
            }
            if (refund > 0) {
                usd1Token.safeTransfer(requesterOwner, refund);
            }
        }

        reputationScore.recordTaskSuccess(task.requesterDID, task.providerDID, task.finalAmount);
        dynamicPricing.decrementPendingTasks();

        if (address(incentiveSystem) != address(0)) {
            incentiveSystem.recordTaskCompletion(task.requesterDID);
            incentiveSystem.recordTaskCompletion(task.providerDID);
        }

        emit TaskCompleted(taskId, providerPayment, protocolFee);
    }

    function cancelTask(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Escrow: cannot cancel");

        address owner = _getSubDIDOwner(task.requesterDID);
        require(owner == msg.sender, "Escrow: not owner");

        task.status = TaskStatus.Cancelled;

        uint256 refundAmount = task.finalAmount + task.insurancePremium;
        usd1Token.safeTransfer(owner, refundAmount);
        dynamicPricing.decrementPendingTasks();

        emit TaskCancelled(taskId, task.requesterDID);
    }

    function claimExpired(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Escrow: invalid");
        require(block.timestamp >= task.expiryTime, "Escrow: not expired");

        task.status = TaskStatus.Expired;

        address owner = _getSubDIDOwner(task.requesterDID);
        uint256 refundAmount = task.finalAmount + task.insurancePremium;
        usd1Token.safeTransfer(owner, refundAmount);
        dynamicPricing.decrementPendingTasks();

        emit TaskExpired(taskId);
    }

    // ============ Dispute Handling ============

    function raiseDispute(uint256 taskId, string calldata reason) external taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "Escrow: cannot dispute");

        address reqOwner = _getSubDIDOwner(task.requesterDID);
        address provOwner = _getSubDIDOwner(task.providerDID);

        bytes32 raisedBy;
        if (msg.sender == reqOwner) {
            raisedBy = task.requesterDID;
        } else if (msg.sender == provOwner) {
            raisedBy = task.providerDID;
        } else {
            revert("Escrow: not authorized");
        }

        task.status = TaskStatus.Disputed;
        disputes[taskId] = Dispute({raisedBy: raisedBy, reason: reason, raisedAt: block.timestamp, requesterPercent: 0, resolved: false});

        emit DisputeRaised(taskId, raisedBy, reason);
    }

    function resolveDispute(uint256 taskId, uint8 requesterPercent) external nonReentrant onlyOwner taskExists(taskId) {
        Task storage task = tasks[taskId];
        Dispute storage dispute = disputes[taskId];
        require(task.status == TaskStatus.Disputed, "Escrow: not disputed");
        require(!dispute.resolved, "Escrow: resolved");
        require(requesterPercent <= 100, "Escrow: invalid %");

        task.status = TaskStatus.Resolved;
        dispute.resolved = true;
        dispute.requesterPercent = requesterPercent;

        address reqOwner = _getSubDIDOwner(task.requesterDID);
        address provOwner = _getSubDIDOwner(task.providerDID);

        uint256 total = task.finalAmount;
        uint256 reqAmt = (total * requesterPercent) / 100;
        uint256 provAmt = total - reqAmt;

        if (reqAmt > 0) usd1Token.safeTransfer(reqOwner, reqAmt);
        if (provAmt > 0) usd1Token.safeTransfer(provOwner, provAmt);

        if (task.insurancePremium > 0) {
            usd1Token.approve(address(insurancePool), task.insurancePremium);
            insurancePool.depositPremium(bytes32(taskId), task.insurancePremium);
        }

        uint8 severity = requesterPercent > 50 ? 2 : 1;
        if (requesterPercent > 50) {
            reputationScore.recordDispute(task.providerDID, severity);
        } else if (requesterPercent < 50) {
            reputationScore.recordDispute(task.requesterDID, severity);
        }

        dynamicPricing.decrementPendingTasks();
        emit DisputeResolved(taskId, requesterPercent, reqAmt, provAmt);
    }

    function autoResolveDispute(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        Dispute storage dispute = disputes[taskId];
        require(task.status == TaskStatus.Disputed, "Escrow: not disputed");
        require(!dispute.resolved, "Escrow: resolved");
        require(block.timestamp >= dispute.raisedAt + disputeTimeout, "Escrow: timeout");

        uint8 reqPct = dispute.raisedBy == task.requesterDID ? 100 : 0;
        string memory reason = reqPct == 100 ? "Provider timeout" : "Requester timeout";

        task.status = TaskStatus.Resolved;
        dispute.resolved = true;
        dispute.requesterPercent = reqPct;

        address reqOwner = _getSubDIDOwner(task.requesterDID);
        address provOwner = _getSubDIDOwner(task.providerDID);

        uint256 total = task.finalAmount;
        uint256 reqAmt = (total * reqPct) / 100;
        uint256 provAmt = total - reqAmt;

        if (reqAmt > 0) usd1Token.safeTransfer(reqOwner, reqAmt);
        if (provAmt > 0) usd1Token.safeTransfer(provOwner, provAmt);

        if (task.insurancePremium > 0) {
            usd1Token.approve(address(insurancePool), task.insurancePremium);
            insurancePool.depositPremium(bytes32(taskId), task.insurancePremium);
        }

        if (reqPct == 100) {
            reputationScore.recordDispute(task.providerDID, 2);
        } else {
            reputationScore.recordDispute(task.requesterDID, 2);
        }

        dynamicPricing.decrementPendingTasks();
        emit AutoArbitrationTriggered(taskId, reqPct, reason);
        emit DisputeResolved(taskId, reqPct, reqAmt, provAmt);
    }

    function autoCompleteOverdue(uint256 taskId) external nonReentrant taskExists(taskId) {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Accepted, "Escrow: not accepted");
        require(block.timestamp >= task.acceptedAt + completionTimeout, "Escrow: not overdue");

        task.status = TaskStatus.Resolved;

        address reqOwner = _getSubDIDOwner(task.requesterDID);
        uint256 refund = task.finalAmount + task.insurancePremium;
        usd1Token.safeTransfer(reqOwner, refund);

        reputationScore.recordDispute(task.providerDID, 2);
        dynamicPricing.decrementPendingTasks();

        emit AutoArbitrationTriggered(taskId, 100, "Provider timeout");
    }

    // ============ View Functions ============

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function getDispute(uint256 taskId) external view returns (Dispute memory) {
        return disputes[taskId];
    }

    function getTasksByStatus(TaskStatus status, uint256 offset, uint256 limit) external view returns (uint256[] memory taskIds) {
        uint256[] memory temp = new uint256[](limit);
        uint256 count = 0;
        uint256 skipped = 0;
        for (uint256 i = 0; i < taskCount && count < limit; i++) {
            if (tasks[i].status == status) {
                if (skipped >= offset) { temp[count++] = i; } else { skipped++; }
            }
        }
        taskIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) { taskIds[i] = temp[i]; }
    }

    function getTasksByDID(bytes32 did, bool asRequester, uint256 offset, uint256 limit) external view returns (uint256[] memory taskIds) {
        uint256[] memory temp = new uint256[](limit);
        uint256 count = 0;
        uint256 skipped = 0;
        for (uint256 i = 0; i < taskCount && count < limit; i++) {
            bool matches = asRequester ? tasks[i].requesterDID == did : tasks[i].providerDID == did;
            if (matches) {
                if (skipped >= offset) { temp[count++] = i; } else { skipped++; }
            }
        }
        taskIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) { taskIds[i] = temp[i]; }
    }
}
