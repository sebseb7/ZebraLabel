import {NativeModules} from 'react-native';

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
};

export const ZebraPrinter = NativeModules.ZebraPrinter as ZebraPrinterModule;
