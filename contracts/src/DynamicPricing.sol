// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReputationScore.sol";

/**
 * @title DynamicPricing
 * @dev Implements the Claw-Economics dynamic pricing model
 * Total_Cost = Base_Fee × K_Reputation × K_Complexity × K_Supply/Demand
 */
contract DynamicPricing is Ownable {
    // ============ Constants ============

    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000

    // Complexity levels
    uint8 public constant COMPLEXITY_L1 = 1; // Simple: 1.0x
    uint8 public constant COMPLEXITY_L2 = 2; // Medium: 1.5x
    uint8 public constant COMPLEXITY_L3 = 3; // Complex: 2.5x

    // ============ State Variables ============

    ReputationScore public reputationScore;

    // Complexity coefficients (in basis points)
    mapping(uint8 => uint256) public complexityCoefficients;

    // Supply/Demand coefficient - updated periodically by oracle or admin
    uint256 public supplyDemandCoefficient = 10000; // 1.0x default

    // Queue metrics for supply/demand calculation
    uint256 public pendingTaskCount;
    uint256 public activeProviderCount;

    // Thresholds for supply/demand
    uint256 public idleThreshold = 10; // Below this = idle (0.9x)
    uint256 public peakThreshold = 100; // Above this = peak (up to 2.0x)

    // ============ Events ============

    event PriceCalculated(
        bytes32 indexed requesterDID,
        bytes32 indexed providerDID,
        uint256 baseFee,
        uint256 finalPrice,
        uint256 kReputation,
        uint256 kComplexity,
        uint256 kSupplyDemand
    );

    event SupplyDemandUpdated(uint256 newCoefficient, uint256 pendingTasks, uint256 activeProviders);
    event ComplexityCoefficientUpdated(uint8 level, uint256 coefficient);

    // ============ Constructor ============

    constructor(address _reputationScore) Ownable(msg.sender) {
        reputationScore = ReputationScore(_reputationScore);

        // Initialize complexity coefficients
        complexityCoefficients[COMPLEXITY_L1] = 10000; // 1.0x
        complexityCoefficients[COMPLEXITY_L2] = 15000; // 1.5x
        complexityCoefficients[COMPLEXITY_L3] = 25000; // 2.5x
    }

    // ============ Admin Functions ============

    function setReputationScore(address _reputationScore) external onlyOwner {
        reputationScore = ReputationScore(_reputationScore);
    }

    function setComplexityCoefficient(uint8 level, uint256 coefficient) external onlyOwner {
        require(level >= 1 && level <= 3, "DynamicPricing: invalid level");
        require(coefficient >= 5000 && coefficient <= 50000, "DynamicPricing: coefficient out of range");
        complexityCoefficients[level] = coefficient;
        emit ComplexityCoefficientUpdated(level, coefficient);
    }

    function setSupplyDemandThresholds(uint256 _idleThreshold, uint256 _peakThreshold) external onlyOwner {
        require(_idleThreshold < _peakThreshold, "DynamicPricing: invalid thresholds");
        idleThreshold = _idleThreshold;
        peakThreshold = _peakThreshold;
    }

    // ============ Queue Management ============

    // Authorized contracts that can update metrics
    mapping(address => bool) public authorizedContracts;

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "DynamicPricing: not authorized");
        _;
    }

    function setAuthorizedContract(address _contract, bool authorized) external onlyOwner {
        authorizedContracts[_contract] = authorized;
    }

    /**
     * @dev Update queue metrics (called by Escrow contract)
     */
    function updateQueueMetrics(uint256 _pendingTaskCount, uint256 _activeProviderCount) external onlyAuthorized {
        pendingTaskCount = _pendingTaskCount;
        activeProviderCount = _activeProviderCount;

        // Recalculate supply/demand coefficient
        supplyDemandCoefficient = _calculateSupplyDemandCoefficient();

        emit SupplyDemandUpdated(supplyDemandCoefficient, pendingTaskCount, activeProviderCount);
    }

    /**
     * @dev Increment pending task count
     */
    function incrementPendingTasks() external onlyAuthorized {
        pendingTaskCount++;
        supplyDemandCoefficient = _calculateSupplyDemandCoefficient();
    }

    /**
     * @dev Decrement pending task count
     */
    function decrementPendingTasks() external onlyAuthorized {
        if (pendingTaskCount > 0) {
            pendingTaskCount--;
        }
        supplyDemandCoefficient = _calculateSupplyDemandCoefficient();
    }

    // ============ Price Calculation ============

    /**
     * @dev Calculate the final price for a task
     * @param providerAgentDID Provider's Agent DID (used for reputation)
     * @param baseFee Base fee in USD1 (6 decimals)
     * @param complexity Complexity level (1, 2, or 3)
     * @return finalPrice The calculated final price
     */
    function calculatePrice(bytes32 providerAgentDID, uint256 baseFee, uint8 complexity)
        external
        view
        returns (uint256 finalPrice)
    {
        (finalPrice,,,) = calculatePriceDetailed(providerAgentDID, baseFee, complexity);
    }

    /**
     * @dev Calculate price with detailed breakdown
     */
    function calculatePriceDetailed(bytes32 providerAgentDID, uint256 baseFee, uint8 complexity)
        public
        view
        returns (uint256 finalPrice, uint256 kReputation, uint256 kComplexity, uint256 kSupplyDemand)
    {
        // Get K_Reputation from ReputationScore contract
        kReputation = reputationScore.getReputationCoefficient(providerAgentDID);

        // Get K_Complexity
        kComplexity = complexityCoefficients[complexity];
        if (kComplexity == 0) {
            kComplexity = BASIS_POINTS; // Default to 1.0x
        }

        // Get K_Supply/Demand
        kSupplyDemand = supplyDemandCoefficient;

        // Calculate: Base × K_Rep × K_Complex × K_SD / (BP^3)
        // Using intermediate steps to prevent overflow
        uint256 step1 = (baseFee * kReputation) / BASIS_POINTS;
        uint256 step2 = (step1 * kComplexity) / BASIS_POINTS;
        finalPrice = (step2 * kSupplyDemand) / BASIS_POINTS;
    }

    /**
     * @dev Get the premium amount for low-reputation agents (goes to insurance pool)
     * @param providerAgentDID Provider's Agent DID
     * @param baseFee Base fee
     * @return premium Amount to be collected as insurance premium
     */
    function calculateInsurancePremium(bytes32 providerAgentDID, uint256 baseFee) external view returns (uint256 premium) {
        uint256 kReputation = reputationScore.getReputationCoefficient(providerAgentDID);

        // Only collect premium if reputation coefficient > 1.0 (penalty territory)
        if (kReputation <= BASIS_POINTS) {
            return 0;
        }

        // Premium = baseFee × (K_Rep - 1.0) × 50%
        // 50% of the penalty goes to insurance pool
        uint256 penaltyAmount = (baseFee * (kReputation - BASIS_POINTS)) / BASIS_POINTS;
        premium = penaltyAmount / 2;
    }

    // ============ Internal Functions ============

    function _calculateSupplyDemandCoefficient() internal view returns (uint256) {
        if (pendingTaskCount <= idleThreshold) {
            // Idle: 0.9x to encourage task submission
            return 9000;
        } else if (pendingTaskCount >= peakThreshold) {
            // Peak: up to 2.0x
            return 20000;
        } else {
            // Linear interpolation between idle and peak
            // From 1.0x at idleThreshold to 2.0x at peakThreshold
            uint256 range = peakThreshold - idleThreshold;
            uint256 position = pendingTaskCount - idleThreshold;
            uint256 coeffRange = 20000 - 10000; // From 1.0 to 2.0

            return 10000 + (position * coeffRange) / range;
        }
    }

    // ============ View Functions ============

    function getComplexityCoefficient(uint8 level) external view returns (uint256) {
        return complexityCoefficients[level];
    }

    function getSupplyDemandCoefficient() external view returns (uint256) {
        return supplyDemandCoefficient;
    }

    function getQueueMetrics() external view returns (uint256 pending, uint256 providers, uint256 coefficient) {
        return (pendingTaskCount, activeProviderCount, supplyDemandCoefficient);
    }
}
