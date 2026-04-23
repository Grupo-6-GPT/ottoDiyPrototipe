import { useState, useCallback, useSyncExternalStore } from 'react';

export interface Step {
  id: string;
  name: string;
  icon: string;
  command: string;
  duration: number; // ms
  speed: 'slow' | 'normal' | 'fast';
  repetitions: number;
  color: string;
  bodyPart: string;
  servoAngle?: number; // 0-180
  soundFreq?: number; // Hz for beep
  pauseAfter?: number; // ms pause after step
}

export interface Choreography {
  id: string;
  name: string;
  steps: Step[];
  createdAt: number;
  bpm: number;
  loop: boolean;
}

export const AVAILABLE_MOVES = [
  { name: 'Walk Forward', icon: '↑', command: 'WALK_F', color: '#818CF8', bodyPart: 'legs', category: 'movement' },
  { name: 'Walk Backward', icon: '↓', command: 'WALK_B', color: '#818CF8', bodyPart: 'legs', category: 'movement' },
  { name: 'Turn Left', icon: '←', command: 'TURN_L', color: '#818CF8', bodyPart: 'legs', category: 'movement' },
  { name: 'Turn Right', icon: '→', command: 'TURN_R', color: '#818CF8', bodyPart: 'legs', category: 'movement' },
  { name: 'Shake', icon: '〰', command: 'SHAKE', color: '#F472B6', bodyPart: 'body', category: 'dance' },
  { name: 'Jump', icon: '⤴', command: 'JUMP', color: '#F472B6', bodyPart: 'legs', category: 'dance' },
  { name: 'Moonwalk', icon: '🌙', command: 'MOONWALK', color: '#FBBF24', bodyPart: 'legs', category: 'dance' },
  { name: 'Spin 360°', icon: '↻', command: 'SPIN', color: '#FBBF24', bodyPart: 'body', category: 'dance' },
  { name: 'Tilt Left', icon: '⟨', command: 'TILT_L', color: '#34D399', bodyPart: 'body', category: 'expression' },
  { name: 'Tilt Right', icon: '⟩', command: 'TILT_R', color: '#34D399', bodyPart: 'body', category: 'expression' },
  { name: 'Stomp', icon: '⬇', command: 'STOMP', color: '#F472B6', bodyPart: 'legs', category: 'dance' },
  { name: 'Wiggle', icon: '↔', command: 'WIGGLE', color: '#F472B6', bodyPart: 'body', category: 'dance' },
  { name: 'Freeze', icon: '■', command: 'FREEZE', color: '#94A3B8', bodyPart: 'body', category: 'control' },
  { name: 'Beep', icon: '♪', command: 'BEEP', color: '#A78BFA', bodyPart: 'head', category: 'sound' },
  { name: 'Melody', icon: '♫', command: 'MELODY', color: '#A78BFA', bodyPart: 'head', category: 'sound' },
  { name: 'Pause', icon: '⏸', command: 'PAUSE', color: '#94A3B8', bodyPart: 'body', category: 'control' },
];

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'movement', label: 'Movement' },
  { key: 'dance', label: 'Dance' },
  { key: 'expression', label: 'Expression' },
  { key: 'sound', label: 'Sound' },
  { key: 'control', label: 'Control' },
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
const connectionStore = createStore<{ connected: boolean; battery: number }>({ connected: false, battery: 0 });

export function useSteps() {
  const steps = useSyncExternalStore(stepsStore.subscribe, stepsStore.get);

  const addStep = useCallback((move: typeof AVAILABLE_MOVES[0], duration: number, extra?: Partial<Step>) => {
    const newStep: Step = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: move.name,
      icon: move.icon,
      command: move.command,
      color: move.color,
      bodyPart: move.bodyPart,
      duration,
      speed: 'normal',
      repetitions: 1,
      pauseAfter: 0,
      ...extra,
    };
    stepsStore.set(prev => [...prev, newStep]);
    return newStep;
  }, []);

  const removeStep = useCallback((id: string) => {
    stepsStore.set(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<Step>) => {
    stepsStore.set(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const clearAll = useCallback(() => stepsStore.set([]), []);
  const undo = useCallback(() => stepsStore.set(prev => prev.slice(0, -1)), []);
  const loadSteps = useCallback((s: Step[]) => stepsStore.set([...s]), []);
  const reorder = useCallback((fromIdx: number, toIdx: number) => {
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
  const connect = useCallback(() => connectionStore.set({ connected: true, battery: 85 }), []);
  const disconnect = useCallback(() => connectionStore.set({ connected: false, battery: 0 }), []);
  return { ...state, connect, disconnect };
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
