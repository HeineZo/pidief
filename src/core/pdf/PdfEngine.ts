import PdfWorker from './pdfWorker.ts?worker';
import type { PdfRequest, PdfRequestPayload, PdfResponse } from './messages';
import type { PdfEngineApi, PdfEngineResult } from './pdfEngineApi';
import { PdfDocument } from './PdfDocument';
import { failWith, sendError } from '@util/Toast';

type Pending = {
  resolve: (value: PdfEngineResult) => void;
  reject: (reason: Error) => void;
};

export class PdfEngine implements PdfEngineApi {
  private static instance: PdfEngine | null = null;

  static shared(): PdfEngine {
    PdfEngine.instance ??= new PdfEngine();
    return PdfEngine.instance;
  }

  private worker: Worker | null = null;
  private readonly pending = new Map<string, Pending>();

  private constructor() {}

  warmup(): void {
    void this.ensureWorker();
  }

  async open(source: File | Blob | ArrayBuffer): Promise<PdfDocument> {
    const buffer = await readToArrayBuffer(source);
    const transferable = buffer.slice(0);
    const res = await this.post({ type: 'open', buffer: transferable });
    if (res.type !== 'openOk') {
      failWith("Impossible d'ouvrir le PDF");
    }
    return new PdfDocument(this, res.docId, res.pageCount, res.pages);
  }

  post(req: PdfRequestPayload): Promise<PdfEngineResult> {
    return new Promise((resolve, reject) => {
      void this.ensureWorker()
        .then(() => {
          const requestId = crypto.randomUUID();
          const message = { ...req, requestId } as PdfRequest;
          this.pending.set(requestId, { resolve, reject });
          try {
            this.worker!.postMessage(message, outgoingTransfer(message));
          } catch (e) {
            this.pending.delete(requestId);
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        })
        .catch(reject);
    });
  }

  private async ensureWorker(): Promise<void> {
    if (this.worker) return;

    const w = new PdfWorker();
    w.addEventListener('message', (ev: MessageEvent<PdfResponse>) => {
      const data = ev.data;
      const id = data.requestId;
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      if (data.type === 'error') {
        entry.reject(new Error(data.message));
        sendError(data.message);
        return;
      }
      entry.resolve(data as PdfEngineResult);
    });

    w.addEventListener('messageerror', (ev) => {
      this.rejectAllPending(
        new Error(
          `Erreur de désérialisation worker: ${ev instanceof Error ? ev.message : String(ev)}`,
        ),
      );
    });

    w.addEventListener('error', (ev) => {
      this.rejectAllPending(
        new Error(ev.message ? `Worker: ${ev.message}` : 'Erreur worker inconnue'),
      );
    });

    this.worker = w;
  }

  private rejectAllPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }
}

function outgoingTransfer(req: PdfRequestPayload): Transferable[] {
  if (req.type === 'open') return [req.buffer];
  return [];
}

async function readToArrayBuffer(source: File | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) return source;
  return source.arrayBuffer();
}
