// נוצר אוטומטית מ-packages/core/src על ידי scripts/sync-core.mjs. לא לערוך כאן.
// מנוע קלוריות (אפיון 2.3). ברוטו, מכויל ל-Frappier 2013, מוצג כטווח ±30%.

import type { Intensity } from './types.ts';

/** קק"ל לק"ג לשעה. */
export const COEFF: Record<Intensity | 'warmup', number> = {
  warmup: 1.8,
  recovery: 1.8,
  balanced: 3.3,
  high: 4.5,
};

export interface Segment {
  minutes: number;
  level: Intensity | 'warmup';
  /** מכפיל קצב: רק למי שמניע. למייצב תמיד 1. */
  im?: number;
}

export function kcal(weightKg: number, segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + COEFF[s.level] * weightKg * (s.minutes / 60) * (s.im ?? 1), 0);
}

/** IM לפי קצב המטרונום: 0.8 בקצב המינימלי, 1.2 במקסימלי. */
export function tempoMultiplier(bpm: number, min: number, max: number): number {
  if (max <= min) return 1;
  const t = Math.min(1, Math.max(0, (bpm - min) / (max - min)));
  return Math.round((0.8 + 0.4 * t) * 100) / 100;
}

const round5 = (x: number) => Math.round(x / 5) * 5;

/** הטווח שמוצג למשתמש: "כ-75–135 קק"ל". */
export function displayRange(value: number): { low: number; high: number } {
  return { low: round5(value * 0.7), high: round5(value * 1.3) };
}
