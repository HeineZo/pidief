import '@components/base/Icon/PiIcon';
import type { PdfDocument } from '@core/pdf/PdfDocument';
import template from './pageCard.html?raw';
import './pageCard.css';
import type { PageTint } from './palette';

export type PageCardAction = 'rotate' | 'delete';
/** Direction émise par `page-move` pour le swap clavier dans la grille d’édition. */
export type PageMoveDirection = 'left' | 'right' | 'up' | 'down';

const ACTIONS: ReadonlySet<PageCardAction> = new Set(['rotate', 'delete']);

const isAction = (value: string | null): value is PageCardAction =>
  value !== null && (ACTIONS as Set<string>).has(value);

const KEY_TO_DIRECTION: Record<string, PageMoveDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export class PiPageCard extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['page-index', 'file-name', 'display-order', 'original-page', 'total-pages'];
  }

  private _doc: PdfDocument | null = null;
  private _tint: PageTint | null = null;
  private _abort = new AbortController();
  private _drawToken = 0;
  private _layoutAttempts = 0;
  private _actionsBound = false;
  private _keyboardBound = false;

  set doc(value: PdfDocument | null) {
    this._doc = value;
    if (this.isConnected) this.scheduleDraw();
  }

  get doc(): PdfDocument | null {
    return this._doc;
  }

  set tint(value: PageTint | null) {
    this._tint = value;
    this.applyTintVars();
    this.updateFooter();
  }

  get tint(): PageTint | null {
    return this._tint;
  }

  invalidate(): void {
    if (this.isConnected) this.scheduleDraw();
  }

  /**
   * Monte le template, rend la carte focusable (`tabindex`, `aria-roledescription`) et branche
   * clavier / actions pour l’accessibilité.
   */
  connectedCallback(): void {
    this._abort = new AbortController();
    if (!this.querySelector('.pi-page-card')) {
      this.innerHTML = template;
    }
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    if (!this.hasAttribute('aria-roledescription')) {
      this.setAttribute('aria-roledescription', 'Page déplaçable');
    }
    this.bindActions();
    this.bindKeyboard();
    this.applyTintVars();
    this.updateFooter();
    this.scheduleDraw();
  }

  disconnectedCallback(): void {
    this._abort.abort();
  }

  attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
    if (!this.isConnected) return;
    this.updateFooter();
    if (name === 'page-index') this.scheduleDraw();
  }

  private bindActions(): void {
    if (this._actionsBound) return;
    this._actionsBound = true;
    this.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest<HTMLElement>('[data-action]');
      if (!btn || !this.contains(btn)) return;
      const action = btn.dataset.action;
      if (!isAction(action ?? null)) return;
      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent<{ action: PageCardAction }>('page-action', {
          detail: { action: action as PageCardAction },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  /**
   * Clavier sur l’élément hôte uniquement (`event.target === this`) :
   * - **Entrée** : rend les boutons `[data-action]` tabulables et focus le premier (Pivoter).
   * - **Flèches** : émet `page-move` (sauf avec Shift, pour laisser Shift+Tab sortir des actions).
   * - **focusout** : si le focus quitte la carte, repasse les boutons en `tabindex=-1` pour que Tab
   *   enchaîne uniquement les cadres.
   */
  private bindKeyboard(): void {
    if (this._keyboardBound) return;
    this._keyboardBound = true;
    this.addEventListener('keydown', (event) => {
      if (event.target !== this) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        const firstAction = this.querySelector<HTMLButtonElement>('[data-action]');
        if (!firstAction) return;
        event.preventDefault();
        event.stopPropagation();
        this.setActionsTabbable(true);
        firstAction.focus();
        return;
      }
      if (event.shiftKey) return;
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent<{ direction: PageMoveDirection }>('page-move', {
          detail: { direction },
          bubbles: true,
          composed: true,
        }),
      );
    });
    this.addEventListener('focusout', (event) => {
      const next = (event.relatedTarget as Node | null) ?? null;
      if (next && this.contains(next)) return;
      this.setActionsTabbable(false);
    });
  }

  /**
   * @param tabbable - `true` : les boutons d’action entrent dans l’ordre de tabulation ; `false` : `tabindex=-1`.
   */
  private setActionsTabbable(tabbable: boolean): void {
    const buttons = this.querySelectorAll<HTMLButtonElement>('[data-action]');
    buttons.forEach((btn) => {
      btn.tabIndex = tabbable ? 0 : -1;
    });
  }

  private applyTintVars(): void {
    const t = this._tint;
    if (!t) return;
    this.style.setProperty('--pi-page-tint-bg', t.tintBg);
    this.style.setProperty('--pi-page-tint-border', t.tintBorder);
    this.style.setProperty('--pi-page-label-color', t.labelColor);
  }

  /**
   * Met à jour le pied de carte (libellé, titre, motif, numéro d’ordre) et l’`aria-label` de l’hôte
   * pour les lecteurs d’écran (position + `total-pages` + consigne flèches).
   */
  private updateFooter(): void {
    const name = this.getAttribute('file-name') ?? '';
    const label = this.querySelector<HTMLElement>('[data-label]');
    const titleBar = this.querySelector<HTMLElement>('.pi-page-card__title-bar');
    const patternEl = this.querySelector<HTMLElement>('[data-pattern]');
    const num = this.querySelector<HTMLElement>('[data-num]');

    const originalRaw = this.getAttribute('original-page');
    const originalNum = originalRaw !== null ? Number.parseInt(originalRaw, 10) : NaN;
    const pageLabel =
      Number.isFinite(originalNum) && originalNum > 0 ? `Page ${originalNum}` : '';
    if (label) {
      label.textContent = pageLabel;
    }
    const cleanName = name.replace(/\.pdf$/i, '');
    if (titleBar) {
      if (pageLabel && cleanName) {
        titleBar.setAttribute('aria-label', `${pageLabel} de ${cleanName}`);
        titleBar.setAttribute('title', `${pageLabel} — ${cleanName}`);
      } else {
        titleBar.removeAttribute('aria-label');
        titleBar.removeAttribute('title');
      }
    }
    if (patternEl && this._tint) {
      patternEl.className = `pi-pattern pi-pattern--${this._tint.pattern}`;
    }
    const ord = this.getAttribute('display-order');
    const n = ord !== null ? Number.parseInt(ord, 10) : NaN;
    if (num) {
      num.textContent = Number.isFinite(n) && n > 0 ? String(n).padStart(2, '0') : '';
    }
    this.updateHostAriaLabel(pageLabel, cleanName, n);
  }

  /**
   * Construit l’`aria-label` du custom element à partir des attributs `display-order` et `total-pages`.
   */
  private updateHostAriaLabel(pageLabel: string, cleanName: string, displayOrder: number): void {
    const totalRaw = this.getAttribute('total-pages');
    const total = totalRaw !== null ? Number.parseInt(totalRaw, 10) : NaN;
    const parts: string[] = [];
    if (pageLabel) {
      parts.push(cleanName ? `${pageLabel} de ${cleanName}` : pageLabel);
    } else if (cleanName) {
      parts.push(cleanName);
    }
    if (Number.isFinite(displayOrder) && displayOrder > 0) {
      if (Number.isFinite(total) && total > 0) {
        parts.push(`position ${displayOrder} sur ${total}`);
      } else {
        parts.push(`position ${displayOrder}`);
      }
    }
    parts.push('Utilisez les flèches pour déplacer.');
    this.setAttribute('aria-label', parts.join(', '));
  }

  private parsePageIndex(): number {
    const raw = this.getAttribute('page-index');
    const n = raw !== null ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : NaN;
  }

  private scheduleDraw(): void {
    const token = ++this._drawToken;
    this._layoutAttempts = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void this.tryDraw(token);
      });
    });
  }

  private async tryDraw(token: number): Promise<void> {
    const wrap = this.querySelector<HTMLElement>('[data-canvas-wrap]');
    const canvas = this.querySelector<HTMLCanvasElement>('[data-canvas]');
    const doc = this._doc;
    const pageIndex = this.parsePageIndex();
    if (!wrap || !canvas || !doc || !Number.isFinite(pageIndex)) return;

    const cssW = wrap.clientWidth;
    if (cssW <= 0 && this._layoutAttempts < 24) {
      this._layoutAttempts += 1;
      window.setTimeout(() => void this.tryDraw(token), 32);
      return;
    }
    if (cssW <= 0) return;

    await this.drawPage(canvas, doc, pageIndex, cssW, token);
  }

  private async drawPage(
    canvas: HTMLCanvasElement,
    doc: PdfDocument,
    pageIndex: number,
    cssW: number,
    token: number,
  ): Promise<void> {
    const signal = this._abort.signal;
    if (signal.aborted || token !== this._drawToken) return;

    const info = doc.pages[pageIndex];
    if (!info) return;

    // pixmap dimensions are post-rotation: swap when /Rotate is 90 or 270.
    const swap = info.rotation % 180 !== 0;
    const pixmapWidth = Math.max(swap ? info.height : info.width, 1);
    const scale = (cssW * window.devicePixelRatio) / pixmapWidth;

    let bitmap: ImageBitmap | null = null;
    try {
      const rendered = await doc.renderPage(pageIndex, { scale });
      if (signal.aborted || token !== this._drawToken) {
        rendered.bitmap.close();
        return;
      }
      bitmap = rendered.bitmap;
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      canvas.style.removeProperty('width');
      canvas.style.removeProperty('height');
      const wrap = canvas.parentElement;
      wrap?.style.removeProperty('aspect-ratio');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
    } catch (e) {
      if (!signal.aborted) {
        console.error('[pidief] Rendu page impossible:', e);
      }
    } finally {
      bitmap?.close();
    }
  }
}

if (!customElements.get('pi-page-card')) {
  customElements.define('pi-page-card', PiPageCard);
}
