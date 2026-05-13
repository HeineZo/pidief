const isAppleLikeFromUserAgent = (userAgent: string): boolean =>
  /Macintosh|iPhone|iPad|iPod/i.test(userAgent);

interface NavigatorWithUACh extends Navigator {
  readonly userAgentData?: { readonly platform?: string };
}

const isApplePlatform = (): boolean => {
  const nav = navigator as NavigatorWithUACh;
  const hint = nav.userAgentData?.platform;

  if (typeof hint === 'string' && hint.length > 0) {
    const p = hint.toLowerCase();
    return (
      p.includes('mac') ||
      p.includes('iphone') ||
      p.includes('ipad') ||
      p.includes('ipod')
    );
  }

  return isAppleLikeFromUserAgent(nav.userAgent);
};

/**
 * Returns the best user-facing keyboard shortcut label for "Paste",
 * depending on the platform (Apple devices use ⌘, others use Ctrl).
 */
export const getPasteShortcutLabel = (): string => {
  return isApplePlatform() ? '⌘V' : 'Ctrl+V';
};

/**
 * Verbal version of the paste shortcut, safe for screen readers
 * (avoids the bare ⌘ glyph which some assistive technologies skip).
 */
export const getPasteShortcutAccessibleLabel = (): string => {
  return isApplePlatform() ? 'Commande V' : 'Ctrl V';
};
