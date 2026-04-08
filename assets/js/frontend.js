/**
 * frontend.js — Read-only frontend viewer
 * Depends on: api.js, theme.js
 */

const MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
const TODAY  = new Date().toISOString().slice(0, 10);

let STATE = {
  year: null, month: null, filter: 'all',
  years: [], monthMeta: {}
};

// ── Filters
document.querySelectorAll('.fb').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.fb').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    STATE.filter = b.dataset.f;
    applyFilters();
  });
});
document.getElementById('search').addEventListener('input', applyFilters);

// ── Boot
(async function boot() {
  const r = await GET('get_years');
  STATE.years = r.years || [new Date().getFullYear()];
  renderYearBar();
  const thisYear = new Date().getFullYear();
  const selYear = STATE.years.includes(thisYear)
    ? thisYear
    : STATE.years[STATE.years.length - 1];
  await selectYear(selYear);
})();

function renderYearBar() {
  document.getElementById('year-bar').innerHTML = STATE.years.map(y =>
    `<button class="year-btn${y === STATE.year ? ' active' : ''}" onclick="selectYear(${y})">${y}</button>`
  ).join('');
}

async function selectYear(year) {
  STATE.year = year;
  const hdrYear = document.getElementById('hdr-year');
  if (hdrYear) hdrYear.textContent = year;
  renderYearBar();
  const mr = await GET('get_year_meta', `&year=${year}`);
  STATE.monthMeta = mr.ok ? mr.months : {};
  const nowM = MONTHS[new Date().getMonth()] + ' ' + year;
  const defM = Object.keys(STATE.monthMeta).includes(nowM) ? nowM : `Januar ${year}`;
  renderMonthBar();
  await selectMonth(defM);
}

function renderMonthBar() {
  document.getElementById('month-bar').innerHTML = MONTHS.map(m => {
    const key  = `${m} ${STATE.year}`;
    const info = STATE.monthMeta[key] || {};
    let dot = '';
    if      (info.error > 0) dot = `<span class="m-dot" style="background:var(--error)"></span>`;
    else if (info.warn  > 0) dot = `<span class="m-dot" style="background:var(--warn)"></span>`;
    else if (info.ok    > 0) dot = `<span class="m-dot" style="background:var(--ok)"></span>`;
    return `<button class="month-tab${key === STATE.month ? ' active' : ''}" onclick="selectMonth('${key}')">${dot}${m}</button>`;
  }).join('');
}

async function selectMonth(month) {
  STATE.month = month;
  renderMonthBar();
  document.getElementById('table-wrap').innerHTML = '<div class="loading">Lade…</div>';
  const url = `${API}?action=get_month&year=${STATE.year}&month=${encodeURIComponent(month)}`;
  const r = await (await fetch(url)).json();
  if (!r.ok) {
    document.getElementById('table-wrap').innerHTML = '<div class="loading">Fehler.</div>';
    return;
  }
  renderStats(r.data);
  renderTable(r.data);
}

function renderStats(mdata) {
  let j = 0, ok = 0, w = 0, e = 0, cl = 0;
  for (const c of mdata.customers)
    for (const jb of c.jobs) {
      j++;
      for (const v of Object.values(jb.status)) {
        if      (v === 'MTF CLOUD')        cl++;
        else if (v == 1)                   ok++;
        else if (v == 2 || v == 3)         w++;
        else if (v >= 4 && v <= 6)         e++;
      }
    }
  document.getElementById('st-c').textContent  = mdata.customers.length;
  document.getElementById('st-j').textContent  = j;
  document.getElementById('st-ok').textContent = ok;
  document.getElementById('st-w').textContent  = w;
  document.getElementById('st-e').textContent  = e;
  document.getElementById('st-cl').textContent = cl;
}

function renderTable(mdata) {
  const wrap = document.getElementById('table-wrap');
  if (!mdata.customers.length) {
    wrap.innerHTML = '<div class="loading">Keine Daten.</div>';
    return;
  }
  wrap.innerHTML = mdata.customers.map(c => renderCust(c, mdata.dates)).join('');
  applyFilters();
  setTimeout(() => {
    const th = document.querySelector(`[data-d="${TODAY}"]`);
    if (th) th.scrollIntoView({ inline: 'center', block: 'nearest' });
    const btn = document.getElementById('btn-today');
    if (btn) btn.style.display = th ? '' : 'none';
  }, 80);
}

function renderCust(cust, dates) {
  let ok = 0, w = 0, e = 0;
  for (const j of cust.jobs)
    for (const v of Object.values(j.status)) {
      if (v == 1) ok++; else if (v == 2 || v == 3) w++; else if (v >= 4 && v <= 6) e++;
    }
  const cn = h(cust.name);
  return `<div class="cg" data-cn="${cn.toLowerCase()}" data-he="${e > 0 ? 1 : 0}" data-hw="${w > 0 ? 1 : 0}">
    <div class="cg-hdr" onclick="this.closest('.cg').classList.toggle('collapsed')">
      <div class="cg-name">${cn}</div>
      <div class="cg-meta">
        ${e ? `<span class="cm cm-error">${e} Fehler</span>` : ''}
        ${w ? `<span class="cm cm-warn">${w} Warn.</span>` : ''}
        <span class="cm cm-ok">${ok} OK</span>
        <span style="font-size:10px;color:var(--muted)">${cust.jobs.length} Jobs</span>
      </div>
      <span class="caret">▾</span>
    </div>
    <div class="jobs-wrap">
      <table class="jtbl">
        <thead><tr>
          <th class="nth">Job / Backup</th>
          ${dates.map(d => {
            const dow = new Date(d).getDay();
            const wk  = dow === 0 || dow === 6;
            const td  = d === TODAY;
            const dn  = ['So','Mo','Di','Mi','Do','Fr','Sa'][dow];
            return `<th class="dw${wk ? ' wk' : ''}${td ? ' td' : ''}" data-d="${d}">${d.slice(8)}<br>${dn}</th>`;
          }).join('')}
        </tr></thead>
        <tbody>${cust.jobs.map(j => renderJob(j, dates)).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function renderJob(job, dates) {
  const cells = dates.map(d => {
    const v   = job.status[d];
    const dow = new Date(d).getDay();
    const wk  = dow === 0 || dow === 6;
    const td  = d === TODAY;
    let cls = '', badge = '';
    if      (v === 'MTF CLOUD')      { cls = 'c-cld'; badge = `<span class="sb sb-cld">☁</span>`; }
    else if (v == null)              { cls = wk ? 'c-wk' : ''; }
    else if (v == 7)                 { cls = 'c-wk';  badge = `<span class="sb sb-7">WE</span>`; }
    else if (v == 1)                 { cls = 'c-ok';  badge = `<span class="sb sb-ok">✓</span>`; }
    else if (v == 2 || v == 3)       { cls = 'c-w';   badge = `<span class="sb sb-w">${v}</span>`; }
    else if (v >= 4 && v <= 6)       { cls = 'c-e';   badge = `<span class="sb sb-e">${v}</span>`; }
    else if (v === '?')              { badge = `<span class="sb sb-q">?</span>`; }
    else                             { badge = `<span style="font-size:9px;color:var(--muted)">${v}</span>`; }
    return `<td class="${cls}${td ? ' td-h' : ''}">${badge}</td>`;
  }).join('');
  return `<tr data-jn="${h(job.name).toLowerCase()}">
    <td class="ntd" title="${h(job.name)}">${h(job.name)}</td>
    ${cells}
  </tr>`;
}

function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  let cnt = 0;
  document.querySelectorAll('.cg').forEach(g => {
    const cn = g.dataset.cn;
    const he = g.dataset.he === '1', hw = g.dataset.hw === '1';
    let fp = true;
    if      (STATE.filter === 'error') fp = he;
    else if (STATE.filter === 'warn')  fp = he || hw;
    let sp = true;
    if (q) {
      const jns = [...g.querySelectorAll('[data-jn]')].map(r => r.dataset.jn);
      sp = cn.includes(q) || jns.some(j => j.includes(q));
    }
    const vis = fp && sp;
    g.classList.toggle('hidden', !vis);
    if (vis) {
      cnt++;
      if (q) {
        g.querySelectorAll('tr[data-jn]').forEach(r => {
          r.style.display = r.dataset.jn.includes(q) || cn.includes(q) ? '' : 'none';
        });
      } else {
        g.querySelectorAll('tr[data-jn]').forEach(r => r.style.display = '');
      }
    }
  });
  document.getElementById('empty-msg').style.display = cnt === 0 ? '' : 'none';
}

function jumpToday() {
  const th = document.querySelector(`[data-d="${TODAY}"]`);
  if (th) th.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
