import AsyncStorage from '@react-native-async-storage/async-storage';
import type {PrinterConnection} from './zebraPrinter';

const STORAGE_KEY = 'printerSettings';

export type PrinterSettings = {
  connection: PrinterConnection;
  networkIp: string;
  selectedRemotePrinterId: string;
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  connection: 'usb',
  networkIp: '',
  selectedRemotePrinterId: '',
};

function normalizePrinterSettings(value: unknown): PrinterSettings {
  if (!value || typeof value !== 'object') {
    return {...DEFAULT_PRINTER_SETTINGS};
  }

  const stored = value as {
    connection?: unknown;
    networkIp?: unknown;
    selectedRemotePrinterId?: unknown;
  };
  const connection: PrinterConnection =
    stored.connection === 'network' ? 'network' : 'usb';
  const networkIp =
    typeof stored.networkIp === 'string' ? stored.networkIp.trim() : '';
  const selectedRemotePrinterId =
    typeof stored.selectedRemotePrinterId === 'string'
      ? stored.selectedRemotePrinterId.trim()
      : '';

  return {connection, networkIp, selectedRemotePrinterId};
}

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {...DEFAULT_PRINTER_SETTINGS};
    }

    return normalizePrinterSettings(JSON.parse(raw));
  } catch {
    return {...DEFAULT_PRINTER_SETTINGS};
  }
}

export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore persistence errors so printing still works offline.
  }
}
