-- Nexo Fiscal — Plan 02-01 — REVOKE de write privileges em lookup tables (app_user).
--
-- DEVIATION (Rule 1 / Rule 2 — Plan 02-01):
-- A migration 20260425000300 fez `GRANT SELECT` para app_user em ncm/cest/cfop/lc116
-- assumindo que isso configurava read-only. Mas init.sql tem
-- `ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`
-- — isso concede DML completo automaticamente para tabelas criadas por app_admin.
-- Resultado: qualquer usuário autenticado podia poluir catálogos fiscais.
--
-- Esta migration corrige: REVOKE INSERT/UPDATE/DELETE explicitamente, mantendo
-- apenas SELECT em ncm/cest/cfop/lc116. Worker mensal (Plan 02-08) usará
-- DATABASE_ADMIN_URL para popular.
--
-- REFS: threat_model T-02-01-05 — accept lookup expostas a tenants APENAS read-only.
-- Este migration converte isso em mitigate (write fechado).

REVOKE INSERT, UPDATE, DELETE ON ncm   FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON cest  FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON cfop  FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON lc116 FROM app_user;
