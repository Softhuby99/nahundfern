-- Protokoll der Netzwerkprüfungen (DNS + HTTP, intern vs. extern).
CREATE TABLE IF NOT EXISTS network_checks (
  id          bigserial PRIMARY KEY,
  run_id      uuid NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  hostname    text NOT NULL,
  scope       text NOT NULL CHECK (scope IN ('internal', 'external')),
  dns_server  text NOT NULL,
  dns_ips     text[] NOT NULL DEFAULT '{}',
  dns_error   text,
  dns_ms      int,
  http_target text,
  http_status int,
  http_ms     int,
  http_error  text,
  tls_ok      boolean,
  tls_error   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_network_checks_created ON network_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_checks_run ON network_checks(run_id);
