'use client';

import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  ROLE_LABEL,
  type AuditLogDto,
  type OrderStatus,
  type PaymentMethod,
} from '@rinseops/shared';
import { History } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/data-table';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat, type Formatters } from '@/lib/format';
import { initials } from '@/lib/utils';
import { useAuditLog } from './api';

const ACTION_TEXT: Record<string, string> = {
  ORDER_CREATED: 'created order',
  ORDER_UPDATED: 'edited order',
  ORDER_STATUS_CHANGED: 'changed order status',
  ORDER_CANCELLED: 'cancelled order',
  PAYMENT_RECORDED: 'recorded a payment on',
  PAYMENT_REFUNDED: 'refunded a payment on',
  RACK_ASSIGNED: 'racked order',
  RACK_MOVED: 'moved order',
  RACK_REMOVED: 'removed from rack',
  CUSTOMER_CREATED: 'added a customer',
  CUSTOMER_UPDATED: 'updated a customer',
  STAFF_CREATED: 'added staff member',
  STAFF_UPDATED: 'updated staff member',
  STAFF_ROLE_CHANGED: 'changed the role of',
  STAFF_STATUS_CHANGED: 'changed the status of',
  GARMENT_STATUS_CHANGED: 'updated garment',
  GARMENT_UPDATED: 'edited garment details',
  TASK_CREATED: 'created a pickup/delivery task',
  TASK_UPDATED: 'updated a pickup/delivery task',
  TASK_STATUS_CHANGED: 'updated a task status',
  SETTINGS_UPDATED: 'updated business settings',
  CATALOG_UPDATED: 'updated services & pricing',
  STORE_CREATED: 'created store',
  STORE_UPDATED: 'updated store',
  USER_LOGIN: 'signed in',
};

const humanize = (s: string) => s.toLowerCase().replace(/_/g, ' ');

function statusLabel(v: unknown): string {
  return typeof v === 'string' && v in ORDER_STATUS_LABEL ? ORDER_STATUS_LABEL[v as OrderStatus] : humanize(String(v));
}

function describe(log: AuditLogDto, f: Formatters): { subject?: string; detail?: string } {
  const m = (log.metadata ?? {}) as Record<string, unknown>;
  const subject =
    (m.orderNumber as string | undefined) ??
    (m.tagCode as string | undefined) ??
    (m.name as string | undefined) ??
    (m.created as string | undefined);
  const parts: string[] = [];
  if (m.from !== undefined && m.to !== undefined) {
    parts.push(
      log.action.startsWith('STAFF')
        ? `${humanize(String(m.from))} → ${humanize(String(m.to))}`
        : `${statusLabel(m.from)} → ${statusLabel(m.to)}`,
    );
  }
  if (m.amount !== undefined) parts.push(f.money(String(m.amount)));
  if (typeof m.method === 'string') parts.push(PAYMENT_METHOD_LABEL[m.method as PaymentMethod] ?? m.method);
  if (m.slot) parts.push(`${m.rack ? `${String(m.rack)} → ` : ''}${String(m.slot)}`);
  if (m.reason) parts.push(`“${String(m.reason)}”`);
  if (m.note && typeof m.note === 'string') parts.push(`“${m.note}”`);
  if (Array.isArray(m.fields) && m.fields.length) parts.push(`fields: ${m.fields.join(', ')}`);
  if (m.changes && Array.isArray(m.changes)) parts.push(`changed: ${m.changes.join(', ')}`);
  if (m.grandTotal && log.action === 'ORDER_CREATED') parts.push(f.money(String(m.grandTotal)));
  if (m.source === 'PUBLIC_BOOKING') parts.push('via online booking');
  if (m.automatic) parts.push('automatic');
  return { subject, detail: parts.join(' · ') || undefined };
}

export function ActivityLog({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const f = useFormat();
  const log = useAuditLog(page);

  if (log.isLoading) {
    return (
      <Card className="grid gap-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </Card>
    );
  }
  if (log.error || !log.data) {
    return (
      <Card>
        <ErrorState message={errorMessage(log.error)} onRetry={() => void log.refetch()} />
      </Card>
    );
  }
  if (!log.data.items.length) {
    return (
      <Card>
        <EmptyState
          icon={History}
          title="No activity yet"
          description="Important actions like payments, status changes and staff edits will appear here."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {log.data.items.map((entry) => {
          const { subject, detail } = describe(entry, f);
          const actor = entry.actor?.name ?? (entry.metadata?.source === 'PUBLIC_BOOKING' ? 'Online booking' : 'System');
          const subjectNode =
            subject && entry.entityType === 'Order' && entry.entityId ? (
              <Link href={`/orders/${entry.entityId}`} className="font-medium text-primary hover:underline">
                {subject}
              </Link>
            ) : subject ? (
              <span className="font-medium">{subject}</span>
            ) : null;
          return (
            <li key={entry.id} className="flex gap-3 px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {entry.actor ? initials(entry.actor.name) : '•'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{actor}</span>
                  {entry.actor && <span className="text-xs text-muted-foreground"> ({ROLE_LABEL[entry.actor.role]})</span>}{' '}
                  {ACTION_TEXT[entry.action] ?? humanize(entry.action)} {subjectNode}
                </p>
                {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.createdAt} title={f.dateTime(entry.createdAt)}>
                {f.relative(entry.createdAt)}
              </time>
            </li>
          );
        })}
      </ul>
      <Pagination page={log.data.page} pageSize={log.data.pageSize} total={log.data.total} onPageChange={onPageChange} />
    </Card>
  );
}
