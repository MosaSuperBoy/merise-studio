<?php
// API de sauvegarde serveur : ?a=list | ?a=save (POST JSON) | ?a=get&id=...
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__ . '/sauvegardes';
if (!is_dir($dir)) mkdir($dir, 0755, true);
$a = $_GET['a'] ?? 'list';
function nettoyer($s) { return preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$s); } // évite les chemins dangereux
if ($a === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $raw = file_get_contents('php://input');
  $d = json_decode($raw, true);
  if (strlen($raw) > 5000000 || !$d || empty($d['id']) || !isset($d['tabs'])) { http_response_code(400); exit(json_encode(['erreur' => 'projet invalide'])); }
  file_put_contents("$dir/" . nettoyer($d['id']) . '.json', $raw, LOCK_EX);
  echo json_encode(['ok' => 1]);
} elseif ($a === 'get') {
  $f = "$dir/" . nettoyer($_GET['id'] ?? '') . '.json';
  if (!is_file($f)) { http_response_code(404); exit(json_encode(['erreur' => 'introuvable'])); }
  readfile($f);
} else {
  $l = [];
  foreach (glob("$dir/*.json") as $f) { $d = json_decode(file_get_contents($f), true); if ($d) $l[] = ['id' => $d['id'], 'nom' => $d['nom'] ?? '?', 'maj' => $d['maj'] ?? 0]; }
  usort($l, fn($x, $y) => $y['maj'] <=> $x['maj']);
  echo json_encode($l);
}
