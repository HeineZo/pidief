import '@components/base/Nav/PiNav';
import '@screens/AboutScreen/AboutScreen';
import '@screens/UploadScreen/UploadScreen';
import '@screens/EditScreen/EditScreen';
import { PdfEngine } from '@core/pdf/PdfEngine';
import { EditScreen, type EditScreenFile } from '@screens/EditScreen/EditScreen';
import template from './pidiefApp.html?raw';
import { sendError } from '@util/Toast';
import { t } from '@i18n';

export class PidiefApp extends HTMLElement {
  private routeHost: HTMLElement | null = null;
  private currentSlots: EditScreenFile[] | null = null;

  private readonly onPopState = (): void => {
    this.renderRoute();
  };

  connectedCallback(): void {
    this.innerHTML = template;
    this.routeHost = this.querySelector<HTMLElement>('[data-route-host]');

    window.addEventListener('popstate', this.onPopState);

    this.addEventListener('files-ready', (event) => {
      void this.onFilesReady(event as CustomEvent<{ files: File[] }>);
    });

    this.addEventListener('request-back', () => {
      history.pushState({}, '', '/');
      this.renderRoute();
    });

    this.addEventListener('request-navigate', (event: Event) => {
      const detail = (event as CustomEvent<{ path: string }>).detail;
      history.pushState({}, '', detail.path);
      this.renderRoute();
    });

    this.renderRoute();
  }

  disconnectedCallback(): void {
    window.removeEventListener('popstate', this.onPopState);
  }

  private async onFilesReady(event: CustomEvent<{ files: File[] }>): Promise<void> {
    const { files } = event.detail;
    const engine = PdfEngine.shared();
    const slots: EditScreenFile[] = [];
    try {
      for (const file of files) {
        slots.push({ doc: await engine.open(file), fileName: file.name });
      }
      this.currentSlots = slots;
      history.pushState({}, '', '/edit');
      this.renderRoute();
    } catch (err) {
      await Promise.all(slots.map((s) => s.doc.close()));
      console.error('[pidief] Ouverture PDF impossible:', err);
      sendError(t('app.openPdfFailed'));
    }
  }

  private renderRoute(): void {
    const host = this.routeHost;
    if (!host) return;

    let path = window.location.pathname;
    if (path !== '/' && path !== '/edit' && path !== '/about') {
      path = '/';
      history.replaceState({}, '', '/');
    }

    if (path === '/edit' && this.currentSlots?.length) {
      host.replaceChildren();
      const edit = document.createElement('pi-edit-screen');
      (edit as EditScreen).docs = this.currentSlots;
      host.append(edit);
      return;
    }

    if (path === '/edit' && !this.currentSlots?.length) {
      history.replaceState({}, '', '/');
      path = '/';
    }

    if (path === '/about') {
      host.replaceChildren();
      host.append(document.createElement('pi-about-screen'));
      return;
    }

    host.replaceChildren();
    this.currentSlots = null;
    host.append(document.createElement('pi-upload-screen'));
  }
}

if (!customElements.get('pidief-app')) {
  customElements.define('pidief-app', PidiefApp);
}
