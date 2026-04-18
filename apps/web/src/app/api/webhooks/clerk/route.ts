import { type NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { Webhook } from 'svix';

/**
 * Webhook Clerk → Postgres (Plan 01-07).
 *
 * Eventos sincronizados:
 *  - `user.created` / `user.updated`               → tabela `users`
 *  - `organization.created` / `organization.updated` → tabela `contabilidades`
 *  - `organizationMembership.created`              → tabela `user_memberships`
 *  - `organizationMembership.updated`              → atualiza `role`
 *  - `organizationMembership.deleted`              → remove membership
 *
 * Segurança (T-07-02):
 *  - Svix validação de assinatura com `CLERK_WEBHOOK_SECRET` é obrigatória.
 *  - Sem secret setado, retorna 500 — nunca aceita payload sem validação.
 *  - Usa conexão `app_admin` (BYPASSRLS) para poder upsertar em user_memberships
 *    sem violar `FORCE ROW LEVEL SECURITY` (Plan 04 policy).
 *  - `app_admin` só é usado aqui (webhook trusted) e em migrations; runtime regular
 *    da API usa `app_user` (NOBYPASSRLS).
 *
 * Performance:
 *  - Pool lazy-initialized (módulo-escopo, compartilhado entre invocations).
 *  - `max: 2` evita esgotar slots do Postgres em serverless bursts.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_ADMIN_URL;
    if (!connectionString) {
      throw new Error('DATABASE_ADMIN_URL not set — webhook requires app_admin connection');
    }
    pool = new Pool({ connectionString, max: 2 });
  }
  return pool;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret || secret === 'whsec_REPLACE_ME') {
    return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET not configured' }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    // T-07-02: nunca vazar detalhes do erro de assinatura (evita oracle de sniffing).
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const db = getPool();

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const data = event.data as {
          id: string;
          email_addresses?: Array<{ email_address: string }>;
        };
        const email = data.email_addresses?.[0]?.email_address;
        if (!email) break;

        // Upsert pelo clerkUserId (pode existir por invite que registrou email antes)
        await db.query(
          `INSERT INTO users (id, email, clerk_user_id, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
           ON CONFLICT (clerk_user_id) DO UPDATE
             SET email = EXCLUDED.email, updated_at = NOW()`,
          [email, data.id],
        );
        break;
      }

      case 'organization.created':
      case 'organization.updated': {
        const data = event.data as {
          id: string;
          name: string;
          public_metadata?: { cnpj?: string };
        };
        const cnpj = data.public_metadata?.cnpj ?? `PENDING-${data.id.slice(0, 8)}`;
        await db.query(
          `INSERT INTO contabilidades (id, nome, cnpj, clerk_org_id, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
           ON CONFLICT (clerk_org_id) DO UPDATE
             SET nome = EXCLUDED.nome, updated_at = NOW()`,
          [data.name, cnpj, data.id],
        );
        break;
      }

      case 'organizationMembership.created':
      case 'organizationMembership.updated': {
        const data = event.data as {
          organization: { id: string };
          public_user_data: { user_id: string };
          role: string;
        };

        // Resolve UUIDs locais
        const orgRes = await db.query<{ id: string }>(
          'SELECT id FROM contabilidades WHERE clerk_org_id = $1 LIMIT 1',
          [data.organization.id],
        );
        const userRes = await db.query<{ id: string }>(
          'SELECT id FROM users WHERE clerk_user_id = $1 LIMIT 1',
          [data.public_user_data.user_id],
        );
        const orgRow = orgRes.rows[0];
        const userRow = userRes.rows[0];
        if (!orgRow || !userRow) break;

        // Map Clerk role → Nexo role (FOUND-04)
        const roleMap: Record<string, string> = {
          'org:admin': 'contabilidade_owner',
          'org:member': 'contabilidade_operador',
        };
        const role = roleMap[data.role] ?? 'contabilidade_operador';

        // Remove memberships anteriores do par (user, contabilidade) e insere atual
        const contabilidadeId = orgRow.id;
        const userId = userRow.id;

        await db.query(
          `DELETE FROM user_memberships
           WHERE user_id = $1 AND scope_type = 'contabilidade' AND scope_id = $2`,
          [userId, contabilidadeId],
        );
        await db.query(
          `INSERT INTO user_memberships (id, user_id, scope_type, scope_id, role, created_at)
           VALUES (gen_random_uuid(), $1, 'contabilidade', $2, $3, NOW())`,
          [userId, contabilidadeId, role],
        );
        break;
      }

      case 'organizationMembership.deleted': {
        const data = event.data as {
          organization: { id: string };
          public_user_data: { user_id: string };
        };
        const orgRes = await db.query<{ id: string }>(
          'SELECT id FROM contabilidades WHERE clerk_org_id = $1 LIMIT 1',
          [data.organization.id],
        );
        const userRes = await db.query<{ id: string }>(
          'SELECT id FROM users WHERE clerk_user_id = $1 LIMIT 1',
          [data.public_user_data.user_id],
        );
        const orgRowDel = orgRes.rows[0];
        const userRowDel = userRes.rows[0];
        if (!orgRowDel || !userRowDel) break;

        await db.query(
          `DELETE FROM user_memberships
           WHERE user_id = $1 AND scope_type = 'contabilidade' AND scope_id = $2`,
          [userRowDel.id, orgRowDel.id],
        );
        break;
      }

      default:
        // Evento não modelado — ack silencioso (Clerk tolera 200 sem handler).
        break;
    }
  } catch (err) {
    // Nunca vazar detalhes internos para o Clerk (pode aparecer em retry logs deles).
    console.error('Clerk webhook processing error:', {
      type: event.type,
      message: (err as Error).message,
    });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
