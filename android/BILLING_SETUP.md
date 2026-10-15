# Chiromancia Android / Capacitor / Google Play Billing

Le projet Capacitor Android est généré dans `android/`. L'interface React appelle le plugin natif `ChiromanciaBilling` qui utilise Google Play Billing 8.0.0.

Produits prévus (à créer dans Google Play Console, prix à y définir) :
- `chiromancia_rapport_complet` : produit intégré non consommable, 4,99 EUR.
- `chiromancia_questions_illimitees` : abonnement mensuel, 6,99 EUR.

Identifiant Android provisoire : `solutions.mynova.chiromancia`. Le confirmer **avant publication**.

## Réalisé
- Projet Capacitor Android, compilation Vite et synchronisation Capacitor.
- Plugin natif Java : lancement d'achat unique, souscription, restauration des achats.
- Retour des jetons d'achat à JavaScript **sans attribuer de droits**.

## Obligatoire avant tout lancement commercial
- Créer les deux produits et les offres dans Play Console.
- Vérifier les jetons d'achat sur le serveur avec Google Play Developer API (compte de service), en liant chaque achat à l'utilisateur authentifié et, pour le rapport, au scan concerné.
- Faire respecter les droits par les fonctions serveur et verrouiller les écritures de statut d'achat dans les règles d'accès des entités. Ne pas faire confiance aux champs modifiables par le client.
- Accuser réception des achats vérifiés dans les délais Google Play, gérer pending, renouvellements, annulations, remboursements et notifications RTDN.
- Tester dans Google Play avec un compte de test et un bundle signé.
- Vérifier les fonctionnalités appareil photo et PDF dans la version Android.
- Installer Android Studio / JDK localement puis exécuter `npx cap open android` et une compilation Gradle. Le sandbox actuel ne dispose pas de Java : compilation native non vérifiée.

**Aucun accès premium n'est accordé sur la seule base d'un résultat natif.** L'intégration serveur est encore à réaliser.

Pour iOS, ajouter ultérieurement Capacitor iOS et StoreKit avec la même validation de droits côté serveur.
