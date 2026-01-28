import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('system');

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    if (newTheme === 'system') {
      Appearance.setColorScheme(null);
    } else {
      Appearance.setColorScheme(newTheme);
    }
  };

  // Al montar, leer el tema actual
  useEffect(() => {
    const current = Appearance.getColorScheme();
    setTheme(current || 'system');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);