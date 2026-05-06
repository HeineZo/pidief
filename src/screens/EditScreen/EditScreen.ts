import '@components/base/Button/PiButton';
import '@components/edit/PageCard/PiPageCard';
import { PdfEngine } from '@core/pdf/PdfEngine';
import type { PdfDocument } from '@core/pdf/PdfDocument';
import { tintForSourceIndex, type PageTint } from '@components/edit/PageCard/palette';
import { PiPageCard, type PageCardAction } from '@components/edit/PageCard/PiPageCard';
import template from './editScreen.html?raw';
import './editScreen.css';

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

export class EditScreen extends HTMLElement {
  private _docs: EditScreenSource[] | null = null;
  private bound = false;

  private workingDoc: PdfDocument | null = null;
  private sources: SourceMeta[] = [];
  private attributions: number[] = [];
  private pageIds: string[] = [];

  private readonly cards = new Map<string, PiPageCard>();
  private readonly onWorkingChange = (): void => {
    this.reconcile();
  };

  private dragSession: {
    cardEl: PiPageCard;
    pointerId: number;
    fromIdx: number;
    liveIdx: number;
    startX: number;
    startY: number;
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
        for (let k = 0; k < added; k++) this.attributions.push(sourceIndex);
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
      addInput?.click();
    });
    addInput?.addEventListener('change', () => {
      if (!addInput.files) return;
      const files = Array.from(addInput.files);
      addInput.value = '';
      void this.addFiles(files);
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
      this.pageIds.splice(idx, 1);
      try {
        await doc.deletePage(idx);
      } catch (err) {
        console.error('[pidief] Suppression impossible:', err);
      }
    }
  }

  // --- Ajouter un PDF ---

  private async addFiles(files: File[]): Promise<void> {
    const doc = this.workingDoc;
    if (!doc || !files.length) return;
    const engine = PdfEngine.shared();

    for (const file of files) {
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
          this.pageIds.push(crypto.randomUUID());
        }
        this.reconcile();
      } catch (err) {
        console.error('[pidief] Ajout impossible:', err);
      } finally {
        if (added) await added.close().catch(() => undefined);
      }
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
      card.setAttribute('page-index', String(idx));
      card.setAttribute('display-order', String(idx + 1));
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

    if (empty) empty.hidden = desiredIds.length > 0;
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
        const t = meta.tint;
        const marker =
          t.pattern === 'cross'
            ? `<span class="pi-edit__legend-marker pi-edit__legend-marker--cross" style="border-color:${escapeHtml(t.color)}"></span>`
            : t.pattern === 'lines'
              ? `<span class="pi-edit__legend-marker pi-edit__legend-marker--lines" style="background:${escapeHtml(t.color)}"></span>`
              : `<span class="pi-edit__legend-marker pi-edit__legend-marker--dots" style="background:${escapeHtml(t.color)}"></span>`;
        return `<span class="pi-edit__legend-item">${marker}<span class="pi-edit__legend-name">${escapeHtml(meta.fileName)}</span><span class="pi-edit__legend-count">${count} p.</span></span>`;
      })
      .join('');
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

    this.dragSession = {
      cardEl: card,
      pointerId: event.pointerId,
      fromIdx,
      liveIdx: fromIdx,
      startX: event.clientX,
      startY: event.clientY,
      homes,
      moved: false,
    };

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

    const cur = { x: event.clientX, y: event.clientY };
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

    if (nearest !== sess.liveIdx) {
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

    // clear visual transforms after the settle transition (60ms ≈ end of curve)
    window.setTimeout(() => {
      for (const h of sess.homes) {
        h.el.style.transform = '';
      }
      sess.cardEl.dataset.dragging = 'false';
      delete sess.cardEl.dataset.dragging;
      if (grid) {
        grid.dataset.dragging = 'false';
        delete grid.dataset.dragging;
      }
    }, 180);

    if (!moved || from === to) return;

    const [pid] = this.pageIds.splice(from, 1);
    if (pid !== undefined) this.pageIds.splice(to, 0, pid);
    const [attr] = this.attributions.splice(from, 1);
    if (attr !== undefined) this.attributions.splice(to, 0, attr);

    void this.workingDoc?.movePage(from, to).catch((err) => {
      console.error('[pidief] Move impossible:', err);
    });
  };
}

if (!customElements.get('pi-edit-screen')) {
  customElements.define('pi-edit-screen', EditScreen);
}
