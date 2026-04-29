import '@components/base/Button/PiButton';
import '@components/base/FileChip/PiFileChip';
import '@components/drop/DropZone/PiDropZone';
import type { PiDropZone } from '@components/drop/DropZone/PiDropZone';
import template from './uploadScreen.html?raw';
import './uploadScreen.css';
import { formatBytes } from '@util/formatBytes';

interface UploadFile {
  id: string;
  file: File;
}

const newId = (): string =>
  `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class UploadScreen extends HTMLElement {
  private files: UploadFile[] = [];

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    this.innerHTML = template;

    this.bindEvents();
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
        // Stub V1 : la lecture clipboard PDF arrivera avec l'int\u00e9gration mupdf.
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

  private addFiles(incoming: File[]): void {
    const items = incoming.map((file) => ({ id: newId(), file }));
    this.files = [...this.files, ...items];
    this.refreshFilesRegion();
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

