<?php
// Copy config.local.example.php to config.local.php and set the hosting database credentials.
$configLocale = __DIR__ . '/config.local.php';
if (is_file($configLocale)) {
  require $configLocale;
} else {
  $hoteRequete = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
  if (PHP_SAPI !== 'cli' && !in_array($hoteRequete, ['localhost', '127.0.0.1'], true)) {
    throw new RuntimeException('Configure api/config.local.php avec les paramètres MySQL de votre hébergeur.');
  }
  // Local WAMP defaults only; public hosts must provide a private config file.
  define('DB_HOTE', 'localhost');
  define('DB_NOM', 'merise_studio');
  define('DB_UTILISATEUR', 'root');
  define('DB_MOT_DE_PASSE', '');
  define('SESSION_JOURS', 30);
}
