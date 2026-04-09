'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import type { Language } from '@/lib/i18n';
import { detectPreferredLanguage } from '@/lib/i18n';

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {
  },
});

export function LanguageProvider({children}: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Try to get language from localStorage
    const stored = localStorage.getItem('preferred-language');
    if (stored === 'en' || stored === 'zh') {
      setLanguageState(stored);
    } else {
      // Detect from browser preference
      const detected = detectPreferredLanguage();
      setLanguageState(detected);
    }
    setIsHydrated(true);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem('preferred-language', newLanguage);
    // Update the html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLanguage === 'zh' ? 'zh-CN' : 'en';
    }
  };

  return (
    <LanguageContext.Provider value={{language, setLanguage}}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}


