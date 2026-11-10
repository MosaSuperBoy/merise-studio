<?php
// Copy config.local.example.php to config.local.php and set the hosting database credentials.
$configLocale = __DIR__ . '/config.local.php';
if (is_file($configLocale)) {
  require $configLocale;
} else {
  $hoteRequete = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
  if (PHP_SAPI !== 'cli' && !in_array($hoteRequete, ['localhost', '127.0.0.1'], true)) {
    // Réponse JSON claire (au lieu d'une erreur 500 vide) quand le fichier privé a disparu après une mise à jour
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['erreur' => 'Fichier api/config.local.php introuvable : recréez-le sur le serveur à partir de api/config.local.example.php avec les accès MySQL de votre hébergeur.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  // Local WAMP defaults only; public hosts must provide a private config file.
  define('DB_HOTE', 'localhost');
  define('DB_NOM', 'merise_studio');
  define('DB_UTILISATEUR', 'root');
  define('DB_MOT_DE_PASSE', '');
  define('SESSION_JOURS', 30);
}
// Valeur par défaut si un ancien config.local.php ne définit pas la durée des sessions
if (!defined('SESSION_JOURS')) define('SESSION_JOURS', 30);
