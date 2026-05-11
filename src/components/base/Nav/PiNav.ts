import html from './nav.html?raw';
import './nav.css';

const LANGS = ['FR', 'EN'] as const;
type Lang = (typeof LANGS)[number];

const isLang = (value: string | null): value is Lang =>
  value !== null && (LANGS as readonly string[]).includes(value);

/**
 * <pi-nav lang=\"FR\"></pi-nav>
 *
 * \u00c9met `lang-changed` (CustomEvent<{ lang: Lang }>) lorsque l'utilisateur change la langue.
 */
export class PiNav extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['lang'];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private currentLang(): Lang {
    const raw = this.getAttribute('lang');
    return isLang(raw) ? raw : 'FR';
  }

  private render(): void {
    const lang = this.currentLang();
    const langButtons = LANGS.map(
      (l) =>
        `<button type="button" data-lang="${l}" data-active="${l === lang}">${l}</button>`,
    ).join('');

    this.innerHTML = html.replace('__LANG_BUTTONS__', langButtons);

    this.querySelector<HTMLButtonElement>('[data-nav="about"]')?.addEventListener('click', () => {
      this.dispatchEvent(
        new CustomEvent<{ path: string }>('request-navigate', {
          detail: { path: '/about' },
          bubbles: true,
          composed: true,
        }),
      );
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
  }
}

if (!customElements.get('pi-nav')) {
  customElements.define('pi-nav', PiNav);
}

