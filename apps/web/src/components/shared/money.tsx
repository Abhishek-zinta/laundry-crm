'use client';

import { toDecimal, type MoneyInput } from '@rinseops/shared';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MoneyDisplayProps {
  value: MoneyInput | null | undefined;
  className?: string;
  /** Colour positive balances as "owed". */
  emphasizeDue?: boolean;
  muteZero?: boolean;
}

export function MoneyDisplay({ value, className, emphasizeDue, muteZero }: MoneyDisplayProps) {
  const f = useFormat();
  const d = toDecimal(value ?? 0);
  return (
    <span
      className={cn(
        'tabular whitespace-nowrap',
        emphasizeDue && d.greaterThan(0) && 'font-medium text-rose-600',
        muteZero && d.isZero() && 'text-muted-foreground',
        className,
      )}
    >
      {f.money(value)}
    </span>
  );
}
