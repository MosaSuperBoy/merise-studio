<?php
// API de Merise Studio : comptes, diagrammes et administration (JSON via POST)
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
$hoteRequete = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
$hotesLocaux = ['localhost', '127.0.0.1', '::1', '[::1]'];
$httpsActif = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
  || strtolower($_SERVER['REQUEST_SCHEME'] ?? '') === 'https'
  || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
if (PHP_SAPI !== 'cli' && !in_array($hoteRequete, $hotesLocaux, true) && !$httpsActif) {
  http_response_code(403);
  echo json_encode(['erreur' => 'HTTPS est obligatoire pour utiliser cette API.'], JSON_UNESCAPED_UNICODE);
  exit;
}
if (PHP_SAPI !== 'cli' && ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Allow: POST');
  http_response_code(405);
  echo json_encode(['erreur' => 'Cette API accepte uniquement les requêtes POST.'], JSON_UNESCAPED_UNICODE);
  exit;
}
$typeContenu = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if (PHP_SAPI !== 'cli' && $typeContenu !== 'application/json') {
  http_response_code(415);
  echo json_encode(['erreur' => 'Le corps de requête doit être au format JSON.'], JSON_UNESCAPED_UNICODE);
  exit;
}
$tailleMaxCorps = 6 * 1024 * 1024;
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $tailleMaxCorps) {
  http_response_code(413);
  echo json_encode(['erreur' => 'Requête trop volumineuse'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Toute erreur inattendue renvoie du JSON propre au lieu d'une page blanche
set_exception_handler(function ($e) { error_log('Merise Studio : ' . $e->getMessage()); http_response_code(500); echo json_encode(['erreur' => 'Erreur serveur'], JSON_UNESCAPED_UNICODE); });
function rep($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function err($m, $c = 400) { rep(['erreur' => $m], $c); }
function motDePasseValide($motDePasse) {
  if (!is_string($motDePasse) || strlen($motDePasse) > 72) return false;
  return preg_match_all('/./us', $motDePasse, $caracteres) !== false && count($caracteres[0]) >= 12;
}
function hacherMotDePasse($motDePasse) {
  return password_hash($motDePasse, PASSWORD_BCRYPT, ['cost' => 12]);
}

// --- Base de données intégrée : créée automatiquement au premier lancement ---
function connexion($avecBase) {
  return new PDO('mysql:host=' . DB_HOTE . ($avecBase ? ';dbname=' . DB_NOM : '') . ';charset=utf8mb4', DB_UTILISATEUR, DB_MOT_DE_PASSE,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
}
// Schéma = db/merise_studio.sql, sans ses lignes CREATE DATABASE / USE (le nom vient de config.php)
function schemaSql() {
  return preg_replace('/^\s*(CREATE DATABASE|USE)\b[^;]*;/mi', '', file_get_contents(__DIR__ . '/../db/merise_studio.sql'));
}
function installer() {
  if (!preg_match('/^\w+$/', DB_NOM)) throw new Exception('Nom de base invalide');
  $bd = connexion(false);
  $bd->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NOM . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  $bd->exec('USE `' . DB_NOM . '`');
  $bd->exec(schemaSql());
}
// 1) Connexion : seule une vraie panne de connexion bloque toute l'API
try {
  try { $bd = connexion(true); }
  catch (Throwable $e) { installer(); $bd = connexion(true); }          // base absente : on la crée
} catch (Throwable $e) {
  error_log('Merise Studio : connexion MySQL impossible : ' . $e->getMessage());
  err('Base de données inaccessible. Vérifiez les accès MySQL dans api/config.local.php (hôte, nom, utilisateur, mot de passe), ou créez une base vide nommée « ' . DB_NOM . ' » : les tables se créeront toutes seules.', 500);
}

// 2) Tables indispensables (comptes, diagrammes, sessions, journal)
try {
  if (!$bd->query("SHOW TABLES LIKE 'utilisateurs'")->fetch()) $bd->exec(schemaSql()); // tables absentes : on les crée
} catch (Throwable $e) {
  error_log('Merise Studio : création des tables impossible : ' . $e->getMessage());
  err('La base est joignable mais ses tables n\'ont pas pu être créées. Importez db/merise_studio.sql avec phpMyAdmin.', 500);
}

// 3) Tables facultatives (contact, réinitialisation, maintenance) : une erreur ici ne doit jamais arrêter tout le site.
//    $sqlSecours est tentée si la première requête échoue (ex. clé étrangère refusée sur une ancienne base).
function tableFacultative($bd, $sql, $sqlSecours = null) {
  foreach ($sqlSecours === null ? [$sql] : [$sql, $sqlSecours] as $requete) {
    try { $bd->exec($requete); return true; }
    catch (Throwable $e) { error_log('Merise Studio : table facultative non créée : ' . $e->getMessage()); }
  }
  return false;
}
$rateLimitDisponible = tableFacultative($bd, "CREATE TABLE IF NOT EXISTS api_rate_limits (
    bucket CHAR(64) PRIMARY KEY,
    window_started DATETIME NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 1,
    INDEX idx_rate_window (window_started)
  ) ENGINE=InnoDB");
tableFacultative($bd, "CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL,
    sujet VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    lu TINYINT(1) NOT NULL DEFAULT 0,
    cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB");
tableFacultative($bd, "CREATE TABLE IF NOT EXISTS password_reset_codes (
    utilisateur_id INT UNSIGNED PRIMARY KEY,
    code_hash VARCHAR(255) NOT NULL,
    tentatives TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expire_le DATETIME NOT NULL,
    cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    INDEX idx_reset_expire (expire_le)
  ) ENGINE=InnoDB", "CREATE TABLE IF NOT EXISTS password_reset_codes (
    utilisateur_id INT UNSIGNED PRIMARY KEY,
    code_hash VARCHAR(255) NOT NULL,
    tentatives TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expire_le DATETIME NOT NULL,
    cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_expire (expire_le)
  ) ENGINE=InnoDB");
if (tableFacultative($bd, "CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    modifie_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB")) {
  try { $bd->exec("INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES('maintenance','0')"); }
  catch (Throwable $e) { error_log('Merise Studio : réglage maintenance non initialisé : ' . $e->getMessage()); }
}

function limiterRequetes($bd, $actionLimitee, $maximum, $fenetreSecondes) {
  global $rateLimitDisponible;
  if (!$rateLimitDisponible) err('Protection anti-abus temporairement indisponible.', 503);

  $ip = $_SERVER['REMOTE_ADDR'] ?? 'inconnue';
  if (!filter_var($ip, FILTER_VALIDATE_IP)) $ip = 'inconnue';
  $bucket = hash('sha256', $actionLimitee . "\0" . $ip);
  $fenetreSecondes = max(1, (int)$fenetreSecondes);
  $conditionFenetre = "window_started <= DATE_SUB(NOW(), INTERVAL $fenetreSecondes SECOND)";

  try {
    $s = $bd->prepare("INSERT INTO api_rate_limits(bucket,window_started,attempts) VALUES(?,NOW(),1)
      ON DUPLICATE KEY UPDATE
        attempts=IF($conditionFenetre,1,attempts+1),
        window_started=IF($conditionFenetre,NOW(),window_started)");
    $s->execute([$bucket]);
    $s = $bd->prepare('SELECT attempts FROM api_rate_limits WHERE bucket=?');
    $s->execute([$bucket]);
    $tentatives = (int)$s->fetchColumn();
  } catch (Throwable $e) {
    error_log('Merise Studio : limitation des requêtes indisponible : ' . $e->getMessage());
    err('Protection anti-abus temporairement indisponible.', 503);
  }

  if (random_int(1, 100) === 1) {
    try { $bd->exec('DELETE FROM api_rate_limits WHERE window_started < DATE_SUB(NOW(), INTERVAL 1 DAY)'); }
    catch (Throwable $e) { error_log('Merise Studio : nettoyage des limites impossible : ' . $e->getMessage()); }
  }
  if ($tentatives > (int)$maximum) {
    header('Retry-After: ' . $fenetreSecondes);
    err('Trop de requêtes. Réessayez plus tard.', 429);
  }
}

// Désactive les installations qui utilisent encore le mot de passe administrateur publié.
try {
  $hashRootParDefaut = '$2y$12$39eevJ5B5Mdbg.cZT1zEaOvtR72aD..rHRdU4kbehbZBVEQZ9icVS';
  $desactiverRoot = $bd->prepare("UPDATE utilisateurs SET actif=0 WHERE LOWER(nom)='root' AND LOWER(email)='root@merise.local' AND mot_de_passe=?");
  $desactiverRoot->execute([$hashRootParDefaut]);
} catch (Throwable $e) {
  error_log('Merise Studio : contrôle du compte root impossible : ' . $e->getMessage());
}

$flux = fopen('php://input', 'rb');
$corps = $flux ? stream_get_contents($flux, $tailleMaxCorps + 1) : '';
if ($flux) fclose($flux);
if (strlen($corps) > $tailleMaxCorps) err('Requête trop volumineuse', 413);
$in = json_decode($corps, true);
if (!is_array($in)) $in = [];
$action = $_GET['action'] ?? '';
try { $maintenanceActive = (string)$bd->query("SELECT setting_value FROM site_settings WHERE setting_key='maintenance'")->fetchColumn() === '1'; }
catch (Throwable $e) { $maintenanceActive = false; } // table des réglages indisponible : le site reste ouvert

function journal($bd, $u, $a, $d = null) { $bd->prepare('INSERT INTO journal(utilisateur_id,action,details) VALUES(?,?,?)')->execute([$u, $a, $d]); }
function pub($u) { return ['id' => (int)$u['id'], 'nom' => $u['nom'], 'email' => $u['email'], 'role' => $u['role']]; }
function ouvrirSession($bd, $id) {
  $j = bin2hex(random_bytes(32));
  $bd->prepare('INSERT INTO sessions(jeton,utilisateur_id,expire_le) VALUES(?,?,DATE_ADD(NOW(),INTERVAL ' . (int)SESSION_JOURS . ' DAY))')->execute([$j, $id]);
  return $j;
}
function connecte($bd) {
  $t = $_SERVER['HTTP_X_TOKEN'] ?? '';
  if (!$t) err('Connexion requise', 401);
  $s = $bd->prepare('SELECT u.* FROM sessions s JOIN utilisateurs u ON u.id=s.utilisateur_id WHERE s.jeton=? AND s.expire_le>NOW() AND u.actif=1');
  $s->execute([$t]);
  return $s->fetch() ?: err('Session expirée, reconnectez-vous', 401);
}

// --- Actions publiques ---
if ($action === 'maintenance_status') rep(['actif' => $maintenanceActive]);
if ($action === 'register') {
  limiterRequetes($bd, 'register', 8, 3600);
  if ($maintenanceActive) err('Le site est en maintenance. Réessayez plus tard.', 503);
  $nom = trim($in['nom'] ?? ''); $email = strtolower(trim($in['email'] ?? '')); $mdp = $in['mot_de_passe'] ?? '';
  if ($nom === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !motDePasseValide($mdp)) err('Nom, e-mail valide et mot de passe (12 caractères min., 72 octets max.) requis');
  if (strtolower($nom) === 'root') err('Le nom de connexion « root » est réservé à l\'administrateur', 400);
  $s = $bd->prepare('SELECT id FROM utilisateurs WHERE email=? OR LOWER(nom)=?'); $s->execute([$email, strtolower($nom)]);
  if ($s->fetch()) err('Cet e-mail ou nom d\'utilisateur est déjà utilisé', 409);
  // L'inscription publique ne peut jamais attribuer les droits administrateur.
  $role = 'utilisateur';
  $bd->prepare('INSERT INTO utilisateurs(nom,email,mot_de_passe,role) VALUES(?,?,?,?)')->execute([$nom, $email, hacherMotDePasse($mdp), $role]);
  $id = (int)$bd->lastInsertId(); journal($bd, $id, 'inscription');
  rep(['jeton' => ouvrirSession($bd, $id), 'utilisateur' => ['id' => $id, 'nom' => $nom, 'email' => $email, 'role' => $role]]);
}
if ($action === 'login') {
  limiterRequetes($bd, 'login', 12, 900);
  $login = trim($in['identifiant'] ?? $in['email'] ?? $in['nom'] ?? '');
  if ($login === '') err('Identifiant ou e-mail requis', 400);
  $mdp = $in['mot_de_passe'] ?? '';
  if (!is_string($mdp) || strlen($mdp) > 72) err('Identifiant ou mot de passe incorrect', 401);
  $s = $bd->prepare('SELECT * FROM utilisateurs WHERE LOWER(email)=? OR LOWER(nom)=? LIMIT 1');
  $s->execute([strtolower($login), strtolower($login)]);
  $u = $s->fetch();
  if (!$u || !password_verify($mdp, $u['mot_de_passe']) || !$u['actif']) err('Identifiant ou mot de passe incorrect', 401);
  if ($maintenanceActive && $u['role'] !== 'admin') err('Le site est en maintenance. Réessayez plus tard.', 503);
  if (password_needs_rehash($u['mot_de_passe'], PASSWORD_BCRYPT, ['cost' => 12])) {
    $bd->prepare('UPDATE utilisateurs SET mot_de_passe=? WHERE id=?')->execute([hacherMotDePasse($mdp), $u['id']]);
  }
  $bd->prepare('UPDATE utilisateurs SET derniere_connexion=NOW() WHERE id=?')->execute([$u['id']]);
  journal($bd, $u['id'], 'connexion');
  rep(['jeton' => ouvrirSession($bd, $u['id']), 'utilisateur' => pub($u)]);
}
if ($action === 'password_reset_request') {
  limiterRequetes($bd, 'password_reset_request', 4, 3600);
  $expediteur = defined('MAIL_FROM_ADDRESS') ? MAIL_FROM_ADDRESS : '';
  if (!filter_var($expediteur, FILTER_VALIDATE_EMAIL)) {
    err('Envoi indisponible : ajoutez une adresse valide MAIL_FROM_ADDRESS dans api/config.local.php.', 503);
  }
  $email = strtolower(trim($in['email'] ?? ''));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('Adresse e-mail invalide');
  $message = 'Si un compte actif correspond à cette adresse, un code a été demandé. S’il n’arrive pas, vérifiez les courriers indésirables et la configuration e-mail du serveur.';
  $s = $bd->prepare('SELECT id FROM utilisateurs WHERE LOWER(email)=? AND actif=1 LIMIT 1');
  $s->execute([$email]);
  $utilisateurId = $s->fetchColumn();
  if ($utilisateurId) {
    $s = $bd->prepare('SELECT cree_le > DATE_SUB(NOW(), INTERVAL 60 SECOND) FROM password_reset_codes WHERE utilisateur_id=?');
    $s->execute([$utilisateurId]);
    if ($s->fetchColumn()) rep(['ok' => true, 'message' => $message]);

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $hashCode = password_hash($code, PASSWORD_DEFAULT);
    $bd->prepare('REPLACE INTO password_reset_codes(utilisateur_id,code_hash,tentatives,expire_le,cree_le) VALUES(?,?,0,DATE_ADD(NOW(),INTERVAL 15 MINUTE),NOW())')
      ->execute([$utilisateurId, $hashCode]);

    if (filter_var($expediteur, FILTER_VALIDATE_EMAIL)) {
      $sujet = '=?UTF-8?B?' . base64_encode('Code de réinitialisation — Merise Studio') . '?=';
      $texte = "Bonjour,\n\nVotre code de réinitialisation Merise Studio est : $code\n\nCe code expire dans 15 minutes et ne peut être utilisé qu'une seule fois. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.\n";
      $logo = file_get_contents(__DIR__ . '/../logo/logo-merise-studio.png');
      $envoye = false;
      if ($logo === false) {
        error_log('Merise Studio : logo du courriel de réinitialisation introuvable.');
      } else {
        $frontiere = '=_MeriseStudio_' . bin2hex(random_bytes(16));
        $alternative = $frontiere . '_alternative';
        $html = '<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,sans-serif;color:#173b2b;">' .
          '<div style="max-width:480px;margin:auto;padding:28px;background:#fff;border:1px solid #dce8df;border-radius:12px;">' .
          '<img src="cid:merise-studio-logo" alt="Merise Studio" width="235" height="64" style="display:block;width:235px;height:64px;margin:0 auto 24px;border:0;">' .
          '<h1 style="font-size:22px;text-align:center;">Réinitialisation du mot de passe</h1>' .
          '<p>Bonjour, voici votre code de vérification :</p>' .
          '<p style="padding:16px;background:#f4f7f5;border-radius:8px;font-size:30px;font-weight:bold;letter-spacing:8px;text-align:center;">' . $code . '</p>' .
          '<p>Ce code expire dans 15 minutes et ne peut être utilisé qu’une seule fois.</p>' .
          '<p style="font-size:13px;color:#52675a;">Si vous n’avez pas demandé cette réinitialisation, ignorez ce message.</p>' .
          '</div></body></html>';
        $corps = '--' . $frontiere . "\r\n" .
          'Content-Type: multipart/alternative; boundary="' . $alternative . '"' . "\r\n\r\n" .
          '--' . $alternative . "\r\n" .
          "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
          chunk_split(base64_encode($texte), 76, "\r\n") .
          '--' . $alternative . "\r\n" .
          "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
          chunk_split(base64_encode($html), 76, "\r\n") .
          '--' . $alternative . "--\r\n" .
          '--' . $frontiere . "\r\n" .
          "Content-Type: image/png; name=\"logo-merise-studio.png\"\r\nContent-Transfer-Encoding: base64\r\n" .
          "Content-ID: <merise-studio-logo>\r\nContent-Disposition: inline; filename=\"logo-merise-studio.png\"\r\n\r\n" .
          chunk_split(base64_encode($logo), 76, "\r\n") .
          '--' . $frontiere . "--\r\n";
        $entetes = "From: Merise Studio <$expediteur>\r\nMIME-Version: 1.0\r\n" .
          'Content-Type: multipart/related; boundary="' . $frontiere . '"; type="multipart/alternative"';
        $envoye = mail($email, $sujet, $corps, $entetes);
      }
      if (!$envoye) {
        error_log('Merise Studio : échec de l’envoi d’un code de réinitialisation.');
        $bd->prepare('DELETE FROM password_reset_codes WHERE utilisateur_id=? AND code_hash=?')->execute([$utilisateurId, $hashCode]);
      }
    } else {
      error_log('Merise Studio : MAIL_FROM_ADDRESS invalide, code de réinitialisation non envoyé.');
      $bd->prepare('DELETE FROM password_reset_codes WHERE utilisateur_id=? AND code_hash=?')->execute([$utilisateurId, $hashCode]);
    }
  }
  rep(['ok' => true, 'message' => $message]);
}
if ($action === 'password_reset_confirm') {
  limiterRequetes($bd, 'password_reset_confirm', 10, 900);
  $email = strtolower(trim($in['email'] ?? ''));
  $code = $in['code'] ?? '';
  $nouveau = $in['nouveau'] ?? '';
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($code) || !preg_match('/^\d{6}$/D', $code)) {
    err('Adresse e-mail ou code invalide');
  }
  if (!motDePasseValide($nouveau)) err('Le nouveau mot de passe doit faire 12 caractères min. (72 octets max.)');

  $s = $bd->prepare('SELECT u.id, r.code_hash, r.tentatives, (r.expire_le <= NOW()) AS expire
                     FROM utilisateurs u
                     JOIN password_reset_codes r ON r.utilisateur_id=u.id
                     WHERE LOWER(u.email)=? AND u.actif=1 LIMIT 1');
  $s->execute([$email]);
  $reset = $s->fetch();
  if (!$reset || (int)$reset['tentatives'] >= 5 || (int)$reset['expire'] === 1) {
    if ($reset) $bd->prepare('DELETE FROM password_reset_codes WHERE utilisateur_id=?')->execute([$reset['id']]);
    err('Code invalide ou expiré. Demandez un nouveau code.', 400);
  }
  if (!password_verify($code, $reset['code_hash'])) {
    $bd->prepare('UPDATE password_reset_codes SET tentatives=tentatives+1 WHERE utilisateur_id=?')->execute([$reset['id']]);
    err('Code invalide ou expiré. Demandez un nouveau code.', 400);
  }

  $bd->beginTransaction();
  $bd->prepare('UPDATE utilisateurs SET mot_de_passe=? WHERE id=?')->execute([hacherMotDePasse($nouveau), $reset['id']]);
  $bd->prepare('DELETE FROM sessions WHERE utilisateur_id=?')->execute([$reset['id']]);
  $bd->prepare('DELETE FROM password_reset_codes WHERE utilisateur_id=?')->execute([$reset['id']]);
  journal($bd, (int)$reset['id'], 'mot_de_passe_reinitialise');
  $bd->commit();
  rep(['ok' => true]);
}
if ($action === 'contact') {
  limiterRequetes($bd, 'contact', 5, 3600);
  if ($maintenanceActive) err('Le site est en maintenance. Réessayez plus tard.', 503);
  $nom = trim($in['nom'] ?? ''); $email = strtolower(trim($in['email'] ?? ''));
  $sujet = trim($in['sujet'] ?? ''); $msg = trim($in['message'] ?? '');
  if ($nom === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $sujet === '' || strlen($msg) < 10) err('Tous les champs sont requis (message : 10 caractères min.)');
  preg_match('/^.{0,100}/us', $nom, $mn); $nom = $mn[0];
  preg_match('/^.{0,150}/us', $sujet, $ms); $sujet = $ms[0];
  if (strlen($msg) > 8000) err('Texte trop long');
  $bd->prepare('INSERT INTO messages(nom,email,sujet,message) VALUES(?,?,?,?)')->execute([$nom, $email, $sujet, $msg]);
  journal($bd, null, 'contact', $email);
  rep(['ok' => true]);
}

// --- Actions réservées aux utilisateurs connectés ---
$u = connecte($bd); $uid = (int)$u['id'];
if ($maintenanceActive && $u['role'] !== 'admin') err('Le site est en maintenance. Réessayez plus tard.', 503);
switch ($action) {
  case 'me': rep(['utilisateur' => pub($u)]);
  case 'logout': $bd->prepare('DELETE FROM sessions WHERE jeton=?')->execute([$_SERVER['HTTP_X_TOKEN']]); rep(['ok' => true]);
  case 'list':
    $s = $bd->prepare('SELECT id,titre,type,modifie_le,supprime_le FROM diagrammes WHERE utilisateur_id=? ORDER BY modifie_le DESC');
    $s->execute([$uid]); rep(['diagrammes' => $s->fetchAll()]);
  case 'get':
    $diagId = (int)($in['id'] ?? 0);
    if ($u['role'] === 'admin') {
      $s = $bd->prepare('SELECT id,titre,type,contenu,utilisateur_id FROM diagrammes WHERE id=?');
      $s->execute([$diagId]);
    } else {
      $s = $bd->prepare('SELECT id,titre,type,contenu,utilisateur_id FROM diagrammes WHERE id=? AND utilisateur_id=?');
      $s->execute([$diagId, $uid]);
    }
    $d = $s->fetch() ?: err('Diagramme introuvable', 404); $d['contenu'] = json_decode($d['contenu'], true); rep(['diagramme' => $d]);
  case 'save':
    $type = $in['type'] ?? 'MCD';
    if (!in_array($type, ['MCD', 'MLD', 'MCC', 'MCT', 'MOT', 'LIBRE'], true) || !is_array($in['contenu'] ?? null)) err('Données invalides');
    $titre = trim($in['titre'] ?? '') ?: 'Sans titre'; preg_match('/^.{0,150}/us', $titre, $m); $titre = $m[0]; // sans dépendre de mbstring
    $json = json_encode($in['contenu'], JSON_UNESCAPED_UNICODE);
    if (strlen($json) > 5000000) err('Diagramme trop volumineux', 413);
    $id = (int)($in['id'] ?? 0);
    if ($id) {
      $s = $bd->prepare('UPDATE diagrammes SET titre=?,type=?,contenu=?,supprime_le=NULL WHERE id=? AND utilisateur_id=?'); $s->execute([$titre, $type, $json, $id, $uid]);
      if ($s->rowCount() === 0) { $c = $bd->prepare('SELECT id FROM diagrammes WHERE id=? AND utilisateur_id=?'); $c->execute([$id, $uid]); if (!$c->fetch()) $id = 0; }
    }
    if (!$id) { $bd->prepare('INSERT INTO diagrammes(utilisateur_id,titre,type,contenu) VALUES(?,?,?,?)')->execute([$uid, $titre, $type, $json]); $id = (int)$bd->lastInsertId(); }
    rep(['id' => $id]);
  case 'delete': $bd->prepare('UPDATE diagrammes SET supprime_le=NOW() WHERE id=? AND utilisateur_id=?')->execute([(int)$in['id'], $uid]); journal($bd, $uid, 'diagramme_corbeille', (string)$in['id']); rep(['ok' => true]);
  case 'restore': $bd->prepare('UPDATE diagrammes SET supprime_le=NULL WHERE id=? AND utilisateur_id=?')->execute([(int)$in['id'], $uid]); rep(['ok' => true]);
  case 'purge': $bd->prepare('DELETE FROM diagrammes WHERE id=? AND utilisateur_id=? AND supprime_le IS NOT NULL')->execute([(int)$in['id'], $uid]); journal($bd, $uid, 'diagramme_efface', (string)$in['id']); rep(['ok' => true]);
  case 'profil':
    $nom = trim($in['nom'] ?? '');
    if ($nom === '') err('Nom requis');
    preg_match('/^.{0,100}/us', $nom, $m); $nom = $m[0];
    $email = strtolower(trim($in['email'] ?? ''));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) err('E-mail invalide');
    if ($email !== '' && $email !== strtolower($u['email'])) {
      $chk = $bd->prepare('SELECT id FROM utilisateurs WHERE email=? AND id!=?');
      $chk->execute([$email, $uid]);
      if ($chk->fetch()) err('Cet e-mail est déjà utilisé', 409);
      $bd->prepare('UPDATE utilisateurs SET nom=?, email=? WHERE id=?')->execute([$nom, $email, $uid]);
      $u['email'] = $email;
    } else {
      $bd->prepare('UPDATE utilisateurs SET nom=? WHERE id=?')->execute([$nom, $uid]);
    }
    journal($bd, $uid, 'profil');
    $u['nom'] = $nom; rep(['utilisateur' => pub($u)]);
  case 'mot_de_passe':
    if (!password_verify($in['actuel'] ?? '', $u['mot_de_passe'])) err('Mot de passe actuel incorrect', 401);
    $nouveau = $in['nouveau'] ?? '';
    if (!motDePasseValide($nouveau)) err('Le nouveau mot de passe doit faire 12 caractères min. (72 octets max.)');
    $bd->prepare('UPDATE utilisateurs SET mot_de_passe=? WHERE id=?')->execute([hacherMotDePasse($nouveau), $uid]);
    $bd->prepare('DELETE FROM sessions WHERE utilisateur_id=? AND jeton<>?')->execute([$uid, $_SERVER['HTTP_X_TOKEN'] ?? '']);
    journal($bd, $uid, 'mot_de_passe');
    rep(['ok' => true]);
}

// --- Administration ---
if ($u['role'] !== 'admin') err('Accès réservé à l\'administrateur', 403);
switch ($action) {
  case 'maintenance_set':
    if (!is_bool($in['actif'] ?? null)) err('État de maintenance invalide');
    $valeur = $in['actif'] ? '1' : '0';
    try {
      $bd->prepare("INSERT INTO site_settings(setting_key,setting_value) VALUES('maintenance',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)")
        ->execute([$valeur]);
    } catch (Throwable $e) {
      error_log('Merise Studio : maintenance non enregistrée : ' . $e->getMessage());
      err('Impossible d\'enregistrer l\'état de maintenance (table site_settings indisponible).', 500);
    }
    journal($bd, $uid, 'maintenance_modifiee', $valeur);
    rep(['ok' => true, 'actif' => $in['actif']]);
  case 'admin_stats':
    $uTot = (int)$bd->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn();
    $uAct = (int)$bd->query('SELECT COUNT(*) FROM utilisateurs WHERE actif=1')->fetchColumn();
    $uAdm = (int)$bd->query("SELECT COUNT(*) FROM utilisateurs WHERE role='admin'")->fetchColumn();
    $dTot = (int)$bd->query('SELECT COUNT(*) FROM diagrammes WHERE supprime_le IS NULL')->fetchColumn();
    $dCor = (int)$bd->query('SELECT COUNT(*) FROM diagrammes WHERE supprime_le IS NOT NULL')->fetchColumn();
    $mTot = (int)$bd->query('SELECT COUNT(*) FROM messages')->fetchColumn();
    $mNon = (int)$bd->query('SELECT COUNT(*) FROM messages WHERE lu=0')->fetchColumn();
    $parType = $bd->query('SELECT type, COUNT(*) as c FROM diagrammes WHERE supprime_le IS NULL GROUP BY type')->fetchAll(PDO::FETCH_KEY_PAIR);
    $journal = $bd->query('SELECT j.id, j.action, j.details, j.cree_le, u.nom, u.email FROM journal j LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id ORDER BY j.cree_le DESC LIMIT 15')->fetchAll();
    rep([
      'stats' => [
        'utilisateurs_total' => $uTot,
        'utilisateurs_actifs' => $uAct,
        'utilisateurs_admins' => $uAdm,
        'diagrammes_total' => $dTot,
        'diagrammes_corbeille' => $dCor,
        'diagrammes_par_type' => $parType,
        'messages_total' => $mTot,
        'messages_non_lus' => $mNon,
        'journal_recent' => $journal
      ]
    ]);
  case 'users':
    $req = $bd->query('SELECT u.id, u.nom, u.email, u.role, u.actif, u.cree_le, u.derniere_connexion,
                      COUNT(d.id) AS nb_diagrammes
                      FROM utilisateurs u
                      LEFT JOIN diagrammes d ON d.utilisateur_id = u.id AND d.supprime_le IS NULL
                      GROUP BY u.id
                      ORDER BY u.id ASC');
    $liste = array_map(function ($x) {
      $x['id'] = (int)$x['id'];
      $x['actif'] = (int)$x['actif'];
      $x['nb_diagrammes'] = (int)$x['nb_diagrammes'];
      return $x;
    }, $req->fetchAll());
    rep(['utilisateurs' => $liste]);
  case 'user_ajouter':
    $nom = trim($in['nom'] ?? '');
    $email = strtolower(trim($in['email'] ?? ''));
    $mdp = $in['mot_de_passe'] ?? '';
    $role = ($in['role'] ?? '') === 'admin' ? 'admin' : 'utilisateur';
    if ($nom === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !motDePasseValide($mdp)) {
      err('Nom, e-mail valide et mot de passe (12 caractères min., 72 octets max.) requis');
    }
    $chk = $bd->prepare('SELECT id FROM utilisateurs WHERE email=? OR LOWER(nom)=?');
    $chk->execute([$email, strtolower($nom)]);
    if ($chk->fetch()) err('Cet e-mail ou nom d\'utilisateur existe déjà', 409);
    $bd->prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif) VALUES (?, ?, ?, ?, 1)')
       ->execute([$nom, $email, hacherMotDePasse($mdp), $role]);
    $nouvelId = (int)$bd->lastInsertId();
    journal($bd, $uid, 'admin_ajout_utilisateur', "id=$nouvelId, nom=$nom, role=$role");
    rep(['ok' => true, 'id' => $nouvelId]);
  case 'user_modifier':
    $idCible = (int)($in['id'] ?? 0);
    if (!$idCible) err('Identifiant utilisateur manquant');
    $nom = trim($in['nom'] ?? '');
    $email = strtolower(trim($in['email'] ?? ''));
    $role = ($in['role'] ?? '') === 'admin' ? 'admin' : 'utilisateur';
    if ($nom === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) err('Nom et e-mail valide requis');
    if ($idCible === $uid && $role !== 'admin') err('Vous ne pouvez pas retirer vos propres droits administrateur');
    $chk = $bd->prepare('SELECT id FROM utilisateurs WHERE (email=? OR LOWER(nom)=?) AND id != ?');
    $chk->execute([$email, strtolower($nom), $idCible]);
    if ($chk->fetch()) err('Cet e-mail ou nom est déjà utilisé par un autre compte', 409);
    $mdp = $in['mot_de_passe'] ?? '';
    if ($mdp !== '') {
      if (!motDePasseValide($mdp)) err('Le mot de passe doit faire 12 caractères min. (72 octets max.)');
      $bd->prepare('UPDATE utilisateurs SET nom=?, email=?, role=?, mot_de_passe=? WHERE id=?')
         ->execute([$nom, $email, $role, hacherMotDePasse($mdp), $idCible]);
      if ($idCible === $uid) {
        $bd->prepare('DELETE FROM sessions WHERE utilisateur_id=? AND jeton<>?')->execute([$idCible, $_SERVER['HTTP_X_TOKEN'] ?? '']);
      } else {
        $bd->prepare('DELETE FROM sessions WHERE utilisateur_id=?')->execute([$idCible]);
      }
      journal($bd, $uid, 'admin_modif_mdp_user', "id=$idCible");
    } else {
      $bd->prepare('UPDATE utilisateurs SET nom=?, email=?, role=? WHERE id=?')
         ->execute([$nom, $email, $role, $idCible]);
    }
    journal($bd, $uid, 'admin_modif_user', "id=$idCible, nom=$nom, role=$role");
    rep(['ok' => true]);
  case 'user_actif':
    if ((int)$in['id'] === $uid) err('Action impossible sur votre propre compte');
    $bd->prepare('UPDATE utilisateurs SET actif=? WHERE id=?')->execute([(int)!!$in['actif'], (int)$in['id']]);
    if (!$in['actif']) $bd->prepare('DELETE FROM sessions WHERE utilisateur_id=?')->execute([(int)$in['id']]);
    journal($bd, $uid, 'utilisateur_actif', $in['id'] . '=' . (int)$in['actif']); rep(['ok' => true]);
  case 'user_suppr':
    if ((int)$in['id'] === $uid) err('Action impossible sur votre propre compte');
    $bd->prepare('DELETE FROM utilisateurs WHERE id=?')->execute([(int)$in['id']]); journal($bd, $uid, 'utilisateur_supprime', (string)$in['id']); rep(['ok' => true]);
  case 'admin_diagrammes':
    $req = $bd->query('SELECT d.id, d.utilisateur_id, d.titre, d.type, d.cree_le, d.modifie_le, d.supprime_le,
                              u.nom AS auteur_nom, u.email AS auteur_email
                       FROM diagrammes d
                       JOIN utilisateurs u ON u.id = d.utilisateur_id
                       ORDER BY d.modifie_le DESC');
    rep(['diagrammes' => $req->fetchAll()]);
  case 'admin_diag_suppr':
    $idD = (int)($in['id'] ?? 0);
    if (!$idD) err('Identifiant manquant');
    $bd->prepare('DELETE FROM diagrammes WHERE id=?')->execute([$idD]);
    journal($bd, $uid, 'admin_suppr_diag', (string)$idD);
    rep(['ok' => true]);
  case 'messages':
    rep(['messages' => $bd->query('SELECT id,nom,email,sujet,message,lu,cree_le FROM messages ORDER BY cree_le DESC')->fetchAll()]);
  case 'message_lu':
    $etat = isset($in['lu']) ? (int)!!$in['lu'] : 1;
    $bd->prepare('UPDATE messages SET lu=? WHERE id=?')->execute([$etat, (int)($in['id'] ?? 0)]);
    rep(['ok' => true]);
  case 'message_suppr':
    $bd->prepare('DELETE FROM messages WHERE id=?')->execute([(int)($in['id'] ?? 0)]);
    journal($bd, $uid, 'message_supprime', (string)($in['id'] ?? ''));
    rep(['ok' => true]);
  case 'admin_journal':
    $req = $bd->query('SELECT j.id, j.action, j.details, j.cree_le, u.nom AS utilisateur_nom, u.email AS utilisateur_email
                       FROM journal j
                       LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
                       ORDER BY j.cree_le DESC LIMIT 100');
    rep(['journal' => $req->fetchAll()]);
}
err('Action inconnue', 404);
