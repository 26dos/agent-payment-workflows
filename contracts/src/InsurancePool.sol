// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title InsurancePool
 * @dev Manages the insurance pool for ClawPay
 * Collects premiums from low-reputation agents and pays out on disputes
 */
contract InsurancePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usd1Token;

    // Total pool balance
    uint256 public poolBalance;

    // Premium collection stats
    uint256 public totalPremiumsCollected;
    uint256 public totalPayouts;

    // Claim tracking
    struct Claim {
        bytes32 taskId;
        bytes32 claimantDID;
        uint256 amount;
        string reason;
        ClaimStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    enum ClaimStatus {
        Pending,
        Approved,
        Rejected,
        Paid
    }

    mapping(uint256 => Claim) public claims;
    uint256 public claimCount;

    // Authorized contracts that can deposit premiums and request payouts
    mapping(address => bool) public authorizedContracts;

    // Maximum payout percentage per claim (of pool balance)
    uint256 public maxPayoutPercent = 1000; // 10% of pool per claim

    // ============ Events ============

    event PremiumDeposited(bytes32 indexed taskId, uint256 amount);
    event ClaimSubmitted(uint256 indexed claimId, bytes32 indexed claimantDID, uint256 amount);
    event ClaimResolved(uint256 indexed claimId, ClaimStatus status);
    event PayoutProcessed(uint256 indexed claimId, bytes32 indexed claimantDID, uint256 amount);
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "InsurancePool: not authorized");
        _;
    }

    // ============ Constructor ============

    constructor(address _usd1Token) Ownable(msg.sender) {
        usd1Token = IERC20(_usd1Token);
    }

    // ============ Admin Functions ============

    function setAuthorizedContract(address contractAddress, bool authorized) external onlyOwner {
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }

    function setMaxPayoutPercent(uint256 _maxPayoutPercent) external onlyOwner {
        require(_maxPayoutPercent <= 5000, "InsurancePool: max 50%");
        maxPayoutPercent = _maxPayoutPercent;
    }

    function setUSD1Token(address _usd1Token) external onlyOwner {
        usd1Token = IERC20(_usd1Token);
    }

    // ============ Premium Collection ============

    /**
     * @dev Deposit premium into the insurance pool
     * @param taskId Associated task ID
     * @param amount Premium amount
     */
    function depositPremium(bytes32 taskId, uint256 amount) external onlyAuthorized {
        require(amount > 0, "InsurancePool: zero amount");

        usd1Token.safeTransferFrom(msg.sender, address(this), amount);
        poolBalance += amount;
        totalPremiumsCollected += amount;

        emit PremiumDeposited(taskId, amount);
    }

    /**
     * @dev Direct deposit to pool (e.g., from refunds)
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "InsurancePool: zero amount");
        usd1Token.safeTransferFrom(msg.sender, address(this), amount);
        poolBalance += amount;
    }

    // ============ Claim Management ============

    /**
     * @dev Submit a new insurance claim
     * @param taskId Related task ID
     * @param claimantDID DID of the claimant
     * @param amount Requested payout amount
     * @param reason Description of the claim
     * @return claimId The ID of the submitted claim
     */
    function submitClaim(bytes32 taskId, bytes32 claimantDID, uint256 amount, string calldata reason)
        external
        onlyAuthorized
        returns (uint256 claimId)
    {
        claimId = claimCount++;

        claims[claimId] = Claim({
            taskId: taskId,
            claimantDID: claimantDID,
            amount: amount,
            reason: reason,
            status: ClaimStatus.Pending,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        emit ClaimSubmitted(claimId, claimantDID, amount);
    }

    /**
     * @dev Approve a claim (admin/DAO decision)
     */
    function approveClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Pending, "InsurancePool: not pending");

        claim.status = ClaimStatus.Approved;
        claim.resolvedAt = block.timestamp;

        emit ClaimResolved(claimId, ClaimStatus.Approved);
    }

    /**
     * @dev Reject a claim
     */
    function rejectClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Pending, "InsurancePool: not pending");

        claim.status = ClaimStatus.Rejected;
        claim.resolvedAt = block.timestamp;

        emit ClaimResolved(claimId, ClaimStatus.Rejected);
    }

    /**
     * @dev Process payout for an approved claim
     * @param claimId The claim ID
     * @param recipient Address to receive the payout
     */
    function processPayout(uint256 claimId, address recipient) external nonReentrant onlyOwner {
        Claim storage claim = claims[claimId];
        require(claim.status == ClaimStatus.Approved, "InsurancePool: not approved");

        uint256 maxPayout = (poolBalance * maxPayoutPercent) / 10000;
        uint256 payoutAmount = claim.amount > maxPayout ? maxPayout : claim.amount;

        require(payoutAmount <= poolBalance, "InsurancePool: insufficient funds");

        claim.status = ClaimStatus.Paid;
        poolBalance -= payoutAmount;
        totalPayouts += payoutAmount;

        usd1Token.safeTransfer(recipient, payoutAmount);

        emit PayoutProcessed(claimId, claim.claimantDID, payoutAmount);
    }

    /**
     * @dev Quick payout without claim process (for small automatic payouts)
     * @param recipient Address to receive payout
     * @param amount Payout amount
     * @param taskId Related task for logging
     */
    function quickPayout(address recipient, uint256 amount, bytes32 taskId) external nonReentrant onlyAuthorized {
        require(amount <= poolBalance, "InsurancePool: insufficient funds");

        uint256 maxPayout = (poolBalance * maxPayoutPercent) / 10000;
        require(amount <= maxPayout, "InsurancePool: exceeds max payout");

        poolBalance -= amount;
        totalPayouts += amount;

        usd1Token.safeTransfer(recipient, amount);

        emit PayoutProcessed(0, taskId, amount);
    }

    // ============ View Functions ============

    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return claims[claimId];
    }

    function getPoolStats()
        external
        view
        returns (uint256 balance, uint256 totalCollected, uint256 totalPaidOut, uint256 pendingClaims)
    {
        balance = poolBalance;
        totalCollected = totalPremiumsCollected;
        totalPaidOut = totalPayouts;

        // Count pending claims
        for (uint256 i = 0; i < claimCount; i++) {
            if (claims[i].status == ClaimStatus.Pending) {
                pendingClaims++;
            }
        }
    }

    // ============ Emergency Functions ============

    /**
     * @dev Emergency withdrawal (only owner, for migration)
     */
    function emergencyWithdraw(address to) external onlyOwner {
        uint256 balance = usd1Token.balanceOf(address(this));
        usd1Token.safeTransfer(to, balance);
        poolBalance = 0;
    }
}
