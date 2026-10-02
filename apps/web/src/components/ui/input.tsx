import * as React from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-[72px] py-2', className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        inputClass,
        'appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%2364748b%27%3E%3Cpath%20d%3D%27M5.3%207.3a1%201%200%20011.4%200L10%2010.6l3.3-3.3a1%201%200%20111.4%201.4l-4%204a1%201%200%2001-1.4%200l-4-4a1%201%200%20010-1.4z%27/%3E%3C/svg%3E")] bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat pr-8',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
