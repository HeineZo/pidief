import html from './nav.html?raw';
import './nav.css';
import {
  applyTranslations,
  getCurrentLang,
  setLang,
  subscribe,
  t,
  type Lang,
} from '@i18n';

const LANGS: readonly Lang[] = ['fr', 'en'];

const LANG_LABEL_KEY: Record<Lang, string> = {
  fr: 'nav.langFr',
  en: 'nav.langEn',
};

const LANG_BUTTON_LABEL: Record<Lang, string> = {
  fr: 'FR',
  en: 'EN',
};

const isLang = (value: string | null): value is Lang =>
  value !== null && (LANGS as readonly string[]).includes(value);

/**
 * <pi-nav></pi-nav>
 *
 * Source de vérité de la langue : `@i18n.lang`. Le composant écoute
 * `lang-changed` pour ré-appliquer les libellés / l'état actif sans recharger.
 */
export class PiNav extends HTMLElement {
  private unsubscribeLang: (() => void) | null = null;

  private readonly onPopState = (): void => {
    this.updateActiveLink();
  };
  private readonly onLocationChange = (): void => {
    this.updateActiveLink();
  };

  connectedCallback(): void {
    this.render();
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('request-navigate', this.onLocationChange);
    this.unsubscribeLang = subscribe(() => this.onLangChanged());
  }

  disconnectedCallback(): void {
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('request-navigate', this.onLocationChange);
    this.unsubscribeLang?.();
    this.unsubscribeLang = null;
  }

  private navigate(path: string): void {
    this.dispatchEvent(
      new CustomEvent<{ path: string }>('request-navigate', {
        detail: { path },
        bubbles: true,
        composed: true,
      }),
    );
    queueMicrotask(() => this.updateActiveLink());
  }

  private updateActiveLink(): void {
    const path = window.location.pathname;
    const aboutBtn = this.querySelector<HTMLButtonElement>('[data-nav="about"]');
    if (aboutBtn) {
      if (path === '/about') {
        aboutBtn.setAttribute('aria-current', 'page');
      } else {
        aboutBtn.removeAttribute('aria-current');
      }
    }
  }

  private renderLangButtons(): string {
    const current = getCurrentLang();
    return LANGS.map((l) => {
      const active = l === current;
      const ariaLabel = t(LANG_LABEL_KEY[l]);
      return `<button type="button" data-lang="${l}" data-active="${active}" aria-pressed="${active}" aria-label="${ariaLabel}" data-i18n-attr="aria-label:${LANG_LABEL_KEY[l]}">${LANG_BUTTON_LABEL[l]}</button>`;
    }).join('');
  }

  private render(): void {
    this.innerHTML = html.replace('__LANG_BUTTONS__', this.renderLangButtons());
    applyTranslations(this);

    this.querySelector<HTMLButtonElement>('[data-nav="upload"]')?.addEventListener('click', () => {
      this.navigate('/');
    });

    this.querySelector<HTMLButtonElement>('[data-nav="about"]')?.addEventListener('click', () => {
      this.navigate('/about');
    });

    this.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (isLang(next ?? null) && next !== getCurrentLang()) {
          setLang(next as Lang);
        }
      });
    });

    this.updateActiveLink();
  }

  private onLangChanged(): void {
    applyTranslations(this);
    const current = getCurrentLang();
    this.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      const isActive = btn.dataset.lang === current;
      btn.dataset.active = String(isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }
}

if (!customElements.get('pi-nav')) {
  customElements.define('pi-nav', PiNav);
}
