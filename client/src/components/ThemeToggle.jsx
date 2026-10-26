import { useEffect, useState } from 'react';

function getInitialTheme() {
  try {
    return localStorage.getItem('occ_theme') || 'light';
  } catch {
    return 'light';
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('occ_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      title={isDark ? 'Day mode' : 'Night mode'}
    >
      {isDark ? '☀ Day' : '☾ Night'}
    </button>
  );
}

export default ThemeToggle;