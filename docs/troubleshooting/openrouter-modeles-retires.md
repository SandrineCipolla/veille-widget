# 🔧 Troubleshooting — Modèles gratuits OpenRouter retirés du catalogue

> Incident rencontré le 23 septembre 2026, détecté en constatant l'absence
> de digest depuis plus d'une semaine sur le wiki `sandrine-veille-techno`

---

## Symptôme

Plus aucun digest publié sur le wiki depuis le **9 septembre 2026**. Le
widget Electron (qui relit le wiki au démarrage) affichait donc un
contenu vieux de deux semaines, sans erreur visible côté utilisateur.

## Diagnostic

`gh run list --repo SandrineCipolla/veille-widget` montrait des runs
`workflow_dispatch` quotidiens qui se terminaient bien, mais en
`failure` depuis le 10 septembre. Les logs d'un run en échec
(`gh run view <id> --log-failed`) donnaient la vraie cause :

```
[OpenRouter] Modèle google/gemma-4-31b-it:free indisponible (429) — passage au suivant…
[OpenRouter] Modèle openai/gpt-oss-20b:free indisponible (404) — passage au suivant…
[OpenRouter] Modèle nvidia/nemotron-nano-9b-v2:free indisponible (404) — passage au suivant…
[Veille] Erreur : OpenRouter erreur 402 : Insufficient credits. This account never purchased credits.
```

## Cause racine

Deux problèmes combinés :

1. Le catalogue gratuit OpenRouter tourne régulièrement (renommages,
   retraits) — `openai/gpt-oss-20b:free` et
   `nvidia/nemotron-nano-9b-v2:free` avaient purement disparu du
   catalogue. Confirmé avec `npx tsx scripts/list-free-models.ts`, qui
   liste les modèles gratuits réellement disponibles à l'instant T.
2. Le filet de sécurité prévu (`OPENROUTER_MODELS` se terminait sur un
   modèle payant, `openai/gpt-4o-mini`) ne pouvait pas prendre le relais
   car le compte OpenRouter n'a jamais eu de crédit ajouté — donc dès que
   le premier modèle gratuit était rate-limité (429) ou indisponible
   (404), plus rien ne rattrapait le run.

## Fix

Secret GitHub Actions `OPENROUTER_MODELS` mis à jour avec des modèles
gratuits vérifiés disponibles, en terminant sur `openrouter/free` — un
routeur qui bascule automatiquement vers *n'importe quel* modèle gratuit
disponible, plutôt que sur un modèle payant nécessitant du crédit :

```bash
gh secret set OPENROUTER_MODELS --repo SandrineCipolla/veille-widget \
  --body "google/gemma-4-31b-it:free,z-ai/glm-5.2:free,qwen/qwen3.8-27b:free,openrouter/free"
```

`.env.example` aligné sur la même liste, avec un commentaire renvoyant
vers `scripts/list-free-models.ts` pour la prochaine fois. Voir
[PR #30](https://github.com/SandrineCipolla/veille-widget/pull/30).

## Vérification

Workflow redéclenché manuellement (`gh workflow run "Veille Technologique"`)
après merge : run vert en 1m54s, digest `2026-09-23` confirmé publié sur
le wiki (`sandrine-veille-techno`, commit `1f61127`).

## Prévention à court terme

- En cas d'échecs répétés, vérifier d'abord `npx tsx
  scripts/list-free-models.ts` avant de suspecter un bug côté pipeline —
  le catalogue gratuit OpenRouter change plus souvent que le code.
- `openrouter/free` en fin de liste rend le pipeline résilient à ces
  rotations sans dépendre de crédits payants — à garder comme dernier
  maillon par défaut.

## Non résolu — à surveiller

- Aucune alerte n'a signalé la panne pendant deux semaines : les runs
  `failure` étaient visibles sur GitHub Actions mais rien ne les
  remontait activement (pas de notification Discord sur échec, seulement
  sur succès). Un webhook Discord déclenché sur `workflow_run` en échec
  réduirait le délai de détection.
- Le mode `weekly` (récap du vendredi) n'a pas encore été testé avec
  `openrouter/free` — à vérifier au prochain vendredi.
