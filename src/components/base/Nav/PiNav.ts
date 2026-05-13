import html from './nav.html?raw';
import './nav.css';

const LANGS = ['FR', 'EN'] as const;
type Lang = (typeof LANGS)[number];

const LANG_FULL_NAME: Record<Lang, string> = {
  FR: 'Français',
  EN: 'English',
};

const isLang = (value: string | null): value is Lang =>
  value !== null && (LANGS as readonly string[]).includes(value);

/**
 * <pi-nav lang=\"FR\"></pi-nav>
 *
 * \u00c9met `lang-changed` (CustomEvent<{ lang: Lang }>) lorsque l'utilisateur change la langue.
 */
export class PiNav extends HTMLElement {
  private readonly onPopState = (): void => {
    this.updateActiveLink();
  };
  private readonly onLocationChange = (): void => {
    this.updateActiveLink();
  };

  static get observedAttributes(): string[] {
    return ['lang'];
  }

  connectedCallback(): void {
    this.render();
    this.syncDocumentLang();
    window.addEventListener('popstate', this.onPopState);
    window.addEventListener('request-navigate', this.onLocationChange);
  }

  disconnectedCallback(): void {
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('request-navigate', this.onLocationChange);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.render();
      this.syncDocumentLang();
    }
  }

  private currentLang(): Lang {
    const raw = this.getAttribute('lang');
    return isLang(raw) ? raw : 'FR';
  }

  private syncDocumentLang(): void {
    const lang = this.currentLang();
    const code = lang === 'FR' ? 'fr' : 'en';
    if (document.documentElement.lang !== code) {
      document.documentElement.lang = code;
    }
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

  private render(): void {
    const lang = this.currentLang();
    const langButtons = LANGS.map(
      (l) =>
        `<button type="button" data-lang="${l}" data-active="${l === lang}" aria-pressed="${l === lang}" aria-label="${LANG_FULL_NAME[l]}">${l}</button>`,
    ).join('');

    this.innerHTML = html.replace('__LANG_BUTTONS__', langButtons);

    this.querySelector<HTMLButtonElement>('[data-nav="upload"]')?.addEventListener('click', () => {
      this.navigate('/');
    });

    this.querySelector<HTMLButtonElement>('[data-nav="about"]')?.addEventListener('click', () => {
      this.navigate('/about');
    });

    this.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.lang;
        if (isLang(next ?? null) && next !== this.currentLang()) {
          this.setAttribute('lang', next as Lang);
          this.dispatchEvent(
            new CustomEvent<{ lang: Lang }>('lang-changed', {
              detail: { lang: next as Lang },
              bubbles: true,
              composed: true,
            }),
          );
        }
      });
    });

    this.updateActiveLink();
  }
}

if (!customElements.get('pi-nav')) {
  customElements.define('pi-nav', PiNav);
}

