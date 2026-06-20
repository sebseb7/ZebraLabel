import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {styles} from '../appStyles';
import {
  barcodeValueToDigits,
  decimalPriceToDigits,
  formatPrice,
  getEanValidation,
  MAX_DIGITS,
} from '../appUtils';
import {isBarcodeScanCanceled, scanBarcode} from '../barcodeScanner';
import {fetchPriceByBarcode, isPriceApiConfigured} from '../priceApi';
import type {PriceApiSettings} from '../priceApiSettingsStorage';
import {BarcodeIcon} from './BarcodeIcon';
import {Key} from './Key';

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const MAX_PRINT_COUNT_DIGITS = 4;

function barcodeApiStatusLabel(lookup: BarcodeApiLookupState): string {
  switch (lookup.status) {
    case 'loading':
      return 'Looking up...';
    case 'found':
      return lookup.price;
    case 'not_found':
      return 'Not in API';
    case 'error':
      return lookup.message;
  }
}

function barcodeApiStatusStyle(lookup: BarcodeApiLookupState) {
  switch (lookup.status) {
    case 'loading':
      return styles.barcodeApiStatusLoading;
    case 'found':
      return styles.barcodeApiStatusFound;
    case 'not_found':
      return styles.barcodeApiStatusNotFound;
    case 'error':
      return styles.barcodeApiStatusError;
  }
}

export type PrintMeta = {
  barcode?: string;
  postPriceToApi?: boolean;
  priceDigits?: string;
};

export type BarcodeApiLookupState =
  | {status: 'loading'}
  | {status: 'found'; price: string}
  | {status: 'not_found'}
  | {status: 'error'; message: string};

type PriceInputContextValue = {
  price: string;
  pendingBarcode: string | null;
  barcodeApiLookup: BarcodeApiLookupState | null;
  printManyMode: boolean;
  printCount: string;
  isBusy: boolean;
  appendDigit: (digit: string) => void;
  backspace: () => void;
  clear: () => void;
  resolveBarcodeScan: (rawValue: string) => Promise<void>;
  showStatus: (status: string) => void;
  handlePrint: () => void;
  handlePrintMany: () => void;
};

const PriceInputContext = createContext<PriceInputContextValue | null>(null);

function usePriceInput() {
  const value = useContext(PriceInputContext);
  if (!value) {
    throw new Error('Price input components must be used within PriceInputProvider');
  }
  return value;
}

export type PriceInputProviderProps = {
  isBusy: boolean;
  priceApi: PriceApiSettings;
  onPrint: (price: string, meta?: PrintMeta) => Promise<void>;
  onPrintMany: (price: string, count: number, meta?: PrintMeta) => Promise<boolean>;
  onStatus: (status: string) => void;
  children: ReactNode;
};

export function PriceInputProvider({
  isBusy,
  priceApi,
  onPrint,
  onPrintMany,
  onStatus,
  children,
}: PriceInputProviderProps) {
  const {baseUrl: priceApiBaseUrl, token: priceApiToken} = priceApi;
  const [digits, setDigits] = useState('');
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [barcodeApiLookup, setBarcodeApiLookup] = useState<BarcodeApiLookupState | null>(null);
  const [needsPricePost, setNeedsPricePost] = useState(false);
  const [printManyMode, setPrintManyMode] = useState(false);
  const [printCount, setPrintCount] = useState('');
  const barcodeLookupSeqRef = useRef(0);
  const barcodeLookupAbortRef = useRef<AbortController | null>(null);

  const cancelBarcodeLookup = useCallback(() => {
    barcodeLookupAbortRef.current?.abort();
    barcodeLookupAbortRef.current = null;
  }, []);

  useEffect(() => () => cancelBarcodeLookup(), [cancelBarcodeLookup]);

  const price = useMemo(() => formatPrice(digits), [digits]);

  const resetBarcodeState = useCallback(() => {
    cancelBarcodeLookup();
    setPendingBarcode(null);
    setBarcodeApiLookup(null);
    setNeedsPricePost(false);
  }, [cancelBarcodeLookup]);

  const exitPrintManyMode = useCallback(() => {
    setPrintManyMode(false);
    setPrintCount('');
  }, []);

  const buildPrintMeta = useCallback((): PrintMeta | undefined => {
    if (!pendingBarcode || !digits || !isPriceApiConfigured(priceApiBaseUrl, priceApiToken)) {
      return undefined;
    }

    if (!needsPricePost) {
      return undefined;
    }

    return {
      barcode: pendingBarcode,
      postPriceToApi: true,
      priceDigits: digits,
    };
  }, [digits, needsPricePost, pendingBarcode, priceApiBaseUrl, priceApiToken]);

  const appendDigit = useCallback(
    (digit: string) => {
      if (printManyMode) {
        setPrintCount(current => {
          const next = (current + digit).replace(/^0+(?=\d)/, '');
          return next.slice(0, MAX_PRINT_COUNT_DIGITS);
        });
        return;
      }

      setDigits(current => {
        const next = (current + digit).replace(/^0+(?=\d)/, '');
        return next.slice(0, MAX_DIGITS);
      });
    },
    [printManyMode],
  );

  const backspace = useCallback(() => {
    if (printManyMode) {
      setPrintCount(current => current.slice(0, -1));
      return;
    }

    setDigits(current => current.slice(0, -1));
  }, [printManyMode]);

  const clear = useCallback(() => {
    if (printManyMode) {
      exitPrintManyMode();
      onStatus('Ready');
      return;
    }

    setDigits('');
    resetBarcodeState();
  }, [exitPrintManyMode, onStatus, printManyMode, resetBarcodeState]);

  const resolveBarcodeScan = useCallback(
    async (rawValue: string) => {
      if (printManyMode) {
        exitPrintManyMode();
      }

      const barcode = rawValue.trim();
      if (!barcode) {
        onStatus('Barcode had no readable value');
        return;
      }

      if (isPriceApiConfigured(priceApiBaseUrl, priceApiToken)) {
        if (
          pendingBarcode &&
          pendingBarcode !== barcode &&
          needsPricePost &&
          digits
        ) {
          onStatus(`Print price for ${pendingBarcode} before scanning another barcode`);
          return;
        }

        if (pendingBarcode === barcode && needsPricePost && digits) {
          onStatus(`Price ready for ${barcode} — tap Print to save`);
          return;
        }

        const lookupSeq = ++barcodeLookupSeqRef.current;
        cancelBarcodeLookup();
        const lookupAbort = new AbortController();
        barcodeLookupAbortRef.current = lookupAbort;
        setPendingBarcode(barcode);
        setBarcodeApiLookup({status: 'loading'});
        setDigits('');
        setNeedsPricePost(false);
        onStatus(`Looking up ${barcode}...`);

        try {
          const apiPrice = await fetchPriceByBarcode(
            priceApiBaseUrl,
            priceApiToken,
            barcode,
            lookupAbort.signal,
          );
          if (lookupSeq !== barcodeLookupSeqRef.current) {
            return;
          }
          barcodeLookupAbortRef.current = null;
          if (apiPrice) {
            const scannedDigits = decimalPriceToDigits(apiPrice);
            if (scannedDigits) {
              const formattedPrice = formatPrice(scannedDigits);
              setDigits(scannedDigits);
              setNeedsPricePost(false);
              setBarcodeApiLookup({status: 'found', price: formattedPrice});
              onStatus(`Scanned ${barcode}: ${formattedPrice}`);
              return;
            }
          }

          setNeedsPricePost(true);
          setBarcodeApiLookup({status: 'not_found'});
          onStatus(`No price for ${barcode} — enter price and print`);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          if (lookupSeq !== barcodeLookupSeqRef.current) {
            return;
          }
          barcodeLookupAbortRef.current = null;
          const message =
            error instanceof Error
              ? error.message
              : 'API lookup failed';
          setNeedsPricePost(true);
          setBarcodeApiLookup({status: 'error', message});
          onStatus(`${message} — enter price manually`);
        }
        return;
      }

      resetBarcodeState();
      const scannedDigits = barcodeValueToDigits(barcode);
      if (!scannedDigits) {
        onStatus('No price found in barcode');
        return;
      }

      setDigits(scannedDigits);
      onStatus(`Scanned price: ${formatPrice(scannedDigits)}`);
    },
    [cancelBarcodeLookup, digits, exitPrintManyMode, needsPricePost, onStatus, pendingBarcode, priceApiBaseUrl, priceApiToken, printManyMode, resetBarcodeState],
  );

  const handlePrint = useCallback(async () => {
    if (printManyMode) {
      exitPrintManyMode();
    }

    if (!digits) {
      onStatus('Enter a price first');
      return;
    }

    const meta = buildPrintMeta();
    await onPrint(price, meta);
    resetBarcodeState();
    setDigits('');
  }, [
    buildPrintMeta,
    digits,
    exitPrintManyMode,
    onPrint,
    onStatus,
    price,
    printManyMode,
    resetBarcodeState,
  ]);

  const handlePrintMany = useCallback(async () => {
    if (!printManyMode) {
      setPrintManyMode(true);
      setPrintCount('');
      onStatus('Enter count, then tap Print Many again');
      return;
    }

    const count = Number.parseInt(printCount, 10);
    if (!count || count <= 0) {
      onStatus('Enter a count first');
      return;
    }

    if (!digits) {
      onStatus('Enter a price first');
      return;
    }

    const meta = buildPrintMeta();
    if (await onPrintMany(price, count, meta)) {
      exitPrintManyMode();
      resetBarcodeState();
      setDigits('');
    }
  }, [
    buildPrintMeta,
    digits,
    exitPrintManyMode,
    onPrintMany,
    onStatus,
    price,
    printCount,
    printManyMode,
    resetBarcodeState,
  ]);

  const value = useMemo(
    () => ({
      price,
      pendingBarcode,
      barcodeApiLookup,
      printManyMode,
      printCount,
      isBusy,
      appendDigit,
      backspace,
      clear,
      resolveBarcodeScan,
      showStatus: onStatus,
      handlePrint,
      handlePrintMany,
    }),
    [
      appendDigit,
      backspace,
      clear,
      resolveBarcodeScan,
      onStatus,
      handlePrint,
      handlePrintMany,
      isBusy,
      pendingBarcode,
      barcodeApiLookup,
      price,
      printCount,
      printManyMode,
    ],
  );

  return <PriceInputContext.Provider value={value}>{children}</PriceInputContext.Provider>;
}

export const PriceDisplay = memo(function PriceDisplayPanel() {
  const {price, pendingBarcode, barcodeApiLookup, isBusy, resolveBarcodeScan, showStatus} =
    usePriceInput();
  const [isScanning, setIsScanning] = useState(false);
  const barcodeValidation = useMemo(
    () => (pendingBarcode ? getEanValidation(pendingBarcode) : null),
    [pendingBarcode],
  );

  const handleScanPress = useCallback(async () => {
    if (isBusy || isScanning) {
      return;
    }

    setIsScanning(true);
    try {
      const value = await scanBarcode();
      if (value) {
        resolveBarcodeScan(value);
      }
    } catch (error) {
      if (!isBarcodeScanCanceled(error)) {
        showStatus(error instanceof Error ? error.message : 'Barcode scan failed');
      }
    } finally {
      setIsScanning(false);
    }
  }, [isBusy, isScanning, resolveBarcodeScan, showStatus]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionCaption}>Price</Text>
      <View style={styles.priceFieldRow}>
        <View style={styles.priceField}>
          <Text style={styles.priceText}>{price}</Text>
          <Text style={styles.currencyText}>EUR</Text>
        </View>
        <Pressable
          accessibilityLabel="Scan barcode for price"
          accessibilityRole="button"
          disabled={isBusy || isScanning}
          onPress={handleScanPress}
          style={({pressed}) => [
            styles.barcodeScanButton,
            pressed && styles.pressed,
            (isBusy || isScanning) && styles.disabled,
          ]}>
          {isScanning ? (
            <ActivityIndicator color="#191919" />
          ) : (
            <BarcodeIcon />
          )}
        </Pressable>
      </View>
      {pendingBarcode ? (
        <View style={styles.barcodeHintRow}>
          <Text
            style={[
              styles.barcodeHint,
              barcodeValidation === 'ean8' && styles.barcodeHintEan8,
              barcodeValidation === 'ean13' && styles.barcodeHintEan13,
              barcodeValidation === 'invalid' && styles.barcodeHintInvalid,
            ]}>
            Barcode: {pendingBarcode}
          </Text>
          {barcodeApiLookup ? (
            <View style={styles.barcodeApiStatusRow}>
              {barcodeApiLookup.status === 'loading' ? (
                <ActivityIndicator color="#6d6a63" size="small" />
              ) : null}
              <Text
                style={[
                  styles.barcodeApiStatus,
                  barcodeApiStatusStyle(barcodeApiLookup),
                ]}>
                {barcodeApiStatusLabel(barcodeApiLookup)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

type DigitKeyProps = {
  digit: string;
  active: boolean;
  onAppend: (digit: string) => void;
};

const DigitKey = memo(function DigitKeyButton({digit, active, onAppend}: DigitKeyProps) {
  const onPress = useCallback(() => onAppend(digit), [digit, onAppend]);
  return <Key label={digit} onPress={onPress} active={active} />;
});

export const PriceKeypad = memo(function PriceKeypadPanel() {
  const {
    printManyMode,
    printCount,
    isBusy,
    appendDigit,
    backspace,
    clear,
    handlePrint,
    handlePrintMany,
  } = usePriceInput();

  const printDisabled = isBusy;

  return (
    <>
      <View style={styles.keypad}>
        {DIGIT_KEYS.map(value => (
          <DigitKey key={value} digit={value} active={printManyMode} onAppend={appendDigit} />
        ))}
        <Key label="C" onPress={clear} variant="secondary" />
        <DigitKey digit="0" active={printManyMode} onAppend={appendDigit} />
        <Key label="⌫" onPress={backspace} variant="secondary" />
      </View>

      <View style={styles.printButtonRow}>
        <Pressable
          onPress={handlePrint}
          disabled={printDisabled}
          style={({pressed}) => [
            styles.printButton,
            pressed && styles.pressed,
            printDisabled && styles.disabled,
          ]}>
          {isBusy && !printManyMode ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.printButtonText}>Print</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handlePrintMany}
          disabled={printDisabled}
          style={({pressed}) => [
            styles.printButton,
            printManyMode && styles.printManyButtonActive,
            pressed && styles.pressed,
            printDisabled && styles.disabled,
          ]}>
          {isBusy && printManyMode ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.printButtonText}>
              {printManyMode && printCount ? `Print Many (${printCount})` : 'Print Many'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
});
