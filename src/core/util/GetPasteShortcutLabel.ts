const isAppleLikeFromUserAgent = (userAgent: string): boolean =>
  /Macintosh|iPhone|iPad|iPod/i.test(userAgent);

interface NavigatorWithUACh extends Navigator {
  readonly userAgentData?: { readonly platform?: string };
}

/**
 * Returns the best user-facing keyboard shortcut label for "Paste",
 * depending on the platform (Apple devices use ⌘, others use Ctrl).
 */
export const getPasteShortcutLabel = (): string => {
  const nav = navigator as NavigatorWithUACh;
  const hint = nav.userAgentData?.platform;

  if (typeof hint === 'string' && hint.length > 0) {
    const p = hint.toLowerCase();
    const isApple =
      p.includes('mac') ||
      p.includes('iphone') ||
      p.includes('ipad') ||
      p.includes('ipod');
    return isApple ? '⌘V' : 'Ctrl+V';
  }

  return isAppleLikeFromUserAgent(nav.userAgent) ? '⌘V' : 'Ctrl+V';
};
