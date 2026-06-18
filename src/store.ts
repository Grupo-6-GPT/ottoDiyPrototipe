import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  connectOttoRobot,
  disconnectOttoRobot,
  getOttoTransportMode,
  sendOttoRobotCommand,
  sendOttoSequence,
  getCommandDuration,
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
  // Grouping support: a step may be a group containing child steps.
  isGroup?: boolean;
  children?: Step[];
}

export interface Choreography {
  id: string;
  name: string;
  steps: Step[];
  createdAt: number;
  bpm: number;
  loop: boolean;
  youtubeUrl?: string;
  audioUrl?: string; // Direct audio URL or extracted from YouTube
  youtubeDuration?: number; // seconds
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
  { name: 'Caminar rápido',      icon: '↑',  command: 'WALK_F_FAST',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 1360 },
  { name: 'Caminar lento',       icon: '↑',  command: 'WALK_F_SLOW',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 4400 },
  { name: 'Retroceder rápido',   icon: '↓',  command: 'WALK_B_FAST',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 1360 },
  { name: 'Retroceder lento',    icon: '↓',  command: 'WALK_B_SLOW',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 4400 },
  { name: 'Girar izq rápido',    icon: '←',  command: 'TURN_L_FAST',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 640 },
  { name: 'Girar der rápido',    icon: '→',  command: 'TURN_R_FAST',     color: '#818CF8', bodyPart: 'legs', category: 'movement', arduinoDuration: 640 },
  { name: 'Saltar',              icon: '⤴',  command: 'JUMP',            color: '#F472B6', bodyPart: 'legs', category: 'dance',    arduinoDuration: 550 },
  { name: 'Moonwalk adelante',    icon: '🌙',  command: 'MOONWALK',        color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 2000, parameterized: true },
  { name: 'Moonwalk atrás',      icon: '🌙',  command: 'MOONWALK_B',      color: '#FBBF24', bodyPart: 'legs', category: 'dance',    arduinoDuration: 2000, parameterized: true },
  { name: 'Giro 360°',           icon: '↻',  command: 'SPIN',            color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1650 },
  { name: 'Giro izquierda lento', icon: '⟲',  command: 'SPIN_L',          color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Giro derecha lento',  icon: '⟳',  command: 'SPIN_R',          color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1100 },
  { name: 'Spin izq rápido',     icon: '⟲',  command: 'SPIN_L_FAST',     color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1360 },
  { name: 'Spin der rápido',     icon: '⟳',  command: 'SPIN_R_FAST',     color: '#FBBF24', bodyPart: 'body', category: 'dance',    arduinoDuration: 1360 },
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
  { name: 'Tilt izquierda',      icon: '↙',  command: 'TILT_L',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 650 },
  { name: 'Tilt derecha',        icon: '↘',  command: 'TILT_R',          color: '#34D399', bodyPart: 'body', category: 'expression', arduinoDuration: 650 },
  { name: 'Balanceo',            icon: '↔',  command: 'BALANCE',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Rock izq-der',        icon: '⤧',  command: 'ROCK_LR',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Rock rápido',         icon: '⚡',  command: 'ROCK_LR_FAST',    color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1200 },
  { name: 'Rock adelante-atrás', icon: '⤵',  command: 'ROCK_FB',         color: '#38BDF8', bodyPart: 'body', category: 'dance',    arduinoDuration: 1400 },
  { name: 'Postura abierta',      icon: '🦵', command: 'WIDE_STAND',      color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Pájaro izq',          icon: '🐦', command: 'PIGEON_L',        color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Pájaro der',          icon: '🐦', command: 'PIGEON_R',        color: '#F472B6', bodyPart: 'legs', category: 'movement', arduinoDuration: 900 },
  { name: 'Patada izq',          icon: '🥾', command: 'KICK_L',          color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Patada der',          icon: '🥾', command: 'KICK_R',          color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Pisotón doble',        icon: '💥', command: 'STOMP',           color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 810 },
  { name: 'Stomp izq',           icon: '⬇',  command: 'STOMP_L',         color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Stomp der',           icon: '⬇',  command: 'STOMP_R',         color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 700 },
  { name: 'Stomp alternado',     icon: '⬇',  command: 'STOMP_ALTERNATE', color: '#F87171', bodyPart: 'legs', category: 'dance',    arduinoDuration: 1600 },
  { name: 'Hi-five izq',         icon: '✋',  command: 'HI_FIVE_L',       color: '#F59E0B', bodyPart: 'arms', category: 'expression', arduinoDuration: 650 },
  { name: 'Hi-five der',         icon: '✋',  command: 'HI_FIVE_R',       color: '#F59E0B', bodyPart: 'arms', category: 'expression', arduinoDuration: 650 },
  { name: 'Agacharse',           icon: '⤵',  command: 'CROUCH',          color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 700 },
  { name: 'Squat',              icon: '🏋️', command: 'SQUAT',           color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 1200 },
  { name: 'Squat pulse',        icon: '↯',  command: 'SQUAT_PULSE',     color: '#A3E635', bodyPart: 'legs', category: 'movement', arduinoDuration: 1000 },
  { name: 'Shake',              icon: '🫨', command: 'SHAKE',           color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1360 },
  { name: 'Wiggle',             icon: '〜', command: 'WIGGLE',          color: '#F472B6', bodyPart: 'body', category: 'dance',    arduinoDuration: 1200 },
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
  { name: 'Bip',               icon: '🔔', command: 'BEEP',            color: '#A78BFA', bodyPart: 'head', category: 'sound',   arduinoDuration: 200 },
  { name: 'Melodía',           icon: '🎵', command: 'MELODY',          color: '#A78BFA', bodyPart: 'head', category: 'sound',   arduinoDuration: 1600 },
  { name: 'Posición neutral',  icon: '⏹', command: 'HOME',            color: '#94A3B8', bodyPart: 'body', category: 'control', arduinoDuration: 400 },
  { name: 'Congelar',          icon: '❄', command: 'FREEZE',          color: '#94A3B8', bodyPart: 'body', category: 'control', arduinoDuration: 300 },
  { name: 'Pausa',             icon: '⏸', command: 'PAUSE',           color: '#94A3B8', bodyPart: 'body', category: 'control', arduinoDuration: 300, parameterized: true },
] as const;

export function getArduinoDuration(command: string): number {
  const move = AVAILABLE_MOVES.find(m => m.command === command);
  return move?.arduinoDuration ?? 1000;
}

export function getStepEstimatedDuration(step: Step): number {
  if (step.isGroup && step.children) {
    const childrenDuration = step.children.reduce((sum, child) => sum + getStepEstimatedDuration(child), 0);
    return Math.round(childrenDuration * Math.max(1, step.repetitions));
  }

  // Build the command string the robot will actually receive. For
  // parameterized moves (e.g. WALK_F:duration) we include the chosen
  // visual `step.duration`. For non-parameterized moves we send the
  // bare command. Then ask the low-level helper for the real Arduino
  // execution time for that command string.
  if (step.command === 'PAUSE') {
    const cmd = `PAUSE:${Math.max(step.duration, 0)}`;
    const dur = getCommandDuration(cmd);
    const pauseDuration = step.pauseAfter || 0;
    return Math.round((dur + pauseDuration) * step.repetitions);
  }

  const cmdBase = step.parameterized ? `${step.command}:${Math.max(step.duration, 0)}` : step.command;
  const cmdDur = getCommandDuration(cmdBase);
  const pauseDuration = step.pauseAfter || 0;
  return Math.round((cmdDur + pauseDuration) * step.repetitions);
}

/**
 * Expand steps into a flat command list that mirrors what we will send
 * to the robot. Each item includes the actual command string and the
 * estimated real duration in ms (as reported by getCommandDuration).
 */
export function expandStepsToCommands(steps: Step[]) {
  const out: { cmd: string; durationMs: number }[] = [];

  function flatten(step: Step) {
    if (step.isGroup && step.children && step.children.length > 0) {
      // Repeat the whole group's children `repetitions` times.
      const groupReps = Math.max(1, step.repetitions);
      for (let g = 0; g < groupReps; g++) {
        for (const child of step.children) flatten(child);
      }
      return;
    }

    // Normal step (not a group)
    const reps = Math.max(1, step.repetitions);
    for (let r = 0; r < reps; r++) {
      const mainCmd = step.parameterized ? `${step.command}:${Math.max(step.duration, 0)}` : step.command;
      out.push({ cmd: mainCmd, durationMs: getCommandDuration(mainCmd) });
      if (step.pauseAfter && step.pauseAfter > 0) {
        const pauseCmd = `PAUSE:${step.pauseAfter}`;
        out.push({ cmd: pauseCmd, durationMs: getCommandDuration(pauseCmd) });
      }
    }
  }

  for (const step of steps) flatten(step);
  return out;
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
const choreographyMetaStore = createStore<{ youtubeUrl?: string; audioUrl?: string; youtubeDuration?: number }>({});
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
  const meta = useSyncExternalStore(choreographyMetaStore.subscribe, choreographyMetaStore.get);

  const addStep = useCallback((move: typeof AVAILABLE_MOVES[number], duration: number, extra?: Partial<Step>) => {
    const newStep: Step = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: move.name,
      icon: move.icon,
      command: move.command,
      color: move.color,
      bodyPart: move.bodyPart,
      duration: 'parameterized' in move && move.parameterized ? duration : move.arduinoDuration,
      parameterized: 'parameterized' in move ? move.parameterized : false,
      speed: 'normal',
      repetitions: 1,
      pauseAfter: 0,
      ...extra,
    };
    stepsStore.set(prev => [...prev, newStep]);
    return newStep;
  }, []);

  const removeStep    = useCallback((id: string) => {
    stepsStore.set(prev => {
      // Remove matching top-level
      if (prev.some(s => s.id === id)) return prev.filter(s => s.id !== id);
      // Otherwise remove from any group's children
      const out = prev.map(s => {
        if (s.isGroup && s.children) {
          const kids = s.children.filter(c => c.id !== id);
          return { ...s, children: kids };
        }
        return s;
      });
      return out;
    });
  }, []);

  const updateStep    = useCallback((id: string, updates: Partial<Step>) => {
    stepsStore.set(prev => {
      function updateInArray(arr: Step[]): Step[] {
        return arr.map(s => {
          if (s.id === id) return { ...s, ...updates };
          if (s.isGroup && s.children) return { ...s, children: updateInArray(s.children) };
          return s;
        });
      }
      return updateInArray(prev);
    });
  }, []);
  const clearAll      = useCallback(() => { stepsStore.set([]); choreographyMetaStore.set({}); }, []);
  const undo          = useCallback(() => stepsStore.set(prev => prev.slice(0, -1)), []);
  const loadSteps     = useCallback((s: Step[], meta?: { youtubeUrl?: string; audioUrl?: string; youtubeDuration?: number }) => { 
    stepsStore.set([...s]); 
    choreographyMetaStore.set(meta || {}); 
  }, []);
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
      // top-level duplicate
      const idx = prev.findIndex(s => s.id === id);
      if (idx !== -1) {
        const copy = { ...prev[idx], id: Date.now().toString() + Math.random().toString(36).slice(2) };
        const arr = [...prev];
        arr.splice(idx + 1, 0, copy);
        return arr;
      }

      // nested duplicate inside a group
      const arr = prev.map(s => {
        if (s.isGroup && s.children) {
          const cIdx = s.children.findIndex(c => c.id === id);
          if (cIdx !== -1) {
            const copyChild = { ...s.children[cIdx], id: Date.now().toString() + Math.random().toString(36).slice(2) };
            const newChildren = [...s.children];
            newChildren.splice(cIdx + 1, 0, copyChild);
            return { ...s, children: newChildren };
          }
        }
        return s;
      });
      return arr;
    });
  }, []);

  const createGroup = useCallback((stepIds: string[], name?: string, reps: number = 1) => {
    if (!stepIds || stepIds.length === 0) return;
    stepsStore.set(prev => {
      const idxs = stepIds.map(id => prev.findIndex(s => s.id === id)).filter(i => i !== -1).sort((a, b) => a - b);
      if (idxs.length === 0) return prev;
      const arr = [...prev];
      const firstIdx = idxs[0];
      // Extract children preserving order
      const children: Step[] = idxs.map(i => ({ ...prev[i] }));
      // Remove items from arr starting from the highest index
      for (let i = idxs.length - 1; i >= 0; i--) arr.splice(idxs[i], 1);

      const groupStep: Step = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: name ?? 'Group',
        icon: '📦',
        command: 'GROUP',
        color: '#9CA3AF',
        bodyPart: 'group',
        duration: Math.max(0, children.reduce((s, c) => s + getStepEstimatedDuration(c), 0)),
        parameterized: false,
        speed: 'normal',
        repetitions: Math.max(1, Math.floor(reps)),
        pauseAfter: 0,
        isGroup: true,
        children,
      };
      arr.splice(firstIdx, 0, groupStep);
      return arr;
    });
  }, []);

  const ungroup = useCallback((groupId: string) => {
    stepsStore.set(prev => {
      const idx = prev.findIndex(s => s.id === groupId);
      if (idx === -1) return prev;
      const group = prev[idx];
      if (!group.isGroup || !group.children) return prev;
      const arr = [...prev];
      arr.splice(idx, 1, ...group.children.map(c => ({ ...c })));
      return arr;
    });
  }, []);

  const duplicateGroup = useCallback((groupId: string) => {
    stepsStore.set(prev => {
      const idx = prev.findIndex(s => s.id === groupId);
      if (idx === -1) return prev;
      const group = prev[idx];
      if (!group.isGroup || !group.children) return prev;
      const copyChildren = group.children.map(c => ({ ...c, id: Date.now().toString() + Math.random().toString(36).slice(2) }));
      const copyGroup: Step = { ...group, id: Date.now().toString() + Math.random().toString(36).slice(2), children: copyChildren };
      const arr = [...prev];
      arr.splice(idx + 1, 0, copyGroup);
      return arr;
    });
  }, []);

  const setGroupRepetitions = useCallback((groupId: string, reps: number) => {
    stepsStore.set(prev => prev.map(s => s.id === groupId && s.isGroup ? { ...s, repetitions: Math.max(1, Math.floor(reps)) } : s));
  }, []);

  const moveGroup = useCallback((groupId: string, toIdx: number) => {
    stepsStore.set(prev => {
      const idx = prev.findIndex(s => s.id === groupId);
      if (idx === -1) return prev;
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      arr.splice(Math.max(0, Math.min(toIdx, arr.length)), 0, item);
      return arr;
    });
  }, []);

  const duplicateStepAt = useCallback((stepId: string, insertBeforeIndex: number) => {
    stepsStore.set(prev => {
      const step = prev.find(s => s.id === stepId);
      if (!step) return prev;
      const clone: Step = {
        ...step,
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        ...(step.isGroup && step.children ? {
          children: step.children.map(c => ({ ...c, id: Date.now().toString() + Math.random().toString(36).slice(2) }))
        } : {}),
      };
      const arr = [...prev];
      arr.splice(Math.max(0, Math.min(insertBeforeIndex, arr.length)), 0, clone);
      return arr;
    });
  }, []);

  const createGroupAt = useCallback((stepIds: string[], insertBeforeIndex: number, name?: string, reps: number = 1) => {
    if (!stepIds || stepIds.length === 0) return;
    stepsStore.set(prev => {
      const idxs = stepIds.map(id => prev.findIndex(s => s.id === id)).filter(i => i !== -1).sort((a, b) => a - b);
      if (idxs.length === 0) return prev;
      const arr = [...prev];
      // Extract children preserving order
      const children: Step[] = idxs.map(i => prev[i]).filter(s => s);
      // Remove items from arr starting from the highest index
      for (let i = idxs.length - 1; i >= 0; i--) arr.splice(idxs[i], 1);

      const groupStep: Step = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: name ?? 'Group',
        icon: '📦',
        command: 'GROUP',
        color: '#9CA3AF',
        bodyPart: 'group',
        duration: Math.max(0, children.reduce((s, c) => s + getStepEstimatedDuration(c), 0)),
        parameterized: false,
        speed: 'normal',
        repetitions: Math.max(1, Math.floor(reps)),
        pauseAfter: 0,
        isGroup: true,
        children,
      };
      // Adjust insertion index if necessary (items were removed before it)
      const removedBefore = idxs.filter(i => i < insertBeforeIndex).length;
      const adjustedIdx = Math.max(0, Math.min(insertBeforeIndex - removedBefore, arr.length));
      arr.splice(adjustedIdx, 0, groupStep);
      return arr;
    });
  }, []);

  const duplicateGroupAt = useCallback((groupId: string, insertBeforeIndex: number) => {
    stepsStore.set(prev => {
      const group = prev.find(s => s.id === groupId);
      if (!group || !group.isGroup || !group.children) return prev;
      const copyChildren = group.children.map(c => ({ ...c, id: Date.now().toString() + Math.random().toString(36).slice(2) }));
      const copyGroup: Step = { ...group, id: Date.now().toString() + Math.random().toString(36).slice(2), children: copyChildren };
      const arr = [...prev];
      arr.splice(Math.max(0, Math.min(insertBeforeIndex, arr.length)), 0, copyGroup);
      return arr;
    });
  }, []);

  return { steps, meta, addStep, removeStep, updateStep, clearAll, undo, loadSteps, reorder, duplicateStep,
    duplicateStepAt, createGroup, createGroupAt, ungroup, duplicateGroup, duplicateGroupAt, setGroupRepetitions, moveGroup };
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
  const sendSequence  = useCallback((commands: string[], onProgress?: (index: number, total: number) => void, signal?: AbortSignal) =>
    sendOttoSequence(commands, onProgress, signal), []);

  return {
    ...state,
    connect,
    disconnect,
    sendCommand,
    sendSequence,
    transportMode: state.transportMode ?? getOttoTransportMode(),
  };
}

const API = '/api/choreographies';

export function useSavedChoreographies() {
  const [choreos, setChoreos] = useState<Choreography[]>([]);

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setChoreos(data as Choreography[]);
        else toast.error('No se pudo cargar las coreografías');
      })
      .catch(() => toast.error('No se pudo conectar con el servidor'));
  }, []);

  const save = useCallback((name: string, steps: Step[], opts?: { bpm?: number; loop?: boolean; youtubeUrl?: string; audioUrl?: string; youtubeDuration?: number }) => {
    const c: Choreography = {
      id: Date.now().toString(),
      name,
      steps,
      createdAt: Date.now(),
      bpm:   opts?.bpm  ?? 120,
      loop:  opts?.loop ?? false,
      youtubeUrl:      opts?.youtubeUrl,
      audioUrl:        opts?.audioUrl,
      youtubeDuration: opts?.youtubeDuration,
    };
    setChoreos(prev => [...prev, c]);
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }).catch(() => toast.error('Error al guardar la coreografía'));
    return c;
  }, []);

  const update = useCallback((id: string, updates: Partial<Choreography>) => {
    setChoreos(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      const choreo = next.find(c => c.id === id);
      if (choreo) {
        fetch(`${API}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(choreo),
        }).catch(() => toast.error('Error al actualizar la coreografía'));
      }
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setChoreos(prev => prev.filter(c => c.id !== id));
    fetch(`${API}/${id}`, { method: 'DELETE' })
      .catch(() => toast.error('Error al eliminar la coreografía'));
  }, []);

  return { choreos, save, update, remove };
}