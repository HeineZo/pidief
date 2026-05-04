import '@components/base/Nav/PiNav';
import '@screens/UploadScreen/UploadScreen';
import { PdfEngine } from '@core/pdf/PdfEngine';
import template from './pidiefApp.html?raw';

export class PidiefApp extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = template;

    this.addEventListener('files-ready', (event) => {
      void this.onFilesReady(event as CustomEvent<{ files: File[] }>);
    });
  }

  private async onFilesReady(event: CustomEvent<{ files: File[] }>): Promise<void> {
    const { files } = event.detail;
    try {
      const engine = PdfEngine.shared();
      const docs = await Promise.all(files.map((file) => engine.open(file)));
      console.info(
        '[pidief] PDFs ouverts:',
        docs.map((d) => ({ id: d.id, pages: d.pageCount })),
      );
    } catch (err) {
      console.error('[pidief] Ouverture PDF impossible:', err);
    }
  }
}

if (!customElements.get('pidief-app')) {
  customElements.define('pidief-app', PidiefApp);
}

