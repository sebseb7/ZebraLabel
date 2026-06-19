import {printToRemotePrinter, type RemotePrinter} from './printerApi';
import {type ApiPrinterMode} from './printerMode';
import {
  sendZpl,
  ZebraPrinter,
  type PrinterConnection,
} from './zebraPrinter';

export type DispatchZplOptions = {
  zpl: string;
  apiMode: ApiPrinterMode;
  baseUrl: string;
  writeToken: string;
  selectedRemotePrinterId: string;
  remotePrinters: RemotePrinter[];
  connection: PrinterConnection;
  networkIp: string;
};

export async function dispatchZpl(options: DispatchZplOptions): Promise<string> {
  const {
    zpl,
    apiMode,
    baseUrl,
    writeToken,
    selectedRemotePrinterId,
    remotePrinters,
    connection,
    networkIp,
  } = options;

  if (apiMode === 'client') {
    const printerId =
      selectedRemotePrinterId.trim() || remotePrinters[0]?.id || '';
    if (!printerId) {
      throw new Error('No remote printer available');
    }

    const result = await printToRemotePrinter(
      baseUrl,
      writeToken,
      printerId,
      zpl,
    );
    if (!result.ok) {
      throw new Error(result.error || 'Remote print failed');
    }

    return result.jobId;
  }

  if (apiMode === 'agent' || connection === 'usb') {
    return ZebraPrinter.printZpl(zpl);
  }

  return sendZpl(zpl, connection, networkIp);
}
