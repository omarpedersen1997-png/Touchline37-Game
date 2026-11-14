-- Personal recovery codes are retired. Preserve accounts and sessions.
UPDATE accounts SET recovery_hash = '';
