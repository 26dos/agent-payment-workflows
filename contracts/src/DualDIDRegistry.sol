// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DualDIDRegistry
 * @dev Manages the dual-layer DID system for ClawPay
 * 
 * Off-chain DID (Display ID / Social ID):
 * - User-defined format: NNNN-LLLL (4 digits + 4 letters)
 * - Normal users: digits 2000-9999, letters must contain at least 1 vowel
 * - Premium DIDs: digits 0001-1999, special patterns, no vowel requirement
 * - Transferable between users
 * 
 * On-chain DID (Asset ID):
 * - Auto-generated when wallet connects
 * - Permanently bound to wallet address
 * - Non-transferable
 */
contract DualDIDRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum DIDTier {
        Normal,     // 0: Regular user-generated DID
        TierB,      // 1: Symmetric/mirror patterns
        TierA,      // 2: Meaningful words
        TierS,      // 3: Special combinations
        TierSS,     // 4: Repeating/sequential patterns
        TierSSS     // 5: Pure 4-digit or super rare
    }

    enum AuctionStatus {
        NotStarted,
        Active,
        Ended,
        Cancelled
    }

    // ============ Structs ============

    struct OffChainDID {
        string displayId;           // The display ID string (e.g., "2345-MIKE")
        DIDTier tier;               // Rarity tier
        bool isSystemGenerated;     // True if system premium DID
        bytes32 currentOwnerOnChainDID;  // Current owner's on-chain DID
        uint256 createdAt;
        uint256 lastTransferredAt;
        bool active;
    }

    struct OnChainDID {
        bytes32 id;                 // The on-chain DID hash
        address walletAddress;      // Bound wallet address
        bytes32 linkedOffChainDID;  // Linked off-chain DID hash
        uint256 createdAt;
        bool active;
    }

    struct TransferListing {
        bytes32 offChainDIDHash;    // Hash of the off-chain DID
        address seller;             // Seller's wallet address
        uint256 price;              // Price in payment token (6 decimals)
        address paymentToken;       // USD1/USDT/USDC address
        uint256 listedAt;
        bool active;
    }

    struct SubDID {
        bytes32 id;                 // The sub-DID hash
        bytes32 parentOnChainDID;   // Parent on-chain DID
        string name;                // Agent/Sub-DID name
        uint256 createdAt;
        bool active;
    }

    // ============ Constants ============

    bytes1 private constant VOWEL_A = 'A';
    bytes1 private constant VOWEL_E = 'E';
    bytes1 private constant VOWEL_I = 'I';
    bytes1 private constant VOWEL_O = 'O';
    bytes1 private constant VOWEL_U = 'U';

    uint256 public constant TRANSFER_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ State Variables ============

    // Off-chain DID hash => OffChainDID struct
    mapping(bytes32 => OffChainDID) public offChainDIDs;
    
    // Display ID string => hash (for uniqueness check)
    mapping(string => bytes32) public displayIdToHash;

    // On-chain DID hash => OnChainDID struct
    mapping(bytes32 => OnChainDID) public onChainDIDs;

    // Wallet address => On-chain DID hash
    mapping(address => bytes32) public walletToOnChainDID;

    // Transfer listings: off-chain DID hash => TransferListing
    mapping(bytes32 => TransferListing) public transferListings;

    // Supported payment tokens
    mapping(address => bool) public supportedPaymentTokens;

    // Platform treasury
    address public treasury;

    // Authorized contracts (auction contract, etc.)
    mapping(address => bool) public authorizedContracts;

    // Reserved/blocked display IDs (sensitive words)
    mapping(string => bool) public blockedDisplayIds;

    // Total registered counts
    uint256 public totalOffChainDIDs;
    uint256 public totalOnChainDIDs;
    uint256 public totalSubDIDs;

    // Sub-DID hash => SubDID struct
    mapping(bytes32 => SubDID) public subDIDs;

    // On-chain DID => array of Sub-DIDs
    mapping(bytes32 => bytes32[]) public onChainDIDToSubDIDs;

    // Nonces for Sub-DID generation
    mapping(address => uint256) public subDIDNonces;
    uint256 public totalPremiumDIDs;

    // ============ Events ============

    event OffChainDIDRegistered(
        bytes32 indexed offChainDIDHash,
        string displayId,
        DIDTier tier,
        bool isSystemGenerated
    );
    
    event OnChainDIDRegistered(
        bytes32 indexed onChainDIDHash,
        address indexed walletAddress,
        bytes32 indexed linkedOffChainDID
    );

    event DIDsLinked(
        bytes32 indexed onChainDIDHash,
        bytes32 indexed offChainDIDHash
    );

    event TransferListingCreated(
        bytes32 indexed offChainDIDHash,
        address indexed seller,
        uint256 price,
        address paymentToken
    );

    event TransferListingCancelled(bytes32 indexed offChainDIDHash);

    event DIDTransferred(
        bytes32 indexed offChainDIDHash,
        bytes32 indexed fromOnChainDID,
        bytes32 indexed toOnChainDID,
        uint256 price
    );

    event PremiumDIDCreated(
        bytes32 indexed offChainDIDHash,
        string displayId,
        DIDTier tier
    );

    event PaymentTokenUpdated(address indexed token, bool supported);
    event TreasuryUpdated(address indexed newTreasury);

    event SubDIDRegistered(
        bytes32 indexed subDIDHash,
        bytes32 indexed parentOnChainDID,
        string name,
        address indexed owner
    );

    event SubDIDDeactivated(bytes32 indexed subDIDHash);

    // ============ Modifiers ============

    modifier validPaymentToken(address token) {
        require(supportedPaymentTokens[token], "DualDID: unsupported payment token");
        _;
    }

    modifier hasOnChainDID() {
        require(walletToOnChainDID[msg.sender] != bytes32(0), "DualDID: no on-chain DID");
        _;
    }

    // ============ Constructor ============

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "DualDID: invalid treasury");
        treasury = _treasury;
    }

    // ============ Admin Functions ============

    function setPaymentToken(address token, bool supported) external onlyOwner {
        supportedPaymentTokens[token] = supported;
        emit PaymentTokenUpdated(token, supported);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "DualDID: invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function blockDisplayId(string calldata displayId, bool blocked) external onlyOwner {
        blockedDisplayIds[displayId] = blocked;
    }

    function blockDisplayIdsBatch(string[] calldata displayIds, bool blocked) external onlyOwner {
        for (uint256 i = 0; i < displayIds.length; i++) {
            blockedDisplayIds[displayIds[i]] = blocked;
        }
    }

    function setAuthorizedContract(address contractAddr, bool authorized) external onlyOwner {
        authorizedContracts[contractAddr] = authorized;
    }

    // ============ Premium DID Generation (Admin) ============

    /**
     * @dev Create a premium DID (system-generated)
     * @param displayId The display ID string
     * @param tier The rarity tier
     */
    function createPremiumDID(string calldata displayId, DIDTier tier) external onlyOwner {
        require(tier != DIDTier.Normal, "DualDID: premium must have tier");
        require(!blockedDisplayIds[displayId], "DualDID: display ID blocked");
        require(displayIdToHash[displayId] == bytes32(0), "DualDID: display ID exists");
        
        bytes32 offChainDIDHash = keccak256(abi.encodePacked(displayId));
        
        offChainDIDs[offChainDIDHash] = OffChainDID({
            displayId: displayId,
            tier: tier,
            isSystemGenerated: true,
            currentOwnerOnChainDID: bytes32(0), // Not owned yet
            createdAt: block.timestamp,
            lastTransferredAt: 0,
            active: true
        });

        displayIdToHash[displayId] = offChainDIDHash;
        totalPremiumDIDs++;

        emit PremiumDIDCreated(offChainDIDHash, displayId, tier);
        emit OffChainDIDRegistered(offChainDIDHash, displayId, tier, true);
    }

    /**
     * @dev Batch create premium DIDs
     */
    function createPremiumDIDsBatch(
        string[] calldata displayIds,
        DIDTier[] calldata tiers
    ) external onlyOwner {
        require(displayIds.length == tiers.length, "DualDID: length mismatch");
        
        for (uint256 i = 0; i < displayIds.length; i++) {
            if (blockedDisplayIds[displayIds[i]] || displayIdToHash[displayIds[i]] != bytes32(0)) {
                continue;
            }
            
            require(tiers[i] != DIDTier.Normal, "DualDID: premium must have tier");
            
            bytes32 offChainDIDHash = keccak256(abi.encodePacked(displayIds[i]));
            
            offChainDIDs[offChainDIDHash] = OffChainDID({
                displayId: displayIds[i],
                tier: tiers[i],
                isSystemGenerated: true,
                currentOwnerOnChainDID: bytes32(0),
                createdAt: block.timestamp,
                lastTransferredAt: 0,
                active: true
            });

            displayIdToHash[displayIds[i]] = offChainDIDHash;
            totalPremiumDIDs++;

            emit PremiumDIDCreated(offChainDIDHash, displayIds[i], tiers[i]);
            emit OffChainDIDRegistered(offChainDIDHash, displayIds[i], tiers[i], true);
        }
    }

    // ============ User Registration Functions ============

    /**
     * @dev Register a new off-chain DID (user-generated)
     * Free registration only for Display IDs >= 5 characters
     * Shorter IDs (1-4 chars) require auction via PremiumDIDAuction contract
     * @param displayId The display ID string (e.g., "HELLO", "MYNAME123")
     */
    function registerOffChainDID(string calldata displayId) external hasOnChainDID returns (bytes32) {
        // Validate format (A-Z, 0-9 only, 1-32 chars)
        require(_validateNormalDisplayId(displayId), "DualDID: invalid format");
        // Short IDs (1-4 chars) require auction
        require(bytes(displayId).length >= 5, "DualDID: short IDs require auction");
        require(!blockedDisplayIds[displayId], "DualDID: display ID blocked");
        require(displayIdToHash[displayId] == bytes32(0), "DualDID: display ID exists");

        bytes32 onChainDIDHash = walletToOnChainDID[msg.sender];
        OnChainDID storage onChainDID = onChainDIDs[onChainDIDHash];
        
        // Check if user already has an off-chain DID
        require(onChainDID.linkedOffChainDID == bytes32(0), "DualDID: already has off-chain DID");

        bytes32 offChainDIDHash = keccak256(abi.encodePacked(displayId));

        offChainDIDs[offChainDIDHash] = OffChainDID({
            displayId: displayId,
            tier: DIDTier.Normal,
            isSystemGenerated: false,
            currentOwnerOnChainDID: onChainDIDHash,
            createdAt: block.timestamp,
            lastTransferredAt: 0,
            active: true
        });

        displayIdToHash[displayId] = offChainDIDHash;
        onChainDID.linkedOffChainDID = offChainDIDHash;
        totalOffChainDIDs++;

        emit OffChainDIDRegistered(offChainDIDHash, displayId, DIDTier.Normal, false);
        emit DIDsLinked(onChainDIDHash, offChainDIDHash);

        return offChainDIDHash;
    }

    /**
     * @dev Register on-chain DID and link to wallet
     * Called when user first connects wallet
     */
    function registerOnChainDID() external returns (bytes32) {
        require(walletToOnChainDID[msg.sender] == bytes32(0), "DualDID: already registered");

        // Generate on-chain DID
        bytes32 onChainDIDHash = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                block.prevrandao,
                "ONCHAIN"
            )
        );

        onChainDIDs[onChainDIDHash] = OnChainDID({
            id: onChainDIDHash,
            walletAddress: msg.sender,
            linkedOffChainDID: bytes32(0), // Will be linked later
            createdAt: block.timestamp,
            active: true
        });

        walletToOnChainDID[msg.sender] = onChainDIDHash;
        totalOnChainDIDs++;

        emit OnChainDIDRegistered(onChainDIDHash, msg.sender, bytes32(0));

        return onChainDIDHash;
    }

    // ============ Sub-DID (Agent DID) Functions ============

    /**
     * @dev Register a new Sub-DID under the caller's On-Chain DID
     * @param name Name of the agent/sub-DID
     * @return subDIDHash The generated Sub-DID hash
     */
    function registerSubDID(string calldata name) external hasOnChainDID returns (bytes32 subDIDHash) {
        require(bytes(name).length > 0, "DualDID: name required");
        require(bytes(name).length <= 64, "DualDID: name too long");

        bytes32 parentOnChainDID = walletToOnChainDID[msg.sender];
        uint256 nonce = subDIDNonces[msg.sender]++;

        subDIDHash = keccak256(
            abi.encodePacked(
                parentOnChainDID,
                name,
                nonce,
                block.timestamp,
                "SUBDID"
            )
        );

        subDIDs[subDIDHash] = SubDID({
            id: subDIDHash,
            parentOnChainDID: parentOnChainDID,
            name: name,
            createdAt: block.timestamp,
            active: true
        });

        onChainDIDToSubDIDs[parentOnChainDID].push(subDIDHash);
        totalSubDIDs++;

        emit SubDIDRegistered(subDIDHash, parentOnChainDID, name, msg.sender);

        return subDIDHash;
    }

    /**
     * @dev Get all Sub-DIDs for an On-Chain DID
     * @param onChainDIDHash The parent On-Chain DID
     */
    function getSubDIDsByOnChainDID(bytes32 onChainDIDHash) external view returns (bytes32[] memory) {
        return onChainDIDToSubDIDs[onChainDIDHash];
    }

    /**
     * @dev Get Sub-DID details
     * @param subDIDHash The Sub-DID hash
     */
    function getSubDID(bytes32 subDIDHash) external view returns (SubDID memory) {
        return subDIDs[subDIDHash];
    }

    /**
     * @dev Deactivate a Sub-DID
     * @param subDIDHash The Sub-DID to deactivate
     */
    function deactivateSubDID(bytes32 subDIDHash) external {
        SubDID storage subDID = subDIDs[subDIDHash];
        require(subDID.active, "DualDID: sub-DID not active");
        
        // Only the owner of parent On-Chain DID can deactivate
        bytes32 parentDID = subDID.parentOnChainDID;
        require(onChainDIDs[parentDID].walletAddress == msg.sender, "DualDID: not owner");

        subDID.active = false;
        emit SubDIDDeactivated(subDIDHash);
    }

    /**
     * @dev Complete registration: create on-chain DID and off-chain DID together
     * @param displayId The display ID for off-chain DID
     */
    function completeRegistration(string calldata displayId) external returns (bytes32 onChainDIDHash, bytes32 offChainDIDHash) {
        // Step 1: Register on-chain DID if not exists
        if (walletToOnChainDID[msg.sender] == bytes32(0)) {
            onChainDIDHash = keccak256(
                abi.encodePacked(
                    msg.sender,
                    block.timestamp,
                    block.prevrandao,
                    "ONCHAIN"
                )
            );

            onChainDIDs[onChainDIDHash] = OnChainDID({
                id: onChainDIDHash,
                walletAddress: msg.sender,
                linkedOffChainDID: bytes32(0),
                createdAt: block.timestamp,
                active: true
            });

            walletToOnChainDID[msg.sender] = onChainDIDHash;
            totalOnChainDIDs++;

            emit OnChainDIDRegistered(onChainDIDHash, msg.sender, bytes32(0));
        } else {
            onChainDIDHash = walletToOnChainDID[msg.sender];
        }

        // Step 2: Register off-chain DID
        require(_validateNormalDisplayId(displayId), "DualDID: invalid format");
        // Short IDs (1-4 chars) require auction
        require(bytes(displayId).length >= 5, "DualDID: short IDs require auction");
        require(!blockedDisplayIds[displayId], "DualDID: display ID blocked");
        require(displayIdToHash[displayId] == bytes32(0), "DualDID: display ID exists");
        
        OnChainDID storage onChainDID = onChainDIDs[onChainDIDHash];
        require(onChainDID.linkedOffChainDID == bytes32(0), "DualDID: already has off-chain DID");

        offChainDIDHash = keccak256(abi.encodePacked(displayId));

        offChainDIDs[offChainDIDHash] = OffChainDID({
            displayId: displayId,
            tier: DIDTier.Normal,
            isSystemGenerated: false,
            currentOwnerOnChainDID: onChainDIDHash,
            createdAt: block.timestamp,
            lastTransferredAt: 0,
            active: true
        });

        displayIdToHash[displayId] = offChainDIDHash;
        onChainDID.linkedOffChainDID = offChainDIDHash;
        totalOffChainDIDs++;

        emit OffChainDIDRegistered(offChainDIDHash, displayId, DIDTier.Normal, false);
        emit DIDsLinked(onChainDIDHash, offChainDIDHash);
    }

    // ============ DID Transfer Functions ============

    /**
     * @dev List an off-chain DID for transfer
     * @param offChainDIDHash The hash of the off-chain DID to list
     * @param price The price in payment token (6 decimals)
     * @param paymentToken The payment token address (USD1/USDT/USDC)
     */
    function listForTransfer(
        bytes32 offChainDIDHash,
        uint256 price,
        address paymentToken
    ) external hasOnChainDID validPaymentToken(paymentToken) {
        OffChainDID storage offChainDID = offChainDIDs[offChainDIDHash];
        require(offChainDID.active, "DualDID: DID not active");
        
        bytes32 onChainDIDHash = walletToOnChainDID[msg.sender];
        require(offChainDID.currentOwnerOnChainDID == onChainDIDHash, "DualDID: not owner");
        require(!transferListings[offChainDIDHash].active, "DualDID: already listed");

        transferListings[offChainDIDHash] = TransferListing({
            offChainDIDHash: offChainDIDHash,
            seller: msg.sender,
            price: price,
            paymentToken: paymentToken,
            listedAt: block.timestamp,
            active: true
        });

        emit TransferListingCreated(offChainDIDHash, msg.sender, price, paymentToken);
    }

    /**
     * @dev Cancel a transfer listing
     * @param offChainDIDHash The hash of the off-chain DID
     */
    function cancelTransferListing(bytes32 offChainDIDHash) external {
        TransferListing storage listing = transferListings[offChainDIDHash];
        require(listing.active, "DualDID: listing not active");
        require(listing.seller == msg.sender, "DualDID: not seller");

        listing.active = false;

        emit TransferListingCancelled(offChainDIDHash);
    }

    /**
     * @dev Purchase a listed off-chain DID
     * @param offChainDIDHash The hash of the off-chain DID to buy
     */
    function purchaseDID(bytes32 offChainDIDHash) external nonReentrant hasOnChainDID {
        TransferListing storage listing = transferListings[offChainDIDHash];
        require(listing.active, "DualDID: listing not active");

        bytes32 buyerOnChainDIDHash = walletToOnChainDID[msg.sender];
        OnChainDID storage buyerOnChainDID = onChainDIDs[buyerOnChainDIDHash];
        
        // Buyer must not already have an off-chain DID (or must release it first)
        require(buyerOnChainDID.linkedOffChainDID == bytes32(0), "DualDID: buyer has off-chain DID");

        OffChainDID storage offChainDID = offChainDIDs[offChainDIDHash];
        bytes32 sellerOnChainDIDHash = offChainDID.currentOwnerOnChainDID;

        // Calculate fees
        uint256 fee = (listing.price * TRANSFER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerAmount = listing.price - fee;

        // Transfer payment
        IERC20 paymentToken = IERC20(listing.paymentToken);
        paymentToken.safeTransferFrom(msg.sender, listing.seller, sellerAmount);
        paymentToken.safeTransferFrom(msg.sender, treasury, fee);

        // Update seller's on-chain DID (remove link)
        OnChainDID storage sellerOnChainDID = onChainDIDs[sellerOnChainDIDHash];
        sellerOnChainDID.linkedOffChainDID = bytes32(0);

        // Update off-chain DID ownership
        offChainDID.currentOwnerOnChainDID = buyerOnChainDIDHash;
        offChainDID.lastTransferredAt = block.timestamp;

        // Link to buyer's on-chain DID
        buyerOnChainDID.linkedOffChainDID = offChainDIDHash;

        // Deactivate listing
        listing.active = false;

        emit DIDTransferred(offChainDIDHash, sellerOnChainDIDHash, buyerOnChainDIDHash, listing.price);
        emit DIDsLinked(buyerOnChainDIDHash, offChainDIDHash);
    }

    /**
     * @dev Assign premium DID ownership (called by auction contract)
     * @param offChainDIDHash The premium DID hash
     * @param buyerOnChainDIDHash The buyer's on-chain DID hash
     */
    function assignPremiumDIDOwnership(
        bytes32 offChainDIDHash,
        bytes32 buyerOnChainDIDHash
    ) external {
        require(authorizedContracts[msg.sender], "DualDID: not authorized");
        
        OffChainDID storage offChainDID = offChainDIDs[offChainDIDHash];
        require(offChainDID.active, "DualDID: DID not active");
        require(offChainDID.isSystemGenerated, "DualDID: not premium DID");
        require(offChainDID.currentOwnerOnChainDID == bytes32(0), "DualDID: already owned");

        OnChainDID storage buyerOnChainDID = onChainDIDs[buyerOnChainDIDHash];
        require(buyerOnChainDID.active, "DualDID: buyer DID not active");
        require(buyerOnChainDID.linkedOffChainDID == bytes32(0), "DualDID: buyer has off-chain DID");

        // Link DIDs
        offChainDID.currentOwnerOnChainDID = buyerOnChainDIDHash;
        offChainDID.lastTransferredAt = block.timestamp;
        buyerOnChainDID.linkedOffChainDID = offChainDIDHash;

        emit DIDsLinked(buyerOnChainDIDHash, offChainDIDHash);
    }

    /**
     * @dev Assign short Display ID to auction winner
     * Called by PremiumDIDAuction after auction ends
     * Creates a new off-chain DID and links it to the winner's on-chain DID
     * @param displayId The short Display ID (1-4 chars)
     * @param winnerAddress The wallet address of the auction winner
     */
    function assignShortDisplayId(
        string calldata displayId,
        address winnerAddress
    ) external returns (bytes32 offChainDIDHash) {
        require(authorizedContracts[msg.sender], "DualDID: not authorized");
        
        // Validate format
        require(_validateNormalDisplayId(displayId), "DualDID: invalid format");
        require(bytes(displayId).length < 5, "DualDID: not a short ID");
        require(!blockedDisplayIds[displayId], "DualDID: display ID blocked");
        require(displayIdToHash[displayId] == bytes32(0), "DualDID: display ID exists");

        // Winner must have on-chain DID
        bytes32 winnerOnChainDIDHash = walletToOnChainDID[winnerAddress];
        require(winnerOnChainDIDHash != bytes32(0), "DualDID: winner has no on-chain DID");
        
        OnChainDID storage winnerOnChainDID = onChainDIDs[winnerOnChainDIDHash];
        require(winnerOnChainDID.active, "DualDID: winner DID not active");
        require(winnerOnChainDID.linkedOffChainDID == bytes32(0), "DualDID: winner already has off-chain DID");

        // Create off-chain DID
        offChainDIDHash = keccak256(abi.encodePacked(displayId));

        offChainDIDs[offChainDIDHash] = OffChainDID({
            displayId: displayId,
            tier: DIDTier.TierS,
            isSystemGenerated: false,
            currentOwnerOnChainDID: winnerOnChainDIDHash,
            createdAt: block.timestamp,
            lastTransferredAt: 0,
            active: true
        });

        displayIdToHash[displayId] = offChainDIDHash;
        winnerOnChainDID.linkedOffChainDID = offChainDIDHash;
        totalOffChainDIDs++;

        emit OffChainDIDRegistered(offChainDIDHash, displayId, DIDTier.TierS, false);
        emit DIDsLinked(winnerOnChainDIDHash, offChainDIDHash);

        return offChainDIDHash;
    }

    /**
     * @dev Release off-chain DID (unlink from on-chain DID)
     * Used before purchasing a new off-chain DID
     */
    function releaseOffChainDID() external hasOnChainDID {
        bytes32 onChainDIDHash = walletToOnChainDID[msg.sender];
        OnChainDID storage onChainDID = onChainDIDs[onChainDIDHash];
        
        require(onChainDID.linkedOffChainDID != bytes32(0), "DualDID: no linked off-chain DID");
        
        bytes32 offChainDIDHash = onChainDID.linkedOffChainDID;
        OffChainDID storage offChainDID = offChainDIDs[offChainDIDHash];
        
        // Check if there's an active listing
        require(!transferListings[offChainDIDHash].active, "DualDID: DID is listed for transfer");

        // Unlink
        offChainDID.currentOwnerOnChainDID = bytes32(0);
        offChainDID.active = false; // Normal DIDs become inactive when released
        onChainDID.linkedOffChainDID = bytes32(0);
    }

    // ============ Validation Functions ============

    /**
     * @dev Validate display ID format
     * Rules:
     * - Only uppercase letters (A-Z) and digits (0-9) allowed
     * - Length: 1-32 characters
     * - Can be pure letters, pure digits, or mixed
     */
    function _validateNormalDisplayId(string calldata displayId) internal pure returns (bool) {
        bytes memory id = bytes(displayId);
        
        // Length must be 1-32 characters
        if (id.length == 0 || id.length > 32) return false;
        
        // Each character must be uppercase letter or digit
        for (uint256 i = 0; i < id.length; i++) {
            bytes1 c = id[i];
            bool isDigit = (c >= '0' && c <= '9');
            bool isLetter = (c >= 'A' && c <= 'Z');
            if (!isDigit && !isLetter) return false;
        }
        
        return true;
    }

    /**
     * @dev Check if display ID requires auction (length < 5)
     * Short IDs (1-4 chars) are premium and require auction
     */
    function isPremiumLength(string calldata displayId) public pure returns (bool) {
        return bytes(displayId).length < 5;
    }

    /**
     * @dev Get auction starting price based on display ID length
     * @return Starting price in USD1 (6 decimals)
     */
    function getAuctionStartPrice(string calldata displayId) public pure returns (uint256) {
        uint256 length = bytes(displayId).length;
        if (length >= 5) return 0; // Free registration
        if (length == 4) return 10 * 1e6;     // 10 USD1
        if (length == 3) return 100 * 1e6;    // 100 USD1
        if (length == 2) return 1000 * 1e6;   // 1000 USD1
        return 10000 * 1e6;                    // 1 char: 10000 USD1
    }

    /**
     * @dev Check if a display ID is available
     */
    function isDisplayIdAvailable(string calldata displayId) external view returns (bool) {
        if (blockedDisplayIds[displayId]) return false;
        return displayIdToHash[displayId] == bytes32(0);
    }

    /**
     * @dev Validate display ID format (external callable)
     */
    function validateDisplayIdFormat(string calldata displayId) external pure returns (bool) {
        return _validateNormalDisplayId(displayId);
    }

    // ============ View Functions ============

    function getOffChainDID(bytes32 hash) external view returns (OffChainDID memory) {
        return offChainDIDs[hash];
    }

    function getOffChainDIDByDisplayId(string calldata displayId) external view returns (OffChainDID memory) {
        bytes32 hash = displayIdToHash[displayId];
        return offChainDIDs[hash];
    }

    function getOnChainDID(bytes32 hash) external view returns (OnChainDID memory) {
        return onChainDIDs[hash];
    }

    function getOnChainDIDByWallet(address wallet) external view returns (OnChainDID memory) {
        bytes32 hash = walletToOnChainDID[wallet];
        return onChainDIDs[hash];
    }

    function getMyDIDs() external view returns (
        bytes32 onChainDIDHash,
        OnChainDID memory onChainDID,
        bytes32 offChainDIDHash,
        OffChainDID memory offChainDID
    ) {
        onChainDIDHash = walletToOnChainDID[msg.sender];
        if (onChainDIDHash != bytes32(0)) {
            onChainDID = onChainDIDs[onChainDIDHash];
            offChainDIDHash = onChainDID.linkedOffChainDID;
            if (offChainDIDHash != bytes32(0)) {
                offChainDID = offChainDIDs[offChainDIDHash];
            }
        }
    }

    function getTransferListing(bytes32 offChainDIDHash) external view returns (TransferListing memory) {
        return transferListings[offChainDIDHash];
    }

    function getDisplayIdHash(string calldata displayId) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(displayId));
    }
}
