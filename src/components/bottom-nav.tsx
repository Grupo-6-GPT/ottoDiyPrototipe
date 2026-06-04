import { useNavigate, useLocation } from 'react-router';
import { Bluetooth, Layers, Play, FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { useUI } from '../store';

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

  if (overlayOpen) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[env(safe-area-inset-bottom)]" style={{ background: '#0B0B14' }}>
      <div className="flex justify-around items-center h-14 max-w-md mx-auto rounded-2xl my-1.5 px-1" style={{ background: '#141422', border: '1px solid #1E1E30' }}>
        {tabs.map(tab => {
          const active = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 relative rounded-xl transition-colors cursor-pointer active:scale-95"
              style={active ? { background: '#1E1E33' } : {}}
            >
              {active && (
                <motion.div
                  layoutId="navPill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: '#1E1E33', border: '1px solid #2A2A44' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={18} className="relative z-10" style={{ color: active ? '#C4B5FD' : '#4A4A6A' }} />
              <span className="relative z-10" style={{ color: active ? '#C4B5FD' : '#4A4A6A', fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}