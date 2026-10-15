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

## Préparation Capacitor

Un fichier `capacitor.config.json` est présent à la racine. L'identifiant `solutions.mynova.chiromancia` est **provisoire** : le valider avant la création de la fiche Google Play, car l'identifiant Android devient définitif après publication.

Sur le poste de développement, depuis le dépôt synchronisé :

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

**Attention :** le wrapper natif NOVA Tracker est une WebView Android personnalisée, pas une preuve qu'un plugin Capacitor existe déjà dans Chiromancia. Pour Capacitor, implémenter un plugin natif Android qui expose les mêmes opérations que `src/lib/googlePlayBilling.js` et transmet les jetons au serveur. Le pont JavaScript actuel attend `window.ChiromanciaBillingNative` et devra être raccordé à ce plugin lors de sa création.

L'intégration native Android et la vérification serveur ne sont **pas encore implémentées**. La couche React refuse actuellement de débloquer les achats sans confirmation.

La version iOS suivra le même modèle de droits serveur avec StoreKit.
