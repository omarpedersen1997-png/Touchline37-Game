CREATE TABLE IF NOT EXISTS support_messages (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 topic TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS support_created ON support_messages(created_at);
