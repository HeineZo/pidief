import '@components/base/Nav/PiNav';
import '@screens/UploadScreen/UploadScreen';
import template from './pidiefApp.html?raw';

export class PidiefApp extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = template;

    this.addEventListener('files-ready', (event) => {
      const detail = (event as CustomEvent<{ files: File[] }>).detail;
      console.info('[pidief] files ready:', detail.files);
    });
  }
}

if (!customElements.get('pidief-app')) {
  customElements.define('pidief-app', PidiefApp);
}

