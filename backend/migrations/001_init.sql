-- ClawPay Database Schema
-- Run this migration to set up the database

-- Users table (Human DID holders)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    did VARCHAR(66), -- bytes32 hex string
    human_score INTEGER DEFAULT 75,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_did ON users(did);

-- Agents table (Agent Sub-DIDs)
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sub_did VARCHAR(66), -- bytes32 hex string
    agent_score INTEGER DEFAULT 75,
    daily_limit DECIMAL(20,6),
    single_limit DECIMAL(20,6),
    mandate_expiry TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_did ON agents(sub_did);
CREATE INDEX idx_agents_status ON agents(status);

-- Tasks table (Escrow tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    chain_task_id BIGINT, -- On-chain task ID
    requester_did VARCHAR(66) NOT NULL,
    provider_did VARCHAR(66) NOT NULL,
    base_amount DECIMAL(20,6) NOT NULL,
    final_amount DECIMAL(20,6) NOT NULL,
    insurance_premium DECIMAL(20,6) DEFAULT 0,
    complexity SMALLINT NOT NULL CHECK (complexity BETWEEN 1 AND 3),
    status VARCHAR(20) NOT NULL DEFAULT 'created', -- created, accepted, completed, disputed, resolved, cancelled, expired
    metadata TEXT DEFAULT '',
    tx_hash VARCHAR(66), -- Transaction hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_tasks_requester ON tasks(requester_did);
CREATE INDEX idx_tasks_provider ON tasks(provider_did);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_chain_id ON tasks(chain_task_id);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);

-- Disputes table
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    raised_by_did VARCHAR(66) NOT NULL,
    reason TEXT NOT NULL,
    requester_percent INTEGER, -- 0-100, resolution percentage to requester
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_disputes_task ON disputes(task_id);
CREATE INDEX idx_disputes_resolved ON disputes(resolved);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    agent_did VARCHAR(66) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_task ON activity_logs(task_id);
CREATE INDEX idx_activity_agent ON activity_logs(agent_did);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- Reputation History table
CREATE TABLE IF NOT EXISTS reputation_history (
    id SERIAL PRIMARY KEY,
    did VARCHAR(66) NOT NULL,
    is_human BOOLEAN NOT NULL,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    task_id INTEGER REFERENCES tasks(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reputation_did ON reputation_history(did);
CREATE INDEX idx_reputation_created ON reputation_history(created_at DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
