import {isPriceApiConfigured} from './priceApi';

export type ApiPrinterMode = 'off' | 'agent' | 'client';

export function resolveApiPrinterMode(
  baseUrl: string,
  token: string,
  hasLocalUsb: boolean,
): ApiPrinterMode {
  if (!isPriceApiConfigured(baseUrl, token)) {
    return 'off';
  }

  return hasLocalUsb ? 'agent' : 'client';
}
