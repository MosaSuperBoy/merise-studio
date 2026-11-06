# Merise Studio

Éditeur MERISE (MCD, MLD, MCC, MCT, MOT + dessin libre) en HTML/CSS/JS vanilla, sans bibliothèque ni CDN. Compatible téléphone (toucher, pincement, panneau coulissant).

## Fichiers
`index.html` (page) · `style.css` · `modele.js` (données, exemples) · `rendu.js` (dessin SVG) · `stockage.js` (localStorage, JSON, PNG, serveur) · `interactions.js` (tactile, outils, menus) · `api.php` (copies serveur)

## Utilisation sans installation
Ouvrez `index.html` dans le navigateur : tout fonctionne (sauvegarde locale, JSON, PNG, PDF). Seules les copies serveur nécessitent PHP.

## Hébergement PHP
1. Envoyez tous les fichiers dans un dossier de l'hébergement (FTP).
2. Vérifiez que PHP peut écrire dans ce dossier : le sous-dossier `sauvegardes/` est créé automatiquement.
3. Ouvrez l'URL du dossier : ☰ → « Envoyer ce projet » / « Lister les copies ».

## Serveur local
Dans le dossier : `php -S localhost:8000` puis ouvrez http://localhost:8000

## Notes
- Les identifiants de projet servent de « clé » : sans authentification, toute personne connaissant l'URL peut lister les copies. Ajoutez une protection (.htaccess, mot de passe) pour un usage public.
- Format des lignes : entité `#id` (identifiant souligné) ; table `nom:type:PK:FK`.
