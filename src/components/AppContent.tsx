import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, ScrollView, StatusBar, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  buildZpl,
  labelDescription,
  MAX_LABEL_OFFSET_MM,
  type LabelSizeId,
} from '../buildZpl';
import {
  DEFAULT_LABEL_OFFSETS,
  loadLabelOffsets,
  saveLabelOffsets,
} from '../labelOffsetStorage';
import {
  DEFAULT_PRINTER_SETTINGS,
  loadPrinterSettings,
  savePrinterSettings,
} from '../printerSettingsStorage';
import {styles} from '../appStyles';
import {
  DEFAULT_PRICE_API_SETTINGS,
  loadPriceApiSettings,
  savePriceApiSettings,
} from '../priceApiSettingsStorage';
import {savePriceByBarcode, isPriceApiConfigured} from '../priceApi';
import {clamp, digitsToDecimalPrice, errorMessage, sameUsbPrinters, ZERO_OFFSET} from '../appUtils';
import {LABEL_SIZES} from '../labelSizes';
import {dispatchZpl} from '../printDispatch';
import {printerLog} from '../printerLog';
import {
  fetchRemotePrinters,
  subscribePrinterEvents,
  type RemotePrinter,
} from '../printerApi';
import {
  resolveApiPrinterMode,
  type ApiPrinterMode,
} from '../printerMode';
import {
  startPrinterAgent,
  type PrinterAgentStatus,
} from '../printerAgent';
import {sleep} from '../sseClient';
import {
  ZebraPrinter,
  type PrinterConnection,
  type ZebraUsbPrinter,
} from '../zebraPrinter';
import {
  AppHeader,
  ApiSettingsModal,
  LabelSizeSection,
  PositionSection,
  PrinterSection,
} from './AppContentSections';
import {
  PriceDisplay,
  PriceInputProvider,
  PriceKeypad,
  type PrintMeta,
} from './PriceInputPanel';

const DEFAULT_AGENT_STATUS: PrinterAgentStatus = {
  state: 'idle',
  printerId: null,
  agentName: 'zebra-label',
  message: '',
};

function pickRemotePrinterId(
  printers: RemotePrinter[],
  currentId: string,
): string {
  if (currentId && printers.some(printer => printer.id === currentId)) {
    return currentId;
  }

  return printers[0]?.id ?? '';
}

export function AppContent() {
  const insets = useSafeAreaInsets();
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSizeId>('25x13');
  const [labelOffsets, setLabelOffsets] = useState(DEFAULT_LABEL_OFFSETS);
  const offsetsHydratedRef = useRef(false);
  const [showPositionAdjust, setShowPositionAdjust] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printers, setPrinters] = useState<ZebraUsbPrinter[]>([]);
  const [printerConnection, setPrinterConnection] = useState<PrinterConnection>(
    DEFAULT_PRINTER_SETTINGS.connection,
  );
  const [networkPrinterIp, setNetworkPrinterIp] = useState(
    DEFAULT_PRINTER_SETTINGS.networkIp,
  );
  const [selectedRemotePrinterId, setSelectedRemotePrinterId] = useState(
    DEFAULT_PRINTER_SETTINGS.selectedRemotePrinterId,
  );
  const printerSettingsHydratedRef = useRef(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [priceApiBaseUrl, setPriceApiBaseUrl] = useState(
    DEFAULT_PRICE_API_SETTINGS.baseUrl,
  );
  const [priceApiToken, setPriceApiToken] = useState(
    DEFAULT_PRICE_API_SETTINGS.token,
  );
  const priceApiSettingsHydratedRef = useRef(false);
  const [remotePrinters, setRemotePrinters] = useState<RemotePrinter[]>([]);
  const [agentStatus, setAgentStatus] =
    useState<PrinterAgentStatus>(DEFAULT_AGENT_STATUS);
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const agentNameRef = useRef('zebra-label');
  const agentStatusRef = useRef(DEFAULT_AGENT_STATUS);
  agentStatusRef.current = agentStatus;

  const hasLocalUsbPrinter = printers.length > 0;
  const apiPrinterMode: ApiPrinterMode = resolveApiPrinterMode(
    priceApiBaseUrl,
    priceApiToken,
    hasLocalUsbPrinter,
  );

  const labelSize = LABEL_SIZES.find(size => size.id === selectedLabelSize) ?? LABEL_SIZES[0];
  const currentOffset = labelOffsets[selectedLabelSize];

  const nudgeOffset = useCallback(
    (axis: 'xMm' | 'yMm', delta: number) => {
      setLabelOffsets(current => {
        const nextValue = clamp(
          current[selectedLabelSize][axis] + delta,
          -MAX_LABEL_OFFSET_MM,
          MAX_LABEL_OFFSET_MM,
        );

        return {
          ...current,
          [selectedLabelSize]: {
            ...current[selectedLabelSize],
            [axis]: nextValue,
          },
        };
      });
    },
    [selectedLabelSize],
  );

  const resetOffset = useCallback(() => {
    setLabelOffsets(current => ({
      ...current,
      [selectedLabelSize]: {...ZERO_OFFSET},
    }));
  }, [selectedLabelSize]);

  useEffect(() => {
    let cancelled = false;

    loadLabelOffsets().then(storedOffsets => {
      if (cancelled) {
        return;
      }

      setLabelOffsets(storedOffsets);
      offsetsHydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!offsetsHydratedRef.current) {
      return;
    }

    saveLabelOffsets(labelOffsets);
  }, [labelOffsets]);

  useEffect(() => {
    let cancelled = false;

    loadPrinterSettings().then(storedSettings => {
      if (cancelled) {
        return;
      }

      setPrinterConnection(storedSettings.connection);
      setNetworkPrinterIp(storedSettings.networkIp);
      setSelectedRemotePrinterId(storedSettings.selectedRemotePrinterId);
      printerSettingsHydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!printerSettingsHydratedRef.current) {
      return;
    }

    savePrinterSettings({
      connection: printerConnection,
      networkIp: networkPrinterIp,
      selectedRemotePrinterId,
    });
  }, [networkPrinterIp, printerConnection, selectedRemotePrinterId]);

  useEffect(() => {
    let cancelled = false;

    loadPriceApiSettings().then(storedSettings => {
      if (cancelled) {
        return;
      }

      setPriceApiBaseUrl(storedSettings.baseUrl);
      setPriceApiToken(storedSettings.token);
      priceApiSettingsHydratedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!priceApiSettingsHydratedRef.current) {
      return;
    }

    savePriceApiSettings({baseUrl: priceApiBaseUrl, token: priceApiToken});
  }, [priceApiBaseUrl, priceApiToken]);

  const updateRemotePrinters = useCallback((nextPrinters: RemotePrinter[]) => {
    setRemotePrinters(nextPrinters);
    setSelectedRemotePrinterId(current =>
      pickRemotePrinterId(nextPrinters, current),
    );
  }, []);

  const refreshUsbPrinters = useCallback(async (): Promise<ZebraUsbPrinter[]> => {
    try {
      const discoveredPrinters = await ZebraPrinter.getUsbPrinters();
      const firstPrinter = discoveredPrinters[0];
      if (firstPrinter) {
        const name =
          firstPrinter.productName?.trim() || firstPrinter.name?.trim();
        if (name) {
          agentNameRef.current = name;
        }
      }
      setPrinters(current =>
        sameUsbPrinters(current, discoveredPrinters)
          ? current
          : discoveredPrinters,
      );
      return discoveredPrinters;
    } catch (error) {
      throw error;
    }
  }, []);

  const refreshPrinters = useCallback(async () => {
    let usbPrinters: ZebraUsbPrinter[] = [];

    try {
      usbPrinters = await refreshUsbPrinters();
    } catch (error) {
      setStatus(errorMessage(error));
    }

    const activeMode = resolveApiPrinterMode(
      priceApiBaseUrl,
      priceApiToken,
      usbPrinters.length > 0,
    );

    if (activeMode === 'client') {
      printerLog('refreshPrinters client mode', {
        baseUrl: priceApiBaseUrl,
        tokenPrefix: priceApiToken.slice(0, 8),
      });
      try {
        const discoveredPrinters = await fetchRemotePrinters(
          priceApiBaseUrl,
          priceApiToken,
        );
        printerLog('fetchRemotePrinters result', {
          count: discoveredPrinters.length,
          printers: discoveredPrinters,
        });
        updateRemotePrinters(discoveredPrinters);
        setStatus(
          discoveredPrinters.length > 0
            ? `Found ${discoveredPrinters.length} remote printer${
                discoveredPrinters.length === 1 ? '' : 's'
              }`
            : 'No remote printer online',
        );
      } catch (error) {
        printerLog('fetchRemotePrinters failed', errorMessage(error));
        setStatus(errorMessage(error));
      }
      return;
    }

    if (activeMode === 'agent') {
      const currentAgentStatus = agentStatusRef.current;
      setStatus(
        currentAgentStatus.state === 'connected'
          ? `Printer agent · ${currentAgentStatus.agentName}`
          : currentAgentStatus.message || 'Printer agent starting...',
      );
      return;
    }

    if (printerConnection !== 'usb') {
      setStatus(
        networkPrinterIp.trim()
          ? `Network printer: ${networkPrinterIp.trim()}`
          : 'Enter the printer IP address',
      );
      return;
    }

    setStatus(
      usbPrinters.length > 0
        ? `Found ${usbPrinters.length} USB Zebra printer${
            usbPrinters.length === 1 ? '' : 's'
          }`
        : 'No USB Zebra printer found',
    );
  }, [
    networkPrinterIp,
    priceApiBaseUrl,
    priceApiToken,
    printerConnection,
    refreshUsbPrinters,
    updateRemotePrinters,
  ]);

  useEffect(() => {
    refreshUsbPrinters().catch(() => undefined);
  }, [refreshUsbPrinters]);

  useEffect(() => {
    if (apiPrinterMode !== 'agent') {
      setAgentStatus(DEFAULT_AGENT_STATUS);
      return;
    }

    const stopAgent = startPrinterAgent({
      baseUrl: priceApiBaseUrl,
      token: priceApiToken,
      agentName: agentNameRef.current,
      onStatus: nextStatus => {
        agentStatusRef.current = nextStatus;
        setAgentStatus(nextStatus);
      },
    });

    return stopAgent;
  }, [apiPrinterMode, priceApiBaseUrl, priceApiToken]);

  useEffect(() => {
    printerLog('apiPrinterMode', {
      mode: apiPrinterMode,
      usbCount: printers.length,
      remoteCount: remotePrinters.length,
    });
  }, [apiPrinterMode, printers.length, remotePrinters.length]);

  useEffect(() => {
    if (apiPrinterMode !== 'client') {
      setRemotePrinters([]);
      return;
    }

    printerLog('starting client printer subscription', {baseUrl: priceApiBaseUrl});

    let stopped = false;
    let reconnectAttempt = 0;
    let closeEvents: (() => void) | null = null;

    const refreshSnapshot = async () => {
      try {
        const discoveredPrinters = await fetchRemotePrinters(
          priceApiBaseUrl,
          priceApiToken,
        );
        if (!stopped) {
          printerLog('fetchRemotePrinters snapshot', {
            count: discoveredPrinters.length,
            printers: discoveredPrinters,
          });
          updateRemotePrinters(discoveredPrinters);
        }
      } catch (error) {
        if (!stopped) {
          printerLog('fetchRemotePrinters snapshot failed', errorMessage(error));
          setStatus(errorMessage(error));
        }
      }
    };

    const connectEvents = () => {
      closeEvents?.();
      closeEvents = subscribePrinterEvents(
        priceApiBaseUrl,
        priceApiToken,
        {
          onPrinters: nextPrinters => {
            reconnectAttempt = 0;
            printerLog('SSE printers event', {count: nextPrinters.length, nextPrinters});
            updateRemotePrinters(nextPrinters);
          },
          onPrinterOnline: ({printerId, name}) => {
            setRemotePrinters(current => {
              if (current.some(printer => printer.id === printerId)) {
                return current;
              }

              const next = [
                ...current,
                {
                  id: printerId,
                  name: name || printerId,
                  connectedAt: new Date().toISOString(),
                },
              ];
              setSelectedRemotePrinterId(selected =>
                pickRemotePrinterId(next, selected),
              );
              return next;
            });
          },
          onPrinterOffline: ({printerId}) => {
            setRemotePrinters(current => {
              const next = current.filter(printer => printer.id !== printerId);
              setSelectedRemotePrinterId(selected =>
                pickRemotePrinterId(next, selected),
              );
              return next;
            });
          },
          onError: error => {
            printerLog('SSE printer events error', error.message);
            if (stopped) {
              return;
            }

            closeEvents?.();
            closeEvents = null;
            const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
            reconnectAttempt += 1;
            sleep(delay).then(() => {
              if (!stopped) {
                connectEvents();
              }
            });
          },
        },
      );
    };

    refreshSnapshot().catch(() => undefined);
    connectEvents();

    return () => {
      stopped = true;
      closeEvents?.();
    };
  }, [apiPrinterMode, priceApiBaseUrl, priceApiToken, updateRemotePrinters]);

  const postPriceToApi = useCallback(
    async (meta: PrintMeta | undefined): Promise<string | null> => {
      if (
        !meta?.postPriceToApi ||
        !meta.barcode ||
        !meta.priceDigits ||
        !isPriceApiConfigured(priceApiBaseUrl, priceApiToken)
      ) {
        return null;
      }

      try {
        const decimalPrice = digitsToDecimalPrice(meta.priceDigits);
        await savePriceByBarcode(
          priceApiBaseUrl,
          priceApiToken,
          meta.barcode,
          decimalPrice,
        );
        return `saved price for ${meta.barcode}`;
      } catch (error) {
        return `API save failed: ${errorMessage(error)}`;
      }
    },
    [priceApiBaseUrl, priceApiToken],
  );

  const printZpl = useCallback(
    async (zpl: string) => {
      return dispatchZpl({
        zpl,
        apiMode: apiPrinterMode,
        baseUrl: priceApiBaseUrl,
        writeToken: priceApiToken,
        selectedRemotePrinterId,
        remotePrinters,
        connection: printerConnection,
        networkIp: networkPrinterIp,
      });
    },
    [
      apiPrinterMode,
      networkPrinterIp,
      priceApiBaseUrl,
      priceApiToken,
      printerConnection,
      remotePrinters,
      selectedRemotePrinterId,
    ],
  );

  const handlePrint = useCallback(
    async (price: string, meta?: PrintMeta) => {
      setIsBusy(true);

      const apiNote = await postPriceToApi(meta);
      setStatus(`Printing ${labelSize.title} ${labelSize.subtitle} label...`);

      try {
        const zpl = buildZpl(price, selectedLabelSize, currentOffset);
        await printZpl(zpl);
        const labelText = labelDescription(selectedLabelSize);
        setStatus(
          apiNote
            ? `Printed ${price} on ${labelText} · ${apiNote}`
            : `Printed ${price} on ${labelText}`,
        );
      } catch (error) {
        const message = errorMessage(error);
        setStatus(apiNote ? `${message} · ${apiNote}` : message);
        Alert.alert('Print failed', message);
      } finally {
        setIsBusy(false);
        refreshPrinters();
      }
    },
    [
      currentOffset,
      labelSize.subtitle,
      labelSize.title,
      postPriceToApi,
      printZpl,
      refreshPrinters,
      selectedLabelSize,
    ],
  );

  const handlePrintMany = useCallback(
    async (price: string, count: number, meta?: PrintMeta) => {
      setIsBusy(true);

      const apiNote = await postPriceToApi(meta);
      setStatus(`Printing ${count}× ${labelSize.title} ${labelSize.subtitle} labels...`);

      try {
        const zpl = buildZpl(price, selectedLabelSize, currentOffset, count);
        await printZpl(zpl);
        const labelText = labelDescription(selectedLabelSize);
        setStatus(
          apiNote
            ? `Printed ${count}× ${price} on ${labelText} · ${apiNote}`
            : `Printed ${count}× ${price} on ${labelText}`,
        );
        return true;
      } catch (error) {
        const message = errorMessage(error);
        setStatus(apiNote ? `${message} · ${apiNote}` : message);
        Alert.alert('Print failed', message);
        return apiNote?.startsWith('saved') ?? false;
      } finally {
        setIsBusy(false);
        refreshPrinters();
      }
    },
    [
      currentOffset,
      labelSize.subtitle,
      labelSize.title,
      postPriceToApi,
      printZpl,
      refreshPrinters,
      selectedLabelSize,
    ],
  );

  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  useEffect(() => {
    if (apiPrinterMode !== 'agent') {
      return;
    }

    setStatus(
      agentStatus.state === 'connected'
        ? `Printer agent · ${agentStatus.agentName}`
        : agentStatus.message || 'Printer agent starting...',
    );
  }, [agentStatus, apiPrinterMode]);

  const togglePositionAdjust = useCallback(() => {
    setShowPositionAdjust(current => !current);
  }, []);

  const togglePrinterSettings = useCallback(() => {
    setShowPrinterSettings(current => !current);
  }, []);

  const nudgeX = useCallback((delta: number) => nudgeOffset('xMm', delta), [nudgeOffset]);
  const nudgeY = useCallback((delta: number) => nudgeOffset('yMm', delta), [nudgeOffset]);

  const priceApi = useMemo(
    () => ({baseUrl: priceApiBaseUrl, token: priceApiToken}),
    [priceApiBaseUrl, priceApiToken],
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3eb" />
      <PriceInputProvider
        isBusy={isBusy}
        priceApi={priceApi}
        onPrint={handlePrint}
        onPrintMany={handlePrintMany}
        onStatus={setStatus}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}>
          <AppHeader onOpenSettings={() => setShowApiSettings(true)} />
          <PriceDisplay />
          <LabelSizeSection
            selectedLabelSize={selectedLabelSize}
            onSelect={setSelectedLabelSize}
          />
          <PositionSection
            showPositionAdjust={showPositionAdjust}
            currentOffset={currentOffset}
            onToggleAdjust={togglePositionAdjust}
            onReset={resetOffset}
            onNudgeX={nudgeX}
            onNudgeY={nudgeY}
          />
          <PrinterSection
            apiMode={apiPrinterMode}
            agentStatus={agentStatus}
            showPrinterSettings={showPrinterSettings}
            connection={printerConnection}
            networkIp={networkPrinterIp}
            status={status}
            printers={printers}
            remotePrinters={remotePrinters}
            selectedRemotePrinterId={selectedRemotePrinterId}
            isBusy={isBusy}
            onToggleSettings={togglePrinterSettings}
            onConnectionChange={setPrinterConnection}
            onNetworkIpChange={setNetworkPrinterIp}
            onSelectRemotePrinter={setSelectedRemotePrinterId}
            onRefresh={refreshPrinters}
          />
          <PriceKeypad />
        </ScrollView>
      </PriceInputProvider>
      <ApiSettingsModal
        visible={showApiSettings}
        apiBaseUrl={priceApiBaseUrl}
        apiToken={priceApiToken}
        onApiBaseUrlChange={setPriceApiBaseUrl}
        onApiTokenChange={setPriceApiToken}
        onClose={() => setShowApiSettings(false)}
      />
    </View>
  );
}
