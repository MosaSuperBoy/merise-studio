# Merise Studio

Site complet pour dessiner des diagrammes MERISE (MCD, MLD, MCC, MCT, MOT, dessin libre) : pages d’accueil, aide, contact, mentions, éditeur SVG sans bibliothèque, API PHP et base MySQL.

## Installation
1. Copiez le dossier `merise-studio` sur votre serveur (XAMPP/WAMP : `htdocs`, ou votre hébergeur PHP 7.4+).
2. Modifiez `api/config.php` avec vos accès MySQL.
3. **Rien à importer** : la base et les tables se créent automatiquement au premier lancement (schéma intégré dans `db/merise_studio.sql`). Si votre hébergeur interdit la création de bases, créez une base vide dans phpMyAdmin avec le nom indiqué dans `config.php` : les tables se créeront seules. Import manuel possible : `mysql -u root -p < db/merise_studio.sql`.
4. Ouvrez `http://localhost/merise-studio/` (pas en double-cliquant sur les fichiers : PHP doit tourner pour le compte, l’enregistrement et le contact).
5. Sur une nouvelle installation, créez votre compte avec **Compte** : le premier compte créé devient administrateur. Faites cette première inscription depuis votre machine locale ou protégez temporairement le site par un accès restreint avant de le rendre public.
6. Connectez-vous ensuite à l’**Espace Administrateur** (`admin.html`) et utilisez un mot de passe unique d’au moins 12 caractères. Aucun compte ni mot de passe administrateur par défaut n’est créé.
7. Pour permettre la réinitialisation du mot de passe par e-mail, configurez l’envoi de courriels PHP sur le serveur et ajoutez à `api/config.local.php` une ligne `const MAIL_FROM_ADDRESS = 'no-reply@votre-domaine.tld';` avec une adresse d’expédition valide pour votre domaine. Si ce fichier existe déjà, ajoutez seulement cette ligne sans remplacer vos paramètres MySQL. Le courriel contient le logo du site, le code à 6 chiffres expire après 15 minutes et est limité à 5 tentatives.

Sur une base déjà installée, l’ancien compte administrateur préconfiguré est automatiquement désactivé au prochain appel de l’API. S’il ne reste aucun administrateur actif, le prochain compte inscrit devient administrateur. Les mots de passe existants restent utilisables jusqu’à leur changement.

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
- **Espace Administrateur (`admin.html`)** : tableau de bord complet, métriques et KPIs, gestion des comptes utilisateurs (création, modification, activation/désactivation, suppression, réinitialisation de mot de passe), activation/désactivation du mode maintenance global depuis **Mon compte**, surveillance de tous les diagrammes, consultation et traitement des messages de contact et journal d'audit.

Sécurité : les nouveaux mots de passe doivent contenir au moins 12 caractères (72 octets maximum). Utilisez un mot de passe unique, configurez un compte MySQL dédié avec un mot de passe non vide en production, et mettez le site en HTTPS.

## Hébergement gratuit PHP/MySQL (InfinityFree)
1. Créez vous-même un compte gratuit sur [InfinityFree](https://dash.infinityfree.com/register) et choisissez un sous-domaine gratuit. L'inscription ne nécessite pas de carte bancaire. GitHub Pages n'exécute pas PHP.
2. Dans le panneau de contrôle de l'hébergeur, créez une base MySQL et notez son hôte, son nom, son utilisateur et son mot de passe. Ces valeurs sont fournies par l'hébergeur : elles ne sont généralement pas `localhost` / `root`.
3. Copiez `api/config.local.example.php` vers `api/config.local.php`, remplacez les valeurs par celles de votre panneau, puis envoyez le fichier `config.local.php` au serveur. Il est ignoré par Git et protégé contre l'accès Web. Ne le publiez jamais sur GitHub et ne partagez pas son contenu.
4. Envoyez le contenu du projet dans le dossier `htdocs` avec le gestionnaire de fichiers ou FTP; ne téléversez ni `.git` ni le dossier parent. Conservez les fichiers et sous-dossiers (`api`, `css`, `db`, `js`).
5. Activez le certificat SSL gratuit dans le panneau et vérifiez que le site s'ouvre en `https://` avant toute inscription ou saisie de mot de passe.
6. Après avoir configuré la base, ouvrez le site et créez immédiatement le premier compte administrateur avant de partager son adresse. Vérifiez ensuite une inscription utilisateur, une connexion et l'enregistrement d'un diagramme.

L'API crée les tables dans la base que vous avez créée. Si la connexion échoue, vérifiez les quatre valeurs de `api/config.local.php` dans le panneau de l'hébergeur. Un hébergement gratuit partagé convient aux essais et démonstrations, mais ne garantit ni disponibilité ni sauvegardes : n'y stockez pas de données sensibles sans avoir vérifié les conditions et protections de l'hébergeur.
