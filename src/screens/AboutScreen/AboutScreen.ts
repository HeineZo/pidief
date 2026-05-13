import '@components/base/Button/PiButton';
import template from './aboutScreen.html?raw';
import './aboutScreen.css';
import aboutCompareManifest from './aboutCompare.json';
import { applyTranslations, subscribe, t } from '@i18n';

/** Valeurs affichées dans une cellule du comparatif. */
type CompareCell = 'yes' | 'no' | 'meh' | 'yes-no' | 'no-yes';

type CompetitorId = 'iLovePDF' | 'SmallPDF';

type CompareRowKey =
  | 'local'
  | 'account'
  | 'limits'
  | 'tracking'
  | 'offline'
  | 'openSource';

/** Lignes du comparatif où Pidief a un titre explicatif au survol. */
const PIDEF_TITLE_ROWS: ReadonlySet<CompareRowKey> = new Set(['limits', 'tracking']);

/** Données d’une ligne complète du comparatif. */
interface CompareRowData {
  pidief: CompareCell;
  them: Record<CompetitorId, CompareCell>;
}

/** Forme attendue du fichier de comparaison (structure pure). */
interface AboutCompareManifest {
  rows: Record<CompareRowKey, CompareRowData>;
}

const aboutCompare = aboutCompareManifest as AboutCompareManifest;
const COMPARE_DATA = aboutCompare.rows;

const ICON_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_CROSS =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICON_MEH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg>';
const HOW_STEP_DURATION_MS = 10_000;

/** Variante visuelle dérivée d’une valeur métier du comparatif. */
interface CellVisual {
  text: string;
  mod: 'yes' | 'no' | 'meh';
  icon: string;
}

/**
 * Associe chaque valeur de cellule à son libellé (traduit), son icône et sa classe CSS.
 */
function cellVisual(value: CompareCell): CellVisual {
  switch (value) {
    case 'yes':
      return { text: t('about.cellYes'), mod: 'yes', icon: ICON_CHECK };
    case 'no':
      return { text: t('about.cellNo'), mod: 'no', icon: ICON_CROSS };
    case 'meh':
      return { text: t('about.cellMeh'), mod: 'meh', icon: ICON_MEH };
    case 'yes-no':
    case 'no-yes':
      return { text: t('about.cellLimits'), mod: 'meh', icon: ICON_MEH };
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

/** Échappe une chaîne destinée à être placée dans un attribut HTML. */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Échappe une chaîne destinée à être injectée dans du HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Options de rendu pour compléter ou remplacer le libellé par défaut. */
interface CompareCellOptions {
  title?: string;
  label?: string;
}

/** Données extraites d’un bouton d’étape pour piloter la vidéo associée. */
interface HowStepData {
  button: HTMLButtonElement;
  title: string;
  videoSrc: string;
  videoType: string;
  videoLabel: string;
}

/**
 * Rend le HTML d’une cellule du tableau comparatif
 */
function renderCompareCell(value: CompareCell, options?: CompareCellOptions): string {
  const { text, mod, icon } = cellVisual(value);
  const displayText = options?.label ?? text;
  const titleAttr = options?.title ? ` title="${escapeAttr(options.title)}"` : '';
  return `<span class="about-cell about-cell--${mod}"${titleAttr}>${icon}<span class="about-cell__text">${escapeHtml(displayText)}</span></span>`;
}

export class AboutScreen extends HTMLElement {
  private compareAbort: AbortController | null = null;
  private howAbort: AbortController | null = null;
  private navAbort: AbortController | null = null;
  private howStepTimer: number | null = null;
  private unsubscribeLang: (() => void) | null = null;
  private activeCompetitor: CompetitorId = 'iLovePDF';
  private activeHowStep = 0;

  /** Monte le template puis initialise les interactions locales à l’écran. */
  connectedCallback(): void {
    this.innerHTML = template;
    applyTranslations(this);
    this.initNavActions();
    this.initCompareTable();
    this.initHowFlow();
    this.unsubscribeLang = subscribe(() => this.onLangChanged());
  }

  /** Nettoie les listeners et timers quand l’écran quitte le DOM. */
  disconnectedCallback(): void {
    this.compareAbort?.abort();
    this.compareAbort = null;
    this.howAbort?.abort();
    this.howAbort = null;
    this.navAbort?.abort();
    this.navAbort = null;
    this.clearHowStepTimer();
    this.unsubscribeLang?.();
    this.unsubscribeLang = null;
  }

  /** Retour accueil et CTA : émet `request-navigate` comme `<pi-nav>`. */
  private initNavActions(): void {
    this.navAbort?.abort();
    this.navAbort = new AbortController();
    const { signal } = this.navAbort;

    this.addEventListener(
      'click',
      (event) => {
        const btnHost = (event.target as HTMLElement).closest<HTMLElement>('pi-button[data-action]');
        if (!btnHost || !this.contains(btnHost)) return;
        const action = btnHost.getAttribute('data-action');
        if (action !== 'back' && action !== 'open-app') return;
        this.dispatchEvent(
          new CustomEvent<{ path: string }>('request-navigate', {
            detail: { path: '/' },
            bubbles: true,
            composed: true,
          }),
        );
      },
      { signal },
    );
  }

  /** Initialise le tableau comparatif et son sélecteur de service concurrent. */
  private initCompareTable(): void {
    const toggle = this.querySelector<HTMLElement>('[data-compare-toggle]');
    const nameEl = this.querySelector<HTMLElement>('[data-competitor-name]');
    const liveEl = this.querySelector<HTMLElement>('#about-compare-live');
    const tbody = this.querySelector<HTMLElement>('[data-compare-tbody]');

    if (!toggle || !nameEl || !liveEl || !tbody) return;

    this.compareAbort?.abort();
    this.compareAbort = new AbortController();
    const { signal } = this.compareAbort;

    this.renderPidiefColumn(tbody);
    this.applyCompetitor(this.activeCompetitor, nameEl, liveEl, tbody, { animate: false });

    toggle.addEventListener(
      'click',
      (event) => {
        const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-competitor]');
        if (!btn) return;
        const id = btn.dataset.competitor;
        if (id !== 'iLovePDF' && id !== 'SmallPDF') return;
        this.activeCompetitor = id;

        for (const b of Array.from(toggle.querySelectorAll('button[data-competitor]')) as HTMLButtonElement[]) {
          b.setAttribute('aria-pressed', String(b === btn));
        }

        this.applyCompetitor(id, nameEl, liveEl, tbody, { animate: true });
      },
      { signal },
    );
  }

  /** Rend la colonne Pidief du comparatif (langue-dépendante). */
  private renderPidiefColumn(tbody: HTMLElement): void {
    const rows = Array.from(tbody.querySelectorAll('[data-compare-row]')) as HTMLTableRowElement[];
    for (const row of rows) {
      const key = row.dataset.compareRow as CompareRowKey | undefined;
      if (!key || !COMPARE_DATA[key]) continue;

      const { pidief } = COMPARE_DATA[key];
      const pidiefTd = row.querySelector('[data-compare-cell="pidief"]') as HTMLTableCellElement | null;
      if (pidiefTd) {
        const title = PIDEF_TITLE_ROWS.has(key)
          ? t(`about.compareRow.${key}.pidiefTitle`)
          : undefined;
        pidiefTd.innerHTML = renderCompareCell(pidief, { title });
        pidiefTd.setAttribute('data-compare-value', pidief);
      }
    }
  }

  /** Applique les données du concurrent sélectionné au tableau comparatif. */
  private applyCompetitor(
    id: CompetitorId,
    nameEl: HTMLElement,
    liveEl: HTMLElement,
    tbody: HTMLElement,
    options: { animate: boolean } = { animate: true },
  ): void {
    const competitorName = t(`about.competitor.${id}`);
    nameEl.textContent = competitorName;
    nameEl.setAttribute('data-i18n', `about.competitor.${id}`);
    liveEl.textContent = t('about.compareLiveUpdate', { name: competitorName });

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (options.animate && !reduceMotion) {
      tbody.style.opacity = '0.68';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tbody.style.opacity = '';
        });
      });
    }

    const rows = Array.from(tbody.querySelectorAll('[data-compare-row]')) as HTMLTableRowElement[];
    for (const row of rows) {
      const key = row.dataset.compareRow as CompareRowKey | undefined;
      if (!key || !COMPARE_DATA[key]) continue;

      const themTd = row.querySelector('[data-compare-cell="them"]') as HTMLTableCellElement | null;
      if (!themTd) continue;

      const cellValue = COMPARE_DATA[key].them[id];
      const label = t(`about.them.${key}.${id}`);
      themTd.dataset.mobileLabel = competitorName;
      themTd.setAttribute('data-i18n-attr', `data-mobile-label:about.competitor.${id}`);
      themTd.innerHTML = renderCompareCell(cellValue, { label });
      themTd.setAttribute('data-compare-value', cellValue);
    }
  }

  /** Branche les boutons d’étapes à la vidéo et lance le passage automatique. */
  private initHowFlow(): void {
    const flow = this.querySelector<HTMLElement>('[data-how-flow]');
    const video = this.querySelector<HTMLVideoElement>('[data-how-video-media]');
    const videoShell = this.querySelector<HTMLElement>('[data-how-video]');
    const stepButtons = Array.from(this.querySelectorAll<HTMLButtonElement>('button[data-how-step]'));

    if (!flow || !video || !videoShell || stepButtons.length === 0) return;

    this.howAbort?.abort();
    this.clearHowStepTimer();
    this.howAbort = new AbortController();
    const { signal } = this.howAbort;
    const steps = stepButtons.map((button) => this.readHowStepData(button));
    this.activeHowStep = Math.min(this.activeHowStep, steps.length - 1);

    flow.style.setProperty('--how-step-duration', `${HOW_STEP_DURATION_MS}ms`);

    for (let index = 0; index < steps.length; index += 1) {
      const { button } = steps[index];
      button.addEventListener(
        'click',
        () => {
          this.applyHowStep(index, steps, video, videoShell);
          this.scheduleNextHowStep(steps, video, videoShell);
        },
        { signal },
      );
    }

    this.applyHowStep(this.activeHowStep, steps, video, videoShell);
    this.scheduleNextHowStep(steps, video, videoShell);
  }

  private readHowStepData(button: HTMLButtonElement): HowStepData {
    const title = button.querySelector<HTMLElement>('.how-list__title')?.textContent?.trim() ?? '';
    const videoSrc = button.dataset.videoSrc?.trim() ?? '';
    const videoType = button.dataset.videoType?.trim() ?? '';
    const videoLabel = button.dataset.videoLabel?.trim() ?? title;

    return { button, title, videoSrc, videoType, videoLabel };
  }

  /** Active visuellement une étape et synchronise la vidéo associée. */
  private applyHowStep(
    index: number,
    steps: HowStepData[],
    video: HTMLVideoElement,
    videoShell: HTMLElement,
  ): void {
    const step = steps[index];
    if (!step) return;

    this.activeHowStep = index;
    video.setAttribute('aria-label', step.videoLabel);

    for (const [stepIndex, { button }] of steps.entries()) {
      const isActive = stepIndex === index;
      button.dataset.active = String(isActive);
      button.toggleAttribute('aria-current', isActive);
      if (isActive) this.restartHowProgress(button);
    }

    this.updateHowVideo(video, videoShell, step);
  }

  /** Remplace la source de la vidéo sans recréer tout le bloc vidéo. */
  private updateHowVideo(video: HTMLVideoElement, videoShell: HTMLElement, step: HowStepData): void {
    while (video.firstChild) {
      video.firstChild.remove();
    }

    if (!step.videoSrc) {
      videoShell.dataset.hasVideo = 'false';
      video.removeAttribute('src');
      video.load();
      return;
    }

    const source = document.createElement('source');
    source.src = step.videoSrc;
    if (step.videoType) source.type = step.videoType;

    video.append(source, document.createTextNode(t('about.howVideoFallback')));
    videoShell.dataset.hasVideo = 'true';
    video.load();
    void video.play().catch(() => undefined);
  }

  /** Programme le passage à l’étape suivante en boucle. */
  private scheduleNextHowStep(
    steps: HowStepData[],
    video: HTMLVideoElement,
    videoShell: HTMLElement,
  ): void {
    this.clearHowStepTimer();
    this.howStepTimer = window.setTimeout(() => {
      const nextIndex = (this.activeHowStep + 1) % steps.length;
      this.applyHowStep(nextIndex, steps, video, videoShell);
      this.scheduleNextHowStep(steps, video, videoShell);
    }, HOW_STEP_DURATION_MS);
  }

  /** Annule le timer d’étapes courant s’il existe. */
  private clearHowStepTimer(): void {
    if (this.howStepTimer === null) return;
    window.clearTimeout(this.howStepTimer);
    this.howStepTimer = null;
  }

  /** Relance l’animation CSS de progression quand une étape devient active. */
  private restartHowProgress(button: HTMLButtonElement): void {
    const progressBar = button.querySelector<HTMLElement>('.how-step__progress-bar');
    if (!progressBar) return;

    progressBar.style.animation = 'none';
    void progressBar.offsetWidth;
    progressBar.style.animation = '';
  }

  /** Recalcule les zones langue-dépendantes (cellules comparatives, label live). */
  private onLangChanged(): void {
    applyTranslations(this);
    const tbody = this.querySelector<HTMLElement>('[data-compare-tbody]');
    const nameEl = this.querySelector<HTMLElement>('[data-competitor-name]');
    const liveEl = this.querySelector<HTMLElement>('#about-compare-live');
    if (!tbody || !nameEl || !liveEl) return;
    this.renderPidiefColumn(tbody);
    this.applyCompetitor(this.activeCompetitor, nameEl, liveEl, tbody, { animate: false });
  }
}

if (!customElements.get('pi-about-screen')) {
  customElements.define('pi-about-screen', AboutScreen);
}
