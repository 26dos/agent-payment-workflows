-- 007_did_invite_rewards.sql
-- Add fields for tracking successful invites and 5-digit DID claims

-- Add successful_invites counter to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS successful_invites INT DEFAULT 0;

-- Add five_digit_did_claimed flag to users table  
ALTER TABLE users ADD COLUMN IF NOT EXISTS five_digit_did_claimed BOOLEAN DEFAULT FALSE;

-- Create index for efficient lookup of users eligible for 5-digit DIDs
CREATE INDEX IF NOT EXISTS idx_users_successful_invites ON users(successful_invites) WHERE successful_invites >= 3;

-- Create a pool of available 5-digit DIDs (pre-generate some common patterns)
CREATE TABLE IF NOT EXISTS five_digit_did_pool (
    id SERIAL PRIMARY KEY,
    display_id VARCHAR(5) UNIQUE NOT NULL,
    is_assigned BOOLEAN DEFAULT FALSE,
    assigned_to_user_id INT REFERENCES users(id),
    assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate some 5-digit DIDs for the pool (alphanumeric: 0-9, A-Z)
-- This creates a sample pool, more can be added programmatically
INSERT INTO five_digit_did_pool (display_id) 
SELECT UPPER(LPAD(TO_HEX(generate_series), 5, '0'))
FROM generate_series(0, 1000)
ON CONFLICT (display_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON COLUMN users.successful_invites IS 'Number of successfully registered invitees';
COMMENT ON COLUMN users.five_digit_did_claimed IS 'Whether user has claimed their 5-digit DID reward';
