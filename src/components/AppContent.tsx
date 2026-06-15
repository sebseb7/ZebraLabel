import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {styles} from '../appStyles';
import {clamp, errorMessage, ZERO_OFFSET} from '../appUtils';
import {LABEL_SIZES} from '../labelSizes';
import {ZebraPrinter, type ZebraUsbPrinter} from '../zebraPrinter';
import {
  AppHeader,
  LabelSizeSection,
  PositionSection,
  PrinterSection,
} from './AppContentSections';
import {
  PriceDisplay,
  PriceInputProvider,
  PriceKeypad,
} from './PriceInputPanel';

export function AppContent() {
  const insets = useSafeAreaInsets();
  const [selectedLabelSize, setSelectedLabelSize] = useState<LabelSizeId>('25x13');
  const [labelOffsets, setLabelOffsets] = useState(DEFAULT_LABEL_OFFSETS);
  const offsetsHydratedRef = useRef(false);
  const [showPositionAdjust, setShowPositionAdjust] = useState(false);
  const [printers, setPrinters] = useState<ZebraUsbPrinter[]>([]);
  const [status, setStatus] = useState('Ready');
  const [isBusy, setIsBusy] = useState(false);

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

  const handlePrint = useCallback(
    async (price: string) => {
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
    },
    [currentOffset, labelSize.subtitle, labelSize.title, refreshPrinters, selectedLabelSize],
  );

  const handlePrintMany = useCallback(
    async (price: string, count: number) => {
      setIsBusy(true);
      setStatus(`Printing ${count}× ${labelSize.title} ${labelSize.subtitle} labels...`);

      try {
        const zpl = buildZpl(price, selectedLabelSize, currentOffset, count);
        await ZebraPrinter.printZpl(zpl);
        setStatus(`Printed ${count}× ${price} on ${labelDescription(selectedLabelSize)}`);
        return true;
      } catch (error) {
        const message = errorMessage(error);
        setStatus(message);
        Alert.alert('Print failed', message);
        return false;
      } finally {
        setIsBusy(false);
        refreshPrinters();
      }
    },
    [currentOffset, labelSize.subtitle, labelSize.title, refreshPrinters, selectedLabelSize],
  );

  const togglePositionAdjust = useCallback(() => {
    setShowPositionAdjust(current => !current);
  }, []);

  const nudgeX = useCallback((delta: number) => nudgeOffset('xMm', delta), [nudgeOffset]);
  const nudgeY = useCallback((delta: number) => nudgeOffset('yMm', delta), [nudgeOffset]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f3eb" />
      <PriceInputProvider
        isBusy={isBusy}
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
          <AppHeader />
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
            status={status}
            printers={printers}
            isBusy={isBusy}
            onRefresh={refreshPrinters}
          />
          <PriceKeypad />
        </ScrollView>
      </PriceInputProvider>
    </View>
  );
}
