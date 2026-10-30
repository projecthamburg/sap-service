CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('quote', 'application')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  attachments TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_expiry ON submissions(expires_at);
CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
