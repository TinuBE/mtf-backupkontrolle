<?php
/**
 * includes/actions/data_read.php — get_years, get_month, get_year_meta, get_log
 */

function action_get_years() {
    $yi = read_json(YEARS_FILE) ?? ['years'=>[]];
    ok(['years' => $yi['years']]);
}

function action_get_month($get) {
    $year  = (int)($get['year'] ?? 0);
    $month = $get['month'] ?? '';
    if (!$year || !$month) err('Jahr und Monat erforderlich');
    $data  = read_json(year_file($year));
    if (!$data) err('Jahresdaten nicht gefunden');
    $mdata = $data['months'][$month] ?? null;
    if (!$mdata) err('Monat nicht gefunden');
    ok(['month'=>$month, 'year'=>$year, 'data'=>$mdata]);
}

function action_get_year_meta($get) {
    $year = (int)($get['year'] ?? 0);
    if (!$year) err('Jahr erforderlich');
    $data = read_json(year_file($year));
    if (!$data) err('Jahresdaten nicht gefunden');
    $months_meta = [];
    foreach ($data['months'] as $mname => $mdata) {
        $ok = $warn = $error = $cloud = $total = 0;
        foreach ($mdata['customers'] as $c) {
            foreach ($c['jobs'] as $job) {
                foreach ($job['status'] as $v) {
                    if ($v === 'MTF CLOUD')                          $cloud++;
                    elseif ($v == 1)                                 $ok++;
                    elseif ($v == 2 || $v == 3)                     $warn++;
                    elseif (is_numeric($v) && $v >= 4 && $v <= 6)   $error++;
                    $total++;
                }
            }
        }
        $months_meta[$mname] = [
            'customers' => count($mdata['customers']),
            'ok'        => $ok,
            'warn'      => $warn,
            'error'     => $error,
            'cloud'     => $cloud,
            'total'     => $total,
        ];
    }
    $first = reset($data['months']);
    ok([
        'year'           => $year,
        'months'         => $months_meta,
        'customer_count' => count($first['customers'] ?? []),
    ]);
}

/**
 * get_log — returns filtered, paginated changelog.
 *
 * Query params:
 *   limit    int     Max entries (default 300, max 1000)
 *   uid      int     Filter by user ID
 *   action   string  Filter by action type (set_cell | add_customer | …)
 *   q        string  Free-text search across cust/job/who/username fields
 *   from     string  ISO date lower bound (e.g. 2025-01-01)
 *   to       string  ISO date upper bound (e.g. 2025-12-31)
 *   csv      1       Return as CSV download instead of JSON
 */
function action_get_log($get) {
    require_auth('viewer');

    $limit  = min((int)($get['limit'] ?? 300), 1000);
    // uid may be a numeric id or 'name:DisplayName' for old-format entries
    $uid    = isset($get['uid']) ? (strpos($get['uid'], 'name:') === 0 ? $get['uid'] : (int)$get['uid']) : null;
    $action = isset($get['action']) ? trim($get['action'])       : '';
    $q      = isset($get['q'])      ? mb_strtolower(trim($get['q'])) : '';
    $from   = $get['from'] ?? '';
    $to     = $get['to']   ?? '';
    $csv    = !empty($get['csv']);

    $log    = read_json(CHANGELOG_FILE) ?? [];

    // ── Build user list for the filter dropdown ──────────────
    // Primary source: users.json (always complete, even with no log entries yet)
    $users_seen = [];
    $active_users = read_json(USERS_FILE) ?? [];
    foreach ($active_users as $u) {
        $users_seen[$u['id']] = [
            'id'       => $u['id'],
            'name'     => $u['display_name'],
            'username' => $u['username'],
        ];
    }
    // Secondary: scan entire log for historical/deleted users
    foreach ($log as $e) {
        $uid_e = $e['uid'] ?? 0;
        if ($uid_e && !isset($users_seen[$uid_e]) && !empty($e['who'])) {
            $users_seen[$uid_e] = [
                'id'       => $uid_e,
                'name'     => $e['who'],
                'username' => $e['username'] ?? '',
            ];
        }
        // Old-format entries without uid — collect by name with pseudo-id
        if (!$uid_e && !empty($e['who'])) {
            $pseudo = 'name:' . $e['who'];
            if (!isset($users_seen[$pseudo])) {
                $users_seen[$pseudo] = [
                    'id'       => $pseudo,
                    'name'     => $e['who'],
                    'username' => $e['username'] ?? '',
                ];
            }
        }
    }

    // ── Build who-name lookup for numeric uid filter ────────
    // Needed so old log entries (no uid field) can still be matched by display name
    $uid_to_name = [];
    foreach ($users_seen as $u) {
        if (is_int($u['id']) || ctype_digit((string)$u['id'])) {
            $uid_to_name[(int)$u['id']] = $u['name'];
        }
    }

    // ── Filter log entries ───────────────────────────────────
    $filtered = [];
    foreach ($log as $e) {
        // user filter — match by uid OR by who-name for old entries
        if ($uid !== null) {
            $uid_str = (string)$uid;
            $uid_e   = $e['uid'] ?? 0;
            $who_e   = $e['who'] ?? '';

            if (strpos($uid_str, 'name:') === 0) {
                // Pseudo-id: match by display name
                $name_filter = substr($uid_str, 5);
                if ($who_e !== $name_filter) continue;
            } else {
                // Numeric uid: match by uid field OR by who-name (for old entries without uid)
                $uid_int    = (int)$uid_str;
                $name_match = ($uid_to_name[$uid_int] ?? null);
                $matched    = ($uid_e && $uid_e == $uid_int)
                           || ($name_match && $who_e === $name_match);
                if (!$matched) continue;
            }
        }
        // action filter (handle old entries without action field)
        if ($action && ($e['action'] ?? 'set_cell') !== $action) continue;
        // date range filter (on ts field)
        if ($from && substr($e['ts'] ?? '', 0, 10) < $from) continue;
        if ($to   && substr($e['ts'] ?? '', 0, 10) > $to)   continue;
        // free-text search
        if ($q) {
            $hay = mb_strtolower(implode(' ', [
                $e['who']      ?? '',
                $e['username'] ?? '',
                $e['cust']     ?? '',
                $e['job']      ?? '',
                $e['action']   ?? '',
                (string)($e['old'] ?? ''),
                (string)($e['new'] ?? ''),
            ]));
            if (strpos($hay, $q) === false) continue;
        }
        $filtered[] = $e;
    }

    // CSV export
    if ($csv) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="backup_kontrolle_log_' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM for Excel
        fputcsv($out, ['Zeitstempel','Benutzer','Username','Rolle','IP','Aktion','Kunde','Job','Datum','Alt','Neu','Details'], ';');
        foreach (array_slice($filtered, 0, $limit) as $e) {
            fputcsv($out, [
                $e['ts']       ?? '',
                $e['who']      ?? '',
                $e['username'] ?? '',
                $e['role']     ?? '',
                $e['ip']       ?? '',
                $e['action']   ?? '',
                $e['cust']     ?? ($e['target_username'] ?? ''),
                $e['job']      ?? '',
                $e['date']     ?? '',
                is_array($e['old'] ?? null) ? json_encode($e['old']) : ($e['old'] ?? ''),
                is_array($e['new'] ?? null) ? json_encode($e['new']) : ($e['new'] ?? ''),
                // extra details for structural changes
                isset($e['changes'])      ? json_encode($e['changes'])             : '',
            ], ';');
        }
        fclose($out);
        exit;
    }

    ok([
        'log'    => array_slice($filtered, 0, $limit),
        'total'  => count($filtered),
        'users'  => array_values($users_seen),
    ]);
}
