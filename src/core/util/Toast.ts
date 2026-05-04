import { toast } from 'sonner-web-component';

/**
 * Affiche un toast d'erreur
 */
export function sendError(message: string): never {
  toast.error(message);
  throw new Error(message);
}

/**
 * Affiche un toast de succès
 */
export function sendSuccess(message: string): void {
  toast.success(message);
}

/**
 * Affiche un toast de warning
 */
export function sendWarning(message: string): void {
  toast.warning(message);
}

/**
 * Affiche un toast d'information
 */
export function sendInfo(message: string): void {
  toast.info(message);
}