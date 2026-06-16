import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'priceApiSettings';

export type PriceApiSettings = {
  baseUrl: string;
};

export const DEFAULT_PRICE_API_SETTINGS: PriceApiSettings = {
  baseUrl: '',
};

function normalizePriceApiSettings(value: unknown): PriceApiSettings {
  if (!value || typeof value !== 'object') {
    return {...DEFAULT_PRICE_API_SETTINGS};
  }

  const stored = value as {baseUrl?: unknown};
  const baseUrl = typeof stored.baseUrl === 'string' ? stored.baseUrl.trim() : '';

  return {baseUrl};
}

export async function loadPriceApiSettings(): Promise<PriceApiSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {...DEFAULT_PRICE_API_SETTINGS};
    }

    return normalizePriceApiSettings(JSON.parse(raw));
  } catch {
    return {...DEFAULT_PRICE_API_SETTINGS};
  }
}

export async function savePriceApiSettings(settings: PriceApiSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore persistence errors so printing still works offline.
  }
}
