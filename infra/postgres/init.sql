-- Init script para desenvolvimento local — Nexo Fiscal
-- Roda na primeira criação do volume postgres_data (executado uma única vez pelo entrypoint).
-- NÃO é aplicado em produção (produção usa RDS/managed com setup diferente).

\set db_name `echo "$POSTGRES_DB_NAME"`
\set app_user_pw `echo "$APP_USER_PASSWORD"`
\set app_admin_pw `echo "$APP_ADMIN_PASSWORD"`

-- 1) Database.
SELECT 'CREATE DATABASE ' || :'db_name'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

\c :db_name

-- 2) Roles com separação BYPASSRLS / NOBYPASSRLS.
--    DROP + CREATE é seguro porque init.sql só roda na primeira inicialização do volume.
DROP ROLE IF EXISTS app_admin;
CREATE ROLE app_admin LOGIN PASSWORD :'app_admin_pw' BYPASSRLS CREATEDB CREATEROLE;

DROP ROLE IF EXISTS app_user;
CREATE ROLE app_user LOGIN PASSWORD :'app_user_pw' NOBYPASSRLS;

-- 3) Extensões fiscais-críticas.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4) Ownership e grants base.
--    app_admin é owner do schema public (para prisma migrate criar tabelas).
ALTER SCHEMA public OWNER TO app_admin;

--    app_user tem permissão de leitura/escrita em tabelas existentes E futuras.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

--    Default privileges: toda tabela/sequence criada por app_admin já concede a app_user.
ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

COMMENT ON DATABASE :"db_name" IS 'Nexo Fiscal — development database';

-- 5) Log de sucesso.
DO $$
BEGIN
  RAISE NOTICE 'Nexo Fiscal init OK: app_admin (BYPASSRLS) + app_user (NOBYPASSRLS) + uuid-ossp + pgcrypto.';
END
$$;
