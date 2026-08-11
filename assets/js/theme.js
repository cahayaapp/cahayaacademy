const root = document.documentElement;
const saved = localStorage.getItem('bi-theme');
if (saved === 'dark' || saved === 'light') root.dataset.theme = saved;
else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) root.dataset.theme = 'dark';
else root.dataset.theme = 'light';

export function toggleTheme() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('bi-theme', next);
  refreshThemeButtons();
}

export function refreshThemeButtons() {
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.textContent = root.dataset.theme === 'dark' ? '☀️' : '🌙';
    btn.title = root.dataset.theme === 'dark' ? 'Gunakan mode terang' : 'Gunakan mode gelap';
  });
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-theme-toggle]');
  if (btn) toggleTheme();
});
refreshThemeButtons();
