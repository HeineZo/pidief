# CLAUDE.md — Pidief (Vite + TS + Web Components + WASM)

### TL;DR

Pidief est une app web **100% client-side** pour manipuler des PDFs (fusionner, splitter, déplacer, supprimer, retourner) **dans le navigateur**, sans upload serveur.  
Tech principale: **Web Components natifs** + **WebAssembly** (via `mupdf` dans un **Web Worker**) + **SVG** (icônes inline) + **i18n** structurée (à faire).

---

## Objectifs (produit)

- **Usage**: grand public, parcours simple, feedback clair.
- **Promesse**: “traitement local”, pas de compte, pas d’upload.
- **Actions PDF**: merge / split / reorder / delete / rotate + export.

---

## Contraintes / attendus (cours)

### Intégration pertinente (techniques)

- **Web Components**: composants réellement réutilisables (API claire via attributs/props + CustomEvent, découplés de l’app).
- **WASM**: intégré de manière robuste (Worker, messages typés, gestion erreurs, cleanup).
- **SVG**: exploité intelligemment (icônes inline, réutilisation, pas de font d’icônes).
- **i18n**: structurée (dictionnaires, fallback, formatage, pas de strings hardcodées partout).

### Problématiques (qualité)

- **Accessibilité-first**: on conçoit et dev avec l’a11y comme défaut (clavier, sémantique, focus visible, messages accessibles, contrastes) — pas un “polish” en fin de projet.
- **Éco-conception**: au moins **une métrique DDRS** / indicateur simple + actions concrètes.
- **Analytics**: objectifs, minimisation, transparence, risques/limites, alternatives.
- **Performance**: chargement + fluidité raisonnables, mesures outillées.
- **Trade-offs**: justifier les choix (valeur vs coût, utilité vs impact).

---

## Stack & environnement

- **Vite + TypeScript** (ESM)
- **Dépendance WASM**: `mupdf` (déjà dans `package.json`)
- **Rendu/traitement PDF**: `mupdf` dans un **Web Worker** (pas sur le main thread)

### Attention Node

Le projet utilise Vite 8, qui requiert **Node 20.19+ ou 22.12+**.  
Si tu es en Node 21.x, `vite build` peut planter.

---

## Architecture (mental model)

### Couches

- **`src/core/`**: logique “métier” (PDF engine, types, utilitaires) — sans UI.
- **`src/components/`**: Web Components **réutilisables** (UI primitive).
- **`src/screens/`**: écrans/flows (composent les components, orchestrent).
- **`src/styles/`**: design tokens + base + styles UI.

### Conventions Web Components

- **Tags**: préfixe `pi-` (Pidief) pour éviter les collisions, et respecter l’obligation `custom-element` avec un `-`.
- **Communication**:
  - Parent → enfant: **attributs** (et parfois propriétés si nécessaire).
  - Enfant → parent: **CustomEvent** (`bubbles: true`, `composed: true`).
- **Shadow DOM**: **uniquement quand ça vaut le coup**, ex. la drop zone (overlay + états drag).
- **SVG**: icônes inline “line icons” (stroke ~1.8–2px, rounded).

### Imports

On privilégie les **aliases** pour éviter les `../../../`:

- `@components/*` → `src/components/*`
- `@screens/*` → `src/screens/*`
- `@styles/*` → `src/styles/*`
- `@util/*` → `src/core/util/*`
- `@core/pdf/*` → `src/core/pdf/*`

---

## Design system (Palette Miel)

Les tokens CSS sont dans:

- `src/styles/tokens.css`

Ils définissent notamment:

- `--color-bg`, `--color-accent`, `--color-text`, `--color-border`, etc.
- `--font-serif` (Instrument Serif), `--font-sans` (Geist), `--font-mono` (Geist Mono)
- espacements `--space-*`, radius `--radius-*`, shadows, transitions.

### Règle d’or

Tout composant doit s’appuyer sur les **CSS custom properties** plutôt que des valeurs hardcodées, sauf exceptions (ex: tailles d’icône).

---

## État actuel (ce qui est déjà codé)

### Home / Upload

- `src/screens/UploadScreen/UploadScreen.ts`
  - gère une liste locale de fichiers `File` sélectionnés ou déposés
  - affiche des chips, bouton “Tout retirer”, CTA “Choisir une action”

### Drop zone (Shadow DOM)

- `src/components/drop/DropZone/PiDropZone.ts`
  - Shadow DOM, état dragging, input file caché
  - event `files-dropped` avec `{ files: File[] }`
  - filtre `.pdf` si `accept=".pdf"`

### PDF Engine (WASM + Worker) — déjà présent

Le moteur PDF existe déjà dans `src/core/pdf/`:

- `src/core/pdf/PdfEngine.ts`: singleton `PdfEngine.shared()`, envoie des messages au worker, map `pending` des requêtes.
- `src/core/pdf/pdfWorker.ts`: worker (`import * as mupdf from 'mupdf'`), conserve `Map<docId, PDFDocument>`, implémente:
  - `open` (refuse les PDF avec mot de passe)
  - `renderPage` (renvoie un `ImageBitmap` transferable)
  - `merge`, `movePage`, `rotatePage`, `deletePage`
  - `export` (saveToBuffer `'garbage,compress'`)
- `src/core/pdf/PdfDocument.ts`: wrapper OO (EventTarget), expose `renderPage`, `merge`, `movePage`, `rotatePage`, `deletePage`, `exportToBlob`, `close`.

⚠️ Note: ces APIs **throw** (exceptions). Si on veut coller à un style “Result<T, E>”, on pourra wrapper au niveau UI/store.

### Bootstrap

- `src/main.ts`: importe les styles et monte `<pidief-app>`.
- `src/screens/PidiefApp/PidiefApp.ts`: écoute `files-ready` et ouvre les PDFs via `PdfEngine.shared().open`.

---

## i18n (à implémenter proprement)

### Objectif

- Bilingue **FR/EN**.
- Pas de “strings en dur” dans 10 fichiers différents.

### Proposition simple (sans framework)

- `src/core/i18n/strings.ts`:
  - dictionnaires `fr` et `en` (objets `as const`)
  - type `TranslationKey`
  - fonction `t(key, params?)`
- `src/core/i18n/lang.ts`:
  - `getPreferredLang()` (localStorage → navigator.language → fallback)
  - event global `lang-changed`
- Les composants UI consomment `t(...)` + rerender sur `lang-changed`.

### Accessibilité i18n

- Mettre à jour `document.documentElement.lang` quand la langue change.

---

## Accessibilité (checklist pragmatique)

- **Clavier**:
  - drop zone: support Enter/Space sur un bouton “Parcourir”
  - reorder pages: DnD + alternative clavier (au moins “move left/right”)
- **Focus**:
  - focus visible (pas de suppression)
  - ordre logique
- **Sémantique**:
  - titres (`h1`, `h2`), listes de fichiers (`ul/li` si pertinent)
- **Messages accessibles**:
  - erreurs/infos dans une région `aria-live="polite"` (ex: “PDF protégé par mot de passe”)
- **Couleurs/contrastes**:
  - valider contrastes avec tokens Miel

---

## Robustesse (erreurs, loading, cas limites)

### PDFs et limites

- PDF protégé par mot de passe: déjà refusé → message UI clair + alternative.
- Fichiers non-PDF: filtrer, expliquer.
- Gros PDF / beaucoup de pages:
  - **lazy rendering** des thumbnails
  - limiter la résolution (scale) par défaut
  - feedback “chargement…” + annulation si possible

### Worker / WASM

- Timeout / crash worker: `PdfEngine` rejette toutes les promesses pending.
- `close()` systématique (libérer doc dans worker).

---

## Performance (mesures + actions)

### Mesures (outillées)

- `performance.mark/measure` autour:
  - open PDF
  - render page (thumbnail)
  - export final
- `PerformanceObserver` (long tasks) pour détecter jank.
- Build: surveiller la taille du bundle (JS + WASM).

### Actions

- Worker pour tout traitement PDF (déjà fait).
- `ImageBitmap` transferable (déjà fait) pour éviter copie.
- Thumbnails:
  - rendu à la demande (IntersectionObserver)
  - cache LRU léger

---

## Éco-conception (DDRS / indicateur simple)

### Indicateur minimal (proposé)

Choisir **1 métrique** facile à défendre et à mesurer:

- **Poids transféré** au chargement (JS + CSS + WASM) en Ko/Mo
  - objectif: garder “raisonnable” (et expliquer les choix)
- ou **CPU time** estimé sur les opérations (durées `performance.measure`)

### Actions concrètes (sobriété)

- Ne pas rendre toutes les pages dès le départ.
- Scale thumbnail bas (ex: 0.5–1.0) par défaut.
- Export avec compression (déjà: `'garbage,compress'`).
- Pas d’analytics par défaut si ça n’apporte rien.

---

## Analytics (cadre responsable)

### Objectifs (exemples)

- Comprendre où les gens bloquent: upload → choix d’action → export.
- Mesurer perf perçue (durée open/render/export), détecter erreurs fréquentes.

### Périmètre minimal (recommandé)

- Événements:
  - `upload_add_files` (count, taille totale bucketée)
  - `tool_select` (merge/split/organize)
  - `export_done` (durée bucketée)
  - `error` (type, pas de contenu PDF)
- **Zéro PII**:
  - pas de nom de fichier brut
  - pas de contenu PDF
  - pas d’IP côté app (si self-host)

### Transparence

- Un écran “À propos” qui explique:
  - ce qui est collecté
  - pourquoi
  - comment désactiver
  - limites/risques

### Alternatives

- Pas d’analytics du tout (et assumer le trade-off).
- Self-host Matomo/Umami en mode respectueux (si demandé) — sinon, rester offline.

---

## Trade-offs (à savoir expliquer)

- **WASM MuPDF**:
  - + robuste, rapide, tout-en-un (render + manipulation)
  - − poids initial (WASM), complexité Worker, mémoire
- **Web Components vanilla**:
  - + pas de framework, réutilisable, durable
  - − ergonomie dev (templating, state), faut des conventions strictes
- **Shadow DOM limité**:
  - + garde la simplicité du DS (tokens globaux) tout en isolant les zones “spéciales”
  - − faut comprendre où la frontière est utile
- **Analytics minimisé**:
  - + privacy + sobriété
  - − moins de visibilité sur les usages

---

## “Definition of done” (pour viser la meilleure note)

- Une démo claire (home → action → export) avec feedback UI.
- i18n propre FR/EN.
- A11y validée (clavier + focus + aria-live).
- Perf mesurée + améliorations justifiées.
- 1 indicateur DDRS + actions concrètes.
- Analytics expliqué (même si “désactivé par défaut”).

