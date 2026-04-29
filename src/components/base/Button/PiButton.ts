import '@components/base/Icon/PiIcon';
import './button.css';

export type ButtonVariant = 'primary' | 'accent' | 'ghost';

const VARIANTS: ReadonlySet<ButtonVariant> = new Set(['primary', 'accent', 'ghost']);

const isVariant = (value: string | null): value is ButtonVariant =>
  value !== null && (VARIANTS as Set<string>).has(value);

/**
 * `<pi-button variant="primary" icon="upload">Parcourir</pi-button>`
 */
export class PiButton extends HTMLElement {
  private button: HTMLButtonElement | null = null;

  static get observedAttributes(): string[] {
    return ['variant', 'icon', 'disabled'];
  }

  connectedCallback(): void {
    if (this.button) return;
    const labelHTML = this.innerHTML.trim();
    this.innerHTML = '';

    const button = document.createElement('button');
    button.className = 'pi-button';
    button.type = 'button';
    button.dataset.variant = this.resolveVariant();

    const icon = this.getAttribute('icon');
    if (icon) {
      const iconEl = document.createElement('pi-icon');
      iconEl.setAttribute('name', icon);
      iconEl.setAttribute('size', '14');
      button.appendChild(iconEl);
    }

    if (labelHTML) {
      const label = document.createElement('span');
      label.innerHTML = labelHTML;
      button.appendChild(label);
    }

    button.disabled = this.hasAttribute('disabled');
    button.addEventListener('click', this.handleClick);

    this.appendChild(button);
    this.button = button;
  }

  disconnectedCallback(): void {
    this.button?.removeEventListener('click', this.handleClick);
    this.button = null;
  }

  attributeChangedCallback(name: string): void {
    if (!this.button) return;
    if (name === 'variant') {
      this.button.dataset.variant = this.resolveVariant();
    } else if (name === 'disabled') {
      this.button.disabled = this.hasAttribute('disabled');
    } else if (name === 'icon') {
      this.connectedCallback();
    }
  }

  private resolveVariant(): ButtonVariant {
    const raw = this.getAttribute('variant');
    return isVariant(raw) ? raw : 'primary';
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.hasAttribute('disabled')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  };
}

if (!customElements.get('pi-button')) {
  customElements.define('pi-button', PiButton);
}

