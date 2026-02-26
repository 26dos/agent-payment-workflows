-- Migration: 005_dual_did_system.sql
-- Description: Create tables for the dual DID system and premium DID auctions

-- ============ Off-Chain DID Table ============
CREATE TABLE IF NOT EXISTS off_chain_dids (
    id BIGSERIAL PRIMARY KEY,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    did_hash VARCHAR(66) NOT NULL UNIQUE,
    tier INTEGER NOT NULL DEFAULT 0,
    is_system_generated BOOLEAN NOT NULL DEFAULT FALSE,
    current_owner_on_chain_id VARCHAR(66),
    last_transferred_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_off_chain_dids_display_id ON off_chain_dids(display_id);
CREATE INDEX idx_off_chain_dids_did_hash ON off_chain_dids(did_hash);
CREATE INDEX idx_off_chain_dids_tier ON off_chain_dids(tier);
CREATE INDEX idx_off_chain_dids_owner ON off_chain_dids(current_owner_on_chain_id);
CREATE INDEX idx_off_chain_dids_system_generated ON off_chain_dids(is_system_generated);

-- ============ On-Chain DID Table ============
CREATE TABLE IF NOT EXISTS on_chain_dids (
    id BIGSERIAL PRIMARY KEY,
    did_hash VARCHAR(66) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    linked_off_chain_id VARCHAR(66),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_on_chain_dids_wallet ON on_chain_dids(wallet_address);
CREATE INDEX idx_on_chain_dids_hash ON on_chain_dids(did_hash);
CREATE INDEX idx_on_chain_dids_linked ON on_chain_dids(linked_off_chain_id);

-- ============ DID Transfer Listings Table ============
CREATE TABLE IF NOT EXISTS did_transfer_listings (
    id BIGSERIAL PRIMARY KEY,
    off_chain_did_hash VARCHAR(66) NOT NULL,
    seller_wallet VARCHAR(42) NOT NULL,
    price DECIMAL(20, 6) NOT NULL,
    payment_token VARCHAR(42) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    listed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (off_chain_did_hash) REFERENCES off_chain_dids(did_hash)
);

CREATE INDEX idx_did_listings_hash ON did_transfer_listings(off_chain_did_hash);
CREATE INDEX idx_did_listings_active ON did_transfer_listings(active);
CREATE INDEX idx_did_listings_seller ON did_transfer_listings(seller_wallet);

-- ============ DID Transfer History Table ============
CREATE TABLE IF NOT EXISTS did_transfer_history (
    id BIGSERIAL PRIMARY KEY,
    off_chain_did_hash VARCHAR(66) NOT NULL,
    from_on_chain_did VARCHAR(66) NOT NULL,
    to_on_chain_did VARCHAR(66) NOT NULL,
    price DECIMAL(20, 6) NOT NULL,
    payment_token VARCHAR(42) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    transferred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_did_history_hash ON did_transfer_history(off_chain_did_hash);
CREATE INDEX idx_did_history_from ON did_transfer_history(from_on_chain_did);
CREATE INDEX idx_did_history_to ON did_transfer_history(to_on_chain_did);

-- ============ Premium DID Auctions Table ============
CREATE TABLE IF NOT EXISTS premium_did_auctions (
    id BIGSERIAL PRIMARY KEY,
    chain_auction_id BIGINT,
    off_chain_did_hash VARCHAR(66) NOT NULL,
    display_id VARCHAR(20) NOT NULL,
    tier INTEGER NOT NULL,
    auction_type INTEGER NOT NULL DEFAULT 0,
    start_price DECIMAL(20, 6) NOT NULL,
    current_price DECIMAL(20, 6) NOT NULL DEFAULT 0,
    min_increment DECIMAL(20, 6) NOT NULL DEFAULT 0,
    reserve_price DECIMAL(20, 6) NOT NULL DEFAULT 0,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    highest_bidder VARCHAR(42),
    payment_token VARCHAR(42) NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    bid_count INTEGER NOT NULL DEFAULT 0,
    winner_wallet VARCHAR(42),
    final_price DECIMAL(20, 6),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (off_chain_did_hash) REFERENCES off_chain_dids(did_hash)
);

CREATE INDEX idx_auctions_did_hash ON premium_did_auctions(off_chain_did_hash);
CREATE INDEX idx_auctions_status ON premium_did_auctions(status);
CREATE INDEX idx_auctions_tier ON premium_did_auctions(tier);
CREATE INDEX idx_auctions_type ON premium_did_auctions(auction_type);
CREATE INDEX idx_auctions_end_time ON premium_did_auctions(end_time);

-- ============ Auction Bids Table ============
CREATE TABLE IF NOT EXISTS auction_bids (
    id BIGSERIAL PRIMARY KEY,
    auction_id BIGINT NOT NULL,
    bidder_wallet VARCHAR(42) NOT NULL,
    amount DECIMAL(20, 6) NOT NULL,
    deposit_amount DECIMAL(20, 6) NOT NULL DEFAULT 0,
    tx_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (auction_id) REFERENCES premium_did_auctions(id)
);

CREATE INDEX idx_bids_auction ON auction_bids(auction_id);
CREATE INDEX idx_bids_bidder ON auction_bids(bidder_wallet);
CREATE INDEX idx_bids_amount ON auction_bids(amount DESC);

-- ============ Blocked Display IDs Table ============
CREATE TABLE IF NOT EXISTS blocked_display_ids (
    id BIGSERIAL PRIMARY KEY,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    reason VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blocked_display_id ON blocked_display_ids(display_id);

-- ============ Premium DID Generation Log Table ============
CREATE TABLE IF NOT EXISTS premium_did_generation_log (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(66) NOT NULL,
    tier INTEGER NOT NULL,
    count INTEGER NOT NULL,
    generated_by VARCHAR(42),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gen_log_batch ON premium_did_generation_log(batch_id);
CREATE INDEX idx_gen_log_tier ON premium_did_generation_log(tier);
