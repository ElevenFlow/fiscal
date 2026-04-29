# Phase 7 — Configurações + Usuários + Hardening

**Status:** concluída em 2026-04-29  
**Escopo:** execução da Fase 7 sem priorizar pendências abertas das fases 3 a 6.

## Entregue

- Contratos compartilhados `admin` para configurações, usuários e auditoria.
- API NestJS para `/api/configuracoes`, `/api/usuarios` e `/api/auditoria`.
- Configurações da empresa persistindo dados fiscais, endereço, contatos, template de e-mail e preferências em estruturas existentes.
- Tela `/config` conectada à API, com seções de dados, certificado, séries, e-mails, preferências, plano e usuários.
- Tela `/usuarios` conectada à API, com criação de usuário, troca de perfil, bloqueio/desbloqueio e ações de convite/redefinição registradas como dependentes de e-mail transacional.
- Tela `/auditoria` conectada ao `audit_log`, com filtros, tabela, detalhe e diff.
- Checklist de hardening exposto na UI de preferências.

## Fora Do Escopo Por Pedido

- Priorização das pendências abertas das fases 3 a 6.

## Pendência Nova

- `PEND-025`: provedor transacional para convites, redefinição de senha e envio/teste de e-mails fiscais.

## Validação

- `pnpm.cmd --filter @nexo/shared build`
- `pnpm.cmd --filter @nexo/api typecheck`
- `pnpm.cmd --filter @nexo/web typecheck`
