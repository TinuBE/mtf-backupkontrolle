<?php
/**
 * includes/actions/auth.php — Login, logout, whoami
 */

function action_login($body) {
    $u = trim($body['username'] ?? '');
    $p = $body['password'] ?? '';
    if (!$u || !$p) err('Benutzername und Passwort erforderlich');
    $users = read_json(USERS_FILE) ?? [];
    foreach ($users as $user) {
        if ($user['username'] === $u && $user['password_hash'] === pw_hash($p) && $user['active']) {
            $_SESSION['bk_user'] = [
                'id'           => $user['id'],
                'username'     => $user['username'],
                'display_name' => $user['display_name'],
                'role'         => $user['role'],
            ];
            ok(['user' => $_SESSION['bk_user']]);
        }
    }
    sleep(1);
    err('Ungültige Zugangsdaten', 401);
}

function action_logout() {
    session_destroy();
    ok();
}

function action_whoami() {
    if (empty($_SESSION['bk_user'])) send(['ok'=>false,'logged_in'=>false]);
    ok(['logged_in'=>true, 'user'=>$_SESSION['bk_user']]);
}
