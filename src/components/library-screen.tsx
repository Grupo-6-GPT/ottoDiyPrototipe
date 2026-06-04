import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Play, Pencil, Trash2, Plus, Layers, Clock, Hash, Repeat, X, Download } from 'lucide-react';
import { useSavedChoreographies, useSteps, type Choreography, useUI } from '../store';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <motion.div
        className="relative w-full max-w-xs rounded-2xl p-5"
        style={{ background: '#111120', border: '1px solid #1C1C30' }}
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
      >
        <h3 className="mb-2" style={{ color: '#E8E8F0', fontSize: 15, fontWeight: 700 }}>Delete "{name}"?</h3>
        <p className="mb-4" style={{ color: '#4A4A6A', fontSize: 12 }}>This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'transparent', border: '1px solid #1E1E35', color: '#5A5A7A', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#160F12', border: '1px solid #2A1520', color: '#F87171', fontSize: 13, fontWeight: 600 }}>Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChoreoDetail({ choreo, onClose, onPlay, onEdit, onDelete, onExport }: {
  choreo: Choreography; onClose: () => void; onPlay: () => void; onEdit: () => void; onDelete: () => void; onExport: () => void;
}) {
  const totalMs = choreo.steps.reduce((a, s) => a + (s.duration + (s.pauseAfter || 0)) * s.repetitions, 0);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{ background: '#111120', border: '1px solid #1C1C30', borderBottom: 'none' }}
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: '#252540' }} />
        <div className="px-5 pb-8 overflow-y-auto" style={{ maxHeight: '75vh', WebkitOverflowScrolling: 'touch' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ color: '#E8E8F0', fontSize: 17, fontWeight: 700 }}>{choreo.name}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: '#1A1A30' }}>
              <X size={14} style={{ color: '#6A6A8A' }} />
            </button>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center gap-1" style={{ color: '#4A4A6A', fontSize: 11 }}><Hash size={10} />{choreo.steps.length} steps</span>
            <span className="flex items-center gap-1" style={{ color: '#4A4A6A', fontSize: 11 }}><Clock size={10} />{(totalMs/1000).toFixed(1)}s</span>
            <span style={{ color: '#4A4A6A', fontSize: 11 }}>BPM {choreo.bpm}</span>
            {choreo.loop && <span className="flex items-center gap-1" style={{ color: '#818CF8', fontSize: 11 }}><Repeat size={10} />Loop</span>}
          </div>

          {/* Visual sequence */}
          <div className="flex gap-0.5 mb-3 flex-wrap">
            {choreo.steps.map((s, i) => (
              <div key={i} className="w-5 h-2.5 rounded-sm" style={{ background: `${s.color}35` }} />
            ))}
          </div>

          {/* Steps list */}
          <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid #131322' }}>
              <span style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>STEPS</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 200, WebkitOverflowScrolling: 'touch' }}>
              {choreo.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #111120' }}>
                  <span style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, width: 18 }}>{i + 1}</span>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${s.color}0A` }}>
                    <span style={{ fontSize: 11 }}>{s.icon}</span>
                  </div>
                  <span className="flex-1" style={{ color: '#8A8AA8', fontSize: 12 }}>{s.name}</span>
                  <span style={{ color: '#3A3A5A', fontSize: 10 }}>
                    {s.duration >= 1000 ? `${s.duration/1000}s` : `${s.duration}ms`}
                    {s.repetitions > 1 && ` ×${s.repetitions}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Serial commands preview */}
          <div className="rounded-xl overflow-hidden mb-4 p-3" style={{ background: '#0A0A12', border: '1px solid #131322' }}>
            <p className="mb-1.5" style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>SERIAL COMMANDS</p>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <code style={{ color: '#818CF8', fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre' }}>
                {choreo.steps.map(s => `${s.command}:${s.duration}:${s.speed[0].toUpperCase()}`).join('\n')}
              </code>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onPlay} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 13, fontWeight: 600 }}>
              <Play size={14} /> Play
            </button>
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#111120', border: '1px solid #1C1C30', color: '#B0B0C8', fontSize: 13, fontWeight: 600 }}>
              <Pencil size={14} /> Edit
            </button>
            <button onClick={onExport} className="w-12 flex items-center justify-center py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#111120', border: '1px solid #1C1C30' }}>
              <Download size={14} style={{ color: '#818CF8' }} />
            </button>
            <button onClick={onDelete} className="w-12 flex items-center justify-center py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#160F12', border: '1px solid #2A1520' }}>
              <Trash2 size={14} style={{ color: '#F87171' }} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LibraryScreen() {
  const { choreos, remove } = useSavedChoreographies();
  const { loadSteps } = useSteps();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedChoreo, setSelectedChoreo] = useState<Choreography | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Choreography | null>(null);

  const { setOverlayOpen } = useUI();
  useEffect(() => {
    setOverlayOpen(!!selectedChoreo || !!deleteTarget);
    return () => setOverlayOpen(false);
  }, [selectedChoreo, deleteTarget, setOverlayOpen]);

  const filtered = choreos
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);

  const handlePlay = (c: Choreography) => { loadSteps(c.steps); navigate('/play'); };
  const handleEdit = (c: Choreography) => { loadSteps(c.steps); navigate('/choreography'); };
  const handleExport = (c: Choreography) => {
    const data = JSON.stringify({
      name: c.name,
      bpm: c.bpm,
      loop: c.loop,
      commands: c.steps.map(s => ({ cmd: s.command, dur: s.duration, speed: s.speed, reps: s.repetitions })),
    }, null, 2);
    navigator.clipboard.writeText(data);
    toast.success('Copied JSON to clipboard');
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B14' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5">
        <h2 className="mb-0.5" style={{ color: '#E8E8F0', fontSize: 20, fontWeight: 800 }}>My Dances</h2>
        <p className="mb-3" style={{ color: '#4A4A6A', fontSize: 12 }}>{choreos.length} saved choreograph{choreos.length !== 1 ? 'ies' : 'y'}</p>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
          <Search size={14} style={{ color: '#3A3A5A' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search dances..."
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#D0D0E0', fontSize: 13 }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="cursor-pointer active:scale-90 transition-transform">
              <X size={12} style={{ color: '#3A3A5A' }} />
            </button>
          )}
        </div>
      </div>

      {/* List - scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div className="flex flex-col items-center justify-center py-14" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
                <Layers size={22} style={{ color: '#1E1E35' }} />
              </div>
              <p style={{ color: '#2E2E48', fontSize: 13, fontWeight: 600 }}>
                {search ? 'No results found' : 'No dances saved yet'}
              </p>
              <p style={{ color: '#1E1E35', fontSize: 11, marginTop: 2 }}>
                {search ? 'Try a different search' : 'Build and save your first choreography'}
              </p>
              {!search && (
                <button onClick={() => navigate('/choreography')} className="mt-4 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 12, fontWeight: 600 }}>
                  <Plus size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} /> Create Dance
                </button>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(c => {
                const totalMs = c.steps.reduce((a, s) => a + (s.duration + (s.pauseAfter || 0)) * s.repetitions, 0);
                const secs = Math.floor(totalMs / 1000);
                return (
                  <motion.button
                    key={c.id}
                    className="p-3.5 rounded-xl cursor-pointer text-left w-full transition-all"
                    style={{ background: '#0E0E1A', border: '1px solid #161628' }}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileTap={{ scale: 0.98, borderColor: '#252545' }}
                    onClick={() => setSelectedChoreo(c)}
                  >
                    {/* Color preview */}
                    <div className="flex gap-0.5 mb-2 overflow-hidden">
                      {c.steps.slice(0, 20).map((s, i) => (
                        <div key={i} className="w-4 h-2 rounded-sm" style={{ background: `${s.color}30` }} />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 style={{ color: '#D0D0E0', fontSize: 14, fontWeight: 700 }}>{c.name}</h3>
                      <span style={{ color: '#2A2A44', fontSize: 10 }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1" style={{ color: '#3A3A5A', fontSize: 10 }}>
                        <Hash size={9} /> {c.steps.length}
                      </span>
                      <span className="flex items-center gap-1" style={{ color: '#3A3A5A', fontSize: 10 }}>
                        <Clock size={9} /> {secs}s
                      </span>
                      <span style={{ color: '#3A3A5A', fontSize: 10 }}>BPM {c.bpm}</span>
                      {c.loop && <span className="flex items-center gap-1" style={{ color: '#818CF8', fontSize: 10 }}><Repeat size={9} /></span>}
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-1.5 mt-2.5">
                      <span onClick={(e) => { e.stopPropagation(); handlePlay(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: '#111120', border: '1px solid #1C1C30', color: '#818CF8', fontSize: 10, fontWeight: 600 }}>
                        <Play size={10} /> Play
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: '#111120', border: '1px solid #1C1C30', color: '#B0B0C8', fontSize: 10, fontWeight: 600 }}>
                        <Pencil size={10} /> Edit
                      </span>
                      <div className="flex-1" />
                      <span onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: '#160F12', border: '1px solid #2A1520', color: '#F87171', fontSize: 10, fontWeight: 600 }}>
                        <Trash2 size={10} />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB */}
      <motion.button
        className="fixed right-5 bottom-24 w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer z-40 active:scale-90 transition-transform"
        style={{ background: '#1A1A35', border: '1px solid #2E2E55' }}
        onClick={() => navigate('/choreography')}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={20} color="#C4B5FD" />
      </motion.button>

      {/* Detail sheet */}
      <AnimatePresence>
        {selectedChoreo && (
          <ChoreoDetail
            choreo={selectedChoreo}
            onClose={() => setSelectedChoreo(null)}
            onPlay={() => { handlePlay(selectedChoreo); setSelectedChoreo(null); }}
            onEdit={() => { handleEdit(selectedChoreo); setSelectedChoreo(null); }}
            onDelete={() => { setDeleteTarget(selectedChoreo); setSelectedChoreo(null); }}
            onExport={() => handleExport(selectedChoreo)}
          />
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDelete
            name={deleteTarget.name}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => { remove(deleteTarget.id); setDeleteTarget(null); toast('Dance deleted', { icon: '🗑️' }); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
