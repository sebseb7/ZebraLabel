import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  buildZpl,
  labelDescription,
  LABEL_OFFSET_STEP_MM,
  MAX_LABEL_OFFSET_MM,
  type LabelOffset,
  type LabelSizeId,
} from './src/buildZpl';
import {
  DEFAULT_LABEL_OFFSETS,
  loadLabelOffsets,
  saveLabelOffsets,
} from './src/labelOffsetStorage';

type ZebraUsbPrinter = {
  name: string;
  vendorId: number;
  productId: number;
  hasPermission: boolean;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
};

type LabelSize = {
  id: LabelSizeId;
  title: string;
  subtitle: string;
};

type ZebraPrinterModule = {
  getUsbPrinters(): Promise<ZebraUsbPrinter[]>;
  printZpl(zpl: string): Promise<string>;
};

const ZebraPrinter = NativeModules.ZebraPrinter as ZebraPrinterModule;
const MAX_DIGITS = 8;

const ZERO_OFFSET: LabelOffset = {xMm: 0, yMm: 0};

const LABEL_SIZES: LabelSize[] = [
  {
    id: '25x13',
    title: '25,4 × 12,7',
    subtitle: 'mm',
  },
  {
    id: '47x81',
    title: '46,8 × 81',
    subtitle: 'mm · 90° CW print',
  },
  {
    id: '51x25',
    title: '50,8 × 25,4',
    subtitle: 'mm',
  },
];

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSizeId>('25x13');
  const [labelOffsets, setLabelOffsets] = useState(DEFAULT_LABEL_OFFSETS);
  const offsetsHydratedRef = useRef(false);
  const [showPositionAdjust, setShowPositionAdjust] = useState(false);
  const [printers, setPrinters] = useState<ZebraUsbPrinter[]>([]);
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);

  const price = useMemo(() => formatPrice(digits), [digits]);
  const labelSize = LABEL_SIZES.find(size => size.id === selectedLabelSize) ?? LABEL_SIZES[0];
  const currentOffset = labelOffsets[selectedLabelSize];

  const nudgeOffset = (axis: 'xMm' | 'yMm', delta: number) => {
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
  };

  const resetOffset = () => {
    setLabelOffsets(current => ({
      ...current,
      [selectedLabelSize]: {...ZERO_OFFSET},
    }));
  };

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

  const refreshPrinters = useCallback(async () => {
    try {
      const discoveredPrinters = await ZebraPrinter.getUsbPrinters();
      setPrinters(discoveredPrinters);
      setStatus(
        discoveredPrinters.length > 0
          ? `Found ${discoveredPrinters.length} USB Zebra printer${
              discoveredPrinters.length === 1 ? '' : 's'
            }`
          : 'No USB Zebra printer found',
      );
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  const appendDigit = (digit: string) => {
    setDigits(current => {
      const next = (current + digit).replace(/^0+(?=\d)/, '');
      return next.slice(0, MAX_DIGITS);
    });
  };

  const backspace = () => setDigits(current => current.slice(0, -1));
  const clear = () => setDigits('');

  const print = async () => {
    setIsBusy(true);
    setStatus(`Printing ${labelSize.title} ${labelSize.subtitle} label...`);

    try {
      const zpl = buildZpl(price, selectedLabelSize, currentOffset);
      await ZebraPrinter.printZpl(zpl);
      setStatus(`Printed ${price} on ${labelDescription(selectedLabelSize)}`);
    } catch (error) {
      const message = errorMessage(error);
      setStatus(message);
      Alert.alert('Print failed', message);
    } finally {
      setIsBusy(false);
      refreshPrinters();
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3eb" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}>
        <View style={styles.header}>
          <Text style={styles.title}>Zebra Price Label</Text>
          <Text style={styles.subtitle}>USB Zebra ZD410</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>Price</Text>
          <View style={styles.priceField}>
            <Text style={styles.priceText}>{price}</Text>
            <Text style={styles.currencyText}>EUR</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionCaption}>Label size</Text>
          <View style={styles.sizeSelector}>
            {LABEL_SIZES.map(size => (
              <Pressable
                key={size.id}
                onPress={() => setSelectedLabelSize(size.id)}
                style={({pressed}) => [
                  styles.sizeButton,
                  selectedLabelSize === size.id && styles.selectedSizeButton,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.sizeButtonTitle,
                    selectedLabelSize === size.id && styles.selectedSizeButtonText,
                  ]}>
                  {size.title}
                </Text>
                <Text
                  style={[
                    styles.sizeButtonSubtitle,
                    selectedLabelSize === size.id && styles.selectedSizeButtonText,
                  ]}>
                  {size.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.offsetHeader}>
            <Text style={styles.sectionCaption}>Position</Text>
            <Pressable
              onPress={() => setShowPositionAdjust(current => !current)}
              style={({pressed}) => [styles.smallButton, pressed && styles.pressed]}>
              <Text style={styles.smallButtonText}>
                {showPositionAdjust ? 'Hide' : 'Adjust'}
              </Text>
            </Pressable>
          </View>
          {!showPositionAdjust && hasActiveOffset(currentOffset) ? (
            <Text style={styles.offsetHint}>
              Offset active: ↔ {formatOffsetMm(currentOffset.xMm)} · ↕{' '}
              {formatOffsetMm(currentOffset.yMm)}
            </Text>
          ) : null}
          {showPositionAdjust ? (
            <>
              <View style={styles.offsetToolbar}>
                <Text style={styles.offsetHint}>Fine-tune centering (±0,5 cm per label size)</Text>
                <Pressable
                  onPress={resetOffset}
                  disabled={!hasActiveOffset(currentOffset)}
                  style={({pressed}) => [
                    styles.smallButton,
                    pressed && styles.pressed,
                    !hasActiveOffset(currentOffset) && styles.disabled,
                  ]}>
                  <Text style={styles.smallButtonText}>Reset</Text>
                </Pressable>
              </View>
              <View style={styles.offsetPanel}>
                <View style={styles.offsetControls}>
                  <View style={styles.offsetSpacer} />
                  <OffsetButton
                    label="↑"
                    onPress={() => nudgeOffset('yMm', -LABEL_OFFSET_STEP_MM)}
                  />
                  <View style={styles.offsetSpacer} />
                  <OffsetButton
                    label="←"
                    onPress={() => nudgeOffset('xMm', -LABEL_OFFSET_STEP_MM)}
                  />
                  <View style={styles.offsetCenter}>
                    <Text style={styles.offsetValue}>↔ {formatOffsetMm(currentOffset.xMm)}</Text>
                    <Text style={styles.offsetValue}>↕ {formatOffsetMm(currentOffset.yMm)}</Text>
                  </View>
                  <OffsetButton
                    label="→"
                    onPress={() => nudgeOffset('xMm', LABEL_OFFSET_STEP_MM)}
                  />
                  <View style={styles.offsetSpacer} />
                  <OffsetButton
                    label="↓"
                    onPress={() => nudgeOffset('yMm', LABEL_OFFSET_STEP_MM)}
                  />
                  <View style={styles.offsetSpacer} />
                </View>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.printerCard}>
          <View style={styles.printerHeader}>
            <Text style={styles.cardTitle}>Printer</Text>
            <Pressable
              onPress={refreshPrinters}
              disabled={isBusy}
              style={({pressed}) => [
                styles.smallButton,
                pressed && styles.pressed,
                isBusy && styles.disabled,
              ]}>
              <Text style={styles.smallButtonText}>Refresh</Text>
            </Pressable>
          </View>
          <Text style={styles.status}>{status}</Text>
          {printers.map(printer => (
            <Text key={printer.name} style={styles.printerText}>
              {printer.productName || printer.name} · {printer.hasPermission ? 'allowed' : 'permission needed'}
            </Text>
          ))}
        </View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(value => (
            <Key key={value} label={value} onPress={() => appendDigit(value)} />
          ))}
          <Key label="C" onPress={clear} variant="secondary" />
          <Key label="0" onPress={() => appendDigit('0')} />
          <Key label="⌫" onPress={backspace} variant="secondary" />
        </View>

        <Pressable
          onPress={print}
          disabled={isBusy}
          style={({pressed}) => [
            styles.printButton,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}>
          {isBusy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.printButtonText}>Print label</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function OffsetButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.offsetButton, pressed && styles.pressed]}>
      <Text style={styles.offsetButtonText}>{label}</Text>
    </Pressable>
  );
}

function Key({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.key,
        variant === 'secondary' && styles.secondaryKey,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
}

function formatPrice(digits: string) {
  const cleanDigits = digits.replace(/\D/g, '');
  const cents = cleanDigits.slice(-2).padStart(2, '0');
  const euros = cleanDigits.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  return `${euros},${cents}`;
}

function formatOffsetMm(mm: number): string {
  const absolute = Math.abs(mm);
  const formatted = Number.isInteger(absolute)
    ? String(absolute)
    : absolute.toFixed(1).replace('.', ',');
  const prefix = mm > 0 ? '+' : mm < 0 ? '−' : '';
  return `${prefix}${formatted} mm`;
}

function hasActiveOffset(offset: LabelOffset) {
  return offset.xMm !== 0 || offset.yMm !== 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as {message?: unknown}).message);
  }

  return String(error);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f3eb',
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
  },
  header: {
    gap: 4,
  },
  title: {
    color: '#191919',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6d6a63',
    fontSize: 16,
  },
  section: {
    gap: 8,
  },
  sectionCaption: {
    color: '#6d6a63',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priceField: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderColor: '#d7cec0',
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    minHeight: 96,
    paddingHorizontal: 20,
  },
  priceText: {
    color: '#000000',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  currencyText: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 10,
  },
  sizeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#d7cec0',
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  selectedSizeButton: {
    borderColor: '#111111',
    backgroundColor: '#111111',
  },
  sizeButtonTitle: {
    color: '#191919',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  sizeButtonSubtitle: {
    color: '#6d6a63',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  selectedSizeButtonText: {
    color: '#ffffff',
  },
  offsetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offsetToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  offsetHint: {
    color: '#6d6a63',
    fontSize: 13,
  },
  offsetPanel: {
    borderColor: '#d7cec0',
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  offsetControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  offsetSpacer: {
    width: '31.3%',
  },
  offsetButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '31.3%',
    borderRadius: 14,
    backgroundColor: '#ede6da',
    minHeight: 52,
  },
  offsetButtonText: {
    color: '#191919',
    fontSize: 24,
    fontWeight: '800',
  },
  offsetCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '31.3%',
    minHeight: 112,
    gap: 4,
  },
  offsetValue: {
    color: '#191919',
    fontSize: 14,
    fontWeight: '700',
  },
  printerCard: {
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#ede6da',
    padding: 14,
  },
  printerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#191919',
    fontSize: 16,
    fontWeight: '800',
  },
  status: {
    color: '#4e4a43',
    fontSize: 14,
  },
  printerText: {
    color: '#191919',
    fontSize: 13,
    fontWeight: '600',
  },
  smallButton: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  smallButtonText: {
    color: '#191919',
    fontSize: 13,
    fontWeight: '800',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '31.3%',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    minHeight: 64,
  },
  secondaryKey: {
    backgroundColor: '#ded6ca',
  },
  keyText: {
    color: '#191919',
    fontSize: 30,
    fontWeight: '800',
  },
  printButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111111',
    minHeight: 62,
  },
  printButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default App;
