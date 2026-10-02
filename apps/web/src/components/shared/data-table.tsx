'use client';

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ErrorState } from './empty-state';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'right' | 'center';
    /** Server-side sort key; makes the header clickable. */
    sortKey?: string;
    className?: string;
    /** Hide on small screens. */
    hideOnMobile?: boolean;
  }
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Navigates on row click (Cmd/Ctrl+click opens a new tab). */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  getRowId?: (row: T) => string;
  className?: string;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  rowHref,
  onRowClick,
  empty,
  pagination,
  getRowId,
  className,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const router = useRouter();
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    manualSorting: true,
    manualPagination: true,
  });

  const clickable = Boolean(rowHref || onRowClick);
  const alignClass = (align?: string) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '');

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card shadow-xs', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sortable = Boolean(meta?.sortKey && onSortChange);
                const active = sortable && sort?.key === meta?.sortKey;
                return (
                  <TableHead
                    key={header.id}
                    className={cn(alignClass(meta?.align), meta?.hideOnMobile && 'hidden md:table-cell', meta?.className)}
                    aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
                        onClick={() =>
                          onSortChange!({
                            key: meta!.sortKey!,
                            dir: active && sort?.dir === 'desc' ? 'asc' : 'desc',
                          })
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {active ? (
                          sort?.dir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && !data ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {columns.map((c, j) => (
                  <TableCell key={j} className={cn(c.meta?.hideOnMobile && 'hidden md:table-cell')}>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error && !data ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length}>
                <ErrorState message={errorMessage(error)} onRetry={onRetry} />
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="whitespace-normal">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-clickable={clickable}
                tabIndex={clickable ? 0 : undefined}
                className={cn(clickable && 'focus-visible:bg-slate-50 focus-visible:outline-none', loading && 'opacity-60')}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a,button,input,select,[data-no-row-click]')) return;
                  if (rowHref) {
                    const href = rowHref(row.original);
                    if (e.metaKey || e.ctrlKey) window.open(href, '_blank');
                    else router.push(href);
                  } else onRowClick?.(row.original);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
                  if (rowHref) router.push(rowHref(row.original));
                  else onRowClick?.(row.original);
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(alignClass(meta?.align), meta?.hideOnMobile && 'hidden md:table-cell', meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pagination && pagination.total > 0 && <Pagination {...pagination} />}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="tabular px-2">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
