/**
 * backend-crud.js — Customer, Job, User & Year management
 * Depends on: api.js, backend-app.js (S, openSP, closeSP, reloadMonth)
 */

// ── CUSTOMERS ─────────────────────────────────────────────

function openAddCustomer() {
  openSP('Kunde hinzufügen', `
    <div class="sf"><label>Kundenname</label><input type="text" id="new-cust" placeholder="z.B. Muster AG"></div>
    <button class="sp-btn ok" onclick="addCust()">Erstellen</button>
  `);
  setTimeout(() => document.getElementById('new-cust')?.focus(), 100);
}

async function addCust() {
  const name = document.getElementById('new-cust').value.trim();
  if (!name) return;
  const r = await api('add_customer', { year: S.year, name });
  if (r.ok) { toast('Kunde erstellt', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

function openEditCust(name) {
  openSP('Kunde bearbeiten', `
    <div class="sf"><label>Name</label><input type="text" id="edit-cust" value="${esc(name)}"></div>
    <button class="sp-btn ok" onclick="renameCust('${esc(name)}')">Speichern</button>
    ${S.isAdmin ? `<button class="sp-btn danger" onclick="delCust('${esc(name)}')">Kunde löschen</button>` : ''}
  `);
}

async function renameCust(old) {
  const n = document.getElementById('edit-cust').value.trim();
  if (!n || n === old) return;
  const r = await api('rename_customer', { year: S.year, old_name: old, new_name: n });
  if (r.ok) { toast('Umbenannt', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

async function delCust(name) {
  if (!confirm(`Kunde «${name}» und alle Jobs löschen?`)) return;
  const r = await api('delete_customer', { year: S.year, name });
  if (r.ok) { toast('Gelöscht', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

// ── JOBS ──────────────────────────────────────────────────

function openAddJob(custName) {
  openSP('Job hinzufügen', `
    <div class="sf"><label>Kunde</label><input type="text" value="${esc(custName)}" disabled></div>
    <div class="sf"><label>Job-Name</label><input type="text" id="new-job" placeholder="z.B. Backup to Disk"></div>
    <button class="sp-btn ok" onclick="addJob('${esc(custName)}')">Erstellen</button>
  `);
  setTimeout(() => document.getElementById('new-job')?.focus(), 100);
}

async function addJob(cust) {
  const j = document.getElementById('new-job').value.trim();
  if (!j) return;
  const r = await api('add_job', { year: S.year, customer: cust, job: j });
  if (r.ok) { toast('Job erstellt', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

function openEditJob(cust, job) {
  openSP('Job bearbeiten', `
    <div class="sf"><label>Kunde</label><input type="text" value="${esc(cust)}" disabled></div>
    <div class="sf"><label>Job-Name</label><input type="text" id="edit-job" value="${esc(job)}"></div>
    <button class="sp-btn ok" onclick="renameJob('${esc(cust)}','${esc(job)}')">Speichern</button>
    ${S.isAdmin ? `<button class="sp-btn danger" onclick="delJob('${esc(cust)}','${esc(job)}')">Job löschen</button>` : ''}
  `);
}

async function renameJob(cust, old) {
  const n = document.getElementById('edit-job').value.trim();
  if (!n || n === old) return;
  const r = await api('rename_job', { year: S.year, customer: cust, old_name: old, new_name: n });
  if (r.ok) { toast('Umbenannt', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

async function delJob(cust, job) {
  if (!confirm(`Job «${job}» löschen?`)) return;
  const r = await api('delete_job', { year: S.year, customer: cust, job });
  if (r.ok) { toast('Gelöscht', 'ok'); closeSP(); await reloadMonth(); }
  else toast(r.error, 'err');
}

// ── YEAR CREATION ─────────────────────────────────────────

function openNewYear() {
  const ny = (S.years[S.years.length - 1] || new Date().getFullYear()) + 1;
  openSP('Neues Jahr erstellen', `
    <div class="sf"><label>Jahr</label><input type="number" id="ny-year" value="${ny}" min="2020" max="2099"></div>
    <div class="sf">
      <label>Struktur kopieren von</label>
      <select id="ny-copy">
        <option value="">— Leer starten —</option>
        ${S.years.map(y => `<option value="${y}"${y === S.year ? ' selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:16px">Kunden und Jobs werden übernommen, Statusinhalte bleiben leer.</p>
    <button class="sp-btn ok" onclick="createYear()">Jahr erstellen</button>
  `);
}

async function createYear() {
  const year      = parseInt(document.getElementById('ny-year').value);
  const copy_from = parseInt(document.getElementById('ny-copy').value) || 0;
  const r = await api('create_year', { year, copy_from });
  if (r.ok) {
    toast(`Jahr ${year} erstellt`, 'ok');
    closeSP();
    const yd = await GET('get_years');
    S.years = yd.years || S.years;
    renderYearBar();
    selectYear(year);
  } else toast(r.error, 'err');
}

// ── USER MANAGEMENT ───────────────────────────────────────

async function openUsers() {
  const r = await GET('get_users');
  if (!r.ok) { toast(r.error, 'err'); return; }
  const rl = ro => ({
    admin:  `<span class="role-badge rb-admin">admin</span>`,
    editor: `<span class="role-badge rb-editor">editor</span>`,
    viewer: `<span class="role-badge rb-viewer">viewer</span>`,
  }[ro] || ro);
  openSP('👤 Benutzerverwaltung', `
    <table class="user-table">
      <thead><tr><th>Benutzer</th><th>Name</th><th>Rolle</th><th>Status</th><th></th></tr></thead>
      <tbody>${r.users.map(u => `<tr>
        <td>${u.username}</td><td>${u.display_name}</td><td>${rl(u.role)}</td>
        <td>${u.active ? '<span style="color:var(--ok)">Aktiv</span>' : '<span style="color:var(--muted)">Inaktiv</span>'}</td>
        <td>
          <button class="eb" onclick="openEditUser(${JSON.stringify(JSON.stringify(u))})">✎</button>
          ${u.id !== S.user.id ? `<button class="eb danger" onclick="delUser(${u.id},'${u.username}')">✕</button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table>

    <div class="sp-section">Neuer Benutzer</div>
    <div class="sf-row">
      <div class="sf"><label>Benutzername</label><input type="text" id="nu-user"></div>
      <div class="sf"><label>Passwort</label><input type="password" id="nu-pass"></div>
    </div>
    <div class="sf-row">
      <div class="sf"><label>Anzeigename</label><input type="text" id="nu-dn"></div>
      <div class="sf"><label>Rolle</label>
        <select id="nu-role">
          <option value="viewer">viewer</option>
          <option value="editor">editor</option>
          <option value="admin">admin</option>
        </select>
      </div>
    </div>
    <button class="sp-btn ok" onclick="addUser()">Benutzer hinzufügen</button>

    <div class="sp-section">Rollen-Legende</div>
    <table class="user-table">
      <thead><tr><th>Rolle</th><th>Anzeigen</th><th>Bearbeiten</th><th>Löschen</th><th>Admin</th></tr></thead>
      <tbody>
        <tr><td><span class="role-badge rb-viewer">viewer</span></td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--muted);text-align:center">–</td>
            <td style="color:var(--muted);text-align:center">–</td>
            <td style="color:var(--muted);text-align:center">–</td></tr>
        <tr><td><span class="role-badge rb-editor">editor</span></td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--muted);text-align:center">–</td>
            <td style="color:var(--muted);text-align:center">–</td></tr>
        <tr><td><span class="role-badge rb-admin">admin</span></td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--ok);text-align:center">✓</td>
            <td style="color:var(--ok);text-align:center">✓</td></tr>
      </tbody>
    </table>
  `);
}

function openEditUser(jsonStr) {
  const u = JSON.parse(jsonStr);
  openSP('Benutzer bearbeiten', `
    <div class="sf"><label>Benutzername</label><input type="text" value="${u.username}" disabled></div>
    <div class="sf"><label>Anzeigename</label><input type="text" id="eu-dn" value="${u.display_name}"></div>
    <div class="sf"><label>Rolle</label>
      <select id="eu-role">
        ${['viewer','editor','admin'].map(ro => `<option${ro === u.role ? ' selected' : ''}>${ro}</option>`).join('')}
      </select>
    </div>
    <div class="sf"><label>Status</label>
      <select id="eu-active">
        <option value="1"${u.active ? ' selected' : ''}>Aktiv</option>
        <option value="0"${!u.active ? ' selected' : ''}>Inaktiv</option>
      </select>
    </div>
    <div class="sf"><label>Neues Passwort (leer = unverändert)</label><input type="password" id="eu-pass"></div>
    <button class="sp-btn ok" onclick="updateUser(${u.id})">Speichern</button>
  `);
}

async function addUser() {
  const r = await api('add_user', {
    username:     document.getElementById('nu-user').value.trim(),
    password:     document.getElementById('nu-pass').value,
    display_name: document.getElementById('nu-dn').value.trim(),
    role:         document.getElementById('nu-role').value
  });
  if (r.ok) { toast('Benutzer erstellt', 'ok'); openUsers(); }
  else toast(r.error, 'err');
}

async function updateUser(id) {
  const b = {
    id,
    display_name: document.getElementById('eu-dn').value.trim(),
    role:         document.getElementById('eu-role').value,
    active:       document.getElementById('eu-active').value === '1'
  };
  const pw = document.getElementById('eu-pass').value;
  if (pw) b.password = pw;
  const r = await api('update_user', b);
  if (r.ok) { toast('Gespeichert', 'ok'); openUsers(); }
  else toast(r.error, 'err');
}

async function delUser(id, name) {
  if (!confirm(`Benutzer «${name}» löschen?`)) return;
  const r = await api('delete_user', { id });
  if (r.ok) { toast('Gelöscht', 'ok'); openUsers(); }
  else toast(r.error, 'err');
}
