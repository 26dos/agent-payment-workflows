// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DIDRegistry.sol";

/**
 * @title ReputationScore
 * @dev Manages reputation scores for Human DIDs and Agent DIDs
 * Final Score = (Human_Score × 0.7) + (Agent_Score × 0.3)
 * 
 * Features:
 * - Initial score: 60 (baseline)
 * - Reputation cascading: Agent drops 10 → Human drops 1
 * - Blacklist support for severe violations
 */
contract ReputationScore is Ownable {
    // ============ Constants ============

    uint256 public constant INITIAL_SCORE = 60; // Changed from 75 to 60 (baseline)
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MIN_SCORE = 0;
    uint256 public constant SCORE_DECIMALS = 2; // Scores stored with 2 decimal places (60.00 = 6000)
    
    // Reputation cascading ratio (Agent drops 10 → Human drops 1)
    uint256 public constant CASCADE_RATIO = 10;

    // Weight factors (in basis points, 10000 = 100%)
    uint256 public constant HUMAN_WEIGHT = 7000; // 70%
    uint256 public constant AGENT_WEIGHT = 3000; // 30%

    // Score thresholds
    uint256 public constant PREMIUM_THRESHOLD = 9000; // 90.00 -> 0.8x discount
    uint256 public constant NORMAL_LOW = 6000; // 60.00
    uint256 public constant RISK_THRESHOLD = 6000; // < 60.00 -> 1.2x penalty
    uint256 public constant CRITICAL_THRESHOLD = 4000; // < 40.00 -> 1.5x penalty

    // ============ State Variables ============

    DIDRegistry public didRegistry;

    // Human DID => Score (with 2 decimals, e.g., 7500 = 75.00)
    mapping(bytes32 => uint256) public humanScores;

    // Agent DID => Score
    mapping(bytes32 => uint256) public agentScores;

    // Track if score has been initialized
    mapping(bytes32 => bool) public humanInitialized;
    mapping(bytes32 => bool) public agentInitialized;

    // Statistics for score calculation
    struct ScoreStats {
        uint256 totalTasks;
        uint256 successfulTasks;
        uint256 disputedTasks;
        uint256 totalVolume; // Total USD1 transacted
        uint256 lastUpdateTime;
    }

    mapping(bytes32 => ScoreStats) public humanStats;
    mapping(bytes32 => ScoreStats) public agentStats;

    // Authorized updaters (Escrow contract, etc.)
    mapping(address => bool) public authorizedUpdaters;
    
    // Blacklist tracking
    mapping(bytes32 => bool) public blacklistedHumans;
    mapping(bytes32 => uint256) public blacklistedAt;
    
    // Reputation change history for cascading
    mapping(bytes32 => uint256) public lastAgentScore; // Track last score for cascade calculation

    // ============ Events ============

    event ScoreUpdated(bytes32 indexed did, bool isHuman, uint256 oldScore, uint256 newScore, string reason);
    event StatsUpdated(bytes32 indexed did, bool isHuman, uint256 totalTasks, uint256 successfulTasks);
    event UpdaterAuthorized(address indexed updater, bool authorized);
    event ReputationCascade(bytes32 indexed humanDID, bytes32 indexed agentDID, uint256 agentDrop, uint256 humanDrop);
    event HumanBlacklisted(bytes32 indexed humanDID, string reason);
    event HumanUnblacklisted(bytes32 indexed humanDID);

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "ReputationScore: not authorized");
        _;
    }

    // ============ Constructor ============

    constructor(address _didRegistry) Ownable(msg.sender) {
        didRegistry = DIDRegistry(_didRegistry);
    }

    // ============ Admin Functions ============

    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }

    function setDIDRegistry(address _didRegistry) external onlyOwner {
        didRegistry = DIDRegistry(_didRegistry);
    }

    // ============ Score Initialization ============

    /**
     * @dev Initialize score for a Human DID
     */
    function initializeHumanScore(bytes32 humanDID) external {
        require(!humanInitialized[humanDID], "ReputationScore: already initialized");
        DIDRegistry.HumanDID memory did = didRegistry.getHumanDID(humanDID);
        require(did.active, "ReputationScore: DID not active");

        humanScores[humanDID] = INITIAL_SCORE * 100; // 75.00
        humanInitialized[humanDID] = true;
        humanStats[humanDID].lastUpdateTime = block.timestamp;

        emit ScoreUpdated(humanDID, true, 0, INITIAL_SCORE * 100, "initialized");
    }

    /**
     * @dev Initialize score for an Agent DID
     */
    function initializeAgentScore(bytes32 agentDID) external {
        require(!agentInitialized[agentDID], "ReputationScore: already initialized");
        DIDRegistry.AgentDID memory did = didRegistry.getAgentDID(agentDID);
        require(did.active, "ReputationScore: agent not active");

        agentScores[agentDID] = INITIAL_SCORE * 100;
        agentInitialized[agentDID] = true;
        agentStats[agentDID].lastUpdateTime = block.timestamp;

        emit ScoreUpdated(agentDID, false, 0, INITIAL_SCORE * 100, "initialized");
    }

    // ============ Score Query Functions ============

    /**
     * @dev Get Human score (returns with 2 decimals)
     */
    function getHumanScore(bytes32 humanDID) external view returns (uint256) {
        if (!humanInitialized[humanDID]) {
            return INITIAL_SCORE * 100;
        }
        return humanScores[humanDID];
    }

    /**
     * @dev Get Agent score
     */
    function getAgentScore(bytes32 agentDID) external view returns (uint256) {
        if (!agentInitialized[agentDID]) {
            return INITIAL_SCORE * 100;
        }
        return agentScores[agentDID];
    }

    /**
     * @dev Get combined final score for an Agent (Human 70% + Agent 30%)
     * @param agentDID The Agent DID
     * @return finalScore The weighted combined score
     */
    function getFinalScore(bytes32 agentDID) public view returns (uint256 finalScore) {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        bytes32 humanDID = agent.humanDID;

        uint256 hScore = humanInitialized[humanDID] ? humanScores[humanDID] : INITIAL_SCORE * 100;
        uint256 aScore = agentInitialized[agentDID] ? agentScores[agentDID] : INITIAL_SCORE * 100;

        // Final = (Human × 0.7) + (Agent × 0.3)
        finalScore = (hScore * HUMAN_WEIGHT + aScore * AGENT_WEIGHT) / 10000;
    }

    /**
     * @dev Get the K_Reputation coefficient based on score
     * @param agentDID The Agent DID
     * @return coefficient The reputation coefficient (in basis points, 10000 = 1.0x)
     */
    function getReputationCoefficient(bytes32 agentDID) external view returns (uint256 coefficient) {
        uint256 score = getFinalScore(agentDID);

        if (score >= PREMIUM_THRESHOLD) {
            // > 90 score: 0.8x discount
            return 8000;
        } else if (score >= NORMAL_LOW) {
            // 60-90: 1.0x normal
            return 10000;
        } else if (score >= CRITICAL_THRESHOLD) {
            // 40-60: 1.2x penalty
            return 12000;
        } else {
            // < 40: 1.5x severe penalty
            return 15000;
        }
    }

    // ============ Score Update Functions ============

    /**
     * @dev Record a successful task completion
     * @param requesterAgentDID Requester's Agent DID
     * @param providerAgentDID Provider's Agent DID
     * @param amount Transaction amount
     */
    function recordTaskSuccess(bytes32 requesterAgentDID, bytes32 providerAgentDID, uint256 amount)
        external
        onlyAuthorized
    {
        _updateStatsOnSuccess(requesterAgentDID, amount);
        _updateStatsOnSuccess(providerAgentDID, amount);

        // Slightly increase scores for successful tasks
        _adjustScore(requesterAgentDID, true, 10); // +0.10 for requester
        _adjustScore(providerAgentDID, true, 20); // +0.20 for provider (did the work)
    }

    /**
     * @dev Record a disputed task (reduces scores)
     * @param agentDID The DID that caused the dispute
     * @param severity 1=minor, 2=moderate, 3=severe
     */
    function recordDispute(bytes32 agentDID, uint8 severity) external onlyAuthorized {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);

        // Update stats
        agentStats[agentDID].disputedTasks++;
        humanStats[agent.humanDID].disputedTasks++;

        // Calculate score reduction
        uint256 reduction;
        if (severity == 1) {
            reduction = 100; // -1.00
        } else if (severity == 2) {
            reduction = 300; // -3.00
        } else {
            reduction = 500; // -5.00
        }

        // Agent score drops faster
        _adjustScore(agentDID, false, reduction * 2);

        // Human score drops slower
        _adjustHumanScore(agent.humanDID, false, reduction);
    }

    /**
     * @dev Manual score adjustment (admin only, for exceptional cases)
     */
    function adminAdjustScore(bytes32 did, bool isHuman, bool increase, uint256 amount, string calldata reason)
        external
        onlyOwner
    {
        if (isHuman) {
            _adjustHumanScore(did, increase, amount);
        } else {
            _adjustScore(did, increase, amount);
        }
    }

    // ============ Internal Functions ============

    function _updateStatsOnSuccess(bytes32 agentDID, uint256 amount) internal {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);

        agentStats[agentDID].totalTasks++;
        agentStats[agentDID].successfulTasks++;
        agentStats[agentDID].totalVolume += amount;
        agentStats[agentDID].lastUpdateTime = block.timestamp;

        humanStats[agent.humanDID].totalTasks++;
        humanStats[agent.humanDID].successfulTasks++;
        humanStats[agent.humanDID].totalVolume += amount;
        humanStats[agent.humanDID].lastUpdateTime = block.timestamp;

        emit StatsUpdated(
            agentDID, false, agentStats[agentDID].totalTasks, agentStats[agentDID].successfulTasks
        );
    }

    function _adjustScore(bytes32 agentDID, bool increase, uint256 amount) internal {
        if (!agentInitialized[agentDID]) {
            agentScores[agentDID] = INITIAL_SCORE * 100;
            agentInitialized[agentDID] = true;
        }

        uint256 oldScore = agentScores[agentDID];
        uint256 newScore;

        if (increase) {
            newScore = oldScore + amount;
            if (newScore > MAX_SCORE * 100) {
                newScore = MAX_SCORE * 100;
            }
        } else {
            if (amount >= oldScore) {
                newScore = MIN_SCORE * 100;
            } else {
                newScore = oldScore - amount;
            }
        }

        agentScores[agentDID] = newScore;
        emit ScoreUpdated(agentDID, false, oldScore, newScore, increase ? "increase" : "decrease");
    }

    function _adjustHumanScore(bytes32 humanDID, bool increase, uint256 amount) internal {
        if (!humanInitialized[humanDID]) {
            humanScores[humanDID] = INITIAL_SCORE * 100;
            humanInitialized[humanDID] = true;
        }

        uint256 oldScore = humanScores[humanDID];
        uint256 newScore;

        if (increase) {
            newScore = oldScore + amount;
            if (newScore > MAX_SCORE * 100) {
                newScore = MAX_SCORE * 100;
            }
        } else {
            if (amount >= oldScore) {
                newScore = MIN_SCORE * 100;
            } else {
                newScore = oldScore - amount;
            }
        }

        humanScores[humanDID] = newScore;
        emit ScoreUpdated(humanDID, true, oldScore, newScore, increase ? "increase" : "decrease");
    }

    // ============ Reputation Cascading Functions ============

    /**
     * @dev Record dispute with automatic reputation cascading
     * Agent score drops affect Human score at 10:1 ratio
     * @param agentDID The DID that caused the dispute
     * @param severity 1=minor, 2=moderate, 3=severe
     */
    function recordDisputeWithCascade(bytes32 agentDID, uint8 severity) external onlyAuthorized {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        bytes32 humanDID = agent.humanDID;
        
        // Store old score for cascade calculation
        uint256 oldAgentScore = agentInitialized[agentDID] ? agentScores[agentDID] : INITIAL_SCORE * 100;
        
        // Update stats
        agentStats[agentDID].disputedTasks++;
        humanStats[humanDID].disputedTasks++;

        // Calculate score reduction
        uint256 reduction;
        if (severity == 1) {
            reduction = 100; // -1.00
        } else if (severity == 2) {
            reduction = 300; // -3.00
        } else {
            reduction = 500; // -5.00
        }

        // Agent score drops faster (2x)
        uint256 agentReduction = reduction * 2;
        _adjustScore(agentDID, false, agentReduction);
        
        // Calculate new agent score
        uint256 newAgentScore = agentScores[agentDID];
        
        // Apply cascading to human (10:1 ratio)
        if (oldAgentScore > newAgentScore) {
            uint256 agentDrop = oldAgentScore - newAgentScore;
            uint256 humanDrop = agentDrop / CASCADE_RATIO;
            
            if (humanDrop > 0) {
                _adjustHumanScore(humanDID, false, humanDrop);
                emit ReputationCascade(humanDID, agentDID, agentDrop, humanDrop);
            }
        }
    }

    /**
     * @dev Apply direct reputation cascade from agent to human
     * Called when an agent's reputation drops significantly
     * @param agentDID The Agent DID
     * @param agentDrop Amount of agent score drop (with 2 decimals)
     */
    function applyCascade(bytes32 agentDID, uint256 agentDrop) external onlyAuthorized {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        bytes32 humanDID = agent.humanDID;
        
        uint256 humanDrop = agentDrop / CASCADE_RATIO;
        
        if (humanDrop > 0) {
            _adjustHumanScore(humanDID, false, humanDrop);
            emit ReputationCascade(humanDID, agentDID, agentDrop, humanDrop);
        }
    }

    // ============ Blacklist Functions ============

    /**
     * @dev Blacklist a Human DID (super arbitration violation)
     * @param humanDID The Human DID to blacklist
     * @param reason Reason for blacklisting
     */
    function blacklistHuman(bytes32 humanDID, string calldata reason) external onlyAuthorized {
        require(!blacklistedHumans[humanDID], "ReputationScore: already blacklisted");
        
        blacklistedHumans[humanDID] = true;
        blacklistedAt[humanDID] = block.timestamp;
        
        // Set score to 0
        uint256 oldScore = humanScores[humanDID];
        humanScores[humanDID] = 0;
        
        // Deactivate all agent scores under this human
        bytes32[] memory agents = didRegistry.getAgentsByHuman(humanDID);
        for (uint256 i = 0; i < agents.length; i++) {
            uint256 oldAgentScore = agentScores[agents[i]];
            agentScores[agents[i]] = 0;
            emit ScoreUpdated(agents[i], false, oldAgentScore, 0, "human_blacklisted");
        }
        
        emit ScoreUpdated(humanDID, true, oldScore, 0, "blacklisted");
        emit HumanBlacklisted(humanDID, reason);
    }

    /**
     * @dev Remove Human DID from blacklist (admin only, exceptional cases)
     * @param humanDID The Human DID to unblacklist
     */
    function unblacklistHuman(bytes32 humanDID) external onlyOwner {
        require(blacklistedHumans[humanDID], "ReputationScore: not blacklisted");
        
        blacklistedHumans[humanDID] = false;
        // Note: Score remains at 0, must be rebuilt through good behavior
        
        emit HumanUnblacklisted(humanDID);
    }

    /**
     * @dev Check if a Human DID is blacklisted
     */
    function isBlacklisted(bytes32 humanDID) external view returns (bool) {
        return blacklistedHumans[humanDID];
    }

    // ============ View Functions ============

    function getHumanStats(bytes32 humanDID) external view returns (ScoreStats memory) {
        return humanStats[humanDID];
    }

    function getAgentStats(bytes32 agentDID) external view returns (ScoreStats memory) {
        return agentStats[agentDID];
    }
    
    /**
     * @dev Get effective reputation coefficient considering blacklist
     * Returns 0 if blacklisted, otherwise normal coefficient
     */
    function getEffectiveCoefficient(bytes32 agentDID) external view returns (uint256) {
        DIDRegistry.AgentDID memory agent = didRegistry.getAgentDID(agentDID);
        
        // If human is blacklisted, return maximum penalty
        if (blacklistedHumans[agent.humanDID]) {
            return 0;
        }
        
        uint256 score = getFinalScore(agentDID);

        if (score >= PREMIUM_THRESHOLD) {
            return 8000;  // 0.8x discount
        } else if (score >= NORMAL_LOW) {
            return 10000; // 1.0x normal
        } else if (score >= CRITICAL_THRESHOLD) {
            return 12000; // 1.2x penalty
        } else {
            return 15000; // 1.5x severe penalty
        }
    }
}
