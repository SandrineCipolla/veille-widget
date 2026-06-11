# Roadmap soutenance — features prioritaires

## 1. README + schéma pipeline
**Branche :** `docs/readme-pipeline`
**Impact :** présentation du projet pour le jury, Bloc 1
**Contenu :**
- Description du projet et de la stack
- Schéma ASCII ou Mermaid du pipeline complet
- Captures Discord et wiki
- Instructions de lancement

## 2. Log des runs
**Branche :** `feat/run-logger`
**Impact :** trace documentée de la veille dans le temps, Bloc 1 C1.2
**Contenu :**
- `logs/pipeline.json` — un objet par run : date, durée, modèle, succès/erreur
- Affiché dans le README (derniers runs)

## 3. Tests unitaires
**Branche :** `feat/unit-tests`
**Impact :** crédibilité technique, Bloc 2
**Fonctions ciblées :**
- `extractIncontournables`
- `getWeekLabel`
- `formatDiscordMessage`

## 4. Electron widget
**Branche :** `feat/electron-widget`
**Impact :** démo visuelle pour la soutenance, Bloc 3
**Contenu :**
- Fenêtre bureau affichant les 🔥 Incontournables
- Packaging MSIX (objectif Microsoft Store)