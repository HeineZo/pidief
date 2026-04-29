import './icon.css';

/**
 * Ic\u00f4nes inline SVG (line icons, stroke 1.8, rounded).
 * Align\u00e9 avec le DS Pidief : aucune font d'ic\u00f4nes externe.
 */

const ICON_PATHS = {
  upload:
    '<path d=\"M12 3v12m0 0l-4-4m4 4l4-4\"/><path d=\"M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2\"/>',
  file: '<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/>',
  paste:
    '<rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>',
  x: '<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>',
  arrow: '<path d=\"M5 12h14M13 6l6 6-6 6\"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

const isIconName = (value: string | null): value is IconName =>
  value !== null && value in ICON_PATHS;

/**
 * <pi-icon name=\"upload\" size=\"16\" stroke=\"1.8\"></pi-icon>
 */
export class PiIcon extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['name', 'size', 'stroke'];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const name = this.getAttribute('name');
    if (!isIconName(name)) {
      this.innerHTML = '';
      return;
    }
    const size = this.getAttribute('size') ?? '16';
    const stroke = this.getAttribute('stroke') ?? '1.8';

    this.innerHTML = `<svg width=\"${size}\" height=\"${size}\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"${stroke}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">${ICON_PATHS[name]}</svg>`;
  }
}

if (!customElements.get('pi-icon')) {
  customElements.define('pi-icon', PiIcon);
}

