<?php
/**
 * includes/helpers.php — Shared API utilities
 */

define('DATA_DIR',       __DIR__ . '/../data/');
define('YEARS_FILE',     DATA_DIR . 'years.json');
define('USERS_FILE',     DATA_DIR . 'users.json');
define('CHANGELOG_FILE', DATA_DIR . 'changelog.json');
define('NOTES_FILE',     DATA_DIR . 'notes.json');
define('MAX_LOG_ENTRIES', 2000);

function pw_hash($pw)     { return hash('sha256', $pw); }
function read_json($f)    { return file_exists($f) ? json_decode(file_get_contents($f), true) : null; }
function write_json($f,$d){ return file_put_contents($f, json_encode($d, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)) !== false; }
function year_file($y)    { return DATA_DIR . "backup_{$y}.json"; }

function send($data, $code=200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function err($msg, $code=400)   { send(['ok'=>false,'error'=>$msg], $code); }
function ok($data=[])           { send(array_merge(['ok'=>true], $data)); }

function require_auth($min_role='viewer') {
    if (empty($_SESSION['bk_user'])) err('Nicht angemeldet', 401);
    $levels = ['viewer'=>1,'editor'=>2,'admin'=>3];
    $cur = $levels[$_SESSION['bk_user']['role']] ?? 0;
    $req = $levels[$min_role] ?? 1;
    if ($cur < $req) err('Keine Berechtigung', 403);
    return $_SESSION['bk_user'];
}

function sort_customers(&$customers) {
    usort($customers, fn($a,$b) => strnatcasecmp($a['name'], $b['name']));
    foreach ($customers as &$c) {
        usort($c['jobs'], fn($a,$b) => strnatcasecmp($a['name'], $b['name']));
    }
}

function is_past_period($year, $month_key=null) {
    $cur_year  = (int)date('Y');
    $cur_month = (int)date('n');
    if ($year < $cur_year) return true;
    if ($year > $cur_year) return false;
    if ($month_key !== null) {
        $month_names = ['Januar'=>1,'Februar'=>2,'März'=>3,'April'=>4,'Mai'=>5,'Juni'=>6,
                        'Juli'=>7,'August'=>8,'September'=>9,'Oktober'=>10,'November'=>11,'Dezember'=>12];
        $mname = explode(' ', $month_key)[0];
        $mnum  = $month_names[$mname] ?? 0;
        return $mnum < $cur_month;
    }
    return false;
}

/**
 * Append one entry to the persistent changelog.
 *
 * @param array  $user     Session user array (id, display_name, role, username)
 * @param string $action   Machine-readable action type (set_cell, add_customer, …)
 * @param array  $context  Associative array with relevant fields (cust, job, date, old, new, …)
 */
function append_log($user, $action, $context = []) {
    $log = read_json(CHANGELOG_FILE) ?? [];
    array_unshift($log, array_merge([
        'ts'       => date('c'),
        'who'      => $user['display_name'],
        'uid'      => $user['id'],
        'username' => $user['username'] ?? '',
        'role'     => $user['role']     ?? '',
        'action'   => $action,
        'ip'       => $_SERVER['REMOTE_ADDR'] ?? '',
    ], $context));
    if (count($log) > MAX_LOG_ENTRIES) $log = array_slice($log, 0, MAX_LOG_ENTRIES);
    write_json(CHANGELOG_FILE, $log);
}

/** Backwards-compat shim used by set_cell (old 6-arg signature → new) */
function append_cell_log($user, $cust, $job, $date, $old_val, $new_val) {
    append_log($user, 'set_cell', [
        'cust' => $cust,
        'job'  => $job,
        'date' => $date,
        'old'  => $old_val,
        'new'  => $new_val,
    ]);
}
