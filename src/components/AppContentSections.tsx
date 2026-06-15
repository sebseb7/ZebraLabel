import React, {memo} from 'react';
import {Pressable, Text, View} from 'react-native';
import {LABEL_OFFSET_STEP_MM, type LabelOffset, type LabelSizeId} from '../buildZpl';
import {styles} from '../appStyles';
import {formatOffsetMm, hasActiveOffset} from '../appUtils';
import {LABEL_SIZES} from '../labelSizes';
import {type ZebraUsbPrinter} from '../zebraPrinter';
import {OffsetButton} from './OffsetButton';

export const AppHeader = memo(function AppHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Zebra Price Label</Text>
      <Text style={styles.subtitle}>USB Zebra ZD410</Text>
    </View>
  );
});

type LabelSizeSectionProps = {
  selectedLabelSize: LabelSizeId;
  onSelect: (id: LabelSizeId) => void;
};

export const LabelSizeSection = memo(function LabelSizeSection({
  selectedLabelSize,
  onSelect,
}: LabelSizeSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionCaption}>Label size</Text>
      <View style={styles.sizeSelector}>
        {LABEL_SIZES.map(size => (
          <Pressable
            key={size.id}
            onPress={() => onSelect(size.id)}
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
  );
});

type PositionSectionProps = {
  showPositionAdjust: boolean;
  currentOffset: LabelOffset;
  onToggleAdjust: () => void;
  onReset: () => void;
  onNudgeX: (delta: number) => void;
  onNudgeY: (delta: number) => void;
};

export const PositionSection = memo(function PositionSection({
  showPositionAdjust,
  currentOffset,
  onToggleAdjust,
  onReset,
  onNudgeX,
  onNudgeY,
}: PositionSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.offsetHeader}>
        <Text style={styles.sectionCaption}>Position</Text>
        <Pressable
          onPress={onToggleAdjust}
          style={({pressed}) => [styles.smallButton, pressed && styles.pressed]}>
          <Text style={styles.smallButtonText}>{showPositionAdjust ? 'Hide' : 'Adjust'}</Text>
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
              onPress={onReset}
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
                onPress={() => onNudgeY(-LABEL_OFFSET_STEP_MM)}
              />
              <View style={styles.offsetSpacer} />
              <OffsetButton
                label="←"
                onPress={() => onNudgeX(-LABEL_OFFSET_STEP_MM)}
              />
              <View style={styles.offsetCenter}>
                <Text style={styles.offsetValue}>↔ {formatOffsetMm(currentOffset.xMm)}</Text>
                <Text style={styles.offsetValue}>↕ {formatOffsetMm(currentOffset.yMm)}</Text>
              </View>
              <OffsetButton
                label="→"
                onPress={() => onNudgeX(LABEL_OFFSET_STEP_MM)}
              />
              <View style={styles.offsetSpacer} />
              <OffsetButton
                label="↓"
                onPress={() => onNudgeY(LABEL_OFFSET_STEP_MM)}
              />
              <View style={styles.offsetSpacer} />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
});

type PrinterSectionProps = {
  status: string;
  printers: ZebraUsbPrinter[];
  isBusy: boolean;
  onRefresh: () => void;
};

export const PrinterSection = memo(function PrinterSection({
  status,
  printers,
  isBusy,
  onRefresh,
}: PrinterSectionProps) {
  return (
    <View style={styles.printerCard}>
      <View style={styles.printerHeader}>
        <Text style={styles.cardTitle}>Printer</Text>
        <Pressable
          onPress={onRefresh}
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
          {printer.productName || printer.name} ·{' '}
          {printer.hasPermission ? 'allowed' : 'permission needed'}
        </Text>
      ))}
    </View>
  );
});
