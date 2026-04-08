<?php
/**
 * includes/actions/notes.php — Persistent cell notes, mutations logged
 */

function action_get_notes($get) {
    require_auth('viewer');
    $year  = (int)($get['year'] ?? 0);
    $month = $get['month'] ?? '';
    if (!$year || !$month) err('Parameter fehlen');
    $all    = read_json(NOTES_FILE) ?? [];
    $prefix = "{$year}|{$month}|";
    $result = [];
    foreach ($all as $k => $v) {
        if (strpos($k, $prefix) === 0) $result[$k] = $v;
    }
    ok(['notes' => $result]);
}

function action_set_note($body) {
    $user  = require_auth('editor');
    $year  = (int)($body['year'] ?? 0);
    $month = $body['month']    ?? '';
    $cust  = $body['customer'] ?? '';
    $job   = $body['job']      ?? '';
    $date  = $body['date']     ?? '';
    $note  = $body['note']     ?? null;
    if (!$year || !$month || !$cust || !$job || !$date) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year, $month))
        err('Vergangene Zeiträume dürfen nur von Admins bearbeitet werden', 403);
    $key  = "{$year}|{$month}|{$cust}|{$job}|{$date}";
    $all  = read_json(NOTES_FILE) ?? [];
    $old  = $all[$key] ?? null;
    if ($note === null || $note === '') {
        unset($all[$key]);
        $action = 'delete_note';
    } else {
        $all[$key] = trim($note);
        $action = $old === null ? 'add_note' : 'edit_note';
    }
    write_json(NOTES_FILE, $all);
    append_log($user, $action, [
        'year'  => $year, 'month' => $month,
        'cust'  => $cust, 'job'   => $job, 'date' => $date,
        'old'   => $old,  'new'   => ($note ?: null),
    ]);
    ok();
}
