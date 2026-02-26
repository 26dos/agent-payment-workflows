-- Incentive System Tables
-- Human DID incentives
CREATE TABLE IF NOT EXISTS human_incentives (
    id SERIAL PRIMARY KEY,
    human_did VARCHAR(66) NOT NULL UNIQUE,
    registration_points BIGINT DEFAULT 0,
    kyc_points BIGINT DEFAULT 0,
    referral_points BIGINT DEFAULT 0,
    total_points BIGINT DEFAULT 0,
    kyc_level INTEGER DEFAULT 0,
    invited_by VARCHAR(66),
    invite_count INTEGER DEFAULT 0,
    invite_code VARCHAR(128),
    registered BOOLEAN DEFAULT FALSE,
    blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason VARCHAR(255),
    blacklisted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_incentives_did ON human_incentives(human_did);
CREATE INDEX IF NOT EXISTS idx_human_incentives_invite_code ON human_incentives(invite_code);
CREATE INDEX IF NOT EXISTS idx_human_incentives_total_points ON human_incentives(total_points DESC);

-- Agent DID incentives
CREATE TABLE IF NOT EXISTS agent_incentives (
    id SERIAL PRIMARY KEY,
    agent_did VARCHAR(66) NOT NULL UNIQUE,
    human_did VARCHAR(66) NOT NULL,
    registration_points BIGINT DEFAULT 0,
    task_points BIGINT DEFAULT 0,
    total_points BIGINT DEFAULT 0,
    daily_task_points INTEGER DEFAULT 0,
    last_task_day VARCHAR(10),
    registered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_incentives_did ON agent_incentives(agent_did);
CREATE INDEX IF NOT EXISTS idx_agent_incentives_human ON agent_incentives(human_did);
CREATE INDEX IF NOT EXISTS idx_agent_incentives_total_points ON agent_incentives(total_points DESC);

-- Referral records
CREATE TABLE IF NOT EXISTS referral_records (
    id SERIAL PRIMARY KEY,
    inviter_did VARCHAR(66) NOT NULL,
    invitee_did VARCHAR(66) NOT NULL,
    invite_code VARCHAR(128) NOT NULL,
    rewarded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_inviter ON referral_records(inviter_did);
CREATE INDEX IF NOT EXISTS idx_referral_invitee ON referral_records(invitee_did);

-- Task specifications
CREATE TABLE IF NOT EXISTS task_specifications (
    id SERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    task_type INTEGER DEFAULT 0,
    acceptance_deadline TIMESTAMP,
    completion_deadline TIMESTAMP,
    grace_period INTEGER DEFAULT 0,
    min_reputation_score INTEGER DEFAULT 0,
    min_completed_tasks INTEGER DEFAULT 0,
    requires_kyc BOOLEAN DEFAULT FALSE,
    min_kyc_level INTEGER DEFAULT 0,
    file_type VARCHAR(64),
    min_bytes BIGINT DEFAULT 0,
    max_bytes BIGINT DEFAULT 0,
    format_features TEXT,
    required_keywords TEXT,
    required_fields TEXT,
    min_result_count INTEGER DEFAULT 0,
    language_requirement VARCHAR(32),
    metadata_ipfs VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_spec_task ON task_specifications(task_id);

-- Task results
CREATE TABLE IF NOT EXISTS task_results (
    id SERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    provider_did VARCHAR(66) NOT NULL,
    result_hash VARCHAR(66),
    format_probe_hash VARCHAR(66),
    execution_proof_hash VARCHAR(66),
    result_ipfs VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    disputed BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_result_task ON task_results(task_id);
CREATE INDEX IF NOT EXISTS idx_task_result_provider ON task_results(provider_did);
