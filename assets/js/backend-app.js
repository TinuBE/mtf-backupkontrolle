/**
 * backend-app.js — Core backend logic
 * Auth, boot, year/month nav, table render, stats, filters
 * Depends on: api.js, theme.js
 */

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni',
                   'Juli','August','September','Oktober','November','Dezember'];
const TODAY     = new Date().toISOString().slice(0, 10);
const SLABELS   = {
  1:'OK', 2:'Warnung', 3:'Warnung', 4:'Fehler', 5:'Läuft noch',
  6:'Disabled', 7:'Wochenende', 'MTF CLOUD':'MTF Cloud', '?':'Unbekannt'
};

/** Global state */
let S = {
  user: null, years: [], year: null, month: null,
  mdata: null, filter: 'all',
  isAdmin: false, isEditor: false,
  kbCell: null, yearMeta: {}, isPast: false
};

// ── LOGIN ──────────────────────────────────────────────────

document.getElementById('l-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('l-user').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('l-pass').focus();
});

async function doLogin() {
  const u   = document.getElementById('l-user').value.trim();
  const p   = document.getElementById('l-pass').value;
  const err = document.getElementById('login-err');
  err.style.display = 'none';
  const res = await api('login', { username: u, password: p });
  if (res.ok) { S.user = res.user; bootShell(); }
  else { err.textContent = res.error || 'Fehler'; err.style.display = ''; }
}

async function doLogout() {
  await api('logout');
  location.reload();
}

// ── BOOT ──────────────────────────────────────────────────

async function bootShell() {
  document.getElementById('login-wrap').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  S.isAdmin  = S.user.role === 'admin';
  S.isEditor = ['editor', 'admin'].includes(S.user.role);
  document.getElementById('hdr-user').textContent = `${S.user.display_name} (${S.user.role})`;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = S.isAdmin ? '' : 'none');
  if (!S.isEditor) document.getElementById('btn-add-cust').style.display = 'none';
  const yr = await GET('get_years');
  S.years = yr.years || [new Date().getFullYear()];
  renderYearBar();
  selectYear(S.years[S.years.length - 1]);
}

// Auto-login if session active
(async () => {
  const r = await GET('whoami');
  if (r.ok && r.logged_in) { S.user = r.user; bootShell(); }
})();

// ── YEAR BAR ──────────────────────────────────────────────

function renderYearBar() {
  document.getElementById('year-bar').innerHTML =
    S.years.map(y =>
      `<button class="year-btn${y === S.year ? ' active' : ''}" onclick="selectYear(${y})">${y}</button>`
    ).join('<div class="year-sep"></div>') +
    (S.isAdmin ? '<div class="year-sep"></div><button class="add-year-btn" onclick="openNewYear()">+ Jahr</button>' : '');
}

async function selectYear(year) {
  S.year = year; S.month = null;
  renderYearBar();
  renderMonthBar({});
  const nowM = `${MONTHS_DE[new Date().getMonth()]} ${year}`;
  await selectMonth(nowM);
}

// ── MONTH BAR ─────────────────────────────────────────────

function renderMonthBar(meta) {
  document.getElementById('month-bar').innerHTML = MONTHS_DE.map(m => {
    const key  = `${m} ${S.year}`;
    const info = meta[key] || {};
    let dot = '';
    if      (info.error > 0) dot = `<span class="m-dot" style="background:var(--error)"></span>`;
    else if (info.warn  > 0) dot = `<span class="m-dot" style="background:var(--warn)"></span>`;
    else if (info.ok    > 0) dot = `<span class="m-dot" style="background:var(--ok)"></span>`;
    return `<button class="month-tab${key === S.month ? ' active' : ''}" onclick="selectMonth('${key}')">${dot}${m}</button>`;
  }).join('');
}

async function selectMonth(month) {
  S.month = month; S.kbCell = null; clearKBHL();
  // Past-period check
  const now = new Date();
  const mIdx = MONTHS_DE.findIndex(m => month.startsWith(m));
  S.isPast = !S.isAdmin && (
    S.year < now.getFullYear() ||
    (S.year === now.getFullYear() && mIdx + 1 < now.getMonth() + 1)
  );
  const kbSt = document.getElementById('kb-status');
  kbSt.innerHTML = S.isPast
    ? '<span style="color:var(--warn)">🔒 Vergangener Zeitraum — nur Admins können bearbeiten</span>'
    : '';
  // Update month tabs
  document.querySelectorAll('.month-tab').forEach(t => {
    const mn = t.textContent.replace(/[^\w\sÄÖÜäöüß]/g, '').trim();
    t.classList.toggle('active', `${mn} ${S.year}` === month);
  });
  document.getElementById('table-wrap').innerHTML = '<div class="loading">Lade…</div>';
  const r = await GET('get_month', `&year=${S.year}&month=${encodeURIComponent(month)}`);
  if (!r.ok) {
    document.getElementById('table-wrap').innerHTML = `<div class="empty">Fehler: ${r.error}</div>`;
    return;
  }
  S.mdata = r.data;
  renderStats(r.data);
  renderTable(r.data);
  const mr = await GET('get_year_meta', `&year=${S.year}`);
  if (mr.ok) { S.yearMeta = mr.months; renderMonthBar(mr.months); renderDashboard(mr.months); }
}

// ── STATS ─────────────────────────────────────────────────

function renderStats(d) {
  let jobs = 0, ok = 0, w = 0, e = 0, c = 0;
  for (const cu of d.customers)
    for (const j of cu.jobs) {
      jobs++;
      for (const v of Object.values(j.status)) {
        if      (v === 'MTF CLOUD')   c++;
        else if (v == 1)              ok++;
        else if (v == 2 || v == 3)    w++;
        else if (v >= 4 && v <= 6)    e++;
      }
    }
  document.getElementById('st-cust').textContent = d.customers.length;
  document.getElementById('st-jobs').textContent = jobs;
  document.getElementById('st-ok').textContent   = ok;
  document.getElementById('st-warn').textContent = w;
  document.getElementById('st-err').textContent  = e;
  document.getElementById('st-cld').textContent  = c;
}

// ── DASHBOARD ─────────────────────────────────────────────

function toggleDashboard() {
  const p = document.getElementById('dashboard-panel');
  const v = p.style.display === 'none' || !p.style.display;
  p.style.display = v ? 'block' : 'none';
  document.getElementById('btn-dash').classList.toggle('active', v);
}

function renderDashboard(meta) {
  document.getElementById('dash-grid').innerHTML = MONTHS_DE.map(m => {
    const key = `${m} ${S.year}`;
    const i   = meta[key] || { ok: 0, warn: 0, error: 0, cloud: 0 };
    const tot = i.ok + i.warn + i.error + i.cloud || 1;
    const po  = Math.round(i.ok    / tot * 100);
    const pw  = Math.round(i.warn  / tot * 100);
    const pe  = Math.round(i.error / tot * 100);
    const pc  = Math.round(i.cloud / tot * 100);
    const cls = i.error > 0 ? 'has-error' : i.warn > 0 ? 'has-warn' : i.ok > 0 ? 'all-ok' : '';
    const act = key === S.month ? 'current' : '';
    return `<div class="dash-card ${cls} ${act}" onclick="selectMonth('${key}')">
      <div class="dash-month">${m}</div>
      <div class="dash-bars">
        <div class="dash-bar-ok" style="flex:${po}"></div>
        <div class="dash-bar-w"  style="flex:${pw}"></div>
        <div class="dash-bar-e"  style="flex:${pe}"></div>
        <div class="dash-bar-c"  style="flex:${pc}"></div>
      </div>
      <div class="dash-nums">
        ${i.error ? `<span style="color:var(--error)">✕${i.error}</span>` : ''}
        ${i.warn  ? `<span style="color:var(--warn)">⚡${i.warn}</span>` : ''}
        <span style="color:var(--ok)">✓${i.ok}</span>
      </div>
    </div>`;
  }).join('');
}

// ── TABLE RENDER ──────────────────────────────────────────

function renderTable(mdata) {
  const wrap = document.getElementById('table-wrap');
  if (!mdata.customers.length) { wrap.innerHTML = '<div class="empty">Keine Kunden.</div>'; return; }
  wrap.innerHTML = mdata.customers.map((c, ci) => renderCust(c, mdata.dates, ci)).join('');
  applyFilters();
  setTimeout(() => {
    const th = document.querySelector(`[data-d="${TODAY}"]`);
    if (th) th.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, 80);
}

function renderCust(cust, dates, ci) {
  let ok = 0, w = 0, e = 0;
  for (const j of cust.jobs)
    for (const v of Object.values(j.status)) {
      if (v == 1) ok++; else if (v == 2 || v == 3) w++; else if (v >= 4 && v <= 6) e++;
    }
  const cn = esc(cust.name);
  const canEdit = (S.isEditor && !S.isPast) || S.isAdmin;
  return `<div class="cust-group" data-ci="${ci}" data-cust="${cn.toLowerCase()}" data-herr="${e > 0 ? 1 : 0}" data-hwarn="${w > 0 ? 1 : 0}">
    <div class="cust-hdr" onclick="toggleGroup(this.closest('.cust-group'))">
      <div class="cust-name">${cn}</div>
      <div class="cust-meta">
        ${e ? `<span class="cm cm-error">${e} Fehler</span>` : ''}
        ${w ? `<span class="cm cm-warn">${w} Warn.</span>` : ''}
        <span class="cm cm-ok">${ok} OK</span>
        <span style="font-size:10px;color:var(--muted)">${cust.jobs.length} Jobs</span>
      </div>
      ${canEdit ? `<div class="edit-btns" onclick="event.stopPropagation()">
        <button class="eb" onclick="openEditCust('${cn}')">✎</button>
        <button class="eb" onclick="openAddJob('${cn}')">+ Job</button>
        ${S.isAdmin ? `<button class="eb danger" onclick="delCust('${cn}')">✕</button>` : ''}
      </div>` : ''}
      <span class="caret">▾</span>
    </div>
    <div class="jobs-wrap">
      <table class="jobs-tbl"><thead><tr>
        <th class="name-th">Job / Backup</th>
        ${dates.map(d => {
          const dow = new Date(d).getDay();
          const wk  = dow === 0 || dow === 6;
          const td  = d === TODAY;
          const dn  = ['So','Mo','Di','Mi','Do','Fr','Sa'][dow];
          return `<th class="dw${wk ? ' wk' : ''}${td ? ' td' : ''}" data-d="${d}">${d.slice(8)}<br>${dn}</th>`;
        }).join('')}
      </tr></thead>
      <tbody>${cust.jobs.map((j, ji) => renderJobRow(cust.name, j, dates, ci, ji)).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function renderJobRow(custName, job, dates, ci, ji) {
  const jn = esc(job.name);
  const canEdit = (S.isEditor && !S.isPast) || S.isAdmin;
  const cells = dates.map((d, di) => {
    const v   = job.status[d];
    const dow = new Date(d).getDay();
    const wk  = dow === 0 || dow === 6;
    const td  = d === TODAY;
    // Note indicator
    const noteKey = noteKeyFor(custName, job.name, d);
    const hasNote = !!NOTES[noteKey];
    let cls = '', badge = '';
    if      (v === 'MTF CLOUD') { cls = 'c-cld'; badge = `<span class="sb sb-cld" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}','MTF CLOUD')">☁</span>`; }
    else if (v == null)         { cls = wk ? 'c-wk' : ''; badge = canEdit ? `<span class="sb sb-em" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}',null)">+</span>` : ''; }
    else if (v == 7)            { cls = 'c-wk';  badge = `<span class="sb sb-7" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}',7)">WE</span>`; }
    else if (v == 1)            { cls = 'c-ok';  badge = `<span class="sb sb-ok" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}',1)">✓</span>`; }
    else if (v == 2 || v == 3)  { cls = 'c-warn'; badge = `<span class="sb sb-w" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}',${v})">${v}</span>`; }
    else if (v >= 4 && v <= 6)  { cls = 'c-err';  badge = `<span class="sb sb-e" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}',${v})">${v}</span>`; }
    else if (v === '?')         { badge = `<span class="sb sb-q" onclick="cellCtx(event,'${esc(custName)}','${jn}','${d}','?')">?</span>`; }
    else                        { badge = `<span style="font-size:9px;color:var(--muted)">${v}</span>`; }
    return `<td class="${cls}${td ? ' td-hl' : ''}${hasNote ? ' has-note' : ''}" data-ci="${ci}" data-ji="${ji}" data-di="${di}">${badge}</td>`;
  }).join('');
  return `<tr data-job="${jn.toLowerCase()}" data-ci="${ci}" data-ji="${ji}">
    <td class="name-td" title="${jn}">${jn}
      ${canEdit ? `<span class="job-edit-btns" onclick="event.stopPropagation()">
        <button class="eb" style="font-size:10px" onclick="openEditJob('${esc(custName)}','${jn}')">✎</button>
        ${S.isAdmin ? `<button class="eb danger" style="font-size:10px" onclick="delJob('${esc(custName)}','${jn}')">✕</button>` : ''}
      </span>` : ''}
    </td>${cells}</tr>`;
}

function toggleGroup(el) { el.classList.toggle('collapsed'); }

// ── FILTERS ───────────────────────────────────────────────

document.querySelectorAll('.filt-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.filt-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    S.filter = b.dataset.f;
    applyFilters();
  });
});
document.getElementById('search').addEventListener('input', applyFilters);

function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  document.querySelectorAll('.cust-group').forEach(g => {
    const cn = g.dataset.cust || '';
    const he = g.dataset.herr === '1', hw = g.dataset.hwarn === '1';
    let fp = true;
    if      (S.filter === 'error') fp = he;
    else if (S.filter === 'warn')  fp = he || hw;
    let sp = true;
    if (q) {
      const jobs = [...g.querySelectorAll('[data-job]')].map(r => r.dataset.job);
      sp = cn.includes(q) || jobs.some(j => j.includes(q));
    }
    const vis = fp && sp;
    g.classList.toggle('hidden', !vis);
    if (vis && q) {
      g.querySelectorAll('tr[data-job]').forEach(r => {
        r.style.display = r.dataset.job.includes(q) || cn.includes(q) ? '' : 'none';
      });
    } else if (vis) {
      g.querySelectorAll('tr[data-job]').forEach(r => r.style.display = '');
    }
  });
}

// ── CONTEXT MENU ──────────────────────────────────────────

let CTX = {};

function cellCtx(ev, cust, job, date, cur) {
  if (!S.isEditor) return;
  ev.stopPropagation();
  CTX = { cust, job, date, cur };
  const menu = document.getElementById('ctx-menu');
  if (S.isPast) {
    menu.innerHTML = `<div style="padding:10px 12px;font-size:11px;color:var(--warn)">🔒 Vergangener Zeitraum<br><span style="color:var(--muted);font-size:10px">Nur Admins können bearbeiten</span></div>`;
    const x = Math.min(ev.clientX, window.innerWidth - 185);
    const y = Math.min(ev.clientY, window.innerHeight - 80);
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    menu.classList.add('open');
    return;
  }
  const items = [
    { v:1,           l:'✓ OK (1)',          d:'var(--ok)'    },
    { v:2,           l:'⚡ Warnung (2)',     d:'var(--warn)'  },
    { v:3,           l:'⚡ Warnung (3)',     d:'var(--warn)'  },
    { v:4,           l:'✕ Fehler (4)',       d:'var(--error)' },
    { v:5,           l:'✕ Läuft noch (5)',   d:'var(--error)' },
    { v:6,           l:'✕ Disabled (6)',     d:'var(--error)' },
    { v:'MTF CLOUD', l:'☁ MTF Cloud',        d:'var(--cloud)' },
    { v:7,           l:'– Wochenende (7)',   d:'var(--muted)' },
    { v:'?',         l:'? Unbekannt',        d:'var(--text2)' },
  ];
  // Store values in global map keyed by index to avoid HTML-attribute quoting issues
  // (JSON.stringify("MTF CLOUD") produces '"MTF CLOUD"' which breaks onclick="setCell(...)") 
  window._ctxItems = items;
  const nk  = noteKeyFor(cust, job, date);
  const hasN = !!NOTES[nk];
  menu.innerHTML =
    '<div class="ctx-group-label">Status setzen</div>' +
    items.map((i, idx) =>
      `<button class="ctx-item" data-ctx-idx="${idx}"><span class="ci-dot" style="background:${i.d}"></span>${i.l}</button>`
    ).join('') +
    '<div class="ctx-sep"></div>' +
    `<button class="ctx-item" data-ctx-note="1"><span class="ci-dot" style="background:var(--accent)"></span>📝 Notiz${hasN ? ' <span class="note-badge"></span>' : ''}</button>` +
    '<div class="ctx-sep"></div>' +
    '<button class="ctx-item" data-ctx-del="1"><span class="ci-dot" style="background:var(--muted);opacity:.3"></span>Löschen</button>';
  // Bind clicks via event delegation on the menu element (no bubbling issues)
  menu._bound = true;
  const x = Math.min(ev.clientX, window.innerWidth - 185);
  const y = Math.min(ev.clientY, window.innerHeight - 350);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  menu.classList.add('open');
}

// Close ctx-menu on mousedown outside (mousedown fires before click,
// so the menu button handler runs first via click, then this closes on next outside click)
document.addEventListener('mousedown', ev => {
  const menu = document.getElementById('ctx-menu');
  if (menu.classList.contains('open') && !menu.contains(ev.target)) {
    menu.classList.remove('open');
  }
});

// ctx-menu click delegation — handles all menu button clicks
document.getElementById('ctx-menu').addEventListener('click', ev => {
  const btn = ev.target.closest('button[data-ctx-idx], button[data-ctx-note], button[data-ctx-del]');
  if (!btn) return;
  ev.stopPropagation();
  document.getElementById('ctx-menu').classList.remove('open');
  if (btn.dataset.ctxNote) { openNote(); return; }
  if (btn.dataset.ctxDel)  { setCellVal(null); return; }
  const idx = parseInt(btn.dataset.ctxIdx);
  if (!isNaN(idx) && window._ctxItems) setCellVal(window._ctxItems[idx].v);
});

async function setCellVal(val) {
  if (S.isPast && !S.isAdmin) { toast('Vergangener Zeitraum — nur Admins können bearbeiten', 'err'); return; }
  const res = await api('set_cell', { year: S.year, month: S.month, customer: CTX.cust, job: CTX.job, date: CTX.date, value: val });
  if (res.ok) { toast('Gespeichert', 'ok', 1500); await reloadMonth(); }
  else toast('Fehler: ' + res.error, 'err');
}

// Keep setCell as alias so keyboard handler still works
async function setCell(val) { return setCellVal(val); }

async function reloadMonth() {
  const r = await GET('get_month', `&year=${S.year}&month=${encodeURIComponent(S.month)}`);
  if (r.ok) { S.mdata = r.data; renderStats(r.data); renderTable(r.data); }
}

// ── SIDE PANEL ────────────────────────────────────────────

function openSP(title, html) {
  document.getElementById('sp-title').textContent = title;
  document.getElementById('sp-body').innerHTML    = html;
  document.getElementById('sp').classList.add('open');
  document.getElementById('sp-overlay').classList.add('open');
}
function closeSP() {
  document.getElementById('sp').classList.remove('open');
  document.getElementById('sp-overlay').classList.remove('open');
}

// ── CHANGELOG ─────────────────────────────────────────────

// Current filter state for the log panel
const LOG_FILTERS = { uid: '', action: '', q: '', from: '', to: '' };

/** Action type → human label + colour variable */
const ACTION_META = {
  set_cell:        { l: 'Status',           c: 'var(--accent)'  },
  add_customer:    { l: 'Kunde erstellt',   c: 'var(--ok)'      },
  rename_customer: { l: 'Kunde umbenannt',  c: 'var(--ok)'      },
  delete_customer: { l: 'Kunde gelöscht',   c: 'var(--error)'   },
  add_job:         { l: 'Job erstellt',     c: 'var(--ok)'      },
  rename_job:      { l: 'Job umbenannt',    c: 'var(--ok)'      },
  delete_job:      { l: 'Job gelöscht',     c: 'var(--error)'   },
  create_year:     { l: 'Jahr erstellt',    c: 'var(--cloud)'   },
  add_note:        { l: 'Notiz erstellt',   c: 'var(--accent)'  },
  edit_note:       { l: 'Notiz bearbeitet', c: 'var(--accent)'  },
  delete_note:     { l: 'Notiz gelöscht',   c: 'var(--muted)'   },
  add_user:        { l: 'Benutzer erstellt',c: 'var(--warn)'    },
  update_user:     { l: 'Benutzer geändert',c: 'var(--warn)'    },
  delete_user:     { l: 'Benutzer gelöscht',c: 'var(--error)'   },
};

function colorOf(v) {
  if (v == null)         return 'var(--muted)';
  if (v === 'MTF CLOUD') return 'var(--cloud)';
  if (v == 1)            return 'var(--ok)';
  if (v == 2 || v == 3)  return 'var(--warn)';
  if (v >= 4 && v <= 6)  return 'var(--error)';
  return 'var(--text2)';
}
function labelOf(v) {
  if (v === null || v === undefined) return '–';
  return SLABELS[v] || String(v);
}

/** Build a human-readable summary line for any action type */
function logSummary(e) {
  const act = e.action || 'set_cell';
  switch (act) {
    case 'set_cell': {
      const oc = colorOf(e.old), nc = colorOf(e.new);
      return `<strong>${h(e.cust)}</strong> / <span style="color:var(--text2)">${h(e.job)}</span>
        <span style="margin-left:4px;font-size:10px;color:var(--muted)">${e.date}</span><br>
        <span class="cl-val" style="background:color-mix(in srgb,${oc} 15%,transparent);color:${oc}">${labelOf(e.old)}</span>
        → <span class="cl-val" style="background:color-mix(in srgb,${nc} 15%,transparent);color:${nc}">${labelOf(e.new)}</span>`;
    }
    case 'add_customer':
      return `Neuer Kunde: <strong>${h(e.cust)}</strong> (Jahr ${e.year})`;
    case 'rename_customer':
      return `Kunde umbenannt: <span style="color:var(--muted)">${h(e.old)}</span> → <strong>${h(e.new)}</strong> (Jahr ${e.year})`;
    case 'delete_customer':
      return `Kunde gelöscht: <strong>${h(e.cust)}</strong> inkl. ${e.jobs_removed ?? '?'} Jobs (Jahr ${e.year})`;
    case 'add_job':
      return `Neuer Job: <strong>${h(e.job)}</strong> bei <span style="color:var(--text2)">${h(e.cust)}</span> (Jahr ${e.year})`;
    case 'rename_job':
      return `Job umbenannt: <span style="color:var(--muted)">${h(e.old)}</span> → <strong>${h(e.new)}</strong>
        bei ${h(e.cust)} (Jahr ${e.year})`;
    case 'delete_job':
      return `Job gelöscht: <strong>${h(e.job)}</strong> bei ${h(e.cust)} (Jahr ${e.year})`;
    case 'create_year':
      return `Jahr <strong>${e.year}</strong> erstellt${e.copy_from ? ` (kopiert von ${e.copy_from}, ${e.customers} Kunden)` : ' (leer)'}`;
    case 'add_note':
      return `Notiz erstellt: <strong>${h(e.cust)}</strong> / ${h(e.job)} — ${e.date}`;
    case 'edit_note':
      return `Notiz bearbeitet: <strong>${h(e.cust)}</strong> / ${h(e.job)} — ${e.date}`;
    case 'delete_note':
      return `Notiz gelöscht: <strong>${h(e.cust)}</strong> / ${h(e.job)} — ${e.date}`;
    case 'add_user':
      return `Benutzer erstellt: <strong>${h(e.target_username)}</strong> (Rolle: ${h(e.target_role)})`;
    case 'update_user': {
      if (!e.changes || !Object.keys(e.changes).length) {
        return `Benutzer aktualisiert: <strong>${h(e.target_username)}</strong>`;
      }
      const parts = Object.entries(e.changes).map(([k, v]) => {
        if (k === 'password') return 'Passwort geändert';
        if (typeof v === 'object' && v.old !== undefined)
          return `${k}: <span style="color:var(--muted)">${h(String(v.old))}</span> → <strong>${h(String(v.new))}</strong>`;
        return `${k}: ${h(String(v))}`;
      });
      return `Benutzer geändert: <strong>${h(e.target_username)}</strong> — ${parts.join(', ')}`;
    }
    case 'delete_user':
      return `Benutzer gelöscht: <strong>${h(e.target_username)}</strong> (Rolle: ${h(e.target_role ?? '')})`;
    default:
      return `<span style="color:var(--muted)">${h(act)}</span>`;
  }
}

/** Normalise a log entry — handles old entries (pre-action field) gracefully */
function normaliseEntry(e) {
  if (e.action) return e;
  return Object.assign({ action: 'set_cell', role: '', username: '', ip: '' }, e);
}

/** Render the log panel — uses DOM manipulation to avoid template-literal nesting bugs */
function renderLogEntries(r) {
  const entries = (r.log || []).map(normaliseEntry);
  const total   = r.total != null ? r.total : entries.length;
  const shown   = entries.length;

  const body = document.getElementById('sp-body');
  if (!body) return;

  // ── Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'log-toolbar';

  // Filter row
  const filterRow = document.createElement('div');
  filterRow.className = 'log-filters';

  const qInput = document.createElement('input');
  qInput.type = 'text'; qInput.className = 'log-input'; qInput.id = 'lf-q';
  qInput.placeholder = '🔍 Suche…'; qInput.value = LOG_FILTERS.q;
  qInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') applyLogFilters(); });

  const userSel = document.createElement('select');
  userSel.className = 'log-select'; userSel.id = 'lf-user';
  userSel.innerHTML = '<option value="">Alle Benutzer</option>';
  (r.users || []).sort((a, b) => a.name.localeCompare(b.name)).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id; opt.textContent = u.name;
    if (String(LOG_FILTERS.uid) === String(u.id)) opt.selected = true;
    userSel.appendChild(opt);
  });

  const actSel = document.createElement('select');
  actSel.className = 'log-select'; actSel.id = 'lf-action';
  actSel.innerHTML = '<option value="">Alle Aktionen</option>';
  Object.entries(ACTION_META).forEach(([k, v]) => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = v.l;
    if (LOG_FILTERS.action === k) opt.selected = true;
    actSel.appendChild(opt);
  });

  const fromInput = document.createElement('input');
  fromInput.type = 'date'; fromInput.className = 'log-input log-date';
  fromInput.id = 'lf-from'; fromInput.value = LOG_FILTERS.from; fromInput.title = 'Von Datum';

  const toInput = document.createElement('input');
  toInput.type = 'date'; toInput.className = 'log-input log-date';
  toInput.id = 'lf-to'; toInput.value = LOG_FILTERS.to; toInput.title = 'Bis Datum';

  const filterBtn = document.createElement('button');
  filterBtn.className = 'log-filter-btn'; filterBtn.textContent = 'Filtern';
  filterBtn.addEventListener('click', applyLogFilters);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'log-filter-btn secondary'; resetBtn.textContent = '✕';
  resetBtn.addEventListener('click', resetLogFilters);

  filterRow.append(qInput, userSel, actSel, fromInput, toInput, filterBtn, resetBtn);

  // Meta row
  const metaRow = document.createElement('div');
  metaRow.className = 'log-meta';

  const countSpan = document.createElement('span');
  countSpan.style.cssText = 'color:var(--muted);font-size:10px';
  countSpan.textContent = shown < total ? (shown + ' von ' + total + ' Einträgen') : (total + ' Einträge');

  const csvParams = new URLSearchParams({ action: 'log_csv', limit: 1000 });
  if (LOG_FILTERS.uid)    csvParams.set('uid',    LOG_FILTERS.uid);
  if (LOG_FILTERS.action) csvParams.set('action', LOG_FILTERS.action);
  if (LOG_FILTERS.q)      csvParams.set('q',      LOG_FILTERS.q);
  if (LOG_FILTERS.from)   csvParams.set('from',   LOG_FILTERS.from);
  if (LOG_FILTERS.to)     csvParams.set('to',     LOG_FILTERS.to);
  const csvLink = document.createElement('a');
  csvLink.className = 'log-csv-btn';
  csvLink.href = API + '?' + csvParams.toString();
  csvLink.target = '_blank'; csvLink.textContent = '⬇ CSV';

  metaRow.append(countSpan, csvLink);
  toolbar.append(filterRow, metaRow);

  // ── Entries
  const entriesDiv = document.createElement('div');
  entriesDiv.id = 'log-entries';

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.style.padding = '24px 0';
    empty.textContent = 'Keine Einträge gefunden.';
    entriesDiv.appendChild(empty);
  } else {
    entries.forEach(e => {
      const meta = ACTION_META[e.action] || { l: e.action || '?', c: 'var(--text2)' };

      let tsText = '–';
      try { tsText = new Date(e.ts).toLocaleString('de-CH'); } catch(_) {}

      const entry = document.createElement('div');
      entry.className = 'cl-entry';

      const head = document.createElement('div');
      head.className = 'cl-entry-head';

      const badge = document.createElement('span');
      badge.className = 'cl-action-badge';
      badge.style.cssText = 'background:color-mix(in srgb,' + meta.c + ' 15%,transparent);color:' + meta.c;
      badge.textContent = meta.l;

      const who = document.createElement('span');
      who.className = 'cl-who'; who.textContent = e.who || '?';

      head.appendChild(badge);
      head.appendChild(who);

      if (e.role) {
        const role = document.createElement('span');
        role.className = 'cl-role'; role.textContent = e.role;
        head.appendChild(role);
      }

      const ts = document.createElement('span');
      ts.className = 'cl-time'; ts.textContent = tsText;
      head.appendChild(ts);

      if (e.ip) {
        const ip = document.createElement('span');
        ip.className = 'cl-ip'; ip.title = 'IP-Adresse'; ip.textContent = e.ip;
        head.appendChild(ip);
      }

      const what = document.createElement('div');
      what.className = 'cl-what';
      what.innerHTML = logSummary(e);

      entry.appendChild(head);
      entry.appendChild(what);
      entriesDiv.appendChild(entry);
    });
  }

  body.innerHTML = '';
  body.appendChild(toolbar);
  body.appendChild(entriesDiv);
}

async function openChangelog() {
  openSP('📋 Änderungs-Log', '<div class="loading">Lade…</div>');
  await loadLog();
}

async function loadLog() {
  const qs = buildLogQS();
  const r  = await GET('get_log', qs + '&limit=500');
  if (!r.ok) {
    document.getElementById('sp-body').innerHTML = `<div class="empty">Fehler: ${r.error}</div>`;
    return;
  }
  renderLogEntries(r);
}

function buildLogQS() {
  let qs = '';
  if (LOG_FILTERS.uid)    qs += `&uid=${encodeURIComponent(LOG_FILTERS.uid)}`;
  if (LOG_FILTERS.action) qs += `&action=${encodeURIComponent(LOG_FILTERS.action)}`;
  if (LOG_FILTERS.q)      qs += `&q=${encodeURIComponent(LOG_FILTERS.q)}`;
  if (LOG_FILTERS.from)   qs += `&from=${LOG_FILTERS.from}`;
  if (LOG_FILTERS.to)     qs += `&to=${LOG_FILTERS.to}`;
  return qs;
}

function applyLogFilters() {
  LOG_FILTERS.uid    = document.getElementById('lf-user')?.value   || '';
  LOG_FILTERS.action = document.getElementById('lf-action')?.value || '';
  LOG_FILTERS.q      = document.getElementById('lf-q')?.value.trim()|| '';
  LOG_FILTERS.from   = document.getElementById('lf-from')?.value   || '';
  LOG_FILTERS.to     = document.getElementById('lf-to')?.value     || '';
  loadLog();
}

function resetLogFilters() {
  Object.assign(LOG_FILTERS, { uid:'', action:'', q:'', from:'', to:'' });
  loadLog();
}
