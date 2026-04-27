import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
} as const;

const DEFAULT_ADMIN_EMAIL = 'admin@nexofiscal.local';
const DEFAULT_ADMIN_PASSWORD = 'nexo2026';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL && process.env.DATABASE_ADMIN_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_ADMIN_URL;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ou DATABASE_ADMIN_URL deve estar configurado.');
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const prisma = new PrismaClient();

  try {
    const existingAdmin = await prisma.userMembership.findFirst({
      where: { scopeType: 'platform', role: 'admin' },
      include: { user: true },
    });

    if (existingAdmin) {
      console.log(`[seed-admin] Admin platform ja existe: ${existingAdmin.user.email}`);
      return;
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      create: {
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
    });

    await prisma.userMembership.create({
      data: {
        userId: admin.id,
        scopeType: 'platform',
        scopeId: null,
        role: 'admin',
      },
    });

    console.log('[seed-admin] Admin platform criado com sucesso.');
    console.log(`[seed-admin] Email: ${email}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log('[seed-admin] Senha inicial padrao: nexo2026');
      console.log('[seed-admin] Troque a senha imediatamente apos o primeiro login.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[seed-admin] erro:', error);
  process.exit(1);
});
