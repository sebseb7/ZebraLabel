import {errorMessage} from './appUtils';

export class PriceApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceApiError';
  }
}

export function normalizePriceApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function isPriceApiConfigured(baseUrl: string): boolean {
  return normalizePriceApiBaseUrl(baseUrl).length > 0;
}

function priceEndpoint(baseUrl: string, barcode: string): string {
  return `${normalizePriceApiBaseUrl(baseUrl)}/prices/${encodeURIComponent(barcode)}`;
}

type PriceResponse = {
  price?: unknown;
};

function readPriceValue(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const price = (data as PriceResponse).price;
  if (price == null || price === '') {
    return null;
  }

  return String(price);
}

export async function fetchPriceByBarcode(
  baseUrl: string,
  barcode: string,
): Promise<string | null> {
  try {
    const response = await fetch(priceEndpoint(baseUrl, barcode), {
      method: 'GET',
      headers: {Accept: 'application/json'},
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new PriceApiError(`Price lookup failed (${response.status})`);
    }

    return readPriceValue(await response.json());
  } catch (error) {
    if (error instanceof PriceApiError) {
      throw error;
    }

    throw new PriceApiError(errorMessage(error));
  }
}

export async function savePriceByBarcode(
  baseUrl: string,
  barcode: string,
  price: string,
): Promise<void> {
  try {
    const response = await fetch(priceEndpoint(baseUrl, barcode), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({price}),
    });

    if (!response.ok) {
      throw new PriceApiError(`Failed to save price (${response.status})`);
    }
  } catch (error) {
    if (error instanceof PriceApiError) {
      throw error;
    }

    throw new PriceApiError(errorMessage(error));
  }
}
