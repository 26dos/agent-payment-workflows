// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DIDRegistry.sol";
import "./ReputationScore.sol";

/**
 * @title IncentiveSystem
 * @dev Manages incentive mechanisms for ClawPay ecosystem
 * 
 * Human DID Incentives (Credit Cultivation):
 * - Registration bonus: 1,000 points
 * - KYC completion bonus: up to 10,000 points
 * - Referral bonus: 500 points for inviter, 200 points for invitee
 * - Reputation cascading: Agent drops 10 → Human drops 1
 * 
 * Agent DID Incentives (Behavioral Contribution):
 * - Registration bonus: 100 points
 * - Task completion: 1 point per task (max 10/day, cap 500 total)
 * - Reputation coefficient: score/100 determines actual payout
 */
contract IncentiveSystem is Ownable {
    // ============ Constants ============
    
    // Human DID point rewards
    uint256 public constant HUMAN_REGISTRATION_POINTS = 1000;
    uint256 public constant HUMAN_KYC_MAX_POINTS = 10000;
    uint256 public constant HUMAN_REFERRAL_INVITER_POINTS = 500;
    uint256 public constant HUMAN_REFERRAL_INVITEE_POINTS = 200;
    
    // Agent DID point rewards
    uint256 public constant AGENT_REGISTRATION_POINTS = 100;
    uint256 public constant AGENT_TASK_POINTS = 1;
    uint256 public constant AGENT_DAILY_TASK_LIMIT = 10;
    uint256 public constant AGENT_TOTAL_TASK_CAP = 500;
    
    // Reputation cascading ratio (10:1)
    uint256 public constant REPUTATION_CASCADE_RATIO = 10;
    
    // Initial reputation score (60 = baseline)
    uint256 public constant INITIAL_REPUTATION = 6000; // 60.00 with 2 decimals
    
    // ============ Enums ============
    
    enum KYCLevel {
        None,           // 0: No KYC
        Basic,          // 1: Email verification
        Standard,       // 2: Social media linked
        Advanced,       // 3: Asset proof
        Full            // 4: Real-person authentication
    }
    
    enum BlacklistReason {
        None,
        SuperArbitrationViolation,
        RepeatedDisputes,
        FraudAttempt,
        TermsViolation
    }
    
    // ============ Structs ============
    
    struct HumanIncentive {
        uint256 registrationPoints;     // Points from registration
        uint256 kycPoints;              // Points from KYC completion
        uint256 referralPoints;         // Points from referrals
        uint256 totalPoints;            // Total accumulated points
        KYCLevel kycLevel;              // Current KYC level
        bytes32 invitedBy;              // Human DID that invited this user
        uint256 inviteCount;            // Number of successful invites
        bool registered;                // Has claimed registration bonus
        bool blacklisted;               // Is blacklisted
        BlacklistReason blacklistReason;// Reason for blacklist
        uint256 blacklistedAt;          // When blacklisted
    }
    
    struct AgentIncentive {
        uint256 registrationPoints;     // Points from registration (100)
        uint256 taskPoints;             // Points from task completion
        uint256 totalPoints;            // Total accumulated points
        uint256 dailyTaskPoints;        // Points earned today
        uint256 lastTaskDay;            // Last day tasks were recorded
        bool registered;                // Has claimed registration bonus
    }
    
    // ============ State Variables ============
    
    DIDRegistry public didRegistry;
    ReputationScore public reputationScore;
    
    // Human DID => Incentive data
    mapping(bytes32 => HumanIncentive) public humanIncentives;
    
    // Agent DID => Incentive data
    mapping(bytes32 => AgentIncentive) public agentIncentives;
    
    // Invite code => Human DID (for referral tracking)
    mapping(bytes32 => bytes32) public inviteCodes;
    
    // Authorized callers (Escrow contract, etc.)
    mapping(address => bool) public authorizedCallers;
    
    // KYC level to points mapping
    mapping(KYCLevel => uint256) public kycLevelPoints;
    
    // ============ Events ============
    
    event HumanRegistrationBonus(bytes32 indexed humanDID, uint256 points);
    event HumanKYCBonus(bytes32 indexed humanDID, KYCLevel level, uint256 points);
    event HumanReferralBonus(bytes32 indexed inviter, bytes32 indexed invitee, uint256 inviterPoints, uint256 inviteePoints);
    event AgentRegistrationBonus(bytes32 indexed agentDID, uint256 points);
    event AgentTaskBonus(bytes32 indexed agentDID, uint256 points, uint256 effectivePoints);
    event ReputationCascade(bytes32 indexed humanDID, bytes32 indexed agentDID, uint256 agentDrop, uint256 humanDrop);
    event Blacklisted(bytes32 indexed humanDID, BlacklistReason reason);
    event PointsFrozen(bytes32 indexed humanDID, uint256 frozenAmount);
    event InviteCodeGenerated(bytes32 indexed humanDID, bytes32 inviteCode);
    
    // ============ Modifiers ============
    
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "IncentiveSystem: not authorized");
        _;
    }
    
    modifier notBlacklisted(bytes32 humanDID) {
        require(!humanIncentives[humanDID].blacklisted, "IncentiveSystem: account blacklisted");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _didRegistry, address _reputationScore) Ownable(msg.sender) {
        didRegistry = DIDRegistry(_didRegistry);
        reputationScore = ReputationScore(_reputationScore);
        
        // Initialize KYC level points
        kycLevelPoints[KYCLevel.None] = 0;
        kycLevelPoints[KYCLevel.Basic] = 1000;      // Email: 1,000 points
        kycLevelPoints[KYCLevel.Standard] = 3000;   // Social media: 3,000 points
        kycLevelPoints[KYCLevel.Advanced] = 6000;   // Asset proof: 6,000 points
        kycLevelPoints[KYCLevel.Full] = 10000;      // Real-person: 10,000 points
    }
    
    // ============ Admin Functions ============
    
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }
    
    function setContracts(address _didRegistry, address _reputationScore) external onlyOwner {
        didRegistry = DIDRegistry(_didRegistry);
        reputationScore = ReputationScore(_reputationScore);
    }
    
    function setKYCLevelPoints(KYCLevel level, uint256 points) external onlyOwner {
        require(points <= HUMAN_KYC_MAX_POINTS, "IncentiveSystem: exceeds max KYC points");
        kycLevelPoints[level] = points;
    }
    
    // ============ Human DID Incentive Functions ============
    
    /**
     * @dev Claim registration bonus for Human DID
     * @param humanDID The Human DID to claim for
     */
    function claimHumanRegistrationBonus(bytes32 humanDID) external {
        DIDRegistry.HumanDID memory did = didRegistry.getHumanDID(humanDID);
        require(did.active, "IncentiveSystem: DID not active");
        require(did.owner == msg.sender, "IncentiveSystem: not DID owner");
        
        HumanIncentive storage incentive = humanIncentives[humanDID];
        require(!incentive.registered, "IncentiveSystem: already claimed");
        
        incentive.registered = true;
        incentive.registrationPoints = HUMAN_REGISTRATION_POINTS;
        incentive.totalPoints = HUMAN_REGISTRATION_POINTS;
        
        emit HumanRegistrationBonus(humanDID, HUMAN_REGISTRATION_POINTS);
    }
    
    /**
     * @dev Claim registration bonus with referral code
     * @param humanDID The Human DID to claim for
     * @param inviteCode The invite code from another user
     */
    function claimHumanRegistrationWithReferral(bytes32 humanDID, bytes32 inviteCode) external {
        DIDRegistry.HumanDID memory did = didRegistry.getHumanDID(humanDID);
        require(did.active, "IncentiveSystem: DID not active");
        require(did.owner == msg.sender, "IncentiveSystem: not DID owner");
        
        HumanIncentive storage incentive = humanIncentives[humanDID];
        require(!incentive.registered, "IncentiveSystem: already claimed");
        
        // Process referral
        bytes32 inviterDID = inviteCodes[inviteCode];
        require(inviterDID != bytes32(0), "IncentiveSystem: invalid invite code");
        require(inviterDID != humanDID, "IncentiveSystem: cannot self-invite");
        require(!humanIncentives[inviterDID].blacklisted, "IncentiveSystem: inviter blacklisted");
        
        // Set up invitee
        incentive.registered = true;
        incentive.registrationPoints = HUMAN_REGISTRATION_POINTS;
        incentive.referralPoints = HUMAN_REFERRAL_INVITEE_POINTS;
        incentive.totalPoints = HUMAN_REGISTRATION_POINTS + HUMAN_REFERRAL_INVITEE_POINTS;
        incentive.invitedBy = inviterDID;
        
        // Reward inviter
        HumanIncentive storage inviterIncentive = humanIncentives[inviterDID];
        inviterIncentive.referralPoints += HUMAN_REFERRAL_INVITER_POINTS;
        inviterIncentive.totalPoints += HUMAN_REFERRAL_INVITER_POINTS;
        inviterIncentive.inviteCount++;
        
        emit HumanRegistrationBonus(humanDID, HUMAN_REGISTRATION_POINTS);
        emit HumanReferralBonus(inviterDID, humanDID, HUMAN_REFERRAL_INVITER_POINTS, HUMAN_REFERRAL_INVITEE_POINTS);
    }
    
    /**
     * @dev Generate a unique invite code for a Human DID
     * @param humanDID The Human DID to generate code for
     * @return inviteCode The generated invite code
     */
    function generateInviteCode(bytes32 humanDID) external returns (bytes32 inviteCode) {
        DIDRegistry.HumanDID memory did = didRegistry.getHumanDID(humanDID);
        require(did.active, "IncentiveSystem: DID not active");
        require(did.owner == msg.sender, "IncentiveSystem: not DID owner");
        require(humanIncentives[humanDID].registered, "IncentiveSystem: not registered");
        require(!humanIncentives[humanDID].blacklisted, "IncentiveSystem: blacklisted");
        
        // Generate unique invite code
        inviteCode = keccak256(abi.encodePacked(humanDID, block.timestamp, block.prevrandao));
        inviteCodes[inviteCode] = humanDID;
        
        emit InviteCodeGenerated(humanDID, inviteCode);
    }
    
    /**
     * @dev Update KYC level and award points
     * @param humanDID The Human DID to update
     * @param level The new KYC level
     */
    function updateKYCLevel(bytes32 humanDID, KYCLevel level) external onlyAuthorized {
        require(humanIncentives[humanDID].registered, "IncentiveSystem: not registered");
        require(!humanIncentives[humanDID].blacklisted, "IncentiveSystem: blacklisted");
        
        HumanIncentive storage incentive = humanIncentives[humanDID];
        require(uint8(level) > uint8(incentive.kycLevel), "IncentiveSystem: cannot downgrade KYC");
        
        // Calculate additional points
        uint256 currentPoints = kycLevelPoints[incentive.kycLevel];
        uint256 newPoints = kycLevelPoints[level];
        uint256 additionalPoints = newPoints - currentPoints;
        
        incentive.kycLevel = level;
        incentive.kycPoints = newPoints;
        incentive.totalPoints += additionalPoints;
        
        emit HumanKYCBonus(humanDID, level, additionalPoints);
    }
    
    // ============ Agent DID Incentive Functions ============
    
    /**
     * @dev Claim registration bonus for Agent DID
     * @param agentDID The Agent DID to claim for
     */
    function claimAgentRegistrationBonus(bytes32 agentDID) external {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        require(agent.active, "IncentiveSystem: agent not active");
        
        DIDRegistry.HumanDID memory humanDID = didRegistry.getHumanDID(agent.humanDID);
        require(humanDID.owner == msg.sender, "IncentiveSystem: not agent owner");
        require(!humanIncentives[agent.humanDID].blacklisted, "IncentiveSystem: human DID blacklisted");
        
        AgentIncentive storage incentive = agentIncentives[agentDID];
        require(!incentive.registered, "IncentiveSystem: already claimed");
        
        incentive.registered = true;
        incentive.registrationPoints = AGENT_REGISTRATION_POINTS;
        incentive.totalPoints = AGENT_REGISTRATION_POINTS;
        
        emit AgentRegistrationBonus(agentDID, AGENT_REGISTRATION_POINTS);
    }
    
    /**
     * @dev Record task completion and award points
     * Called by Escrow contract when task is completed
     * @param agentDID The Agent DID that completed the task
     */
    function recordTaskCompletion(bytes32 agentDID) external onlyAuthorized {
        AgentIncentive storage incentive = agentIncentives[agentDID];
        
        // Initialize if not registered
        if (!incentive.registered) {
            incentive.registered = true;
            incentive.registrationPoints = AGENT_REGISTRATION_POINTS;
            incentive.totalPoints = AGENT_REGISTRATION_POINTS;
            emit AgentRegistrationBonus(agentDID, AGENT_REGISTRATION_POINTS);
        }
        
        // Check if agent has reached total cap
        if (incentive.taskPoints >= AGENT_TOTAL_TASK_CAP) {
            return; // No more task points for this agent
        }
        
        // Reset daily counter if new day
        uint256 currentDay = block.timestamp / 1 days;
        if (incentive.lastTaskDay != currentDay) {
            incentive.dailyTaskPoints = 0;
            incentive.lastTaskDay = currentDay;
        }
        
        // Check daily limit
        if (incentive.dailyTaskPoints >= AGENT_DAILY_TASK_LIMIT) {
            return; // Daily limit reached
        }
        
        // Calculate effective points based on reputation
        uint256 rawPoints = AGENT_TASK_POINTS;
        uint256 effectivePoints = _calculateEffectivePoints(agentDID, rawPoints);
        
        // Update points
        incentive.taskPoints += rawPoints;
        incentive.dailyTaskPoints++;
        incentive.totalPoints += effectivePoints;
        
        emit AgentTaskBonus(agentDID, rawPoints, effectivePoints);
    }
    
    /**
     * @dev Calculate effective points based on reputation coefficient
     * High reputation (90) = 0.9x, Low reputation (40) = 0.4x
     * @param agentDID The Agent DID
     * @param rawPoints Raw points to convert
     * @return effectivePoints Points after reputation adjustment
     */
    function _calculateEffectivePoints(bytes32 agentDID, uint256 rawPoints) internal view returns (uint256) {
        uint256 score = reputationScore.getFinalScore(agentDID);
        // Score is in format 7500 = 75.00, we want 75% = 0.75x
        // Effective = rawPoints * (score / 10000)
        return (rawPoints * score) / 10000;
    }
    
    // ============ Reputation Cascading ============
    
    /**
     * @dev Apply reputation cascading from Agent to Human DID
     * When Agent score drops by 10, Human score drops by 1
     * @param agentDID The Agent DID that had reputation change
     * @param agentDrop The amount of reputation drop (in 2 decimal format)
     */
    function applyReputationCascade(bytes32 agentDID, uint256 agentDrop) external onlyAuthorized {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        bytes32 humanDID = agent.humanDID;
        
        // Calculate human reputation drop (10:1 ratio)
        uint256 humanDrop = agentDrop / REPUTATION_CASCADE_RATIO;
        
        if (humanDrop > 0) {
            // Apply drop to human score via ReputationScore contract
            // Note: This requires ReputationScore to have a method for this
            emit ReputationCascade(humanDID, agentDID, agentDrop, humanDrop);
        }
    }
    
    // ============ Blacklist Functions ============
    
    /**
     * @dev Blacklist a Human DID (severe violation)
     * @param humanDID The Human DID to blacklist
     * @param reason The reason for blacklisting
     */
    function blacklistHumanDID(bytes32 humanDID, BlacklistReason reason) external onlyAuthorized {
        require(reason != BlacklistReason.None, "IncentiveSystem: invalid reason");
        
        HumanIncentive storage incentive = humanIncentives[humanDID];
        require(!incentive.blacklisted, "IncentiveSystem: already blacklisted");
        
        incentive.blacklisted = true;
        incentive.blacklistReason = reason;
        incentive.blacklistedAt = block.timestamp;
        
        // Freeze all points
        uint256 frozenPoints = incentive.totalPoints;
        incentive.totalPoints = 0;
        
        emit Blacklisted(humanDID, reason);
        emit PointsFrozen(humanDID, frozenPoints);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get Human DID incentive data
     */
    function getHumanIncentive(bytes32 humanDID) external view returns (HumanIncentive memory) {
        return humanIncentives[humanDID];
    }
    
    /**
     * @dev Get Agent DID incentive data
     */
    function getAgentIncentive(bytes32 agentDID) external view returns (AgentIncentive memory) {
        return agentIncentives[agentDID];
    }
    
    /**
     * @dev Get total points for a Human DID (including all agents)
     */
    function getTotalHumanPoints(bytes32 humanDID) external view returns (uint256 totalPoints) {
        totalPoints = humanIncentives[humanDID].totalPoints;
        
        // Add points from all agents
        bytes32[] memory agents = didRegistry.getAgentsByHuman(humanDID);
        for (uint256 i = 0; i < agents.length; i++) {
            totalPoints += agentIncentives[agents[i]].totalPoints;
        }
    }
    
    /**
     * @dev Check if a Human DID is blacklisted
     */
    function isBlacklisted(bytes32 humanDID) external view returns (bool) {
        return humanIncentives[humanDID].blacklisted;
    }
    
    /**
     * @dev Get invite code owner
     */
    function getInviteCodeOwner(bytes32 inviteCode) external view returns (bytes32) {
        return inviteCodes[inviteCode];
    }
    
    /**
     * @dev Calculate effective points for display
     */
    function calculateEffectivePoints(bytes32 agentDID, uint256 rawPoints) external view returns (uint256) {
        return _calculateEffectivePoints(agentDID, rawPoints);
    }
}
