export function printerLog(message: string, data?: unknown): void {
  if (__DEV__) {
    if (data === undefined) {
      console.log(`[ZebraPrinter] ${message}`);
      return;
    }

    console.log(`[ZebraPrinter] ${message}`, data);
  }
}

export function logFailedZpl(zpl: string, reason?: string): void {
  if (reason) {
    console.warn(`[ZebraLabel] Print failed: ${reason}`);
  } else {
    console.warn('[ZebraLabel] Print failed');
  }

  if (zpl) {
    console.warn('[ZebraLabel] ZPL:\n', zpl);
  }
}
