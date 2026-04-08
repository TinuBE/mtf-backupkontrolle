<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backup Kontrolle — MTF Solutions AG</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/theme.css?v=44913d98">
<link rel="stylesheet" href="assets/css/layout.css?v=8884f70b">
<link rel="stylesheet" href="assets/css/table.css?v=cc24cefc">
</head>
<body>

<header class="hdr">
  <div class="mtf-logo">
    <img src="https://www.careweb.ch/img/logo.jpg" alt="MTF Solutions AG" class="mtf-logo-img">
    <div class="hdr-app-sep"></div>
    <span class="hdr-app-name">Backup Kontrolle</span>
  </div>
  <div class="hdr-spacer"></div>
  <button class="theme-toggle" onclick="toggleTheme()" title="Hell/Dunkel umschalten">🌓</button>
  <a class="hdr-btn" href="backend/index.php">Backend ↗</a>
</header>

<div class="year-bar" id="year-bar"><div class="loading" style="padding:0;font-size:11px">…</div></div>
<div class="month-bar" id="month-bar"></div>

<div class="toolbar">
  <div class="search-wrap">
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <input type="text" id="search" placeholder="Kunde / Job suchen…">
  </div>
  <button class="filt-btn active" data-f="all">Alle</button>
  <button class="filt-btn fe" data-f="error">⚠ Fehler</button>
  <button class="filt-btn fw" data-f="warn">⚡ Warnung</button>
  <div class="tb-right">
    <div class="legend">
      <div class="li"><div class="ld" style="background:var(--ok)"></div>OK</div>
      <div class="li"><div class="ld" style="background:var(--warn)"></div>Warn.</div>
      <div class="li"><div class="ld" style="background:var(--error)"></div>Fehler</div>
      <div class="li"><div class="ld" style="background:var(--cloud)"></div>Cloud</div>
      <div class="li"><div class="ld" style="background:var(--muted);opacity:.4"></div>WE</div>
    </div>
  </div>
</div>

<div class="stats-bar" id="stats-bar">
  <span><strong id="st-c">–</strong> Kunden</span>
  <span><strong id="st-j">–</strong> Jobs</span>
  <span class="s-ok"><strong id="st-ok">–</strong> OK</span>
  <span class="s-warn"><strong id="st-w">–</strong> Warn.</span>
  <span class="s-error"><strong id="st-e">–</strong> Fehler</span>
  <span class="s-cloud"><strong id="st-cl">–</strong> Cloud</span>
</div>

<div class="table-wrap" id="table-wrap"><div class="loading">Lade…</div></div>
<div class="empty-state" id="empty-msg" style="display:none">Keine Einträge gefunden.</div>

<button class="jump-btn" id="btn-today" onclick="jumpToday()">→ Heute</button>
<div id="toast"></div>

<script>
window.API_URL = 'api.php';
</script>
<script src="assets/js/theme.js?v=9714ca77"></script>
<script src="assets/js/api.js?v=8453243a"></script>
<script src="assets/js/frontend.js"></script>
</body>
</html>
