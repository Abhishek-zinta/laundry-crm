import { Label as LabelPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium leading-none text-foreground/90 select-none peer-disabled:opacity-60', className)}
      {...props}
    />
  );
}
