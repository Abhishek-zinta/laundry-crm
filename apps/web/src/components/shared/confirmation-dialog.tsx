'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Ask for a reason (e.g. cancellation or refund). */
  reason?: { label: string; placeholder?: string; required?: boolean };
  onConfirm: (reason?: string) => void | Promise<void>;
  children?: React.ReactNode;
}

/** Confirmation for critical actions. Esc / overlay click cancels. */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  reason,
  onConfirm,
  children,
}: ConfirmationDialogProps) {
  const [text, setText] = useState('');
  const reasonMissing = Boolean(reason?.required && text.trim().length < 3);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setText('');
        onOpenChange(o);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {(reason || children) && (
          <DialogBody className="grid gap-3">
            {children}
            {reason && (
              <Field label={reason.label} required={reason.required}>
                <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={reason.placeholder} />
              </Field>
            )}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={loading}
            disabled={reasonMissing}
            onClick={() => onConfirm(reason ? text.trim() : undefined)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
