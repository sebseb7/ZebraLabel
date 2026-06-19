/**
 * @format
 */

import React from 'react';
import {NativeModules} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

NativeModules.ZebraPrinter = {
  getUsbPrinters: jest.fn().mockResolvedValue([]),
  printZpl: jest.fn().mockResolvedValue('Label sent to printer'),
  printZplToNetwork: jest.fn().mockResolvedValue('Label sent to printer'),
};

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
