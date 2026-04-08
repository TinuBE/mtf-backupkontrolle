<?php
/**
 * debug.php — Temporäre Diagnosedatei. NACH GEBRAUCH LÖSCHEN!
 * Aufruf: https://yourserver/.../debug.php
 */
session_set_cookie_params(['path' => '/']);
session_start();
header('Content-Type: text/plain; charset=utf-8');

echo "=== PHP ===\n";
echo "Version: " . PHP_VERSION . "\n";
echo "Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? '?') . "\n\n";

echo "=== Pfade ===\n";
echo "__FILE__  : " . __FILE__ . "\n";
echo "__DIR__   : " . __DIR__ . "\n";

// Where api.php thinks data/ is
$apiDir      = __DIR__;
$includesDir = $apiDir . '/includes';
$dataDir     = $apiDir . '/data/';
echo "data/ (via api.php): " . $dataDir . "\n\n";

echo "=== Dateien ===\n";
$files = ['changelog.json','users.json','years.json','notes.json'];
foreach ($files as $f) {
    $path = $dataDir . $f;
    $exists = file_exists($path);
    echo ($exists ? "✓" : "✗") . " " . $path . "\n";
    if ($exists) {
        $size = filesize($path);
        $data = json_decode(file_get_contents($path), true);
        echo "  size=" . $size . "b, json_valid=" . ($data!==null?'YES':'NO');
        if (is_array($data)) echo ", entries=" . count($data);
        echo "\n";
    }
}

// Search for changelog.json anywhere under parent dirs
echo "\n=== Suche changelog.json ===\n";
$search_dirs = [
    __DIR__,
    dirname(__DIR__),
    __DIR__ . '/data',
    __DIR__ . '/backend',
    __DIR__ . '/backend/data',
    dirname(__DIR__) . '/data',
];
foreach ($search_dirs as $d) {
    $p = $d . '/changelog.json';
    if (file_exists($p)) {
        echo "FOUND: $p\n";
        $data = json_decode(file_get_contents($p), true);
        echo "  entries: " . (is_array($data) ? count($data) : 'invalid') . "\n";
    }
}

echo "\n=== Session ===\n";
echo "bk_user: " . json_encode($_SESSION['bk_user'] ?? null) . "\n";

echo "\n=== get_log Test ===\n";
if (file_exists($dataDir . 'changelog.json') && file_exists(__DIR__ . '/includes/helpers.php')) {
    require_once __DIR__ . '/includes/helpers.php';
    $log = read_json(CHANGELOG_FILE) ?? [];
    echo "CHANGELOG_FILE: " . CHANGELOG_FILE . "\n";
    echo "Einträge im Log: " . count($log) . "\n";
    if ($log) {
        echo "Letzter Eintrag (ts): " . ($log[0]['ts'] ?? '?') . "\n";
        echo "action: " . ($log[0]['action'] ?? 'KEIN ACTION-FELD') . "\n";
    }
} else {
    echo "helpers.php oder changelog.json nicht gefunden\n";
    echo "helpers.php: " . (__DIR__ . '/includes/helpers.php') . "\n";
    echo "exists: " . (file_exists(__DIR__ . '/includes/helpers.php') ? 'YES' : 'NO') . "\n";
}
