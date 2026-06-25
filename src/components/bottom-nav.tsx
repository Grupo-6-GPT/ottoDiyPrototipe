import { useNavigate, useLocation } from 'react-router';
import { Bluetooth, Layers, Play, FolderOpen, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { useUI, useDarkMode } from '../store';

const tabs = [
  { path: '/', label: 'Connect', icon: Bluetooth },
  { path: '/choreography', label: 'Build', icon: Layers },
  { path: '/play', label: 'Play', icon: Play },
  { path: '/library', label: 'Library', icon: FolderOpen },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { overlayOpen } = useUI();
  const { dark, toggle } = useDarkMode();

  if (overlayOpen) return null;

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <>
      {/* Mobile: bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'var(--app-bg)', boxShadow: '0 -1px 0 var(--app-border-strong)' }}
      >
        <div
          className="flex justify-around items-center h-14 rounded-2xl my-1.5 px-1"
          style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)' }}
        >
          {tabs.map(tab => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 relative rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                {active && (
                  <motion.div
                    layoutId="navPillBottom"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'var(--app-accent-bg)', border: '1px solid #9D87F5' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={18} className="relative z-10" style={{ color: active ? '#7C3AED' : 'var(--app-text-muted)' }} />
                <span className="relative z-10" style={{ color: active ? '#7C3AED' : 'var(--app-text-muted)', fontSize: 14, fontWeight: 500 }}>{tab.label}</span>
              </button>
            );
          })}
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-colors"
          >
            {dark
              ? <Sun size={18} style={{ color: 'var(--app-text-muted)' }} />
              : <Moon size={18} style={{ color: 'var(--app-text-muted)' }} />}
            <span style={{ color: 'var(--app-text-muted)', fontSize: 10, fontWeight: 500 }}>{dark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </nav>

      {/* Desktop/tablet: left sidebar */}
      <nav
        className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[72px] z-50 py-4 px-2 gap-1"
        style={{ background: 'var(--app-nav-bg)', borderRight: '1px solid var(--app-border-strong)', boxShadow: '2px 0 8px rgba(100,100,150,0.06)' }}
      >
        <div className="flex items-center justify-center h-10 mb-4">
          <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Otto</span>
        </div>
        {tabs.map(tab => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 py-3 px-1 relative rounded-xl transition-colors cursor-pointer w-full"
            >
              {active && (
                <motion.div
                  layoutId="navPillSide"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'var(--app-accent-bg)', border: '1px solid #9D87F5' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={20} className="relative z-10" style={{ color: active ? '#7C3AED' : 'var(--app-text-muted)' }} />
              <span className="relative z-10" style={{ color: active ? '#7C3AED' : 'var(--app-text-muted)', fontSize: 14, fontWeight: 500 }}>{tab.label}</span>
            </button>
          );
        })}

        {/* Dark mode toggle at bottom of sidebar */}
        <div className="flex-1" />
        <button
          onClick={toggle}
          className="flex flex-col items-center gap-1 py-3 px-1 rounded-xl cursor-pointer w-full active:scale-95 transition-all"
          style={{ background: 'var(--app-surface-hover)' }}
          title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {dark
            ? <Sun size={20} style={{ color: '#F59E0B' }} />
            : <Moon size={20} style={{ color: 'var(--app-text-muted)' }} />}
          <span style={{ color: 'var(--app-text-muted)', fontSize: 10, fontWeight: 500 }}>{dark ? 'Light' : 'Dark'}</span>
        </button>
      </nav>
    </>
  );
}
