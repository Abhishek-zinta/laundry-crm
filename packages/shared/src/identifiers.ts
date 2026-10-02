/** Normalises a phone number for storage/search: keeps digits and a leading "+". */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Digits only — used for "contains" phone search so "+91 98765" matches "9876543210". */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

export function formatOrderNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

export function formatTagCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export type SearchKind = 'order' | 'tag' | 'phone' | 'text';

const ORDER_NUMBER_RE = /^[a-z]{1,8}-\d{4}-\d{1,9}$/i;
const TAG_CODE_RE = /^[a-z]{1,8}-\d{1,9}$/i;
const PHONE_RE = /^\+?[\d\s\-()]{3,20}$/;

/** Classifies a free-text search so the API can prioritise the right entity. */
export function classifySearch(query: string): SearchKind {
  const q = query.trim();
  if (ORDER_NUMBER_RE.test(q)) return 'order';
  if (TAG_CODE_RE.test(q)) return 'tag';
  if (PHONE_RE.test(q) && phoneDigits(q).length >= 3) return 'phone';
  return 'text';
}

export function customerDisplayName(c: { firstName: string; lastName?: string | null }): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ');
}
