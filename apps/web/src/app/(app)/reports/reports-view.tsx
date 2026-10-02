'use client';

import { DATE_PRESETS, REPORT_TYPES, type DatePreset, type ReportDto, type ReportType } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { BarChart3, Download, Info } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { cn } from '@/lib/utils';
import { reportCsvUrl, useReport, type ReportParams } from '@/features/reports/api';
import { DailyBarChart } from '@/features/reports/daily-bar-chart';
import { formatReportValue } from '@/features/reports/report-cell';

const REPORT_LABEL: Record<ReportType, string> = {
  sales: 'Sales',
  orders: 'Orders',
  payments: 'Payments',
  outstanding: 'Outstanding',
  services: 'Services',
  customers: 'Customers',
};

type Row = Record<string, string | number | null>;

export function ReportsView() {
  const { storeFilter } = useSession();
  const f = useFormat();
  const [state, setState] = useUrlState({
    type: 'sales',
    preset: 'this_month',
    from: undefined as string | undefined,
    to: undefined as string | undefined,
  });
  const type = ((REPORT_TYPES as readonly string[]).includes(state.type) ? state.type : 'sales') as ReportType;
  const preset = ((DATE_PRESETS as readonly string[]).includes(state.preset) ? state.preset : 'this_month') as DatePreset;
  const params: ReportParams = { preset, from: state.from, to: state.to, storeId: storeFilter };
  const customIncomplete = preset === 'custom' && (!state.from || !state.to);
  const { data, isLoading, isFetching, error, refetch } = useReport(type, params);

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      (data?.columns ?? []).map((c) => ({
        id: c.key,
        header: c.label,
        meta: { align: c.type === 'money' || c.type === 'number' || c.type === 'percent' ? 'right' : 'left' },
        cell: ({ row }) => (
          <span className={cn((c.type === 'money' || c.type === 'number' || c.type === 'percent') && 'tabular')}>
            {formatReportValue(row.original[c.key], c.type, f)}
          </span>
        ),
      })),
    [data?.columns, f],
  );

  const salesPoints = useMemo(
    () => (data?.type === 'sales' ? data.rows.map((r) => ({ date: String(r.date), value: Number(r.net ?? 0) })) : []),
    [data],
  );
  const hasData =
    data && data.rows.some((r) => Object.values(r).some((v) => (typeof v === 'number' ? v > 0 : v !== null && v !== '' && v !== '0.00')));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, collections and operations straight from your live data."
        actions={
          <Button variant="outline" asChild>
            <a href={reportCsvUrl(type, params)} download>
              <Download />
              Export CSV
            </a>
          </Button>
        }
      />

      <div
        className="mb-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:none]"
        role="tablist"
        aria-label="Report"
      >
        {REPORT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === type}
            onClick={() => setState({ type: t })}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
              t === type && 'bg-primary-soft text-primary hover:text-primary',
            )}
          >
            {REPORT_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {type === 'outstanding' ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="size-4" />
            Outstanding balances as of today — the date range doesn&apos;t apply.
          </p>
        ) : (
          <DateRangeFilter
            value={{ preset, from: state.from ?? data?.range.from, to: state.to ?? data?.range.to }}
            onChange={(v) =>
              setState(
                v.preset === 'custom' ? { preset: v.preset, from: v.from, to: v.to } : { preset: v.preset, from: undefined, to: undefined },
              )
            }
          />
        )}
        {data && type !== 'outstanding' && (
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {f.calendarDate(data.range.from)}
            {data.range.to !== data.range.from && ` – ${f.calendarDate(data.range.to)}`} · {data.range.timezone}
          </p>
        )}
      </div>

      {customIncomplete && <p className="mb-3 text-sm text-amber-700">Pick both dates to apply the custom range.</p>}

      {error && !data ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className={cn('space-y-4', isFetching && data && 'opacity-70 transition-opacity')}>
          <SummaryGrid report={data} loading={isLoading && !data} />

          {type === 'sales' && data && salesPoints.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Net sales by day</CardTitle>
              </CardHeader>
              <CardContent>
                {salesPoints.some((p) => p.value > 0) ? (
                  <DailyBarChart points={salesPoints} label="Net sales" />
                ) : (
                  <EmptyState compact icon={BarChart3} title="No sales in this period" />
                )}
              </CardContent>
            </Card>
          )}

          <DataTable
            columns={columns}
            data={data?.rows}
            loading={isLoading}
            empty={
              <EmptyState
                icon={BarChart3}
                title={type === 'outstanding' ? 'No outstanding balances' : 'Nothing to report for this period'}
                description={type === 'outstanding' ? 'Every order is fully paid.' : 'Try a wider date range.'}
              />
            }
          />
          {data && !hasData && type === 'sales' && (
            <p className="text-center text-xs text-muted-foreground">No orders were created in this period.</p>
          )}
        </div>
      )}
    </>
  );
}

function SummaryGrid({ report, loading }: { report?: ReportDto; loading: boolean }) {
  const f = useFormat();
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[70px] rounded-lg" />
        ))}
      </div>
    );
  }
  if (!report) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {report.summary.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card px-3.5 py-3 shadow-xs">
          <p className="truncate text-xs font-medium text-muted-foreground" title={s.label}>
            {s.label}
          </p>
          <p className="tabular mt-1 truncate text-lg font-semibold tracking-tight">{formatReportValue(s.value, s.type, f)}</p>
        </div>
      ))}
    </div>
  );
}
