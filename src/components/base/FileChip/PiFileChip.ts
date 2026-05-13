import '@components/base/Icon/PiIcon';
import html from './fileChip.html?raw';
import './fileChip.css';
import { subscribe, t } from '@i18n';

/**
 * `<pi-file-chip name="doc.pdf" meta="123 Ko" error?="true">`
 */
export class PiFileChip extends HTMLElement {
  private unsubscribeLang: (() => void) | null = null;

  static get observedAttributes(): string[] {
    return ['name', 'meta', 'error'];
  }

  connectedCallback(): void {
    this.render();
    this.unsubscribeLang = subscribe(() => this.render());
  }

  disconnectedCallback(): void {
    this.unsubscribeLang?.();
    this.unsubscribeLang = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const name = this.getAttribute('name') ?? '';
    const meta = this.getAttribute('meta') ?? '';
    const error = this.hasAttribute('error');
    const removeAria = t('fileChip.removeAria', { name });

    this.innerHTML = html
      .replace('__ERROR__', `${error}`)
      .replaceAll('__NAME_ATTR__', escapeAttr(name))
      .replace('__NAME__', escapeHtml(name))
      .replace('__META__', escapeHtml(meta))
      .replace('__REMOVE_ARIA__', escapeAttr(removeAria));

    this.querySelector<HTMLButtonElement>('.pi-file-chip__remove')?.addEventListener(
      'click',
      () => {
        this.dispatchEvent(
          new CustomEvent<void>('chip-remove', { bubbles: true, composed: true }),
        );
      },
    );
  }
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');

const escapeAttr = (s: string): string => escapeHtml(s).replace(/'/g, '&#39;');

if (!customElements.get('pi-file-chip')) {
  customElements.define('pi-file-chip', PiFileChip);
}

