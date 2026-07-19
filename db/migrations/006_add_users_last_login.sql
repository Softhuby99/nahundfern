-- Track when/where each user last logged in (Studio "Anmeldungen" view + audit).
-- last_login_ip is best-effort from X-Forwarded-For; nullable when unknown.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_ip text;
