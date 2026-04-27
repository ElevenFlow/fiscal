-- Enable Row Level Security on sessions table.
-- Sessions are per-user and accessed by the auth service which runs pre-tenant-context.
-- TODO Plan 02.1-03 Auth Hardening: restrict sessions policy to own user_id via
--   USING (user_id::text = current_setting('app.current_user_id', true))
--   WITH CHECK (user_id::text = current_setting('app.current_user_id', true))
-- For now: permissive policy (auth service uses dedicated admin connection pool in prod).

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;

-- Grant app_user CRUD on sessions (auth service reads/writes sessions before tenant context is set).
GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions" TO app_user;

-- Permissive policy — auth service runs pre-tenant; hardening deferred to Plan 02.1-03.
CREATE POLICY "sessions_permissive_dev"
  ON "sessions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING (true)
  WITH CHECK (true);
