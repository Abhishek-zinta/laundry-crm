'use client';

import type { DatePreset, ReportDto, ReportType } from '@rinseops/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { API_BASE, apiGet } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

export interface ReportParams {
  preset: DatePreset;
  from?: string;
  to?: string;
  storeId?: string;
}

function reportQuery(params: ReportParams, format?: 'csv') {
  return toQuery({
    preset: params.preset,
    from: params.preset === 'custom' ? params.from : undefined,
    to: params.preset === 'custom' ? params.to : undefined,
    storeId: params.storeId,
    format,
  });
}

export function useReport(type: ReportType, params: ReportParams) {
  return useQuery({
    queryKey: ['reports', type, params],
    queryFn: ({ signal }) => apiGet<ReportDto>(`/reports/${type}${reportQuery(params)}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function reportCsvUrl(type: ReportType, params: ReportParams): string {
  return `${API_BASE}/reports/${type}${reportQuery(params, 'csv')}`;
}
