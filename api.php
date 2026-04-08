<?php
/**
 * api.php — Entry point, routes to action handlers
 */

session_set_cookie_params(['path' => '/']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/includes/helpers.php';
require_once __DIR__ . '/includes/actions/auth.php';
require_once __DIR__ . '/includes/actions/data_read.php';
require_once __DIR__ . '/includes/actions/data_write.php';
require_once __DIR__ . '/includes/actions/users.php';
require_once __DIR__ . '/includes/actions/notes.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Parse JSON body for POST/PUT
$body = [];
if ($method === 'POST' || $method === 'PUT') {
    $raw  = file_get_contents('php://input');
    if ($raw) $body = json_decode($raw, true) ?? [];
}

switch ($action) {
    // Auth
    case 'login':   action_login($body); break;
    case 'logout':  action_logout();     break;
    case 'whoami':  action_whoami();     break;

    // Data read
    case 'get_years':     action_get_years();          break;
    case 'get_month':     action_get_month($_GET);     break;
    case 'get_year_meta': action_get_year_meta($_GET); break;
    case 'get_log':       action_get_log($_GET);       break;
    case 'log_csv':       $_GET['csv'] = 1; action_get_log($_GET); break;

    // Data write
    case 'set_cell':         action_set_cell($body);         break;
    case 'set_cells_bulk':  action_set_cells_bulk($body);  break;
    case 'add_customer':     action_add_customer($body);     break;
    case 'rename_customer':  action_rename_customer($body);  break;
    case 'delete_customer':  action_delete_customer($body);  break;
    case 'add_job':          action_add_job($body);          break;
    case 'rename_job':       action_rename_job($body);       break;
    case 'delete_job':       action_delete_job($body);       break;
    case 'create_year':      action_create_year($body);      break;

    // Users
    case 'get_users':    action_get_users();        break;
    case 'add_user':     action_add_user($body);    break;
    case 'update_user':  action_update_user($body); break;
    case 'delete_user':  action_delete_user($body); break;

    // Notes (new feature)
    case 'get_notes': action_get_notes($_GET);  break;
    case 'set_note':  action_set_note($body);   break;

    default: err('Unbekannte Aktion', 404);
}
