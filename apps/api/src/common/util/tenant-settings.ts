import type { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../errors/app-error';

export async function loadTenantSettings(prisma: PrismaService, tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) throw notFound('Business settings');
  return settings;
}
