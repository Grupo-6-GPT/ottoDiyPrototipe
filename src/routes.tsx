import { createBrowserRouter, Outlet } from 'react-router';
import { BottomNav } from './components/bottom-nav';
import { ConnectScreen } from './components/connect-screen';
import { ChoreographyScreen } from './components/choreography-screen';
import { PlayScreen } from './components/play-screen';
import { LibraryScreen } from './components/library-screen';
import { Toaster } from 'sonner';

function Layout() {
  return (
    <div
      className="flex min-h-dvh md:pl-[72px]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#0B0B14', color: '#E8E8F0' }}
    >
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: { background: '#111120', border: '1px solid #1C1C30', color: '#E8E8F0', fontSize: 13 },
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
