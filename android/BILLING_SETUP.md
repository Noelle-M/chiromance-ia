# Chiromancia - Google Play Billing (Android d'abord)

Référence d'architecture : NOVA Tracker, dossier android/ et src/lib/googlePlayBilling.js.

## Produits à créer dans Play Console

- Produit intégré non consommable : `chiromancia_rapport_complet` (4,99 EUR), lié à un rapport / scan précis côté backend.
- Abonnement mensuel : `chiromancia_questions_illimitees` (6,99 EUR / mois).

Les identifiants sont des propositions techniques : ils doivent correspondre exactement à ceux publiés dans Play Console.

## Contrat natif attendu

Le wrapper Android doit exposer `window.ChiromanciaBillingNative` avec :
- `launchOneTimePurchase(productId, callbackId)`
- `launchSubscriptionFlow(productId, callbackId)`
- `restorePurchases(callbackId)`

Les résultats sont transmis à `window.__chiromanciaBillingResolve(callbackId, JSON.stringify(result))`.

## Sécurité indispensable avant commercialisation

1. Recevoir le jeton d'achat depuis Google Play Billing natif.
2. Vérifier le jeton **sur le backend** via Google Play Developer API, avec le bon package et produit ; ne jamais faire confiance à `result.success` seul.
3. Enregistrer l'achat vérifié, son utilisateur, son scan si rapport, son état, son expiration si abonnement, et prévenir les doubles utilisations du jeton.
4. Débloquer uniquement après validation serveur, gérer achats en attente, renouvellements, annulations, remboursements et restauration.
5. Ajouter les notifications temps réel Google Play (RTDN) pour synchroniser l'état des abonnements.
6. Ne jamais attribuer de droits particuliers au rôle administrateur.

L'intégration native Android et la vérification serveur ne sont **pas encore implémentées**. La couche React refuse actuellement de débloquer les achats sans confirmation.

La version iOS suivra le même modèle de droits serveur avec StoreKit.
