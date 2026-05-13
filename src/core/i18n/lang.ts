/**
 * Gestion centralisée de la langue de l'application.
 *
 * Source de vérité unique : `currentLang` (cache module).
 * Sync `document.documentElement.lang`, persiste dans `localStorage` et émet
 * un événement `lang-changed` sur `window` pour que les composants se mettent
 * à jour sans recharger la page.
 */

export type Lang = 'fr' | 'en';

export const SUPPORTED_LANGS: readonly Lang[] = ['fr', 'en'] as const;

const STORAGE_KEY = 'pidief.lang';

let currentLang: Lang = 'fr';

const isLang = (value: unknown): value is Lang =>
  value === 'fr' || value === 'en';

/**
 * Résout la langue préférée : `localStorage` (si valeur valide) →
 * `navigator.language` (préfixe `fr`) → fallback anglais.
 */
export function getPreferredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage peut throw en mode privé / sandbox
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language.toLowerCase() : '';
  if (nav.startsWith('fr')) return 'fr';
  return 'en';
}

export function getCurrentLang(): Lang {
  return currentLang;
}

/**
 * Définit la langue active. Synchronise `<html lang>`, persiste le choix et
 * émet `lang-changed` (CustomEvent<{ lang: Lang }>) sur `window`.
 *
 * Idempotent : si la langue ne change pas, ne re-dispatch pas l'événement
 * mais re-synchronise quand même `<html lang>` (utile au bootstrap).
 */
export function setLang(lang: Lang): void {
  if (!isLang(lang)) return;
  const changed = currentLang !== lang;
  currentLang = lang;
  syncDocumentLang();
  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore quota / privacy errors
    }
    window.dispatchEvent(
      new CustomEvent<{ lang: Lang }>('lang-changed', { detail: { lang } }),
    );
  }
}

function syncDocumentLang(): void {
  if (typeof document === 'undefined') return;
  if (document.documentElement.lang !== currentLang) {
    document.documentElement.lang = currentLang;
  }
}

/**
 * Abonne `cb` à `lang-changed`. Retourne une fonction d'unsubscribe.
 */
export function subscribe(cb: (lang: Lang) => void): () => void {
  const handler = (event: Event): void => {
    const ce = event as CustomEvent<{ lang: Lang }>;
    cb(ce.detail.lang);
  };
  window.addEventListener('lang-changed', handler);
  return () => window.removeEventListener('lang-changed', handler);
}
