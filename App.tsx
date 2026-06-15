import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppContent} from './src/components/AppContent';

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

export default App;
