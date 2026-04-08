/**
 * backend-pdf.js — PDF export logic
 * Depends on: api.js, backend-app.js (S, MONTHS_DE, TODAY, openSP, closeSP)
 * External: jsPDF, jspdf-autotable (loaded via CDN in HTML)
 */

// ── PDF logo cache
let _pdfLogoData = null;

async function loadPDFLogo() {
  if (_pdfLogoData) return _pdfLogoData;
  try {
    const r    = await fetch('https://www.careweb.ch/img/logo.jpg');
    const blob = await r.blob();
    return new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => { _pdfLogoData = reader.result; res(_pdfLogoData); };
      reader.readAsDataURL(blob);
    });
  } catch (e) { return null; }
}

// ── Open PDF panel
function openPDF() {
  if (!S.mdata) { toast('Zuerst einen Monat laden', 'err'); return; }
  const monthOpts = S.years.flatMap(y =>
    MONTHS_DE.map(m => `<option value="${y}|${m} ${y}">${m} ${y}</option>`)
  ).join('');
  const defFrom = `${S.year}|Januar ${S.year}`;
  const nowM    = MONTHS_DE[new Date().getMonth()];
  const defTo   = `${S.year}|${nowM} ${S.year}`;
  const custs   = S.mdata.customers;
  const custItems = custs.map((c, i) => `
    <div class="pdf-cust-item">
      <label><input type="checkbox" id="pci${i}" value="${esc(c.name)}" checked>${esc(c.name)}</label>
    </div>`).join('');

  openSP('⬇ PDF Export', `
    <div class="sp-section">Zeitraum</div>
    <div class="pdf-range">
      <div class="sf" style="margin:0">
        <label>Von</label>
        <select id="pdf-from" onchange="pdfUpdatePreview()">
          ${monthOpts.replace(`value="${defFrom}"`, `value="${defFrom}" selected`)}
        </select>
      </div>
      <div class="sf" style="margin:0">
        <label>Bis</label>
        <select id="pdf-to" onchange="pdfUpdatePreview()">
          ${monthOpts.replace(`value="${defTo}"`, `value="${defTo}" selected`)}
        </select>
      </div>
    </div>
    <div id="pdf-range-info" style="font-size:10px;color:var(--muted);margin-top:6px;min-height:16px"></div>

    <div class="sp-section">Kunden</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:6px">Kunden aus aktuellem Monat (${S.month})</div>
    <div class="pdf-cust-list">${custItems}</div>
    <div class="pdf-sel-btns">
      <button class="pdf-sel-btn" onclick="pdfSelAll(true)">Alle wählen</button>
      <button class="pdf-sel-btn" onclick="pdfSelAll(false)">Alle abwählen</button>
    </div>

    <button class="pdf-go" id="pdf-go-btn" onclick="exportPDF()">PDF erstellen</button>
    <div style="margin-top:12px;padding:9px 12px;background:var(--surface3);border-radius:6px;font-size:10px;color:var(--muted)">
      ✓ OK &nbsp;·&nbsp; 2/3 Warnung &nbsp;·&nbsp; 4-6 Fehler &nbsp;·&nbsp; ☁ Cloud &nbsp;·&nbsp; — WE
    </div>
  `);
  setTimeout(pdfUpdatePreview, 50);
}

function pdfSelAll(checked) {
  document.querySelectorAll('.pdf-cust-item input[type=checkbox]').forEach(cb => cb.checked = checked);
}

function pdfUpdatePreview() {
  const from = document.getElementById('pdf-from')?.value;
  const to   = document.getElementById('pdf-to')?.value;
  if (!from || !to) return;
  const months = pdfMonthRange(from, to);
  const info   = document.getElementById('pdf-range-info');
  if (months === null) {
    info.innerHTML = '<span style="color:var(--error)">⚠ «Von» muss vor «Bis» liegen</span>';
    document.getElementById('pdf-go-btn').disabled = true;
  } else {
    info.textContent = `${months.length} Monat${months.length !== 1 ? 'e' : ''} ausgewählt`;
    document.getElementById('pdf-go-btn').disabled = false;
  }
}

/** Returns [{year, monthKey}] or null if invalid range */
function pdfMonthRange(fromVal, toVal) {
  const [fy, fmk] = fromVal.split('|');
  const [ty, tmk] = toVal.split('|');
  const fi = MONTHS_DE.findIndex(m => fmk.startsWith(m));
  const ti = MONTHS_DE.findIndex(m => tmk.startsWith(m));
  const fOrd = parseInt(fy) * 12 + fi;
  const tOrd = parseInt(ty) * 12 + ti;
  if (tOrd < fOrd) return null;
  const result = [];
  for (let ord = fOrd; ord <= tOrd; ord++) {
    const y  = Math.floor(ord / 12);
    const mi = ord % 12;
    result.push({ year: y, monthKey: `${MONTHS_DE[mi]} ${y}` });
  }
  return result;
}

// ── Main export function
async function exportPDF() {
  const fromVal = document.getElementById('pdf-from').value;
  const toVal   = document.getElementById('pdf-to').value;
  const months  = pdfMonthRange(fromVal, toVal);
  if (!months) { toast('Ungültiger Zeitraum', 'err'); return; }

  const selCusts = [];
  document.querySelectorAll('.pdf-cust-item input[type=checkbox]:checked').forEach(cb => selCusts.push(cb.value));
  if (!selCusts.length) { toast('Bitte mindestens einen Kunden wählen', 'err'); return; }
  const allCusts = selCusts.length === S.mdata.customers.length;

  document.getElementById('pdf-go-btn').disabled  = true;
  document.getElementById('pdf-go-btn').textContent = `Lade Daten (0/${months.length})…`;
  toast('PDF wird erstellt…', 'info', 30000);

  await loadPDFLogo();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Color palette
  const C = {
    ok:[0,175,115], w:[210,140,0], e:[200,55,65], cld:[90,110,210],
    wk:[195,200,210], em:[245,247,252], hdr:[18,26,45], chdr:[35,50,80],
    txt:[35,40,55], mut:[130,135,150], wh:[255,255,255], name:[240,242,250]
  };
  const CW=6.2, CH=5.2, NW=60, PW=287, PH=200, ML=4, MT=13;

  function scolor(v) {
    if (v === 'MTF CLOUD')             return C.cld;
    if (v == null || v === undefined)  return C.em;
    if (v == 7)  return C.wk;
    if (v == 1)  return C.ok;
    if (v == 2 || v == 3) return C.w;
    if (v >= 4 && v <= 6) return C.e;
    return C.em;
  }
  function slabel(v) {
    if (v === 'MTF CLOUD') return 'C';
    if (v == null) return '';
    if (v == 7)    return '—';
    if (v == 1)    return 'OK';
    return String(v);
  }

  function pageHdr(left, center) {
    doc.setFillColor(13, 34, 64);
    doc.rect(0, 0, 297, 11, 'F');
    if (_pdfLogoData) {
      try { doc.addImage(_pdfLogoData, 'JPEG', 2, 1.2, 0, 8.5); }
      catch (e) { _drawFallbackLogo(); }
    } else {
      _drawFallbackLogo();
    }
    doc.setDrawColor(21, 101, 192); doc.setLineWidth(0.35); doc.line(56, 1.5, 56, 9.5);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
    doc.text('Backup Kontrolle', 58.5, 5.8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(190, 215, 240);
    doc.text(center, 175, 5.8, { align: 'center' });
    doc.setFontSize(5.2); doc.setTextColor(140, 175, 215);
    doc.text(new Date().toLocaleDateString('de-CH'), 293, 5.8, { align: 'right' });
    doc.setTextColor(...C.txt);
  }

  function _drawFallbackLogo() {
    doc.setFillColor(229, 57, 53); doc.rect(2.5, 1.2, 10, 8.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2);
    doc.text('MTF', 3.3, 7.4);
    doc.setFontSize(6.8); doc.text('MTF Solutions AG', 15, 5.6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.setTextColor(140, 175, 215);
    doc.text('ALL AROUND BUSINESS IT', 15, 8.8);
  }

  function drawMonthBlock(y0, mname, mdata, custFilter) {
    const dates      = mdata.dates;
    const custs      = custFilter ? mdata.customers.filter(c => custFilter.has(c.name)) : mdata.customers;
    const validCusts = custs.filter(c => c && c.jobs && c.jobs.length);
    if (!validCusts.length) return y0;
    let y = y0;

    // Month header
    doc.setFillColor(...C.chdr); doc.rect(ML, y, PW - ML, 5.5, 'F');
    doc.setTextColor(...C.wh); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(mname, ML + 2, y + 3.8);
    doc.setTextColor(...C.txt);
    y += 5.5;

    // Date column headers
    const dayN = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5);
    doc.setFillColor(...C.name); doc.rect(ML, y, NW, CH, 'F');
    doc.setTextColor(...C.mut); doc.text('Job / Backup', ML + 1, y + CH / 2 + 1.2);
    dates.forEach((d, i) => {
      const x   = ML + NW + i * CW;
      const dow = new Date(d).getDay();
      const wk  = dow === 0 || dow === 6;
      const td  = d === TODAY;
      doc.setFillColor(...(td ? [0,150,220] : wk ? [205,210,220] : [235,238,248]));
      doc.rect(x, y, CW, CH, 'F');
      doc.setTextColor(...(td ? C.wh : C.mut));
      doc.text(d.slice(8), x + CW / 2, y + 1.8, { align: 'center' });
      doc.text(dayN[dow], x + CW / 2, y + 3.8, { align: 'center' });
    });
    doc.setTextColor(...C.txt);
    y += CH;

    // Customer/job rows
    for (const cust of validCusts) {
      doc.setFillColor(48, 64, 96); doc.rect(ML, y, PW - ML, 4, 'F');
      doc.setTextColor(...C.wh); doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
      doc.text(doc.splitTextToSize(cust.name, PW - ML - 4)[0], ML + 1.5, y + 2.8);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.txt);
      y += 4;
      for (const job of cust.jobs) {
        if (y + CH > PH - 8) { doc.addPage(); pageHdr('MTF Solutions AG — Backup Kontrolle', mname + ' (Forts.)'); y = MT; }
        doc.setFillColor(...C.name); doc.rect(ML, y, NW, CH, 'F');
        doc.setFontSize(4.5); doc.setTextColor(80, 90, 120);
        doc.text(doc.splitTextToSize(job.name, NW - 2)[0], ML + 1, y + CH / 2 + 1.2);
        dates.forEach((d, i) => {
          const x   = ML + NW + i * CW;
          const v   = job.status[d];
          doc.setFillColor(...scolor(v)); doc.rect(x, y, CW, CH, 'F');
          const lbl = slabel(v);
          if (lbl) {
            const tc = (v == 1 || v === 'MTF CLOUD') ? C.wh : v == 7 ? C.mut : C.wh;
            doc.setTextColor(...tc); doc.setFontSize(4.2);
            doc.text(lbl, x + CW / 2, y + CH / 2 + 1.2, { align: 'center' });
          }
        });
        doc.setDrawColor(215, 218, 230); doc.setLineWidth(0.08);
        doc.rect(ML, y, NW + dates.length * CW, CH);
        y += CH;
      }
    }
    return y + 3;
  }

  function legend(y) {
    if (y > 188) return;
    const items = [[C.ok,'OK (1)'],[C.w,'Warn (2/3)'],[C.e,'Fehler (4-6)'],[C.cld,'Cloud'],[C.wk,'WE (7)']];
    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal');
    let x = ML; doc.setTextColor(...C.mut); doc.text('Legende:', x, y + 2.5); x += 12;
    items.forEach(([col, lbl]) => {
      doc.setFillColor(...col); doc.rect(x, y + 0.5, 3, 2.5, 'F');
      doc.setTextColor(60, 65, 80); doc.text(lbl, x + 4, y + 2.5);
      x += 20;
    });
  }

  const custFilter  = allCusts ? null : new Set(selCusts);
  const custLabel   = allCusts ? 'Alle Kunden' : `${selCusts.length} Kunde${selCusts.length !== 1 ? 'n' : ''}`;
  const rangeLabel  = months.length === 1 ? months[0].monthKey : `${months[0].monthKey} – ${months[months.length-1].monthKey}`;
  const center      = `${rangeLabel} · ${custLabel}`;

  let firstPage = true;
  for (let mi = 0; mi < months.length; mi++) {
    const { year, monthKey } = months[mi];
    document.getElementById('pdf-go-btn').textContent = `Lade Daten (${mi + 1}/${months.length})…`;
    let mdata;
    if (year === S.year && monthKey === S.month && S.mdata) {
      mdata = S.mdata;
    } else {
      const r = await GET('get_month', `&year=${year}&month=${encodeURIComponent(monthKey)}`);
      if (!r.ok) continue;
      mdata = r.data;
    }
    if (!firstPage) doc.addPage();
    firstPage = false;
    pageHdr('MTF Solutions AG — Backup Kontrolle', center);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.txt);
    doc.text(`${monthKey} · ${custLabel}`, ML, MT);
    let y = MT + 4;
    y = drawMonthBlock(y, monthKey, mdata, custFilter);
    legend(y);
  }

  const fn = `backup_${rangeLabel.replace(/\s/g,'_').replace(/–/g,'-')}_${allCusts ? 'alle' : 'selektion'}.pdf`;
  doc.save(fn);
  toast('PDF gespeichert ✓', 'ok');
  document.getElementById('pdf-go-btn').disabled  = false;
  document.getElementById('pdf-go-btn').textContent = 'PDF erstellen';
}
