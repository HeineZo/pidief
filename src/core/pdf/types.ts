export type PdfRotationDelta = 90 | -90 | 180;

export interface PdfPageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PdfRenderOptions {
  scale?: number;
}

export interface PdfMergeOptions {
  at?: number;
}
