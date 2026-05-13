import '@components/base/Button/PiButton';
import '@components/base/Icon/PiIcon';
import '@components/edit/PageCard/PiPageCard';
import { PdfEngine } from '@core/pdf/PdfEngine';
import type { PdfDocument } from '@core/pdf/PdfDocument';
import { tintForFileIndex, type PageTint } from '@components/edit/PageCard/palette';
import {
  PiPageCard,
  type PageCardAction,
  type PageMoveDirection,
} from '@components/edit/PageCard/PiPageCard';
import template from './editScreen.html?raw';
import './editScreen.css';
import { scrollToBottom } from '@util/scrollToBottom';
import { sendWarning } from '@util/Toast';
import { MAX_UPLOAD_PDFS } from '@util/uploadPdfLimits';

export type EditScreenFile = {
  doc: PdfDocument;
  fileName: string;
};

interface FileMeta {
  id: string;
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

const activeFileCount = (pageFileIndex: number[]): number => new Set(pageFileIndex).size;

export class EditScreen extends HTMLElement {
  private _docs: EditScreenFile[] | null = null;
  private bound = false;
  private gridColumns = DEFAULT_GRID_COLUMNS;

  private workingDoc: PdfDocument | null = null;
  private fileMetas: FileMeta[] = [];
  private pageFileIndex: number[] = [];
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

  set docs(value: EditScreenFile[]) {
    this._docs = value;
    if (this.isConnected) void this.bootstrap();
  }

  get docs(): EditScreenFile[] | null {
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

  // --- Bootstrap : consolide les fichiers en un workingDoc unique ---

  private async bootstrap(): Promise<void> {
    const slots = this._docs;
    if (!slots?.length) return;

    const [first, ...rest] = slots;
    if (!first) return;

    this.workingDoc = first.doc;
    this.fileMetas = [
      { id: crypto.randomUUID(), fileName: first.fileName, tint: tintForFileIndex(0) },
    ];
    this.pageFileIndex = Array.from({ length: first.doc.pageCount }, () => 0);
    this.originalPageNumbers = Array.from({ length: first.doc.pageCount }, (_, i) => i + 1);

    for (let i = 0; i < rest.length; i++) {
      const slot = rest[i]!;
      const before = this.workingDoc.pageCount;
      try {
        await this.workingDoc.merge(slot.doc);
        const added = this.workingDoc.pageCount - before;
        const fileIndex = this.fileMetas.length;
        this.fileMetas.push({
          id: crypto.randomUUID(),
          fileName: slot.fileName,
          tint: tintForFileIndex(fileIndex),
        });
        for (let k = 0; k < added; k++) {
          this.pageFileIndex.push(fileIndex);
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

  /**
   * Abonne les contrôles de l’écran (toolbar, grille, slider) et les événements des cartes :
   * `page-action`, `page-move` (réordonnancement clavier).
   */
  private bindOnce(): void {
    if (this.bound) return;
    this.bound = true;

    this.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent<void>('request-back', { bubbles: true, composed: true }));
    });

    this.querySelector('[data-action="skip-to-first-legend-file"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.focusFirstPageFile();
    });

    const addInput = this.querySelector<HTMLInputElement>('[data-add-input]');
    this.querySelector('[data-action="add-pdf"]')?.addEventListener('click', () => {
      if (activeFileCount(this.pageFileIndex) >= MAX_UPLOAD_PDFS) return;
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

    this.addEventListener('page-move', (event) => {
      const ce = event as CustomEvent<{ direction: PageMoveDirection }>;
      const target = (ce.composedPath()[0] as HTMLElement).closest<PiPageCard>('pi-page-card');
      if (!target) return;
      this.handlePageMove(target, ce.detail.direction);
    });

    this.addEventListener('click', this.onRemoveMergedFileClick);
    this.addEventListener('click', this.onLegendScrollToFileClick);

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
    if (!pid) return;

    if (action === 'rotate') {
      const idx = this.pageIds.indexOf(pid);
      if (idx < 0) return;
      try {
        await doc.rotatePage(idx, 90);
        card.invalidate();
      } catch (err) {
        console.error('[pidief] Rotation impossible:', err);
      }
      return;
    }

    if (action === 'delete') {
      this.enqueuePageRemoval(pid);
    }
  }

  /**
   * Empile une suppression de page sur la même file que les suppressions de fichier
   * pour interdire tout interleave. Le `data-removing` est appliqué tout de suite
   * (feedback visuel immédiat), et le timer d'animation est figé au moment du clic,
   * pas à l'exécution effective — évite d'attendre 180 ms supplémentaires quand la
   * carte a déjà fini de s'estomper pendant le tour précédent de la file.
   */
  private enqueuePageRemoval(pageId: string): void {
    const card = this.cards.get(pageId);
    if (card && card.dataset.removing === 'true') return;
    if (card) card.dataset.removing = 'true';

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const animationDone = new Promise<void>((resolve) => {
      window.setTimeout(resolve, reduceMotion ? 0 : 180);
    });

    this.removalChain = this.removalChain.then(() => this.removePage(pageId, animationDone));
  }

  private async removePage(pageId: string, animationDone: Promise<void>): Promise<void> {
    const doc = this.workingDoc;
    if (!doc) return;
    const idx = this.pageIds.indexOf(pageId);
    if (idx < 0) return;

    doc.removeEventListener('change', this.onWorkingChange);
    try {
      await Promise.all([doc.deletePage(idx), animationDone]);
      const idxNow = this.pageIds.indexOf(pageId);
      if (idxNow >= 0) {
        this.pageFileIndex.splice(idxNow, 1);
        this.originalPageNumbers.splice(idxNow, 1);
        this.pageIds.splice(idxNow, 1);
      }
      this.animateReorder(() => {
        this.reconcile();
      });
    } catch (err) {
      const card = this.cards.get(pageId);
      if (card) delete card.dataset.removing;
      console.error('[pidief] Suppression impossible:', err);
    } finally {
      doc.addEventListener('change', this.onWorkingChange);
    }
  }

  private readonly onRemoveMergedFileClick = (event: MouseEvent): void => {
    const t = event.target as HTMLElement | null;
    const btn = t?.closest<HTMLButtonElement>('[data-action="remove-file"]');
    if (!btn || !this.contains(btn)) return;
    const fileId = btn.dataset.fileId;
    if (!fileId) return;
    event.preventDefault();
    event.stopPropagation();
    this.enqueueRemoval(fileId);
  };

  private readonly onLegendScrollToFileClick = (event: MouseEvent): void => {
    const t = event.target as HTMLElement | null;
    const btn = t?.closest<HTMLButtonElement>('[data-action="scroll-to-file"]');
    if (!btn || !this.contains(btn)) return;
    const fileId = btn.dataset.fileId;
    if (!fileId) return;
    const idx = this.fileMetas.findIndex((m) => m.id === fileId);
    if (idx < 0) return;
    event.preventDefault();
    this.scrollToFirstPageOfFile(idx);
    queueMicrotask(() => {
      btn.blur();
    });
  };

  private focusFirstPageFile(): void {
    const firstPageCard = this.querySelector<PiPageCard>('[data-grid] pi-page-card:first-child');
    if (firstPageCard) {
      firstPageCard.focus();
      firstPageCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  private scrollToFirstPageOfFile(fileIndex: number): void {
    let firstPageId: string | undefined;
    for (let i = 0; i < this.pageIds.length; i++) {
      if (this.pageFileIndex[i] === fileIndex) {
        firstPageId = this.pageIds[i];
        break;
      }
    }
    if (!firstPageId) return;
    const card = this.cards.get(firstPageId);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  private removalChain: Promise<void> = Promise.resolve();

  /**
   * File de suppression sérialisée : chaque clic empile une opération atomique
   * sur la chaîne. La résolution par `fileId` reste correcte même si les indices
   * `fileMetas` ont bougé entre le clic et l'exécution effective.
   */
  private enqueueRemoval(fileId: string): void {
    this.removalChain = this.removalChain.then(() => this.removeMergedFile(fileId));
  }

  /**
   * Supprime atomiquement toutes les pages d'un fichier mergé :
   * - marque cartes + item de légende avec `data-removing` pour déclencher le fade-out CSS ;
   * - détache `change` pour bloquer tout `reconcile` parasite mid-flight ;
   * - envoie un seul batch `deletePages` au worker, en parallèle de l'animation de sortie ;
   * - n'applique les splices locaux qu'après confirmation worker ET fin de l'anim ;
   * - réattache le listener et `reconcile()` une seule fois, encadré par un FLIP
   *   pour que les pages restantes glissent dans leurs nouvelles positions.
   *
   * Les clics concurrents sont sérialisés via `enqueueRemoval`, et les fichiers
   * sont identifiés par un `id` stable plutôt que par index pour éviter qu'un
   * décalage post-splice ne fasse cibler le mauvais fichier.
   */
  private async removeMergedFile(fileId: string): Promise<void> {
    const doc = this.workingDoc;
    if (!doc) return;
    const fileIndex = this.fileMetas.findIndex((m) => m.id === fileId);
    if (fileIndex < 0) return;

    const pageIndices: number[] = [];
    for (let i = 0; i < this.pageFileIndex.length; i++) {
      if (this.pageFileIndex[i] === fileIndex) pageIndices.push(i);
    }
    if (pageIndices.length === 0) return;

    const cardsToRemove: PiPageCard[] = [];
    for (const p of pageIndices) {
      const pid = this.pageIds[p];
      if (!pid) continue;
      const card = this.cards.get(pid);
      if (card) cardsToRemove.push(card);
    }
    const legendItem = this.querySelector<HTMLElement>(
      `.pi-edit__legend-item[data-file-id="${CSS.escape(fileId)}"]`,
    );

    for (const card of cardsToRemove) card.dataset.removing = 'true';
    if (legendItem) legendItem.dataset.removing = 'true';

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const animationDone = new Promise<void>((resolve) => {
      window.setTimeout(resolve, reduceMotion ? 0 : 180);
    });

    doc.removeEventListener('change', this.onWorkingChange);
    try {
      await Promise.all([doc.deletePages(pageIndices), animationDone]);
      const sortedDesc = pageIndices.slice().sort((a, b) => b - a);
      for (const p of sortedDesc) {
        this.pageFileIndex.splice(p, 1);
        this.originalPageNumbers.splice(p, 1);
        this.pageIds.splice(p, 1);
      }
      this.fileMetas.splice(fileIndex, 1);
      for (let i = 0; i < this.pageFileIndex.length; i++) {
        const v = this.pageFileIndex[i]!;
        if (v > fileIndex) this.pageFileIndex[i] = v - 1;
      }
      this.animateReorder(() => {
        this.reconcile();
      });
    } catch (err) {
      for (const card of cardsToRemove) delete card.dataset.removing;
      if (legendItem) delete legendItem.dataset.removing;
      console.error('[pidief] Suppression du fichier impossible:', err);
    } finally {
      doc.addEventListener('change', this.onWorkingChange);
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

    const remaining = MAX_UPLOAD_PDFS - activeFileCount(this.pageFileIndex);
    if (remaining <= 0) {
      sendWarning(
        `Limite de ${MAX_UPLOAD_PDFS} fichiers PDF atteinte. Supprimez un ou des fichiers pour en ajouter d'autres.`,
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
        const fileIndex = this.fileMetas.length;
        this.fileMetas.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          tint: tintForFileIndex(fileIndex),
        });
        for (let i = 0; i < count; i++) {
          this.pageFileIndex.push(fileIndex);
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

  /**
   * Synchronise la grille avec `pageIds` : crée ou met à jour chaque `pi-page-card`, ordre DOM,
   * légende et état vide. Passe notamment `total-pages` pour l’accessibilité des cartes.
   */
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
      const fileIndex = this.pageFileIndex[idx] ?? 0;
      const meta = this.fileMetas[fileIndex];
      const original = this.originalPageNumbers[idx] ?? idx + 1;
      card.setAttribute('page-index', String(idx));
      card.setAttribute('display-order', String(idx + 1));
      card.setAttribute('original-page', String(original));
      card.setAttribute('total-pages', String(desiredIds.length));
      card.dataset.fileIndex = String(fileIndex);
      if (meta) {
        card.setAttribute('file-name', meta.fileName);
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
    const active = activeFileCount(this.pageFileIndex);
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
          `Limite de ${MAX_UPLOAD_PDFS} fichiers PDF. Supprimez un ou des fichiers pour libérer une place.`,
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
    for (const fileIdx of this.pageFileIndex) {
      counts.set(fileIdx, (counts.get(fileIdx) ?? 0) + 1);
    }

    legend.innerHTML = this.fileMetas
      .map((meta, i) => {
        const count = counts.get(i) ?? 0;
        if (count === 0) return '';
        const marker = this.renderLegendMarker(meta.tint);
        const ariaRemove = escapeHtml(`Retirer ${meta.fileName} du projet`);
        const ariaScroll = escapeHtml(`Aller à la première page dans la grille : ${meta.fileName}`);
        const fileNameId = i === 0 ? ' id="edit-first-legend-file-name"' : '';
        const fileId = escapeHtml(meta.id);
        return `<span class="pi-edit__legend-item" data-file-index="${i}" data-file-id="${fileId}" style="--pi-legend-file-color:${escapeHtml(meta.tint.color)}"><span class="pi-edit__legend-body"><button type="button" class="pi-edit__legend-main" data-action="scroll-to-file" data-file-id="${fileId}" aria-label="${ariaScroll}" title="Voir la première page dans la grille">${marker}<span class="pi-edit__legend-name"${fileNameId}>${escapeHtml(meta.fileName)}</span><span class="pi-edit__legend-count">${count} p.</span></button><button type="button" class="pi-edit__legend-remove" data-action="remove-file" data-file-id="${fileId}" title="Retirer ce fichier du projet" aria-label="${ariaRemove}"><pi-icon name="trash" size="14"></pi-icon></button></span></span>`;
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

  // --- Hover dim : items de légende des autres fichiers ---

  private readonly onGridPointerOver = (event: PointerEvent): void => {
    if (this.dragSession) return;
    const target = event.target as HTMLElement | null;
    const card = target?.closest<PiPageCard>('pi-page-card') ?? null;
    if (!card) return;
    const active = card.dataset.fileIndex;
    if (active === undefined) return;
    this.applyLegendFade(active);
  };

  private readonly onGridPointerLeave = (): void => {
    this.clearFaded();
  };

  private applyLegendFade(activeFileIndex: string): void {
    const items = this.querySelectorAll<HTMLElement>('.pi-edit__legend-item');
    items.forEach((item) => {
      if (item.dataset.fileIndex !== activeFileIndex) {
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

  /**
   * Fin de drag : si la page a bougé, réordonne les tableaux locaux + `reconcile()` avec une
   * animation FLIP (`applyFlipFromRects`), puis appelle `PdfDocument.movePage` (insertion, pas swap).
   */
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

    this.applyFlipFromRects(beforeRects, () => {
      const [pid] = this.pageIds.splice(from, 1);
      if (pid !== undefined) this.pageIds.splice(to, 0, pid);
      const [attr] = this.pageFileIndex.splice(from, 1);
      if (attr !== undefined) this.pageFileIndex.splice(to, 0, attr);
      const [orig] = this.originalPageNumbers.splice(from, 1);
      if (orig !== undefined) this.originalPageNumbers.splice(to, 0, orig);
      this.reconcile();
    });

    sess.cardEl.dataset.dragging = 'false';
    delete sess.cardEl.dataset.dragging;
    if (grid) {
      grid.dataset.dragging = 'false';
      delete grid.dataset.dragging;
    }

    void this.workingDoc?.movePage(from, to).catch((err) => {
      console.error('[pidief] Move impossible:', err);
    });
  };

  // --- Reorder clavier (a11y) ---

  /**
   * Réponse à `page-move` depuis une carte : **swap** visuel avec la case cible (voisin ou ± colonnes),
   * animation FLIP, focus conservé, annonce `aria-live`, puis deux `movePage` sur le PDF pour équivaloir au swap.
   *
   * @param card - Carte source (celle qui a le focus clavier).
   * @param direction - Gauche/droite : index ±1 ; haut/bas : index ± `gridColumns` (borné aux bords).
   */
  private handlePageMove(card: PiPageCard, direction: PageMoveDirection): void {
    if (this.dragSession) return;
    const doc = this.workingDoc;
    if (!doc) return;
    const pid = card.dataset.pageId;
    const fromIdx = pid ? this.pageIds.indexOf(pid) : -1;
    if (fromIdx < 0) return;

    const last = this.pageIds.length - 1;
    let toIdx = fromIdx;
    switch (direction) {
      case 'left':
        toIdx = fromIdx - 1;
        break;
      case 'right':
        toIdx = fromIdx + 1;
        break;
      case 'up':
        toIdx = fromIdx - this.gridColumns;
        break;
      case 'down':
        toIdx = fromIdx + this.gridColumns;
        break;
    }
    toIdx = Math.max(0, Math.min(last, toIdx));
    if (toIdx === fromIdx) return;

    this.animateReorder(() => {
      this.swapAt(fromIdx, toIdx);
      this.reconcile();
    });

    card.focus();
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this.announceMove(toIdx + 1, last + 1);

    void this.swapPagesInDoc(doc, fromIdx, toIdx);
  }

  /**
   * Échange en place les entrées aux indices `a` et `b` dans les trois tableaux parallèles
   * (`pageIds`, `pageFileIndex`, `originalPageNumbers`). Doit rester aligné avec le swap PDF.
   */
  private swapAt(a: number, b: number): void {
    [this.pageIds[a], this.pageIds[b]] = [this.pageIds[b]!, this.pageIds[a]!];
    [this.pageFileIndex[a], this.pageFileIndex[b]] = [
      this.pageFileIndex[b]!,
      this.pageFileIndex[a]!,
    ];
    [this.originalPageNumbers[a], this.originalPageNumbers[b]] = [
      this.originalPageNumbers[b]!,
      this.originalPageNumbers[a]!,
    ];
  }

  /**
   * Implémente un swap de pages dans MuPDF alors que l’API n’expose que des déplacements par insertion :
   * `movePage(from, to)` puis `movePage(…, from)` pour ramener l’autre page à l’index d’origine.
   */
  private async swapPagesInDoc(doc: PdfDocument, from: number, to: number): Promise<void> {
    try {
      await doc.movePage(from, to);
      await doc.movePage(to > from ? to - 1 : to + 1, from);
    } catch (err) {
      console.error('[pidief] Swap impossible:', err);
    }
  }

  /**
   * Publie un message court dans `[data-move-announcer]` (région `aria-live="polite"`).
   * Réinitialise puis remplit au microtask pour forcer une re-annonce si le texte est identique.
   *
   * @param position - Numéro d’ordre affiché (1-based).
   * @param total - Nombre total de pages.
   */
  private announceMove(position: number, total: number): void {
    const announcer = this.querySelector<HTMLElement>('[data-move-announcer]');
    if (!announcer) return;
    announcer.textContent = '';
    queueMicrotask(() => {
      announcer.textContent = `Page déplacée à la position ${position} sur ${total}.`;
    });
  }

  // --- Helper FLIP partagé (drag + clavier) ---

  /**
   * Enregistre les rectangles de toutes les cartes de la grille, exécute `mutate` (reorder + reconcile),
   * puis anime la transition avec `applyFlipFromRects`. Sans grille, exécute seulement `mutate`.
   *
   * @param mutate - Met à jour l’état et le DOM (ex. swap ou splice + `reconcile()`).
   */
  private animateReorder(mutate: () => void): void {
    const grid = this.querySelector<HTMLElement>('[data-grid]');
    if (!grid) {
      mutate();
      return;
    }
    const beforeRects = new Map<PiPageCard, DOMRect>();
    for (const el of Array.from(grid.querySelectorAll<PiPageCard>('pi-page-card'))) {
      beforeRects.set(el, el.getBoundingClientRect());
    }
    this.applyFlipFromRects(beforeRects, mutate);
  }

  /**
   * Animation FLIP : remet les transitions, applique `mutate`, calcule les deltas `before → after`
   * et anime `transform` vers zéro sur la frame suivante (~220 ms de nettoyage).
   *
   * @param beforeRects - Positions des cartes **avant** `mutate` (clé = élément encore présent après).
   * @param mutate - Modifie l’ordre des nœuds / état ; les mêmes clés de `beforeRects` doivent exister après.
   */
  private applyFlipFromRects(
    beforeRects: Map<PiPageCard, DOMRect>,
    mutate: () => void,
  ): void {
    for (const [el] of beforeRects) {
      el.style.transition = 'none';
      el.style.transform = '';
    }
    mutate();
    for (const [el, before] of beforeRects) {
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    }
    requestAnimationFrame(() => {
      for (const [el] of beforeRects) {
        el.style.transition = 'transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1)';
        el.style.transform = '';
      }
    });
    window.setTimeout(() => {
      for (const [el] of beforeRects) {
        el.style.transition = '';
      }
    }, 220);
  }
}

if (!customElements.get('pi-edit-screen')) {
  customElements.define('pi-edit-screen', EditScreen);
}
