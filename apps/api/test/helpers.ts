import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { provisionTenant } from '../src/modules/tenants/tenant-provisioning';

export const PASSWORD = 'Password123!';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDatabase(prisma: PrismaClient) {
  // Every business table cascades from Tenant.
  await prisma.$executeRawUnsafe('TRUNCATE "Tenant" CASCADE');
}

export interface TestTenant {
  tenantId: string;
  storeId: string;
  slug: string;
  emails: Record<'owner' | 'counter' | 'processing' | 'driver', string>;
}

/** Provisions a business with a starter catalog, a rack and one user per role. */
export async function seedTenant(prisma: PrismaClient, key: string): Promise<TestTenant> {
  const passwordHash = await argon2.hash(PASSWORD);
  const slug = `t-${key}-${Date.now().toString(36)}`;
  const emails = {
    owner: `owner.${slug}@test.local`,
    counter: `counter.${slug}@test.local`,
    processing: `processing.${slug}@test.local`,
    driver: `driver.${slug}@test.local`,
  };
  const { tenant, store } = await prisma.$transaction((tx) =>
    provisionTenant(tx, {
      businessName: `Tenant ${key}`,
      slug,
      ownerName: 'Owner',
      ownerEmail: emails.owner,
      passwordHash,
      storeName: 'Main Store',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      taxRate: '18',
    }),
  );
  for (const [role, email] of [
    ['COUNTER_STAFF', emails.counter],
    ['PROCESSING_STAFF', emails.processing],
    ['DRIVER', emails.driver],
  ] as const) {
    await prisma.user.create({
      data: { tenantId: tenant.id, name: role, email, role, passwordHash, stores: { create: [{ storeId: store.id }] } },
    });
  }
  return { tenantId: tenant.id, storeId: store.id, slug, emails };
}

export async function login(app: INestApplication, email: string) {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return agent;
}

/** Finds the price list ids for an item + service in the POS catalog. */
export async function posLine(agent: request.Agent, storeId: string, category: string, item: string) {
  const res = await agent.get(`/api/v1/catalog/pos?storeId=${storeId}`).expect(200);
  const c = res.body.categories.find((x: { name: string }) => x.name === category);
  const i = c.items.find((x: { name: string }) => x.name === item);
  return { serviceCategoryId: c.id as string, serviceItemId: i.serviceItemId as string };
}

export const inTwoDays = () => new Date(Date.now() + 2 * 86400000).toISOString();
