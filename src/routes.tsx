import { createBrowserRouter, Outlet } from 'react-router';
import { BottomNav } from './components/bottom-nav';
import { ConnectScreen } from './components/connect-screen';
import { ChoreographyScreen } from './components/choreography-screen';
import { PlayScreen } from './components/play-screen';
import { LibraryScreen } from './components/library-screen';
import { Toaster } from 'sonner';
import { useDarkMode } from './store';
import { useEffect } from 'react';
import { DARK, LIGHT } from './theme-vars';

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  const vars = dark ? DARK : LIGHT;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  root.classList.toggle('dark', dark);
}

// Apply on load before React renders to avoid flash
applyTheme(localStorage.getItem('darkMode') === 'true');

function Layout() {
  const { dark } = useDarkMode();

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  return (
    <div
      className="flex min-h-dvh md:pl-[72px]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}
    >
      <Toaster
        theme={dark ? 'dark' : 'light'}
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border-strong)',
            color: 'var(--app-text-primary)',
            fontSize: 13,
          },
        }}
      />
      <div className="flex-1 w-full pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: ConnectScreen },
      { path: 'choreography', Component: ChoreographyScreen },
      { path: 'play', Component: PlayScreen },
      { path: 'library', Component: LibraryScreen },
    ],
  },
]);
