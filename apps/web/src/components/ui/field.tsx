import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  required?: boolean;
  children: React.ReactNode;
}

/** Label + control + error/hint, consistently spaced. */
export function Field({ label, htmlFor, error, hint, className, required, children }: FieldProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
