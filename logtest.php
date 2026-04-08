<?php
/**
 * logtest.php — Log-Diagnose direkt im Browser. NACH GEBRAUCH LÖSCHEN!
 */
session_set_cookie_params(['path' => '/']);
session_start();
?><!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Log Test</title>
<style>
body{font-family:monospace;padding:20px;background:#0a0d12;color:#e8eaf0}
pre{background:#111520;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px}
.ok{color:#00c896}.err{color:#ff4757}.warn{color:#ffb300}
button{background:#0062ff;color:#fff;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-size:13px;margin:4px}
h2{color:#00d4ff;margin-top:20px}
</style>
</head><body>
<h2>Log-Diagnose</h2>
<button onclick="test1()">1. API direkt testen</button>
<button onclick="test2()">2. renderLogEntries testen</button>
<button onclick="test3()">3. Fehler-Trace</button>
<pre id="out">Klicke einen Button…</pre>

<script>
const API = '../api.php';

function log(msg, cls='') {
  const el = document.getElementById('out');
  el.innerHTML += '<span class="'+(cls||'')+'">' + msg + '</span>\n';
}
function clear() { document.getElementById('out').innerHTML = ''; }

// Test 1: Raw API call
async function test1() {
  clear();
  log('=== Test 1: GET get_log ===');
  log('URL: ' + API + '?action=get_log&limit=50');
  try {
    const resp = await fetch(API + '?action=get_log&limit=50');
    log('HTTP Status: ' + resp.status + ' ' + resp.statusText, resp.ok ? 'ok' : 'err');
    const text = await resp.text();
    log('Response (first 500 chars):');
    log(text.substring(0, 500));
    try {
      const json = JSON.parse(text);
      log('JSON.parse: OK', 'ok');
      log('json.ok = ' + json.ok, json.ok ? 'ok' : 'err');
      log('json.log length = ' + (json.log ? json.log.length : 'MISSING'), json.log?.length ? 'ok' : 'err');
      log('json.total = ' + json.total);
      log('json.users = ' + JSON.stringify(json.users));
      if (json.log && json.log.length > 0) {
        log('First entry: ' + JSON.stringify(json.log[0]).substring(0, 200));
      }
    } catch(e) {
      log('JSON.parse FAILED: ' + e.message, 'err');
      log('Raw text: ' + JSON.stringify(text.substring(0, 300)));
    }
  } catch(e) {
    log('fetch FAILED: ' + e.message, 'err');
  }
}

// Test 2: Simulate renderLogEntries
async function test2() {
  clear();
  log('=== Test 2: renderLogEntries Simulation ===');
  try {
    const resp = await fetch(API + '?action=get_log&limit=50');
    const r = await resp.json();
    log('r.ok = ' + r.ok);
    log('r.log.length = ' + (r.log||[]).length);
    
    const entries = (r.log||[]);
    log('Processing ' + entries.length + ' entries…');
    
    entries.forEach((e, i) => {
      try {
        const action = e.action || 'set_cell';
        log('['+i+'] action='+action+' who='+e.who+' ts='+e.ts, 'ok');
      } catch(ex) {
        log('['+i+'] ERROR: ' + ex.message, 'err');
      }
    });
    
    log('');
    log('Creating DOM elements…');
    const div = document.createElement('div');
    div.style.cssText = 'background:#1a2a3a;padding:10px;margin-top:10px;border-radius:6px';
    
    entries.forEach((e, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:4px 0;border-bottom:1px solid rgba(255,255,255,.1)';
      row.textContent = '['+i+'] ' + (e.action||'set_cell') + ' — ' + e.who + ' — ' + e.ts;
      div.appendChild(row);
    });
    
    document.body.appendChild(div);
    log('DOM rendering: OK — ' + entries.length + ' rows appended', 'ok');
    
  } catch(e) {
    log('EXCEPTION: ' + e.message, 'err');
    log('Stack: ' + e.stack);
  }
}

// Test 3: Full error trace
async function test3() {
  clear();
  log('=== Test 3: Console Error Capture ===');
  
  const origError = console.error;
  const errors = [];
  console.error = function() {
    errors.push(Array.from(arguments).join(' '));
    origError.apply(console, arguments);
  };
  
  window.onerror = function(msg, src, line, col, err) {
    log('window.onerror: ' + msg + ' at ' + src + ':' + line + ':' + col, 'err');
  };
  
  try {
    // Load the actual backend-app.js functions
    const resp = await fetch(API + '?action=get_log&limit=50');
    const r = await resp.json();
    
    log('API response OK: ' + r.log.length + ' entries');
    log('');
    log('Checking SLABELS…');
    log(typeof window.SLABELS !== 'undefined' ? 
        'SLABELS defined: ' + JSON.stringify(window.SLABELS) : 
        'SLABELS: NOT DEFINED (this page does not load backend-app.js)', 'warn');
    
    log('');
    log('Checking if renderLogEntries is defined…');
    log(typeof window.renderLogEntries === 'function' ? 
        'renderLogEntries: DEFINED' : 
        'renderLogEntries: NOT DEFINED', 
        typeof window.renderLogEntries === 'function' ? 'ok' : 'err');
    
    log('');
    log('Checking LOG_FILTERS…');
    log(typeof window.LOG_FILTERS !== 'undefined' ?
        'LOG_FILTERS: ' + JSON.stringify(window.LOG_FILTERS) :
        'LOG_FILTERS: NOT DEFINED', 'warn');
        
  } catch(e) {
    log('EXCEPTION: ' + e.message, 'err');
  }
  
  setTimeout(() => {
    if (errors.length) {
      log('');
      log('console.error calls:', 'err');
      errors.forEach(e => log('  ' + e, 'err'));
    } else {
      log('No console.error calls captured', 'ok');
    }
    console.error = origError;
  }, 500);
}
</script>
</body></html>
