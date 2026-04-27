# 07 — Cadastros (master data)

## Visão geral

CRUDs de entidades cadastrais: **empresas, contabilidades, clientes, fornecedores, produtos, serviços**. UI consistente: tabela paginada server-side, drawer/página de criação, edição inline ou em página dedicada.

## Status atual

**Scaffolded.** Rotas e componentes UI prontos; sem endpoints, validação ou queries.

| Recurso | Páginas (list/novo/[id]) | Modelo Prisma | Endpoint API |
|---------|:---:|:---:|:---:|
| Empresas | ✓ | ✓ (parcial) | ✗ |
| Contabilidades | ✓ | ✓ (parcial) | ✗ |
| Clientes | ✓ | ✗ | ✗ |
| Fornecedores | ✓ | ✗ | ✗ |
| Produtos | ✓ | ✗ | ✗ |
| Serviços | ✓ | ✗ | ✗ |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/cadastros/page.tsx` — hub com cards
- `src/app/(app)/cadastros/empresas/page.tsx` (list)
- `src/app/(app)/cadastros/empresas/novo/page.tsx`
- `src/app/(app)/cadastros/empresas/[id]/page.tsx` (edit)
- (idem para `contabilidades`, `clientes`, `fornecedores`, `produtos`, `servicos`)
- `src/components/cadastros/data-table.tsx` — tabela com sort/filter/paginação
- `src/components/cadastros/empty-state.tsx`
- `src/components/cadastros/form-section.tsx` — agrupador de campos
- `src/components/cadastros/form-toolbar.tsx` — Save / Cancel sticky
- `src/components/cadastros/row-actions.tsx` — menu por linha (editar, excluir, duplicar)
- `src/components/forms/form-field.tsx`
- `src/components/forms/masked-input.tsx` — máscaras CPF/CNPJ/CEP/data
- `src/components/forms/uf-select.tsx`

### Backend (planejado)
- `apps/api/src/modules/empresas/`
- `apps/api/src/modules/clientes/`
- ... um módulo por recurso

## Modelo de dados

Já existem (parcial):
- `Empresa` — `id`, `tenantId`, `razaoSocial`, `cnpj`, `regimeTributario`
- `Contabilidade` — `id`, `nome`, `cnpj`, `clerkOrgId`

A criar (Fase 02):

```prisma
model Cliente {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid @map("tenant_id")
  tipoPessoa     String   // 'fisica' | 'juridica'
  cpfCnpj        String
  nome           String
  inscricaoEst   String?
  endereco       Json     // logradouro, numero, bairro, cidade, uf, cep
  email          String?
  telefone       String?
  ativo          Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([tenantId, cpfCnpj])
  @@index([tenantId, createdAt(sort: Desc)])
  @@map("clientes")
}

model Fornecedor {
  // estrutura semelhante a Cliente
}

model Produto {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid
  codigo         String   // SKU interno
  descricao      String
  ncm            String   @db.VarChar(8)
  cfopPadrao     String?
  cest           String?
  unidade        String   // 'UN', 'KG', 'PC'...
  precoUnitario  Decimal  @db.Decimal(15, 4)
  origemMercadoria Int    // 0..8 conforme tabela ICMS
  ativo          Boolean  @default(true)
  // estoque referência em [11-estoque.md]

  @@unique([tenantId, codigo])
  @@index([tenantId, ncm])
  @@map("produtos")
}

model Servico {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid
  codigoServico  String   // código do município (LC 116)
  descricao      String
  precoUnitario  Decimal  @db.Decimal(15, 4)
  aliquotaIss    Decimal  @db.Decimal(5, 2)
  ativo          Boolean  @default(true)

  @@unique([tenantId, codigoServico])
  @@map("servicos")
}
```

Todos com `tenant_id` para RLS.

## Padrão de endpoint REST

```
GET    /api/{resource}                lista paginada (cursor + page size)
POST   /api/{resource}                cria
GET    /api/{resource}/:id            detalhe
PATCH  /api/{resource}/:id            atualiza parcial
DELETE /api/{resource}/:id            soft delete (set ativo=false)
```

### Pagination
Cursor + `pageSize` (default 50, max 200):
```
GET /api/clientes?cursor={uuid}&pageSize=50&sort=razaoSocial:asc&filter=cnpj:contains:1234
```

### Validação Zod compartilhada
Schemas em `packages/shared/src/cadastros/*.ts`:

```ts
// packages/shared/src/cadastros/cliente.ts
export const ClienteCreateSchema = z.object({
  tipoPessoa: z.enum(['fisica', 'juridica']),
  cpfCnpj: z.string().refine(isValidCpfCnpj, 'CPF/CNPJ inválido'),
  nome: z.string().min(2).max(200),
  endereco: z.object({
    logradouro: z.string().min(1),
    numero: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string().length(2),
    cep: z.string().regex(/^\d{8}$/),
  }),
  // ...
});
```

Mesmo schema usado:
- backend (NestJS pipe `ZodValidationPipe`)
- frontend (`@hookform/resolvers/zod`)

## Padrão de UI

### List (page.tsx)
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['clientes', { page, sort, filter }],
  queryFn: () => fetchApi(`/api/clientes?...`),
});

return (
  <div>
    <PageHeader title="Clientes" actions={<Button onClick={...}>Novo</Button>} />
    <DataTable
      columns={columns}
      data={data?.items}
      onRowClick={(c) => router.push(`/cadastros/clientes/${c.id}`)}
    />
  </div>
);
```

### Form (novo/[id])
- React Hook Form + Zod resolver
- `form-section.tsx` agrupa campos correlatos
- `masked-input.tsx` para CPF/CNPJ/CEP/telefone
- `uf-select.tsx` para UF
- Auto-save desativado em formulários fiscais (evita persistir parcial inválido)
- Toast de sucesso, retorna para list

## Padrões e ressalvas

- **Soft delete sempre.** Inativar `ativo=false`. Cadastro físico nunca remove — pode estar referenciado em nota emitida (FK).
- **Unicidade por tenant.** `@@unique([tenantId, cpfCnpj])` — empresa A pode ter cliente CNPJ X mesmo que empresa B também tenha.
- **CFOP/NCM/CEST** — manter tabelas externas em cache Redis (TTL longo); UI faz autocomplete.
- **Validação CPF/CNPJ** — algoritmo dígito verificador no shared `packages/shared/src/validators/`. Não chamar API externa (custo + privacidade).
- **Importação em massa** (CSV) — futuro; usar BullMQ job para parse + insert em lotes de 1000.
- **Auditoria:** todo create/update/delete recebe `@Auditable()` com `diff` antes/depois.

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `react-hook-form` 7.x | Form state |
| `@hookform/resolvers` | Integração Zod |
| `@tanstack/react-table` 8.x | Tabela densa |
| `@tanstack/react-query` 5.x | Cache e mutations |
| `zod` 3.x | Validação shared |

## Próximos passos

- [ ] Migration Prisma com `Cliente`, `Fornecedor`, `Produto`, `Servico`
- [ ] Schemas Zod em `packages/shared`
- [ ] Endpoints CRUD com `@Roles()` apropriados
- [ ] Tabelas NCM/CFOP/CEST externas + cache Redis
- [ ] Importação CSV (BullMQ)
- [ ] Dependência cruzada: ao criar produto, mostrar histórico de uso em notas
