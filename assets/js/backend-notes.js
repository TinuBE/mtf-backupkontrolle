/**
 * backend-notes.js — Persistent cell notes (NEW FEATURE)
 *
 * Notes are stored server-side via api.php (set_note / get_notes actions).
 * Falls back gracefully if the API doesn't yet support notes (session-only).
 *
 * Depends on: api.js, backend-app.js (S, CTX, openSP, closeSP)
 */

/** In-memory cache, loaded per year+month */
const NOTES = {};

/** Generate a note key */
function noteKeyFor(cust, job, date) {
  return `${S.year}|${S.month}|${cust}|${job}|${date}`;
}

/** Load notes for current month from server */
async function loadNotes() {
  if (!S.year || !S.month) return;
  const r = await GET('get_notes', `&year=${S.year}&month=${encodeURIComponent(S.month)}`);
  if (r.ok && r.notes) {
    Object.assign(NOTES, r.notes);
  }
}

/** Open note panel for current CTX cell */
function openNote() {
  document.getElementById('ctx-menu').classList.remove('open');
  const k        = noteKeyFor(CTX.cust, CTX.job, CTX.date);
  const existing = NOTES[k] || '';
  openSP('📝 Notiz — ' + CTX.date, `
    <div style="font-size:11px;color:var(--text2);margin-bottom:12px">
      <strong>${CTX.cust}</strong><br>
      <span style="color:var(--muted)">${CTX.job}</span>
    </div>
    <div class="sf">
      <label>Notiz / Kommentar</label>
      <textarea id="note-txt" rows="5" placeholder="Fehlerdetails, Massnahmen, Ticket-Nr…">${existing}</textarea>
    </div>
    <button class="sp-btn ok" onclick="saveNote()">Speichern</button>
    ${existing ? `<button class="sp-btn danger" onclick="delNote()">Notiz löschen</button>` : ''}

    <div class="sp-section">Notizen dieses Monats</div>
    <div id="notes-list">${renderNotesList()}</div>
  `);
  setTimeout(() => document.getElementById('note-txt')?.focus(), 100);
}

/** Render all notes for current month as cards */
function renderNotesList() {
  const prefix = `${S.year}|${S.month}|`;
  const keys   = Object.keys(NOTES).filter(k => k.startsWith(prefix) && NOTES[k]);
  if (!keys.length) return '<div class="empty" style="padding:16px 0;font-size:11px">Keine Notizen für diesen Monat.</div>';
  return keys.map(k => {
    const parts = k.split('|');
    // parts: year|month|cust|job|date
    const [,, cust, job, date] = parts;
    return `<div class="note-card">
      <div class="note-card-meta">${date} · <strong>${cust}</strong> / ${job}</div>
      <div class="note-card-text">${h(NOTES[k])}</div>
    </div>`;
  }).join('');
}

/** Save note to server + local cache */
async function saveNote() {
  const k = noteKeyFor(CTX.cust, CTX.job, CTX.date);
  const t = document.getElementById('note-txt').value.trim();
  if (t) {
    NOTES[k] = t;
  } else {
    delete NOTES[k];
  }
  // Persist to server
  await api('set_note', {
    year: S.year, month: S.month,
    customer: CTX.cust, job: CTX.job, date: CTX.date,
    note: t || null
  });
  closeSP();
  toast('Notiz gespeichert', 'ok', 1500);
  // Re-render table to update note indicators
  if (S.mdata) renderTable(S.mdata);
}

/** Delete note */
async function delNote() {
  const k = noteKeyFor(CTX.cust, CTX.job, CTX.date);
  delete NOTES[k];
  await api('set_note', {
    year: S.year, month: S.month,
    customer: CTX.cust, job: CTX.job, date: CTX.date,
    note: null
  });
  closeSP();
  toast('Notiz gelöscht', 'ok', 1500);
  if (S.mdata) renderTable(S.mdata);
}
