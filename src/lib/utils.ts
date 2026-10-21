import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Kalenderdatum in Ortszeit als `YYYY-MM-DD`. Anders als `toISOString()` (UTC)
 * liefert es zwischen 0 und 2 Uhr deutscher Zeit nicht den Vortag.
 */
export function lokalesDatum(datum: Date | number = new Date()): string {
  const d = new Date(datum);
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}
