/**
 * Effectue un scroll fluide vers le bas d'un conteneur.
 * @param container - L'élément scrollable cible. Si non fourni, utilise l'élément scrollable du document.
 */
export const scrollToBottom = (container: HTMLElement | null = null): void => {
  const target = container ?? document.scrollingElement ?? document.documentElement;
  if (!target) return;
  target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
};
