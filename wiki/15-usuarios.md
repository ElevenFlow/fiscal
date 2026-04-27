# 15 — Gerenciamento de usuários

## Visão geral

Gestão de usuários e papéis em **3 escopos**:

- **Plataforma** — só `admin` (Nexo Fiscal interno).
- **Contabilidade** — `contabilidade_owner` convida outros donos e operadores.
- **Empresa** — `empresa_owner` convida operadores e usuários de leitura para a sua empresa.

Convite por e-mail é nativo do Clerk Organizations. A nossa lógica orquestra:
1. Cria invitation no Clerk.
2. Pré-registra `user_membership` com escopo + papel.
3. Quando o usuário aceita o convite, webhook `organizationMembership.created` ativa o membership.

## Status atual

**Scaffolded.** Página placeholder.

| Componente | Status |
|-----------|--------|
| Página `/usuarios` | Placeholder |
| Endpoint `/api/usuarios/invite` | Não criado |
| Webhook handlers (já existem) | Sincroniza memberships básicos — papel padrão |
| UI de gerenciamento de papéis | Não criada |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/usuarios/page.tsx` — placeholder
- *(planejado)* `src/components/usuarios/invite-form.tsx`
- *(planejado)* `src/components/usuarios/membership-row.tsx`

### Backend (planejado)
- `apps/api/src/modules/usuarios/usuarios.module.ts`
- `apps/api/src/modules/usuarios/usuarios.controller.ts`
- `apps/api/src/modules/usuarios/usuarios.service.ts`

### Webhook (existe)
- `apps/web/src/app/api/webhooks/clerk/route.ts` — recebe `organizationMembership.*`

## Endpoints (planejados)

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/api/usuarios` | Lista membros do escopo (contab. ou empresa) + papel | owner+ |
| POST | `/api/usuarios/invite` | Cria invitation no Clerk + pré-membership | owner+ |
| PATCH | `/api/usuarios/:userId/role` | Muda papel | owner+ |
| DELETE | `/api/usuarios/:userId` | Remove do escopo | owner+ |
| POST | `/api/usuarios/:userId/reativar` | Reativa membership desativado | owner+ |
| GET | `/api/usuarios/invites` | Lista convites pendentes | owner+ |
| DELETE | `/api/usuarios/invites/:id` | Cancela convite | owner+ |

## Modelo de dados

Reutiliza `UserMembership` (já existe — ver [02-multi-tenancy-rbac.md](02-multi-tenancy-rbac.md)). Acrescentar quando necessário:

```prisma
// (planejado) campos opcionais para tracking do convite
model UserMembership {
  // ... campos atuais
  convidadoPor      String?   @db.Uuid @map("convidado_por")
  convidadoEm       DateTime? @map("convidado_em")
  ativadoEm         DateTime? @map("ativado_em")
  desativadoEm      DateTime? @map("desativado_em")
  desativadoPor     String?   @db.Uuid @map("desativado_por")
}
```

> **Soft delete sempre** — `desativadoEm` em vez de DELETE. Memberships permanecem para auditoria de quem fez o que (FKs em `audit_log`).

## Fluxo de convite

```
1. owner → POST /api/usuarios/invite
   Body: { email, role: 'contabilidade_operador', scopeType: 'contabilidade', scopeId: <orgId> }

2. Backend valida:
   • Solicitante tem papel hierarquicamente superior?
     - Quem convida 'contabilidade_owner'? → admin (platform)
     - Quem convida 'empresa_*'? → contabilidade_owner ou empresa_owner do escopo
   • Email não está já como membership ativo no escopo
   • Limite de seats (futuro — billing)

3. Backend chama Clerk:
   await clerkClient.organizations.createInvitation({
     organizationId: clerkOrgId,
     emailAddress: email,
     role: mapRoleToClerk(role),
     publicMetadata: { nexoRole: role, scopeId, scopeType },
   })

4. Backend cria UserMembership (com user.email pendente; userId vira válido após aceite)
   • Status: convidado (sem userId ainda)

5. Clerk envia e-mail "Você foi convidado para Nexo Fiscal"

6. Usuário clica → cria conta (ou faz login se já existe) → aceita org

7. Webhook organizationMembership.created
   → busca UserMembership pelo email pendente, atualiza userId

8. Audit log: 'usuario.convite-aceito'
```

## Hierarquia de quem pode convidar quem

```
admin (platform)
  └── pode convidar/promover qualquer papel em qualquer escopo

contabilidade_owner
  ├── pode convidar contabilidade_owner / contabilidade_operador (sua contab)
  └── pode convidar empresa_* (em qualquer empresa vinculada)

contabilidade_operador
  └── NÃO pode convidar ninguém

empresa_owner
  └── pode convidar empresa_owner / empresa_operador / empresa_leitura (sua empresa)

empresa_operador / empresa_leitura
  └── NÃO podem convidar
```

Validação centralizada em `usuarios.service.canInvite(actor, targetRole, scope)`.

## UI

### Lista
Tabela:
- Avatar + nome + e-mail
- Papel (badge colorido)
- Escopo (qual contabilidade/empresa)
- Status (ativo / convite pendente / desativado)
- Última atividade (de `audit_log` mais recente)
- Ações (editar papel, desativar, reativar, reenviar convite)

### Drawer de convite
Form:
- E-mail
- Papel (select, filtrado pelos papéis que o solicitante pode atribuir)
- Escopo (auto-resolvido pelo contexto da página, mas configurável para admin)
- Mensagem opcional (vai no e-mail)

### Mudança de papel
Inline edit; confirmação obrigatória se for downgrade ou upgrade entre escopos.

## Padrões e ressalvas

- **Auditar tudo.** `usuario.invite`, `usuario.role-change`, `usuario.deactivate` etc.
- **Não permitir um owner remover a si mesmo** se for o único owner do escopo. UI bloqueia + backend valida.
- **Mudança de e-mail** vem do Clerk (webhook `user.updated`). Não permitimos editar e-mail aqui.
- **Reset de senha** = botão na UI que dispara `clerk.users.createPasswordResetTicket()` ou `clerk.signIn.passwordReset()`.
- **MFA obrigatório** para `admin` e `contabilidade_owner` — configurar em Clerk Dashboard, não no código.
- **Limite por seat** (futuro com billing) — endpoint retorna 402 se exceder, UI mostra upsell.

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@clerk/backend` | latest | `organizations.createInvitation`, `users.updateUserMetadata` |
| `@clerk/nextjs` | latest | `<OrganizationProfile>` reutilizável (alternativa à UI custom) |

> **Decisão pendente:** reusar `<OrganizationProfile>` do Clerk (UI dele, com customização de tema) **ou** construir UI própria. Trade-off: deles entrega rápido + bem testado; nossa permite UX única e merge com filtros por empresa. Para MVP, ir com Clerk; iterar depois.

## Próximos passos

- [ ] Endpoints CRUD + invite
- [ ] Webhook handler complementar (vincular convite a membership ao aceitar)
- [ ] UI list + drawer de convite + edit de papel
- [ ] Validação `canInvite` centralizada com testes
- [ ] Audit log granular
- [ ] Reativação de membership desativado
- [ ] (Futuro) seat-based billing limit
