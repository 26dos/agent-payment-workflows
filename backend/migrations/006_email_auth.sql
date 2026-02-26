-- Migration: 006_email_auth.sql
-- Description: Add email authentication support

-- Alter users table to support email registration
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) NOT NULL DEFAULT 'wallet';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_id VARCHAR(20);

-- Make wallet_address nullable for email-registered users
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- Add constraint: user must have either wallet_address or email
ALTER TABLE users ADD CONSTRAINT users_auth_check 
  CHECK (wallet_address IS NOT NULL OR email IS NOT NULL);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_type ON users(auth_type);

-- Email verification codes table
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'register',
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON email_verification_codes(expires_at);

-- Wallet binding requests table (for email users binding wallet)
CREATE TABLE IF NOT EXISTS wallet_binding_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    wallet_address VARCHAR(42) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_binding_user ON wallet_binding_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_binding_wallet ON wallet_binding_requests(wallet_address);
