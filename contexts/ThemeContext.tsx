import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSecure, saveSecure } from '../utils/storage';

const STORAGE_KEY = 'vesper_theme';

export interface ThemeColors {
  bgStart: string;
  bgEnd: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  entryFill: string;
  entryPlaceholder: string;
  entryFillPressed: string;
  separator: string;
}

export interface ThemeDefinition {
  name: string;
  colors: ThemeColors;
}

export const THEMES: ThemeDefinition[] = [
  {
    name: 'Golden Hour',
    colors: {
      bgStart: '#1C0D06',
      bgEnd: '#3D1822',
      textPrimary: '#FDF8F2',
      textSecondary: 'rgba(253,248,242,0.70)',
      textMuted: 'rgba(253,248,242,0.55)',
      entryFill: 'rgba(255,255,255,0.09)',
      entryPlaceholder: 'rgba(255,255,255,0.45)',
      entryFillPressed: 'rgba(255,255,255,0.14)',
      separator: 'rgba(255,255,255,0.10)',
    },
  },
  {
    name: 'Candlelight',
    colors: {
      bgStart: '#1A0B00',
      bgEnd: '#2E1A0A',
      textPrimary: '#FEF5E4',
      textSecondary: 'rgba(254,245,228,0.70)',
      textMuted: 'rgba(254,245,228,0.55)',
      entryFill: 'rgba(255,255,255,0.09)',
      entryPlaceholder: 'rgba(255,255,255,0.45)',
      entryFillPressed: 'rgba(255,255,255,0.14)',
      separator: 'rgba(255,255,255,0.10)',
    },
  },
  {
    name: 'Shoreline',
    colors: {
      bgStart: '#071318',
      bgEnd: '#0C2535',
      textPrimary: '#E8F4F8',
      textSecondary: 'rgba(232,244,248,0.70)',
      textMuted: 'rgba(232,244,248,0.55)',
      entryFill: 'rgba(255,255,255,0.09)',
      entryPlaceholder: 'rgba(255,255,255,0.45)',
      entryFillPressed: 'rgba(255,255,255,0.14)',
      separator: 'rgba(255,255,255,0.10)',
    },
  },
  {
    name: 'Overcast',
    colors: {
      bgStart: '#101215',
      bgEnd: '#1C2130',
      textPrimary: '#E8EAF0',
      textSecondary: 'rgba(232,234,240,0.70)',
      textMuted: 'rgba(232,234,240,0.55)',
      entryFill: 'rgba(255,255,255,0.09)',
      entryPlaceholder: 'rgba(255,255,255,0.45)',
      entryFillPressed: 'rgba(255,255,255,0.14)',
      separator: 'rgba(255,255,255,0.10)',
    },
  },
];

interface ThemeContextValue {
  theme: ThemeDefinition;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeIndex, setThemeIndex] = useState(0);

  useEffect(() => {
    getSecure(STORAGE_KEY).then(val => {
      if (val !== null) {
        const idx = parseInt(val, 10);
        if (!isNaN(idx) && idx >= 0 && idx < THEMES.length) setThemeIndex(idx);
      }
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeIndex(prev => {
      const next = (prev + 1) % THEMES.length;
      saveSecure(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeIndex], cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
