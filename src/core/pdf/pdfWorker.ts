/// <reference lib="webworker" />

import * as mupdf from 'mupdf';
import type { PdfPageInfo } from './types';
import type { PdfRequest, PdfResponse } from './messages';

// Le worker n'a pas de DOM: on ne peut pas importer ici du code UI
// (toast, web components, etc.). Les erreurs sont relayées au main
// thread via un message `error`, qui se chargera de l'affichage.
function fail(message: string): never {
  throw new Error(message);
}

const docs = new Map<string, mupdf.PDFDocument>();

function reply(res: PdfResponse, transfer: Transferable[] = []): void {
  self.postMessage(res, transfer);
}

function normalizeRotationDegrees(deg: number): 0 | 90 | 180 | 270 {
  let r = Math.round(deg) % 360;
  if (r < 0) r += 360;
  const snapped = (Math.round(r / 90) * 90) % 360;
  if (snapped !== 0 && snapped !== 90 && snapped !== 180 && snapped !== 270) {
    return 0;
  }
  return snapped as 0 | 90 | 180 | 270;
}

function readRotateDegrees(page: mupdf.PDFPage): number {
  const obj = page.getObject();
  const rot = obj.get('Rotate');
  if (!rot || rot.isNull() || !rot.isNumber()) return 0;
  return normalizeRotationDegrees(rot.asNumber());
}

function pageBoundsSize(page: mupdf.PDFPage): { width: number; height: number } {
  const b = page.getBounds();
  const width = Math.max(0, b[2]! - b[0]!);
  const height = Math.max(0, b[3]! - b[1]!);
  return { width, height };
}

function collectSnapshot(pdf: mupdf.PDFDocument): PdfPageInfo[] {
  const n = pdf.countPages();
  const pages: PdfPageInfo[] = [];
  for (let i = 0; i < n; i++) {
    const page = pdf.loadPage(i) as mupdf.PDFPage;
    try {
      const { width, height } = pageBoundsSize(page);
      pages.push({
        index: i,
        width,
        height,
        rotation: readRotateDegrees(page),
      });
    } finally {
      page.destroy();
    }
  }
  return pages;
}

function pixmapToImageData(pix: mupdf.Pixmap): ImageData {
  const w = pix.getWidth();
  const h = pix.getHeight();
  const stride = pix.getStride();
  const n = pix.getNumberOfComponents();
  const src = pix.getPixels();
  const out = new Uint8ClampedArray(w * h * 4);

  if (n === 4) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = y * stride + x * 4;
        const di = (y * w + x) * 4;
        out[di] = src[si]!;
        out[di + 1] = src[si + 1]!;
        out[di + 2] = src[si + 2]!;
        out[di + 3] = src[si + 3]!;
      }
    }
  } else if (n === 3) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = y * stride + x * 3;
        const di = (y * w + x) * 4;
        out[di] = src[si]!;
        out[di + 1] = src[si + 1]!;
        out[di + 2] = src[si + 2]!;
        out[di + 3] = 255;
      }
    }
  } else {
    fail(`Le format pixmap n'est pas supporté (${n} composantes)`);
  }

  return new ImageData(out, w, h);
}

function requireDoc(docId: string): mupdf.PDFDocument {
  const pdf = docs.get(docId);
  if (!pdf) fail('Document inconnu');
  return pdf;
}

async function handle(req: PdfRequest): Promise<void> {
  const { requestId } = req;
  try {
    switch (req.type) {
      case 'open': {
        const pdf = new mupdf.PDFDocument(new Uint8Array(req.buffer));
        if (pdf.needsPassword()) {
          pdf.destroy();
          reply({ type: 'error', requestId, message: 'PDF protégé par mot de passe' });
          return;
        }
        const docId = crypto.randomUUID();
        docs.set(docId, pdf);
        const pages = collectSnapshot(pdf);
        reply({
          type: 'openOk',
          requestId,
          docId,
          pages,
          pageCount: pages.length,
        });
        return;
      }

      case 'close': {
        const pdf = requireDoc(req.docId);
        docs.delete(req.docId);
        pdf.destroy();
        reply({ type: 'closeOk', requestId });
        return;
      }

      case 'renderPage': {
        const pdf = requireDoc(req.docId);
        const n = pdf.countPages();
        if (req.pageIndex < 0 || req.pageIndex >= n) {
          fail(`L'index ${req.pageIndex} est invalide`);
        }
        const page = pdf.loadPage(req.pageIndex) as mupdf.PDFPage;
        try {
          const pixmap = page.toPixmap(
            mupdf.Matrix.scale(req.scale, req.scale),
            mupdf.ColorSpace.DeviceRGB,
            false,
          );
          try {
            const imageData = pixmapToImageData(pixmap);
            const bitmap = await createImageBitmap(imageData);
            reply(
              {
                type: 'renderOk',
                requestId,
                width: imageData.width,
                height: imageData.height,
                bitmap,
              },
              [bitmap],
            );
          } finally {
            pixmap.destroy();
          }
        } finally {
          page.destroy();
        }
        return;
      }

      case 'merge': {
        if (req.destDocId === req.srcDocId) {
          fail('Impossible de fusionner un document avec lui-même.');
        }
        const dest = requireDoc(req.destDocId);
        const src = requireDoc(req.srcDocId);
        const srcCount = src.countPages();
        const destCount = dest.countPages();
        let at = req.at;
        if (at < 0) at = 0;
        if (at > destCount) at = destCount;

        const graft = dest.newGraftMap();
        try {
          for (let i = 0; i < srcCount; i++) {
            graft.graftPage(at + i, src, i);
          }
        } finally {
          graft.destroy();
        }

        const pages = collectSnapshot(dest);
        reply({
          type: 'docMutationOk',
          requestId,
          docId: req.destDocId,
          pages,
          pageCount: pages.length,
        });
        return;
      }

      case 'movePage': {
        const pdf = requireDoc(req.docId);
        const n = pdf.countPages();
        if (req.from < 0 || req.from >= n || req.to < 0 || req.to >= n) {
          fail(`Les indices ${req.from} et ${req.to} sont invalides`);
        }
        const order = Array.from({ length: n }, (_, i) => i);
        const [moved] = order.splice(req.from, 1);
        order.splice(req.to, 0, moved!);
        pdf.rearrangePages(order);
        const pages = collectSnapshot(pdf);
        reply({
          type: 'docMutationOk',
          requestId,
          docId: req.docId,
          pages,
          pageCount: pages.length,
        });
        return;
      }

      case 'rotatePage': {
        const pdf = requireDoc(req.docId);
        const n = pdf.countPages();
        if (req.pageIndex < 0 || req.pageIndex >= n) {
          fail(`L'index ${req.pageIndex} est invalide`);
        }
        const page = pdf.loadPage(req.pageIndex) as mupdf.PDFPage;
        try {
          const obj = page.getObject();
          const rot = obj.get('Rotate');
          let cur = 0;
          if (rot && !rot.isNull() && rot.isNumber()) {
            cur = rot.asNumber();
          }
          const next = normalizeRotationDegrees(cur + req.delta);
          if (next === 0) {
            obj.delete('Rotate');
          } else {
            obj.put('Rotate', pdf.newInteger(next));
          }
        } finally {
          page.destroy();
        }
        const pages = collectSnapshot(pdf);
        reply({
          type: 'docMutationOk',
          requestId,
          docId: req.docId,
          pages,
          pageCount: pages.length,
        });
        return;
      }

      case 'deletePage': {
        const pdf = requireDoc(req.docId);
        const n = pdf.countPages();
        if (req.pageIndex < 0 || req.pageIndex >= n) {
          fail(`L'index ${req.pageIndex} est invalide`);
        }
        pdf.deletePage(req.pageIndex);
        const pages = collectSnapshot(pdf);
        reply({
          type: 'docMutationOk',
          requestId,
          docId: req.docId,
          pages,
          pageCount: pages.length,
        });
        return;
      }

      case 'export': {
        const pdf = requireDoc(req.docId);
        const buf = pdf.saveToBuffer('garbage,compress');
        try {
          const u8 = buf.asUint8Array();
          const out = new ArrayBuffer(u8.byteLength);
          new Uint8Array(out).set(u8);
          reply({ type: 'exportOk', requestId, buffer: out }, [out]);
        } finally {
          buf.destroy();
        }
        return;
      }

      default: {
        const _exhaustive: never = req;
        void _exhaustive;
        fail('La requête est inconnue');
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    reply({ type: 'error', requestId, message });
  }
}

self.addEventListener('message', (ev: MessageEvent<PdfRequest>) => {
  void handle(ev.data);
});
