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
import {formatPrice, MAX_DIGITS} from '../appUtils';
import {Key} from './Key';

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const MAX_PRINT_COUNT_DIGITS = 4;

type PriceInputContextValue = {
  price: string;
  printManyMode: boolean;
  printCount: string;
  isBusy: boolean;
  appendDigit: (digit: string) => void;
  backspace: () => void;
  clear: () => void;
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

type PriceInputProviderProps = {
  isBusy: boolean;
  onPrint: (price: string) => Promise<void>;
  onPrintMany: (price: string, count: number) => Promise<boolean>;
  onStatus: (status: string) => void;
  children: ReactNode;
};

export function PriceInputProvider({
  isBusy,
  onPrint,
  onPrintMany,
  onStatus,
  children,
}: PriceInputProviderProps) {
  const [digits, setDigits] = useState('');
  const [printManyMode, setPrintManyMode] = useState(false);
  const [printCount, setPrintCount] = useState('');

  const price = useMemo(() => formatPrice(digits), [digits]);

  const exitPrintManyMode = useCallback(() => {
    setPrintManyMode(false);
    setPrintCount('');
  }, []);

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
  }, [exitPrintManyMode, onStatus, printManyMode]);

  const handlePrint = useCallback(async () => {
    if (printManyMode) {
      exitPrintManyMode();
    }

    await onPrint(price);
  }, [exitPrintManyMode, onPrint, price, printManyMode]);

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

    if (await onPrintMany(price, count)) {
      exitPrintManyMode();
    }
  }, [exitPrintManyMode, onPrintMany, onStatus, price, printCount, printManyMode]);

  const value = useMemo(
    () => ({
      price,
      printManyMode,
      printCount,
      isBusy,
      appendDigit,
      backspace,
      clear,
      handlePrint,
      handlePrintMany,
    }),
    [
      appendDigit,
      backspace,
      clear,
      handlePrint,
      handlePrintMany,
      isBusy,
      price,
      printCount,
      printManyMode,
    ],
  );

  return <PriceInputContext.Provider value={value}>{children}</PriceInputContext.Provider>;
}

export const PriceDisplay = memo(function PriceDisplay() {
  const {price} = usePriceInput();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionCaption}>Price</Text>
      <View style={styles.priceField}>
        <Text style={styles.priceText}>{price}</Text>
        <Text style={styles.currencyText}>EUR</Text>
      </View>
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
    appendDigit,
    backspace,
    clear,
    handlePrint,
    handlePrintMany,
  } = usePriceInput();

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
          disabled={isBusy}
          style={({pressed}) => [
            styles.printButton,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}>
          {isBusy && !printManyMode ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.printButtonText}>Print</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handlePrintMany}
          disabled={isBusy}
          style={({pressed}) => [
            styles.printButton,
            printManyMode && styles.printManyButtonActive,
            pressed && styles.pressed,
            isBusy && styles.disabled,
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
