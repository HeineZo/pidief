import type { PdfEngineApi, PdfEngineResult } from './pdfEngineApi';
import type { PdfMergeOptions, PdfPageInfo, PdfRenderOptions, PdfRotationDelta } from './types';
import { failWith } from '@util/Toast';

type ChangeDetail = { pages: ReadonlyArray<PdfPageInfo>; pageCount: number };

export class PdfDocument extends EventTarget {
  private readonly engine: PdfEngineApi;
  private readonly docId: string;
  private _pageCount: number;
  private _pages: PdfPageInfo[];
  private closed = false;

  constructor(engine: PdfEngineApi, docId: string, pageCount: number, pages: PdfPageInfo[]) {
    super();
    this.engine = engine;
    this.docId = docId;
    this._pageCount = pageCount;
    this._pages = pages;
  }

  get id(): string {
    return this.docId;
  }

  get pageCount(): number {
    return this._pageCount;
  }

  get pages(): ReadonlyArray<PdfPageInfo> {
    return this._pages;
  }

  async renderPage(
    index: number,
    options?: PdfRenderOptions,
  ): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
    this.ensureOpen();
    const scale = options?.scale ?? 1;
    const res = await this.engine.post({
      type: 'renderPage',
      docId: this.docId,
      pageIndex: index,
      scale,
    });
    if (res.type !== 'renderOk') {
      failWith(`Réponse render inattendue: ${res.type}`);
    }
    return { bitmap: res.bitmap, width: res.width, height: res.height };
  }

  async merge(other: PdfDocument, opts?: PdfMergeOptions): Promise<void> {
    this.ensureOpen();
    other.ensureOpen();
    if (other.docId === this.docId) {
      failWith('Impossible de fusionner un document avec lui-même.');
    }
    if (other.engine !== this.engine) {
      failWith('Les deux documents doivent provenir du même PdfEngine.');
    }
    const at = opts?.at ?? this._pageCount;
    const res = await this.engine.post({
      type: 'merge',
      destDocId: this.docId,
      srcDocId: other.docId,
      at,
    });
    this.applyMutation(res);
  }

  async movePage(from: number, to: number): Promise<void> {
    this.ensureOpen();
    const res = await this.engine.post({
      type: 'movePage',
      docId: this.docId,
      from,
      to,
    });
    this.applyMutation(res);
  }

  async rotatePage(index: number, delta: PdfRotationDelta): Promise<void> {
    this.ensureOpen();
    const res = await this.engine.post({
      type: 'rotatePage',
      docId: this.docId,
      pageIndex: index,
      delta,
    });
    this.applyMutation(res);
  }

  async deletePage(index: number): Promise<void> {
    this.ensureOpen();
    const res = await this.engine.post({
      type: 'deletePage',
      docId: this.docId,
      pageIndex: index,
    });
    this.applyMutation(res);
  }

  async exportToBlob(): Promise<Blob> {
    this.ensureOpen();
    const res = await this.engine.post({ type: 'export', docId: this.docId });
    if (res.type !== 'exportOk') {
      failWith(`Réponse export inattendue: ${res.type}`);
    }
    return new Blob([res.buffer], { type: 'application/pdf' });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    const res = await this.engine.post({ type: 'close', docId: this.docId });
    if (res.type !== 'closeOk') {
      failWith(`Réponse close inattendue: ${res.type}`);
    }
    this.closed = true;
  }

  private ensureOpen(): void {
    if (this.closed) {
      failWith('Document PDF fermé.');
    }
  }

  private applyMutation(res: PdfEngineResult): void {
    if (res.type !== 'docMutationOk') {
      failWith(`Réponse mutation inattendue: ${res.type}`);
    }
    if (res.docId !== this.docId) {
      failWith('Réponse mutation pour un autre document.');
    }
    this._pageCount = res.pageCount;
    this._pages = res.pages;
    this.dispatchChange();
  }

  private dispatchChange(): void {
    const detail: ChangeDetail = { pages: this._pages, pageCount: this._pageCount };
    this.dispatchEvent(new CustomEvent<ChangeDetail>('change', { detail }));
  }
}
