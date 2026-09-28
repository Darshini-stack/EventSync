import React, { createContext, useContext, useState, useCallback } from 'react';
import { EventRegistrationScannerModal } from '../components/EventRegistrationScannerModal';

const EventScannerContext = createContext(null);

export const EventScannerProvider = ({ children }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerOptions, setScannerOptions] = useState({
    mode: 'camera',
    initialValue: '',
  });

  const openEventScanner = useCallback((options = {}) => {
    setScannerOptions({
      mode: options.mode || 'camera',
      initialValue: options.initialValue || '',
    });
    setIsScannerOpen(true);
  }, []);

  const closeEventScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  const value = {
    isScannerOpen,
    openEventScanner,
    closeEventScanner,
  };

  return (
    <EventScannerContext.Provider value={value}>
      {children}
      <EventRegistrationScannerModal
        isOpen={isScannerOpen}
        onClose={closeEventScanner}
        initialMode={scannerOptions.mode}
        initialValue={scannerOptions.initialValue}
      />
    </EventScannerContext.Provider>
  );
};

export const useEventScanner = () => {
  const context = useContext(EventScannerContext);
  if (!context) {
    throw new Error('useEventScanner must be used within an EventScannerProvider');
  }
  return context;
};
