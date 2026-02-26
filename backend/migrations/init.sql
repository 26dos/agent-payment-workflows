-- ClawPay Database Initialization Script
-- This script creates all tables from scratch
-- Run: psql -d clawpay -f init.sql

-- Drop all existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS wallet_binding_requests CASCADE;
DROP TABLE IF EXISTS email_verification_codes CASCADE;
DROP TABLE IF EXISTS auction_bids CASCADE;
DROP TABLE IF EXISTS premium_did_auctions CASCADE;
DROP TABLE IF EXISTS premium_did_generation_log CASCADE;
DROP TABLE IF EXISTS did_transfer_history CASCADE;
DROP TABLE IF EXISTS did_transfer_listings CASCADE;
DROP TABLE IF EXISTS blocked_display_ids CASCADE;
DROP TABLE IF EXISTS off_chain_dids CASCADE;
DROP TABLE IF EXISTS on_chain_dids CASCADE;
DROP TABLE IF EXISTS reputation_history CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS batch_chain_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop function if exists
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Create update_updated_at function
CREATE FUNCTION update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============ Core Tables ============

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE,
    did VARCHAR(66),
    human_score INTEGER DEFAULT 75,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    auth_type VARCHAR(20) DEFAULT 'wallet' NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    display_id VARCHAR(20),
    CONSTRAINT users_auth_check CHECK (wallet_address IS NOT NULL OR email IS NOT NULL)
);

-- Agents table
CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sub_did VARCHAR(66),
    agent_score INTEGER DEFAULT 75,
    daily_limit NUMERIC(20,6),
    single_limit NUMERIC(20,6),
    mandate_expiry TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    total_earned NUMERIC(20,6) DEFAULT 0
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    chain_task_id BIGINT,
    requester_did VARCHAR(66) NOT NULL,
    provider_did VARCHAR(66),
    base_amount NUMERIC(20,6) NOT NULL,
    final_amount NUMERIC(20,6) NOT NULL,
    insurance_premium NUMERIC(20,6) DEFAULT 0,
    complexity SMALLINT NOT NULL CHECK (complexity >= 1 AND complexity <= 3),
    status VARCHAR(20) DEFAULT 'created' NOT NULL,
    metadata TEXT DEFAULT '',
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    batch_id VARCHAR(66)
);

-- Disputes table
CREATE TABLE disputes (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    raised_by_did VARCHAR(66) NOT NULL,
    reason TEXT NOT NULL,
    requester_percent INTEGER,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Activity logs table
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    agent_did VARCHAR(66) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reputation history table
CREATE TABLE reputation_history (
    id SERIAL PRIMARY KEY,
    did VARCHAR(66) NOT NULL,
    is_human BOOLEAN NOT NULL,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    task_id INTEGER REFERENCES tasks(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch chain config table
CREATE TABLE batch_chain_config (
    id SERIAL PRIMARY KEY,
    task_count INTEGER DEFAULT 10,
    interval_minutes INTEGER DEFAULT 60,
    auto_enabled BOOLEAN DEFAULT FALSE,
    last_batch_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ DID System Tables ============

-- On-chain DIDs table
CREATE TABLE on_chain_dids (
    id BIGSERIAL PRIMARY KEY,
    did_hash VARCHAR(66) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    linked_off_chain_id VARCHAR(66),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Off-chain DIDs table
CREATE TABLE off_chain_dids (
    id BIGSERIAL PRIMARY KEY,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    did_hash VARCHAR(66) NOT NULL UNIQUE,
    tier INTEGER DEFAULT 0 NOT NULL,
    is_system_generated BOOLEAN DEFAULT FALSE NOT NULL,
    current_owner_on_chain_id VARCHAR(66),
    last_transferred_at TIMESTAMP WITHOUT TIME ZONE,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Blocked display IDs table
CREATE TABLE blocked_display_ids (
    id BIGSERIAL PRIMARY KEY,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    reason VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- DID transfer listings table
CREATE TABLE did_transfer_listings (
    id BIGSERIAL PRIMARY KEY,
    off_chain_did_hash VARCHAR(66) NOT NULL REFERENCES off_chain_dids(did_hash),
    seller_wallet VARCHAR(42) NOT NULL,
    price NUMERIC(20,6) NOT NULL,
    payment_token VARCHAR(42) NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    listed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- DID transfer history table
CREATE TABLE did_transfer_history (
    id BIGSERIAL PRIMARY KEY,
    off_chain_did_hash VARCHAR(66) NOT NULL,
    from_on_chain_did VARCHAR(66) NOT NULL,
    to_on_chain_did VARCHAR(66) NOT NULL,
    price NUMERIC(20,6) NOT NULL,
    payment_token VARCHAR(42) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    transferred_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============ Auction System Tables ============

-- Premium DID auctions table
CREATE TABLE premium_did_auctions (
    id BIGSERIAL PRIMARY KEY,
    chain_auction_id BIGINT,
    off_chain_did_hash VARCHAR(66) NOT NULL,
    display_id VARCHAR(20) NOT NULL,
    tier INTEGER NOT NULL,
    auction_type INTEGER DEFAULT 0 NOT NULL,
    start_price NUMERIC(20,6) NOT NULL,
    current_price NUMERIC(20,6) DEFAULT 0 NOT NULL,
    min_increment NUMERIC(20,6) DEFAULT 0 NOT NULL,
    reserve_price NUMERIC(20,6) DEFAULT 0 NOT NULL,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    highest_bidder VARCHAR(42),
    payment_token VARCHAR(42) NOT NULL,
    status INTEGER DEFAULT 0 NOT NULL,
    bid_count INTEGER DEFAULT 0 NOT NULL,
    winner_wallet VARCHAR(42),
    final_price NUMERIC(20,6),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Auction bids table
CREATE TABLE auction_bids (
    id BIGSERIAL PRIMARY KEY,
    auction_id BIGINT NOT NULL REFERENCES premium_did_auctions(id),
    bidder_wallet VARCHAR(42) NOT NULL,
    amount NUMERIC(20,6) NOT NULL,
    deposit_amount NUMERIC(20,6) DEFAULT 0 NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Premium DID generation log table
CREATE TABLE premium_did_generation_log (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(66) NOT NULL,
    tier INTEGER NOT NULL,
    count INTEGER NOT NULL,
    generated_by VARCHAR(42),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============ Email Auth Tables ============

-- Email verification codes table
CREATE TABLE email_verification_codes (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) DEFAULT 'register' NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Wallet binding requests table
CREATE TABLE wallet_binding_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    wallet_address VARCHAR(42) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITHOUT TIME ZONE
);

-- ============ Indexes ============

-- Users indexes
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_did ON users(did);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_type ON users(auth_type);

-- Agents indexes
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_did ON agents(sub_did);
CREATE INDEX idx_agents_status ON agents(status);
CREATE UNIQUE INDEX idx_agents_name_unique ON agents(LOWER(name));

-- Tasks indexes
CREATE INDEX idx_tasks_requester ON tasks(requester_did);
CREATE INDEX idx_tasks_provider ON tasks(provider_did);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_chain_id ON tasks(chain_task_id);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX idx_tasks_batch ON tasks(batch_id);
CREATE INDEX idx_tasks_open ON tasks(status) WHERE provider_did IS NULL;

-- Activity indexes
CREATE INDEX idx_activity_task ON activity_logs(task_id);
CREATE INDEX idx_activity_agent ON activity_logs(agent_did);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- Reputation indexes
CREATE INDEX idx_reputation_did ON reputation_history(did);
CREATE INDEX idx_reputation_created ON reputation_history(created_at DESC);

-- Disputes indexes
CREATE INDEX idx_disputes_task ON disputes(task_id);
CREATE INDEX idx_disputes_resolved ON disputes(resolved);

-- On-chain DID indexes
CREATE INDEX idx_on_chain_dids_hash ON on_chain_dids(did_hash);
CREATE INDEX idx_on_chain_dids_wallet ON on_chain_dids(wallet_address);
CREATE INDEX idx_on_chain_dids_linked ON on_chain_dids(linked_off_chain_id);

-- Off-chain DID indexes
CREATE INDEX idx_off_chain_dids_display_id ON off_chain_dids(display_id);
CREATE INDEX idx_off_chain_dids_did_hash ON off_chain_dids(did_hash);
CREATE INDEX idx_off_chain_dids_owner ON off_chain_dids(current_owner_on_chain_id);
CREATE INDEX idx_off_chain_dids_tier ON off_chain_dids(tier);
CREATE INDEX idx_off_chain_dids_system_generated ON off_chain_dids(is_system_generated);

-- Blocked display ID indexes
CREATE INDEX idx_blocked_display_id ON blocked_display_ids(display_id);

-- DID transfer indexes
CREATE INDEX idx_did_listings_hash ON did_transfer_listings(off_chain_did_hash);
CREATE INDEX idx_did_listings_seller ON did_transfer_listings(seller_wallet);
CREATE INDEX idx_did_listings_active ON did_transfer_listings(active);
CREATE INDEX idx_did_history_hash ON did_transfer_history(off_chain_did_hash);
CREATE INDEX idx_did_history_from ON did_transfer_history(from_on_chain_did);
CREATE INDEX idx_did_history_to ON did_transfer_history(to_on_chain_did);

-- Auction indexes
CREATE INDEX idx_auctions_did_hash ON premium_did_auctions(off_chain_did_hash);
CREATE INDEX idx_auctions_tier ON premium_did_auctions(tier);
CREATE INDEX idx_auctions_type ON premium_did_auctions(auction_type);
CREATE INDEX idx_auctions_status ON premium_did_auctions(status);
CREATE INDEX idx_auctions_end_time ON premium_did_auctions(end_time);

-- Bids indexes
CREATE INDEX idx_bids_auction ON auction_bids(auction_id);
CREATE INDEX idx_bids_bidder ON auction_bids(bidder_wallet);
CREATE INDEX idx_bids_amount ON auction_bids(amount DESC);

-- Generation log indexes
CREATE INDEX idx_gen_log_batch ON premium_did_generation_log(batch_id);
CREATE INDEX idx_gen_log_tier ON premium_did_generation_log(tier);

-- Email verification indexes
CREATE INDEX idx_verification_codes_email ON email_verification_codes(email);
CREATE INDEX idx_verification_codes_code ON email_verification_codes(code);
CREATE INDEX idx_verification_codes_expires ON email_verification_codes(expires_at);

-- Wallet binding indexes
CREATE INDEX idx_wallet_binding_user ON wallet_binding_requests(user_id);
CREATE INDEX idx_wallet_binding_wallet ON wallet_binding_requests(wallet_address);

-- ============ Triggers ============

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ Initial Data ============

-- Insert default batch config
INSERT INTO batch_chain_config (task_count, interval_minutes, auto_enabled) 
VALUES (10, 60, false);

-- Done
SELECT 'Database initialized successfully!' as status;
