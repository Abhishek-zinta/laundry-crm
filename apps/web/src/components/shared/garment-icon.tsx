import { garmentIconFor, type GarmentIconKey } from '@rinseops/shared';
import { cn } from '@/lib/utils';

/**
 * RinseOps garment illustrations: flat fills with a dark outline, drawn on a
 * 48×48 grid. Used on POS tiles, order lines and the catalog.
 */
const INK = '#1f2937';
const W = '#ffffff';

const ICONS: Record<GarmentIconKey, React.ReactNode> = {
  shirt: (
    <>
      <path d="M17 8 12 10 5 18l5 5 4-4v22h20V19l4 4 5-5-7-8-5-2c-1 3-4 5-7 5s-6-2-7-5Z" fill="#d9f99d" />
      <path d="M17 8l3 7 4-2 4 2 3-7" fill={W} />
      <path d="M24 13v28" />
      <circle cx="24" cy="20" r="0.9" fill={INK} />
      <circle cx="24" cy="27" r="0.9" fill={INK} />
      <circle cx="24" cy="34" r="0.9" fill={INK} />
      <path d="M28 22h4" />
    </>
  ),
  tshirt: (
    <>
      <path d="M16 8 8 12l-4 8 6 3 3-4v22h22V19l3 4 6-3-4-8-8-4c-1 3-4 5-8 5s-7-2-8-5Z" fill="#bbf7d0" />
      <path d="M16 8c1 3 4 5 8 5s7-2 8-5" fill="none" />
      <path d="M13 19v-2M35 19v-2" />
      <path d="M19 26c2 2 8 2 10 0" fill="none" />
    </>
  ),
  trouser: (
    <>
      <path d="M14 6h20l2 36h-9l-3-24-3 24h-9Z" fill="#93c5fd" />
      <path d="M14 6h20v4H14Z" fill="#60a5fa" />
      <path d="M24 10v8M17 10c0 3 2 5 4 5M31 10c0 3-2 5-4 5" fill="none" />
    </>
  ),
  jeans: (
    <>
      <path d="M14 6h20l2 36h-9l-3-24-3 24h-9Z" fill="#3b82f6" />
      <path d="M14 6h20v4H14Z" fill="#1d4ed8" />
      <path d="M24 10v8M17 10c0 3 2 5 4 5M31 10c0 3-2 5-4 5" fill="none" stroke={W} />
      <path d="M15.5 13 14 40M32.5 13 34 40" stroke="#bfdbfe" strokeDasharray="1.6 1.6" />
    </>
  ),
  suit: (
    <>
      <path d="M15 8 8 12 6 40h36l-2-28-7-4-9 14Z" fill="#94a3b8" />
      <path d="M19 8l5 14 5-14Z" fill={W} />
      <path d="M23 12h2l1 6-2 3-2-3Z" fill="#ef4444" />
      <path d="M15 8l5 16 4-2 4 2 5-16" fill="none" />
      <circle cx="24" cy="29" r="0.9" fill={INK} />
      <circle cx="24" cy="34" r="0.9" fill={INK} />
      <path d="M11 32h6M31 32h6" />
    </>
  ),
  jacket: (
    <>
      <path d="M15 9 9 12 6 38h6l2-18Z" fill="#fbbf24" />
      <path d="M33 9l6 3 3 26h-6l-2-18Z" fill="#fbbf24" />
      <path d="M15 9l5-2 4 3 4-3 5 2 1 32H14Z" fill="#fcd34d" />
      <path d="M20 7l2 5 2-2 2 2 2-5" fill="#f59e0b" />
      <path d="M24 10v31M17 30h4M27 30h4" />
      <path d="M17 18h3" />
    </>
  ),
  hoodie: (
    <>
      <path d="M18 9c0-6 12-6 12 0l-3 3h-6Z" fill="#4ade80" />
      <path d="M18 9 10 13 7 36l5 1 2-15v19h20V22l2 15 5-1-3-23-8-4-3 3h-6Z" fill="#86efac" />
      <path d="M18 31h12l2 7H16Z" fill="#4ade80" />
      <path d="M22 12v6M26 12v6" />
    </>
  ),
  dress: (
    <>
      <path d="M19 6l1 8M29 6l-1 8" />
      <path d="M19 14h10l-1 8h-8Z" fill="#f59e0b" />
      <path d="M20 22 10 42h28L28 22Z" fill="#fcd34d" />
      <path d="M20 22h8" strokeWidth="2.4" />
      <path d="M17 32l-2 8M24 30v10M31 32l2 8" stroke="#f59e0b" />
    </>
  ),
  saree: (
    <>
      <path d="M15 6h18l4 36H11Z" fill="#c4b5fd" />
      <path d="M15 6h7l15 26v10Z" fill="#f472b6" />
      <path d="M11 39h26" stroke="#eab308" strokeWidth="2.4" />
      <path d="M22 6l15 26" stroke="#eab308" strokeWidth="2" />
      <circle cx="17" cy="20" r="1" fill={W} />
      <circle cx="16" cy="30" r="1" fill={W} />
      <circle cx="24" cy="34" r="1" fill={W} />
    </>
  ),
  kurta: (
    <>
      <path d="M17 7 10 11 6 24l5 2 3-8-1 24h22l-1-24 3 8 5-2-4-13-7-4c-2 2-4 3-7 3s-5-1-7-3Z" fill="#fda4af" />
      <path d="M24 10v12" />
      <circle cx="24" cy="14" r="0.8" fill={INK} />
      <circle cx="24" cy="18" r="0.8" fill={INK} />
      <path d="M14 36v6M34 36v6" />
      <path d="M13 38h22" stroke="#e11d48" strokeDasharray="1.4 1.6" />
    </>
  ),
  skirt: (
    <>
      <path d="M17 10h14l7 30H10Z" fill="#f9a8d4" />
      <path d="M17 10h14v4H17Z" fill="#ec4899" />
      <path d="M20 14l-3 26M24 14v26M28 14l3 26" />
    </>
  ),
  shorts: (
    <>
      <path d="M13 10h22l2 22H27l-3-12-3 12H11Z" fill="#7dd3fc" />
      <path d="M13 10h22v4H13Z" fill="#38bdf8" />
      <path d="M24 14v6" />
    </>
  ),
  scarf: (
    <>
      <path d="M14 9c0-5 20-5 20 0 0 6-6 8-10 8s-10-2-10-8Z" fill="#5eead4" />
      <path d="M19 9c0-2 10-2 10 0 0 3-3 4-5 4s-5-1-5-4Z" fill={W} />
      <path d="M17 15 12 39l7 2 4-24Z" fill="#2dd4bf" />
      <path d="M30 15l4 23-7 2-2-23Z" fill="#5eead4" />
      <path d="M12 39l-1 3M15 40l-1 3M18 41v3M28 40v3M31 39l1 3M34 38l1 3" />
    </>
  ),
  tie: (
    <>
      <path d="M21 11h6l3 23-6 8-6-8Z" fill="#f87171" />
      <path d="M20 6h8l-1 5h-6Z" fill="#dc2626" />
      <path d="M23 16l5 5M21 24l8 8M20 31l4 4" stroke="#fecaca" />
    </>
  ),
  blanket: (
    <>
      <rect x="7" y="30" width="34" height="9" rx="4" fill="#fde047" />
      <rect x="9" y="20" width="32" height="9" rx="4" fill="#86efac" />
      <rect x="7" y="10" width="34" height="9" rx="4" fill="#fde047" />
      <path d="M36 12c2 1 2 4 0 5M36 22c2 1 2 4 0 5M36 32c2 1 2 4 0 5" fill="none" />
    </>
  ),
  bedsheet: (
    <>
      <rect x="7" y="12" width="34" height="25" rx="3" fill="#a7f3d0" />
      <path d="M7 18h34M7 24h34M7 30h34" stroke="#34d399" />
      <path d="M33 37c0-3 2-5 8-5" fill="#6ee7b7" />
    </>
  ),
  pillow: (
    <>
      <path d="M10 12c6-3 22-3 28 0 2 6 2 18 0 24-6 3-22 3-28 0-2-6-2-18 0-24Z" fill="#bae6fd" />
      <path d="M15 17c5-2 13-2 18 0" fill="none" stroke="#7dd3fc" />
      <path d="M8 10l3 3M40 10l-3 3M8 38l3-3M40 38l-3-3" />
    </>
  ),
  towel: (
    <>
      <path d="M8 9h32" strokeWidth="2.4" />
      <path d="M13 9h22v29H13Z" fill="#99f6e4" />
      <path d="M13 29h22v4H13Z" fill="#14b8a6" />
      <path d="M15 38v3M19 38v3M23 38v3M27 38v3M31 38v3" />
      <path d="M13 14h22" stroke="#5eead4" />
    </>
  ),
  curtain: (
    <>
      <path d="M6 8h36" strokeWidth="2.4" />
      <path d="M8 8h14c-1 9-3 20-6 34H8Z" fill="#86efac" />
      <path d="M40 8H26c1 9 3 20 6 34h8Z" fill="#86efac" />
      <path d="M12 8v34M18 8c0 10-2 22-4 34M36 8v34M30 8c0 10 2 22 4 34" stroke="#16a34a" />
    </>
  ),
  carpet: (
    <>
      <rect x="9" y="9" width="30" height="30" rx="2" fill="#fca5a5" />
      <rect x="13" y="13" width="22" height="22" rx="1" fill="#fecaca" />
      <path d="M24 17l7 7-7 7-7-7Z" fill="#ef4444" />
      <path d="M9 13H6M9 18H6M9 23H6M9 28H6M9 33H6M39 13h3M39 18h3M39 23h3M39 28h3M39 33h3" />
    </>
  ),
  shoes: (
    <g transform="translate(-4.5 -7) scale(1.2)">
      <path d="M6 30c0-4 4-6 8-6l6-4c4-2 6 2 10 4l10 3c3 1 4 4 3 7H6Z" fill="#c08457" />
      <path d="M6 34h37v3H6Z" fill="#78350f" />
      <path d="M19 22l3 3M22 21l3 3M25 22l2 2" />
    </g>
  ),
  sneakers: (
    <g transform="translate(-4.8 -7) scale(1.2)">
      <path d="M5 31c0-6 3-9 7-10l7-3 4 5 9 2c6 1 11 3 11 7v2H5Z" fill="#93c5fd" />
      <path d="M5 33h38v4H5Z" fill={W} />
      <path d="M14 28c6 0 12-1 18-4" fill="none" stroke="#2563eb" strokeWidth="2" />
      <path d="M19 19l2 3M22 18l2 3" />
    </g>
  ),
  bag: (
    <>
      <path d="M18 16c0-8 12-8 12 0" fill="none" strokeWidth="2.2" />
      <path d="M10 16h28l-2 24H12Z" fill="#f0abfc" />
      <path d="M10 22h28" stroke="#d946ef" />
      <rect x="21" y="20" width="6" height="5" rx="1" fill="#facc15" />
    </>
  ),
  gloves: (
    <>
      <path
        d="M14 40V27l-4-6c-1-2 1-4 3-2l3 3V11c0-2 3-2 3 0v9-11c0-2 3-2 3 0v11-10c0-2 3-2 3 0v11-8c0-2 3-2 3 0v17c0 5-2 8-3 10Z"
        fill="#bef264"
      />
      <path d="M14 36h12v6H14Z" fill="#65a30d" />
      <path d="M20 19v-1M23 19v-1" />
    </>
  ),
  socks: (
    <>
      <path d="M18 6h10v20l6 6c3 3 1 8-3 8l-11-6c-2-1-2-3-2-5Z" fill="#a5b4fc" />
      <path d="M18 6h10v5H18Z" fill="#6366f1" />
      <path d="M31 35c2-1 4 0 4 2" fill="none" />
      <path d="M18 14h10" stroke="#6366f1" />
    </>
  ),
  cap: (
    <>
      <path d="M10 28c0-11 7-17 15-17 7 0 12 6 12 15Z" fill="#fdba74" />
      <path d="M8 28h31c5 0 5 5 0 5H9c-2 0-3-5-1-5Z" fill="#f97316" />
      <circle cx="25" cy="11" r="1.4" fill="#f97316" />
      <path d="M25 11c-4 4-5 10-5 17" fill="none" />
    </>
  ),
  basket: (
    <>
      <path d="M11 20c1-6 7-8 11-5 3-4 10-3 12 2 3-1 5 1 4 3Z" fill="#f9a8d4" />
      <path d="M16 19c2-3 6-3 8 0" fill="#93c5fd" />
      <path d="M8 20h32l-4 20H12Z" fill="#fcd34d" />
      <path d="M10 26h28M11 32h26M16 20l2 20M24 20v20M32 20l-2 20" stroke="#d97706" />
    </>
  ),
  sewing: (
    <>
      <path d="M14 14h16v20H14Z" fill="#f472b6" />
      <path d="M14 19h16M14 24h16M14 29h16" stroke="#be185d" />
      <rect x="11" y="10" width="22" height="4" rx="1.5" fill="#d97706" />
      <rect x="11" y="34" width="22" height="4" rx="1.5" fill="#d97706" />
      <path d="M41 8 35 40" strokeWidth="2" />
      <path d="M40.2 11.5l.6-2.6" stroke={W} strokeWidth="0.9" />
      <path d="M30 24c4 0 6-6 10-13" fill="none" stroke="#be185d" />
    </>
  ),
  generic: (
    <>
      <path d="M24 13c0-2 1-3 3-4 2-1 2-4 0-5-2-1-4 0-4 2" fill="none" strokeWidth="1.8" />
      <path d="M24 13 8 28c-1 1 0 3 2 3h28c2 0 3-2 2-3Z" fill="#e2e8f0" />
      <path d="M12 31h24" />
    </>
  ),
};

export function GarmentIcon({ name, icon, className, title }: { name: string; icon?: string | null; className?: string; title?: string }) {
  const key = garmentIconFor(name, icon);
  return (
    <svg viewBox="0 0 48 48" className={cn('size-10 shrink-0', className)} role="img" aria-label={title ?? name}>
      <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        {ICONS[key]}
      </g>
    </svg>
  );
}
