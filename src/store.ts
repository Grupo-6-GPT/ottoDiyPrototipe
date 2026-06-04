import { useState, useCallback, useSyncExternalStore } from 'react';
import {
  connectOttoRobot,
  disconnectOttoRobot,
  getOttoTransportMode,
  sendOttoRobotCommand,
  sendOttoSequence,
} from './lib/ottoBluetooth';

export interface Step {
  id: string;
  name: string;
  icon: string;
  command: string;
  duration: number; // ms — visual/display duration in the choreography builder
  speed: 'slow' | 'normal' | 'fast';
  repetitions: number;
  color: string;
  bodyPart: string;
  parameterized?: boolean;
  servoAngle?: number;
  soundFreq?: number;
  pauseAfter?: number;
}

export interface Choreography {
  id: string;
  name: string;
  steps: Step[];
  createdAt: number;
  bpm: number;
  loop: boolean;
}

/**
 * arduinoDuration: the ACTUAL time (ms) the ESP32 takes to finish the movement.
 * Used for sequencing BLE commands so the next command doesn't arrive before
 * the robot finishes the current one.
 *
 * Formula references (from otto-ble.ino):
 *  caminar(1, 220)     → 4 phases × 2 mover calls × 220ms + neutro(400) ≈ 2160ms
 *  caminarAtras(1,220) → same ≈ 2160ms
 *  girar(1,_,180)      → 2 mover calls × 180ms + neutro(400) ≈ 760ms
 *  shake()             → 4 × 240ms + neutro(400) ≈ 1360ms
 *  jumpMove()          → 150+120+250 ≈ 520ms
 *  moonwalk(2,180)     → 4×2×180ms×2 + neutro ≈ 3280ms … adjusted to 2 steps
 *  spinMove()          → 4×300ms + neutro ≈ 1600ms
 *  lean(28,400)        → 400 + neutro(250) ≈ 650ms
 *  stomp()             → 160+120+160+120+250 ≈ 810ms
 *  wiggle()            → 4×200ms + neutro(400) ≈ 1200ms
 *  freezeMove()        → 300ms
 */
export const AVAILABLE_MOVES = [
  { name: 'Caminar adelante',    icon: '↑',  command: 'WALK_F',          color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200, parameterized: true },
  { name: 'Caminar atrás',       icon: '↓',  command: 'WALK_B',          color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200, parameterized: true },
  { name: 'Girar izquierda',     icon: '←',  command: 'TURN_L',          color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 800,  parameterized: true },
  { name: 'Girar derecha',       icon: '→',  command: 'TURN_R',          color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 800,  parameterized: true },
  { name: 'Saltar',              icon: '⤴',  command: 'JUMP',            color: '#F472B6', bodyPart: 'legs', category: 'dance',    arduinoDuration: 550 },
  { name: 'Moonwalk adelante',    icon: '🌙',  command: 'MOONWALK',        color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 2000, parameterized: true },
  { name: 'Moonwalk atrás',      icon: '🌙',  command: 'MOONWALK_B',      color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 2000, parameterized: true },
  { name: 'Giro 360°',           icon: '↻',  command: 'SPIN',            color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1650 },
  { name: 'Giro izquierda lento', icon: '⟲',  command: 'SPIN_L',          color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Giro derecha lento',  icon: '⟳',  command: 'SPIN_R',          color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Marcha adelante',      icon: '🚶', command: 'MARCH_F',         color: '#60A5FA', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Marcha atrás',         icon: '🚶', command: 'MARCH_B',         color: '#60A5FA', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Sigilo adelante',      icon: '🐾', command: 'SNEAK_F',         color: '#34D399', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Sigilo atrás',         icon: '🐾', command: 'SNEAK_B',         color: '#34D399', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Strut adelante',       icon: '🕺', command: 'STRUT_F',         color: '#F59E0B', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Strut atrás',          icon: '🕺', command: 'STRUT_B',         color: '#F59E0B', bodyPart: 'legs', category: 'movement', arduinoDuration: 2200 },
  { name: 'Paso lateral izq',     icon: '⇦',  command: 'SIDE_STEP_L',     color: '#FBBF24', bodyPart: 'legs', category: 'movement', arduinoDuration: 1800 },
  { name: 'Paso lateral der',     icon: '⇨',  command: 'SIDE_STEP_R',     color: '#FBBF24', bodyPart: 'legs', category: 'movement', arduinoDuration: 1800 },
  { name: 'Paso lateral rápido',  icon: '⇆',  command: 'SIDE_STEP_FAST',  color: '#FBBF24', bodyPart: 'legs', category: 'movement', arduinoDuration: 1600 },
  { name: 'Inclinar izq',        icon: '⟧',  command: 'LEAN_L',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 700 },
  { name: 'Inclinar der',        icon: '⟨',  command: 'LEAN_R',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 700 },
  { name: 'Inclinar adelante',    icon: '⬆',  command: 'LEAN_F',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 700 },
  { name: 'Inclinar atrás',       icon: '⬇',  command: 'LEAN_B',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 700 },
  { name: 'Balanceo',            icon: '↔',  command: 'BALANCE',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Rock izq-der',        icon: '⤧',  command: 'ROCK_LR',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Rock rápido',         icon: '⚡',  command: 'ROCK_LR_FAST',    color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1200 },
  { name: 'Rock adelante-atrás', icon: '⤵',  command: 'ROCK_FB',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Postura abierta',      icon: '🦵', command: 'WIDE_STAND',      color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Pájaro izq',          icon: '🐦', command: 'PIGEON_L',        color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Pájaro der',          icon: '🐦', command: 'PIGEON_R',        color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Patada izq',          icon: '🥾', command: 'KICK_L',          color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Patada der',          icon: '🥾', command: 'KICK_R',          color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Stomp izq',           icon: '⬇',  command: 'STOMP_L',         color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Stomp der',           icon: '⬇',  command: 'STOMP_R',         color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Stomp alternado',     icon: '⬇',  command: 'STOMP_ALTERNATE', color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Hi-five izq',         icon: '✋',  command: 'HI_FIVE_L',       color: '#F59E0B', bodyPart: 'arms', category: 'expression', arduinoDuration: 650 },
  { name: 'Hi-five der',         icon: '✋',  command: 'HI_FIVE_R',       color: '#F59E0B', bodyPart: 'arms', category: 'expression', arduinoDuration: 650 },
  { name: 'Agacharse',           icon: '⤵',  command: 'CROUCH',          color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 700 },
  { name: 'Squat',              icon: '🏋️', command: 'SQUAT',           color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 1200 },
  { name: 'Squat pulse',        icon: '↯',  command: 'SQUAT_PULSE',     color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 1000 },
  { name: 'Shimmy',             icon: '💃', command: 'SHIMMY',          color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Shimmy lento',       icon: '💃', command: 'SHIMMY_SLOW',     color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 2000 },
  { name: 'Swing',              icon: '🌊', command: 'SWING',           color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Swing grande',       icon: '🌊', command: 'SWING_BIG',       color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1700 },
  { name: 'UpDown',             icon: '⬆⬇',command: 'UPDOWN',          color: '#6366F1', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'UpDown grande',      icon: '⬆⬇',command: 'UPDOWN_BIG',      color: '#6366F1', bodyPart: 'body', category: 'dance',    arduinoDuration: 1800 },
  { name: 'Bounce',             icon: '↕',  command: 'BOUNCE',          color: '#6366F1', bodyPart: 'body', category: 'dance',    arduinoDuration: 1500 },
  { name: 'Bounce grande',      icon: '↕',  command: 'BOUNCE_BIG',      color: '#6366F1', bodyPart: 'body', category: 'dance',    arduinoDuration: 1800 },
  { name: 'Body roll',          icon: '🌀', command: 'BODY_ROLL',       color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Body roll rápido',   icon: '🌀', command: 'BODY_ROLL_FAST',  color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1300 },
  { name: 'Wave izq',           icon: '〰', command: 'WAVE_L',          color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 900 },
  { name: 'Wave der',           icon: '〰', command: 'WAVE_R',          color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 900 },
  { name: 'Wave completa',      icon: '〰', command: 'WAVE_FULL',       color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1800 },
  { name: 'Pulse LR',          icon: '⚡',  command: 'PULSE_LR',        color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1000 },
  { name: 'Jitter',             icon: '⚡',  command: 'JITTER',          color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1200 },
  { name: 'Jitter pequeño',     icon: '⚡',  command: 'JITTER_SMALL',    color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1000 },
  { name: 'Disco izq',          icon: '🪩', command: 'DISCO_L',         color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Disco der',          icon: '🪩', command: 'DISCO_R',         color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Robot step',         icon: '🤖', command: 'ROBOT_STEP',      color: '#A78BFA', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Robot rápido',       icon: '🤖', command: 'ROBOT_STEP_FAST', color: '#A78BFA', bodyPart: 'body', category: 'dance',    arduinoDuration: 1200 },
  { name: 'Ascendente',         icon: '⬆',  command: 'ASCENDING',       color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Punta',              icon: '👣', command: 'TIPTOE',          color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Electric slide',     icon: '⚡',  command: 'ELECTRIC_SLIDE',  color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 1800 },
  { name: 'Asustado',           icon: '😱', command: 'SCARED',          color: '#F87171', bodyPart: 'body', category: 'expression', arduinoDuration: 800 },
  { name: 'Baile feliz',        icon: '😊', command: 'HAPPY_DANCE',     color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 2500 },
  { name: 'Caminar triste',     icon: '😥', command: 'SAD_WALK',        color: '#60A5FA', bodyPart: 'body', category: 'expression', arduinoDuration: 2200 },
  { name: 'Mareado',            icon: '😵', command: 'DIZZY',           color: '#F472B6', bodyPart: 'body', category: 'expression', arduinoDuration: 1200 },
  { name: 'Cansado',            icon: '😴', command: 'TIRED',           color: '#F472B6', bodyPart: 'body', category: 'expression', arduinoDuration: 1000 },
  { name: 'Estornudo',          icon: '🤧', command: 'SNEEZE',          color: '#F472B6', bodyPart: 'body', category: 'expression', arduinoDuration: 900 },
  { name: 'Combo salsa',        icon: '💃', command: 'COMBO_SALSA',     color: '#F97316', bodyPart: 'body', category: 'combo',    arduinoDuration: 2600 },
  { name: 'Combo robot',        icon: '🤖', command: 'COMBO_ROBOT',     color: '#8B5CF6', bodyPart: 'body', category: 'combo',    arduinoDuration: 2300 },
  { name: 'Combo wave',         icon: '🌊', command: 'COMBO_WAVE',      color: '#38BDF8', bodyPart: 'body', category: 'combo',    arduinoDuration: 2200 },
  { name: 'Combo reggaetón',    icon: '🎶', command: 'COMBO_REGGAETON', color: '#F43F5E', bodyPart: 'body', category: 'combo',    arduinoDuration: 2400 },
  { name: 'Smooth',             icon: '🕴', command: 'SMOOTH',          color: '#A78BFA', bodyPart: 'body', category: 'combo',    arduinoDuration: 2400 },
  { name: 'Shake it',           icon: '🎉', command: 'SHAKE_IT',        color: '#F472B6', bodyPart: 'body', category: 'combo',    arduinoDuration: 3200 },
  { name: 'Demo',               icon: '🎬', command: 'DEMO',            color: '#60A5FA', bodyPart: 'body', category: 'combo',    arduinoDuration: 4500 },
] as const;

export function getArduinoDuration(command: string): number {
  const move = AVAILABLE_MOVES.find(m => m.command === command);
  return move?.arduinoDuration ?? 1000;
}

export function getStepEstimatedDuration(step: Step): number {
  if (step.command === 'PAUSE') {
    return Math.max(step.duration, step.pauseAfter || 0, getArduinoDuration(step.command));
  }

  const base = getArduinoDuration(step.command);
  const speedMult = step.speed === 'fast' ? 0.6 : step.speed === 'slow' ? 1.6 : 1.0;
  let commandDuration = base * speedMult;

  if (step.command === 'WALK_F' || step.command === 'WALK_B') {
    const delayArg = Math.max(step.duration, 80);
    commandDuration = delayArg * 4 + 400;
  } else if (step.command === 'TURN_L' || step.command === 'TURN_R') {
    const delayArg = Math.max(step.duration, 80);
    commandDuration = delayArg * 2 + 400;
  } else if (step.command === 'MOONWALK') {
    const delayArg = Math.max(step.duration, 80);
    commandDuration = delayArg * 8 + 400;
  } else if (step.command === 'SPIN') {
    const delayArg = Math.max(step.duration, 80);
    commandDuration = delayArg * 8 + 400;
  }

  const pauseDuration = step.pauseAfter || 0;
  return Math.round((commandDuration + pauseDuration) * step.repetitions);
}

export const CATEGORIES = [
  { key: 'all',        label: 'All'        },
  { key: 'movement',   label: 'Movement'   },
  { key: 'dance',      label: 'Dance'      },
  { key: 'expression', label: 'Expression' },
  { key: 'sound',      label: 'Sound'      },
  { key: 'control',    label: 'Control'    },
  { key: 'combo',      label: 'Combo'      },
];

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      listeners.forEach(l => l());
    },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

const stepsStore = createStore<Step[]>([]);
const connectionStore = createStore<{
  connected: boolean;
  battery: number;
  deviceName: string | null;
  transportMode: 'bluetooth' | 'serial' | null;
}>({ connected: false, battery: 0, deviceName: null, transportMode: null });

const uiStore = createStore<{ overlayOpen: boolean }>({ overlayOpen: false });

export function useUI() {
  const state = useSyncExternalStore(uiStore.subscribe, uiStore.get);
  const setOverlayOpen = useCallback((v: boolean) => uiStore.set({ overlayOpen: v }), []);
  return { ...state, setOverlayOpen };
}

export function useSteps() {
  const steps = useSyncExternalStore(stepsStore.subscribe, stepsStore.get);

  const addStep = useCallback((move: typeof AVAILABLE_MOVES[number], duration: number, extra?: Partial<Step>) => {
    const newStep: Step = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: move.name,
      icon: move.icon,
      command: move.command,
      color: move.color,
      bodyPart: move.bodyPart,
      duration: move.parameterized ? duration : move.arduinoDuration,
      parameterized: move.parameterized,
      speed: 'normal',
      repetitions: 1,
      pauseAfter: 0,
      ...extra,
    };
    stepsStore.set(prev => [...prev, newStep]);
    return newStep;
  }, []);

  const removeStep    = useCallback((id: string) => stepsStore.set(prev => prev.filter(s => s.id !== id)), []);
  const updateStep    = useCallback((id: string, updates: Partial<Step>) => stepsStore.set(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)), []);
  const clearAll      = useCallback(() => stepsStore.set([]), []);
  const undo          = useCallback(() => stepsStore.set(prev => prev.slice(0, -1)), []);
  const loadSteps     = useCallback((s: Step[]) => stepsStore.set([...s]), []);
  const reorder       = useCallback((fromIdx: number, toIdx: number) => {
    stepsStore.set(prev => {
      const arr = [...prev];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
  }, []);
  const duplicateStep = useCallback((id: string) => {
    stepsStore.set(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: Date.now().toString() + Math.random().toString(36).slice(2) };
      const arr = [...prev];
      arr.splice(idx + 1, 0, copy);
      return arr;
    });
  }, []);

  return { steps, addStep, removeStep, updateStep, clearAll, undo, loadSteps, reorder, duplicateStep };
}

export function useConnection() {
  const state = useSyncExternalStore(connectionStore.subscribe, connectionStore.get);

  const connect = useCallback(async () => {
    const connection = await connectOttoRobot();
    connectionStore.set({ connected: true, battery: connection.battery, deviceName: connection.deviceName, transportMode: connection.mode });
    return connection;
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectOttoRobot();
    connectionStore.set({ connected: false, battery: 0, deviceName: null, transportMode: null });
  }, []);

  const sendCommand   = useCallback((command: string) => sendOttoRobotCommand(command), []);
  const sendSequence  = useCallback((commands: string[]) => sendOttoSequence(commands), []);

  return {
    ...state,
    connect,
    disconnect,
    sendCommand,
    sendSequence,
    transportMode: state.transportMode ?? getOttoTransportMode(),
  };
}

export function useSavedChoreographies() {
  const [choreos, setChoreos] = useState<Choreography[]>(() => {
    try { return JSON.parse(localStorage.getItem('ottodance_choreos') || '[]'); } catch { return []; }
  });

  const persist = (data: Choreography[]) => localStorage.setItem('ottodance_choreos', JSON.stringify(data));

  const save = useCallback((name: string, steps: Step[], opts?: { bpm?: number; loop?: boolean }) => {
    const c: Choreography = { id: Date.now().toString(), name, steps, createdAt: Date.now(), bpm: opts?.bpm ?? 120, loop: opts?.loop ?? false };
    setChoreos(prev => { const u = [...prev, c]; persist(u); return u; });
    return c;
  }, []);

  const update = useCallback((id: string, updates: Partial<Choreography>) => {
    setChoreos(prev => { const u = prev.map(c => c.id === id ? { ...c, ...updates } : c); persist(u); return u; });
  }, []);

  const remove = useCallback((id: string) => {
    setChoreos(prev => { const u = prev.filter(c => c.id !== id); persist(u); return u; });
  }, []);

  return { choreos, save, update, remove };
}