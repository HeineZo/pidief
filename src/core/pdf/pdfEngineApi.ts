import type { PdfRequestPayload, PdfResponse } from './messages';

export type PdfEngineResult = Exclude<PdfResponse, { type: 'error' }>;

export interface PdfEngineApi {
  post(req: PdfRequestPayload): Promise<PdfEngineResult>;
}
