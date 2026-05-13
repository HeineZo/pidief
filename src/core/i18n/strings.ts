import { getCurrentLang, type Lang } from './lang';

/**
 * Valeurs du dictionnaire : chaîne traduisible, sous-dictionnaire imbriqué,
 * ou table de variantes plurielles résolue via `Intl.PluralRules`.
 */
type PluralEntry = {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
};

type DictValue = string | PluralEntry | StringDict;
type StringDict = { readonly [key: string]: DictValue };

export type TranslationParams = Readonly<Record<string, string | number>>;

const isPlural = (v: unknown): v is PluralEntry =>
  typeof v === 'object' && v !== null && 'other' in v &&
  typeof (v as { other: unknown }).other === 'string';

const fr = {
  app: {
    bootFailed: "L'application n'a pas pu se démarrer correctement",
    openPdfFailed: "Impossible d'ouvrir le PDF. Réessayez.",
  },
  common: {
    back: 'Retour',
  },
  nav: {
    home: "Retour à l'écran d'upload",
    about: 'À propos',
    languageGroup: 'Langue',
    langFr: 'Français',
    langEn: 'English',
  },
  upload: {
    srTitle: 'Vos PDFs, la confidentialité en plus',
    titleLead: 'Vos PDFs,',
    titleSoftLa: 'la',
    titlePrivacy: 'confidentialité',
    titleSoftEn: 'en',
    chooseFileAria: 'Choisir un fichier',
    sub: 'Fusionnez, réordonnez, pivotez, bref tout ce dont vous rêviez. Sans inscription et en local',
    chooseFile: 'Choisir un fichier',
    paste: 'Coller',
    pasteWithShortcut: 'Coller {shortcut}',
    pasteAriaLabel: 'Coller (raccourci {shortcut})',
    clearAll: 'Tout retirer',
    cta: 'Commencer la modification',
    fileCount: {
      one: '{count} / {max} fichier PDF ajouté',
      other: '{count} / {max} fichiers PDF ajoutés',
    },
    limitReached:
      "Limite de {max} fichiers PDF atteinte. Retirez des fichiers pour en ajouter d'autres.",
    skippedFiles: {
      one: "Un fichier n'a pas été ajouté : limite de {max} PDF.",
      other: "{count} fichiers n'ont pas été ajoutés : limite de {max} PDF.",
    },
    clipboardEmpty: 'Aucun PDF dans le presse-papier',
    clipboardUnsupported:
      'Votre navigateur ne permet pas de lire le presse-papier ici. Utilisez plutôt {shortcut}',
    clipboardClickAndPaste:
      'Cliquez dans la page puis utilisez {shortcut} pour coller un PDF',
    clipboardAccessDenied:
      "Impossible d'accéder au presse-papier. Cliquez dans la page puis utilisez {shortcut} (acceptez la permission si le navigateur la demande)",
  },
  dropzone: {
    zoneAriaLabel: 'Zone de dépôt : cliquez ou appuyez sur Entrée pour choisir un PDF',
    title: 'Déposez vos PDFs ici',
    sub: 'ou choisissez une méthode ci-dessous',
    formats: 'PDF uniquement · jusqu\u2019à {max} fichiers · max 100 Mo',
  },
  edit: {
    skipLink: "Passer au contenu principal d'édition",
    title: 'Édition du PDF',
    back: 'Retour',
    addPdf: 'Ajouter un PDF',
    addPdfAria: 'Ajouter un PDF',
    export: 'Exporter',
    legendAriaLabel: 'Fichiers PDF du projet',
    gridDensityLabel: 'Densité de la grille',
    gridColumnsValue: '{n} colonnes',
    gridAriaLabel: 'Pages PDF, naviguez avec Tab et déplacez avec les flèches',
    emptyMessage: 'Aucune page restante. Ajoutez un PDF pour continuer.',
    legendPageCount: '{n} p.',
    legendRemoveAria: 'Retirer {name} du projet',
    legendScrollAria: 'Aller à la première page dans la grille : {name}',
    legendScrollTitle: 'Voir la première page dans la grille',
    legendRemoveTitle: 'Retirer ce fichier du projet',
    limitHint: '{active} / {max} fichiers PDF',
    limitHintAtLimit:
      '{active} / {max} fichiers PDF (limite atteinte, supprimez un fichier pour en ajouter un autre)',
    addPdfDisabledTitle:
      'Limite de {max} fichiers PDF. Supprimez un ou des fichiers pour libérer une place.',
    moveAnnounced: 'Page déplacée à la position {position} sur {total}.',
    addPdfLimitWarning:
      "Limite de {max} fichiers PDF atteinte. Supprimez un ou des fichiers pour en ajouter d'autres.",
  },
  pageCard: {
    rotateTitle: 'Pivoter 90°',
    rotateAria: 'Pivoter de 90 degrés',
    deleteTitle: 'Supprimer',
    deleteAria: 'Supprimer la page',
    actionsToolbar: 'Actions de la page',
    roleDescription: 'Page déplaçable',
    pageLabel: 'Page {n}',
    pageOfAria: '{pageLabel} de {name}',
    pageOfTitle: '{pageLabel} — {name}',
    positionOf: 'position {n} sur {total}',
    positionOnly: 'position {n}',
    arrowsHint: 'Utilisez les flèches pour déplacer.',
  },
  fileChip: {
    removeAria: 'Retirer {name}',
  },
  about: {
    back: 'Retour',
    heroTitle: 'Vos PDFs<br />restent <em class="about__accent">chez vous</em>',
    heroSub:
      'Pidief manipule vos documents <em class="about__accent">directement dans le navigateur</em>. <br />Pas d\u2019inscription, pas de manipulation serveur, personne n\u2019a accès à vos données',
    heroMetaLocal: '100% local',
    heroMetaWasm: 'WebAssembly',
    heroMetaOpen: 'Open source',
    privacyCloudLabel: 'serveur',
    privacyFile1: 'rapport_final.pdf',
    privacyFile2: 'scan_001.pdf',
    privacyFile3: 'annexes.pdf',
    privacyTitle: 'Le fichier ne quitte <em class="about__accent">jamais</em> votre onglet',
    privacyBody:
      'Parce que l\u2019on est certain que vos données devraient vous appartenir, tout le traitement se fait dans votre navigateur, grâce à un <strong>WebAssembly</strong>. <br />Une fois chargé, même après une invasion zombie, Pidief marchera toujours\u00a0!',
    compareTitle: 'Côte à côte avec <em class="about__accent">les autres</em>',
    compareToggleAria: 'Choisir un service à comparer',
    compareCriterion: 'Critère',
    comparePidief: 'Pidief',
    compareLiveUpdate: 'Tableau mis à jour : comparaison avec {name}.',
    compareFootnote:
      'Les offres et politiques des services tiers évoluent : vérifie les conditions et la confidentialité sur leurs sites officiels pour le détail à jour.',
    cellYes: 'Oui',
    cellNo: 'Non',
    cellMeh: 'Partiel',
    cellLimits: '14 fichiers max, 100 Mo max',
    competitor: {
      iLovePDF: 'iLovePDF',
      SmallPDF: 'Smallpdf',
    },
    compareRow: {
      local: {
        label: 'Traitement sans envoi sur un serveur',
        desc: 'Le PDF ne quitte pas votre machine pour être modifié',
      },
      account: {
        label: 'Pas de compte nécessaire',
        desc: 'Parcours complet sans inscription obligatoire',
      },
      limits: {
        label: 'Plafonds',
        desc: 'Taille de fichier, nombre de tâches, filigranes, etc.',
        pidiefTitle:
          'Pas de quota imposé par nos serveurs ; la taille utile dépend surtout de la RAM et des limites du navigateur.',
      },
      tracking: {
        label: 'Pas de publicité ou suivi marketing tiers',
        desc: 'Bannières, analytics',
        pidiefTitle:
          "Pas de bannières publicitaires dans l'app ; chargement du site uniquement.",
      },
      offline: {
        label: 'Utilisable sans connexion internet',
        desc: 'Après le premier chargement de l\u2019app dans l\u2019onglet',
      },
      openSource: {
        label: 'Code source ouvert',
        desc: 'Auditable, modifiable, auto-hébergeable',
      },
    },
    them: {
      local: {
        iLovePDF: 'Non',
        SmallPDF: 'Non',
      },
      account: {
        iLovePDF: 'Souvent sans compte',
        SmallPDF: 'Compte / offre payante',
      },
      limits: {
        iLovePDF: '25 fichier max',
        SmallPDF: 'Très strict (filigrane, essai Pro, etc.)',
      },
      tracking: {
        iLovePDF: "Pub et mesure d'audience fréquentes",
        SmallPDF: "Mesure d'audience fréquentes",
      },
      offline: {
        iLovePDF: 'Non',
        SmallPDF: 'Non',
      },
      openSource: {
        iLovePDF: 'Non',
        SmallPDF: 'Non',
      },
    },
    howTitle: 'Quatre étapes, <em class="about__accent">zéro serveur</em>',
    howVideoFallback: 'Votre navigateur ne prend pas en charge la lecture vidéo.',
    howStep1Title: 'Vous déposez un PDF',
    howStep1Body: 'Le fichier est lu par le navigateur et gardé en mémoire locale',
    howStep2Title: 'MuPdf fait le travail',
    howStep2Body:
      'La librairie compile le PDF en WebAssembly et le manipule localement',
    howStep3Title: 'Fusionnez, réordonnez, retournez, supprimez',
    howStep3Body:
      "Utilisez l'application à votre guise à la vitesse d'une application native",
    howStep4Title: 'Téléchargez le résultat',
    howStep4Body:
      'Le PDF est compressé et téléchargé.<br />Vous repartez avec un seul fichier propre',
    featuresTitle: 'Tout ce dont vous <em class="about__accent">rêviez</em>',
    featuresLede:
      'Pas plus, pas moins.<br /> Les outils PDF que vous utilisez tous les jours, sans compromis sur la confidentialité',
    featMergeTitle: 'Fusionner',
    featMergeBody: 'Regroupez plusieurs fichiers en un seul en 2 clics',
    featReorderTitle: 'Réordonner',
    featReorderBody: 'Glissez et déposez les pages pour les réordonner',
    featRotateTitle: 'Pivoter',
    featRotateBody: 'Mauvais sens ? Pivotez les pages par 90°',
    featCutTitle: 'Découper',
    featCutBody: 'Supprimez les pages inutiles de vos PDFs',
    featPasteTitle: 'Coller',
    featPasteBody:
      "Copiez un PDF depuis l'explorateur de fichiers, puis collez dans Pidief",
    featViewTitle: 'Visualisation',
    featViewBody: "Visualisez les pages de chaque fichier en un coup d\u2019œil",
    ctaTitle: 'Prêt à <em class="about__accent">essayer</em>\u00a0?',
    ctaSub:
      'Pas de compte à créer. Pas de carte bleue à sortir. <br />Juste vos PDFs et vos besoins',
    ctaButton: 'Ouvrir Pidief',
  },
} as const satisfies StringDict;

const en = {
  app: {
    bootFailed: "The application couldn't start properly",
    openPdfFailed: "Couldn't open the PDF. Please try again.",
  },
  common: {
    back: 'Back',
  },
  nav: {
    home: 'Back to the upload screen',
    about: 'About',
    languageGroup: 'Language',
    langFr: 'Français',
    langEn: 'English',
  },
  upload: {
    srTitle: 'Your PDFs, with privacy built in',
    titleLead: 'Your PDFs,',
    titleSoftLa: '',
    titlePrivacy: 'privacy',
    titleSoftEn: 'first',
    chooseFileAria: 'Choose a file',
    sub: 'Merge, reorder, rotate, in short everything you ever dreamed of. No sign-up, fully local.',
    chooseFile: 'Choose a file',
    paste: 'Paste',
    pasteWithShortcut: 'Paste {shortcut}',
    pasteAriaLabel: 'Paste (shortcut {shortcut})',
    clearAll: 'Remove all',
    cta: 'Start editing',
    fileCount: {
      one: '{count} / {max} PDF file added',
      other: '{count} / {max} PDF files added',
    },
    limitReached:
      'Limit of {max} PDF files reached. Remove some to add more.',
    skippedFiles: {
      one: "One file wasn't added: limit of {max} PDFs.",
      other: "{count} files weren't added: limit of {max} PDFs.",
    },
    clipboardEmpty: 'No PDF in the clipboard',
    clipboardUnsupported:
      "Your browser doesn't allow reading the clipboard here. Use {shortcut} instead",
    clipboardClickAndPaste:
      'Click in the page then use {shortcut} to paste a PDF',
    clipboardAccessDenied:
      "Couldn't access the clipboard. Click in the page then use {shortcut} (accept the permission prompt if the browser asks)",
  },
  dropzone: {
    zoneAriaLabel: 'Drop zone: click or press Enter to choose a PDF',
    title: 'Drop your PDFs here',
    sub: 'or pick a method below',
    formats: 'PDF only · up to {max} files · max 100 MB',
  },
  edit: {
    skipLink: 'Skip to the main edit content',
    title: 'PDF editing',
    back: 'Back',
    addPdf: 'Add a PDF',
    addPdfAria: 'Add a PDF',
    export: 'Export',
    legendAriaLabel: 'Project PDF files',
    gridDensityLabel: 'Grid density',
    gridColumnsValue: '{n} columns',
    gridAriaLabel: 'PDF pages, navigate with Tab and move with the arrow keys',
    emptyMessage: 'No pages left. Add a PDF to continue.',
    legendPageCount: '{n} p.',
    legendRemoveAria: 'Remove {name} from the project',
    legendScrollAria: 'Go to the first page in the grid: {name}',
    legendScrollTitle: 'See the first page in the grid',
    legendRemoveTitle: 'Remove this file from the project',
    limitHint: '{active} / {max} PDF files',
    limitHintAtLimit:
      '{active} / {max} PDF files (limit reached, remove a file to add another)',
    addPdfDisabledTitle:
      'Limit of {max} PDF files. Remove one or more files to free a slot.',
    moveAnnounced: 'Page moved to position {position} of {total}.',
    addPdfLimitWarning:
      'Limit of {max} PDF files reached. Remove one or more files to add others.',
  },
  pageCard: {
    rotateTitle: 'Rotate 90°',
    rotateAria: 'Rotate by 90 degrees',
    deleteTitle: 'Delete',
    deleteAria: 'Delete the page',
    actionsToolbar: 'Page actions',
    roleDescription: 'Movable page',
    pageLabel: 'Page {n}',
    pageOfAria: '{pageLabel} of {name}',
    pageOfTitle: '{pageLabel} — {name}',
    positionOf: 'position {n} of {total}',
    positionOnly: 'position {n}',
    arrowsHint: 'Use the arrow keys to move.',
  },
  fileChip: {
    removeAria: 'Remove {name}',
  },
  about: {
    back: 'Back',
    heroTitle: 'Your PDFs<br />stay <em class="about__accent">with you</em>',
    heroSub:
      'Pidief works on your documents <em class="about__accent">directly in the browser</em>. <br />No sign-up, no server-side processing, nobody else has access to your data',
    heroMetaLocal: '100% local',
    heroMetaWasm: 'WebAssembly',
    heroMetaOpen: 'Open source',
    privacyCloudLabel: 'server',
    privacyFile1: 'final_report.pdf',
    privacyFile2: 'scan_001.pdf',
    privacyFile3: 'appendices.pdf',
    privacyTitle: 'The file <em class="about__accent">never</em> leaves your tab',
    privacyBody:
      'Because we firmly believe your data should remain yours, all processing happens in your browser thanks to <strong>WebAssembly</strong>. <br />Once loaded, even after a zombie invasion, Pidief will keep working!',
    compareTitle: 'Side by side with <em class="about__accent">the others</em>',
    compareToggleAria: 'Pick a service to compare against',
    compareCriterion: 'Criterion',
    comparePidief: 'Pidief',
    compareLiveUpdate: 'Table updated: comparison with {name}.',
    compareFootnote:
      "Third-party services' offers and policies change over time: double-check their terms and privacy policy on their official websites for up-to-date details.",
    cellYes: 'Yes',
    cellNo: 'No',
    cellMeh: 'Partial',
    cellLimits: '14 files max, 100 MB max',
    competitor: {
      iLovePDF: 'iLovePDF',
      SmallPDF: 'Smallpdf',
    },
    compareRow: {
      local: {
        label: 'Processing without uploading to a server',
        desc: "The PDF doesn't leave your machine to be edited",
      },
      account: {
        label: 'No account required',
        desc: 'Full flow without mandatory sign-up',
      },
      limits: {
        label: 'Caps',
        desc: 'File size, task count, watermarks, etc.',
        pidiefTitle:
          'No quota enforced by our servers; usable size mainly depends on RAM and browser limits.',
      },
      tracking: {
        label: 'No third-party advertising or marketing tracking',
        desc: 'Banners, analytics',
        pidiefTitle:
          'No advertising banners in the app; only the website load is tracked.',
      },
      offline: {
        label: 'Usable without an internet connection',
        desc: "After the app's first load in the tab",
      },
      openSource: {
        label: 'Open source code',
        desc: 'Auditable, modifiable, self-hostable',
      },
    },
    them: {
      local: {
        iLovePDF: 'No',
        SmallPDF: 'No',
      },
      account: {
        iLovePDF: 'Often no account',
        SmallPDF: 'Account / paid plan',
      },
      limits: {
        iLovePDF: '25 files max',
        SmallPDF: 'Very strict (watermark, Pro trial, etc.)',
      },
      tracking: {
        iLovePDF: 'Ads and frequent audience tracking',
        SmallPDF: 'Frequent audience tracking',
      },
      offline: {
        iLovePDF: 'No',
        SmallPDF: 'No',
      },
      openSource: {
        iLovePDF: 'No',
        SmallPDF: 'No',
      },
    },
    howTitle: 'Four steps, <em class="about__accent">zero server</em>',
    howVideoFallback: "Your browser doesn't support video playback.",
    howStep1Title: 'You drop a PDF',
    howStep1Body: 'The file is read by the browser and kept in local memory',
    howStep2Title: 'MuPdf does the work',
    howStep2Body:
      'The library compiles the PDF via WebAssembly and edits it locally',
    howStep3Title: 'Merge, reorder, rotate, delete',
    howStep3Body:
      'Use the app as you see fit at the speed of a native application',
    howStep4Title: 'Download the result',
    howStep4Body:
      'The PDF is compressed and downloaded.<br />You leave with a single clean file',
    featuresTitle: 'Everything you <em class="about__accent">dreamed of</em>',
    featuresLede:
      'No more, no less.<br /> The PDF tools you use every day, with no compromise on privacy',
    featMergeTitle: 'Merge',
    featMergeBody: 'Combine several files into one in 2 clicks',
    featReorderTitle: 'Reorder',
    featReorderBody: 'Drag and drop pages to reorder them',
    featRotateTitle: 'Rotate',
    featRotateBody: 'Wrong way? Rotate pages by 90°',
    featCutTitle: 'Cut',
    featCutBody: 'Remove useless pages from your PDFs',
    featPasteTitle: 'Paste',
    featPasteBody:
      'Copy a PDF from your file explorer, then paste it into Pidief',
    featViewTitle: 'Preview',
    featViewBody: 'Preview each file\u2019s pages at a glance',
    ctaTitle: 'Ready to <em class="about__accent">try it</em>?',
    ctaSub:
      'No account to create. No credit card to pull out. <br />Just your PDFs and your needs',
    ctaButton: 'Open Pidief',
  },
} as const satisfies StringDict;

const DICTS: Record<Lang, StringDict> = { fr, en };

/** Unités d'affichage des octets, par langue. */
const BYTE_UNITS: Record<Lang, readonly string[]> = {
  fr: ['o', 'Ko', 'Mo', 'Go'],
  en: ['B', 'KB', 'MB', 'GB'],
};

export function getByteUnits(): readonly string[] {
  return BYTE_UNITS[getCurrentLang()];
}

function lookup(dict: StringDict, path: string): DictValue | undefined {
  const parts = path.split('.');
  let cur: DictValue | undefined = dict;
  for (const p of parts) {
    if (cur === undefined || typeof cur === 'string') return undefined;
    if (isPlural(cur)) return undefined;
    cur = (cur as StringDict)[p];
  }
  return cur;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

/**
 * Récupère une chaîne traduite dans la langue active.
 *
 * - `key` est un chemin pointé (ex. `upload.fileCount`).
 * - `params.count` déclenche la résolution plurielle via `Intl.PluralRules`.
 * - Si la clé manque dans la langue active, fallback vers le FR puis vers la
 *   clé brute (avec un avertissement console en dev).
 */
export function t(key: string, params?: TranslationParams): string {
  const lang = getCurrentLang();
  let value = lookup(DICTS[lang], key);
  if (value === undefined && lang !== 'fr') {
    value = lookup(DICTS.fr, key);
  }
  if (value === undefined) {
    warnMissing(key);
    return key;
  }
  if (isPlural(value)) {
    if (params && typeof params.count === 'number') {
      const rule = new Intl.PluralRules(lang).select(params.count);
      const candidate = (value as Record<string, string | undefined>)[rule] ?? value.other;
      return interpolate(candidate, params);
    }
    return interpolate(value.other, params);
  }
  if (typeof value !== 'string') {
    warnMissing(key);
    return key;
  }
  return interpolate(value, params);
}

function warnMissing(key: string): void {
  if (import.meta.env && import.meta.env.DEV) {
    console.warn(`[pidief.i18n] Clé manquante : ${key}`);
  }
}
