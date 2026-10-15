# Chiromancia — préparation Android / Google Play

Identifiant Android définitif : `solutions.mynova.chiromancia`.

## Produits

- `chiromancia_rapport_complet` : achat intégré **consommable**, 4,99 € **par lecture**. Le serveur vérifie le jeton, lie l'achat au compte et au scan, puis consomme le produit Google Play pour permettre un nouvel achat. Le rapport reste accessible dans le compte via le droit enregistré sur le serveur.
- `chiromancia_questions_illimitees` : abonnement mensuel, 6,99 €. Trois questions gratuites avant abonnement. Aucun privilège admin.

## Code réalisé

- Projet Capacitor Android et plugin natif Google Play Billing.
- Validation des jetons via Google Play Developer API dans `verifyPlayPurchase`.
- Droit premium stocké dans `PlayEntitlement`, écriture réservée au serveur.
- Rapport approfondi et questions au-delà du quota protégés côté serveur.
- Sauvegarde des liens PDF via fonction serveur après contrôle du droit.
- Interface de restauration des achats ; les rapports consommés sont restaurés via les droits du compte Base44, pas via la liste d'achats actifs de Google Play.

## À finaliser avant diffusion

- Ajouter le secret serveur `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` et autoriser son compte de service dans Play Console.
- Créer les produits Google Play avec les identifiants exacts ci-dessus.
- Gérer les événements d'abonnement et remboursements (RTDN), revérifier les abonnements au serveur et traiter les échecs temporaires de consommation.
- Vérifier la cohérence des droits et le comportement des achats annulés/remboursés.
- Générer et signer l'AAB avec Android Studio, puis le déposer sur une piste de test Google Play.
- Vérifier dans la version installée depuis Google Play le paiement, l'appareil photo, le rapport et le PDF.

La compilation Vite et la synchronisation Capacitor ne prouvent pas que le code Java Android compile. L'AAB natif reste à produire dans Android Studio.
