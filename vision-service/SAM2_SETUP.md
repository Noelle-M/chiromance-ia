# SAM 2 — expérimentation assistée

SAM 2 est **optionnel**. Il ne reconnaît pas les lignes de chiromancie.
Cette intégration teste la segmentation guidée par des points sur une photo.

## Installation

Suivez les instructions et versions Python/PyTorch prises en charge par
le projet officiel : https://github.com/facebookresearch/sam2

Installez SAM 2 et PyTorch dans l'environnement Python du service.
Téléchargez séparément un checkpoint officiel compatible avec la
configuration choisie. Aucun poids de modèle n'est inclus dans le dépôt.

Définissez deux variables d'environnement :
- `SAM2_CHECKPOINT` : chemin absolu du fichier de poids
- `SAM2_CONFIG` : nom de configuration reconnu par SAM 2, par exemple
  `configs/sam2.1/sam2.1_hiera_t.yaml` pour le checkpoint correspondant.

Sous PowerShell :

```powershell
$env:SAM2_CHECKPOINT="C:\\modeles\\sam2.1_hiera_tiny.pt"
$env:SAM2_CONFIG="configs/sam2.1/sam2.1_hiera_t.yaml"
python -m uvicorn app:app --reload --port 8765
```

## API

`POST /sam2/segment` accepte `photo` (fichier) et `points` (chaîne JSON).
`points` doit contenir :
`{"positive":[[0.4,0.5]],"negative":[[0.2,0.2]]}`.
Les coordonnées sont relatives à la photo, de 0 à 1.
La réponse JSON renvoie un score du modèle et une surface relative ;
elle ne fournit aucune ligne de chiromancie.

`POST /sam2/preview` accepte les mêmes paramètres et renvoie une image PNG
où la région segmentée est surlignée en cyan.

Un point positif doit être placé sur un pli à tester. Les points négatifs
peuvent être placés sur la peau autour. Il est possible que SAM 2 segmente
une région de peau au lieu du pli fin : ce résultat doit alors être rejeté.

**Limites** : aucun modèle de segmentation des plis n'a encore été entraîné
ou validé. Les routes ne sont pas reliées à l'analyse de production.
Le service de test local n'a pas d'authentification : ne l'exposez pas sur
Internet tel quel.
