# Retour d’expérience — Pidief

**Pidief** est une application web 100 % côté client pour fusionner, réorganiser, pivoter et supprimer des pages PDF dans le navigateur, sans upload serveur ni compte utilisateur.

Ce document suit la grille d’évaluation du projet (BCL2) et constitue notre bilan : choix, réalisations, limites et pistes d’amélioration. Il complète le [README](README.md) (installation, démo) sans le remplacer.

---

## Synthèse

Nous avons visé un parcours simple — déposer des PDF, les modifier visuellement, exporter un fichier unique — tout en traitant les contraintes du cours : Web Components, WASM, SVG, i18n, accessibilité, éco-conception et analytics responsables. Le cœur technique repose sur **MuPDF en WebAssembly** dans un **Web Worker**, orchestré par des **Web Components** natifs et une **internationalisation** structurée FR/EN.

Le produit est **démontrable de bout en bout** (upload → édition → export), couvert en partie par des tests e2e Playwright. Nous assumons aussi des écarts documentés : pas d’instrumentation `performance.mark` dans le code, limite « 100 Mo » affichée mais non appliquée, PDF protégés par mot de passe refusés, et un écran d’édition volumineux à refactorer.

---

## 1) Pertinence du sujet et intégration des notions (20 %)

### Besoin et contexte

Les outils PDF en ligne les plus connus imposent souvent un **envoi vers un serveur**, une **inscription** ou un **suivi marketing**. Or les usages courants — fusionner des scans, retirer une page, réordonner un dossier — ne nécessitent pas la cloud pour fonctionner : le navigateur moderne peut lire un fichier, le transformer et le proposer au téléchargement.

Pidief répond à ce besoin pour un **public large** : parcours court, message de confidentialité explicite (« sans inscription et en local »), et page [À propos](src/screens/AboutScreen/AboutScreen.ts) qui compare notre approche à iLovePDF et SmallPDF sur des critères lisibles (traitement local, compte, plafonds, tracking).

### Intégration des techniques du cours

| Technique | Rôle dans Pidief | Justification |
|-----------|------------------|---------------|
| **Web Components** | Composants `pi-*` réutilisables (`pi-button`, `pi-icon`, `pi-drop-zone`, `pi-page-card`, `pi-file-chip`, `pi-nav`) | Découplage UI / logique, API par attributs et `CustomEvent`, sans dépendance framework |
| **WASM (MuPDF)** | Parse, rendu vignettes, fusion, rotation, suppression, export dans [`pdfWorker.ts`](src/core/pdf/pdfWorker.ts) | Opérations PDF trop lourdes pour du JavaScript seul sur des documents réalistes |
| **Web Worker** | Moteur isolé du thread principal via [`PdfEngine.ts`](src/core/pdf/PdfEngine.ts) | Éviter de bloquer l’interface pendant open / render / export |
| **SVG** | Icônes inline dans [`PiIcon.ts`](src/components/base/Icon/PiIcon.ts), pictos du comparatif About | Pas de font d’icônes externe, cohérence visuelle (stroke, tailles) |
| **i18n** | Dictionnaires `fr` / `en`, `t()`, événement `lang-changed`, [`domI18n.ts`](src/core/i18n/domI18n.ts) | Bilinguisme structuré, mise à jour de `document.documentElement.lang`, pas de chaînes dispersées |

Nous n’avons pas retenu ces technologies « parce que c’était à la mode », mais parce qu’elles correspondent aux contraintes du produit : **confidentialité** (tout reste en local), **réactivité** (worker + rendu paresseux), **maintenabilité** (composants et couches `core` / `components` / `screens`).

### Problématiques intégrées dès la conception

- **Accessibilité** : navigation clavier sur la zone de dépôt et les cartes de pages, skip link vers le contenu d’édition, régions `aria-live` pour les déplacements, respect de `prefers-reduced-motion` sur les animations.
- **Éco-conception** : vignettes rendues à la demande (`IntersectionObserver`), résolution plafonnée, export compressé — détaillé en section 4.
- **Analytics** : **aucun tracking produit** ; transparence via le comparatif (ligne « tracking ») plutôt que collecte opaque.

### Alternative écartée

Les services type **iLovePDF / SmallPDF** centralisent le traitement et monétisent via comptes, quotas et audience. Nous les citons dans [`aboutCompare.json`](src/screens/AboutScreen/aboutCompare.json) pour justifier notre positionnement : traitement local, pas de bannière publicitaire dans l’app, code ouvert.

---

## 2) Réalisation technique et qualité logicielle (30 %)

### Fonctionnalités principales livrées

Parcours nominal :

1. **Upload** — dépôt, sélection fichier, collage presse-papier ([`UploadScreen.ts`](src/screens/UploadScreen/UploadScreen.ts)).
2. **Ouverture** — lecture des PDF via le worker, refus des fichiers chiffrés.
3. **Édition** — fusion de plusieurs PDF, grille de pages, réordonnancement (glisser-déposer et flèches clavier), rotation 90°, suppression simple ou groupée ([`EditScreen.ts`](src/screens/EditScreen/EditScreen.ts)).
4. **Export** — sauvegarde compressée et téléchargement d’un `pidief.pdf`.

### Qualité d’implémentation des techniques retenues

**Web Components réutilisables**

- Communication parent → enfant par **attributs** (`variant`, `icon`, `accept`).
- Communication enfant → parent par **`CustomEvent`** (`files-dropped` sur [`PiDropZone`](src/components/drop/DropZone/PiDropZone.ts), `request-back`, `request-navigate` sur l’app).
- **Shadow DOM** uniquement sur la drop zone, pour isoler l’overlay de drag sans casser les design tokens globaux.

**WASM intégré de manière robuste**

- Messages typés ([`messages.ts`](src/core/pdf/messages.ts)), `requestId` et file d’attente `pending` dans le moteur.
- Transfert **`ArrayBuffer`** à l’open, **`ImageBitmap`** transferable au rendu.
- Gestion d’erreur worker (`rejectAllPending`, toast utilisateur).
- Fermeture explicite des documents (`close`) pour libérer la mémoire côté worker.
- Export avec `saveToBuffer('garbage,compress')`.

**i18n structurée**

- Clés pointées, pluriels via `Intl.PluralRules`, attributs `data-i18n` / `data-i18n-attr` dans les templates HTML.
- Bascule FR/EN dans la barre de navigation, persistance `localStorage`, rerender sans rechargement.

**SVG exploité intelligemment**

- Catalogue centralisé de paths dans `PiIcon`, `aria-hidden` sur les décorations, pas de dépendance à une librairie d’icônes.

### Robustesse et cas limites

| Cas | Comportement |
|-----|--------------|
| Fichier non-PDF | Ignoré à l’upload ; région fichiers non affichée (e2e `05-error-pdf`) |
| PDF protégé par mot de passe | Refus côté worker, message d’erreur, reste sur l’écran d’upload |
| Route `/edit` sans fichiers | Redirection vers `/` |
| Limite de **14 PDF** | Constante [`MAX_UPLOAD_PDFS`](src/core/util/uploadPdfLimits.ts), messages d’avertissement |
| Échec d’ouverture multi-fichiers | Fermeture des documents déjà ouverts, toast d’erreur |

### Qualité du code et architecture

- Séparation **`src/core/`** (PDF, i18n, utilitaires), **`src/components/`**, **`src/screens/`**.
- Alias Vite (`@components`, `@core/pdf`, `@i18n`, etc.) pour des imports lisibles.
- Suite **e2e Playwright** : parcours nominal, garde de route, export, mutation de page, erreurs PDF.

### Limites assumées

- La mention « **max 100 Mo** » dans les textes i18n ([`dropzone.formats`](src/core/i18n/strings.ts)) n’est **pas encore vérifiée** dans le code d’upload — promesse UX à aligner ou retirer.
- Pas d’export « split » en plusieurs fichiers : la découpe correspond à la **suppression de pages**, pas à une extraction multi-PDF.
- [`EditScreen.ts`](src/screens/EditScreen/EditScreen.ts) concentre aujourd’hui une grande partie de la logique (grille, DnD, légende) : **dette de maintenabilité** ; nous le découperions en modules dédiés si nous prolongeions le projet.
- PDF protégés : refus volontaire pour la V1 (voir roadmap README).

---

## 3) Qualité produit : UX, accessibilité, performance (20 %)

### UX

- **Trois écrans** clairs : accueil / upload, édition, à propos — routage léger via l’History API dans [`PidiefApp.ts`](src/screens/PidiefApp/PidiefApp.ts).
- **Feedback** : chips de fichiers avec taille formatée, toasts erreur/avertissement, annonces de déplacement de pages, légende colorée par fichier source, curseur de densité de grille.
- **Page À propos** pédagogique : comparatif concurrents, schéma « quatre étapes, zéro serveur », vidéos de démonstration chargées sur cet écran (hors parcours principal).

### Accessibilité

Nous avons traité l’a11y comme un **prérequis**, pas un polish final :

- **Sémantique** : titres `h1`, sections `aria-labelledby` sur About, liste de légende, cartes en `role="listitem"`.
- **Clavier** : zone de dépôt activable (Entrée/Espace), déplacement des pages aux **flèches** sur `pi-page-card`, skip link « passer au contenu principal d’édition ».
- **Focus** : styles `:focus-visible` sur boutons et zones interactives.
- **Messages accessibles** : `aria-live="polite"` pour le comparatif, le déplacement de pages et certaines valeurs de contrôle (colonnes de grille).
- **Mouvement réduit** : animations FLIP et transitions désactivées ou raccourcies si `prefers-reduced-motion: reduce`.

Des passes dédiées (PR `feat/a11y-pass`) et des retours entre nous ont permis d’itérer sur ces points avant merge.

### Performance

**Actions déjà en place**

- Traitement PDF hors thread principal (worker WASM).
- **Rendu paresseux** des vignettes (`IntersectionObserver` dans l’écran d’édition).
- Échelle de prévisualisation adaptée au DPR avec **plafond mémoire** (`PREVIEW_MAX_BITMAP_WIDTH` dans [`PiPageCard.ts`](src/components/edit/PageCard/PiPageCard.ts)).
- Pas de rendu de toutes les pages au chargement initial.

**Indicateur DDRS retenu : poids transféré au premier chargement**

Mesure réalisée le 15 mai 2026 via `npm run build` (Vite 8, production) :

| Ressource | Taille (fichier) | Taille gzip (réseau) |
|-----------|------------------|----------------------|
| `mupdf-wasm-*.wasm` | **~9,5 Mo** | **~4,6 Mo** |
| `index-*.js` (bundle app) | ~136 Ko | ~37 Ko |
| `pdfWorker-*.js` | ~89 Ko | (chargé à la demande) |
| `index-*.css` | ~46 Ko | ~9 Ko |
| **Total cœur applicatif** (WASM + JS principal + CSS) | **~9,8 Mo** | **~4,7 Mo** |

Les vidéos de démo dans `dist/demo/` (~48 Mo) ne font **pas** partie du parcours upload → edit ; elles ne sont consultées que sur l’écran À propos.

**Objectif sobriété** : accepter le coût initial du WASM (indispensable pour la promesse produit), mais **ne pas l’aggraver** (pas d’analytics tiers, pas de rendu global des pages, compression à l’export).

**Écart** : nous n’avons pas encore branché `performance.mark` / `measure` ni `PerformanceObserver` dans le code pour tracer automatiquement open / render / export. Une mesure manuelle DevTools reste possible pour compléter le bilan (ordre de grandeur : ouverture et export sub-secondes sur PDF de test de quelques pages).

---

## 4) Problématiques : éco-conception et analytics responsables (20 %)

### Éco-conception

**Métrique** : poids transféré au chargement (tableau section 3) — indicateur DDRS simple, reproductible (`npm run build` + rapport Vite).

**Actions concrètes**

| Action | Effet |
|--------|--------|
| Vignettes à la demande (`IntersectionObserver`) | CPU et mémoire économisés sur les gros documents |
| Plafond de résolution des bitmaps | Limite les pics RAM / temps WASM |
| Export `garbage,compress` | Fichier final plus léger pour l’utilisateur |
| Pas de scripts analytics tiers | Moins de requêtes et de JS inutile |
| Limite à 14 fichiers PDF | Borne UX alignée sur les capacités navigateur |

**Trade-off assumé** : MuPDF en WASM **alourdit le premier chargement** (~4,7 Mo gzip) mais évite des allers-retours serveur et du traitement cloud répété — pertinent pour notre promesse « local ».

### Analytics responsables

**Objectifs que nous aurions pu suivre** (non implémentés) : taux d’abandon upload → édition → export, erreurs fréquentes (PDF refusé, limite fichiers), durées perçues.

**Périmètre actuel** : **zéro collecte** dans l’application (pas de Matomo, GA, pixels). Seul l’**hébergeur du site** peut mesurer le chargement des assets — nous le mentionnons explicitement dans le comparatif ([`about.compareRow.tracking`](src/core/i18n/strings.ts) : « chargement du site uniquement »).

**Minimisation et transparence** : pas de bannière publicitaire dans l’app ; tableau comparatif honnête sur les concurrents ; pas de revente de données (il n’y en a pas).

**Risques** : moindre visibilité sur les points de friction réels ; nous compensons partiellement par les **tests e2e** et les retours manuels en équipe.

**Alternatives envisagées** : Matomo/Umami en self-host, analytics opt-in — écartées pour ce projet afin de privilégier **privacy** et **sobriété** (moins de JS, moins de consentement à gérer).

### Synthèse des trade-offs

| Choix | Gain | Coût |
|-------|------|------|
| 100 % client + WASM | Confidentialité, pas de compte | Poids initial, limites RAM navigateur |
| Web Components vanilla | Pas de framework lourd, composants durables | Verbosité, conventions à maintenir |
| Pas d’analytics produit | Privacy, simplicité | Moins de données d’usage pour prioriser |
| Shadow DOM limité | Tokens globaux simples | Moins d’isolation sur tous les composants |

---

## 5) Documentation, Rex et dynamique d’équipe (10 %)

### Documentation

Le [README](README.md) permet de **cloner, installer et lancer** le projet (`npm install`, `npm run dev`, contrainte Node pour Vite 8), de **builder** et de lancer les **tests e2e**. Il présente la roadmap et les crédits équipe.

**Point à améliorer** : le README référence une ancre `#limites` sans section dédiée — nous la compléterions (PDF chiffrés, plafond 14 fichiers, dépendance RAM, WASM) et y lierions ce Rex.

### Dynamique d’équipe

Nous sommes trois (**Enzo**, **Matis**, **Hugo**). Le dépôt Git ne reflète pas à lui seul l’effort réel : revues de PR, specs communes, tests manuels et choix de design comptent autant que les lignes poussées. Nous avons donc structuré le travail en **trois piliers d’importance comparable**, chacun avec un lot **démontrable en soutenance**.

#### Pilier 1 — Produit et parcours utilisateur

**Périmètre** : promesse « local », écran d’accueil / upload, page À propos, comparatif concurrents, expérience mobile et collage.

- **Enzo** : conception et réalisation de l’écran [À propos](src/screens/AboutScreen/AboutScreen.ts) (comparatif, vidéos, argumentaire privacy), micro-interactions et responsive sur l’upload, documentation README.
- **Hugo** : fluidité du parcours (scroll automatique à l’ajout de fichiers, focus et skip links, bouton d’ajout de PDF en fin de liste).
- **Matis** : orchestration du routage [`PidiefApp`](src/screens/PidiefApp/PidiefApp.ts) et cohérence du flux global upload → édition.

#### Pilier 2 — Moteur PDF et édition

**Périmètre** : WASM/worker, grille de pages, fusion, export, interactions d’édition.

- **Matis** : intégration MuPDF, worker, écran d’édition (grille, glisser-déposer, réconciliation DOM).
- **Enzo** : dépôt mobile, collage presse-papier, formulations UX des messages d’erreur.
- **Hugo** : contrôles d’édition et accessibilité du flux principal (navigation clavier, focus sur la légende, annonces de déplacement).

#### Pilier 3 — Qualité transverse

**Périmètre** : i18n FR/EN, accessibilité, tests e2e, design system (tokens, composants de base).

- Décisions et **relectures collectives** sur les PR thématiques (`feat/i18n-implementation`, `feat/a11y-pass`, `feat/e2e-implementation`).
- **Matis** : infrastructure i18n ([`strings.ts`](src/core/i18n/strings.ts), [`lang.ts`](src/core/i18n/lang.ts)), suite Playwright, passes a11y transverses.
- **Enzo** : contenus traduits About/upload, cohérence rédactionnelle bilingue.
- **Hugo** : critères a11y sur l’édition (slider de grille, labels, annonces).

**Pratiques de collaboration** : branches et PR par fonctionnalité, merge après relecture, tests e2e comme filet de non-régression partagé. L’auteur d’une PR n’est pas le seul contributeur : les commentaires et corrections croisées font partie du livrable.

### Ce que nous referions autrement

1. **Mesurer tôt** le poids WASM et le documenter dans le README dès la première intégration MuPDF.
2. **Découper** `EditScreen` (DnD, légende, export) avant d’empiler de nouvelles fonctionnalités.
3. **Appliquer** réellement la limite 100 Mo à l’upload, ou retirer la mention des textes i18n.
4. **Instrumenter** quelques `performance.measure` sur open, render et export pour un suivi reproductible.

---

## Conclusion

Pidief démontre qu’un **outil PDF utile au quotidien** peut tenir entièrement dans le navigateur, avec des techniques du cours intégrées de façon cohérente et un positionnement privacy-first. Les principaux compromis portent sur le **poids initial du WASM**, l’**absence d’analytics** et quelques **dettes techniques** assumées et documentées.

Nous considérons le projet **livrable et défendable** sur la grille : besoin clair, parcours complet, qualité produit travaillée (UX, a11y, sobriété), cadre analytics explicite, et travail d’équipe réparti sur trois piliers équivalents plutôt que sur une lecture naïve de l’historique Git.
