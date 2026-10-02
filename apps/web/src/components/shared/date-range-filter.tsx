'use client';

import type { DatePreset } from '@rinseops/shared';
import { Input, NativeSelect } from '@/components/ui/input';

export const PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  this_month: 'This month',
  last_30_days: 'Last 30 days',
  custom: 'Custom range',
};

export interface DateRangeValue {
  preset: DatePreset;
  from?: string;
  to?: string;
}

export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Date range"
        className="w-auto min-w-36"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as DatePreset })}
      >
        {(Object.keys(PRESET_LABEL) as DatePreset[]).map((p) => (
          <option key={p} value={p}>
            {PRESET_LABEL[p]}
          </option>
        ))}
      </NativeSelect>
      {value.preset === 'custom' && (
        <>
          <Input
            type="date"
            aria-label="From"
            className="w-auto"
            value={value.from ?? ''}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To"
            className="w-auto"
            value={value.to ?? ''}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
