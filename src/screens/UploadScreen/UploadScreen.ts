import '@components/base/Button/PiButton';
import '@components/base/FileChip/PiFileChip';
import '@components/drop/DropZone/PiDropZone';
import type { PiDropZone } from '@components/drop/DropZone/PiDropZone';
import template from './uploadScreen.html?raw';
import './uploadScreen.css';
import { sendError, sendWarning } from '@util/Toast';
import { MAX_UPLOAD_PDFS } from '@util/uploadPdfLimits';
import { formatBytes } from '@util/formatBytes';
import { getPasteShortcutLabel } from '@util/GetPasteShortcutLabel';
import { scrollToBottom } from '@util/scrollToBottom';
import { PdfEngine } from '@core/pdf/PdfEngine';

interface UploadFile {
  id: string;
  file: File;
}

const newId = (): string =>
  `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class UploadScreen extends HTMLElement {
  private files: UploadFile[] = [];
  private pasteHoverTimeoutId: number | null = null;

  private onWindowPaste = (event: ClipboardEvent): void => {
    void this.handlePasteEvent(event);
  };

  private onWindowKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key !== 'v') return;
    if (!(event.ctrlKey || event.metaKey)) return;

    this.flashPasteButtonHover();
  };

  connectedCallback(): void {
    this.render();
    window.addEventListener('paste', this.onWindowPaste);
    window.addEventListener('keydown', this.onWindowKeyDown);
    PdfEngine.shared().warmup();
  }

  disconnectedCallback(): void {
    window.removeEventListener('paste', this.onWindowPaste);
    window.removeEventListener('keydown', this.onWindowKeyDown);
    if (this.pasteHoverTimeoutId !== null) {
      window.clearTimeout(this.pasteHoverTimeoutId);
      this.pasteHoverTimeoutId = null;
    }
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
      this.addFiles(files, true);
    });

    this.querySelectorAll<HTMLElement>('[data-action="browse"]').forEach((el) => {
      el.addEventListener('click', () => {
        dropZone?.openFileDialog();
      });
    });

    this.querySelector<HTMLElement>('[data-action="paste"]')?.addEventListener(
      'click',
      () => {
        void this.pasteFromClipboard();
      },
    );

    this.querySelector<HTMLButtonElement>('[data-action="about"]')?.addEventListener(
      'click',
      () => {
        this.dispatchEvent(
          new CustomEvent<{ path: string }>('request-navigate', {
            detail: { path: '/about' },
            bubbles: true,
            composed: true,
          }),
        );
      },
    );

    this.querySelector<HTMLButtonElement>('[data-clear]')?.addEventListener(
      'click',
      () => {
        this.files = [];
        this.refreshFilesRegion();
      },
    );

    this.querySelector<HTMLElement>('[data-action="continue"]')?.addEventListener(
      'click',
      () => this.emitFilesReady(),
    );
  }

  private emitFilesReady(): void {
    const selectedFiles = this.files.map((item) => item.file);
    if (selectedFiles.length === 0) return;
    this.dispatchEvent(
      new CustomEvent<{ files: File[] }>('files-ready', {
        detail: { files: selectedFiles },
        bubbles: true,
        composed: true,
      }),
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

  private flashPasteButtonHover(): void {
    const pasteHost = this.querySelector<HTMLElement>('[data-action="paste"]');
    if (!pasteHost) return;

    const button = pasteHost.querySelector<HTMLButtonElement>('button.pi-button');
    if (!button) return;

    if (this.pasteHoverTimeoutId !== null) {
      window.clearTimeout(this.pasteHoverTimeoutId);
      this.pasteHoverTimeoutId = null;
    }

    button.classList.add('is-kbd-hover');
    this.pasteHoverTimeoutId = window.setTimeout(() => {
      button.classList.remove('is-kbd-hover');
      this.pasteHoverTimeoutId = null;
    }, 220);
  }

  private addFiles(incoming: File[], shouldScroll = false): void {
    const items = incoming
      .filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
      .map((file) => ({ id: newId(), file }));
    if (items.length === 0) return;

    const remaining = MAX_UPLOAD_PDFS - this.files.length;
    if (remaining <= 0) {
      sendWarning(
        `Limite de ${MAX_UPLOAD_PDFS} fichiers PDF atteinte. Retirez des fichiers pour en ajouter d'autres.`,
      );
      return;
    }

    const accepted = items.slice(0, remaining);
    const skipped = items.length - accepted.length;

    this.files = [...this.files, ...accepted];
    this.refreshFilesRegion();

    if (skipped > 0) {
      sendWarning(
        skipped === 1
          ? `Un fichier n'a pas été ajouté : limite de ${MAX_UPLOAD_PDFS} PDF.`
          : `${skipped} fichiers n'ont pas été ajoutés : limite de ${MAX_UPLOAD_PDFS} PDF.`,
      );
    }

    if (shouldScroll) {
      scrollToBottom();
    }
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

  private shouldIgnorePasteTarget(target: EventTarget | null): boolean {
    if (!target) return false;
    if (!(target instanceof HTMLElement)) return false;

    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (target.isContentEditable) return true;

    return false;
  }

  private async handlePasteEvent(event: ClipboardEvent): Promise<void> {
    if (this.shouldIgnorePasteTarget(event.target)) return;

    const pdfFiles = this.getPdfFilesFromDataTransfer(event.clipboardData);
    if (pdfFiles.length === 0) {
      sendError('Aucun PDF dans le presse-papier');
      return;
    }

    event.preventDefault();
    this.addFiles(pdfFiles);
  }

  private async pasteFromClipboard(): Promise<void> {
    const pasteShortcut = getPasteShortcutLabel();

    if (!('clipboard' in navigator)) {
      sendError(
        `Votre navigateur ne permet pas de lire le presse-papier ici. Utilisez plutôt ${pasteShortcut}`,
      );
      return;
    }

    if (!('read' in navigator.clipboard)) {
      sendError(
        `Cliquez dans la page puis utilisez ${pasteShortcut} pour coller un PDF`,
      );
      return;
    }

    let items: ClipboardItem[];
    try {
      items = await navigator.clipboard.read();
    } catch {
      sendError(
        `Impossible d'accéder au presse-papier. Cliquez dans la page puis utilisez ${pasteShortcut} (acceptez la permission si le navigateur la demande)`,
      );
      return;
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
      return;
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
    const n = this.files.length;
    const plural = n > 1 ? 's' : '';
    count.textContent = `${n} / ${MAX_UPLOAD_PDFS} fichier${plural} PDF ajouté${plural}`;
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

