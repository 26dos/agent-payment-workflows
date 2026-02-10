// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title DIDRegistry
 * @dev Manages Human Root DIDs and Agent Sub-DIDs
 * DID format: keccak256(abi.encodePacked(address, nonce, salt))
 */
contract DIDRegistry is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Structs ============

    struct HumanDID {
        address owner;
        string metadata; // JSON metadata (name, avatar, etc.)
        uint256 createdAt;
        bool active;
    }

    struct AgentDID {
        bytes32 humanDID; // Parent Human DID
        string name;
        uint256 createdAt;
        bool active;
    }

    struct Mandate {
        uint256 dailyLimit; // Max USD1 per day (6 decimals)
        uint256 singleLimit; // Max USD1 per transaction
        uint256 expiry; // Unix timestamp
        uint256 dailySpent; // Amount spent today
        uint256 lastResetDay; // Day number for reset tracking
        bool active;
    }

    // ============ State Variables ============

    // Human DID => HumanDID struct
    mapping(bytes32 => HumanDID) public humanDIDs;

    // Address => Human DID (one per address)
    mapping(address => bytes32) public addressToHumanDID;

    // Agent DID => AgentDID struct
    mapping(bytes32 => AgentDID) public agentDIDs;

    // Human DID => list of Agent DIDs
    mapping(bytes32 => bytes32[]) public humanAgents;

    // Agent DID => Mandate
    mapping(bytes32 => Mandate) public mandates;

    // Nonce for DID generation
    mapping(address => uint256) public nonces;

    // ============ Events ============

    event HumanDIDRegistered(bytes32 indexed did, address indexed owner, string metadata);
    event AgentDIDRegistered(bytes32 indexed agentDID, bytes32 indexed humanDID, string name);
    event MandateCreated(bytes32 indexed agentDID, uint256 dailyLimit, uint256 singleLimit, uint256 expiry);
    event MandateUpdated(bytes32 indexed agentDID, uint256 dailyLimit, uint256 singleLimit, uint256 expiry);
    event MandateRevoked(bytes32 indexed agentDID);
    event DIDDeactivated(bytes32 indexed did, bool isHuman);

    // ============ Modifiers ============

    modifier onlyHumanDIDOwner(bytes32 humanDID) {
        require(humanDIDs[humanDID].owner == msg.sender, "DIDRegistry: not DID owner");
        require(humanDIDs[humanDID].active, "DIDRegistry: DID not active");
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Human DID Functions ============

    /**
     * @dev Register a new Human Root DID
     * @param metadata JSON metadata string
     * @return did The generated DID
     */
    function registerHumanDID(string calldata metadata) external returns (bytes32 did) {
        require(addressToHumanDID[msg.sender] == bytes32(0), "DIDRegistry: already registered");

        uint256 nonce = nonces[msg.sender]++;
        did = keccak256(abi.encodePacked(msg.sender, nonce, block.timestamp, "HUMAN"));

        humanDIDs[did] = HumanDID({
            owner: msg.sender,
            metadata: metadata,
            createdAt: block.timestamp,
            active: true
        });

        addressToHumanDID[msg.sender] = did;

        emit HumanDIDRegistered(did, msg.sender, metadata);
    }

    /**
     * @dev Get Human DID by address
     */
    function getHumanDIDByAddress(address addr) external view returns (bytes32) {
        return addressToHumanDID[addr];
    }

    /**
     * @dev Get Human DID details
     */
    function getHumanDID(bytes32 did) external view returns (HumanDID memory) {
        return humanDIDs[did];
    }

    // ============ Agent DID Functions ============

    /**
     * @dev Register a new Agent Sub-DID under a Human DID
     * @param humanDID The parent Human DID
     * @param agentName Name of the agent
     * @return agentDID The generated Agent DID
     */
    function registerAgentDID(bytes32 humanDID, string calldata agentName)
        external
        onlyHumanDIDOwner(humanDID)
        returns (bytes32 agentDID)
    {
        uint256 nonce = nonces[msg.sender]++;
        agentDID = keccak256(abi.encodePacked(humanDID, agentName, nonce, block.timestamp, "AGENT"));

        agentDIDs[agentDID] = AgentDID({
            humanDID: humanDID,
            name: agentName,
            createdAt: block.timestamp,
            active: true
        });

        humanAgents[humanDID].push(agentDID);

        emit AgentDIDRegistered(agentDID, humanDID, agentName);
    }

    /**
     * @dev Get all agents for a Human DID
     */
    function getAgentsByHuman(bytes32 humanDID) external view returns (bytes32[] memory) {
        return humanAgents[humanDID];
    }

    /**
     * @dev Get Agent DID details
     */
    function getAgentDID(bytes32 agentDID) external view returns (AgentDID memory) {
        return agentDIDs[agentDID];
    }

    /**
     * @dev Get the Human DID that owns an Agent DID
     */
    function getHumanForAgent(bytes32 agentDID) external view returns (bytes32) {
        return agentDIDs[agentDID].humanDID;
    }

    // ============ Mandate Functions ============

    /**
     * @dev Create or update a Mandate for an Agent
     * @param agentDID The Agent DID to authorize
     * @param dailyLimit Maximum USD1 per day
     * @param singleLimit Maximum USD1 per transaction
     * @param expiry Unix timestamp when mandate expires
     */
    function createMandate(bytes32 agentDID, uint256 dailyLimit, uint256 singleLimit, uint256 expiry) external {
        AgentDID storage agent = agentDIDs[agentDID];
        require(agent.active, "DIDRegistry: agent not active");
        require(humanDIDs[agent.humanDID].owner == msg.sender, "DIDRegistry: not agent owner");
        require(expiry > block.timestamp, "DIDRegistry: expiry must be future");

        bool isNew = !mandates[agentDID].active;

        mandates[agentDID] = Mandate({
            dailyLimit: dailyLimit,
            singleLimit: singleLimit,
            expiry: expiry,
            dailySpent: 0,
            lastResetDay: block.timestamp / 1 days,
            active: true
        });

        if (isNew) {
            emit MandateCreated(agentDID, dailyLimit, singleLimit, expiry);
        } else {
            emit MandateUpdated(agentDID, dailyLimit, singleLimit, expiry);
        }
    }

    /**
     * @dev Revoke a Mandate
     */
    function revokeMandate(bytes32 agentDID) external {
        AgentDID storage agent = agentDIDs[agentDID];
        require(humanDIDs[agent.humanDID].owner == msg.sender, "DIDRegistry: not agent owner");

        mandates[agentDID].active = false;
        emit MandateRevoked(agentDID);
    }

    /**
     * @dev Validate if a mandate allows a specific payment amount
     * @param agentDID The Agent DID making the payment
     * @param amount The payment amount
     * @return valid Whether the mandate is valid for this payment
     */
    function validateMandate(bytes32 agentDID, uint256 amount) external view returns (bool valid) {
        Mandate storage mandate = mandates[agentDID];

        if (!mandate.active) return false;
        if (block.timestamp > mandate.expiry) return false;
        if (amount > mandate.singleLimit) return false;

        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        uint256 todaySpent = mandate.lastResetDay == currentDay ? mandate.dailySpent : 0;

        if (todaySpent + amount > mandate.dailyLimit) return false;

        return true;
    }

    /**
     * @dev Record spending against a mandate (called by Escrow contract)
     * @param agentDID The Agent DID
     * @param amount The amount spent
     */
    function recordSpending(bytes32 agentDID, uint256 amount) external {
        // In production, this should be restricted to authorized contracts
        Mandate storage mandate = mandates[agentDID];
        require(mandate.active, "DIDRegistry: mandate not active");

        uint256 currentDay = block.timestamp / 1 days;

        // Reset daily spending if new day
        if (mandate.lastResetDay != currentDay) {
            mandate.dailySpent = 0;
            mandate.lastResetDay = currentDay;
        }

        mandate.dailySpent += amount;
    }

    /**
     * @dev Get mandate details
     */
    function getMandate(bytes32 agentDID) external view returns (Mandate memory) {
        return mandates[agentDID];
    }

    // ============ Deactivation Functions ============

    /**
     * @dev Deactivate a Human DID (and all its agents)
     */
    function deactivateHumanDID(bytes32 humanDID) external onlyHumanDIDOwner(humanDID) {
        humanDIDs[humanDID].active = false;

        // Deactivate all agents
        bytes32[] storage agents = humanAgents[humanDID];
        for (uint256 i = 0; i < agents.length; i++) {
            agentDIDs[agents[i]].active = false;
            mandates[agents[i]].active = false;
        }

        emit DIDDeactivated(humanDID, true);
    }

    /**
     * @dev Deactivate an Agent DID
     */
    function deactivateAgentDID(bytes32 agentDID) external {
        AgentDID storage agent = agentDIDs[agentDID];
        require(humanDIDs[agent.humanDID].owner == msg.sender, "DIDRegistry: not agent owner");

        agent.active = false;
        mandates[agentDID].active = false;

        emit DIDDeactivated(agentDID, false);
    }
}
