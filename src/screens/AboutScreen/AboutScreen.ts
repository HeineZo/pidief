import template from './aboutScreen.html?raw';
import './aboutScreen.css';

export class AboutScreen extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = template;
  }
}

if (!customElements.get('pi-about-screen')) {
  customElements.define('pi-about-screen', AboutScreen);
}
