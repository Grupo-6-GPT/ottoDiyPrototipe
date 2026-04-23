import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Undo2, Play, Save, X, Copy, ChevronUp, ChevronDown, GripVertical, Eye, Plus } from 'lucide-react';
import { AVAILABLE_MOVES, CATEGORIES, useSteps, useSavedChoreographies, type Step } from '../store';
import { OttoRobot } from './otto-robot';
import { toast } from 'sonner';

type ViewMode = 'robot' | 'grid';

/* ── Haptic-like feedback ── */
function pulse() {
  if (navigator.vibrate) navigator.vibrate(15);
}

/* ── Move descriptions for intuitiveness ── */
const MOVE_DESCRIPTIONS: Record<string, string> = {
  WALK_F: 'Otto walks forward step by step',
  WALK_B: 'Otto walks backward step by step',
  TURN_L: 'Rotate body to the left',
  TURN_R: 'Rotate body to the right',
  SHAKE: 'Full body shake dance',
  JUMP: 'Both feet leave the ground',
  MOONWALK: 'Smooth backward slide move',
  SPIN: 'Full 360° rotation in place',
  TILT_L: 'Lean the body to the left',
  TILT_R: 'Lean the body to the right',
  STOMP: 'Stomp feet alternately',
  WIGGLE: 'Side to side wiggle motion',
  FREEZE: 'Hold position completely still',
  BEEP: 'Play a buzzer tone',
  MELODY: 'Play a short melody sequence',
  PAUSE: 'Wait before next move',
};

/* ── Duration picker ── */
function DurationPicker({ value, onChange, compact }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  const opts = [250, 500, 1000, 1500, 2000];
  const labels = ['¼s', '½s', '1s', '1½s', '2s'];
  return (
    <div className="flex gap-1">
      {opts.map((o, i) => (
        <button
          key={o}
          onClick={(e) => { e.stopPropagation(); onChange(o); pulse(); }}
          className="rounded cursor-pointer transition-all active:scale-90"
          style={{
            padding: compact ? '1px 5px' : '2px 6px',
            fontSize: compact ? 9 : 10, fontWeight: 600,
            background: value === o ? '#1E1E3A' : 'transparent',
            color: value === o ? '#C4B5FD' : '#3A3A5A',
            border: value === o ? '1px solid #2E2E50' : '1px solid transparent',
          }}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}

/* ── Slider ── */
function MiniSlider({ label, value, min, max, step, unit, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <span style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontSize: 11, fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, #1E1E30 ${((value - min) / (max - min)) * 100}%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}

/* ── Added step toast ── */
function StepAddedToast({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>Added: {name}</span>
    </div>
  );
}

/* ── Edit bottom sheet ── */
function EditSheet({ step, stepIndex, totalSteps, onClose, onUpdate, onDelete, onDuplicate, onReorder }: {
  step: Step; stepIndex: number; totalSteps: number;
  onClose: () => void; onUpdate: (id: string, u: Partial<Step>) => void;
  onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [speed, setSpeed] = useState(step.speed);
  const [reps, setReps] = useState(step.repetitions);
  const [duration, setDuration] = useState(step.duration);
  const [pauseAfter, setPauseAfter] = useState(step.pauseAfter || 0);
  const [soundFreq, setSoundFreq] = useState(step.soundFreq || 440);
  const isSound = step.command === 'BEEP' || step.command === 'MELODY';
  const desc = MOVE_DESCRIPTIONS[step.command] || '';

  const canUp = stepIndex > 0;
  const canDown = stepIndex < totalSteps - 1;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{ background: '#111120', border: '1px solid #1C1C30', borderBottom: 'none' }}
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: '#252540' }} />

        {/* Scrollable content */}
        <div className="px-5 pb-8 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 24px)', WebkitOverflowScrolling: 'touch' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}>
                <span style={{ fontSize: 18, color: step.color }}>{step.icon}</span>
              </div>
              <div>
                <h3 style={{ color: '#E8E8F0', fontSize: 16, fontWeight: 700 }}>{step.name}</h3>
                <span style={{ color: '#4A4A6A', fontSize: 11 }}>Step {stepIndex + 1} of {totalSteps} · {step.command}</span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: '#1A1A30' }}><X size={14} style={{ color: '#6A6A8A' }} /></button>
          </div>
          {desc && <p className="mb-4 ml-[52px]" style={{ color: '#4A4A6A', fontSize: 11, marginTop: -2 }}>{desc}</p>}

          {/* Reorder */}
          <div className="flex items-center gap-2 mb-4 px-2 py-2 rounded-xl" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
            <span style={{ color: '#4A4A6A', fontSize: 11, fontWeight: 600 }}>Position:</span>
            <button onClick={() => { if (canUp) { onReorder(stepIndex, stepIndex - 1); pulse(); } }} disabled={!canUp} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: '#151528', opacity: canUp ? 1 : 0.25 }}><ChevronUp size={14} style={{ color: '#818CF8' }} /></button>
            <span style={{ color: '#C4B5FD', fontSize: 13, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{stepIndex + 1}</span>
            <button onClick={() => { if (canDown) { onReorder(stepIndex, stepIndex + 1); pulse(); } }} disabled={!canDown} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{ background: '#151528', opacity: canDown ? 1 : 0.25 }}><ChevronDown size={14} style={{ color: '#818CF8' }} /></button>
            <div className="flex-1" />
            <button onClick={() => { onDuplicate(step.id); pulse(); toast.success('Step duplicated'); onClose(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer active:scale-90 transition-transform"
              style={{ background: '#151528', color: '#818CF8', fontSize: 11, fontWeight: 600 }}
            ><Copy size={12} /> Duplicate</button>
          </div>

          {/* Duration */}
          <MiniSlider label="Duration" value={duration} min={100} max={3000} step={50} unit="ms" color="#818CF8" onChange={setDuration} />
          <div className="h-3.5" />

          {/* Speed */}
          <p style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Speed</p>
          <div className="flex gap-2 mb-3.5">
            {(['slow', 'normal', 'fast'] as const).map(s => (
              <button key={s} onClick={() => { setSpeed(s); pulse(); }}
                className="flex-1 py-2.5 rounded-xl capitalize cursor-pointer transition-all active:scale-95"
                style={{
                  background: speed === s ? '#1A1A30' : 'transparent',
                  color: speed === s ? '#C4B5FD' : '#3A3A5A',
                  border: speed === s ? '1px solid #252545' : '1px solid #181828',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {s === 'slow' ? '🐢 Slow' : s === 'normal' ? '🚶 Normal' : '⚡ Fast'}
              </button>
            ))}
          </div>

          {/* Repetitions */}
          <p style={{ color: '#5A5A7A', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Repeat</p>
          <div className="flex gap-1.5 mb-3.5 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map(r => (
              <button key={r} onClick={() => { setReps(r); pulse(); }}
                className="flex-shrink-0 w-10 h-10 rounded-lg cursor-pointer transition-all active:scale-90"
                style={{
                  background: reps === r ? '#1A1A30' : 'transparent',
                  color: reps === r ? '#C4B5FD' : '#3A3A5A',
                  border: reps === r ? '1px solid #252545' : '1px solid #181828',
                  fontSize: 11, fontWeight: 700,
                }}
              >{r}×</button>
            ))}
          </div>

          {/* Pause after */}
          <MiniSlider label="Pause after" value={pauseAfter} min={0} max={2000} step={50} unit="ms" color="#FBBF24" onChange={setPauseAfter} />
          <div className="h-3.5" />

          {/* Sound config */}
          {isSound && (
            <>
              <MiniSlider label="Frequency" value={soundFreq} min={200} max={2000} step={50} unit="Hz" color="#A78BFA" onChange={setSoundFreq} />
              <div className="h-3.5" />
            </>
          )}

          {/* Summary */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
            <span style={{ color: '#4A4A6A', fontSize: 11 }}>Total time for this step:</span>
            <span style={{ color: '#C4B5FD', fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>
              {((duration + pauseAfter) * reps / 1000).toFixed(1)}s
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => { onDelete(step.id); pulse(); onClose(); toast('Step removed', { icon: '🗑️' }); }}
              className="py-3 px-5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
              style={{ background: '#160F12', color: '#F87171', border: '1px solid #2A1520', fontSize: 12, fontWeight: 600 }}
            ><Trash2 size={14} /> Delete</button>
            <button
              onClick={() => {
                onUpdate(step.id, { speed, repetitions: reps, duration, pauseAfter, soundFreq: isSound ? soundFreq : undefined });
                pulse(); onClose();
                toast.success('Step updated');
              }}
              className="flex-1 py-3 rounded-xl cursor-pointer transition-all active:scale-95"
              style={{ background: '#1A1A35', color: '#C4B5FD', border: '1px solid #2E2E55', fontSize: 13, fontWeight: 600 }}
            >Save Changes</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Move picker for robot-tap ── */
function MovePickerSheet({ bodyPart, onClose, onSelect }: {
  bodyPart: string; onClose: () => void;
  onSelect: (move: typeof AVAILABLE_MOVES[0], dur: number) => void;
}) {
  const [duration, setDuration] = useState(1000);
  const moves = AVAILABLE_MOVES.filter(m => m.bodyPart === bodyPart);
  const titles: Record<string, string> = { head: '🔊 Head / Sound', body: '💃 Body / Core', legs: '🦿 Legs / Movement' };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{ background: '#111120', border: '1px solid #1C1C30', borderBottom: 'none' }}
        initial={{ y: 250 }} animate={{ y: 0 }} exit={{ y: 250 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: '#252540' }} />
        <div className="px-5 pb-8 overflow-y-auto" style={{ maxHeight: '70vh', WebkitOverflowScrolling: 'touch' }}>
          <h3 className="mb-0.5" style={{ color: '#E8E8F0', fontSize: 15, fontWeight: 700 }}>{titles[bodyPart] || bodyPart}</h3>
          <p className="mb-3" style={{ color: '#4A4A6A', fontSize: 11 }}>Tap a move to add it. Set duration first.</p>
          <div className="mb-3"><DurationPicker value={duration} onChange={setDuration} /></div>
          <div className="flex flex-col gap-1.5">
            {moves.map(move => (
              <motion.button key={move.command}
                onClick={() => { onSelect(move, duration); pulse(); onClose(); }}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{ background: '#151528', border: '1px solid #1E1E35' }}
                whileTap={{ scale: 0.96, backgroundColor: '#1A1A35' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${move.color}10`, border: `1px solid ${move.color}20` }}>
                  <span style={{ fontSize: 16, color: move.color }}>{move.icon}</span>
                </div>
                <div className="flex-1 text-left">
                  <p style={{ color: '#D0D0E0', fontSize: 13, fontWeight: 600 }}>{move.name}</p>
                  <p style={{ color: '#3A3A5A', fontSize: 10 }}>{MOVE_DESCRIPTIONS[move.command]}</p>
                </div>
                <Plus size={14} style={{ color: move.color }} />
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Save modal ── */
function SaveModal({ stepsCount, totalTimeMs, onClose, onSave }: {
  stepsCount: number; totalTimeMs: number;
  onClose: () => void; onSave: (name: string, bpm: number, loop: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [bpm, setBpm] = useState(120);
  const [loop, setLoop] = useState(false);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl p-5"
        style={{ background: '#111120', border: '1px solid #1C1C30' }}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
      >
        <h3 className="mb-1" style={{ color: '#E8E8F0', fontSize: 16, fontWeight: 700 }}>Save Choreography</h3>
        <p className="mb-4" style={{ color: '#4A4A6A', fontSize: 11 }}>
          {stepsCount} steps · {(totalTimeMs / 1000).toFixed(1)}s total
        </p>

        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Give your dance a name..."
          autoFocus
          className="w-full px-3.5 py-3 rounded-xl mb-3 outline-none transition-all"
          style={{ background: '#0E0E1A', border: `1px solid ${name.trim() ? '#252545' : '#1E1E35'}`, color: '#E8E8F0', fontSize: 14 }}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name, bpm, loop); onClose(); } }}
        />

        <MiniSlider label="BPM" value={bpm} min={60} max={200} step={5} unit="" color="#818CF8" onChange={setBpm} />
        <div className="h-3" />

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            onClick={() => setLoop(!loop)}
            className="w-10 h-6 rounded-full relative transition-all cursor-pointer"
            style={{ background: loop ? '#252550' : '#1A1A2A', border: `1px solid ${loop ? '#3A3A6A' : '#1E1E35'}` }}
          >
            <motion.div
              className="w-4 h-4 rounded-full absolute top-0.5"
              style={{ background: loop ? '#C4B5FD' : '#3A3A5A' }}
              animate={{ left: loop ? 20 : 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          </button>
          <span style={{ color: '#B0B0C8', fontSize: 13 }}>Loop choreography</span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: 'transparent', border: '1px solid #1E1E35', color: '#5A5A7A', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button
            onClick={() => { if (!name.trim()) { toast.error('Enter a name'); return; } onSave(name, bpm, loop); onClose(); }}
            className="flex-1 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95"
            style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 13, fontWeight: 600, opacity: name.trim() ? 1 : 0.4 }}
          >Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Preview overlay ── */
function PreviewOverlay({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const totalDuration = steps.reduce((a, s) => {
    const mult = s.speed === 'fast' ? 0.5 : s.speed === 'slow' ? 2 : 1;
    return a + (s.duration + (s.pauseAfter || 0)) * s.repetitions * mult;
  }, 0);

  const cleanup = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    cleanup();
    setCurrent(0);
    setElapsed(0);

    let acc = 0;
    steps.forEach((step, i) => {
      const mult = step.speed === 'fast' ? 0.5 : step.speed === 'slow' ? 2 : 1;
      const stepTime = (step.duration + (step.pauseAfter || 0)) * step.repetitions * mult;
      if (i > 0) {
        const t = setTimeout(() => setCurrent(i), acc);
        timeoutsRef.current.push(t);
      }
      acc += stepTime;
    });

    // Elapsed counter
    const interval = setInterval(() => setElapsed(p => p + 100), 100);
    timeoutsRef.current.push(interval as any);

    // Finish
    const finishT = setTimeout(() => {
      clearInterval(interval);
      setPlaying(false);
    }, acc);
    timeoutsRef.current.push(finishT);

    return cleanup;
  }, [playing, steps, cleanup]);

  const restart = () => { setCurrent(0); setPlaying(true); };
  const currentStep = steps[current] || null;
  const progressPct = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(8,8,16,0.94)' }} onClick={onClose} />
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-5">
        
        {/* Title */}
        <p className="mb-4" style={{ color: '#5A5A7A', fontSize: 12, fontWeight: 600 }}>
          {playing ? 'Previewing choreography...' : 'Preview finished'}
        </p>

        {/* Robot - key on current command so animation restarts */}
        <div className="rounded-2xl p-4 mb-4 w-full flex items-center justify-center" style={{ background: '#0E0E1A', border: `1px solid ${currentStep ? currentStep.color + '25' : '#161628'}` }}>
          <OttoRobot
            key={playing ? `cmd-${current}` : 'idle'}
            size={180}
            activeCommand={playing && currentStep ? currentStep.command : null}
          />
        </div>

        {/* Current step info */}
        <AnimatePresence mode="wait">
          {currentStep && playing && (
            <motion.div
              key={current}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 w-full"
              style={{ background: '#111120', border: `1px solid ${currentStep.color}30` }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${currentStep.color}12`, border: `1px solid ${currentStep.color}25` }}>
                <motion.span
                  style={{ fontSize: 18 }}
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >{currentStep.icon}</motion.span>
              </div>
              <div className="flex-1">
                <p style={{ color: '#E8E8F0', fontSize: 13, fontWeight: 600 }}>{currentStep.name}</p>
                <p style={{ color: '#4A4A6A', fontSize: 10 }}>
                  {currentStep.duration}ms · {currentStep.speed} · ×{currentStep.repetitions}
                </p>
              </div>
              <div className="text-right">
                <p style={{ color: currentStep.color, fontSize: 14, fontWeight: 700 }}>{current + 1}</p>
                <p style={{ color: '#3A3A5A', fontSize: 10 }}>of {steps.length}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-full mb-2 rounded-full overflow-hidden" style={{ height: 3, background: '#161628' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: currentStep ? currentStep.color : '#818CF8', width: `${progressPct}%` }}
          />
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-4 max-w-full flex-wrap justify-center">
          {steps.map((s, i) => (
            <motion.div
              key={s.id}
              className="rounded-full"
              style={{
                width: i === current && playing ? 12 : 6,
                height: 6,
                background: i === current && playing ? s.color : i < current ? `${s.color}60` : '#1E1E30',
                transition: 'all 0.2s',
                borderRadius: 3,
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          {!playing && (
            <button onClick={restart} className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 13, fontWeight: 600 }}>
              <Play size={14} /> Replay
            </button>
          )}
          {playing && (
            <button onClick={() => { cleanup(); setPlaying(false); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#160F12', border: '1px solid #2A1520', color: '#F87171', fontSize: 13, fontWeight: 600 }}>
              <X size={14} /> Stop
            </button>
          )}
          <button onClick={onClose} className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#111120', border: '1px solid #1C1C30', color: '#6A6A8A', fontSize: 13, fontWeight: 600 }}>
            Close
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   MAIN CHOREOGRAPHY SCREEN
   ═══════════════════════════════════════ */
export function ChoreographyScreen() {
  const { steps, addStep, removeStep, updateStep, clearAll, undo, reorder, duplicateStep } = useSteps();
  const { save } = useSavedChoreographies();
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('robot');
  const [tappedPart, setTappedPart] = useState<string | null>(null);
  const [highlightPart, setHighlightPart] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSave, setShowSave] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const filteredMoves = activeCategory === 'all' ? AVAILABLE_MOVES : AVAILABLE_MOVES.filter(m => m.category === activeCategory);

  // Auto-scroll timeline to end when adding steps
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTo({ left: timelineRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [steps.length]);

  const handleAddMove = useCallback((move: typeof AVAILABLE_MOVES[0], duration: number) => {
    const s = addStep(move, duration);
    pulse();
    setLastAdded(s.id);
    setTimeout(() => setLastAdded(null), 600);
    if (move.bodyPart) { setHighlightPart(move.bodyPart); setTimeout(() => setHighlightPart(null), 500); }
    toast(<StepAddedToast name={move.name} icon={move.icon} />, { duration: 1200 });
  }, [addStep]);

  const handleRobotTap = (part: string) => {
    pulse();
    setTappedPart(part);
    setHighlightPart(part);
  };

  // After reorder in EditSheet, update the editing reference
  const handleReorder = useCallback((from: number, to: number) => {
    reorder(from, to);
  }, [reorder]);

  const totalTime = steps.reduce((a, s) => a + (s.duration + (s.pauseAfter || 0)) * s.repetitions, 0);
  const formatMs = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  const editIdx = editingStep ? steps.findIndex(s => s.id === editingStep.id) : -1;

  // Keep editingStep in sync with store
  useEffect(() => {
    if (editingStep) {
      const updated = steps.find(s => s.id === editingStep.id);
      if (!updated) setEditingStep(null);
    }
  }, [steps, editingStep]);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B14' }}>
      {/* Fixed header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 style={{ color: '#E8E8F0', fontSize: 18, fontWeight: 800 }}>Build Your Dance</h2>
            <p style={{ color: '#4A4A6A', fontSize: 11 }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''} · {formatMs(totalTime)}
              {steps.length > 0 && <span style={{ color: '#3A3A5A' }}> · Tap step to edit</span>}
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1C1C30' }}>
            {(['robot', 'grid'] as const).map(v => (
              <button key={v} onClick={() => { setViewMode(v); pulse(); }}
                className="px-3 py-1.5 capitalize cursor-pointer transition-all active:scale-95"
                style={{ background: viewMode === v ? '#1A1A30' : 'transparent', color: viewMode === v ? '#C4B5FD' : '#3A3A5A', fontSize: 11, fontWeight: 600 }}
              >{v === 'robot' ? '🤖 Robot' : '⊞ Grid'}</button>
            ))}
          </div>
        </div>

        {/* Timeline - horizontal scrollable */}
        <div
          ref={timelineRef}
          className="flex gap-1.5 overflow-x-auto pb-2"
          style={{ minHeight: 50, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {steps.length === 0 ? (
            <div className="flex items-center justify-center w-full py-3 rounded-xl" style={{ background: '#0E0E1A', border: '1px dashed #1A1A2A', color: '#2E2E48', fontSize: 12 }}>
              {viewMode === 'robot' ? '👆 Tap Otto\'s body parts to add steps' : '👆 Tap a move card to add it'}
            </div>
          ) : steps.map((step, i) => (
            <motion.button
              key={step.id}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-0 rounded-lg cursor-pointer"
              style={{
                background: editingStep?.id === step.id ? `${step.color}15` : '#0E0E1A',
                border: `1.5px solid ${editingStep?.id === step.id ? step.color + '55' : lastAdded === step.id ? step.color : '#181828'}`,
                minWidth: 44, height: 44,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setEditingStep(step); pulse(); }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{step.icon}</span>
              <span style={{ color: '#3A3A5A', fontSize: 7, fontWeight: 700 }}>{i + 1}</span>
              {step.repetitions > 1 && <span style={{ color: step.color, fontSize: 7, fontWeight: 700 }}>×{step.repetitions}</span>}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Scrollable main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
        {viewMode === 'robot' ? (
          <>
            {/* Robot interactive area */}
            <div className="p-3 rounded-2xl mb-3" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
              <p className="text-center mb-1" style={{ color: '#4A4A6A', fontSize: 11 }}>
                ���� Tap a part of Otto to see available moves
              </p>
              <OttoRobot size={170} interactive onPartTap={handleRobotTap} highlightPart={highlightPart} />
            </div>

            {/* All steps list */}
            {steps.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #161628' }}>
                  <span style={{ color: '#4A4A6A', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>ALL STEPS</span>
                  <span style={{ color: '#3A3A5A', fontSize: 10 }}>{steps.length} total</span>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 180, WebkitOverflowScrolling: 'touch' }}>
                  {steps.map((s, i) => (
                    <motion.button
                      key={s.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 w-full text-left cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid #111120', background: 'transparent' }}
                      whileTap={{ backgroundColor: '#151528' }}
                      onClick={() => { setEditingStep(s); pulse(); }}
                    >
                      <span style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, width: 18 }}>{i + 1}</span>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${s.color}0A`, border: `1px solid ${s.color}15` }}>
                        <span style={{ fontSize: 12 }}>{s.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: '#B0B0C8', fontSize: 12, fontWeight: 600 }}>{s.name}</p>
                      </div>
                      <span style={{ color: '#3A3A5A', fontSize: 10 }}>
                        {s.duration >= 1000 ? `${s.duration/1000}s` : `${s.duration}ms`}
                        {s.repetitions > 1 && ` ×${s.repetitions}`}
                        {s.speed !== 'normal' && ` · ${s.speed === 'fast' ? '⚡' : '🐢'}`}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Category pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => { setActiveCategory(c.key); pulse(); }}
                  className="px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all active:scale-95"
                  style={{
                    background: activeCategory === c.key ? '#1A1A30' : 'transparent',
                    color: activeCategory === c.key ? '#C4B5FD' : '#3A3A5A',
                    border: activeCategory === c.key ? '1px solid #252545' : '1px solid #161628',
                    fontSize: 11, fontWeight: 600,
                  }}
                >{c.label}</button>
              ))}
            </div>

            {/* Grid of moves */}
            <div className="grid grid-cols-2 gap-2">
              {filteredMoves.map(move => (
                <motion.button
                  key={move.command}
                  className="p-2.5 rounded-xl cursor-pointer text-left"
                  style={{ background: '#0E0E1A', border: '1px solid #161628' }}
                  whileTap={{ scale: 0.95, borderColor: move.color + '40' }}
                  onClick={() => handleAddMove(move, durations[move.command] || 1000)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${move.color}0A`, border: `1px solid ${move.color}18` }}>
                      <span style={{ fontSize: 14, color: move.color }}>{move.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: '#B0B0C8', fontSize: 11, fontWeight: 600 }}>{move.name}</p>
                    </div>
                  </div>
                  <p className="truncate mb-1.5 pl-10" style={{ color: '#3A3A5A', fontSize: 9 }}>{MOVE_DESCRIPTIONS[move.command]}</p>
                  <div className="pl-10">
                    <DurationPicker compact value={durations[move.command] || 1000} onChange={v => setDurations(d => ({ ...d, [move.command]: v }))} />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-[4.2rem] left-0 right-0 z-40">
        <div className="max-w-md mx-auto px-4 pt-5 pb-2" style={{ background: 'linear-gradient(to top, #0B0B14 65%, transparent)' }}>
          <div className="flex gap-1.5">
            <button onClick={() => { clearAll(); pulse(); toast('All steps cleared', { icon: '🗑️' }); }}
              disabled={steps.length === 0}
              className="px-2.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all active:scale-95"
              style={{ background: '#111120', border: '1px solid #1C1C30', color: '#F87171', fontSize: 10, fontWeight: 600, opacity: steps.length ? 1 : 0.3 }}
            ><Trash2 size={12} /> Clear</button>
            <button onClick={() => { undo(); pulse(); }}
              disabled={steps.length === 0}
              className="px-2.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all active:scale-95"
              style={{ background: '#111120', border: '1px solid #1C1C30', color: '#FBBF24', fontSize: 10, fontWeight: 600, opacity: steps.length ? 1 : 0.3 }}
            ><Undo2 size={12} /> Undo</button>
            <div className="flex-1" />
            <button onClick={() => { if (steps.length === 0) { toast.error('Add steps first'); return; } setShowPreview(true); pulse(); }}
              className="px-2.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all active:scale-95"
              style={{ background: '#111120', border: '1px solid #1E1E40', color: '#818CF8', fontSize: 10, fontWeight: 600, opacity: steps.length ? 1 : 0.3 }}
            ><Eye size={12} /> Preview</button>
            <button onClick={() => { if (steps.length === 0) { toast.error('Add steps first'); return; } setShowSave(true); pulse(); }}
              className="px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 transition-all active:scale-95"
              style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 10, fontWeight: 600, opacity: steps.length ? 1 : 0.3 }}
            ><Save size={12} /> Save</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editingStep && editIdx >= 0 && (
          <EditSheet
            key={editingStep.id}
            step={editingStep}
            stepIndex={editIdx}
            totalSteps={steps.length}
            onClose={() => setEditingStep(null)}
            onUpdate={(id, u) => { updateStep(id, u); }}
            onDelete={removeStep}
            onDuplicate={duplicateStep}
            onReorder={(from, to) => {
              handleReorder(from, to);
              // Update editing step to follow the moved item
              const movedStep = steps[from];
              if (movedStep) setTimeout(() => setEditingStep(prev => prev ? { ...prev } : null), 0);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {tappedPart && (
          <MovePickerSheet bodyPart={tappedPart} onClose={() => { setTappedPart(null); setHighlightPart(null); }} onSelect={handleAddMove} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSave && (
          <SaveModal
            stepsCount={steps.length}
            totalTimeMs={totalTime}
            onClose={() => setShowSave(false)}
            onSave={(name, bpm, loop) => {
              save(name, steps, { bpm, loop });
              pulse();
              toast.success(`"${name}" saved!`);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPreview && steps.length > 0 && (
          <PreviewOverlay steps={steps} onClose={() => setShowPreview(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}