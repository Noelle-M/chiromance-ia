# Moteur de vision autonome — prototype expérimental

Service Python FastAPI indépendant de Base44, destiné à être hébergé sur votre serveur.

## Démarrage

```bash
cd vision-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Sous Windows, activez l'environnement avec `.venv\\Scripts\\activate`.

## Essai sur une photo

```bash
curl -F "photo=@paume.jpg" http://127.0.0.1:8000/preview --output plis.png
curl -F "photo=@paume.jpg" http://127.0.0.1:8000/analyze
```

L'image `plis.png` surligne les zones détectées par traitement d'image.
Les réponses `/analyze` contiennent des zones candidates normalisées, mais
`lines` reste volontairement vide : aucun nom de ligne de chiromancie
n'est déduit d'un simple filtre d'image.

**Limites** : OpenCV peut surligner des ombres, le décor ou des plis secondaires.
La segmentation de la paume, la classification et le suivi continu des lignes
nécessitent un modèle spécialisé, des exemples annotés et des tests. Ce prototype
ne remplace donc pas encore `analyzeHand` et n'est pas connecté au frontend.

**Sécurité** : déployer derrière HTTPS avec authentification, contrôle de débit
et limitation de taille des requêtes avant d'exposer ce service publiquement.
Les photos ne sont pas enregistrées par ce prototype.

## Limiter l'analyse à une zone de paume

Les deux routes acceptent un champ multipart facultatif `roi` : un polygone JSON
composé de paires `[x,y]` normalisées entre 0 et 1, relatives à l'image envoyée.
Exemple :

```bash
curl -F "photo=@paume.jpg" -F 'roi=[[0.2,0.4],[0.75,0.4],[0.8,0.8],[0.2,0.85]]' http://127.0.0.1:8000/preview --output plis-paume.png
```

Cette zone doit être délimitée sur la photographie d'origine, sans les bordures
de l'application. L'option est **manuelle** : elle ne prétend pas détecter la
paume automatiquement. Sans `roi`, le service examine toujours l'image entière.

## Interface de test intégrée

Démarrez le serveur puis ouvrez `http://127.0.0.1:8000/demo`.
Chargez la photo d'origine, lancez **Détection automatique**, puis comparez
avec **Analyser la zone dessinée** si l'isolement automatique échoue.
Le contour cyan de l'aperçu marque la région de recherche.

La détection automatique est une **heuristique de couleur et de forme**, pas
un modèle de segmentation entraîné. Elle peut échouer selon la lumière,
la couleur de peau ou le décor : dans ce cas l'API renvoie HTTP 422 et
l'interface permet de dessiner la région manuellement.

Les résultats restent diagnostiques : `lines: []` est intentionnel.
Il faut encore entraîner ou intégrer un modèle de segmentation des plis,
le valider sur un jeu de photographies annotées, puis seulement relier
ces observations à l'interprétation GPT-4.1. Ne pas remplacer
`analyzeHand` tant que cette validation n'est pas terminée.
