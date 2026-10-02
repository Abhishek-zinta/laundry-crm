import { Logo } from '@/components/app/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0b3b37] p-10 text-white lg:flex">
        <Logo className="[&>span:last-child]:text-white" />
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Run your laundry business from one place.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-teal-50/80">
            Counter POS, garment-level tracking, racks, payments, pickups and reports — built for shops that process hundreds of garments a
            day.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-teal-50/90">
            {[
              'Create an order in seconds with phone lookup',
              'Tag and track every garment individually',
              'Know exactly which rack an order is on',
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-teal-300" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-teal-50/50">© {new Date().getFullYear()} RinseOps</p>
        <svg className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] text-white/[0.04]" viewBox="0 0 32 32" aria-hidden>
          <path
            d="M9 20.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0M9 15.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0M9 10.5c2.2 1.6 4.5 1.6 7 0s4.8-1.6 7 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
