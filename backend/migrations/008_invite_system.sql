-- 008_invite_system.sql
-- Add invite code and invited_by fields for the referral system

-- Add invite_code field (unique code for each user to share)
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(16) UNIQUE;

-- Add invited_by field (references the user who invited this user)
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INT REFERENCES users(id);

-- Create index for quick lookup by invite code
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;

-- Generate invite codes for existing users who don't have one
-- This will be done by the application when users request their invite code
