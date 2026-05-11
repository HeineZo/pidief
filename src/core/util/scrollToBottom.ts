export const scrollToBottom = (container: HTMLElement | null = null): void => {
  const target = container ?? document.scrollingElement ?? document.documentElement;
  if (!target) return;
  target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
};
