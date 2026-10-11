# Mémoires Panafricaines — musée numérique

Application full-stack responsive en français, livrée avec **30 fiches initiales**, un **back-office CRUD**, une base SQLite persistante et des **QR codes PNG générés à la demande**.

## Prérequis
- Node.js 20+ (idéalement Node 22 LTS), npm

## Démarrage
```bash
npm install
cp .env.example .env
# Modifier .env avec un email administrateur, un mot de passe fort, un SESSION_SECRET aléatoire et BASE_URL
npm start
```
Ouvrir http://localhost:3000. Administration : http://localhost:3000/admin/login.
Sous Windows, copier `.env.example` vers `.env` manuellement si `cp` n'est pas disponible.

## Fonctionnalités
- Catalogue filtrable par recherche et domaine ; fiches individuelles accessibles via des URL stables.
- Back-office : ajouter, modifier, publier/dépublier, supprimer une personnalité ; ajouter une image par URL HTTPS.
- QR PNG haute résolution téléchargeable pour chaque personnalité publiée (`/qr/:slug.png`).
- SQLite initialisé automatiquement au premier lancement dans `data/gallery.db` ; les modifications sont conservées.
- Sessions en base de données, cookies HttpOnly et SameSite, protection CSRF, limitation des tentatives de connexion, en-têtes de sécurité.

## Mise en ligne / QR d'exposition
1. Héberger l'application sur un serveur Node.js avec stockage persistant et HTTPS (VPS ou hébergeur Node compatible SQLite).
2. Définir `BASE_URL=https://votre-domaine.tld` **avant de télécharger les QR codes**. Un QR imprimé encode cette URL publique et ne peut pas être modifié après impression.
3. Définir `NODE_ENV=production`, un `SESSION_SECRET` long et unique, `ADMIN_EMAIL`, `ADMIN_PASSWORD` ; configurer un reverse proxy HTTPS.
4. Sauvegarder régulièrement `data/gallery.db` (utiliser l'API SQLite de sauvegarde ou arrêter le service pendant la copie).
5. Vérifier chaque fiche et les droits des photographies avant publication / impression.

## Architecture
- `src/server.js` : routes HTTP, authentification, SQLite, QR, administration.
- `src/data.js` : jeu de 30 fiches éditoriales de départ.
- `views/` : templates EJS publics et privés.
- `public/style.css` : design responsive.
- `data/` : base SQLite créée au démarrage (ignorée par git).

## Limites et évolutions recommandées
Les textes des 30 fiches sont des **résumés de démonstration** à vérifier, documenter et enrichir avec sources, chronologie, œuvres, portraits autorisés et références scientifiques avant une exposition publique. Les visuels par défaut sont des compositions typographiques, non des portraits authentiques. Les URLs d'images externes nécessitent un hébergement fiable et des droits d'utilisation.

Pour un usage multi-éditeurs à grande échelle : rôles, journal d'audit, stockage média dédié, workflow de validation, exports PDF/cartels, sauvegardes automatiques et tests E2E.

## Parcours exposition et QR codes

- Les visiteurs ouvrent une fiche complète en cliquant sur une carte ou son portrait.
- Les QR codes ne sont **pas** affichés sur les fiches publiques.
- Dans `/admin`, choisissez **QR exposition** pour prévisualiser et télécharger le PNG de chaque personnalité.
- Les routes de génération `/admin/:id/qr` et `/admin/:id/qr.png` nécessitent une session administrateur.
- Configurez `BASE_URL=https://votre-domaine.tld` avant de télécharger et imprimer les QR codes.

## Édition 3 — biographies longues et collection extensible

- La collection contient désormais plus de 70 personnalités historiques et contemporaines, réparties entre résistance anticoloniale, indépendance, arts, pensée, littérature, diplomatie et société.
- Cliquer sur la **photo ou la carte** ouvre une page de lecture en plusieurs sections (biographie, contexte, parcours, réalisations, références).
- L'administration permet de renseigner un **article long** avec des paragraphes séparés par une ligne vide et des **sources HTTPS** (une par ligne).
- Les notices historiques ajoutées constituent une base éditoriale, **pas une recherche académique vérifiée**. Certaines biographies disposent d'un article approfondi rédigé; les autres sont des notices structurées à enrichir avant une exposition publique. Les liens de recherche documentaire ne sont pas des citations attestant automatiquement chaque fait.
- Le lancement ajoute uniquement les nouvelles personnalités manquantes dans la base existante et préserve les modifications de fiches déjà enregistrées. Faites néanmoins une copie de `data/gallery.db` avant toute mise à jour.
- Les QR codes demeurent réservés à l'administration. Configurez `BASE_URL` sur votre domaine HTTPS public avant impression.


## V4 — Catalogue et lecture
- Catalogue public paginé côté serveur (12 portraits par page), avec recherche et filtre conservés dans les liens de navigation.
- Les portraits ouvrent directement les articles détaillés.
- Nouvelle feuille de style pour la lecture éditoriale, colonnes limitées et responsive.
- Génération des QR codes toujours réservée à l’administration.

## Back-office V6

Le tableau de bord affiche 12 fiches par page, avec recherche (nom, pays, domaine), filtres de publication, tris et pagination. Dans « Modifier / portrait », importez une image JPG, PNG ou WebP (5 Mo maximum). Les portraits sont convertis en WebP dans `public/uploads/` : conservez ce dossier lors des sauvegardes et du déploiement. Les URLs HTTPS restent utilisables. Les QR codes restent réservés à l’administrateur.

### Ajouter une personnalité avec son portrait

Dans **Administration > Ajouter une personnalité**, renseignez la fiche puis sélectionnez **Ajouter le portrait dès la création**. Un aperçu de l'image apparaît immédiatement. Formats acceptés : JPG, PNG et WebP, jusqu'à 5 Mo. Enregistrez : le serveur convertit automatiquement la photo en WebP et l'associe à la nouvelle personnalité. Dans **Modifier**, le même champ permet de remplacer le portrait. Conservez `public/uploads` lors des sauvegardes et mises à jour.


## V8 : domaines et cartels d'exposition

- Dans **Nouvelle personnalité** et **Modifier**, choisir un domaine prérempli ou sélectionner **Créer un nouveau domaine**. Les domaines personnalisés enregistrés apparaissent ensuite dans les choix.
- Dans **Administration**, bouton **Télécharger tous les cartels (ZIP)** : un PNG par personnalité **publiée**, avec portrait en haut et QR code en bas.
- Dans **QR exposition**, télécharger le cartel individuel.
- Les portraits téléversés localement sont intégrés aux cartels. Les portraits externes (URL HTTPS) ne sont **pas téléchargés** côté serveur pour des raisons de sécurité : un monogramme est affiché à la place. Importer la photo depuis l'administration pour l'intégrer au cartel.
- Définir `BASE_URL=https://votre-domaine.tld` avant de produire les QR pour l'impression.
- Après mise à jour, lancer `npm install` pour installer la nouvelle dépendance `archiver`.
