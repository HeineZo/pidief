import type { PdfPageInfo } from './types';

export type PdfRequestPayload =
  | { type: 'open'; buffer: ArrayBuffer }
  | { type: 'close'; docId: string }
  | {
      type: 'renderPage';
      docId: string;
      pageIndex: number;
      scale: number;
    }
  | {
      type: 'merge';
      destDocId: string;
      srcDocId: string;
      at: number;
    }
  | {
      type: 'movePage';
      docId: string;
      from: number;
      to: number;
    }
  | {
      type: 'rotatePage';
      docId: string;
      pageIndex: number;
      delta: number;
    }
  | { type: 'deletePage'; docId: string; pageIndex: number }
  | { type: 'deletePages'; docId: string; pageIndices: number[] }
  | { type: 'export'; docId: string };

export type PdfRequest = PdfRequestPayload & { requestId: string };

export type PdfResponse =
  | {
      type: 'openOk';
      requestId: string;
      docId: string;
      pages: PdfPageInfo[];
      pageCount: number;
    }
  | {
      type: 'docMutationOk';
      requestId: string;
      docId: string;
      pages: PdfPageInfo[];
      pageCount: number;
    }
  | {
      type: 'renderOk';
      requestId: string;
      width: number;
      height: number;
      bitmap: ImageBitmap;
    }
  | { type: 'exportOk'; requestId: string; buffer: ArrayBuffer }
  | { type: 'closeOk'; requestId: string }
  | { type: 'error'; requestId: string; message: string };
