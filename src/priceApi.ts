import {errorMessage} from './appUtils';

export class PriceApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceApiError';
  }
}

export type PriceApiQrConfig = {
  url: string;
  token: string;
};

export function normalizePriceApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function normalizeApiToken(token: string): string {
  let normalized = token.trim();

  while (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized.replace(/^["']+|["']+$/g, '').trim();
}

export function isPriceApiConfigured(baseUrl: string, token: string): boolean {
  return (
    normalizePriceApiBaseUrl(baseUrl).length > 0 &&
    normalizeApiToken(token).length > 0
  );
}

export function parsePriceApiQrPayload(raw: string): PriceApiQrConfig | null {
  try {
    const data = JSON.parse(raw.trim()) as {url?: unknown; token?: unknown};
    if (!data || typeof data !== 'object') {
      return null;
    }

    const url = typeof data.url === 'string' ? data.url.trim() : '';
    const token =
      typeof data.token === 'string' ? normalizeApiToken(data.token) : '';
    if (!url || !token) {
      return null;
    }

    return {url, token};
  } catch {
    return null;
  }
}

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${normalizeApiToken(token)}`,
  };
}

function priceReadEndpoint(baseUrl: string, barcode: string): string {
  const base = normalizePriceApiBaseUrl(baseUrl);
  return `${base}/api/v1/price?barcode=${encodeURIComponent(barcode)}`;
}

function priceWriteEndpoint(baseUrl: string): string {
  return `${normalizePriceApiBaseUrl(baseUrl)}/api/v1/price`;
}

type PriceReadResponse = {
  found?: boolean;
  price?: unknown;
};

function normalizeApiPrice(price: unknown): string | null {
  if (price == null || price === '') {
    return null;
  }

  if (typeof price === 'number') {
    return Number.isFinite(price) ? price.toFixed(2) : null;
  }

  const text = String(price).trim().replace(/\s/g, '');
  if (!text) {
    return null;
  }

  const numeric = Number(text.replace(',', '.'));
  if (Number.isFinite(numeric)) {
    return numeric.toFixed(2);
  }

  return null;
}

function readPriceValue(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const response = data as PriceReadResponse;
  if (response.found === false) {
    return null;
  }

  return normalizeApiPrice(response.price);
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {error?: unknown};
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Fall back to status text below.
  }

  return `Request failed (${response.status})`;
}

export async function fetchPriceByBarcode(
  baseUrl: string,
  token: string,
  barcode: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const response = await fetch(priceReadEndpoint(baseUrl, barcode), {
      method: 'GET',
      headers: authHeaders(token),
      signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new PriceApiError(await readApiError(response));
    }

    return readPriceValue(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    if (error instanceof PriceApiError) {
      throw error;
    }

    throw new PriceApiError(errorMessage(error));
  }
}

export async function savePriceByBarcode(
  baseUrl: string,
  token: string,
  barcode: string,
  price: string,
): Promise<void> {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) {
    throw new PriceApiError('Invalid price value');
  }

  try {
    const response = await fetch(priceWriteEndpoint(baseUrl), {
      method: 'PUT',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({barcode, price: numericPrice}),
    });

    if (!response.ok) {
      throw new PriceApiError(await readApiError(response));
    }
  } catch (error) {
    if (error instanceof PriceApiError) {
      throw error;
    }

    throw new PriceApiError(errorMessage(error));
  }
}
