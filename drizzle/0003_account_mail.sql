ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
CREATE TABLE account_challenges (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 credential_version INTEGER NOT NULL,
 purpose TEXT NOT NULL,
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX account_challenge_expiry ON account_challenges(expires_at);
CREATE INDEX account_challenge_owner ON account_challenges(account_id,purpose);
ALTER TABLE support_messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'stored';
