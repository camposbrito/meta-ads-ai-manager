import { createContext, useContext, useState } from 'react';

export type AppLanguage = 'pt' | 'en' | 'es';

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const I18N_STORAGE_KEY = 'app_language_preference';

const DICTIONARY: Record<AppLanguage, Record<string, string>> = {
  pt: {
    'nav.dashboard': 'Dashboard',
    'nav.campaigns': 'Campanhas',
    'nav.optimization': 'Otimização',
    'nav.team': 'Equipe',
    'nav.settings': 'Configurações',
    'nav.billing': 'Planos',
    'nav.logout': 'Sair',
    'settings.title': 'Configurações',
    'settings.general': 'Geral',
    'settings.team': 'Equipe',
    'settings.integrations': 'Integrações',
    'settings.notifications': 'Notificações',
    'settings.language': 'Idioma do Site',
    'settings.language.active': 'Idioma ativo',
    'language.pt': 'Português',
    'language.en': 'English',
    'language.es': 'Español',
    'dashboard.title': 'Dashboard',
    'campaigns.title': 'Campanhas',
    'billing.title': 'Planos e Preços',
    'team.title': 'Equipe',
    'optimization.title': 'Otimização',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.campaigns': 'Campaigns',
    'nav.optimization': 'Optimization',
    'nav.team': 'Team',
    'nav.settings': 'Settings',
    'nav.billing': 'Plans',
    'nav.logout': 'Sign out',
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.team': 'Team',
    'settings.integrations': 'Integrations',
    'settings.notifications': 'Notifications',
    'settings.language': 'Site Language',
    'settings.language.active': 'Active language',
    'language.pt': 'Português',
    'language.en': 'English',
    'language.es': 'Español',
    'dashboard.title': 'Dashboard',
    'campaigns.title': 'Campaigns',
    'billing.title': 'Plans & Pricing',
    'team.title': 'Team',
    'optimization.title': 'Optimization',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.campaigns': 'Campañas',
    'nav.optimization': 'Optimización',
    'nav.team': 'Equipo',
    'nav.settings': 'Configuración',
    'nav.billing': 'Planes',
    'nav.logout': 'Salir',
    'settings.title': 'Configuración',
    'settings.general': 'General',
    'settings.team': 'Equipo',
    'settings.integrations': 'Integraciones',
    'settings.notifications': 'Notificaciones',
    'settings.language': 'Idioma del Sitio',
    'settings.language.active': 'Idioma activo',
    'language.pt': 'Português',
    'language.en': 'English',
    'language.es': 'Español',
    'dashboard.title': 'Panel',
    'campaigns.title': 'Campañas',
    'billing.title': 'Planes y Precios',
    'team.title': 'Equipo',
    'optimization.title': 'Optimización',
  },
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function detectInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'pt';
  }

  const stored = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (stored === 'pt' || stored === 'en' || stored === 'es') {
    return stored;
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith('en')) {
    return 'en';
  }
  if (browserLanguage.startsWith('es')) {
    return 'es';
  }

  return 'pt';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => detectInitialLanguage());

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(I18N_STORAGE_KEY, nextLanguage);
  };

  const t = (key: string, fallback?: string) => {
    return DICTIONARY[language][key] || fallback || key;
  };

  const value = {
    language,
    setLanguage,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
