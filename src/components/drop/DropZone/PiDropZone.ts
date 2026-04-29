/**
 * <pi-drop-zone accept=".pdf"></pi-drop-zone>
 *
 * Shadow DOM : isole l'overlay pulse-ring et l'\u00e9tat dragging.
 * Les CSS custom properties h\u00e9rit\u00e9es de :root traversent le shadow,
 * donc on r\u00e9utilise les tokens du DS (`--color-accent`, `--font-serif`, ...).
 *
 * \u00c9v\u00e9nements :
 *  - `files-dropped` (CustomEvent<{ files: File[] }>) : files d\u00e9pos\u00e9s ou s\u00e9lectionn\u00e9s
 */

import html from './dropzone.html?raw';
import css from './dropzone.css?raw';

const TEMPLATE = `<style>${css}</style>${html}`;

export class PiDropZone extends HTMLElement {
  private wrap: HTMLDivElement | null = null;
  private input: HTMLInputElement | null = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    const root = this.shadowRoot;
    if (!root) return;

    this.wrap = root.querySelector<HTMLDivElement>('.wrap');
    this.input = root.querySelector<HTMLInputElement>('input[type=\"file\"]');

    if (!this.wrap || !this.input) return;

    const accept = this.getAttribute('accept');
    if (accept) this.input.accept = accept;

    this.wrap.addEventListener('dragover', this.onDragOver);
    this.wrap.addEventListener('dragleave', this.onDragLeave);
    this.wrap.addEventListener('drop', this.onDrop);
    this.input.addEventListener('change', this.onInputChange);
  }

  disconnectedCallback(): void {
    this.wrap?.removeEventListener('dragover', this.onDragOver);
    this.wrap?.removeEventListener('dragleave', this.onDragLeave);
    this.wrap?.removeEventListener('drop', this.onDrop);
    this.input?.removeEventListener('change', this.onInputChange);
  }

  /**
   * D\u00e9clenche l'ouverture de la bo\u00eete de dialogue de fichiers.
   * Expos\u00e9 publiquement pour que l'\u00e9cran parent puisse y brancher un bouton.
   */
  openFileDialog(): void {
    this.input?.click();
  }

  private onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (this.wrap) this.wrap.dataset.dragging = 'true';
  };

  private onDragLeave = (event: DragEvent): void => {
    if (event.target === this.wrap?.querySelector('.zone')) return;
    if (this.wrap) this.wrap.dataset.dragging = 'false';
  };

  private onDrop = (event: DragEvent): void => {
    event.preventDefault();
    if (this.wrap) this.wrap.dataset.dragging = 'false';
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) this.emitFiles(Array.from(files));
  };

  private onInputChange = (): void => {
    if (!this.input?.files) return;
    const files = Array.from(this.input.files);
    if (files.length > 0) this.emitFiles(files);
    this.input.value = '';
  };

  private emitFiles(files: File[]): void {
    const accept = this.getAttribute('accept');
    const filtered =
      accept === '.pdf'
        ? files.filter(
            (f) =>
              f.type === 'application/pdf' ||
              f.name.toLowerCase().endsWith('.pdf'),
          )
        : files;

    if (filtered.length === 0) return;

    this.dispatchEvent(
      new CustomEvent<{ files: File[] }>('files-dropped', {
        detail: { files: filtered },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get('pi-drop-zone')) {
  customElements.define('pi-drop-zone', PiDropZone);
}

