<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backup Kontrolle — Backend</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
<link rel="stylesheet" href="../assets/css/theme.css?v=44913d98">
<link rel="stylesheet" href="../assets/css/layout.css?v=8884f70b">
<link rel="stylesheet" href="../assets/css/table.css?v=cc24cefc">
<link rel="stylesheet" href="../assets/css/backend.css?v=1b5e33de">
</head>
<body>

<!-- ════════════════════ LOGIN ════════════════════ -->
<div id="login-wrap" class="login-wrap">
  <div class="login-box">
    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px">
      <img src="https://www.careweb.ch/img/logo.jpg" alt="MTF Solutions AG"
           style="height:44px;width:auto;margin-bottom:12px;border-radius:3px">
      <div style="height:1px;width:100%;background:var(--border);margin-bottom:10px"></div>
      <span style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text2);letter-spacing:.02em">
        Backup Kontrolle — Backend
      </span>
    </div>
    <div id="login-err" class="login-err" style="display:none"></div>
    <div class="fg"><label>Benutzername</label><input type="text" id="l-user" autocomplete="username"></div>
    <div class="fg"><label>Passwort</label><input type="password" id="l-pass" autocomplete="current-password"></div>
    <button class="btn-primary" onclick="doLogin()">Anmelden</button>
    <div class="login-foot"><a href="../index.php">→ Zur Ansicht (Frontend)</a></div>
  </div>
</div>

<!-- ════════════════════ APP SHELL ════════════════════ -->
<div id="shell" style="display:none">

  <header class="hdr">
    <div class="mtf-logo">
      <img src="https://www.careweb.ch/img/logo.jpg" alt="MTF Solutions AG" class="mtf-logo-img">
      <div class="hdr-app-sep"></div>
      <span class="hdr-app-name">Backup Kontrolle</span>
      <div class="hdr-badge">Backend</div>
    </div>
    <div class="hdr-spacer"></div>
    <span class="hdr-user" id="hdr-user"></span>
    <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
    <button class="hdr-btn" id="btn-dash"  onclick="toggleDashboard()">📊 Übersicht</button>
    <button class="hdr-btn"               onclick="openChangelog()">📋 Log</button>
    <button class="hdr-btn admin-only"    onclick="openUsers()">👤 Benutzer</button>
    <a      class="hdr-btn"               href="../index.php" target="_blank">Frontend ↗</a>
    <button class="hdr-btn danger"        onclick="doLogout()">Abmelden</button>
  </header>

  <div class="year-bar"  id="year-bar"></div>
  <div class="month-bar" id="month-bar"></div>

  <div id="dashboard-panel">
    <div id="dash-grid" class="dash-grid"></div>
  </div>

  <div class="toolbar">
    <div class="search-wrap">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input type="text" id="search" placeholder="Kunde / Job…">
    </div>
    <button class="filt-btn active" data-f="all">Alle</button>
    <button class="filt-btn fe"     data-f="error">⚠ Fehler</button>
    <button class="filt-btn fw"     data-f="warn">⚡ Warnung</button>
    <div class="tb-spacer"></div>
    <button class="tb-btn pdf"       onclick="openPDF()">⬇ PDF Export</button>
    <button class="tb-btn add" id="btn-add-cust" onclick="openAddCustomer()">+ Kunde</button>
    <button class="tb-btn secondary admin-only"  onclick="openNewYear()">+ Jahr</button>
  </div>

  <div class="stats-bar" id="stats-bar">
    <span><strong id="st-cust">–</strong> Kunden</span>
    <span><strong id="st-jobs">–</strong> Jobs</span>
    <span class="s-ok"><strong id="st-ok">–</strong> OK</span>
    <span class="s-warn"><strong id="st-warn">–</strong> Warn.</span>
    <span class="s-error"><strong id="st-err">–</strong> Fehler</span>
    <span class="s-cloud"><strong id="st-cld">–</strong> Cloud</span>
    <span style="margin-left:auto;font-size:10px;color:var(--muted)" id="kb-status"></span>
  </div>

  <div class="table-wrap" id="table-wrap"><div class="loading">Lade…</div></div>

</div><!-- /#shell -->

<!-- ════════════════════ OVERLAYS ════════════════════ -->
<div class="sp-overlay" id="sp-overlay" onclick="closeSP()"></div>
<div class="sp" id="sp">
  <div class="sp-hdr">
    <div class="sp-title" id="sp-title">Panel</div>
    <button class="sp-close" onclick="closeSP()">✕</button>
  </div>
  <div class="sp-body" id="sp-body"></div>
</div>

<div class="ctx-menu" id="ctx-menu"></div>
<div class="kb-hint" id="kb-hint">⌨ Pfeiltasten=Navigation · Shift+Pfeile=Bereich · Shift+Klick=Zelle · 1-7/C/?/Del=Wert setzen · N=Notiz · Esc=Aufheben</div>
<div id="toast"></div>

<!-- ════════════════════ SCRIPTS ════════════════════ -->
<script>
window.API_URL = '../api.php';
</script>
<script src="../assets/js/theme.js?v=9714ca77"></script>
<script src="../assets/js/api.js?v=8453243a"></script>
<script src="../assets/js/backend-notes.js?v=0e60ddb9"></script>
<script src="../assets/js/backend-app.js?v=d5bbeb1b"></script>
<script src="../assets/js/backend-keyboard.js?v=fbb9f5e8"></script>
<script src="../assets/js/backend-crud.js?v=06cb32c5"></script>
<script src="../assets/js/backend-pdf.js?v=f2648260"></script>

</body>
</html>
