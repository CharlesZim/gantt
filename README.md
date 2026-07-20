# Gantt — planning élégant

Une application web de **diagramme de Gantt** simple, esthétique et exportable.
Un Gantt à plat (tâches indépendantes), un rendu soigné à l'écran **et** à
l'export, quatre thèmes, et des exports fidèles en **PDF vectoriel, PNG et SVG**.

Zéro backend : tout est persisté en `localStorage`. Pas de compte, pas de serveur.

![Aperçu](https://raw.githubusercontent.com/charleszim/gantt/master/.github/preview.png)

## ✨ Fonctionnalités

- **Tâches** : ajout, renommage inline, dates éditables (clavier + geste), suppression.
- **Barres interactives** : déplacer et redimensionner à la souris, avec *snap* au
  jour, tooltip de dates et feedback visuel en temps réel.
- **Zoom** Jour / Semaine / Mois, marqueur « aujourd'hui », bandes week-end,
  grille discrète à deux niveaux (mois + jours/semaines).
- **4 thèmes** cohérents à l'écran et à l'export : Clair minimal, Sombre, Pastel,
  Blueprint.
- **Export** PDF (vectoriel, texte sélectionnable), PNG (échelle 1×/2×/3×) et SVG,
  dérivés d'une **source unique** (`buildSvg`) → l'export = ce que vous voyez.
- **Persistance** automatique en `localStorage` (clé versionnée `gantt.v1`).

## 🏗 Architecture

Le **cœur métier** vit dans `src/core/` en **TypeScript pur**, sans aucune
dépendance à React ni au DOM. C'est la garantie de portabilité (réutilisable tel
quel pour une future app iOS native).

```
src/
├─ core/                 # TS PUR — aucune dépendance React / DOM
│  ├─ types.ts           # Task, GanttState, TimeUnit
│  ├─ dates.ts           # helpers date-fns (diff, clamp, min/max…)
│  ├─ layout.ts          # moteur de layout : dates → géométrie + axe
│  ├─ config.ts          # constantes de géométrie partagées
│  └─ __tests__/         # tests unitaires Vitest du cœur
├─ themes/               # 4 thèmes (données pures) + application des variables CSS
├─ hooks/useTasks.ts     # CRUD + persistance localStorage
├─ components/           # Toolbar, TaskList, TimeAxis, GanttChart, GanttBar,
│                        # ExportModal, ThemeSelector
├─ export/               # buildSvg (source unique) → toPng / toPdf
├─ App.tsx / main.tsx
└─ index.css             # Tailwind + variables CSS de thème
```

**Règle non négociable** : `src/core/` n'importe ni React, ni Tailwind, ni rien
qui touche au navigateur.

## 🚀 Démarrage

Prérequis : Node 18+.

```bash
npm install       # installer les dépendances
npm run dev       # serveur de dev (http://localhost:5173)
npm run build     # build de production dans dist/
npm run preview   # prévisualiser le build
npm test          # tests unitaires du cœur (Vitest)
npm run lint      # vérification TypeScript (tsc --noEmit)
```

## 🧪 Tests

Le moteur de layout et les helpers de dates sont couverts par des tests Vitest
purs (aucun DOM). Lancer `npm test`.

## 🛠 Stack

Vite · React + TypeScript · Tailwind CSS · date-fns · SVG natif ·
jsPDF + svg2pdf.js (PDF vectoriel) · @fontsource/inter.

## ☁️ Déploiement (Vercel)

Le projet est prêt pour Vercel (preset Vite auto-détecté, voir `vercel.json`).
Voir les étapes manuelles dans la section ci-dessous.

1. Pousser le dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com) : **Add New → Project → Import** ce dépôt.
3. Le preset **Vite** est auto-détecté (`build: npm run build`, `output: dist`).
   Aucune variable d'environnement n'est nécessaire.
4. **Deploy**. Chaque push sur `master` déclenche un déploiement de production ;
   chaque branche/PR obtient une URL de preview.

## Périmètre (MVP)

Volontairement **hors périmètre** : dépendances entre tâches, hiérarchie
parent-enfant, chemin critique, comptes / backend / multi-projets,
collaboration temps réel, import/export de fichiers de projet. L'objectif est un
Gantt à plat, beau et exportable.
