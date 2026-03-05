// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./DualDIDRegistry.sol";

/**
 * @title ReputationScore
 * @dev Manages reputation scores for On-Chain DIDs and Sub-DIDs (Agents)
 * Compatible with DualDIDRegistry system
 * 
 * Final Score = (OnChainDID_Score × 0.7) + (SubDID_Score × 0.3)
 * 
 * Features:
 * - Initial score: 60 (baseline)
 * - Reputation cascading: SubDID drops 10 → OnChainDID drops 1
 * - Blacklist support for severe violations
 */
contract ReputationScore is Ownable {
    // ============ Constants ============

    uint256 public constant INITIAL_SCORE = 60;
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant MIN_SCORE = 0;
    uint256 public constant SCORE_DECIMALS = 2;
    
    uint256 public constant CASCADE_RATIO = 10;

    uint256 public constant HUMAN_WEIGHT = 7000; // 70%
    uint256 public constant AGENT_WEIGHT = 3000; // 30%

    uint256 public constant PREMIUM_THRESHOLD = 9000;
    uint256 public constant NORMAL_LOW = 6000;
    uint256 public constant RISK_THRESHOLD = 6000;
    uint256 public constant CRITICAL_THRESHOLD = 4000;

    // ============ State Variables ============

    DualDIDRegistry public dualDIDRegistry;

    // OnChainDID => Score (with 2 decimals, e.g., 6000 = 60.00)
    mapping(bytes32 => uint256) public onChainDIDScores;

    // SubDID (Agent) => Score
    mapping(bytes32 => uint256) public subDIDScores;

    // Track if score has been initialized
    mapping(bytes32 => bool) public onChainDIDInitialized;
    mapping(bytes32 => bool) public subDIDInitialized;

    // Statistics for score calculation
    struct ScoreStats {
        uint256 totalTasks;
        uint256 successfulTasks;
        uint256 disputedTasks;
        uint256 totalVolume;
        uint256 lastUpdateTime;
    }

    mapping(bytes32 => ScoreStats) public onChainDIDStats;
    mapping(bytes32 => ScoreStats) public subDIDStats;

    // For compatibility with old interface
    mapping(bytes32 => ScoreStats) public humanStats;
    mapping(bytes32 => ScoreStats) public agentStats;

    // Authorized updaters (Escrow contract, etc.)
    mapping(address => bool) public authorizedUpdaters;
    
    // Blacklist tracking
    mapping(bytes32 => bool) public blacklistedOnChainDIDs;
    mapping(bytes32 => uint256) public blacklistedAt;

    // ============ Events ============

    event ScoreUpdated(bytes32 indexed did, bool isOnChainDID, uint256 oldScore, uint256 newScore, string reason);
    event StatsUpdated(bytes32 indexed did, bool isOnChainDID, uint256 totalTasks, uint256 successfulTasks);
    event UpdaterAuthorized(address indexed updater, bool authorized);
    event ReputationCascade(bytes32 indexed onChainDID, bytes32 indexed subDID, uint256 subDIDDrop, uint256 onChainDIDDrop);
    event OnChainDIDBlacklisted(bytes32 indexed onChainDID, string reason);
    event OnChainDIDUnblacklisted(bytes32 indexed onChainDID);

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "ReputationScore: not authorized");
        _;
    }

    // ============ Constructor ============

    constructor(address _dualDIDRegistry) Ownable(msg.sender) {
        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
    }

    // ============ Admin Functions ============

    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }

    function setDualDIDRegistry(address _dualDIDRegistry) external onlyOwner {
        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
    }

    // ============ Score Query Functions ============

    function getOnChainDIDScore(bytes32 onChainDID) external view returns (uint256) {
        if (!onChainDIDInitialized[onChainDID]) {
            return INITIAL_SCORE * 100;
        }
        return onChainDIDScores[onChainDID];
    }

    function getSubDIDScore(bytes32 subDID) external view returns (uint256) {
        if (!subDIDInitialized[subDID]) {
            return INITIAL_SCORE * 100;
        }
        return subDIDScores[subDID];
    }

    // Compatibility aliases
    function getHumanScore(bytes32 did) external view returns (uint256) {
        if (!onChainDIDInitialized[did]) {
            return INITIAL_SCORE * 100;
        }
        return onChainDIDScores[did];
    }

    function getAgentScore(bytes32 did) external view returns (uint256) {
        if (!subDIDInitialized[did]) {
            return INITIAL_SCORE * 100;
        }
        return subDIDScores[did];
    }

    /**
     * @dev Get combined final score for a SubDID (OnChainDID 70% + SubDID 30%)
     * @param subDID The Sub-DID hash
     * @return finalScore The weighted combined score
     */
    function getFinalScore(bytes32 subDID) public view returns (uint256 finalScore) {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        bytes32 onChainDID = sub.parentOnChainDID;

        uint256 oScore = onChainDIDInitialized[onChainDID] ? onChainDIDScores[onChainDID] : INITIAL_SCORE * 100;
        uint256 sScore = subDIDInitialized[subDID] ? subDIDScores[subDID] : INITIAL_SCORE * 100;

        finalScore = (oScore * HUMAN_WEIGHT + sScore * AGENT_WEIGHT) / 10000;
    }

    /**
     * @dev Get the K_Reputation coefficient based on score
     */
    function getReputationCoefficient(bytes32 subDID) external view returns (uint256 coefficient) {
        uint256 score = getFinalScore(subDID);

        if (score >= PREMIUM_THRESHOLD) {
            return 8000;
        } else if (score >= NORMAL_LOW) {
            return 10000;
        } else if (score >= CRITICAL_THRESHOLD) {
            return 12000;
        } else {
            return 15000;
        }
    }

    // ============ Score Update Functions ============

    /**
     * @dev Record a successful task completion
     * @param requesterSubDID Requester's Sub-DID
     * @param providerSubDID Provider's Sub-DID
     * @param amount Transaction amount
     */
    function recordTaskSuccess(bytes32 requesterSubDID, bytes32 providerSubDID, uint256 amount)
        external
        onlyAuthorized
    {
        _updateStatsOnSuccess(requesterSubDID, amount);
        _updateStatsOnSuccess(providerSubDID, amount);

        _adjustSubDIDScore(requesterSubDID, true, 10);
        _adjustSubDIDScore(providerSubDID, true, 20);
    }

    /**
     * @dev Record a disputed task (reduces scores)
     * @param subDID The SubDID that caused the dispute
     * @param severity 1=minor, 2=moderate, 3=severe
     */
    function recordDispute(bytes32 subDID, uint8 severity) external onlyAuthorized {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        bytes32 onChainDID = sub.parentOnChainDID;

        subDIDStats[subDID].disputedTasks++;
        agentStats[subDID].disputedTasks++;
        onChainDIDStats[onChainDID].disputedTasks++;
        humanStats[onChainDID].disputedTasks++;

        uint256 reduction;
        if (severity == 1) {
            reduction = 100;
        } else if (severity == 2) {
            reduction = 300;
        } else {
            reduction = 500;
        }

        _adjustSubDIDScore(subDID, false, reduction * 2);
        _adjustOnChainDIDScore(onChainDID, false, reduction);
    }

    function adminAdjustScore(bytes32 did, bool isOnChainDID, bool increase, uint256 amount, string calldata)
        external
        onlyOwner
    {
        if (isOnChainDID) {
            _adjustOnChainDIDScore(did, increase, amount);
        } else {
            _adjustSubDIDScore(did, increase, amount);
        }
    }

    // ============ Internal Functions ============

    function _updateStatsOnSuccess(bytes32 subDID, uint256 amount) internal {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        bytes32 onChainDID = sub.parentOnChainDID;

        subDIDStats[subDID].totalTasks++;
        subDIDStats[subDID].successfulTasks++;
        subDIDStats[subDID].totalVolume += amount;
        subDIDStats[subDID].lastUpdateTime = block.timestamp;

        agentStats[subDID].totalTasks++;
        agentStats[subDID].successfulTasks++;
        agentStats[subDID].totalVolume += amount;
        agentStats[subDID].lastUpdateTime = block.timestamp;

        onChainDIDStats[onChainDID].totalTasks++;
        onChainDIDStats[onChainDID].successfulTasks++;
        onChainDIDStats[onChainDID].totalVolume += amount;
        onChainDIDStats[onChainDID].lastUpdateTime = block.timestamp;

        humanStats[onChainDID].totalTasks++;
        humanStats[onChainDID].successfulTasks++;
        humanStats[onChainDID].totalVolume += amount;
        humanStats[onChainDID].lastUpdateTime = block.timestamp;

        emit StatsUpdated(subDID, false, subDIDStats[subDID].totalTasks, subDIDStats[subDID].successfulTasks);
    }

    function _adjustSubDIDScore(bytes32 subDID, bool increase, uint256 amount) internal {
        if (!subDIDInitialized[subDID]) {
            subDIDScores[subDID] = INITIAL_SCORE * 100;
            subDIDInitialized[subDID] = true;
        }

        uint256 oldScore = subDIDScores[subDID];
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

        subDIDScores[subDID] = newScore;
        emit ScoreUpdated(subDID, false, oldScore, newScore, increase ? "increase" : "decrease");
    }

    function _adjustOnChainDIDScore(bytes32 onChainDID, bool increase, uint256 amount) internal {
        if (!onChainDIDInitialized[onChainDID]) {
            onChainDIDScores[onChainDID] = INITIAL_SCORE * 100;
            onChainDIDInitialized[onChainDID] = true;
        }

        uint256 oldScore = onChainDIDScores[onChainDID];
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

        onChainDIDScores[onChainDID] = newScore;
        emit ScoreUpdated(onChainDID, true, oldScore, newScore, increase ? "increase" : "decrease");
    }

    // ============ Blacklist Functions ============

    function blacklistOnChainDID(bytes32 onChainDID, string calldata reason) external onlyAuthorized {
        require(!blacklistedOnChainDIDs[onChainDID], "ReputationScore: already blacklisted");
        
        blacklistedOnChainDIDs[onChainDID] = true;
        blacklistedAt[onChainDID] = block.timestamp;
        
        uint256 oldScore = onChainDIDScores[onChainDID];
        onChainDIDScores[onChainDID] = 0;

        bytes32[] memory subDIDs = dualDIDRegistry.getSubDIDsByOnChainDID(onChainDID);
        for (uint256 i = 0; i < subDIDs.length; i++) {
            uint256 oldSubScore = subDIDScores[subDIDs[i]];
            subDIDScores[subDIDs[i]] = 0;
            emit ScoreUpdated(subDIDs[i], false, oldSubScore, 0, "onchain_blacklisted");
        }
        
        emit ScoreUpdated(onChainDID, true, oldScore, 0, "blacklisted");
        emit OnChainDIDBlacklisted(onChainDID, reason);
    }

    // Compatibility alias
    function blacklistHuman(bytes32 did, string calldata reason) external onlyAuthorized {
        require(!blacklistedOnChainDIDs[did], "ReputationScore: already blacklisted");
        
        blacklistedOnChainDIDs[did] = true;
        blacklistedAt[did] = block.timestamp;
        
        uint256 oldScore = onChainDIDScores[did];
        onChainDIDScores[did] = 0;
        
        emit ScoreUpdated(did, true, oldScore, 0, "blacklisted");
        emit OnChainDIDBlacklisted(did, reason);
    }

    function unblacklistOnChainDID(bytes32 onChainDID) external onlyOwner {
        require(blacklistedOnChainDIDs[onChainDID], "ReputationScore: not blacklisted");
        
        blacklistedOnChainDIDs[onChainDID] = false;
        
        emit OnChainDIDUnblacklisted(onChainDID);
    }

    function isBlacklisted(bytes32 did) external view returns (bool) {
        return blacklistedOnChainDIDs[did];
    }

    // ============ View Functions ============

    function getOnChainDIDStats(bytes32 onChainDID) external view returns (ScoreStats memory) {
        return onChainDIDStats[onChainDID];
    }

    function getSubDIDStats(bytes32 subDID) external view returns (ScoreStats memory) {
        return subDIDStats[subDID];
    }

    // Compatibility aliases
    function getHumanStats(bytes32 did) external view returns (ScoreStats memory) {
        return humanStats[did];
    }

    function getAgentStats(bytes32 did) external view returns (ScoreStats memory) {
        return agentStats[did];
    }

    function getEffectiveCoefficient(bytes32 subDID) external view returns (uint256) {
        DualDIDRegistry.SubDID memory sub = dualDIDRegistry.getSubDID(subDID);
        
        if (blacklistedOnChainDIDs[sub.parentOnChainDID]) {
            return 0;
        }
        
        uint256 score = getFinalScore(subDID);

        if (score >= PREMIUM_THRESHOLD) {
            return 8000;
        } else if (score >= NORMAL_LOW) {
            return 10000;
        } else if (score >= CRITICAL_THRESHOLD) {
            return 12000;
        } else {
            return 15000;
        }
    }
}
