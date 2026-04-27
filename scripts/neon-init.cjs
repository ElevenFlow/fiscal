// Setup inicial do Neon: roles + extensões.
// Executar com: pnpm --filter @nexo/web exec node ../../scripts/neon-init.cjs
// Lê NEON_SUPER_URL do env (set -a; source .env.staging.local; set +a)

const path = require('path');
const fs = require('fs');
const PG_PATH = path.join(__dirname, '..', 'node_modules', '.pnpm', 'pg@8.20.0', 'node_modules', 'pg');
const { Client } = require(PG_PATH);

// Ler .env.staging.local diretamente (evita problemas de CRLF + & no source bash)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envFile = path.join(__dirname, '..', '.env.staging.local');
const fileEnv = loadEnvFile(envFile);
const url = process.env.NEON_SUPER_URL || fileEnv.NEON_SUPER_URL;
if (!url) {
  console.error('ERRO: NEON_SUPER_URL não está setado (nem em .env.staging.local nem no env)');
  process.exit(1);
}

const SQL = `
-- Roles app_admin (BYPASSRLS) + app_user (NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin LOGIN PASSWORD 'app_admin_dev_pass' BYPASSRLS CREATEDB CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_pass' NOBYPASSRLS;
  END IF;
END $$;

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Neon: para ALTER SCHEMA OWNER funcionar, o usuário atual precisa ser membro do role alvo
GRANT app_admin TO CURRENT_USER;
GRANT app_user  TO CURRENT_USER;

-- Ownership
ALTER SCHEMA public OWNER TO app_admin;

-- Grants base
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
`;

(async () => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const v = await client.query('SELECT current_user, current_database(), version();');
    console.log(`Conectado: user=${v.rows[0].current_user} db=${v.rows[0].current_database}`);
    console.log(`Postgres: ${v.rows[0].version.split(' ').slice(0, 2).join(' ')}`);

    console.log('Aplicando init (roles + extensões + grants)...');
    await client.query(SQL);

    const roles = await client.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('app_admin','app_user') ORDER BY rolname;"
    );
    console.log(`Roles existentes: ${roles.rows.map(r => r.rolname).join(', ')}`);

    const exts = await client.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp','pgcrypto','pg_trgm') ORDER BY extname;"
    );
    console.log(`Extensões instaladas: ${exts.rows.map(r => r.extname).join(', ')}`);

    console.log('OK');
  } catch (err) {
    console.error('ERRO:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
