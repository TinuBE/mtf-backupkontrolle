/**
 * theme.js — Theme toggle (dark/light), persisted via localStorage
 */

(function initTheme() {
  document.documentElement.dataset.theme =
    localStorage.getItem('bk-theme') || 'dark';
})();

function toggleTheme() {
  const nt = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nt;
  localStorage.setItem('bk-theme', nt);
}
