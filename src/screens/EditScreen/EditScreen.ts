import '@components/base/Button/PiButton';
import '@components/base/Icon/PiIcon';
import '@components/edit/PageCard/PiPageCard';
import { PdfEngine } from '@core/pdf/PdfEngine';
import type { PdfDocument } from '@core/pdf/PdfDocument';
import { tintForSourceIndex, type PageTint } from '@components/edit/PageCard/palette';
import { PiPageCard, type PageCardAction } from '@components/edit/PageCard/PiPageCard';
import template from './editScreen.html?raw';
import './editScreen.css';
import { scrollToBottom } from '@util/scrollToBottom';
import { sendWarning } from '@util/Toast';
import { MAX_UPLOAD_PDFS } from '@util/uploadPdfLimits';

export type EditScreenSource = {
  doc: PdfDocument;
  fileName: string;
};

interface SourceMeta {
  fileName: string;
  tint: PageTint;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MIN_GRID_COLUMNS = 3;
const MAX_GRID_COLUMNS = 10;
const DEFAULT_GRID_COLUMNS = 6;
const DRAG_SLOT_SWITCH_HYSTERESIS_PX = 12;

const activeSourcePdfCount = (attributions: number[]): number => new Set(attributions).size;

export class EditScreen extends HTMLElement {
  private _docs: EditScreenSource[] | null = null;
  private bound = false;
  private gridColumns = DEFAULT_GRID_COLUMNS;

  private workingDoc: PdfDocument | null = null;
  private sources: SourceMeta[] = [];
  private attributions: number[] = [];
  private originalPageNumbers: number[] = [];
  private pageIds: string[] = [];

  private readonly cards = new Map<string, PiPageCard>();
  private readonly onWorkingChange = (): void => {
    this.reconcile();
  };

  private scrollObserver: IntersectionObserver | null = null;

  private dragSession: {
    cardEl: PiPageCard;
    pointerId: number;
    fromIdx: number;
    liveIdx: number;
    startX: number;
    startY: number;
    pointerToCenterX: number;
    pointerToCenterY: number;
    homes: { el: PiPageCard; cx: number; cy: number }[];
    moved: boolean;
  } | null = null;

  set docs(value: EditScreenSource[]) {
    this._docs = value;
    if (this.isConnected) void this.bootstrap();
  }

  get docs(): EditScreenSource[] | null {
    return this._docs;
  }

  connectedCallback(): void {
    if (!this.querySelector('.pi-edit')) {
      this.innerHTML = template;
    }
    this.bindOnce();
    if (this._docs && !this.workingDoc) void this.bootstrap();
    else if (this.workingDoc) this.reconcile();
  }

  disconnectedCallback(): void {
    this.workingDoc?.removeEventListener('change', this.onWorkingChange);
    this.scrollObserver?.disconnect();
    this.scrollObserver = null;
    const doc = this.workingDoc;
    this.workingDoc = null;
    this._docs = null;
    this.cards.clear();
    if (doc) void doc.close();
  }

  // --- Bootstrap : consolide les sources en un workingDoc unique ---

  private async bootstrap(): Promise<void> {
    const slots = this._docs;
    if (!slots?.length) return;

    const [first, ...rest] = slots;
    if (!first) return;

    this.workingDoc = first.doc;
    this.sources = [{ fileName: first.fileName, tint: tintForSourceIndex(0) }];
    this.attributions = Array.from({ length: first.doc.pageCount }, () => 0);
    this.originalPageNumbers = Array.from({ length: first.doc.pageCount }, (_, i) => i + 1);

    for (let i = 0; i < rest.length; i++) {
      const slot = rest[i]!;
      const before = this.workingDoc.pageCount;
      try {
        await this.workingDoc.merge(slot.doc);
        const added = this.workingDoc.pageCount - before;
        const sourceIndex = this.sources.length;
        this.sources.push({
          fileName: slot.fileName,
          tint: tintForSourceIndex(sourceIndex),
        });
        for (let k = 0; k < added; k++) {
          this.attributions.push(sourceIndex);
          this.originalPageNumbers.push(k + 1);
        }
      } catch (err) {
        console.error('[pidief] Fusion impossible:', err);
      } finally {
        await slot.doc.close().catch(() => undefined);
      }
    }

    this.pageIds = this.workingDoc.pages.map(() => crypto.randomUUID());
    this.workingDoc.addEventListener('change', this.onWorkingChange);
    this.reconcile();
  }

  // --- Bindings d'événements (une seule fois) ---

  private bindOnce(): void {
    if (this.bound) return;
    this.bound = true;

    this.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent<void>('request-back', { bubbles: true, composed: true }));
    });

    const addInput = this.querySelector<HTMLInputElement>('[data-add-input]');
    this.querySelector('[data-action="add-pdf"]')?.addEventListener('click', () => {
      if (activeSourcePdfCount(this.attributions) >= MAX_UPLOAD_PDFS) return;
      addInput?.click();
    });
    addInput?.addEventListener('change', () => {
      if (!addInput.files) return;
      const files = Array.from(addInput.files);
      addInput.value = '';
      void this.addFiles(files, true);
    });

    this.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
      void this.handleContinue();
    });

    this.addEventListener('page-action', (event) => {
      const ce = event as CustomEvent<{ action: PageCardAction }>;
      const target = (ce.composedPath()[0] as HTMLElement).closest<PiPageCard>('pi-page-card');
      if (!target) return;
      void this.handlePageAction(target, ce.detail.action);
    });

    const grid = this.querySelector<HTMLElement>('[data-grid]');
    grid?.addEventListener('pointerdown', this.onGridPointerDown);
    const slider = this.querySelector<HTMLInputElement>('[data-grid-columns-slider]');
    const onSliderInput = (): void => {
      const next = Number.parseInt(slider?.value ?? '', 10);
      this.applyGridColumns(Number.isFinite(next) ? next : DEFAULT_GRID_COLUMNS);
    };
    slider?.addEventListener('input', onSliderInput);
    grid?.addEventListener('pointerover', this.onGridPointerOver);
    grid?.addEventListener('pointerleave', this.onGridPointerLeave);

    this.applyGridColumns(this.gridColumns);
    this.setupScrollObserver();
  }

  private applyGridColumns(value: number): void {
    const clamped = Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, value));
    const progress = ((clamped - MIN_GRID_COLUMNS) / (MAX_GRID_COLUMNS - MIN_GRID_COLUMNS)) * 100;
    this.gridColumns = clamped;

    const slider = this.querySelector<HTMLInputElement>('[data-grid-columns-slider]');
    const valueEl = this.querySelector<HTMLOutputElement>('[data-grid-columns-value]');
    const grid = this.querySelector<HTMLElement>('[data-grid]');

    if (slider) {
      slider.value = String(clamped);
      slider.style.setProperty('--pi-edit-grid-progress', `${progress}%`);
      slider.setAttribute('aria-valuenow', String(clamped));
      slider.setAttribute('aria-valuetext', `${clamped} colonnes`);
    }
    if (valueEl) valueEl.textContent = `${clamped} colonnes`;
    grid?.style.setProperty('--pi-edit-grid-columns', String(clamped));
  }

  private setupScrollObserver(): void {
    if (this.scrollObserver) return;
    const scrollEl = this.querySelector<HTMLElement>('.pi-edit');
    const sentinel = this.querySelector<HTMLElement>('[data-scroll-sentinel]');
    if (!scrollEl || !sentinel) return;

    const root = scrollEl;
    root.dataset.scrolled = 'false';
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        root.dataset.scrolled = entry.isIntersecting ? 'false' : 'true';
      },
      { root, threshold: 0 },
    );
    this.scrollObserver.observe(sentinel);
  }

  // --- Actions par page ---

  private async handlePageAction(card: PiPageCard, action: PageCardAction): Promise<void> {
    const doc = this.workingDoc;
    if (!doc) return;
    const pid = card.dataset.pageId;
    const idx = pid ? this.pageIds.indexOf(pid) : -1;
    if (idx < 0) return;

    if (action === 'rotate') {
      try {
        await doc.rotatePage(idx, 90);
        card.invalidate();
      } catch (err) {
        console.error('[pidief] Rotation impossible:', err);
      }
      return;
    }

    if (action === 'delete') {
      this.attributions.splice(idx, 1);
      this.originalPageNumbers.splice(idx, 1);
      this.pageIds.splice(idx, 1);
      try {
        await doc.deletePage(idx);
      } catch (err) {
        console.error('[pidief] Suppression impossible:', err);
      }
    }
  }

  // --- Ajouter un PDF ---

  private async addFiles(files: File[], shouldScroll = false): Promise<void> {
    const doc = this.workingDoc;
    if (!doc || !files.length) return;

    const pdfFiles = files.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdfFiles.length === 0) return;

    const remaining = MAX_UPLOAD_PDFS - activeSourcePdfCount(this.attributions);
    if (remaining <= 0) {
      sendWarning(
        `Limite de ${MAX_UPLOAD_PDFS} fichiers PDF atteinte. Supprimez des pages (ou des sources entières) pour en ajouter d'autres.`,
      );
      return;
    }

    const toProcess = pdfFiles.slice(0, remaining);
    const skipped = pdfFiles.length - toProcess.length;
    if (skipped > 0) {
      sendWarning(
        skipped === 1
          ? `Un fichier n'a pas été ajouté : limite de ${MAX_UPLOAD_PDFS} PDF.`
          : `${skipped} fichiers n'ont pas été ajoutés : limite de ${MAX_UPLOAD_PDFS} PDF.`,
      );
    }

    const engine = PdfEngine.shared();

    for (const file of toProcess) {
      let added: PdfDocument | null = null;
      try {
        added = await engine.open(file);
        const before = doc.pageCount;
        await doc.merge(added);
        const count = doc.pageCount - before;
        const sourceIndex = this.sources.length;
        this.sources.push({
          fileName: file.name,
          tint: tintForSourceIndex(sourceIndex),
        });
        for (let i = 0; i < count; i++) {
          this.attributions.push(sourceIndex);
          this.originalPageNumbers.push(i + 1);
          this.pageIds.push(crypto.randomUUID());
        }
        this.reconcile();
      } catch (err) {
        console.error('[pidief] Ajout impossible:', err);
      } finally {
        if (added) await added.close().catch(() => undefined);
      }
    }

    if (shouldScroll) {
      const container = this.querySelector<HTMLElement>('.pi-edit');
      scrollToBottom(container);
    }
  }

  // --- Continuer : export + téléchargement ---

  private async handleContinue(): Promise<void> {
    const doc = this.workingDoc;
    if (!doc) return;
    let url: string | null = null;
    try {
      const blob = await doc.exportToBlob();
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pidief.pdf';
      document.body.append(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('[pidief] Export impossible:', err);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  // --- Réconciliation DOM + légende ---

  private reconcile(): void {
    const grid = this.querySelector<HTMLElement>('[data-grid]');
    const empty = this.querySelector<HTMLElement>('[data-empty]');
    const doc = this.workingDoc;
    if (!grid || !doc) return;

    const desiredIds = this.pageIds;
    const seen = new Set(desiredIds);

    for (const [id, el] of this.cards) {
      if (!seen.has(id)) {
        el.remove();
        this.cards.delete(id);
      }
    }

    let prev: HTMLElement | null = null;
    desiredIds.forEach((id, idx) => {
      let card = this.cards.get(id);
      if (!card) {
        card = document.createElement('pi-page-card') as PiPageCard;
        card.dataset.pageId = id;
        this.cards.set(id, card);
      }
      const sourceIndex = this.attributions[idx] ?? 0;
      const meta = this.sources[sourceIndex];
      const original = this.originalPageNumbers[idx] ?? idx + 1;
      card.setAttribute('page-index', String(idx));
      card.setAttribute('display-order', String(idx + 1));
      card.setAttribute('original-page', String(original));
      card.dataset.sourceIndex = String(sourceIndex);
      if (meta) {
        card.setAttribute('source-name', meta.fileName);
        card.tint = meta.tint;
      }
      card.doc = doc;

      const expectedNext = prev ? prev.nextElementSibling : grid.firstElementChild;
      if (expectedNext !== card) {
        if (prev) prev.after(card);
        else grid.prepend(card);
      }
      prev = card;
    });

    this.renderLegend();
    this.syncAddPdfControls();

    if (empty) empty.hidden = desiredIds.length > 0;
  }

  private syncAddPdfControls(): void {
    const active = activeSourcePdfCount(this.attributions);
    const atLimit = active >= MAX_UPLOAD_PDFS;

    const hint = this.querySelector<HTMLElement>('[data-pdf-limit-hint]');
    if (hint) {
      hint.textContent = `${active} / ${MAX_UPLOAD_PDFS} fichiers PDF`;
    }

    const addBtn = this.querySelector<HTMLElement>('[data-action="add-pdf"]');
    if (addBtn) {
      addBtn.toggleAttribute('disabled', atLimit);
      if (atLimit) {
        addBtn.setAttribute(
          'title',
          `Limite de ${MAX_UPLOAD_PDFS} fichiers PDF. Supprimez des pages pour libérer une place.`,
        );
      } else {
        addBtn.removeAttribute('title');
      }
      addBtn.querySelector('button')?.setAttribute('aria-describedby', 'edit-pdf-limit-hint');
    }

    const addInput = this.querySelector<HTMLInputElement>('[data-add-input]');
    if (addInput) addInput.disabled = atLimit;
  }

  private renderLegend(): void {
    const legend = this.querySelector<HTMLDivElement>('[data-legend]');
    if (!legend) return;

    const counts = new Map<number, number>();
    for (const sourceIndex of this.attributions) {
      counts.set(sourceIndex, (counts.get(sourceIndex) ?? 0) + 1);
    }

    legend.innerHTML = this.sources
      .map((meta, i) => {
        const count = counts.get(i) ?? 0;
        if (count === 0) return '';
        const marker = this.renderLegendMarker(meta.tint);
        return `<span class="pi-edit__legend-item" data-source-index="${i}">${marker}<span class="pi-edit__legend-name">${escapeHtml(meta.fileName)}</span><span class="pi-edit__legend-count">${count} p.</span></span>`;
      })
      .join('');
  }

  private renderLegendMarker(tint: PageTint): string {
    const color = escapeHtml(tint.color);
    const base = 'pi-edit__legend-marker';
    switch (tint.pattern) {
      case 'cross':
      case 'ring':
      case 'hollowDiamond':
        return `<span class="${base} ${base}--${tint.pattern}" style="border-color:${color}"></span>`;
      case 'triangle':
        return `<span class="${base} ${base}--triangle" style="border-bottom-color:${color}"></span>`;
      case 'plus':
        return `<span class="${base} ${base}--plus" style="background:linear-gradient(to right,transparent 40%,${color} 40%,${color} 60%,transparent 60%),linear-gradient(to bottom,transparent 40%,${color} 40%,${color} 60%,transparent 60%)"></span>`;
      case 'doubleLines':
        return `<span class="${base} ${base}--doubleLines" style="background:linear-gradient(to bottom,${color} 0 2px,transparent 2px 4px,${color} 4px 6px,transparent 6px 100%)"></span>`;
      case 'checker':
        return `<span class="${base} ${base}--checker" style="background:conic-gradient(${color} 0 25%,transparent 25% 50%,${color} 50% 75%,transparent 75% 100%);background-size:6px 6px"></span>`;
      case 'star':
        return `<span class="${base} ${base}--star" style="background:${color};clip-path:polygon(50% 0%,62% 35%,100% 38%,70% 60%,80% 100%,50% 75%,20% 100%,30% 60%,0% 38%,38% 35%)"></span>`;
      case 'bars':
        return `<span class="${base} ${base}--bars" style="background:repeating-linear-gradient(to right,${color} 0 2px,transparent 2px 4px)"></span>`;
      default:
        return `<span class="${base} ${base}--${tint.pattern}" style="background:${color}"></span>`;
    }
  }

  // --- Hover dim : items de légende des autres sources ---

  private readonly onGridPointerOver = (event: PointerEvent): void => {
    if (this.dragSession) return;
    const target = event.target as HTMLElement | null;
    const card = target?.closest<PiPageCard>('pi-page-card') ?? null;
    if (!card) return;
    const active = card.dataset.sourceIndex;
    if (active === undefined) return;
    this.applyLegendFade(active);
  };

  private readonly onGridPointerLeave = (): void => {
    this.clearFaded();
  };

  private applyLegendFade(activeSourceIndex: string): void {
    const items = this.querySelectorAll<HTMLElement>('.pi-edit__legend-item');
    items.forEach((item) => {
      if (item.dataset.sourceIndex !== activeSourceIndex) {
        item.dataset.faded = 'true';
      } else {
        delete item.dataset.faded;
      }
    });
  }

  private clearFaded(): void {
    const items = this.querySelectorAll<HTMLElement>('.pi-edit__legend-item');
    items.forEach((item) => {
      delete item.dataset.faded;
    });
  }

  // --- Drag-and-drop reorder ---

  private readonly onGridPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.dragSession) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-action]')) return;
    const card = target?.closest<PiPageCard>('pi-page-card') ?? null;
    if (!card) return;
    const pid = card.dataset.pageId;
    if (!pid) return;
    const fromIdx = this.pageIds.indexOf(pid);
    if (fromIdx < 0) return;

    const grid = this.querySelector<HTMLElement>('[data-grid]');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll<PiPageCard>('pi-page-card'));
    const homes = cards.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    const cardHome = homes[fromIdx];
    if (!cardHome) return;

    this.dragSession = {
      cardEl: card,
      pointerId: event.pointerId,
      fromIdx,
      liveIdx: fromIdx,
      startX: event.clientX,
      startY: event.clientY,
      pointerToCenterX: event.clientX - cardHome.cx,
      pointerToCenterY: event.clientY - cardHome.cy,
      homes,
      moved: false,
    };

    this.clearFaded();
    grid.dataset.dragging = 'true';
    card.dataset.dragging = 'true';
    card.setPointerCapture(event.pointerId);
    card.addEventListener('pointermove', this.onPointerMove);
    card.addEventListener('pointerup', this.onPointerUp);
    card.addEventListener('pointercancel', this.onPointerUp);
    event.preventDefault();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const sess = this.dragSession;
    if (!sess || event.pointerId !== sess.pointerId) return;
    sess.moved = true;

    const dx = event.clientX - sess.startX;
    const dy = event.clientY - sess.startY;
    sess.cardEl.style.transform = `translate(${dx}px, ${dy}px)`;

    const cur = {
      x: event.clientX - sess.pointerToCenterX,
      y: event.clientY - sess.pointerToCenterY,
    };
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < sess.homes.length; i++) {
      const h = sess.homes[i]!;
      const d = Math.hypot(cur.x - h.cx, cur.y - h.cy);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }

    const liveHome = sess.homes[sess.liveIdx];
    const distToLive = liveHome ? Math.hypot(cur.x - liveHome.cx, cur.y - liveHome.cy) : Infinity;
    const shouldSwitch =
      nearest !== sess.liveIdx && best + DRAG_SLOT_SWITCH_HYSTERESIS_PX < distToLive;

    if (shouldSwitch) {
      sess.liveIdx = nearest;
      const liveOrder = sess.homes.map((h) => h);
      const [moved] = liveOrder.splice(sess.fromIdx, 1);
      liveOrder.splice(nearest, 0, moved!);
      for (let i = 0; i < sess.homes.length; i++) {
        const home = sess.homes[i]!;
        if (home === sess.homes[sess.fromIdx]) continue;
        const slot = liveOrder.indexOf(home);
        const target = sess.homes[slot]!;
        const ddx = target.cx - home.cx;
        const ddy = target.cy - home.cy;
        home.el.style.transform = `translate(${ddx}px, ${ddy}px)`;
      }
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const sess = this.dragSession;
    if (!sess || event.pointerId !== sess.pointerId) return;

    const grid = this.querySelector<HTMLElement>('[data-grid]');
    sess.cardEl.removeEventListener('pointermove', this.onPointerMove);
    sess.cardEl.removeEventListener('pointerup', this.onPointerUp);
    sess.cardEl.removeEventListener('pointercancel', this.onPointerUp);
    try {
      sess.cardEl.releasePointerCapture(sess.pointerId);
    } catch {
      // already released
    }

    const from = sess.fromIdx;
    const to = sess.liveIdx;
    const moved = sess.moved;
    this.dragSession = null;

    const clearDragState = (): void => {
      for (const h of sess.homes) {
        h.el.style.transform = '';
      }
      sess.cardEl.dataset.dragging = 'false';
      delete sess.cardEl.dataset.dragging;
      if (grid) {
        grid.dataset.dragging = 'false';
        delete grid.dataset.dragging;
      }
    };

    if (!moved || from === to) {
      clearDragState();
      return;
    }

    const beforeRects = new Map<PiPageCard, DOMRect>();
    for (const h of sess.homes) {
      beforeRects.set(h.el, h.el.getBoundingClientRect());
    }

    const [pid] = this.pageIds.splice(from, 1);
    if (pid !== undefined) this.pageIds.splice(to, 0, pid);
    const [attr] = this.attributions.splice(from, 1);
    if (attr !== undefined) this.attributions.splice(to, 0, attr);
    const [orig] = this.originalPageNumbers.splice(from, 1);
    if (orig !== undefined) this.originalPageNumbers.splice(to, 0, orig);

    for (const h of sess.homes) {
      h.el.style.transition = 'none';
      h.el.style.transform = '';
    }

    this.reconcile();

    for (const h of sess.homes) {
      const before = beforeRects.get(h.el);
      if (!before) continue;
      const after = h.el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        h.el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    }

    sess.cardEl.dataset.dragging = 'false';
    delete sess.cardEl.dataset.dragging;
    if (grid) {
      grid.dataset.dragging = 'false';
      delete grid.dataset.dragging;
    }

    requestAnimationFrame(() => {
      for (const h of sess.homes) {
        h.el.style.transition = 'transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1)';
        h.el.style.transform = '';
      }
    });
    window.setTimeout(() => {
      for (const h of sess.homes) {
        h.el.style.transition = '';
      }
    }, 220);

    void this.workingDoc?.movePage(from, to).catch((err) => {
      console.error('[pidief] Move impossible:', err);
    });
  };
}

if (!customElements.get('pi-edit-screen')) {
  customElements.define('pi-edit-screen', EditScreen);
}
