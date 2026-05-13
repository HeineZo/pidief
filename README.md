<h1 align="center">
    <br />
    <img src="public/favicon-dark.svg" alt="Pidief" width="120">
    <br />
    Pidief
</h1>

<h4 align="center">Application web 100% côté client pour fusionner, découper et réorganiser des PDF dans le navigateur et sans upload serveur</h4>

<p align="center">
  <a href="#contexte">À propos</a> •
  <a href="#limites">Limites</a> •
  <a href="#local">Installation</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#technologies">Technologies</a> •
  <a href="#credits">Crédits</a>
</p>

![Screenshot de l'application](/public/preview.png)

<h2 id="contexte">À propos</h2>

Pidief est une petite application de manipulation de PDF destinée au grand public. Le traitement passe par [MuPDF](https://mupdf.com/) compilé en WebAssembly dans un Web Worker, avec une interface en Web Components natifs (Vite + TypeScript)

<h2 id="roadmap">Roadmap</h2>

- [ ] Accepter les PDF protégés par mot de passe
- [ ] Augmenter la taille d'import de fichier et le nombre de fichier importés 

<h2 id="local">Lancer le projet en local</h2>

Prérequis : **[Git](https://git-scm.com)** et **[Node.js](https://nodejs.org)** (npm est fourni avec Node).

> **Attention Vite 8** : utilise **Node 20.19+** ou **Node 22.12+**. Avec une version non supportée (ex. Node 21 sans patch), la commande `npm run build` peut échouer.

Depuis ton terminal :

```bash
# Clôner le dépôt
git clone https://github.com/HeineZo/pidief.git

# Aller dans le dossier du projet
cd pidief

# Installer les dépendances
npm install

# Lancer l'application
npm run dev
```

Ouvre l'URL `http://localhost:5173` affichée dans le terminal

### Commandes utiles

```bash
# Build production
npm run build

# Prévisualiser le build localement
npm run preview
```

<h2 id="technologies">Technologies</h2>

<img src="https://skillicons.dev/icons?i=vite,ts,wasm" alt="Technologies : Vite, TypeScript, WebAssembly" />

<h2 id="credits">Crédits</h2>

<table>
    <tr>
        <td align="center">
            <a href="mailto:nzomorvan@gmail.com">
                <img src="https://avatars.githubusercontent.com/u/85509892?v=4" width="100" alt="Photo de profil d’Enzo" style="border-radius: 50%;" />
                <br />
                <sub><b>Enzo</b></sub>
            </a>
        </td>
        <td align="center">
                    <a href="mailto:matis@byar.fr">
                <img src="https://avatars.githubusercontent.com/u/86782053?v=4" width="100" alt="Photo de profil de Matis" style="border-radius: 50%;" />
                <br />
                <sub><b>Matis</b></sub>
            </a>
        </td>
        <td align="center">
            <a href="mailto:hugobrajdic@gmail.com">
                <img src="https://avatars.githubusercontent.com/u/71076606?v=4" width="100" alt="Photo de profil d'Hugo" style="border-radius: 50%;" />
                <br />
                <sub><b>Hugo</b></sub>
            </a>
        </td>
    </tr>
</table>
