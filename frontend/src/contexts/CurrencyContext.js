import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [taxName, setTaxName] = useState('Tax');
  const { API, getAuthHeader, user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`, { headers: getAuthHeader() });
      setCurrencySymbol(response.data.currency_symbol);
      setCurrencyCode(response.data.currency_code);
      setTaxEnabled(response.data.tax_enabled || false);
      setTaxRate(response.data.tax_rate || 0);
      setTaxName(response.data.tax_name || 'Tax');
    } catch (error) {
      console.error('Failed to fetch settings', error);
    }
  };

  const formatPrice = (price) => {
    return `${currencySymbol}${price.toFixed(2)}`;
  };

  const calculateTax = (subtotal) => {
    if (!taxEnabled) return 0;
    return (subtotal * taxRate) / 100;
  };

  const calculateTotal = (subtotal) => {
    return subtotal + calculateTax(subtotal);
  };

  const updateCurrency = async (symbol, code) => {
    try {
      await axios.put(`${API}/settings`, 
        { 
          currency_symbol: symbol, 
          currency_code: code,
          tax_enabled: taxEnabled,
          tax_rate: taxRate,
          tax_name: taxName
        },
        { headers: getAuthHeader() }
      );
      setCurrencySymbol(symbol);
      setCurrencyCode(code);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Failed to update currency' };
    }
  };

  const updateTaxSettings = async (enabled, rate, name) => {
    try {
      await axios.put(`${API}/settings`,
        {
          currency_symbol: currencySymbol,
          currency_code: currencyCode,
          tax_enabled: enabled,
          tax_rate: rate,
          tax_name: name
        },
        { headers: getAuthHeader() }
      );
      setTaxEnabled(enabled);
      setTaxRate(rate);
      setTaxName(name);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Failed to update tax settings' };
    }
  };

  return (
    <CurrencyContext.Provider value={{ 
      currencySymbol, 
      currencyCode, 
      taxEnabled,
      taxRate,
      taxName,
      formatPrice, 
      calculateTax,
      calculateTotal,
      updateCurrency,
      updateTaxSettings,
      refreshSettings: fetchSettings 
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
