require('react-native-owl/dist/client').initClient();

const {NativeModules} = require('react-native');

NativeModules.ZebraPrinter = {
  getUsbPrinters: async () => [],
  printZpl: async () => 'Label sent to printer',
  printZplToNetwork: async () => 'Label sent to printer',
};

NativeModules.BarcodeScanner = {
  scan: async () => '',
  scanQr: async () => '',
};

require('./index');
