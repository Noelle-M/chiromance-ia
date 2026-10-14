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
