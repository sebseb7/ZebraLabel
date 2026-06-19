import {errorMessage} from './appUtils';
import {
  acknowledgeAgentPrint,
  connectPrinterAgentStream,
} from './printerApi';
import {sleep, type SseEvent} from './sseClient';
import {ZebraPrinter} from './zebraPrinter';

export type PrinterAgentStatus = {
  state: 'idle' | 'connecting' | 'connected' | 'error';
  printerId: string | null;
  agentName: string;
  message: string;
};

export type StartPrinterAgentOptions = {
  baseUrl: string;
  token: string;
  agentName?: string;
  onStatus?: (status: PrinterAgentStatus) => void;
};

const MAX_BACKOFF_MS = 30_000;

function defaultAgentName(): string {
  return 'zebra-label';
}

export function startPrinterAgent(options: StartPrinterAgentOptions): () => void {
  const agentName = options.agentName?.trim() || defaultAgentName();
  let stopped = false;
  let attempt = 0;
  let closeStream: (() => void) | null = null;
  let printerId: string | null = null;

  const report = (partial: Partial<PrinterAgentStatus>) => {
    options.onStatus?.({
      state: 'idle',
      printerId,
      agentName,
      message: '',
      ...partial,
    });
  };

  const handlePrint = async (jobId: string, zpl: string) => {
    if (!printerId) {
      return;
    }

    try {
      await ZebraPrinter.printZpl(zpl);
      await acknowledgeAgentPrint(
        options.baseUrl,
        options.token,
        printerId,
        jobId,
        true,
      );
      report({state: 'connected', message: `Printed job ${jobId}`});
    } catch (error) {
      const message = errorMessage(error);
      try {
        await acknowledgeAgentPrint(
          options.baseUrl,
          options.token,
          printerId,
          jobId,
          false,
          message,
        );
      } catch {
        // Best-effort ack; reconnect loop will recover.
      }
      report({state: 'connected', message: `Job ${jobId} failed: ${message}`});
    }
  };

  const handleEvent = (event: SseEvent) => {
    if (event.event === 'registered') {
      const data = event.data as {printerId?: unknown; name?: unknown};
      printerId =
        typeof data.printerId === 'string' ? data.printerId.trim() : null;
      const name =
        typeof data.name === 'string' && data.name.trim()
          ? data.name.trim()
          : agentName;
      report({
        state: 'connected',
        printerId,
        agentName: name,
        message: `Registered as ${name}`,
      });
      return;
    }

    if (event.event === 'print') {
      const data = event.data as {jobId?: unknown; zpl?: unknown};
      const jobId = typeof data.jobId === 'string' ? data.jobId : '';
      const zpl = typeof data.zpl === 'string' ? data.zpl : '';
      if (!jobId || !zpl) {
        return;
      }

      report({state: 'connected', message: `Printing job ${jobId}...`});
      handlePrint(jobId, zpl).catch(() => undefined);
    }
  };

  const connectOnce = async (): Promise<void> => {
    report({state: 'connecting', message: 'Connecting to printer agent...'});

    await new Promise<void>((resolve, reject) => {
      closeStream = connectPrinterAgentStream(
        options.baseUrl,
        options.token,
        agentName,
        handleEvent,
        error => {
          closeStream = null;
          reject(error);
        },
      );
    });
  };

  const run = async () => {
    while (!stopped) {
      try {
        attempt = 0;
        await connectOnce();
      } catch (error) {
        if (stopped) {
          break;
        }

        const message = errorMessage(error);
        report({state: 'error', message});

        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
        attempt += 1;
        await sleep(delay);
      }
    }
  };

  run().catch(() => undefined);

  return () => {
    stopped = true;
    closeStream?.();
    closeStream = null;
    printerId = null;
    report({state: 'idle', printerId: null, message: 'Agent stopped'});
  };
}
