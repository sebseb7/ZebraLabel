export function printerLog(message: string, data?: unknown): void {
  if (__DEV__) {
    if (data === undefined) {
      console.log(`[ZebraPrinter] ${message}`);
      return;
    }

    console.log(`[ZebraPrinter] ${message}`, data);
  }
}
