import {NativeModules} from 'react-native';

export type PrinterConnection = 'usb' | 'network';

export type ZebraUsbPrinter = {
  name: string;
  vendorId: number;
  productId: number;
  hasPermission: boolean;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
};

export type ZebraPrinterModule = {
  getUsbPrinters(): Promise<ZebraUsbPrinter[]>;
  printZpl(zpl: string): Promise<string>;
  printZplToNetwork(zpl: string, host: string): Promise<string>;
};

export const ZebraPrinter = NativeModules.ZebraPrinter as ZebraPrinterModule;

export async function sendZpl(
  zpl: string,
  connection: PrinterConnection,
  networkIp: string,
): Promise<string> {
  if (connection === 'network') {
    return ZebraPrinter.printZplToNetwork(zpl, networkIp.trim());
  }

  return ZebraPrinter.printZpl(zpl);
}
