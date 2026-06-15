import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
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
  networkIpField: {
    gap: 6,
  },
  networkIpLabel: {
    color: '#6d6a63',
    fontSize: 13,
    fontWeight: '700',
  },
  networkIpInput: {
    borderColor: '#d7cec0',
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    color: '#191919',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  activeKey: {
    backgroundColor: '#1d4ed8',
  },
  keyText: {
    color: '#191919',
    fontSize: 30,
    fontWeight: '800',
  },
  activeKeyText: {
    color: '#ffffff',
  },
  printButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  printButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111111',
    minHeight: 62,
  },
  printManyButtonActive: {
    backgroundColor: '#1d4ed8',
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
