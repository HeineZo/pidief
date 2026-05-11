import './icon.css';

/**
 * Ic\u00f4nes inline SVG (line icons, stroke 1.8, rounded).
 * Align\u00e9 avec le DS Pidief : aucune font d'ic\u00f4nes externe.
 */

const ICON_PATHS = {
  upload:
    '<path d=\"M12 3v12m0 0l-4-4m4 4l4-4\"/><path d=\"M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2\"/>',
  download:
    '<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>',
  plus: '<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>',
  lock: '<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>',
  file: '<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/>',
  paste:
    '<rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>',
  x: '<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>',
  arrow: '<path d=\"M5 12h14M13 6l6 6-6 6\"/>',
  'arrow-left': '<path d=\"M19 12H5M11 18l-6-6 6-6\"/>',
  rotate:
    '<path d=\"M21 12a9 9 0 1 1-3.5-7.1\"/><polyline points=\"21 4 21 9 16 9\"/>',
  trash:
    '<polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/>',
  'grid-small':
    '<rect x=\"5\" y=\"5\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"13\" y=\"5\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"5\" y=\"13\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"13\" y=\"13\" width=\"6\" height=\"6\" rx=\"1\"/>',
  'grid-large':
    '<rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"3\" y=\"13\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"13\" y=\"13\" width=\"8\" height=\"8\" rx=\"1\"/>',
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

