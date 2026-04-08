/**
 * api.js — Shared API helpers & toast notification
 */

const API = window.API_URL || 'api.php';

/** POST JSON to api.php */
async function api(action, params = {}, method = 'POST') {
  const url = `${API}?action=${action}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (method !== 'GET') opts.body = JSON.stringify(params);
  try {
    const r = await fetch(url, opts);
    return await r.json();
  } catch (e) {
    return { ok: false, error: 'Verbindungsfehler' };
  }
}

/** GET from api.php */
async function GET(action, qs = '') {
  try {
    const r = await fetch(`${API}?action=${action}${qs}`);
    return await r.json();
  } catch (e) {
    return { ok: false, error: 'Verbindungsfehler' };
  }
}

/** Toast notification */
function toast(msg, type = 'ok', dur = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, dur);
}

/** HTML escape */
function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** HTML entity escape only (for content) */
function h(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
