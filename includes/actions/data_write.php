<?php
/**
 * includes/actions/data_write.php — set_cell, add/rename/delete customer & job, create_year
 * Every mutation is recorded in the changelog with action type + full context.
 */

function action_set_cell($body) {
    $user  = require_auth('editor');
    $year  = (int)($body['year'] ?? 0);
    $month = $body['month'] ?? '';
    $cname = $body['customer'] ?? '';
    $jname = $body['job'] ?? '';
    $d     = $body['date'] ?? '';
    $val   = $body['value'] ?? null;
    if (!$year || !$month || !$cname || !$jname || !$d) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year, $month))
        err('Vergangene Zeiträume dürfen nur von Admins bearbeitet werden', 403);
    $data = read_json(year_file($year));
    if (!$data) err('Jahresdaten nicht gefunden');
    $found = false; $old_val = null;
    foreach ($data['months'][$month]['customers'] as &$cust) {
        if ($cust['name'] === $cname) {
            foreach ($cust['jobs'] as &$job) {
                if ($job['name'] === $jname) {
                    $old_val = $job['status'][$d] ?? null;
                    if ($val === null || $val === '') unset($job['status'][$d]);
                    else $job['status'][$d] = $val;
                    $found = true; break;
                }
            }
            break;
        }
    }
    if (!$found) err('Eintrag nicht gefunden');
    write_json(year_file($year), $data);
    append_log($user, 'set_cell', [
        'year' => $year, 'month' => $month,
        'cust' => $cname, 'job'  => $jname,
        'date' => $d, 'old' => $old_val, 'new' => $val,
    ]);
    ok(['old' => $old_val]);
}

function action_add_customer($body) {
    $user = require_auth('editor');
    $year = (int)($body['year'] ?? 0);
    $name = trim($body['name'] ?? '');
    if (!$year || !$name) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year))
        err('Vergangene Jahre dürfen nur von Admins bearbeitet werden', 403);
    $data = read_json(year_file($year));
    if (!$data) err('Jahresdaten nicht gefunden');
    foreach ($data['months'] as &$mdata) {
        $exists = array_filter($mdata['customers'], fn($c) => $c['name'] === $name);
        if (!$exists) { $mdata['customers'][] = ['name'=>$name,'jobs'=>[]]; sort_customers($mdata['customers']); }
    }
    write_json(year_file($year), $data);
    append_log($user, 'add_customer', ['year'=>$year, 'cust'=>$name]);
    ok();
}

function action_rename_customer($body) {
    $user = require_auth('editor');
    $year = (int)($body['year'] ?? 0);
    $old  = trim($body['old_name'] ?? '');
    $new  = trim($body['new_name'] ?? '');
    if (!$year || !$old || !$new) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year))
        err('Vergangene Jahre dürfen nur von Admins bearbeitet werden', 403);
    $data = read_json(year_file($year));
    if (!$data) err('Nicht gefunden');
    foreach ($data['months'] as &$mdata) {
        foreach ($mdata['customers'] as &$c) { if ($c['name'] === $old) $c['name'] = $new; }
        sort_customers($mdata['customers']);
    }
    write_json(year_file($year), $data);
    append_log($user, 'rename_customer', ['year'=>$year, 'old'=>$old, 'new'=>$new]);
    ok();
}

function action_delete_customer($body) {
    $user = require_auth('admin');
    $year = (int)($body['year'] ?? 0);
    $name = trim($body['name'] ?? '');
    if (!$year || !$name) err('Parameter fehlen');
    $data = read_json(year_file($year));
    if (!$data) err('Nicht gefunden');
    $job_count = 0;
    foreach ($data['months'] as &$mdata) {
        foreach ($mdata['customers'] as $c) {
            if ($c['name'] === $name) $job_count = count($c['jobs']);
        }
        $mdata['customers'] = array_values(array_filter($mdata['customers'], fn($c) => $c['name'] !== $name));
    }
    write_json(year_file($year), $data);
    append_log($user, 'delete_customer', ['year'=>$year, 'cust'=>$name, 'jobs_removed'=>$job_count]);
    ok();
}

function action_add_job($body) {
    $user  = require_auth('editor');
    $year  = (int)($body['year'] ?? 0);
    $cname = trim($body['customer'] ?? '');
    $jname = trim($body['job'] ?? '');
    if (!$year || !$cname || !$jname) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year))
        err('Vergangene Jahre dürfen nur von Admins bearbeitet werden', 403);
    $data = read_json(year_file($year));
    if (!$data) err('Nicht gefunden');
    foreach ($data['months'] as &$mdata) {
        foreach ($mdata['customers'] as &$cust) {
            if ($cust['name'] === $cname) {
                $exists = array_filter($cust['jobs'], fn($j) => $j['name'] === $jname);
                if (!$exists) {
                    $cust['jobs'][] = ['name'=>$jname,'status'=>[]];
                    usort($cust['jobs'], fn($a,$b) => strnatcasecmp($a['name'],$b['name']));
                }
            }
        }
    }
    write_json(year_file($year), $data);
    append_log($user, 'add_job', ['year'=>$year, 'cust'=>$cname, 'job'=>$jname]);
    ok();
}

function action_rename_job($body) {
    $user  = require_auth('editor');
    $year  = (int)($body['year'] ?? 0);
    $cname = trim($body['customer'] ?? '');
    $old   = trim($body['old_name'] ?? '');
    $new   = trim($body['new_name'] ?? '');
    if (!$year || !$cname || !$old || !$new) err('Parameter fehlen');
    if ($user['role'] !== 'admin' && is_past_period($year))
        err('Vergangene Jahre dürfen nur von Admins bearbeitet werden', 403);
    $data = read_json(year_file($year));
    if (!$data) err('Nicht gefunden');
    foreach ($data['months'] as &$mdata) {
        foreach ($mdata['customers'] as &$cust) {
            if ($cust['name'] === $cname) {
                foreach ($cust['jobs'] as &$job) { if ($job['name'] === $old) $job['name'] = $new; }
                usort($cust['jobs'], fn($a,$b) => strnatcasecmp($a['name'],$b['name']));
            }
        }
    }
    write_json(year_file($year), $data);
    append_log($user, 'rename_job', ['year'=>$year, 'cust'=>$cname, 'old'=>$old, 'new'=>$new]);
    ok();
}

function action_delete_job($body) {
    $user  = require_auth('admin');
    $year  = (int)($body['year'] ?? 0);
    $cname = trim($body['customer'] ?? '');
    $jname = trim($body['job'] ?? '');
    if (!$year || !$cname || !$jname) err('Parameter fehlen');
    $data = read_json(year_file($year));
    if (!$data) err('Nicht gefunden');
    foreach ($data['months'] as &$mdata) {
        foreach ($mdata['customers'] as &$cust) {
            if ($cust['name'] === $cname) {
                $cust['jobs'] = array_values(array_filter($cust['jobs'], fn($j) => $j['name'] !== $jname));
            }
        }
    }
    write_json(year_file($year), $data);
    append_log($user, 'delete_job', ['year'=>$year, 'cust'=>$cname, 'job'=>$jname]);
    ok();
}

function action_create_year($body) {
    $user      = require_auth('admin');
    $year      = (int)($body['year'] ?? 0);
    $copy_from = (int)($body['copy_from'] ?? 0);
    if ($year < 2020 || $year > 2099) err('Ungültiges Jahr');
    if (file_exists(year_file($year))) err('Jahr existiert bereits');

    $month_names        = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    $new_data           = ['year'=>$year,'months'=>[]];
    $template_customers = [];

    if ($copy_from && file_exists(year_file($copy_from))) {
        $tdata       = read_json(year_file($copy_from));
        $first_month = reset($tdata['months']);
        foreach ($first_month['customers'] as $c) {
            $template_customers[] = [
                'name' => $c['name'],
                'jobs' => array_map(fn($j) => ['name'=>$j['name'],'status'=>[]], $c['jobs']),
            ];
        }
    }

    for ($mi = 1; $mi <= 12; $mi++) {
        $mname     = $month_names[$mi-1];
        $month_key = "{$mname} {$year}";
        $days      = cal_days_in_month(CAL_GREGORIAN, $mi, $year);
        $dates     = [];
        for ($d = 1; $d <= $days; $d++) $dates[] = sprintf('%04d-%02d-%02d', $year, $mi, $d);
        $new_data['months'][$month_key] = ['dates'=>$dates,'customers'=>$template_customers];
    }

    write_json(year_file($year), $new_data);
    $yi = read_json(YEARS_FILE) ?? ['years'=>[]];
    if (!in_array($year, $yi['years'])) { $yi['years'][] = $year; sort($yi['years']); }
    write_json(YEARS_FILE, $yi);
    append_log($user, 'create_year', [
        'year'      => $year,
        'copy_from' => $copy_from ?: null,
        'customers' => count($template_customers),
    ]);
    ok(['year' => $year]);
}

/**
 * set_cells_bulk — Set the same value on multiple cells in one request.
 * Body: { year, month, value, cells: [{customer, job, date}, …] }
 */
function action_set_cells_bulk($body) {
    $user  = require_auth('editor');
    $year  = (int)($body['year'] ?? 0);
    $month = $body['month'] ?? '';
    $val   = $body['value'] ?? null;           // null = clear
    $cells = $body['cells'] ?? [];

    if (!$year || !$month) err('Parameter fehlen');
    if (empty($cells) || !is_array($cells)) err('Keine Zellen übergeben');
    if ($user['role'] !== 'admin' && is_past_period($year, $month))
        err('Vergangene Zeiträume dürfen nur von Admins bearbeitet werden', 403);

    $data = read_json(year_file($year));
    if (!$data) err('Jahresdaten nicht gefunden');

    // Build lookup index for fast access: cust_name → job_name → &job
    $idx = [];
    foreach ($data['months'][$month]['customers'] as &$cust) {
        foreach ($cust['jobs'] as &$job) {
            $idx[$cust['name']][$job['name']] = &$job;
        }
    }

    $updated  = 0;
    $log_rows = [];

    foreach ($cells as $cell) {
        $cname = $cell['customer'] ?? '';
        $jname = $cell['job']      ?? '';
        $d     = $cell['date']     ?? '';
        if (!$cname || !$jname || !$d) continue;
        if (!isset($idx[$cname][$jname])) continue;

        $job     = &$idx[$cname][$jname];
        $old_val = $job['status'][$d] ?? null;

        if ($val === null || $val === '') {
            unset($job['status'][$d]);
        } else {
            $job['status'][$d] = $val;
        }

        $log_rows[] = ['cust'=>$cname,'job'=>$jname,'date'=>$d,'old'=>$old_val,'new'=>$val];
        $updated++;
    }

    if (!$updated) ok(['updated' => 0]);

    write_json(year_file($year), $data);

    // One log entry per cell (keeps individual traceability)
    foreach ($log_rows as $row) {
        append_log($user, 'set_cell', array_merge(['year'=>$year,'month'=>$month], $row));
    }

    ok(['updated' => $updated]);
}
