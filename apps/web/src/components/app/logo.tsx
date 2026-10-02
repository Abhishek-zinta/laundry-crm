import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <path
        d="M9 20.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0M9 15.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0M9 10.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">RinseOps</span>
    </span>
  );
}
