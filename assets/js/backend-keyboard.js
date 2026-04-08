/**
 * backend-keyboard.js — Keyboard navigation, cell editing, BULK SELECT
 *
 * Bulk select modes:
 *   Shift + Click        → toggle individual cell into/out of selection
 *   Shift + Arrow        → extend selection from anchor
 *   Shift + 1-7 / C / ? → set all selected cells to that value
 *   Shift + Del          → clear all selected cells
 *   Escape               → clear selection
 *
 * Single cell mode (existing):
 *   Arrow keys           → move focus
 *   1-7, C, ?            → set value
 *   Delete/Backspace     → clear
 *   N                    → open note
 */

// ── Selection state ─────────────────────────────────────────
// S.kbCell  = current keyboard-focus cell {ci,ji,di}
// SELECTION = Set of "ci:ji:di" strings for bulk-selected cells

const SELECTION = new Set();
let   SEL_ANCHOR = null;   // {ci,ji,di} — start of shift-selection

// ── DOM events ──────────────────────────────────────────────

document.addEventListener('keydown', kbHandler);

// Shift+click on any table cell
document.addEventListener('click', ev => {
  if (!ev.shiftKey) return;
  const td = ev.target.closest('td[data-ci]');
  if (!td || !S.isEditor) return;
  ev.preventDefault();
  const pos = { ci: +td.dataset.ci, ji: +td.dataset.ji, di: +td.dataset.di };
  toggleSelectCell(pos);
});

// ── Keyboard handler ────────────────────────────────────────

function kbHandler(e) {
  const tag = document.activeElement.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  if (document.getElementById('sp').classList.contains('open')) return;
  if (!S.mdata || !S.isEditor) return;

  const isArrow  = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key);
  const isShift  = e.shiftKey;

  // ── Arrow navigation ──
  if (isArrow) {
    e.preventDefault();
    if (!S.kbCell) {
      S.kbCell   = { ci: 0, ji: 0, di: 0 };
      SEL_ANCHOR = { ...S.kbCell };
    } else {
      const prev = { ...S.kbCell };
      navKB(e.key);
      if (isShift) {
        // Extend range selection from anchor
        if (!SEL_ANCHOR) SEL_ANCHOR = prev;
        selectRange(SEL_ANCHOR, S.kbCell);
      } else {
        // Plain arrow — clear bulk selection
        if (SELECTION.size) { SELECTION.clear(); renderSelectionHL(); }
        SEL_ANCHOR = { ...S.kbCell };
      }
    }
    hlKB();
    showKBHint();
    return;
  }

  // ── Escape ──
  if (e.key === 'Escape') {
    if (SELECTION.size) {
      SELECTION.clear();
      renderSelectionHL();
      showSelStatus();
    } else {
      S.kbCell   = null;
      SEL_ANCHOR = null;
      clearKBHL();
      document.getElementById('kb-status').textContent = '';
    }
    return;
  }

  // ── Value keys — bulk or single ──
  if (!S.kbCell && !SELECTION.size) return;
  if (S.isPast) { toast('🔒 Vergangener Zeitraum — nur Admins', 'err', 2000); return; }
  e.preventDefault();

  const km = { '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'c':'MTF CLOUD','C':'MTF CLOUD','?':'?' };
  const val = km[e.key] !== undefined ? km[e.key]
            : (e.key === 'Delete' || e.key === 'Backspace') ? null
            : null;

  if (val !== null || e.key === 'Delete' || e.key === 'Backspace') {
    if (SELECTION.size > 0) {
      setBulk(val);
    } else {
      // Single cell from keyboard focus
      const { ci, ji, di } = S.kbCell;
      const cust = S.mdata.customers[ci]; if (!cust) return;
      const job  = cust.jobs[ji];         if (!job)  return;
      CTX = { cust: cust.name, job: job.name, date: S.mdata.dates[di], cur: job.status[S.mdata.dates[di]] };
      setCell(val);
    }
    return;
  }

  // Note shortcut (single cell only)
  if ((e.key === 'n' || e.key === 'N') && S.kbCell && !SELECTION.size) {
    const { ci, ji, di } = S.kbCell;
    const cust = S.mdata.customers[ci]; if (!cust) return;
    const job  = cust.jobs[ji];         if (!job)  return;
    CTX = { cust: cust.name, job: job.name, date: S.mdata.dates[di] };
    openNote();
  }
}

// ── Cell toggle for shift-click ─────────────────────────────

function toggleSelectCell(pos) {
  const key = cellKey(pos);
  if (SELECTION.has(key)) {
    SELECTION.delete(key);
    // If we just removed it, make it the new anchor
    SEL_ANCHOR = SELECTION.size ? SEL_ANCHOR : null;
  } else {
    SELECTION.add(key);
    if (!SEL_ANCHOR) SEL_ANCHOR = pos;
  }
  renderSelectionHL();
  showSelStatus();
}

// ── Range selection (keyboard shift+arrow) ──────────────────

function selectRange(from, to) {
  // Compute the rectangular range between from and to
  const ciMin = Math.min(from.ci, to.ci), ciMax = Math.max(from.ci, to.ci);
  const diMin = Math.min(from.di, to.di), diMax = Math.max(from.di, to.di);
  SELECTION.clear();

  for (let ci = ciMin; ci <= ciMax; ci++) {
    const c = S.mdata.customers[ci]; if (!c) continue;
    // Include all jobs of a customer if spanning multiple customers,
    // otherwise only the jobs in the from→to range
    const jiFrom = ci === from.ci ? from.ji : 0;
    const jiTo   = ci === to.ci   ? to.ji   : c.jobs.length - 1;
    const jiMin2 = Math.min(jiFrom, jiTo);
    const jiMax2 = Math.max(jiFrom, jiTo);
    for (let ji = jiMin2; ji <= jiMax2; ji++) {
      for (let di = diMin; di <= diMax; di++) {
        SELECTION.add(cellKey({ ci, ji, di }));
      }
    }
  }
  renderSelectionHL();
  showSelStatus();
}

// ── Bulk-edit toolbar ────────────────────────────────────────

function showSelStatus() {
  const kbSt = document.getElementById('kb-status');
  if (!SELECTION.size) {
    kbSt.innerHTML = S.isPast
      ? '<span style="color:var(--warn)">🔒 Vergangener Zeitraum — nur Admins können bearbeiten</span>'
      : '';
    hideBulkBar();
    return;
  }
  kbSt.innerHTML = `<span style="color:var(--accent)">▣ ${SELECTION.size} Zelle${SELECTION.size !== 1 ? 'n' : ''} ausgewählt</span>
    <span style="color:var(--muted);margin-left:6px;font-size:9px">Shift+1-7/C/?/Del zum Setzen · Esc zum Aufheben</span>`;
  showBulkBar();
}

function showBulkBar() {
  let bar = document.getElementById('bulk-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulk-bar';
    bar.className = 'bulk-bar';
    bar.innerHTML = `
      <span class="bulk-label">▣ <span id="bulk-count">0</span> Zellen:</span>
      <button class="bulk-btn bulk-ok"  onclick="setBulk(1)"          title="OK (1)">✓ OK</button>
      <button class="bulk-btn bulk-w"   onclick="setBulk(2)"          title="Warnung (2)">⚡ 2</button>
      <button class="bulk-btn bulk-w"   onclick="setBulk(3)"          title="Warnung (3)">⚡ 3</button>
      <button class="bulk-btn bulk-e"   onclick="setBulk(4)"          title="Fehler (4)">✕ 4</button>
      <button class="bulk-btn bulk-e"   onclick="setBulk(5)"          title="Läuft noch (5)">✕ 5</button>
      <button class="bulk-btn bulk-e"   onclick="setBulk(6)"          title="Disabled (6)">✕ 6</button>
      <button class="bulk-btn bulk-cld" onclick="setBulk('MTF CLOUD')" title="MTF Cloud">☁</button>
      <button class="bulk-btn bulk-wk"  onclick="setBulk(7)"          title="Wochenende (7)">WE</button>
      <button class="bulk-btn bulk-q"   onclick="setBulk('?')"        title="Unbekannt">?</button>
      <button class="bulk-btn bulk-del" onclick="setBulk(null)"       title="Löschen">✕ Leer</button>
      <button class="bulk-btn bulk-esc" onclick="clearBulk()"         title="Auswahl aufheben">Esc</button>`;
    // Insert after stats-bar
    const stats = document.getElementById('stats-bar');
    stats.parentNode.insertBefore(bar, stats.nextSibling);
  }
  bar.style.display = 'flex';
  document.getElementById('bulk-count').textContent = SELECTION.size;
}

function hideBulkBar() {
  const bar = document.getElementById('bulk-bar');
  if (bar) bar.style.display = 'none';
}

function clearBulk() {
  SELECTION.clear();
  SEL_ANCHOR = null;
  renderSelectionHL();
  showSelStatus();
}

// ── Bulk API call ────────────────────────────────────────────

async function setBulk(val) {
  if (!SELECTION.size) return;
  if (S.isPast && !S.isAdmin) { toast('🔒 Vergangener Zeitraum', 'err'); return; }

  const cells = [...SELECTION].map(k => {
    const [ci, ji, di] = k.split(':').map(Number);
    const cust = S.mdata?.customers[ci]; if (!cust) return null;
    const job  = cust.jobs[ji];          if (!job)  return null;
    return { customer: cust.name, job: job.name, date: S.mdata.dates[di] };
  }).filter(Boolean);

  if (!cells.length) return;

  // Update bulk-bar button state
  const btn = document.querySelector('.bulk-bar button:focus');
  const bar = document.getElementById('bulk-bar');
  if (bar) bar.querySelectorAll('button').forEach(b => b.disabled = true);
  const countEl = document.getElementById('bulk-count');
  if (countEl) countEl.textContent = '…';

  toast(`${cells.length} Zellen werden gesetzt…`, 'info', 8000);

  const r = await api('set_cells_bulk', {
    year: S.year, month: S.month, value: val, cells
  });

  if (bar) bar.querySelectorAll('button').forEach(b => b.disabled = false);

  if (r.ok) {
    toast(`${r.updated ?? cells.length} Zellen gesetzt ✓`, 'ok', 2000);
    SELECTION.clear();
    SEL_ANCHOR = null;
    renderSelectionHL();
    showSelStatus();
    await reloadMonth();
  } else {
    toast('Fehler: ' + r.error, 'err');
  }
}

// ── Visual highlight ─────────────────────────────────────────

function renderSelectionHL() {
  // Clear all existing selection highlights
  document.querySelectorAll('td.sel-hl').forEach(el => el.classList.remove('sel-hl'));
  SELECTION.forEach(k => {
    const [ci, ji, di] = k.split(':').map(Number);
    const td = document.querySelector(`td[data-ci="${ci}"][data-ji="${ji}"][data-di="${di}"]`);
    if (td) td.classList.add('sel-hl');
  });
  // Update count in bar if visible
  const countEl = document.getElementById('bulk-count');
  if (countEl) countEl.textContent = SELECTION.size;
}

// ── Single-cell keyboard focus ───────────────────────────────

function navKB(key) {
  const { customers, dates } = S.mdata;
  let { ci, ji, di } = S.kbCell;
  if      (key === 'ArrowRight') di = Math.min(di + 1, dates.length - 1);
  else if (key === 'ArrowLeft')  di = Math.max(di - 1, 0);
  else if (key === 'ArrowDown') {
    ji++;
    if (ji >= customers[ci].jobs.length) {
      if (ci < customers.length - 1) { ci++; ji = 0; }
      else ji = customers[ci].jobs.length - 1;
    }
  }
  else if (key === 'ArrowUp') {
    ji--;
    if (ji < 0) {
      if (ci > 0) { ci--; ji = customers[ci].jobs.length - 1; }
      else ji = 0;
    }
  }
  S.kbCell = { ci, ji, di };
}

function hlKB() {
  clearKBHL();
  if (!S.kbCell) return;
  const { ci, ji, di } = S.kbCell;
  const td = document.querySelector(`td[data-ci="${ci}"][data-ji="${ji}"][data-di="${di}"]`);
  if (td) { td.classList.add('kb-focus'); td.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
  document.getElementById('kb-status').textContent = '⌨ Tastatur aktiv — Esc beendet';
}

function clearKBHL() {
  document.querySelectorAll('.kb-focus').forEach(el => el.classList.remove('kb-focus'));
}

let _kbHintTimer;
function showKBHint() {
  const hint = document.getElementById('kb-hint');
  hint.classList.add('show');
  clearTimeout(_kbHintTimer);
  _kbHintTimer = setTimeout(() => hint.classList.remove('show'), 4000);
}

function cellKey({ ci, ji, di }) { return `${ci}:${ji}:${di}`; }
