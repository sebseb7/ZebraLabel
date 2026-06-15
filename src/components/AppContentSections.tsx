import React, {Component} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';
import {LABEL_OFFSET_STEP_MM, type LabelOffset, type LabelSizeId} from '../buildZpl';
import {styles} from '../appStyles';
import {formatOffsetMm, hasActiveOffset} from '../appUtils';
import {LABEL_SIZES} from '../labelSizes';
import {type PrinterConnection, type ZebraUsbPrinter} from '../zebraPrinter';
import {OffsetButton} from './OffsetButton';

export class AppHeader extends Component {
  render() {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>Zebra Price Label</Text>
        <Text style={styles.subtitle}>Zebra ZD410</Text>
      </View>
    );
  }
}

type LabelSizeSectionProps = {
  selectedLabelSize: LabelSizeId;
  onSelect: (id: LabelSizeId) => void;
};

export class LabelSizeSection extends Component<LabelSizeSectionProps> {
  render() {
    const {selectedLabelSize, onSelect} = this.props;

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
  }
}

type PositionSectionProps = {
  showPositionAdjust: boolean;
  currentOffset: LabelOffset;
  onToggleAdjust: () => void;
  onReset: () => void;
  onNudgeX: (delta: number) => void;
  onNudgeY: (delta: number) => void;
};

export class PositionSection extends Component<PositionSectionProps> {
  render() {
    const {
      showPositionAdjust,
      currentOffset,
      onToggleAdjust,
      onReset,
      onNudgeX,
      onNudgeY,
    } = this.props;

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
  }
}

const PRINTER_CONNECTIONS: {id: PrinterConnection; title: string; subtitle: string}[] = [
  {id: 'usb', title: 'USB', subtitle: 'Direct'},
  {id: 'network', title: 'Network', subtitle: 'TCP/IP'},
];

function printerSummaryHint(
  connection: PrinterConnection,
  networkIp: string,
  printers: ZebraUsbPrinter[],
): string {
  if (connection === 'network') {
    const ip = networkIp.trim();
    return ip ? `Network · ${ip}` : 'Network · IP not set';
  }

  if (printers.length === 0) {
    return 'USB · no printer found';
  }

  return `USB · ${printers.length} printer${printers.length === 1 ? '' : 's'}`;
}

type PrinterSectionProps = {
  showPrinterSettings: boolean;
  connection: PrinterConnection;
  networkIp: string;
  status: string;
  printers: ZebraUsbPrinter[];
  isBusy: boolean;
  onToggleSettings: () => void;
  onConnectionChange: (connection: PrinterConnection) => void;
  onNetworkIpChange: (ip: string) => void;
  onRefresh: () => void;
};

export class PrinterSection extends Component<PrinterSectionProps> {
  render() {
    const {
      showPrinterSettings,
      connection,
      networkIp,
      status,
      printers,
      isBusy,
      onToggleSettings,
      onConnectionChange,
      onNetworkIpChange,
      onRefresh,
    } = this.props;

    return (
      <View style={styles.printerCard}>
        <View style={styles.offsetHeader}>
          <Text style={styles.sectionCaption}>Printer</Text>
          <Pressable
            onPress={onToggleSettings}
            style={({pressed}) => [styles.smallButton, pressed && styles.pressed]}>
            <Text style={styles.smallButtonText}>
              {showPrinterSettings ? 'Hide' : 'Configure'}
            </Text>
          </Pressable>
        </View>
        {!showPrinterSettings ? (
          <Text style={styles.offsetHint}>
            {printerSummaryHint(connection, networkIp, printers)}
          </Text>
        ) : null}
        {showPrinterSettings ? (
          <>
            <View style={styles.offsetToolbar}>
              <Text style={styles.sectionCaption}>Connection</Text>
              {connection === 'usb' ? (
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
              ) : null}
            </View>
            <View style={styles.sizeSelector}>
              {PRINTER_CONNECTIONS.map(option => (
                <Pressable
                  key={option.id}
                  onPress={() => onConnectionChange(option.id)}
                  style={({pressed}) => [
                    styles.sizeButton,
                    connection === option.id && styles.selectedSizeButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.sizeButtonTitle,
                      connection === option.id && styles.selectedSizeButtonText,
                    ]}>
                    {option.title}
                  </Text>
                  <Text
                    style={[
                      styles.sizeButtonSubtitle,
                      connection === option.id && styles.selectedSizeButtonText,
                    ]}>
                    {option.subtitle}
                  </Text>
                </Pressable>
              ))}
            </View>
            {connection === 'network' ? (
              <View style={styles.networkIpField}>
                <Text style={styles.networkIpLabel}>Printer IP</Text>
                <TextInput
                  value={networkIp}
                  onChangeText={onNetworkIpChange}
                  placeholder="192.168.1.100"
                  placeholderTextColor="#9a9489"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  style={styles.networkIpInput}
                />
              </View>
            ) : null}
            <Text style={styles.status}>{status}</Text>
            {connection === 'usb'
              ? printers.map(printer => (
                  <Text key={printer.name} style={styles.printerText}>
                    {printer.productName || printer.name} ·{' '}
                    {printer.hasPermission ? 'allowed' : 'permission needed'}
                  </Text>
                ))
              : null}
          </>
        ) : null}
      </View>
    );
  }
}
