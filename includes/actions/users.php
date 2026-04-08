<?php
/**
 * includes/actions/users.php — User CRUD, all mutations logged
 */

function action_get_users() {
    require_auth('admin');
    $users = read_json(USERS_FILE) ?? [];
    $safe  = array_map(fn($u) => array_diff_key($u, ['password_hash'=>1]), $users);
    ok(['users' => array_values($safe)]);
}

function action_add_user($body) {
    $actor = require_auth('admin');
    $uname = trim($body['username'] ?? '');
    $pw    = $body['password'] ?? '';
    $dn    = trim($body['display_name'] ?? $uname);
    $role  = $body['role'] ?? 'viewer';
    if (!$uname || !$pw) err('Benutzername und Passwort erforderlich');
    if (!in_array($role, ['viewer','editor','admin'])) err('Ungültige Rolle');
    $users = read_json(USERS_FILE) ?? [];
    foreach ($users as $u) { if ($u['username'] === $uname) err('Benutzername bereits vergeben'); }
    $max_id  = max(array_column($users, 'id') ?: [0]);
    $new_id  = $max_id + 1;
    $users[] = ['id'=>$new_id,'username'=>$uname,'password_hash'=>pw_hash($pw),'display_name'=>$dn,'role'=>$role,'active'=>true];
    write_json(USERS_FILE, $users);
    append_log($actor, 'add_user', ['target_username'=>$uname, 'target_role'=>$role, 'target_dn'=>$dn]);
    ok();
}

function action_update_user($body) {
    $actor = require_auth('admin');
    $id    = (int)($body['id'] ?? 0);
    if (!$id) err('ID fehlt');
    $users = read_json(USERS_FILE) ?? [];
    foreach ($users as &$u) {
        if ($u['id'] === $id) {
            $changes = [];
            if (isset($body['display_name']) && $body['display_name'] !== $u['display_name']) {
                $changes['display_name'] = ['old'=>$u['display_name'], 'new'=>trim($body['display_name'])];
                $u['display_name'] = trim($body['display_name']);
            }
            if (isset($body['role']) && in_array($body['role'],['viewer','editor','admin']) && $body['role'] !== $u['role']) {
                $changes['role'] = ['old'=>$u['role'], 'new'=>$body['role']];
                $u['role'] = $body['role'];
            }
            if (isset($body['active']) && (bool)$body['active'] !== $u['active']) {
                $changes['active'] = ['old'=>$u['active'], 'new'=>(bool)$body['active']];
                $u['active'] = (bool)$body['active'];
            }
            if (!empty($body['password'])) {
                $u['password_hash'] = pw_hash($body['password']);
                $changes['password'] = '(geändert)';
            }
            write_json(USERS_FILE, $users);
            append_log($actor, 'update_user', ['target_id'=>$id, 'target_username'=>$u['username'], 'changes'=>$changes]);
            ok();
        }
    }
    err('Benutzer nicht gefunden');
}

function action_delete_user($body) {
    $actor = require_auth('admin');
    $id    = (int)($body['id'] ?? 0);
    $cur   = $_SESSION['bk_user']['id'];
    if ($id === $cur) err('Eigener Account kann nicht gelöscht werden');
    $users    = read_json(USERS_FILE) ?? [];
    $target   = null;
    foreach ($users as $u) { if ($u['id'] === $id) { $target = $u; break; } }
    if (!$target) err('Benutzer nicht gefunden');
    $users = array_values(array_filter($users, fn($u) => $u['id'] !== $id));
    write_json(USERS_FILE, $users);
    append_log($actor, 'delete_user', ['target_id'=>$id, 'target_username'=>$target['username'], 'target_role'=>$target['role']]);
    ok();
}
