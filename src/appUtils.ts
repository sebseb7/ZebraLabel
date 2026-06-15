import type {LabelOffset} from './buildZpl';

export const MAX_DIGITS = 8;

export const ZERO_OFFSET: LabelOffset = {xMm: 0, yMm: 0};

export function formatPrice(digits: string) {
  const cleanDigits = digits.replace(/\D/g, '');
  const cents = cleanDigits.slice(-2).padStart(2, '0');
  const euros = cleanDigits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  return `${euros},${cents}`;
}

export function formatOffsetMm(mm: number): string {
  const absolute = Math.abs(mm);
  const formatted = Number.isInteger(absolute)
    ? String(absolute)
    : absolute.toFixed(1).replace('.', ',');
  const prefix = mm > 0 ? '+' : mm < 0 ? '−' : '';
  return `${prefix}${formatted} mm`;
}

export function hasActiveOffset(offset: LabelOffset) {
  return offset.xMm !== 0 || offset.yMm !== 0;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as {message?: unknown}).message);
  }

  return String(error);
}
