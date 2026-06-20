import {errorMessage} from './appUtils';
import {normalizePriceApiBaseUrl, normalizeApiToken} from './priceApi';
import {openSseConnection, type SseEvent} from './sseClient';

export class PrinterApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrinterApiError';
  }
}

export type RemotePrinter = {
  id: string;
  name: string;
  connectedAt: string;
};

function authHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${normalizeApiToken(token)}`,
  };
}

function printerBaseUrl(baseUrl: string): string {
  return `${normalizePriceApiBaseUrl(baseUrl)}/api/v1/printer`;
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

function normalizeRemotePrinter(value: unknown): RemotePrinter | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const printer = value as {id?: unknown; name?: unknown; connectedAt?: unknown};
  const id = typeof printer.id === 'string' ? printer.id.trim() : '';
  const name = typeof printer.name === 'string' ? printer.name.trim() : '';
  const connectedAt =
    typeof printer.connectedAt === 'string' ? printer.connectedAt.trim() : '';

  if (!id || !name) {
    return null;
  }

  return {id, name, connectedAt};
}

function normalizeRemotePrinters(data: unknown): RemotePrinter[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const printers = (data as {printers?: unknown}).printers;
  if (!Array.isArray(printers)) {
    return [];
  }

  return printers
    .map(normalizeRemotePrinter)
    .filter((printer): printer is RemotePrinter => printer !== null);
}

export async function fetchRemotePrinters(
  baseUrl: string,
  token: string,
): Promise<RemotePrinter[]> {
  try {
    const response = await fetch(`${printerBaseUrl(baseUrl)}/printers`, {
      method: 'GET',
      headers: authHeaders(token),
    });

    if (!response.ok) {
      throw new PrinterApiError(await readApiError(response));
    }

    return normalizeRemotePrinters(await response.json());
  } catch (error) {
    if (error instanceof PrinterApiError) {
      throw error;
    }

    throw new PrinterApiError(errorMessage(error));
  }
}

export type RemotePrintResult = {
  jobId: string;
  printerId: string;
  ok: boolean;
  error: string | null;
};

export async function printToRemotePrinter(
  baseUrl: string,
  token: string,
  printerId: string,
  zpl: string,
): Promise<RemotePrintResult> {
  try {
    const response = await fetch(`${printerBaseUrl(baseUrl)}/print`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({printerId, zpl}),
    });

    if (!response.ok) {
      throw new PrinterApiError(await readApiError(response));
    }

    const data = (await response.json()) as {
      jobId?: unknown;
      printerId?: unknown;
      ok?: unknown;
      error?: unknown;
    };

    const ok = data.ok === true;
    const error =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : ok
          ? null
          : 'Print failed';

    return {
      jobId: typeof data.jobId === 'string' ? data.jobId : '',
      printerId: typeof data.printerId === 'string' ? data.printerId : printerId,
      ok,
      error,
    };
  } catch (error) {
    if (error instanceof PrinterApiError) {
      throw error;
    }

    throw new PrinterApiError(errorMessage(error));
  }
}

export async function acknowledgeAgentPrint(
  baseUrl: string,
  token: string,
  printerId: string,
  jobId: string,
  ok: boolean,
  ackError?: string,
): Promise<void> {
  try {
    const body: Record<string, unknown> = {printerId, jobId, ok};
    if (!ok && ackError) {
      body.error = ackError;
    }

    const response = await fetch(`${printerBaseUrl(baseUrl)}/agent/ack`, {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new PrinterApiError(await readApiError(response));
    }
  } catch (error) {
    if (error instanceof PrinterApiError) {
      throw error;
    }

    throw new PrinterApiError(errorMessage(error));
  }
}

export type PrinterEventsHandlers = {
  onPrinters: (printers: RemotePrinter[]) => void;
  onPrinterOnline?: (printer: {printerId: string; name: string}) => void;
  onPrinterOffline?: (printer: {printerId: string; name?: string}) => void;
  onError?: (error: Error) => void;
};

function handlePrinterSseEvent(
  sseEvent: SseEvent,
  handlers: PrinterEventsHandlers,
): void {
  const {event, data} = sseEvent;

  if (event === 'printers') {
    handlers.onPrinters(normalizeRemotePrinters(data));
    return;
  }

  if (!data || typeof data !== 'object') {
    return;
  }

  if (event === 'printer_online') {
    const payload = data as {printerId?: unknown; name?: unknown};
    const printerId =
      typeof payload.printerId === 'string' ? payload.printerId : '';
    const name = typeof payload.name === 'string' ? payload.name : '';
    if (printerId) {
      handlers.onPrinterOnline?.({printerId, name});
    }
    return;
  }

  if (event === 'printer_offline') {
    const payload = data as {printerId?: unknown; name?: unknown};
    const printerId =
      typeof payload.printerId === 'string' ? payload.printerId : '';
    const name = typeof payload.name === 'string' ? payload.name : undefined;
    if (printerId) {
      handlers.onPrinterOffline?.({printerId, name});
    }
  }
}

export function subscribePrinterEvents(
  baseUrl: string,
  token: string,
  handlers: PrinterEventsHandlers,
): () => void {
  const url = `${printerBaseUrl(baseUrl)}/events`;

  return openSseConnection({
    url,
    headers: authHeaders(token),
    onEvent: event => handlePrinterSseEvent(event, handlers),
    onError: error => handlers.onError?.(error),
    onClose: () => handlers.onError?.(new Error('Printer events disconnected')),
  });
}

export function connectPrinterAgentStream(
  baseUrl: string,
  token: string,
  agentName: string,
  onEvent: (event: SseEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  const encodedName = encodeURIComponent(agentName.trim() || 'zebra-label');
  const url = `${printerBaseUrl(baseUrl)}/agent?name=${encodedName}`;

  return openSseConnection({
    url,
    headers: authHeaders(token),
    onEvent,
    onError,
    onClose: () => onError?.(new Error('Printer agent disconnected')),
  });
}
