# Clerk — Setup Guide (Plan 01-07)

Runbook para provisionar um app Clerk de desenvolvimento e conectar ao Nexo Fiscal.
**Execução humana**: Claude escreveu todo o código; você cria o app Clerk e injeta as chaves.

Tempo estimado: 10–15 minutos (primeira vez).

---

## 1. Criar app Clerk

1. Acesse <https://clerk.com> e crie conta (ou use existente).
2. Dashboard → **Create application** → nome: **Nexo Fiscal (dev)**.
3. Em **Sign-in options**, habilite:
   - Email address ✓
   - Password ✓
   - (Opcional) Google, Microsoft — desabilitar no MVP se quiser isolar variáveis.

---

## 2. Habilitar Organizations

Organizations no Clerk modelam **Contabilidade** no Nexo.

1. Dashboard → **Organizations** → clique em **Enable organizations**.
2. **Roles and permissions** (aba):
   - Roles padrão mantêm: `org:admin`, `org:member`.
   - Mapping automático do webhook (Plan 07):
     - `org:admin`  → Nexo `contabilidade_owner`
     - `org:member` → Nexo `contabilidade_operador`
   - (Opcional — Phase 2) custom roles `empresa_owner`, `empresa_operador`, `empresa_leitura`.
3. **Organization settings**:
   - Membership limit: **Unlimited** (piloto).
   - Require organization: **ON** — todo user precisa pertencer a uma contabilidade.

---

## 3. Capturar chaves

1. Dashboard → **API Keys**.
2. Copie:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
   - `CLERK_SECRET_KEY=sk_test_...`
3. Cole no `.env.local` da raiz do monorepo (use `.env.example` como base):
   ```bash
   cp .env.example .env.local
   # Edite .env.local com os valores reais
   ```

---

## 4. Configurar URLs customizadas

1. Dashboard → **Paths** (ou **Customization** → **Paths**, varia por versão):
   - Sign-in URL: `/entrar`
   - Sign-up URL: `/cadastrar`
   - After sign-in URL: `/app`
   - After sign-up URL: `/app`
2. Em **Email & SMS templates** (opcional no MVP):
   - O Clerk já detecta pt-BR via `<ClerkProvider localization={ptBR}>`.
   - Templates de e-mail podem ser customizados depois.

---

## 5. Configurar webhook (Plan 07 — sincronização DB)

O webhook leva eventos Clerk (user.created, organization.created, membership.*) para o
Postgres do Nexo via `apps/web/src/app/api/webhooks/clerk/route.ts`.

### Em produção

1. Dashboard → **Webhooks** → **Add Endpoint**.
2. Endpoint URL: `https://seu-dominio.com.br/api/webhooks/clerk`.
3. Subscribe:
   - `user.created`, `user.updated`
   - `organization.created`, `organization.updated`
   - `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`
4. Copie **Signing Secret** (`whsec_...`).
5. Cole como `CLERK_WEBHOOK_SECRET` no Secrets Manager / `.env.production`.

### Em desenvolvimento local

O Clerk não acessa `http://localhost:3000`. Use um túnel:

```bash
# Opção 1 — ngrok
ngrok http 3000
# Opção 2 — cloudflared
cloudflared tunnel --url http://localhost:3000
```

Copie a URL pública gerada (ex: `https://abc123.ngrok.io`) e use como endpoint URL
no passo 2 acima. **O signing secret é por endpoint** — um para dev, outro para prod.

---

## 6. Testar localmente

```bash
# Terminal 1 — Postgres (se ainda não rodando)
docker compose up -d postgres

# Terminal 2 — migrations + seed
pnpm --filter @nexo/api db:migrate
pnpm --filter @nexo/api db:seed   # Plan 04 — seed de tenants

# Terminal 3 — apps/api (porta 3333)
pnpm --filter @nexo/api dev

# Terminal 4 — apps/web (porta 3000)
pnpm --filter @nexo/web dev

# Terminal 5 — tunnel (apenas se testando webhook em dev)
ngrok http 3000
```

Fluxos para validar:

1. Abra <http://localhost:3000/cadastrar> → formulário pt-BR do Clerk.
2. Cadastre-se com e-mail de teste → confirme código → cai em `/app`.
3. No Postgres:
   ```sql
   SELECT id, email, clerk_user_id FROM users WHERE clerk_user_id IS NOT NULL;
   ```
4. No app, crie uma Organization (UI do Clerk). Verifique:
   ```sql
   SELECT id, nome, clerk_org_id FROM contabilidades WHERE clerk_org_id IS NOT NULL;
   SELECT * FROM user_memberships;
   ```

---

## 7. Criar primeiro admin de plataforma

Admin Plataforma (Nexo `admin` role) **não** é membro de nenhuma Organization —
é identificado por `publicMetadata.role === 'platform_admin'` no próprio user Clerk.

1. Crie um user normal em `/cadastrar`.
2. Clerk Dashboard → **Users** → selecione o user.
3. Aba **Metadata** → **Public metadata**:
   ```json
   { "role": "platform_admin" }
   ```
4. Salve.
5. Logout + login no Nexo → `resolveTenant()` agora retorna `role: 'platform_admin'`
   → `@Roles('admin')` endpoints responde 200.

---

## 8. Troubleshooting

| Sintoma | Causa provável | Fix |
|---------|----------------|-----|
| `/entrar` carrega em inglês | `ptBR` não importado em `layout.tsx` | Verifique `import { ptBR } from '@clerk/localizations'` em `apps/web/src/app/layout.tsx` |
| Webhook retorna 401 "Invalid signature" | Secret no `.env` não bate com o do Dashboard | Recopie do endpoint no Clerk Dashboard (não da tela de criação inicial) |
| User cadastra mas não aparece no DB | Webhook não chegou | Confira tunnel URL ativa + endpoint no Dashboard + logs do `apps/web` |
| API retorna 401 em `/api/empresas/minhas` | JWT sem token / `CLERK_SECRET_KEY` errado no apps/api | Confira env em `apps/api/.env` + reinicie o server |
| `auth.protect()` loop redirect | Middleware matcher cobrindo rotas estáticas | Confirme matcher em `apps/web/middleware.ts` (não deve pegar `_next/static/*`) |

---

## 9. Produção (quando sair do piloto)

- Ative **Production Environment** no Dashboard Clerk (separado do dev).
- Novo app Clerk → novas chaves (`pk_live_...`, `sk_live_...`).
- Novo webhook endpoint apontando para produção → novo `whsec_...`.
- Armazene secrets via AWS Secrets Manager (nunca commit).
- Configure domínios customizados (`accounts.nexofiscal.com.br`) para evitar
  URL `clerk.accounts.dev` no fluxo de e-mail (T-07-08 mitigation).
- Habilite **Bot protection** (Clerk → Security) — incluso no tier free.
