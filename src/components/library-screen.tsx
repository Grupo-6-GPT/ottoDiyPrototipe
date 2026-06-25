import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Play, Pencil, Trash2, Plus, Layers, Clock, Hash, Repeat, X, Download, ChevronDown, ChevronUp, Music2, ArrowUpDown } from 'lucide-react';
import { useSavedChoreographies, useSteps, type Choreography, useUI, getStepEstimatedDuration } from '../store';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <motion.div
        className="relative w-full max-w-xs rounded-2xl p-5"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)' }}
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
      >
        <h3 className="mb-2" style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>Delete "{name}"?</h3>
        <p className="mb-4" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'transparent', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600 }}>Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChoreoDetail({ choreo, onClose, onPlay, onEdit, onDelete, onExport, onUpdate }: {
  choreo: Choreography; onClose: () => void; onPlay: () => void; onEdit: () => void;
  onDelete: () => void; onExport: () => void; onUpdate: (updates: Partial<Choreography>) => void;
}) {
  const totalMs = choreo.steps.reduce((a, s) => a + getStepEstimatedDuration(s), 0);
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState(choreo.name);
  const [bpm, setBpm] = useState(choreo.bpm);
  const [loop, setLoop] = useState(choreo.loop);
  const [youtubeUrl, setYoutubeUrl] = useState(choreo.youtubeUrl || '');
  const [audioUrl, setAudioUrl] = useState(choreo.audioUrl || '');

  const handleSaveMeta = () => {
    if (!name.trim()) return;
    onUpdate({ name: name.trim(), bpm, loop, youtubeUrl: youtubeUrl || undefined, audioUrl: audioUrl || undefined });
    setEditingMeta(false);
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', borderBottom: 'none' }}
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: 'var(--app-text-ghost)' }} />
        <div className="px-5 pb-8 overflow-y-auto" style={{ maxHeight: '75vh', WebkitOverflowScrolling: 'touch' }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>{choreo.name}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: 'var(--app-bg)' }}>
              <X size={14} style={{ color: '#303090' }} />
            </button>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center gap-1" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}><Hash size={10} />{choreo.steps.length} steps</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}><Clock size={10} />{(totalMs/1000).toFixed(1)}s</span>
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>BPM {choreo.bpm}</span>
            {choreo.loop && <span className="flex items-center gap-1" style={{ color: '#6366F1', fontSize: 14 }}><Repeat size={10} />Loop</span>}
          </div>

          {/* Visual sequence */}
          <div className="flex gap-0.5 mb-3 flex-wrap">
            {choreo.steps.map((s, i) => (
              <div key={i} className="w-5 h-2.5 rounded-sm" style={{ background: `${s.color}35` }} />
            ))}
          </div>

          {/* Steps list */}
          <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--app-border-subtle)' }}>
              <span style={{ color: 'var(--app-text-muted)', fontSize: 14, fontWeight: 700, letterSpacing: '0.5px' }}>PASOS</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 200, WebkitOverflowScrolling: 'touch' }}>
              {choreo.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--app-border-subtle)' }}>
                  <span style={{ color: 'var(--app-text-muted)', fontSize: 14, fontWeight: 700, width: 18 }}>{i + 1}</span>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${s.color}0A` }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                  </div>
                  <span className="flex-1" style={{ color: 'var(--app-text-strong)', fontSize: 14 }}>{s.name}</span>
                  <span style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
                    {`${(getStepEstimatedDuration(s) / 1000).toFixed(1)}s`}
                    {s.repetitions > 1 && ` ×${s.repetitions}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Editar información */}
          <button
            onClick={() => setEditingMeta(v => !v)}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl mb-3 cursor-pointer transition-all"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: '#303090', fontSize: 14, fontWeight: 600 }}
          >
            <Pencil size={12} />
            Editar información
            {editingMeta ? <ChevronUp size={12} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={12} style={{ marginLeft: 'auto' }} />}
          </button>

          <AnimatePresence>
            {editingMeta && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 pb-3">
                  {/* Nombre */}
                  <div>
                    <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 5 }}>Nombre</p>
                    <input
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ background: 'var(--app-surface)', border: `1px solid ${name.trim() ? '#A4A4D2' : '#B2B2D2'}`, color: 'var(--app-text-primary)', fontSize: 14 }}
                    />
                  </div>

                  {/* BPM */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>BPM</p>
                      <span style={{ color: '#6366F1', fontSize: 14, fontWeight: 700 }}>{bpm}</span>
                    </div>
                    <input type="range" min={60} max={200} step={5} value={bpm} onChange={e => setBpm(Number(e.target.value))} className="w-full" />
                  </div>

                  {/* Loop */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      onClick={() => setLoop(l => !l)}
                      className="w-10 h-6 rounded-full relative transition-all cursor-pointer"
                      style={{ background: loop ? '#A2A2D0' : '#EBEBF8', border: `1px solid ${loop ? '#8080C8' : '#B2B2D2'}` }}
                    >
                      <motion.div
                        className="w-4 h-4 rounded-full absolute top-0.5"
                        style={{ background: loop ? '#7C3AED' : '#5E5E9C' }}
                        animate={{ left: loop ? 20 : 4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      />
                    </button>
                    <span style={{ color: 'var(--app-text-heading)', fontSize: 14 }}>Loop</span>
                  </label>

                  {/* YouTube URL */}
                  <div>
                    <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 5 }}>URL de YouTube (opcional)</p>
                    <input
                      value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-primary)', fontSize: 14 }}
                    />
                  </div>

                  {/* Audio URL */}
                  <div>
                    <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 5 }}>URL de audio (opcional)</p>
                    <input
                      value={audioUrl} onChange={e => setAudioUrl(e.target.value)}
                      placeholder="URL de audio directo..."
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-primary)', fontSize: 14 }}
                    />
                  </div>

                  {/* Guardar cambios */}
                  <div className="flex gap-2">
                    <button onClick={() => setEditingMeta(false)} className="flex-1 py-2.5 rounded-xl cursor-pointer" style={{ background: 'transparent', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveMeta}
                      className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform"
                      style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600, opacity: name.trim() ? 1 : 0.4 }}
                    >
                      Guardar cambios
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onPlay} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}>
              <Play size={14} /> Play
            </button>
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', color: 'var(--app-text-heading)', fontSize: 14, fontWeight: 600 }}>
              <Pencil size={14} /> Editar pasos
            </button>
            <button onClick={onExport} className="w-12 flex items-center justify-center py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)' }}>
              <Download size={14} style={{ color: '#6366F1' }} />
            </button>
            <button onClick={onDelete} className="w-12 flex items-center justify-center py-3 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <Trash2 size={14} style={{ color: '#DC2626' }} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LibraryScreen() {
  const { choreos, remove, update } = useSavedChoreographies();
  const { loadSteps } = useSteps();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterMusic, setFilterMusic] = useState(false);
  const [filterLoop, setFilterLoop] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'steps' | 'duration'>('recent');
  const [selectedChoreo, setSelectedChoreo] = useState<Choreography | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Choreography | null>(null);

  const { setOverlayOpen } = useUI();
  useEffect(() => {
    setOverlayOpen(!!selectedChoreo || !!deleteTarget);
    return () => setOverlayOpen(false);
  }, [selectedChoreo, deleteTarget, setOverlayOpen]);

  const filtered = choreos
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(c => !filterMusic || !!(c.youtubeUrl || c.audioUrl))
    .filter(c => !filterLoop || c.loop)
    .sort((a, b) => {
      if (sortBy === 'steps') return b.steps.length - a.steps.length;
      if (sortBy === 'duration') return b.steps.reduce((s, x) => s + getStepEstimatedDuration(x), 0) - a.steps.reduce((s, x) => s + getStepEstimatedDuration(x), 0);
      return b.createdAt - a.createdAt;
    });
  const activeFilters = (filterMusic ? 1 : 0) + (filterLoop ? 1 : 0) + (sortBy !== 'recent' ? 1 : 0);

  const handlePlay = (c: Choreography) => { loadSteps(c.steps, { youtubeUrl: c.youtubeUrl, audioUrl: c.audioUrl, youtubeDuration: c.youtubeDuration }); navigate('/play'); };
  const handleEdit = (c: Choreography) => { loadSteps(c.steps, { youtubeUrl: c.youtubeUrl, audioUrl: c.audioUrl, youtubeDuration: c.youtubeDuration }); navigate(`/choreography?editId=${c.id}`); };
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
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 md:px-8 md:pt-8 max-w-7xl w-full mx-auto">
        <div className="md:flex md:items-center md:justify-between md:gap-8 md:mb-2">
          <div className="mb-3 md:mb-0">
            <h2 className="mb-0.5" style={{ color: 'var(--app-text-primary)', fontSize: 20, fontWeight: 800 }}>My Dances</h2>
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>{choreos.length} saved choreograph{choreos.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 md:mb-0 md:w-72 md:flex-shrink-0" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <Search size={14} style={{ color: 'var(--app-text-muted)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search dances..."
              className="flex-1 bg-transparent outline-none"
              style={{ color: '#101048', fontSize: 14 }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="cursor-pointer active:scale-90 transition-transform">
                <X size={12} style={{ color: 'var(--app-text-muted)' }} />
              </button>
            )}
          </div>
          {/* New dance button — desktop only */}
          <button
            onClick={() => navigate('/choreography')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all flex-shrink-0"
            style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={15} /> New Dance
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex-shrink-0 px-5 md:px-8 pb-2 max-w-7xl w-full mx-auto">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Filtro: con música */}
          <button
            onClick={() => setFilterMusic(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
            style={{
              background: filterMusic ? '#E0D9FF' : 'transparent',
              border: `1px solid ${filterMusic ? '#9494D4' : '#BDBDDB'}`,
              color: filterMusic ? '#6366F1' : '#5E5E9C',
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Music2 size={11} /> Con música
          </button>

          {/* Filtro: con loop */}
          <button
            onClick={() => setFilterLoop(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
            style={{
              background: filterLoop ? '#E0D9FF' : 'transparent',
              border: `1px solid ${filterLoop ? '#9494D4' : '#BDBDDB'}`,
              color: filterLoop ? '#7C3AED' : '#5E5E9C',
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Repeat size={11} /> Con loop
          </button>

          <div style={{ width: 1, background: '#BDBDDB', flexShrink: 0, margin: '4px 2px' }} />

          {/* Ordenar */}
          {(['recent', 'steps', 'duration'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
              style={{
                background: sortBy === opt ? '#FFFFFF' : 'transparent',
                border: `1px solid ${sortBy === opt ? '#A6A6D4' : '#BDBDDB'}`,
                color: sortBy === opt ? '#1E1E78' : '#5E5E9C',
                fontSize: 14, fontWeight: 600,
              }}
            >
              {opt === 'recent' && <><ArrowUpDown size={10} /> Recientes</>}
              {opt === 'steps' && <><Hash size={10} /> Más pasos</>}
              {opt === 'duration' && <><Clock size={10} /> Más largos</>}
            </button>
          ))}

          {/* Limpiar filtros */}
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterMusic(false); setFilterLoop(false); setSortBy('recent'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full whitespace-nowrap cursor-pointer flex-shrink-0"
              style={{ border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600, background: 'transparent' }}
            >
              <X size={10} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* List - scrollable */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 md:pb-8 md:px-8 max-w-7xl w-full mx-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div className="flex flex-col items-center justify-center py-14" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <Layers size={22} style={{ color: '#B2B2D2' }} />
              </div>
              <p style={{ color: 'var(--app-text-faint)', fontSize: 14, fontWeight: 600 }}>
                {search ? 'No results found' : 'No dances saved yet'}
              </p>
              <p style={{ color: '#B2B2D2', fontSize: 14, marginTop: 2 }}>
                {search ? 'Try a different search' : 'Build and save your first choreography'}
              </p>
              {!search && (
                <button onClick={() => navigate('/choreography')} className="mt-4 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}>
                  <Plus size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} /> Create Dance
                </button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(c => {
                const totalMs = c.steps.reduce((a, s) => a + getStepEstimatedDuration(s), 0);
                const secs = (totalMs / 1000).toFixed(1);
                return (
                  <motion.button
                    key={c.id}
                    className="p-3.5 rounded-xl cursor-pointer text-left w-full transition-all"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileTap={{ scale: 0.98, borderColor: '#A4A4D2' }}
                    onClick={() => setSelectedChoreo(c)}
                  >
                    {/* Color preview */}
                    <div className="flex gap-0.5 mb-2 overflow-hidden">
                      {c.steps.slice(0, 20).map((s, i) => (
                        <div key={i} className="w-4 h-2 rounded-sm" style={{ background: `${s.color}30` }} />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 style={{ color: '#101048', fontSize: 14, fontWeight: 700 }}>{c.name}</h3>
                      <span style={{ color: '#9E9EC8', fontSize: 14 }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1" style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
                        <Hash size={9} /> {c.steps.length}
                      </span>
                      <span className="flex items-center gap-1" style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
                        <Clock size={9} /> {secs}s
                      </span>
                      <span style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>BPM {c.bpm}</span>
                      {c.loop && <span className="flex items-center gap-1" style={{ color: '#6366F1', fontSize: 14 }}><Repeat size={9} /></span>}
                      {(c.youtubeUrl || c.audioUrl) && (
                        <span className="flex items-center gap-1" style={{ color: '#3B82F6', fontSize: 14 }}>
                          <Music2 size={9} /> Música
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-1.5 mt-2.5">
                      <span onClick={(e) => { e.stopPropagation(); handlePlay(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', color: '#6366F1', fontSize: 14, fontWeight: 600 }}>
                        <Play size={10} /> Play
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', color: 'var(--app-text-heading)', fontSize: 14, fontWeight: 600 }}>
                        <Pencil size={10} /> Edit
                      </span>
                      <div className="flex-1" />
                      <span onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600 }}>
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

      {/* FAB — mobile only */}
      <motion.button
        className="md:hidden fixed right-5 bottom-24 w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer z-40 active:scale-90 transition-transform"
        style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)' }}
        onClick={() => navigate('/choreography')}
        whileTap={{ scale: 0.9 }}
      >
        <Plus size={20} color="#7C3AED" />
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
            onUpdate={(changes) => { update(selectedChoreo.id, changes); setSelectedChoreo(prev => prev ? { ...prev, ...changes } : prev); toast.success('Información actualizada'); }}
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
