import '@components/base/Button/PiButton';
import '@components/base/FileChip/PiFileChip';
import '@components/drop/DropZone/PiDropZone';
import type { PiDropZone } from '@components/drop/DropZone/PiDropZone';
import template from './uploadScreen.html?raw';
import './uploadScreen.css';
import { sendError } from '@util/Toast';
import { formatBytes } from '@util/formatBytes';
import { getPasteShortcutLabel } from '@util/GetPasteShortcutLabel';

interface UploadFile {
  id: string;
  file: File;
}

const newId = (): string =>
  `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class UploadScreen extends HTMLElement {
  private files: UploadFile[] = [];

  private onWindowPaste = (event: ClipboardEvent): void => {
    void this.handlePasteEvent(event);
  };

  connectedCallback(): void {
    this.render();
    window.addEventListener('paste', this.onWindowPaste);
  }

  disconnectedCallback(): void {
    window.removeEventListener('paste', this.onWindowPaste);
  }

  private render(): void {
    this.innerHTML = template;

    this.bindEvents();
    this.refreshPasteButtonLabel();
    this.refreshFilesRegion();
  }

  private bindEvents(): void {
    const dropZone = this.querySelector<PiDropZone>('pi-drop-zone');
    dropZone?.addEventListener('files-dropped', (event) => {
      const { files } = (event as CustomEvent<{ files: File[] }>).detail;
      this.addFiles(files);
    });

    this.querySelector<HTMLElement>('[data-action=\"browse\"]')?.addEventListener(
      'click',
      () => {
        dropZone?.openFileDialog();
      },
    );

    this.querySelector<HTMLElement>('[data-action=\"paste\"]')?.addEventListener(
      'click',
      () => {
        void this.pasteFromClipboard();
      },
    );

    this.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener(
      'click',
      () => {
        this.files = [];
        this.refreshFilesRegion();
      },
    );

    this.querySelector<HTMLElement>('[data-action=\"continue\"]')?.addEventListener(
      'click',
      () => {
        this.dispatchEvent(
          new CustomEvent<{ files: File[] }>('files-ready', {
            detail: { files: this.files.map((f) => f.file) },
            bubbles: true,
            composed: true,
          }),
        );
      },
    );
  }

  private refreshPasteButtonLabel(): void {
    const pasteHost = this.querySelector<HTMLElement>('[data-action=\"paste\"]');
    if (!pasteHost) return;
    const labelSpan = pasteHost.querySelector<HTMLSpanElement>('button.pi-button span');
    if (labelSpan) {
      labelSpan.textContent = `Coller ${getPasteShortcutLabel()}`;
    }
  }

  private addFiles(incoming: File[]): void {
    const items = incoming
      .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => ({ id: newId(), file }));
    this.files = [...this.files, ...items];
    this.refreshFilesRegion();
  }

  private getPdfFilesFromDataTransfer(data: DataTransfer | null): File[] {
    if (!data) return [];

    const fromFiles = Array.from(data.files).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (fromFiles.length > 0) return fromFiles;

    const items = Array.from(data.items);
    const fromItems = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    return fromItems;
  }

  private async handlePasteEvent(event: ClipboardEvent): Promise<void> {
    const pdfFiles = this.getPdfFilesFromDataTransfer(event.clipboardData);
    if (pdfFiles.length === 0) return;

    event.preventDefault();
    this.addFiles(pdfFiles);
  }

  private async pasteFromClipboard(): Promise<void> {
    const pasteShortcut = getPasteShortcutLabel();

    if (!('clipboard' in navigator)) {
      sendError(
        `Votre navigateur ne permet pas de lire le presse-papier ici. Utilisez plutôt ${pasteShortcut}`,
      );
    }

    if (!('read' in navigator.clipboard)) {
      sendError(
        `Cliquez dans la page puis utilisez ${pasteShortcut} pour coller un PDF`,
      );
    }

    let items: ClipboardItem[];
    try {
      items = await navigator.clipboard.read();
    } catch {
      sendError(
        `Impossible d'accéder au presse-papier. Cliquez dans la page puis utilisez ${pasteShortcut} (acceptez la permission si le navigateur la demande)`,
      );
    }

    const pdfFiles: File[] = [];
    for (const item of items) {
      if (!item.types.includes('application/pdf')) continue;

      const blob = await item.getType('application/pdf');
      const ts = new Date().toISOString().replaceAll(':', '-');
      pdfFiles.push(new File([blob], `clipboard-${ts}.pdf`, { type: 'application/pdf' }));
    }

    if (pdfFiles.length === 0) {
      sendError('Aucun PDF dans le presse-papier');
    }

    this.addFiles(pdfFiles);
  }

  private removeFile(id: string): void {
    this.files = this.files.filter((f) => f.id !== id);
    this.refreshFilesRegion();
  }

  private refreshFilesRegion(): void {
    const region = this.querySelector<HTMLDivElement>('[data-files-region]');
    const count = this.querySelector<HTMLSpanElement>('[data-count]');
    const chipsHost = this.querySelector<HTMLDivElement>('[data-chips]');
    const clearButton = this.querySelector<HTMLButtonElement>('[data-clear]');
    const continueCta = this.querySelector<HTMLDivElement>('[data-continue-cta]');
    if (!region || !count || !chipsHost || !clearButton || !continueCta) return;

    const hasFiles = this.files.length > 0;
    const plural = this.files.length > 1 ? 's' : '';
    count.textContent = `${this.files.length} fichier${plural} ajouté${plural}`;
    count.hidden = !hasFiles;
    clearButton.hidden = !hasFiles;
    continueCta.hidden = !hasFiles;

    if (!hasFiles) {
      region.hidden = true;
      chipsHost.innerHTML = '';
      return;
    }

    region.hidden = false;

    chipsHost.innerHTML = '';
    this.files.forEach((item) => {
      const chip = document.createElement('pi-file-chip');
      chip.setAttribute('name', item.file.name);
      chip.setAttribute('meta', formatBytes(item.file.size));
      chip.addEventListener('chip-remove', () => this.removeFile(item.id));
      chipsHost.appendChild(chip);
    });
  }
}

if (!customElements.get('pi-upload-screen')) {
  customElements.define('pi-upload-screen', UploadScreen);
}

