// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DualDIDRegistry.sol";

/**
 * @title PremiumDIDAuction
 * @dev Manages auctions for premium (system-generated) DIDs
 * 
 * Auction Types:
 * - English Auction: For SSS/SS tier DIDs, price increases with bids
 * - Dutch Auction: For S/A tier DIDs, price decreases over time
 * - Fixed Price: For B tier DIDs, first come first served
 * 
 * Supported Payment Tokens: USD1, USDT, USDC
 * 
 * Fee Distribution:
 * - 85% Treasury
 * - 10% Ecosystem Incentive Pool
 * - 5% Operations
 */
contract PremiumDIDAuction is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum AuctionType {
        English,        // Ascending price, highest bidder wins
        Dutch,          // Descending price, first buyer wins
        FixedPrice      // Fixed price, first come first served
    }

    enum AuctionStatus {
        NotStarted,
        Active,
        Ended,
        Cancelled,
        Sold
    }

    // ============ Structs ============

    struct Auction {
        bytes32 offChainDIDHash;    // The premium DID being auctioned
        string displayId;           // Display ID string for reference
        DualDIDRegistry.DIDTier tier;  // Rarity tier
        AuctionType auctionType;
        uint256 startPrice;         // Starting price (6 decimals)
        uint256 currentPrice;       // Current price (Dutch) or highest bid (English)
        uint256 minIncrement;       // Minimum bid increment (English only)
        uint256 reservePrice;       // Minimum acceptable price (Dutch floor)
        uint256 startTime;
        uint256 endTime;
        uint256 extensionTime;      // Auto-extend duration (English only)
        address highestBidder;      // Current highest bidder (English only)
        address paymentToken;       // Payment token address
        AuctionStatus status;
        uint256 bidCount;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    // ============ Constants ============

    // Fee distribution (basis points)
    uint256 public constant TREASURY_FEE_BPS = 8500;      // 85%
    uint256 public constant INCENTIVE_FEE_BPS = 1000;     // 10%
    uint256 public constant OPERATIONS_FEE_BPS = 500;     // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Dutch auction parameters
    uint256 public constant DUTCH_PRICE_DROP_INTERVAL = 24 hours;
    uint256 public constant DUTCH_PRICE_DROP_BPS = 1000;  // 10% per interval
    uint256 public constant DUTCH_FLOOR_BPS = 2000;       // 20% minimum

    // English auction parameters
    uint256 public constant ENGLISH_EXTENSION_TRIGGER = 10 minutes;
    uint256 public constant ENGLISH_EXTENSION_DURATION = 10 minutes;

    // ============ State Variables ============

    DualDIDRegistry public dualDIDRegistry;

    // Auction ID => Auction
    mapping(uint256 => Auction) public auctions;
    
    // Auction ID => Bids array
    mapping(uint256 => Bid[]) public auctionBids;

    // Off-chain DID hash => Auction ID (for checking if DID is in auction)
    mapping(bytes32 => uint256) public didToAuctionId;

    // Bidder => Auction ID => Full bid amount (refundable if outbid)
    mapping(address => mapping(uint256 => uint256)) public bidAmounts;

    // Fee recipients
    address public treasury;
    address public incentivePool;
    address public operations;

    // Supported payment tokens
    mapping(address => bool) public supportedPaymentTokens;

    // Auction counter
    uint256 public nextAuctionId;

    // ============ Events ============

    event AuctionCreated(
        uint256 indexed auctionId,
        bytes32 indexed offChainDIDHash,
        string displayId,
        AuctionType auctionType,
        uint256 startPrice,
        uint256 startTime,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 newEndTime
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice
    );

    event AuctionCancelled(uint256 indexed auctionId);

    event BidRefunded(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event FixedPricePurchase(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 price
    );

    event DutchAuctionPurchase(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 price
    );

    event FeeRecipientsUpdated(
        address treasury,
        address incentivePool,
        address operations
    );

    // ============ Modifiers ============

    modifier validPaymentToken(address token) {
        require(supportedPaymentTokens[token], "Auction: unsupported token");
        _;
    }

    modifier auctionExists(uint256 auctionId) {
        require(auctions[auctionId].offChainDIDHash != bytes32(0), "Auction: not found");
        _;
    }

    modifier auctionActive(uint256 auctionId) {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.Active, "Auction: not active");
        require(block.timestamp >= auction.startTime, "Auction: not started");
        require(block.timestamp <= auction.endTime, "Auction: ended");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _dualDIDRegistry,
        address _treasury,
        address _incentivePool,
        address _operations
    ) Ownable(msg.sender) {
        require(_dualDIDRegistry != address(0), "Auction: invalid registry");
        require(_treasury != address(0), "Auction: invalid treasury");
        require(_incentivePool != address(0), "Auction: invalid incentive pool");
        require(_operations != address(0), "Auction: invalid operations");

        dualDIDRegistry = DualDIDRegistry(_dualDIDRegistry);
        treasury = _treasury;
        incentivePool = _incentivePool;
        operations = _operations;
        
        nextAuctionId = 1;
    }

    // ============ Admin Functions ============

    function setDualDIDRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "Auction: invalid registry");
        dualDIDRegistry = DualDIDRegistry(_registry);
    }

    function setFeeRecipients(
        address _treasury,
        address _incentivePool,
        address _operations
    ) external onlyOwner {
        require(_treasury != address(0), "Auction: invalid treasury");
        require(_incentivePool != address(0), "Auction: invalid incentive pool");
        require(_operations != address(0), "Auction: invalid operations");

        treasury = _treasury;
        incentivePool = _incentivePool;
        operations = _operations;

        emit FeeRecipientsUpdated(_treasury, _incentivePool, _operations);
    }

    function setPaymentToken(address token, bool supported) external onlyOwner {
        supportedPaymentTokens[token] = supported;
    }

    // ============ Auction Creation Functions ============

    /**
     * @dev Create an English auction (for SSS/SS tier)
     */
    function createEnglishAuction(
        bytes32 offChainDIDHash,
        uint256 startPrice,
        uint256 minIncrement,
        uint256 duration,
        address paymentToken
    ) external onlyOwner validPaymentToken(paymentToken) returns (uint256) {
        DualDIDRegistry.OffChainDID memory did = dualDIDRegistry.getOffChainDID(offChainDIDHash);
        require(did.active, "Auction: DID not active");
        require(did.isSystemGenerated, "Auction: not premium DID");
        require(did.currentOwnerOnChainDID == bytes32(0), "Auction: already owned");
        require(didToAuctionId[offChainDIDHash] == 0, "Auction: already in auction");

        uint256 auctionId = nextAuctionId++;

        auctions[auctionId] = Auction({
            offChainDIDHash: offChainDIDHash,
            displayId: did.displayId,
            tier: did.tier,
            auctionType: AuctionType.English,
            startPrice: startPrice,
            currentPrice: 0,
            minIncrement: minIncrement,
            reservePrice: startPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            extensionTime: ENGLISH_EXTENSION_DURATION,
            highestBidder: address(0),
            paymentToken: paymentToken,
            status: AuctionStatus.Active,
            bidCount: 0
        });

        didToAuctionId[offChainDIDHash] = auctionId;

        emit AuctionCreated(
            auctionId,
            offChainDIDHash,
            did.displayId,
            AuctionType.English,
            startPrice,
            block.timestamp,
            block.timestamp + duration
        );

        return auctionId;
    }

    /**
     * @dev Create a Dutch auction (for S/A tier)
     */
    function createDutchAuction(
        bytes32 offChainDIDHash,
        uint256 startPrice,
        uint256 duration,
        address paymentToken
    ) external onlyOwner validPaymentToken(paymentToken) returns (uint256) {
        DualDIDRegistry.OffChainDID memory did = dualDIDRegistry.getOffChainDID(offChainDIDHash);
        require(did.active, "Auction: DID not active");
        require(did.isSystemGenerated, "Auction: not premium DID");
        require(did.currentOwnerOnChainDID == bytes32(0), "Auction: already owned");
        require(didToAuctionId[offChainDIDHash] == 0, "Auction: already in auction");

        uint256 auctionId = nextAuctionId++;
        uint256 reservePrice = (startPrice * DUTCH_FLOOR_BPS) / BPS_DENOMINATOR;

        auctions[auctionId] = Auction({
            offChainDIDHash: offChainDIDHash,
            displayId: did.displayId,
            tier: did.tier,
            auctionType: AuctionType.Dutch,
            startPrice: startPrice,
            currentPrice: startPrice,
            minIncrement: 0,
            reservePrice: reservePrice,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            extensionTime: 0,
            highestBidder: address(0),
            paymentToken: paymentToken,
            status: AuctionStatus.Active,
            bidCount: 0
        });

        didToAuctionId[offChainDIDHash] = auctionId;

        emit AuctionCreated(
            auctionId,
            offChainDIDHash,
            did.displayId,
            AuctionType.Dutch,
            startPrice,
            block.timestamp,
            block.timestamp + duration
        );

        return auctionId;
    }

    /**
     * @dev Create a fixed price listing (for B tier)
     */
    function createFixedPriceListing(
        bytes32 offChainDIDHash,
        uint256 price,
        address paymentToken
    ) external onlyOwner validPaymentToken(paymentToken) returns (uint256) {
        DualDIDRegistry.OffChainDID memory did = dualDIDRegistry.getOffChainDID(offChainDIDHash);
        require(did.active, "Auction: DID not active");
        require(did.isSystemGenerated, "Auction: not premium DID");
        require(did.currentOwnerOnChainDID == bytes32(0), "Auction: already owned");
        require(didToAuctionId[offChainDIDHash] == 0, "Auction: already in auction");

        uint256 auctionId = nextAuctionId++;

        auctions[auctionId] = Auction({
            offChainDIDHash: offChainDIDHash,
            displayId: did.displayId,
            tier: did.tier,
            auctionType: AuctionType.FixedPrice,
            startPrice: price,
            currentPrice: price,
            minIncrement: 0,
            reservePrice: price,
            startTime: block.timestamp,
            endTime: type(uint256).max, // No end time
            extensionTime: 0,
            highestBidder: address(0),
            paymentToken: paymentToken,
            status: AuctionStatus.Active,
            bidCount: 0
        });

        didToAuctionId[offChainDIDHash] = auctionId;

        emit AuctionCreated(
            auctionId,
            offChainDIDHash,
            did.displayId,
            AuctionType.FixedPrice,
            price,
            block.timestamp,
            type(uint256).max
        );

        return auctionId;
    }

    // ============ User Short Display ID Auction ============

    /**
     * @dev Create an English auction for short Display ID (1-4 characters)
     * Anyone can create this auction - no admin required
     * Starting price is determined by ID length:
     * - 4 chars: 10 USD1
     * - 3 chars: 100 USD1
     * - 2 chars: 1000 USD1
     * - 1 char: 10000 USD1
     * Duration: 30 minutes
     * @param displayId The short Display ID to auction (1-4 alphanumeric chars)
     * @param paymentToken Payment token address (USD1, USDT, USDC)
     */
    function createShortDisplayIdAuction(
        string calldata displayId,
        address paymentToken
    ) external validPaymentToken(paymentToken) returns (uint256) {
        // Validate display ID format
        require(dualDIDRegistry.validateDisplayIdFormat(displayId), "Auction: invalid format");
        
        // Must be a short ID (1-4 chars)
        uint256 length = bytes(displayId).length;
        require(length > 0 && length < 5, "Auction: use free registration for 5+ chars");
        
        // Check availability
        require(dualDIDRegistry.isDisplayIdAvailable(displayId), "Auction: display ID not available");
        
        // Check creator has on-chain DID
        bytes32 creatorOnChainDID = dualDIDRegistry.walletToOnChainDID(msg.sender);
        require(creatorOnChainDID != bytes32(0), "Auction: no on-chain DID");
        
        // Calculate starting price based on length
        uint256 startPrice = dualDIDRegistry.getAuctionStartPrice(displayId);
        require(startPrice > 0, "Auction: invalid start price");
        
        // Minimum bid increment: 10% of start price
        uint256 minIncrement = startPrice / 10;
        if (minIncrement == 0) minIncrement = 1e6; // Minimum 1 USD1
        
        uint256 auctionId = nextAuctionId++;
        
        // Generate a placeholder hash for the display ID (not yet in DualDIDRegistry)
        bytes32 displayIdHash = keccak256(abi.encodePacked("SHORT_AUCTION:", displayId));
        
        auctions[auctionId] = Auction({
            offChainDIDHash: displayIdHash,
            displayId: displayId,
            tier: DualDIDRegistry.DIDTier.TierS, // Short IDs are premium tier
            auctionType: AuctionType.English,
            startPrice: startPrice,
            currentPrice: 0,
            minIncrement: minIncrement,
            reservePrice: startPrice,
            startTime: block.timestamp,
            endTime: block.timestamp + 30 minutes, // Fixed 30 minute duration
            extensionTime: ENGLISH_EXTENSION_DURATION,
            highestBidder: address(0),
            paymentToken: paymentToken,
            status: AuctionStatus.Active,
            bidCount: 0
        });
        
        didToAuctionId[displayIdHash] = auctionId;
        
        emit AuctionCreated(
            auctionId,
            displayIdHash,
            displayId,
            AuctionType.English,
            startPrice,
            block.timestamp,
            block.timestamp + 30 minutes
        );
        
        return auctionId;
    }

    /**
     * @dev Finalize a short Display ID auction
     * Creates the off-chain DID in DualDIDRegistry and assigns to winner
     */
    function finalizeShortDisplayIdAuction(uint256 auctionId)
        external
        nonReentrant
        auctionExists(auctionId)
    {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.English, "Auction: not English type");
        require(auction.status == AuctionStatus.Active, "Auction: not active");
        require(block.timestamp > auction.endTime, "Auction: not ended");
        
        // Check if this is a short Display ID auction (hash starts with "SHORT_AUCTION:")
        bytes32 expectedHash = keccak256(abi.encodePacked("SHORT_AUCTION:", auction.displayId));
        require(auction.offChainDIDHash == expectedHash, "Auction: use finalizeEnglishAuction");

        if (auction.highestBidder == address(0)) {
            // No bids, cancel auction
            auction.status = AuctionStatus.Cancelled;
            delete didToAuctionId[auction.offChainDIDHash];
            emit AuctionCancelled(auctionId);
            return;
        }

        address winner = auction.highestBidder;
        uint256 finalPrice = auction.currentPrice;

        // Verify winner still eligible
        bytes32 winnerOnChainDID = dualDIDRegistry.walletToOnChainDID(winner);
        require(winnerOnChainDID != bytes32(0), "Auction: winner has no DID");

        DualDIDRegistry.OnChainDID memory winnerDID = dualDIDRegistry.getOnChainDID(winnerOnChainDID);
        require(winnerDID.linkedOffChainDID == bytes32(0), "Auction: winner already has off-chain DID");

        // Full payment already received during bidding, clear bid record
        bidAmounts[winner][auctionId] = 0;

        // Distribute fees (full amount already in contract)
        _distributeFees(auction.paymentToken, finalPrice);

        // Update auction status
        auction.status = AuctionStatus.Sold;
        delete didToAuctionId[auction.offChainDIDHash];

        // Create and assign the short Display ID to winner via DualDIDRegistry
        dualDIDRegistry.assignShortDisplayId(auction.displayId, winner);

        emit AuctionEnded(auctionId, winner, finalPrice);
    }

    /**
     * @dev Get auction details by display ID string (for short ID auctions)
     */
    function getAuctionByDisplayId(string calldata displayId) external view returns (uint256 auctionId, Auction memory auction) {
        bytes32 displayIdHash = keccak256(abi.encodePacked("SHORT_AUCTION:", displayId));
        auctionId = didToAuctionId[displayIdHash];
        if (auctionId != 0) {
            auction = auctions[auctionId];
        }
    }

    /**
     * @dev Cancel an auction (admin only)
     */
    function cancelAuction(uint256 auctionId) external onlyOwner auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];
        require(
            auction.status == AuctionStatus.Active || auction.status == AuctionStatus.NotStarted,
            "Auction: cannot cancel"
        );

        auction.status = AuctionStatus.Cancelled;
        delete didToAuctionId[auction.offChainDIDHash];

        emit AuctionCancelled(auctionId);
    }

    // ============ Bidding Functions ============

    /**
     * @dev Place a bid on an English auction
     * Bidder pays FULL bid amount upfront. Previous highest bidder gets full refund immediately.
     */
    function placeBid(uint256 auctionId, uint256 amount) 
        external 
        nonReentrant 
        auctionExists(auctionId) 
        auctionActive(auctionId) 
    {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.English, "Auction: not English type");

        // Check minimum bid
        uint256 minBid = auction.currentPrice == 0 
            ? auction.startPrice 
            : auction.currentPrice + auction.minIncrement;
        require(amount >= minBid, "Auction: bid too low");

        // Check buyer has on-chain DID
        bytes32 buyerOnChainDID = dualDIDRegistry.walletToOnChainDID(msg.sender);
        require(buyerOnChainDID != bytes32(0), "Auction: no on-chain DID");

        // Check buyer doesn't already have off-chain DID
        DualDIDRegistry.OnChainDID memory buyerDID = dualDIDRegistry.getOnChainDID(buyerOnChainDID);
        require(buyerDID.linkedOffChainDID == bytes32(0), "Auction: already has off-chain DID");

        IERC20 paymentToken = IERC20(auction.paymentToken);

        // Get existing bid amount for this bidder (if rebidding)
        uint256 existingBid = bidAmounts[msg.sender][auctionId];

        // Transfer full bid amount (minus any existing bid)
        if (amount > existingBid) {
            uint256 additionalPayment = amount - existingBid;
            paymentToken.safeTransferFrom(msg.sender, address(this), additionalPayment);
        }
        bidAmounts[msg.sender][auctionId] = amount;

        // Refund previous highest bidder's FULL bid amount immediately
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            uint256 refundAmount = bidAmounts[auction.highestBidder][auctionId];
            if (refundAmount > 0) {
                bidAmounts[auction.highestBidder][auctionId] = 0;
                paymentToken.safeTransfer(auction.highestBidder, refundAmount);
                emit BidRefunded(auctionId, auction.highestBidder, refundAmount);
            }
        }

        // Update auction state
        auction.currentPrice = amount;
        auction.highestBidder = msg.sender;
        auction.bidCount++;

        // Record bid
        auctionBids[auctionId].push(Bid({
            bidder: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        }));

        // Extend auction if within extension trigger
        uint256 timeLeft = auction.endTime - block.timestamp;
        if (timeLeft < ENGLISH_EXTENSION_TRIGGER) {
            auction.endTime = block.timestamp + ENGLISH_EXTENSION_DURATION;
        }

        emit BidPlaced(auctionId, msg.sender, amount, auction.endTime);
    }

    /**
     * @dev Purchase in a Dutch auction at current price
     */
    function purchaseDutch(uint256 auctionId) 
        external 
        nonReentrant 
        auctionExists(auctionId) 
        auctionActive(auctionId) 
    {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.Dutch, "Auction: not Dutch type");

        // Check buyer has on-chain DID
        bytes32 buyerOnChainDID = dualDIDRegistry.walletToOnChainDID(msg.sender);
        require(buyerOnChainDID != bytes32(0), "Auction: no on-chain DID");

        // Check buyer doesn't already have off-chain DID
        DualDIDRegistry.OnChainDID memory buyerDID = dualDIDRegistry.getOnChainDID(buyerOnChainDID);
        require(buyerDID.linkedOffChainDID == bytes32(0), "Auction: already has off-chain DID");

        // Calculate current price
        uint256 currentPrice = getCurrentDutchPrice(auctionId);

        // Transfer payment
        IERC20 paymentToken = IERC20(auction.paymentToken);
        paymentToken.safeTransferFrom(msg.sender, address(this), currentPrice);

        // Distribute fees
        _distributeFees(auction.paymentToken, currentPrice);

        // Complete auction
        auction.currentPrice = currentPrice;
        auction.highestBidder = msg.sender;
        auction.status = AuctionStatus.Sold;
        delete didToAuctionId[auction.offChainDIDHash];

        // Transfer DID ownership
        _transferDIDOwnership(auction.offChainDIDHash, buyerOnChainDID);

        emit DutchAuctionPurchase(auctionId, msg.sender, currentPrice);
        emit AuctionEnded(auctionId, msg.sender, currentPrice);
    }

    /**
     * @dev Purchase at fixed price
     */
    function purchaseFixedPrice(uint256 auctionId) 
        external 
        nonReentrant 
        auctionExists(auctionId) 
        auctionActive(auctionId) 
    {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.FixedPrice, "Auction: not fixed price");

        // Check buyer has on-chain DID
        bytes32 buyerOnChainDID = dualDIDRegistry.walletToOnChainDID(msg.sender);
        require(buyerOnChainDID != bytes32(0), "Auction: no on-chain DID");

        // Check buyer doesn't already have off-chain DID
        DualDIDRegistry.OnChainDID memory buyerDID = dualDIDRegistry.getOnChainDID(buyerOnChainDID);
        require(buyerDID.linkedOffChainDID == bytes32(0), "Auction: already has off-chain DID");

        // Transfer payment
        IERC20 paymentToken = IERC20(auction.paymentToken);
        paymentToken.safeTransferFrom(msg.sender, address(this), auction.startPrice);

        // Distribute fees
        _distributeFees(auction.paymentToken, auction.startPrice);

        // Complete auction
        auction.highestBidder = msg.sender;
        auction.status = AuctionStatus.Sold;
        delete didToAuctionId[auction.offChainDIDHash];

        // Transfer DID ownership
        _transferDIDOwnership(auction.offChainDIDHash, buyerOnChainDID);

        emit FixedPricePurchase(auctionId, msg.sender, auction.startPrice);
        emit AuctionEnded(auctionId, msg.sender, auction.startPrice);
    }

    /**
     * @dev Finalize an ended English auction
     */
    function finalizeEnglishAuction(uint256 auctionId) 
        external 
        nonReentrant 
        auctionExists(auctionId) 
    {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.English, "Auction: not English type");
        require(auction.status == AuctionStatus.Active, "Auction: not active");
        require(block.timestamp > auction.endTime, "Auction: not ended");

        if (auction.highestBidder == address(0)) {
            // No bids, cancel auction
            auction.status = AuctionStatus.Cancelled;
            delete didToAuctionId[auction.offChainDIDHash];
            emit AuctionCancelled(auctionId);
            return;
        }

        // Get winner info
        address winner = auction.highestBidder;
        uint256 finalPrice = auction.currentPrice;

        // Check winner still has valid on-chain DID without off-chain DID
        bytes32 winnerOnChainDID = dualDIDRegistry.walletToOnChainDID(winner);
        require(winnerOnChainDID != bytes32(0), "Auction: winner has no DID");
        
        DualDIDRegistry.OnChainDID memory winnerDID = dualDIDRegistry.getOnChainDID(winnerOnChainDID);
        require(winnerDID.linkedOffChainDID == bytes32(0), "Auction: winner already has off-chain DID");

        // Full payment already received during bidding, clear bid record
        bidAmounts[winner][auctionId] = 0;

        // Distribute fees (full amount already in contract)
        _distributeFees(auction.paymentToken, finalPrice);

        // Update auction status
        auction.status = AuctionStatus.Sold;
        delete didToAuctionId[auction.offChainDIDHash];

        // Transfer DID ownership
        _transferDIDOwnership(auction.offChainDIDHash, winnerOnChainDID);

        emit AuctionEnded(auctionId, winner, finalPrice);
    }

    /**
     * @dev Withdraw bid from a cancelled auction or if outbid (emergency fallback)
     * Normally refunds happen automatically when outbid, but this is a backup
     */
    function withdrawBid(uint256 auctionId) external nonReentrant auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];
        
        // Can only withdraw if:
        // 1. Auction cancelled, or
        // 2. Auction ended/sold and caller is NOT the winner (fallback for missed auto-refund)
        require(
            auction.status == AuctionStatus.Cancelled ||
            ((auction.status == AuctionStatus.Sold || auction.status == AuctionStatus.Ended) && auction.highestBidder != msg.sender),
            "Auction: cannot withdraw"
        );

        uint256 bidAmount = bidAmounts[msg.sender][auctionId];
        require(bidAmount > 0, "Auction: no bid to withdraw");

        bidAmounts[msg.sender][auctionId] = 0;
        
        IERC20(auction.paymentToken).safeTransfer(msg.sender, bidAmount);
        
        emit BidRefunded(auctionId, msg.sender, bidAmount);
    }

    // ============ Internal Functions ============

    function _distributeFees(address paymentToken, uint256 amount) internal {
        IERC20 token = IERC20(paymentToken);

        uint256 treasuryAmount = (amount * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 incentiveAmount = (amount * INCENTIVE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 operationsAmount = amount - treasuryAmount - incentiveAmount;

        token.safeTransfer(treasury, treasuryAmount);
        token.safeTransfer(incentivePool, incentiveAmount);
        token.safeTransfer(operations, operationsAmount);
    }

    function _transferDIDOwnership(bytes32 offChainDIDHash, bytes32 buyerOnChainDID) internal {
        // This requires DualDIDRegistry to have a function to assign premium DID ownership
        // We'll add this function to DualDIDRegistry
        dualDIDRegistry.assignPremiumDIDOwnership(offChainDIDHash, buyerOnChainDID);
    }

    // ============ View Functions ============

    /**
     * @dev Get current price for Dutch auction
     */
    function getCurrentDutchPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionType == AuctionType.Dutch, "Auction: not Dutch type");

        if (block.timestamp < auction.startTime) {
            return auction.startPrice;
        }

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 intervals = elapsed / DUTCH_PRICE_DROP_INTERVAL;

        uint256 currentPrice = auction.startPrice;
        for (uint256 i = 0; i < intervals; i++) {
            uint256 drop = (currentPrice * DUTCH_PRICE_DROP_BPS) / BPS_DENOMINATOR;
            if (currentPrice - drop < auction.reservePrice) {
                return auction.reservePrice;
            }
            currentPrice -= drop;
        }

        return currentPrice;
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getAuctionBids(uint256 auctionId) external view returns (Bid[] memory) {
        return auctionBids[auctionId];
    }

    function getBidAmount(address bidder, uint256 auctionId) external view returns (uint256) {
        return bidAmounts[bidder][auctionId];
    }

    function getAuctionByDID(bytes32 offChainDIDHash) external view returns (uint256 auctionId, Auction memory auction) {
        auctionId = didToAuctionId[offChainDIDHash];
        if (auctionId != 0) {
            auction = auctions[auctionId];
        }
    }

    /**
     * @dev Get all active auctions (paginated)
     */
    function getActiveAuctions(uint256 offset, uint256 limit) external view returns (
        uint256[] memory auctionIds,
        Auction[] memory auctionList,
        uint256 total
    ) {
        // Count active auctions
        uint256 count = 0;
        for (uint256 i = 1; i < nextAuctionId; i++) {
            if (auctions[i].status == AuctionStatus.Active) {
                count++;
            }
        }
        total = count;

        // Apply pagination
        if (offset >= count) {
            return (new uint256[](0), new Auction[](0), total);
        }

        uint256 resultSize = count - offset;
        if (resultSize > limit) {
            resultSize = limit;
        }

        auctionIds = new uint256[](resultSize);
        auctionList = new Auction[](resultSize);

        uint256 resultIndex = 0;
        uint256 skipped = 0;

        for (uint256 i = 1; i < nextAuctionId && resultIndex < resultSize; i++) {
            if (auctions[i].status == AuctionStatus.Active) {
                if (skipped >= offset) {
                    auctionIds[resultIndex] = i;
                    auctionList[resultIndex] = auctions[i];
                    resultIndex++;
                } else {
                    skipped++;
                }
            }
        }
    }
}
