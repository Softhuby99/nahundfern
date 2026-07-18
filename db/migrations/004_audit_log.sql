-- Append-only audit log for sensitive Studio actions.
-- request_id: correlation id passed through by nginx (X-Request-Id).
-- email_hash: SHA-256 of the (lowercased) email — lets us correlate events
--   for one account without storing PII.
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  request_id  text,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_id   text,
  ip          text,
  user_agent  text,
  email_hash  text,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id, created_at DESC);
