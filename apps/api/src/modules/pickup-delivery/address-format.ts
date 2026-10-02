export function formatAddress(a: {
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string {
  return [a.addressLine1, a.addressLine2, a.landmark ? `Near ${a.landmark}` : null, [a.city, a.postalCode].filter(Boolean).join(' ')]
    .filter((p) => p && String(p).trim())
    .join(', ');
}
