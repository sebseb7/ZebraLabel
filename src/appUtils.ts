import type {LabelOffset} from './buildZpl';

export const MAX_DIGITS = 8;

export const ZERO_OFFSET: LabelOffset = {xMm: 0, yMm: 0};

export function formatPrice(digits: string) {
  const cleanDigits = digits.replace(/\D/g, '');
  const cents = cleanDigits.slice(-2).padStart(2, '0');
  const euros = cleanDigits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  return `${euros},${cents}`;
}

export function digitsToDecimalPrice(digits: string): string {
  const cleanDigits = digits.replace(/\D/g, '');
  if (!cleanDigits) {
    return '';
  }

  const cents = cleanDigits.slice(-2).padStart(2, '0');
  const euros = cleanDigits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  return `${euros}.${cents}`;
}

export function decimalPriceToDigits(price: string): string {
  const normalized = price.trim().replace(/\s/g, '');
  const decimalMatch = normalized.match(/^(\d+)[.,](\d{1,2})$/);

  if (decimalMatch) {
    const digits = `${decimalMatch[1]}${decimalMatch[2].padEnd(2, '0')}`;
    return digits.replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
  }

  return normalized.replace(/\D/g, '').slice(0, MAX_DIGITS);
}

export function barcodeValueToDigits(raw: string): string {
  const normalized = raw.trim().replace(/\s/g, '');
  const decimalMatch = normalized.match(/^[^\d]*(\d+)[.,](\d{1,2})[^\d]*$/);

  if (decimalMatch) {
    const digits = `${decimalMatch[1]}${decimalMatch[2].padEnd(2, '0')}`;
    return digits.replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
  }

  return normalized.replace(/\D/g, '').slice(0, MAX_DIGITS);
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

export function sameUsbPrinters<T extends {
  name: string;
  vendorId: number;
  productId: number;
  hasPermission: boolean;
}>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (printer, index) =>
      printer.name === right[index].name &&
      printer.vendorId === right[index].vendorId &&
      printer.productId === right[index].productId &&
      printer.hasPermission === right[index].hasPermission,
  );
}
