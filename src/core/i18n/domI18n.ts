import { t, type TranslationParams } from './strings';

/**
 * Applique les traductions sur tout le sous-arbre de `root`.
 *
 * Conventions d'annotations dans les templates :
 *  - `data-i18n="key"`       → remplace `textContent` (par défaut).
 *  - `data-i18n-html="key"`  → remplace `innerHTML` (utile pour `<em>`, `<br>`, …).
 *  - `data-i18n-attr="aria-label:key1; title:key2"` → définit chaque attribut.
 *  - `data-i18n-params='{"count":3}'` → fournit les paramètres d'interpolation
 *    pour les autres `data-i18n*` du même nœud.
 *
 * La fonction prend aussi en compte `root` lui-même s'il porte les attributs.
 */
export function applyTranslations(root: ParentNode | Element): void {
  if (root instanceof Element) {
    applyToElement(root);
  }
  const all = root.querySelectorAll<Element>(
    '[data-i18n], [data-i18n-html], [data-i18n-attr]',
  );
  all.forEach(applyToElement);
}

function parseParams(el: Element): TranslationParams | undefined {
  const raw = el.getAttribute('data-i18n-params');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as TranslationParams;
    }
  } catch {
    // JSON invalide : silencieux côté prod
  }
  return undefined;
}

function applyToElement(el: Element): void {
  const params = parseParams(el);

  const textKey = el.getAttribute('data-i18n');
  if (textKey) {
    el.textContent = t(textKey, params);
  }

  const htmlKey = el.getAttribute('data-i18n-html');
  if (htmlKey) {
    el.innerHTML = t(htmlKey, params);
  }

  const attrSpec = el.getAttribute('data-i18n-attr');
  if (attrSpec) {
    for (const pair of attrSpec.split(';')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const attrName = trimmed.slice(0, colonIdx).trim();
      const key = trimmed.slice(colonIdx + 1).trim();
      if (!attrName || !key) continue;
      el.setAttribute(attrName, t(key, params));
    }
  }
}
