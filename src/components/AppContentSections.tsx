import React, {Component} from 'react';
import {ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View} from 'react-native';
import {LABEL_OFFSET_STEP_MM, type LabelOffset, type LabelSizeId} from '../buildZpl';
import {styles} from '../appStyles';
import {formatOffsetMm, hasActiveOffset} from '../appUtils';
import {isBarcodeScanCanceled, scanQrCode} from '../barcodeScanner';
import {LABEL_SIZES} from '../labelSizes';
import {parsePriceApiQrPayload} from '../priceApi';
import {type PrinterAgentStatus} from '../printerAgent';
import {type ApiPrinterMode} from '../printerMode';
import {type RemotePrinter} from '../printerApi';
import {type PrinterConnection, type ZebraUsbPrinter} from '../zebraPrinter';
import {BarcodeIcon} from './BarcodeIcon';
import {OffsetButton} from './OffsetButton';

export class AppHeader extends Component<{
  onOpenSettings: () => void;
}> {
  render() {
    const {onOpenSettings} = this.props;

    return (
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.title} testID="app-title">
            Zebra Label
          </Text>
          <Text style={styles.subtitle}>Zebra ZD410</Text>
        </View>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          onPress={onOpenSettings}
          style={({pressed}) => [styles.settingsButton, pressed && styles.pressed]}>
          <Text style={styles.settingsIconText}>⚙</Text>
        </Pressable>
      </View>
    );
  }
}

type ApiSettingsModalProps = {
  visible: boolean;
  apiBaseUrl: string;
  apiToken: string;
  onApiBaseUrlChange: (url: string) => void;
  onApiTokenChange: (token: string) => void;
  onClose: () => void;
};

type ApiSettingsModalState = {
  isScanningQr: boolean;
};

export class ApiSettingsModal extends Component<
  ApiSettingsModalProps,
  ApiSettingsModalState
> {
  state: ApiSettingsModalState = {
    isScanningQr: false,
  };

  handleScanQr = async () => {
    if (this.state.isScanningQr) {
      return;
    }

    this.setState({isScanningQr: true});

    try {
      const value = await scanQrCode();
      if (!value) {
        return;
      }

      const config = parsePriceApiQrPayload(value);
      if (!config) {
        Alert.alert(
          'Invalid QR code',
          'Expected JSON with url and token from the web UI.',
        );
        return;
      }

      this.props.onApiBaseUrlChange(config.url);
      this.props.onApiTokenChange(config.token);
    } catch (error) {
      if (!isBarcodeScanCanceled(error)) {
        Alert.alert(
          'QR scan failed',
          error instanceof Error ? error.message : 'Could not scan QR code',
        );
      }
    } finally {
      this.setState({isScanningQr: false});
    }
  };

  render() {
    const {visible, apiBaseUrl, apiToken, onApiBaseUrlChange, onApiTokenChange, onClose} =
      this.props;
    const {isScanningQr} = this.state;

    return (
      <Modal
        animationType="fade"
        onRequestClose={onClose}
        transparent
        visible={visible}>
        <Pressable onPress={onClose} style={styles.modalBackdrop}>
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.offsetHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <Pressable
                onPress={onClose}
                style={({pressed}) => [styles.smallButton, pressed && styles.pressed]}>
                <Text style={styles.smallButtonText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.modalHint}>
              Scan the API token QR from the web UI, or enter URL and token manually.
              With a USB printer this device acts as a print agent; otherwise it prints
              through remote printers on the server.
            </Text>
            <Pressable
              accessibilityLabel="Scan API setup QR code"
              accessibilityRole="button"
              disabled={isScanningQr}
              onPress={this.handleScanQr}
              style={({pressed}) => [
                styles.apiQrScanButton,
                pressed && styles.pressed,
                isScanningQr && styles.disabled,
              ]}>
              {isScanningQr ? (
                <ActivityIndicator color="#191919" />
              ) : (
                <>
                  <BarcodeIcon />
                  <Text style={styles.apiQrScanButtonText}>Scan setup QR</Text>
                </>
              )}
            </Pressable>
            <View style={styles.networkIpField}>
              <Text style={styles.networkIpLabel}>API base URL</Text>
              <TextInput
                value={apiBaseUrl}
                onChangeText={onApiBaseUrlChange}
                placeholder="http://192.168.1.10:3991"
                placeholderTextColor="#9a9489"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.networkIpInput}
              />
            </View>
            <View style={styles.networkIpField}>
              <Text style={styles.networkIpLabel}>API token</Text>
              <TextInput
                value={apiToken}
                onChangeText={onApiTokenChange}
                placeholder="amt_…"
                placeholderTextColor="#9a9489"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.networkIpInput}
              />
            </View>
            <Text style={styles.modalExample}>
              Price: GET/PUT /api/v1/price · Printers: /api/v1/printer/*
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
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
  apiMode: ApiPrinterMode,
  agentStatus: PrinterAgentStatus,
  connection: PrinterConnection,
  networkIp: string,
  printers: ZebraUsbPrinter[],
  remotePrinters: RemotePrinter[],
  selectedRemotePrinterId: string,
): string {
  if (apiMode === 'agent') {
    const printer = printers[0];
    const permissionNote =
      printer && !printer.hasPermission ? ' · permission needed' : '';
    if (agentStatus.state === 'connected') {
      return `Agent · ${agentStatus.agentName}${permissionNote}`;
    }
    return (agentStatus.message || 'Agent · connecting…') + permissionNote;
  }

  if (apiMode === 'client') {
    if (remotePrinters.length === 0) {
      return 'Remote · no printer online';
    }

    const selected =
      remotePrinters.find(printer => printer.id === selectedRemotePrinterId) ??
      remotePrinters[0];
    if (remotePrinters.length === 1) {
      return `Remote · ${selected.name}`;
    }

    return `Remote · ${remotePrinters.length} printers · ${selected.name}`;
  }

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
  apiMode: ApiPrinterMode;
  agentStatus: PrinterAgentStatus;
  showPrinterSettings: boolean;
  connection: PrinterConnection;
  networkIp: string;
  status: string;
  printers: ZebraUsbPrinter[];
  remotePrinters: RemotePrinter[];
  selectedRemotePrinterId: string;
  isBusy: boolean;
  onToggleSettings: () => void;
  onConnectionChange: (connection: PrinterConnection) => void;
  onNetworkIpChange: (ip: string) => void;
  onSelectRemotePrinter: (printerId: string) => void;
  onRefresh: () => void;
};

export class PrinterSection extends Component<PrinterSectionProps> {
  render() {
    const {
      apiMode,
      agentStatus,
      showPrinterSettings,
      connection,
      networkIp,
      status,
      printers,
      remotePrinters,
      selectedRemotePrinterId,
      isBusy,
      onToggleSettings,
      onConnectionChange,
      onNetworkIpChange,
      onSelectRemotePrinter,
      onRefresh,
    } = this.props;

    const useLegacyConnection = apiMode === 'off';

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
            {printerSummaryHint(
              apiMode,
              agentStatus,
              connection,
              networkIp,
              printers,
              remotePrinters,
              selectedRemotePrinterId,
            )}
          </Text>
        ) : null}
        {showPrinterSettings ? (
          <>
            {apiMode === 'agent' ? (
              <>
                <Text style={styles.offsetHint}>
                  USB printer detected — this device is registered as a print agent.
                </Text>
                <Text style={styles.status}>{status}</Text>
                {printers.map(printer => (
                  <Text key={printer.name} style={styles.printerText}>
                    {printer.productName || printer.name} ·{' '}
                    {printer.hasPermission ? 'allowed' : 'permission needed'}
                  </Text>
                ))}
              </>
            ) : null}
            {apiMode === 'client' ? (
              <>
                <View style={styles.offsetToolbar}>
                  <Text style={styles.sectionCaption}>Remote printers</Text>
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
                {remotePrinters.length === 0 ? (
                  <Text style={styles.offsetHint}>
                    No printer agent is online. Connect a device with a USB printer.
                  </Text>
                ) : (
                  remotePrinters.map(printer => (
                    <Pressable
                      key={printer.id}
                      onPress={() => onSelectRemotePrinter(printer.id)}
                      style={({pressed}) => [
                        styles.sizeButton,
                        selectedRemotePrinterId === printer.id &&
                          styles.selectedSizeButton,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.sizeButtonTitle,
                          selectedRemotePrinterId === printer.id &&
                            styles.selectedSizeButtonText,
                        ]}>
                        {printer.name}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            ) : null}
            {useLegacyConnection ? (
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
          </>
        ) : null}
      </View>
    );
  }
}
