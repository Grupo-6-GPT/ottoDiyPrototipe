import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import {
  Trash2, Undo2, Play, Save, X, Copy, ChevronUp, ChevronDown,
  Eye, Plus, Package, MapPin, ArrowDownToLine, GripVertical, Pencil, RotateCcw,
} from 'lucide-react';
import {
  AVAILABLE_MOVES, CATEGORIES, useSteps, useSavedChoreographies,
  getStepEstimatedDuration, expandStepsToCommands,
  type Step, useUI, type Choreography,
} from '../store';
import { useSearchParams, useNavigate } from 'react-router';
import { OttoRobot } from './otto-robot';
import { Slider } from './ui/slider';
import { toast } from 'sonner';

type ViewMode = 'robot' | 'grid';

function pulse() { if (navigator.vibrate) navigator.vibrate(15); }

const MOVE_DESCRIPTIONS: Record<string, string> = {
  WALK_F: 'Otto camina hacia adelante con pasos reales',
  WALK_B: 'Otto camina hacia atrás con pasos reales',
  WALK_F_FAST: 'Otto camina rápido hacia adelante',
  WALK_F_SLOW: 'Otto camina despacio hacia adelante',
  WALK_B_FAST: 'Otto retrocede rápido',
  WALK_B_SLOW: 'Otto retrocede despacio',
  TURN_L: 'Otto gira a la izquierda en su lugar',
  TURN_R: 'Otto gira a la derecha en su lugar',
  TURN_L_FAST: 'Otto gira rápido a la izquierda',
  TURN_R_FAST: 'Otto gira rápido a la derecha',
  JUMP: 'Otto salta con ambas piernas',
  MOONWALK: 'Otto hace moonwalk hacia adelante',
  MOONWALK_B: 'Otto hace moonwalk hacia atrás',
  SPIN: 'Otto gira 360° sobre sí mismo',
  SPIN_L: 'Otto gira lentamente hacia la izquierda',
  SPIN_R: 'Otto gira lentamente hacia la derecha',
  SPIN_L_FAST: 'Otto gira rápido hacia la izquierda',
  SPIN_R_FAST: 'Otto gira rápido hacia la derecha',
  MARCH_F: 'Otto marcha con pasos marcados hacia adelante',
  MARCH_B: 'Otto marcha con pasos marcados hacia atrás',
  SNEAK_F: 'Otto se desliza sigilosamente hacia adelante',
  SNEAK_B: 'Otto se desliza sigilosamente hacia atrás',
  STRUT_F: 'Otto camina con estilo hacia adelante',
  STRUT_B: 'Otto camina con estilo hacia atrás',
  SIDE_STEP_L: 'Otto da un paso lateral hacia la izquierda',
  SIDE_STEP_R: 'Otto da un paso lateral hacia la derecha',
  SIDE_STEP_FAST: 'Otto hace un paso lateral rápido',
  LEAN_L: 'Otto inclina su cuerpo a la izquierda',
  LEAN_R: 'Otto inclina su cuerpo a la derecha',
  LEAN_F: 'Otto inclina su cuerpo hacia adelante',
  LEAN_B: 'Otto inclina su cuerpo hacia atrás',
  BALANCE: 'Otto balancea suavemente su cuerpo',
  ROCK_LR: 'Otto oscila de izquierda a derecha',
  ROCK_LR_FAST: 'Otto oscila rápido de izquierda a derecha',
  ROCK_FB: 'Otto oscila adelante y atrás',
  WIDE_STAND: 'Otto abre las piernas en postura amplia',
  PIGEON_L: 'Otto adopta la postura pigeon hacia la izquierda',
  PIGEON_R: 'Otto adopta la postura pigeon hacia la derecha',
  KICK_L: 'Otto da una patada lateral con la pierna izquierda',
  KICK_R: 'Otto da una patada lateral con la pierna derecha',
  STOMP: 'Otto pisa fuerte con ambas piernas alternativamente',
  STOMP_L: 'Otto pisa fuerte con la pierna izquierda',
  STOMP_R: 'Otto pisa fuerte con la pierna derecha',
  STOMP_ALTERNATE: 'Otto da pisotones alternados',
  HI_FIVE_L: 'Otto levanta el pie izquierdo como un hi-five',
  HI_FIVE_R: 'Otto levanta el pie derecho como un hi-five',
  CROUCH: 'Otto se agacha y vuelve a erguirse',
  SQUAT: 'Otto baja en cuclillas y vuelve a subir',
  SQUAT_PULSE: 'Otto hace pulsaciones en cuclillas',
  SHAKE: 'Otto sacude su cuerpo de lado a lado',
  SHIMMY: 'Otto hace un shimmy de cadera',
  SHIMMY_SLOW: 'Otto hace un shimmy lento',
  WIGGLE: 'Otto menea su cuerpo de un lado a otro',
  TILT_L: 'Otto se inclina hacia la izquierda',
  TILT_R: 'Otto se inclina hacia la derecha',
  SWING: 'Otto balancea sus caderas suavemente',
  SWING_BIG: 'Otto balancea las caderas con amplitud',
  UPDOWN: 'Otto sube y baja con las piernas',
  UPDOWN_BIG: 'Otto sube y baja con energía',
  BOUNCE: 'Otto rebota ligeramente',
  BOUNCE_BIG: 'Otto rebota de manera exagerada',
  BODY_ROLL: 'Otto hace una ola corporal',
  BODY_ROLL_FAST: 'Otto hace una ola corporal rápida',
  WAVE_L: 'Otto mueve una onda de cadera hacia la izquierda',
  WAVE_R: 'Otto mueve una onda de cadera hacia la derecha',
  WAVE_FULL: 'Otto hace una ola completa de cuerpo',
  PULSE_LR: 'Otto pulsa de lado a lado',
  JITTER: 'Otto vibra rápido con los tobillos',
  JITTER_SMALL: 'Otto vibra ligeramente con los tobillos',
  DISCO_L: 'Otto hace un paso disco hacia la izquierda',
  DISCO_R: 'Otto hace un paso disco hacia la derecha',
  ROBOT_STEP: 'Otto camina como robot',
  ROBOT_STEP_FAST: 'Otto camina como robot rápido',
  ASCENDING: 'Otto gira con subida progresiva',
  TIPTOE: 'Otto se pone de puntillas mientras se mueve',
  ELECTRIC_SLIDE: 'Otto hace un electric slide lateral',
  SCARED: 'Otto se asusta y se encoge',
  HAPPY_DANCE: 'Otto realiza un baile feliz',
  SAD_WALK: 'Otto camina con actitud triste',
  DIZZY: 'Otto se ve mareado mientras gira',
  TIRED: 'Otto se mueve cansado',
  SNEEZE: 'Otto estornuda',
  COMBO_SALSA: 'Otto ejecuta una mini coreografía de salsa',
  COMBO_ROBOT: 'Otto ejecuta una mini coreografía robótica',
  COMBO_WAVE: 'Otto ejecuta una mini coreografía de ondas',
  COMBO_REGGAETON: 'Otto ejecuta una mini coreografía reggaetón',
  SMOOTH: 'Otto realiza un movimiento estilo Smooth Criminal',
  SHAKE_IT: 'Otto realiza un combo de sacudidas y onda',
  DEMO: 'Otto pasa por una rutina de demostración',
  FREEZE: 'Otto mantiene la pose quieto',
  HOME: 'Otto vuelve a la posición neutral',
  BEEP: 'Otto emite un bip corto',
  MELODY: 'Otto toca una pequeña melodía',
  PAUSE: 'Otto espera antes del siguiente paso',
};


function MiniSlider({
  label, value, min, max, step, unit, color, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; color: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>{label}</span>
        <span style={{ color, fontSize: 14, fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <div className="px-1 py-2 rounded-xl" style={{ background: 'var(--app-accent-tint)' }}>
        <Slider value={[value]} min={min} max={max} step={step}
          onValueChange={([next]) => onChange(next)} className="w-full" />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-[#383898]">
        <span>{min}</span><span>{Math.round((min + max) / 2)}</span><span>{max}</span>
      </div>
    </div>
  );
}

function StepAddedToast({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>Added: {name}</span>
    </div>
  );
}

interface PositionPickerProps {
  steps: Step[];
  label: string;
  icon: string;
  color: string;
  onChoose: (insertBeforeIndex: number) => void;
  onClose: () => void;
}

function PositionPickerSheet({
  steps, label, icon, color, onChoose, onClose,
}: PositionPickerProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-md md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', borderBottom: 'none' }}
        initial={{ y: 320 }} animate={{ y: 0 }} exit={{ y: 320 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: 'var(--app-text-ghost)' }} />
        <div className="px-5 pb-10 overflow-y-auto" style={{ maxHeight: '75vh', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>{label}</h3>
              <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Elige dónde insertarlo</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90"
              style={{ background: 'var(--app-accent-soft)' }}
            >
              <X size={14} style={{ color: '#303090' }} />
            </button>
          </div>

          <div className="flex flex-col gap-0">
            <InsertSlot
              label="Al inicio de la coreografía"
              color={color}
              onInsert={() => { onChoose(0); onClose(); pulse(); }}
            />
            {steps.map((s, i) => (
              <div key={s.id}>
                <div
                  className="flex items-center gap-2.5 px-3 py-2 my-0.5 rounded-xl"
                  style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                >
                  <span style={{ color: 'var(--app-text-muted)', fontSize: 14, fontWeight: 700, minWidth: 18 }}>
                    {i + 1}
                  </span>
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}0A`, border: `1px solid ${s.color}18` }}
                  >
                    <span style={{ fontSize: 14 }}>{s.isGroup ? '📦' : s.icon}</span>
                  </div>
                  <p className="truncate" style={{ color: 'var(--app-text-step)', fontSize: 14, fontWeight: 600, flex: 1 }}>
                    {s.name}
                  </p>
                  {s.isGroup && (
                    <span style={{ color: 'var(--app-text-accent)', fontSize: 14 }}>
                      {s.children?.length ?? 0} pasos
                    </span>
                  )}
                  {!s.isGroup && s.repetitions > 1 && (
                    <span style={{ color: 'var(--app-text-accent)', fontSize: 14 }}>×{s.repetitions}</span>
                  )}
                </div>
                <InsertSlot
                  label={
                    i === steps.length - 1
                      ? 'Al final de la coreografía'
                      : `Entre paso ${i + 1} y ${i + 2}`
                  }
                  color={color}
                  onInsert={() => { onChoose(i + 1); onClose(); pulse(); }}
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InsertSlot({
  label, color, onInsert,
}: { label: string; color: string; onInsert: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onInsert}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg cursor-pointer transition-all active:scale-98"
      style={{
        background: hovered ? `${color}12` : 'transparent',
        border: `1px dashed ${hovered ? color + '55' : '#A6A6D4'}`,
        marginTop: 2, marginBottom: 2,
      }}
      whileTap={{ scale: 0.97 }}
    >
      <ArrowDownToLine size={12} style={{ color: hovered ? color : '#7878A8', flexShrink: 0 }} />
      <span style={{
        color: hovered ? color : '#7878A8',
        fontSize: 14, fontWeight: 600, textAlign: 'left',
      }}>
        {label}
      </span>
    </motion.button>
  );
}

interface GroupBuilderProps {
  selectedIds: string[];
  steps: Step[];
  onClose: () => void;
  onConfirm: (name: string, reps: number, insertBeforeIndex: number) => void;
}

function GroupBuilderSheet({ selectedIds, steps, onClose, onConfirm }: GroupBuilderProps) {
  const [name, setName] = useState('Grupo');
  const [reps, setReps] = useState(1);
  const selectedSteps = steps.filter(s => selectedIds.includes(s.id));

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-md md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', borderBottom: 'none' }}
        initial={{ y: 320 }} animate={{ y: 0 }} exit={{ y: 320 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: 'var(--app-text-ghost)' }} />
        <div className="px-5 pb-10 overflow-y-auto" style={{ maxHeight: '75vh', WebkitOverflowScrolling: 'touch' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--app-accent-soft)', border: '1px solid var(--app-border-alt)' }}
              >
                <Package size={18} style={{ color: '#7C3AED' }} />
              </div>
              <div>
                <h3 style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>Crear grupo</h3>
                <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                  {selectedSteps.length} pasos seleccionados
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90"
              style={{ background: 'var(--app-accent-soft)' }}
            >
              <X size={14} style={{ color: '#303090' }} />
            </button>
          </div>

          <div
            className="flex gap-1.5 flex-wrap mb-4 p-2.5 rounded-xl"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            {selectedSteps.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}
              >
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ color: s.color, fontSize: 14, fontWeight: 600 }}>{s.name}</span>
              </div>
            ))}
          </div>

          <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Nombre del grupo
          </p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Intro, Coro, Final..."
            className="w-full px-3.5 py-3 rounded-xl mb-4 outline-none transition-all"
            style={{
              background: 'var(--app-surface)',
              border: `1px solid ${name.trim() ? '#A4A4D2' : '#B2B2D2'}`,
              color: 'var(--app-text-primary)', fontSize: 14,
            }}
          />

          <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Repeticiones
          </p>
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 8, 10].map(r => (
              <button
                key={r}
                onClick={() => { setReps(r); pulse(); }}
                className="w-10 h-10 rounded-lg cursor-pointer transition-all active:scale-90"
                style={{
                  background: reps === r ? '#EDE9FE' : 'transparent',
                  color: reps === r ? '#7C3AED' : '#5E5E9C',
                  border: reps === r ? '1px solid var(--app-border-alt)' : '1px solid var(--app-border-light)',
                  fontSize: 14, fontWeight: 700,
                }}
              >{r}×</button>
            ))}
          </div>

          <div
            className="flex items-center justify-between px-3 py-2 rounded-xl mb-4"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Duración estimada</span>
            <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700 }}>
              {(selectedSteps.reduce((a, s) => a + getStepEstimatedDuration(s), 0) * reps / 1000).toFixed(1)}s
            </span>
          </div>

          <button
            onClick={() => {
              if (!name.trim()) { toast.error('Escribe un nombre'); return; }
              onConfirm(name, reps, steps.length);
            }}
            className="w-full py-3 rounded-xl cursor-pointer transition-all active:scale-95"
            style={{
              background: '#7C3AED', border: '1px solid var(--app-border-accent)',
              color: '#FFFFFF', fontSize: 14, fontWeight: 600,
            }}
          >
            Crear grupo
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface EditSheetProps {
  step: Step;
  stepIndex: number;
  totalSteps: number;
  onClose: () => void;
  onUpdate: (id: string, u: Partial<Step>) => void;
  onDelete: (id: string) => void;
  onDuplicateHere: (id: string) => void;
  onDuplicateAtPosition: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onUngroup?: (id: string) => void;
  onDuplicateGroup?: (id: string) => void;
  onSetGroupRepetitions?: (id: string, reps: number) => void;
}

function EditSheet({
  step, stepIndex, totalSteps, onClose, onUpdate,
  onDelete, onDuplicateHere, onDuplicateAtPosition, onReorder,
  onUngroup, onDuplicateGroup, onSetGroupRepetitions,
}: EditSheetProps) {
  const [speed, setSpeed] = useState(step.speed);
  const [reps, setReps] = useState(step.repetitions);
  const [duration, setDuration] = useState(step.duration);
  const [pauseAfter, setPauseAfter] = useState(step.pauseAfter || 0);
  const [soundFreq, setSoundFreq] = useState(step.soundFreq || 440);
  const [groupExpanded, setGroupExpanded] = useState(false);
  const isSound = step.command === 'BEEP' || step.command === 'MELODY';
  const desc = MOVE_DESCRIPTIONS[step.command] || '';
  const canUp = stepIndex > 0;
  const canDown = stepIndex < totalSteps - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-md md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', borderBottom: 'none' }}
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: 'var(--app-text-ghost)' }} />
        <div
          className="px-5 pb-8 overflow-y-auto"
          style={{ maxHeight: 'calc(85vh - 24px)', WebkitOverflowScrolling: 'touch', paddingBottom: '6rem' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}
              >
                <span style={{ fontSize: 14, color: step.color }}>{step.icon}</span>
              </div>
              <div>
                <h3 style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>{step.name}</h3>
                <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                  Paso {stepIndex + 1} de {totalSteps} · {step.command}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90"
              style={{ background: 'var(--app-accent-soft)' }}
            >
              <X size={14} style={{ color: '#303090' }} />
            </button>
          </div>
          {desc && (
            <p className="mb-4 ml-[52px]" style={{ color: 'var(--app-text-secondary)', fontSize: 14, marginTop: -2 }}>
              {desc}
            </p>
          )}

          <div
            className="flex items-center gap-2 mb-4 px-2 py-2 rounded-xl"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 14, fontWeight: 600 }}>Posición:</span>
            <button
              onClick={() => { if (canUp) { onReorder(stepIndex, stepIndex - 1); pulse(); } }}
              disabled={!canUp}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90"
              style={{ background: 'var(--app-surface-hover)', opacity: canUp ? 1 : 0.25 }}
            >
              <ChevronUp size={14} style={{ color: '#6366F1' }} />
            </button>
            <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
              {stepIndex + 1}
            </span>
            <button
              onClick={() => { if (canDown) { onReorder(stepIndex, stepIndex + 1); pulse(); } }}
              disabled={!canDown}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90"
              style={{ background: 'var(--app-surface-hover)', opacity: canDown ? 1 : 0.25 }}
            >
              <ChevronDown size={14} style={{ color: '#6366F1' }} />
            </button>
            <div className="flex-1" />
            <button
              onClick={() => { onDuplicateHere(step.id); pulse(); toast.success('Paso duplicado justo después'); onClose(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer active:scale-90"
              style={{ background: 'var(--app-surface-hover)', color: '#6366F1', fontSize: 14, fontWeight: 600 }}
            >
              <Copy size={12} /> Duplicar aquí
            </button>
            <button
              onClick={() => { onDuplicateAtPosition(step.id); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer active:scale-90"
              style={{ background: 'var(--app-surface-hover)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}
              title="Elegir dónde duplicar"
            >
              <MapPin size={12} />
            </button>
          </div>

          {step.command === 'PAUSE' ? (
            <>
              <MiniSlider label="Duración de pausa" value={duration} min={100} max={10000} step={100} unit="ms" color="#6366F1" onChange={setDuration} />
              <div className="h-3.5" />
            </>
          ) : (
            <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
              <span style={{ color: 'var(--app-text-secondary)', fontSize: 14, fontWeight: 600 }}>Duración real del robot</span>
              <div style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                {(getStepEstimatedDuration(step) / 1000).toFixed(1)}s
              </div>
            </div>
          )}

          <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Velocidad</p>
          <div className="flex gap-2 mb-3.5">
            {(['slow', 'normal', 'fast'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setSpeed(s); pulse(); }}
                className="flex-1 py-2.5 rounded-xl capitalize cursor-pointer transition-all active:scale-95"
                style={{
                  background: speed === s ? '#EDE9FE' : 'transparent',
                  color: speed === s ? '#7C3AED' : '#5E5E9C',
                  border: speed === s ? '1px solid var(--app-border-alt)' : '1px solid var(--app-border-light)',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {s === 'slow' ? '🐢 Lento' : s === 'normal' ? '🚶 Normal' : '⚡ Rápido'}
              </button>
            ))}
          </div>

          {step.isGroup ? (
            <>
              <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700 }}>
                      Grupo · {(step.children?.length ?? 0)} pasos
                    </p>
                    <p style={{ color: 'var(--app-text-strong)', fontSize: 14 }}>
                      Repite ×{step.repetitions} · {step.children?.length ?? 0} pasos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {onDuplicateGroup && (
                      <button
                        onClick={() => { onDuplicateGroup(step.id); pulse(); onClose(); }}
                        className="px-2 py-1 rounded-lg"
                        style={{ background: 'transparent', color: '#7C3AED', fontSize: 14, fontWeight: 700, border: '1px solid var(--app-border-alt)' }}
                      >
                        Duplicar
                      </button>
                    )}
                    {onUngroup && (
                      <button
                        onClick={() => { onUngroup(step.id); pulse(); onClose(); }}
                        className="px-2 py-1 rounded-lg"
                        style={{ background: 'transparent', color: '#DC2626', fontSize: 14, fontWeight: 700, border: '1px solid var(--app-border-alt)' }}
                      >
                        Desagrupar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Repeticiones</p>
              <div className="flex gap-1.5 mb-3.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 8, 10].map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      setReps(r); pulse();
                      if (onSetGroupRepetitions) onSetGroupRepetitions(step.id, r);
                    }}
                    className="w-10 h-10 rounded-lg cursor-pointer transition-all active:scale-90"
                    style={{
                      background: reps === r ? '#EDE9FE' : 'transparent',
                      color: reps === r ? '#7C3AED' : '#5E5E9C',
                      border: reps === r ? '1px solid var(--app-border-alt)' : '1px solid var(--app-border-light)',
                      fontSize: 14, fontWeight: 700,
                    }}
                  >{r}×</button>
                ))}
              </div>

              <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Pasos del grupo</span>
                  <button
                    onClick={() => setGroupExpanded(e => !e)}
                    className="text-sm" style={{ color: 'var(--app-text-strong)' }}
                  >
                    {groupExpanded ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {groupExpanded && step.children?.map(c => (
                  <div key={c.id} className="mt-2 px-2 py-2 rounded-md" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-accent-tint)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${c.color}0A`, border: `1px solid ${c.color}15` }}>
                          <span style={{ fontSize: 14 }}>{c.icon}</span>
                        </div>
                        <div>
                          <div style={{ color: 'var(--app-text-heading)', fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ color: 'var(--app-text-accent)', fontSize: 14 }}>{c.command}</div>
                        </div>
                      </div>
                      <div style={{ color: '#7C3AED', fontWeight: 700 }}>
                        {(getStepEstimatedDuration(c) / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Repetir</p>
              <div className="flex gap-1.5 mb-3.5 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {[1, 2, 3, 4, 5, 6, 8, 10].map(r => (
                  <button
                    key={r}
                    onClick={() => { setReps(r); pulse(); }}
                    className="flex-shrink-0 w-10 h-10 rounded-lg cursor-pointer transition-all active:scale-90"
                    style={{
                      background: reps === r ? '#EDE9FE' : 'transparent',
                      color: reps === r ? '#7C3AED' : '#5E5E9C',
                      border: reps === r ? '1px solid var(--app-border-alt)' : '1px solid var(--app-border-light)',
                      fontSize: 14, fontWeight: 700,
                    }}
                  >{r}×</button>
                ))}
              </div>
            </>
          )}

          <MiniSlider label="Pausa después" value={pauseAfter} min={0} max={2000} step={50} unit="ms" color="#D97706" onChange={setPauseAfter} />
          <div className="h-3.5" />

          {isSound && (
            <>
              <MiniSlider label="Frecuencia" value={soundFreq} min={200} max={2000} step={50} unit="Hz" color="#8B5CF6" onChange={setSoundFreq} />
              <div className="h-3.5" />
            </>
          )}

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Tiempo total de este paso:</span>
            <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700, marginLeft: 'auto' }}>
              {((duration + pauseAfter) * reps / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(step.id); pulse(); onClose(); toast('Paso eliminado', { icon: '🗑️' }); }}
              className="py-3 px-5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontSize: 14, fontWeight: 600 }}
            >
              <Trash2 size={14} /> Eliminar
            </button>
            <button
              onClick={() => {
                onUpdate(step.id, { speed, repetitions: reps, duration, pauseAfter, soundFreq: isSound ? soundFreq : undefined });
                pulse(); onClose(); toast.success('Paso actualizado');
              }}
              className="flex-1 py-3 rounded-xl cursor-pointer transition-all active:scale-95"
              style={{ background: 'var(--app-accent-bg)', color: '#7C3AED', border: '1px solid var(--app-border-accent)', fontSize: 14, fontWeight: 600 }}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MovePickerSheet({ bodyPart, onClose, onSelect }: {
  bodyPart: string; onClose: () => void;
  onSelect: (move: (typeof AVAILABLE_MOVES)[number], dur: number) => void;
}) {
  const moves = AVAILABLE_MOVES.filter(m => m.bodyPart === bodyPart);
  const titles: Record<string, string> = {
    head: '🔊 Cabeza / Sonido',
    body: '💃 Cuerpo / Core',
    legs: '🦿 Piernas / Movimiento',
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-md md:max-w-lg md:mx-4 rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', borderBottom: 'none' }}
        initial={{ y: 250 }} animate={{ y: 0 }} exit={{ y: 250 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="w-8 h-1 rounded-full mx-auto mt-3 mb-3" style={{ background: 'var(--app-text-ghost)' }} />
        <div className="px-5 pb-8 overflow-y-auto" style={{ maxHeight: '70vh', WebkitOverflowScrolling: 'touch' }}>
          <h3 className="mb-0.5" style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>
            {titles[bodyPart] || bodyPart}
          </h3>
          <p className="mb-3" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
            Toca un paso para añadirlo.
          </p>
          <div className="mb-3 rounded-xl px-3 py-2" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <span style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Duración fija según el tiempo real del robot</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {moves.map(move => (
              <motion.button
                key={move.command}
                onClick={() => { onSelect(move, move.arduinoDuration); pulse(); onClose(); }}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{ background: 'var(--app-surface-hover)', border: '1px solid var(--app-border-muted)' }}
                whileTap={{ scale: 0.96, backgroundColor: '#E0D9FF' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${move.color}10`, border: `1px solid ${move.color}20` }}
                >
                  <span style={{ fontSize: 14, color: move.color }}>{move.icon}</span>
                </div>
                <div className="flex-1 text-left">
                  <p style={{ color: 'var(--app-text-deep)', fontSize: 14, fontWeight: 600 }}>{move.name}</p>
                  <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>{MOVE_DESCRIPTIONS[move.command]}</p>
                </div>
                <div className="text-right" style={{ minWidth: 64 }}>
                  {'parameterized' in move && move.parameterized ? (
                    <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 700 }}>Ajustable</span>
                  ) : (
                    <span style={{ color: '#404098', fontSize: 14, fontWeight: 700 }}>
                      {(move.arduinoDuration / 1000).toFixed(1)}s real
                    </span>
                  )}
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

function SaveModal({ stepsCount, totalTimeMs, onClose, onSave, initialData, isUpdate }: {
  stepsCount: number; totalTimeMs: number;
  onClose: () => void;
  onSave: (name: string, bpm: number, loop: boolean, youtubeUrl?: string, audioUrl?: string, youtubeDuration?: number) => void;
  initialData?: Partial<Choreography>;
  isUpdate?: boolean;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [bpm, setBpm] = useState(initialData?.bpm ?? 120);
  const [loop, setLoop] = useState(initialData?.loop ?? false);
  const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl || '');
  const [audioUrl, setAudioUrl] = useState(initialData?.audioUrl || '');
  const [loadingDuration, setLoadingDuration] = useState(false);
  const [youtubeDuration, setYoutubeDuration] = useState<number | undefined>(undefined);

  const extractVideoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      return null;
    } catch { return null; }
  };

  const fetchYoutubeDuration = async (url: string) => {
    const videoId = extractVideoId(url);
    if (!videoId) { toast.error('URL de YouTube inválida'); return; }

    setLoadingDuration(true);
    try {
      const res = await fetch(`/api/choreographies/youtube-duration?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'No se pudo obtener la duración');
        return;
      }
      const data = await res.json();
      const duration: number = data.seconds;
      setYoutubeDuration(duration);
      toast.success(`Duración: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} ✓`);
    } catch (err) {
      console.error(err);
      toast.error('Error al obtener duración del video');
    } finally {
      setLoadingDuration(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error('Escribe un nombre'); return; }
    onSave(name, bpm, loop, youtubeUrl || undefined, audioUrl || undefined, youtubeDuration);
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)' }}
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
      >
        <h3 className="mb-1" style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>
          {isUpdate ? 'Actualizar coreografía' : 'Guardar coreografía'}
        </h3>
        <p className="mb-4" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
          {stepsCount} pasos · {(totalTimeMs / 1000).toFixed(1)}s total
        </p>

        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Dale un nombre al baile..."
          autoFocus
          className="w-full px-3.5 py-3 rounded-xl mb-3 outline-none transition-all"
          style={{
            background: 'var(--app-surface)',
            border: `1px solid ${name.trim() ? '#A4A4D2' : '#B2B2D2'}`,
            color: 'var(--app-text-primary)', fontSize: 14,
          }}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { handleSave(); } }}
        />

        <MiniSlider label="BPM" value={bpm} min={60} max={200} step={5} unit="" color="#6366F1" onChange={setBpm} />
        <div className="h-3" />

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            onClick={() => setLoop(!loop)}
            className="w-10 h-6 rounded-full relative transition-all cursor-pointer"
            style={{ background: loop ? '#A2A2D0' : '#A6A6D4', border: `1px solid ${loop ? '#8080C8' : '#B2B2D2'}` }}
          >
            <motion.div
              className="w-4 h-4 rounded-full absolute top-0.5"
              style={{ background: loop ? '#7C3AED' : '#5E5E9C' }}
              animate={{ left: loop ? 20 : 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          </button>
          <span style={{ color: 'var(--app-text-heading)', fontSize: 14 }}>Loop coreografía</span>
        </label>

        <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          🎵 URL de YouTube (opcional)
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 px-3.5 py-2.5 rounded-lg outline-none transition-all"
            style={{
              background: 'var(--app-surface)',
              border: `1px solid ${youtubeUrl.trim() ? '#A4A4D2' : '#B2B2D2'}`,
              color: 'var(--app-text-primary)', fontSize: 14,
            }}
          />
          <button
            onClick={() => youtubeUrl.trim() && fetchYoutubeDuration(youtubeUrl)}
            disabled={!youtubeUrl.trim() || loadingDuration}
            className="px-3 py-2.5 rounded-lg cursor-pointer transition-all active:scale-95"
            style={{
              background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)',
              color: '#6366F1', fontSize: 14, fontWeight: 600,
              opacity: youtubeUrl.trim() && !loadingDuration ? 1 : 0.4,
            }}
          >
            {loadingDuration ? '⏳' : '✓'}
          </button>
        </div>
        {youtubeDuration && (
          <p style={{ color: 'var(--app-text-secondary)', fontSize: 14, marginBottom: 3 }}>
            Duración: {Math.floor(youtubeDuration / 60)}:{String(youtubeDuration % 60).padStart(2, '0')}
          </p>
        )}

        <p style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          🔊 Audio (extraído automáticamente o URL directo)
        </p>
        <input
          value={audioUrl}
          onChange={e => setAudioUrl(e.target.value)}
          placeholder="URL de audio (Spotify, SoundCloud, archivo.mp3, etc.)"
          className="w-full px-3.5 py-2.5 rounded-lg outline-none transition-all mb-3"
          style={{
            background: 'var(--app-surface)',
            border: `1px solid ${audioUrl.trim() ? '#A4A4D2' : '#B2B2D2'}`,
            color: 'var(--app-text-primary)', fontSize: 14,
          }}
        />
        {audioUrl && (
          <p style={{ color: '#059669', fontSize: 14, marginBottom: 3 }}>
            ✓ Audio configurado - se reproducirá al bailar
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95"
            style={{ background: 'transparent', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95"
            style={{
              background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)',
              color: '#7C3AED', fontSize: 14, fontWeight: 600,
              opacity: name.trim() ? 1 : 0.4,
            }}
          >
            {isUpdate ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PreviewOverlay({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const [cmdIdx, setCmdIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // topIdxMap[cmdIdx] = índice del step padre (para dots y chip display)
  const topIdxMapRef = useRef<number[]>([]);
  // animStepMap[cmdIdx] = el step hijo real (para animar el robot)
  const animStepMapRef = useRef<Step[]>([]);

  const commands = useMemo(() => expandStepsToCommands(steps), [steps]);
  const totalDuration = useMemo(() => commands.reduce((a, c) => a + c.durationMs, 0), [commands]);

  const cleanup = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    cleanup();
    setCmdIdx(0);
    setElapsed(0);

    const topIdxMap: number[] = [];
    const animStepMap: Step[] = [];

    function mapFlatten(step: Step, topIndex: number) {
      if (step.isGroup && step.children && step.children.length > 0) {
        const groupReps = Math.max(1, step.repetitions);
        for (let g = 0; g < groupReps; g++)
          for (const child of step.children) mapFlatten(child, topIndex);
        return;
      }
      const reps = Math.max(1, step.repetitions);
      for (let r = 0; r < reps; r++) {
        topIdxMap.push(topIndex);
        animStepMap.push(step);
        if (step.pauseAfter && step.pauseAfter > 0) {
          topIdxMap.push(topIndex);
          animStepMap.push(step);
        }
      }
    }
    for (let si = 0; si < steps.length; si++) mapFlatten(steps[si], si);
    topIdxMapRef.current = topIdxMap;
    animStepMapRef.current = animStepMap;

    let acc = 0;
    commands.forEach((_, idx) => {
      if (idx > 0) {
        const t = setTimeout(() => setCmdIdx(idx), acc);
        timeoutsRef.current.push(t);
      }
      acc += commands[idx].durationMs;
    });

    intervalRef.current = setInterval(() => setElapsed(p => p + 100), 100);
    const finishT = setTimeout(() => { cleanup(); setPlaying(false); }, acc);
    timeoutsRef.current.push(finishT);

    return cleanup;
  }, [playing, steps, cleanup, commands]);

  const topIndex = topIdxMapRef.current[cmdIdx] ?? 0;
  const currentAnimStep = animStepMapRef.current[cmdIdx] || null; // step hijo real para robot
  const progressPct = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: 'var(--app-preview-overlay)' }} onClick={onClose} />
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-5">
        <p className="mb-4" style={{ color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>
          {playing ? 'Previsualizando coreografía...' : 'Preview terminado'}
        </p>

        <div
          className="rounded-2xl p-4 mb-4 w-full flex items-center justify-center"
          style={{ background: 'var(--app-surface)', border: `1px solid ${currentAnimStep ? currentAnimStep.color + '25' : 'var(--app-border)'}` }}
        >
          <OttoRobot
            key={playing ? `cmd-${cmdIdx}` : 'idle'}
            size={180}
            activeCommand={playing && currentAnimStep ? currentAnimStep.command : null}
          />
        </div>

        <AnimatePresence mode="wait">
          {currentAnimStep && playing && (
            <motion.div
              key={cmdIdx}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 w-full"
              style={{ background: 'var(--app-surface)', border: `1px solid ${currentAnimStep.color}30` }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${currentAnimStep.color}12`, border: `1px solid ${currentAnimStep.color}25` }}
              >
                <motion.span style={{ fontSize: 14 }} animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
                  {currentAnimStep.icon}
                </motion.span>
              </div>
              <div className="flex-1">
                <p style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 600 }}>{currentAnimStep.name}</p>
                <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                  ~{(getStepEstimatedDuration(currentAnimStep) / 1000).toFixed(1)}s · {currentAnimStep.speed}
                </p>
              </div>
              <div className="text-right">
                <p style={{ color: currentAnimStep.color, fontSize: 14, fontWeight: 700 }}>{topIndex + 1}</p>
                <p style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>de {steps.length}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full mb-2 rounded-full overflow-hidden" style={{ height: 3, background: 'var(--app-border)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: currentAnimStep ? currentAnimStep.color : '#6366F1', width: `${progressPct}%` }}
          />
        </div>

        <div className="flex gap-1 mb-4 max-w-full flex-wrap justify-center">
          {steps.map((s, i) => (
            <motion.div
              key={s.id}
              className="rounded-full"
              style={{
                width: i === topIndex && playing ? 12 : 6,
                height: 6,
                background: i === topIndex && playing ? s.color : i < topIndex ? `${s.color}60` : 'var(--app-border-accent)',
                transition: 'all 0.2s',
                borderRadius: 3,
              }}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {!playing && (
            <button
              onClick={() => { setCmdIdx(0); setPlaying(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95"
              style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}
            >
              <Play size={14} /> Repetir
            </button>
          )}
          {playing && (
            <button
              onClick={() => { cleanup(); setPlaying(false); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600 }}
            >
              <X size={14} /> Parar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer active:scale-95"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)', color: '#303090', fontSize: 14, fontWeight: 600 }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface PositionPickerState {
  stepId: string;
  mode: 'duplicate';
}

function DraggableStepItem({ step, index, onEdit, onDragEnd }: {
  step: Step; index: number; onEdit: () => void; onDragEnd: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={step}
      dragListener={false}
      dragControls={controls}
      as="div"
      layout
      onDragEnd={onDragEnd}
      style={{ borderBottom: '1px solid var(--app-border-subtle)', listStyle: 'none', overflow: 'hidden' }}
      whileDrag={{
        scale: 1.025,
        backgroundColor: '#E0D9FF',
        boxShadow: '0 8px 28px rgba(100,100,180,0.25)',
        zIndex: 50,
        borderRadius: 8,
      }}
      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 w-full">
        {/* Drag handle */}
        <div
          onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          style={{ color: '#A0A0CA', paddingRight: 2 }}
        >
          <GripVertical size={13} />
        </div>
        <span style={{ color: 'var(--app-text-muted)', fontSize: 14, fontWeight: 700, width: 18 }}>{index + 1}</span>
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${step.color}0A`, border: `1px solid ${step.color}15` }}>
          <span style={{ fontSize: 14 }}>{step.isGroup ? '📦' : step.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ color: 'var(--app-text-heading)', fontSize: 14, fontWeight: 600 }}>{step.name}</p>
          {step.isGroup && (
            <p style={{ color: 'var(--app-text-strong)', fontSize: 14, marginTop: 2 }}>
              {step.children?.length ?? 0} pasos · ×{step.repetitions}
            </p>
          )}
        </div>
        <span style={{ color: 'var(--app-text-muted)', fontSize: 14, flexShrink: 0 }}>
          {`${(getStepEstimatedDuration(step) / 1000).toFixed(1)}s`}
          {!step.isGroup && step.repetitions > 1 && ` ×${step.repetitions}`}
        </span>
        {/* Botón editar */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); pulse(); }}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
          style={{ background: 'var(--app-surface-hover)', border: '1px solid var(--app-border-muted)' }}
        >
          <Pencil size={11} style={{ color: '#6366F1' }} />
        </button>
      </div>
    </Reorder.Item>
  );
}

function ActionBar({ steps, onClear, onUndo, onPreview, onSave }: {
  steps: Step[];
  onClear: () => void;
  onUndo: () => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onClear}
        disabled={steps.length === 0}
        className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
        style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 700, opacity: steps.length ? 1 : 0.3 }}
      >
        <Trash2 size={15} /> Borrar
      </button>
      <button
        onClick={onUndo}
        disabled={steps.length === 0}
        className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
        style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', color: '#D97706', fontSize: 14, fontWeight: 700, opacity: steps.length ? 1 : 0.3 }}
      >
        <Undo2 size={15} /> Undo
      </button>
      <div className="flex-1" />
      <button
        onClick={onPreview}
        className="px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
        style={{ background: '#EEF2FF', border: '1.5px solid #A5B4FC', color: '#4F46E5', fontSize: 14, fontWeight: 700, opacity: steps.length ? 1 : 0.3 }}
      >
        <Eye size={15} /> Preview
      </button>
      <button
        onClick={onSave}
        className="px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
        style={{ background: '#7C3AED', border: '1.5px solid #6D28D9', color: '#FFFFFF', fontSize: 14, fontWeight: 700, opacity: steps.length ? 1 : 0.3 }}
      >
        <Save size={15} /> Guardar
      </button>
    </div>
  );
}

export function ChoreographyScreen() {
  const {
    steps, meta, addStep, removeStep, updateStep, clearAll, undo, reorder, loadSteps,
    duplicateStep, duplicateStepAt,
    createGroupAt,
    ungroup, duplicateGroupAt, setGroupRepetitions,
  } = useSteps();
  const { save, choreos, update: updateChoreo } = useSavedChoreographies();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('editId');
  const editingChoreo = editId ? choreos.find(c => c.id === editId) : null;

  // Estado local para drag & drop — se sincroniza con el store solo al soltar
  const [localSteps, setLocalSteps] = useState<Step[]>(steps);
  const localStepsRef = useRef<Step[]>(steps);
  useEffect(() => {
    setLocalSteps(steps);
    localStepsRef.current = steps;
  }, [steps]);
  const commitDrag = useCallback(() => {
    loadSteps(localStepsRef.current, meta);
  }, [loadSteps, meta]);

  const [robotSize, setRobotSize] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 360 : 220
  );
  useEffect(() => {
    const update = () => setRobotSize(window.innerWidth >= 768 ? 360 : 220);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('robot');
  const [tappedPart, setTappedPart] = useState<string | null>(null);
  const [highlightPart, setHighlightPart] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSave, setShowSave] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showGroupBuilder, setShowGroupBuilder] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [positionPicker, setPositionPicker] = useState<PositionPickerState | null>(null);
  const [groupPositionPicker, setGroupPositionPicker] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const { setOverlayOpen } = useUI();

  const filteredMoves = activeCategory === 'all'
    ? AVAILABLE_MOVES
    : AVAILABLE_MOVES.filter(m => m.category === activeCategory);

  useEffect(() => {
    if (timelineRef.current)
      timelineRef.current.scrollTo({ left: timelineRef.current.scrollWidth, behavior: 'smooth' });
  }, [steps.length]);

  useEffect(() => {
    if (editingStep) {
      const updated = steps.find(s => s.id === editingStep.id);
      if (!updated) setEditingStep(null);
    }
  }, [steps, editingStep]);

  useEffect(() => {
    const anyOpen = !!editingStep || !!tappedPart || !!showSave || !!showPreview
      || !!showGroupBuilder || !!positionPicker || !!groupPositionPicker;
    setOverlayOpen(anyOpen);
    return () => setOverlayOpen(false);
  }, [editingStep, tappedPart, showSave, showPreview, showGroupBuilder,
    positionPicker, groupPositionPicker, setOverlayOpen]);

  const handleAddMove = useCallback((move: typeof AVAILABLE_MOVES[number], duration: number) => {
    const s = addStep(move, duration);
    pulse();
    setLastAdded(s.id);
    setTimeout(() => setLastAdded(null), 600);
    if (move.bodyPart) { setHighlightPart(move.bodyPart); setTimeout(() => setHighlightPart(null), 500); }
    toast(<StepAddedToast name={move.name} icon={move.icon} />, { duration: 1200 });
  }, [addStep]);

  const handleRobotTap = (part: string) => { pulse(); setTappedPart(part); setHighlightPart(part); };
  const handleReorder = useCallback((from: number, to: number) => reorder(from, to), [reorder]);

  const totalTime = steps.reduce((a, s) => a + getStepEstimatedDuration(s), 0);
  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const editIdx = editingStep ? steps.findIndex(s => s.id === editingStep.id) : -1;
  const pickerStep = positionPicker ? steps.find(s => s.id === positionPicker.stepId) ?? null : null;
  const pickerGroupStep = groupPositionPicker ? steps.find(s => s.id === groupPositionPicker) ?? null : null;

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--app-bg)' }}>

      <div className="flex-shrink-0 px-4 pt-3 pb-1 md:px-8 md:pt-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 800 }}>
                {editingChoreo ? `Editando: ${editingChoreo.name}` : 'Build Your Dance'}
              </h2>
              {editingChoreo && (
                <>
                  <button
                    onClick={() => setShowNewConfirm(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer active:scale-95 transition-transform flex-shrink-0"
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600 }}
                    title="Empezar una coreografía nueva"
                  >
                    <RotateCcw size={10} /> Nueva
                  </button>
                  <AnimatePresence>
                    {showNewConfirm && (
                      <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowNewConfirm(false)} />
                        <motion.div className="relative w-full max-w-xs rounded-2xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border-strong)' }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
                          <h3 className="mb-2" style={{ color: 'var(--app-text-primary)', fontSize: 14, fontWeight: 700 }}>¿Empezar desde cero?</h3>
                          <p className="mb-4" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>Los cambios no guardados se perderán.</p>
                          <div className="flex gap-2">
                            <button onClick={() => setShowNewConfirm(false)} className="flex-1 py-2.5 rounded-xl cursor-pointer" style={{ background: 'transparent', border: '1px solid var(--app-border-muted)', color: 'var(--app-text-accent)', fontSize: 14, fontWeight: 600 }}>Cancelar</button>
                            <button onClick={() => { clearAll(); navigate('/choreography'); setShowNewConfirm(false); }} className="flex-1 py-2.5 rounded-xl cursor-pointer active:scale-95" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14, fontWeight: 600 }}>Empezar nuevo</button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
            <p style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
              {steps.length} paso{steps.length !== 1 ? 's' : ''} · {formatMs(totalTime)}
              {steps.length > 0 && <span style={{ color: 'var(--app-text-muted)' }}> · Toca un paso para editar</span>}
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--app-border-strong)' }}>
            {(['robot', 'grid'] as const).map(v => (
              <button
                key={v}
                onClick={() => { setViewMode(v); pulse(); }}
                className="px-3 py-1.5 capitalize cursor-pointer transition-all active:scale-95"
                style={{
                  background: viewMode === v ? '#EDE9FE' : 'transparent',
                  color: viewMode === v ? '#7C3AED' : '#5E5E9C',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {v === 'robot' ? '🤖 Robot' : '⊞ Grid'}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={timelineRef}
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ minHeight: 72, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {steps.length === 0 ? (
            <div
              className="flex items-center justify-center w-full py-4 rounded-xl"
              style={{ background: 'var(--app-surface)', border: '1px dashed #A6A6D4', color: 'var(--app-text-muted)', fontSize: 14 }}
            >
              <span className="md:hidden">{viewMode === 'robot' ? '👆 Toca el cuerpo de Otto para agregar' : '👆 Toca una tarjeta para agregar'}</span>
              <span className="hidden md:inline">{viewMode === 'robot' ? '🖱 Haz click en Otto para agregar movimientos' : '🖱 Haz click en una tarjeta para agregar'}</span>
            </div>
          ) : steps.map((step, i) => (
            <motion.button
              key={step.id}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl cursor-pointer relative"
              style={{
                background: editingStep?.id === step.id ? `${step.color}18` : 'var(--app-surface)',
                border: `2px solid ${
                  editingStep?.id === step.id
                    ? step.color + '70'
                    : selectedIds.includes(step.id)
                      ? step.color
                      : lastAdded === step.id
                        ? step.color
                        : '#C0C0DC'
                }`,
                minWidth: 60, height: 64, padding: '0 8px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => { setEditingStep(step); pulse(); }}
            >
              {/* Checkbox de selección */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIds(prev =>
                    prev.includes(step.id)
                      ? prev.filter(id => id !== step.id)
                      : [...prev, step.id]
                  );
                }}
                className="absolute cursor-pointer"
                style={{
                  right: 5, top: 5, width: 16, height: 16, borderRadius: 4,
                  border: `1.5px solid ${selectedIds.includes(step.id) ? step.color : '#A2A2CC'}`,
                  background: selectedIds.includes(step.id) ? step.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {selectedIds.includes(step.id) && (
                  <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 900, lineHeight: 1 }}>✓</span>
                )}
              </button>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{step.isGroup ? '📦' : step.icon}</span>
              <span style={{ color: 'var(--app-text-secondary)', fontSize: 14, fontWeight: 700 }}>{i + 1}</span>
              {step.isGroup ? (
                <span style={{ color: step.color, fontSize: 14, fontWeight: 700 }}>
                  {step.children?.length ?? 0}p
                </span>
              ) : step.repetitions > 1 ? (
                <span style={{ color: step.color, fontSize: 14, fontWeight: 700 }}>×{step.repetitions}</span>
              ) : null}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              className="flex items-center gap-2 py-2"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            >
              <span style={{ color: '#7C3AED', fontSize: 14, fontWeight: 600 }}>
                {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              {selectedIds.length >= 2 && (
                <button
                  onClick={() => setShowGroupBuilder(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer active:scale-95 transition-transform"
                  style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-border-accent)', color: '#7C3AED', fontSize: 14, fontWeight: 600 }}
                >
                  <Package size={11} /> Agrupar
                </button>
              )}
              <button
                onClick={() => setSelectedIds([])}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer active:scale-95"
                style={{ background: 'transparent', border: '1px solid var(--app-border-strong)', color: 'var(--app-text-accent)', fontSize: 14 }}
              >
                <X size={11} /> Limpiar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pb-[12rem] md:px-8 md:pb-28"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {viewMode === 'robot' ? (
          <>
          <div className="md:grid md:grid-cols-2 md:gap-6 md:h-[calc(100dvh-260px)]">

            {/* Izquierda: robot */}
            <div
              className="p-3 rounded-2xl mb-3 md:mb-0 md:flex md:flex-col md:items-center md:justify-center md:overflow-hidden"
              style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            >
              <p className="text-center mb-1" style={{ color: 'var(--app-text-secondary)', fontSize: 14 }}>
                <span className="md:hidden">👆 Toca</span>
                <span className="hidden md:inline">🖱 Haz click en</span>
                {' '}una parte de Otto para ver los movimientos
              </p>
              <OttoRobot size={robotSize} interactive onPartTap={handleRobotTap} highlightPart={highlightPart} />
            </div>

            {/* Derecha: lista de pasos */}
            {steps.length === 0 ? (
              <div className="hidden md:flex flex-col items-center justify-center rounded-xl md:h-full" style={{ background: 'var(--app-surface)', border: '1px dashed #EBEBF8' }}>
                <span style={{ color: 'var(--app-text-faint)', fontSize: 14 }}>Toca el robot para agregar pasos</span>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden md:flex md:flex-col md:h-full" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <div
                  className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                  style={{ borderBottom: '1px solid var(--app-border)' }}
                >
                  <span style={{ color: 'var(--app-text-secondary)', fontSize: 14, fontWeight: 700, letterSpacing: '0.5px' }}>
                    TODOS LOS PASOS
                  </span>
                  <span style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>{steps.length} total</span>
                </div>
                <Reorder.Group
                  axis="y"
                  values={localSteps}
                  onReorder={(newOrder) => {
                    localStepsRef.current = newOrder;
                    setLocalSteps(newOrder);
                  }}
                  as="div"
                  className="overflow-y-auto flex-1 max-h-[180px] md:max-h-none"
                  style={{ WebkitOverflowScrolling: 'touch', overflowX: 'hidden' }}
                >
                  {localSteps.map((s, i) => (
                    <DraggableStepItem
                      key={s.id}
                      step={s}
                      index={i}
                      onEdit={() => { commitDrag(); setEditingStep(s); }}
                      onDragEnd={commitDrag}
                    />
                  ))}
                </Reorder.Group>
              </div>
            )}
          </div>

          {/* Barra de acciones estática — solo en desktop, solo en robot mode */}
          <div className="hidden md:block mt-4">
            <ActionBar
              steps={steps}
              onClear={() => { clearAll(); setSelectedIds([]); pulse(); toast('Pasos borrados', { icon: '🗑️' }); }}
              onUndo={() => { undo(); pulse(); }}
              onPreview={() => { if (steps.length === 0) { toast.error('Agrega pasos primero'); return; } setShowPreview(true); pulse(); }}
              onSave={() => { if (steps.length === 0) { toast.error('Agrega pasos primero'); return; } setShowSave(true); pulse(); }}
            />
          </div>
          </>
        ) : (
          <>
            <div
              className="flex gap-1.5 overflow-x-auto pb-2 mb-2"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
            >
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => { setActiveCategory(c.key); pulse(); }}
                  className="px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition-all active:scale-95"
                  style={{
                    background: activeCategory === c.key ? '#EDE9FE' : 'transparent',
                    color: activeCategory === c.key ? '#7C3AED' : '#5E5E9C',
                    border: activeCategory === c.key ? '1px solid var(--app-border-alt)' : '1px solid var(--app-border)',
                    fontSize: 14, fontWeight: 600,
                  }}
                >{c.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredMoves.map(move => (
                <motion.button
                  key={move.command}
                  className="p-2.5 rounded-xl cursor-pointer text-left"
                  style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
                  whileTap={{ scale: 0.95, borderColor: move.color + '40' }}
                  onClick={() => handleAddMove(move, move.arduinoDuration)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${move.color}0A`, border: `1px solid ${move.color}18` }}
                    >
                      <span style={{ fontSize: 14, color: move.color }}>{move.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: 'var(--app-text-heading)', fontSize: 14, fontWeight: 600 }}>
                        {move.name}
                      </p>
                    </div>
                  </div>
                  <p className="truncate mb-1 pl-10" style={{ color: 'var(--app-text-muted)', fontSize: 14 }}>
                    {MOVE_DESCRIPTIONS[move.command]}
                  </p>
                  <div className="pl-10">
                    <span style={{ color: '#7C3AED', fontSize: 12, fontWeight: 700 }}>
                      {(move.arduinoDuration / 1000).toFixed(1)}s
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Barra de acciones — fija en mobile siempre, fija en desktop solo en grid mode */}
      <div className={`fixed left-0 right-0 z-40 md:left-[72px] bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-0 ${viewMode === 'robot' ? 'md:hidden' : ''}`}>
        <div className="px-4 pt-5 pb-2 md:px-8" style={{ background: 'linear-gradient(to top, var(--app-bg) 65%, transparent)' }}>
          <ActionBar
            steps={steps}
            onClear={() => { clearAll(); setSelectedIds([]); pulse(); toast('Pasos borrados', { icon: '🗑️' }); }}
            onUndo={() => { undo(); pulse(); }}
            onPreview={() => { if (steps.length === 0) { toast.error('Agrega pasos primero'); return; } setShowPreview(true); pulse(); }}
            onSave={() => { if (steps.length === 0) { toast.error('Agrega pasos primero'); return; } setShowSave(true); pulse(); }}
          />
        </div>
      </div>

      <AnimatePresence>
        {editingStep && editIdx >= 0 && !positionPicker && !groupPositionPicker && (
          <EditSheet
            key={editingStep.id}
            step={editingStep}
            stepIndex={editIdx}
            totalSteps={steps.length}
            onClose={() => setEditingStep(null)}
            onUpdate={(id, u) => updateStep(id, u)}
            onDelete={(id) => { removeStep(id); }}
            onDuplicateHere={(id) => {
              duplicateStep(id);
              toast.success('Paso duplicado');
              setEditingStep(null);
            }}
            onDuplicateAtPosition={(id) => {
              setEditingStep(null);
              setPositionPicker({ stepId: id, mode: 'duplicate' });
            }}
            onReorder={(from, to) => {
              handleReorder(from, to);
              setTimeout(() => setEditingStep(prev => prev ? { ...prev } : null), 0);
            }}
            onUngroup={(id) => { ungroup(id); setEditingStep(null); toast.success('Grupo desagrupado'); }}
            onDuplicateGroup={(id) => {
              setEditingStep(null);
              setGroupPositionPicker(id);
            }}
            onSetGroupRepetitions={(id, reps) => { setGroupRepetitions(id, reps); toast.success('Repeticiones actualizadas'); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tappedPart && (
          <MovePickerSheet
            bodyPart={tappedPart}
            onClose={() => { setTappedPart(null); setHighlightPart(null); }}
            onSelect={handleAddMove}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupBuilder && selectedIds.length >= 2 && (
          <GroupBuilderSheet
            selectedIds={selectedIds}
            steps={steps}
            onClose={() => setShowGroupBuilder(false)}
            onConfirm={(name, reps, insertBeforeIndex) => {
              createGroupAt(selectedIds, insertBeforeIndex, name, reps);
              setSelectedIds([]);
              setShowGroupBuilder(false);
              toast.success(`Grupo "${name}" creado`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {positionPicker && pickerStep && (
          <PositionPickerSheet
            steps={steps}
            label={`Duplicar "${pickerStep.name}"`}
            icon={pickerStep.isGroup ? '📦' : pickerStep.icon}
            color={pickerStep.color}
            onChoose={(insertBeforeIndex) => {
              duplicateStepAt(positionPicker.stepId, insertBeforeIndex);
              setPositionPicker(null);
              toast.success('Paso duplicado en posición elegida');
            }}
            onClose={() => setPositionPicker(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupPositionPicker && pickerGroupStep && (
          <PositionPickerSheet
            steps={steps}
            label={`Duplicar grupo "${pickerGroupStep.name}"`}
            icon="📦"
            color={pickerGroupStep.color}
            onChoose={(insertBeforeIndex) => {
              duplicateGroupAt(groupPositionPicker, insertBeforeIndex);
              setGroupPositionPicker(null);
              toast.success('Grupo duplicado en posición elegida');
            }}
            onClose={() => setGroupPositionPicker(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSave && (
          <SaveModal
            stepsCount={steps.length}
            totalTimeMs={totalTime}
            onClose={() => setShowSave(false)}
            isUpdate={!!editingChoreo}
            initialData={editingChoreo ?? undefined}
            onSave={(name, bpm, loop, youtubeUrl, audioUrl, youtubeDuration) => {
              if (editingChoreo) {
                updateChoreo(editingChoreo.id, { name, steps, bpm, loop, youtubeUrl, audioUrl, youtubeDuration });
                pulse();
                toast.success(`"${name}" actualizado`);
              } else {
                save(name, steps, { bpm, loop, youtubeUrl, audioUrl, youtubeDuration });
                pulse();
                toast.success(`"${name}" guardado`);
              }
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
