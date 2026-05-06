import { toast } from 'sonner-web-component';

/**
 * Affiche un toast d'erreur (n'interrompt pas le flow).
 */
export function sendError(message: string): void {
  toast.error(message);
}

/**
 * Affiche un toast d'erreur puis interrompt le flow en lançant une Error.
 * À utiliser quand le flow ne peut pas continuer (narrowing TS, rejet de promise).
 */
export function failWith(message: string): never {
  sendError(message);
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