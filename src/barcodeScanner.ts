import {NativeModules, Platform} from 'react-native';
import {errorMessage} from './appUtils';

type BarcodeScannerModule = {
  scan(): Promise<string>;
};

const NativeBarcodeScanner = NativeModules.BarcodeScanner as
  | BarcodeScannerModule
  | undefined;

export class BarcodeScanError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BarcodeScanError';
    this.code = code;
  }
}

function normalizeError(error: unknown): BarcodeScanError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as {code?: unknown}).code === 'string'
  ) {
    const nativeError = error as {code: string; message?: string};
    return new BarcodeScanError(
      nativeError.code,
      nativeError.message ?? 'Barcode scan failed',
    );
  }

  return new BarcodeScanError('E_SCAN_FAILED', errorMessage(error));
}

export function isBarcodeScanCanceled(error: unknown): boolean {
  return error instanceof BarcodeScanError && error.code === 'E_CANCELED';
}

export async function scanBarcode(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    throw new BarcodeScanError(
      'E_UNSUPPORTED',
      'Barcode scanning is only available on Android',
    );
  }

  if (!NativeBarcodeScanner?.scan) {
    throw new BarcodeScanError(
      'E_UNAVAILABLE',
      'Barcode scanner native module is not available',
    );
  }

  try {
    return await NativeBarcodeScanner.scan();
  } catch (error) {
    throw normalizeError(error);
  }
}
