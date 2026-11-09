# Merise Studio

Site complet pour dessiner des diagrammes MERISE (MCD, MLD, MCC, MCT, MOT, dessin libre) : pages d’accueil, aide, contact, mentions, éditeur SVG sans bibliothèque, API PHP et base MySQL.

## Installation
1. Copiez le dossier `merise-studio` sur votre serveur (XAMPP/WAMP : `htdocs`, ou votre hébergeur PHP 7.4+).
2. Modifiez `api/config.php` avec vos accès MySQL.
3. **Rien à importer** : la base et les tables se créent automatiquement au premier lancement (schéma intégré dans `db/merise_studio.sql`). Si votre hébergeur interdit la création de bases, créez une base vide dans phpMyAdmin avec le nom indiqué dans `config.php` : les tables se créeront seules. Import manuel possible : `mysql -u root -p < db/merise_studio.sql`.
4. Ouvrez `http://localhost/merise-studio/` (pas en double-cliquant sur les fichiers : PHP doit tourner pour le compte, l’enregistrement et le contact).
5. Cliquez sur **Éditeur**, puis **Compte** (ou directement sur **Espace Administrateur** : `admin.html`).
6. Un compte administrateur est déjà configuré par défaut :
   - **Nom de connexion** : `root`
   - **Mot de passe** : `Admi@123` *(modifiable à tout moment depuis l'espace administrateur)*

## Pages du site
- Accueil (`index.html`), Éditeur (`editeur.html`), Espace Administrateur (`admin.html`), Aide (`aide.html`), À propos (`a-propos.html`), Contact (`contact.html`), Mentions légales (`mentions.html`), Confidentialité (`confidentialite.html`), Page 404 (`404.html`).

## Utilisation de l’éditeur
- **Ajouter** un élément, glisser pour le déplacer, toucher pour modifier son nom et ses attributs.
- **Relier & Flèches** : activer « Sélection multiple », toucher 2 éléments, puis « Relier ». Flèches personnalisables (vers la fin, vers le début, aux deux bouts, aucune), formes (triangle plein, ouverte en V, losange plein/vide, rond) et tailles réglables.
- **Style & Personnalisation** : texte souligné (Ctrl+U), gras (Ctrl+B), italique (Ctrl+I), alignement (gauche, centre, droite), zone de texte réglable en largeur et hauteur manuelles ou automatiques, fond transparent ou coloré, traits et bordures en continu, pointillés, tirets ou tiret-point. Préfixe <code>#</code> pour souligner automatiquement les clés primaires en Merise.
- **Disposition** : zoom, grille, ajuster, aligner. **Copier / coller** : Ctrl+C / Ctrl+V.
- **Merise** : générer un SQL de départ, dictionnaire de données, exemples.
- **Supprimer…** : sélection, liens seulement, éléments isolés, même type, tout effacer, restaurer ou vider la corbeille. Annuler / Rétablir : Ctrl+Z / Ctrl+Y.
- **Compte obligatoire** pour **Enregistrer, Ouvrir, PNG, PDF, SVG et Nouveau**. Sans connexion, la fenêtre de connexion s'ouvre (le travail en cours est conservé).
- **Enregistrer** : le projet est envoyé sur le serveur et un fichier `.merise.json` est téléchargé. Le navigateur garde un brouillon automatique.
- **PNG / PDF / SVG** : export de l'image ; pour le PDF, choisissez « Enregistrer au format PDF » dans la boîte d'impression.
- **Compte** : profil, mot de passe, diagrammes, corbeille.
- **Espace Administrateur (`admin.html`)** : tableau de bord complet, métriques et KPIs, gestion des comptes utilisateurs (création, modification, activation/désactivation, suppression, réinitialisation de mot de passe), surveillance de tous les diagrammes, consultation et traitement des messages de contact, journal d'audit et modification directe du mot de passe root.

Sécurité : mettez le site en HTTPS en production.
