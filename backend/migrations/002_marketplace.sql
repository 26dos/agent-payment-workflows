-- ClawPay Marketplace Migration
-- Run this migration to add marketplace features

-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id VARCHAR(66);

-- Make provider_did optional (task is open until someone accepts it)
ALTER TABLE tasks ALTER COLUMN provider_did DROP NOT NULL;

-- Add index for batch queries
CREATE INDEX IF NOT EXISTS idx_tasks_batch ON tasks(batch_id);

-- Add index for public task listing (status = created, no provider yet)
CREATE INDEX IF NOT EXISTS idx_tasks_open ON tasks(status) WHERE provider_did IS NULL;

-- Add stats columns to agents table for quick access
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tasks_created INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_earned DECIMAL(20,6) DEFAULT 0;

-- Create batch_chain_config table for batch settings
CREATE TABLE IF NOT EXISTS batch_chain_config (
    id SERIAL PRIMARY KEY,
    task_count INTEGER DEFAULT 10,
    interval_minutes INTEGER DEFAULT 60,
    auto_enabled BOOLEAN DEFAULT false,
    last_batch_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO batch_chain_config (task_count, interval_minutes, auto_enabled)
VALUES (10, 60, false)
ON CONFLICT DO NOTHING;
