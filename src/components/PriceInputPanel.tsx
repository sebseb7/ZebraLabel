import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {styles} from '../appStyles';
import {
  barcodeValueToDigits,
  decimalPriceToDigits,
  formatPrice,
  MAX_DIGITS,
} from '../appUtils';
import {isBarcodeScanCanceled, scanBarcode} from '../barcodeScanner';
import {fetchPriceByBarcode, isPriceApiConfigured} from '../priceApi';
import type {PriceApiSettings} from '../priceApiSettingsStorage';
import {BarcodeIcon} from './BarcodeIcon';
import {Key} from './Key';

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const MAX_PRINT_COUNT_DIGITS = 4;

export type PrintMeta = {
  barcode?: string;
  postPriceToApi?: boolean;
  priceDigits?: string;
};

type PriceInputContextValue = {
  price: string;
  pendingBarcode: string | null;
  printManyMode: boolean;
  printCount: string;
  isBusy: boolean;
  isResolvingBarcode: boolean;
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
  const [needsPricePost, setNeedsPricePost] = useState(false);
  const [isResolvingBarcode, setIsResolvingBarcode] = useState(false);
  const [printManyMode, setPrintManyMode] = useState(false);
  const [printCount, setPrintCount] = useState('');

  const price = useMemo(() => formatPrice(digits), [digits]);

  const resetBarcodeState = useCallback(() => {
    setPendingBarcode(null);
    setNeedsPricePost(false);
  }, []);

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

        setIsResolvingBarcode(true);
        setPendingBarcode(barcode);
        setDigits('');
        setNeedsPricePost(false);
        onStatus(`Looking up ${barcode}...`);

        try {
          const apiPrice = await fetchPriceByBarcode(
            priceApiBaseUrl,
            priceApiToken,
            barcode,
          );
          if (apiPrice) {
            const scannedDigits = decimalPriceToDigits(apiPrice);
            if (scannedDigits) {
              setDigits(scannedDigits);
              setNeedsPricePost(false);
              onStatus(`Scanned ${barcode}: ${formatPrice(scannedDigits)}`);
              return;
            }
          }

          setNeedsPricePost(true);
          onStatus(`No price for ${barcode} — enter price and print`);
        } catch (error) {
          setNeedsPricePost(true);
          onStatus(
            error instanceof Error
              ? `${error.message} — enter price manually`
              : 'API lookup failed — enter price manually',
          );
        } finally {
          setIsResolvingBarcode(false);
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
    [digits, exitPrintManyMode, needsPricePost, onStatus, pendingBarcode, priceApiBaseUrl, priceApiToken, printManyMode, resetBarcodeState],
  );

  const handlePrint = useCallback(async () => {
    if (printManyMode) {
      exitPrintManyMode();
    }

    if (isResolvingBarcode) {
      onStatus('Wait for barcode lookup to finish');
      return;
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
    isResolvingBarcode,
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

    if (isResolvingBarcode) {
      onStatus('Wait for barcode lookup to finish');
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
    isResolvingBarcode,
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
      printManyMode,
      printCount,
      isBusy,
      isResolvingBarcode,
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
      isResolvingBarcode,
      pendingBarcode,
      price,
      printCount,
      printManyMode,
    ],
  );

  return <PriceInputContext.Provider value={value}>{children}</PriceInputContext.Provider>;
}

export const PriceDisplay = memo(function PriceDisplay() {
  const {price, pendingBarcode, isBusy, resolveBarcodeScan, showStatus} = usePriceInput();
  const [isScanning, setIsScanning] = useState(false);

  const handleScanPress = useCallback(async () => {
    if (isBusy || isScanning) {
      return;
    }

    setIsScanning(true);
    try {
      const value = await scanBarcode();
      if (value) {
        await resolveBarcodeScan(value);
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
        <Text style={styles.barcodeHint}>Barcode: {pendingBarcode}</Text>
      ) : null}
    </View>
  );
});

type DigitKeyProps = {
  digit: string;
  active: boolean;
  onAppend: (digit: string) => void;
};

const DigitKey = memo(function DigitKey({digit, active, onAppend}: DigitKeyProps) {
  const onPress = useCallback(() => onAppend(digit), [digit, onAppend]);
  return <Key label={digit} onPress={onPress} active={active} />;
});

export const PriceKeypad = memo(function PriceKeypad() {
  const {
    printManyMode,
    printCount,
    isBusy,
    isResolvingBarcode,
    appendDigit,
    backspace,
    clear,
    handlePrint,
    handlePrintMany,
  } = usePriceInput();

  const printDisabled = isBusy || isResolvingBarcode;

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
