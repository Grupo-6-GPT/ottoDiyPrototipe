import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Play, Square, CheckCircle2, AlertCircle, RotateCcw, Layers, WifiOff } from 'lucide-react';
import { OttoRobot } from './otto-robot';
import { useSteps, useConnection, AVAILABLE_MOVES, getStepEstimatedDuration } from '../store';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { isSecureContext } from '../lib/ottoBluetooth';

type PlayState = 'idle' | 'sending' | 'ready' | 'dancing' | 'finished';

function buildOttoCommand(step: { command: string; duration: number; parameterized?: boolean }): string {
  if (step.parameterized) {
    return `${step.command}:${step.duration}`;
  }
  return step.command;
}

/** Look up the real Arduino execution time for a command. */
function getArduinoDuration(command: string): number {
  const move = AVAILABLE_MOVES.find(m => m.command === command);
  return move?.arduinoDuration ?? 1000;
}

export function PlayScreen() {
  const { steps } = useSteps();
  const { connected, sendCommand, sendSequence } = useConnection();
  const navigate = useNavigate();
  const [state, setState] = useState<PlayState>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const intervalsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef(false);

  // Total duration uses real Arduino timings × repetitions
  const totalDuration = steps.reduce((a, s) => a + getStepEstimatedDuration(s), 0);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const cleanup = useCallback(() => {
    abortRef.current = true;
    intervalsRef.current.forEach(clearTimeout);
    intervalsRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ─── Send sequence to Otto ───────────────────────────────────────────────
  // Strategy: send a SEQ: command so Otto executes autonomously (most reliable),
  // then simultaneously drive the UI progress with proper Arduino timings.
  const handleSend = useCallback(async () => {
    if (steps.length === 0 || !connected) return;

    // Build the flat command list (repeating commands per repetitions)
    const commandList: string[] = [];
    steps.forEach(step => {
      for (let r = 0; r < step.repetitions; r++) {
        if (step.command === 'PAUSE') {
          commandList.push(`PAUSE:${step.duration}`);
        } else {
          commandList.push(buildOttoCommand(step));
          if (step.pauseAfter && step.pauseAfter > 0) commandList.push(`PAUSE:${step.pauseAfter}`);
        }
      }
    });

    setState('sending');
    setProgress(0);

    // --- Attempt to send full SEQ command ---
    let seqSent = false;
    try {
      seqSent = await sendSequence(commandList);
    } catch (e) {
      console.warn('[Otto] SEQ send failed, will use timed per-command fallback:', e);
    }

    if (seqSent) {
      // Simulate progress bar (we don't get ACKs from Otto)
      const interval = 80;
      let tick = 0;
      const t = setInterval(() => {
        tick++;
        const pct = Math.min((tick * interval / (totalDuration || 5000)) * 100, 100);
        setProgress(pct);
        if (pct >= 100) { clearInterval(t); setState('ready'); toast.success('Coreografía enviada ✓'); }
      }, interval);
      intervalsRef.current.push(t as any);
      toast('Secuencia enviada al robot 🤖', { duration: 2000 });
    } else {
      // Fallback: Otto will receive a fake 100% bar — show error
      setState('idle');
      toast.error('No se pudo enviar la secuencia. Verifica la conexión BLE.');
    }
  }, [steps, connected, sendSequence, totalDuration]);

  // ─── Dance: send commands one at a time with real Arduino timing ──────────
  const startDancing = useCallback(() => {
    if (steps.length === 0 || !connected) return;
    cleanup();
    abortRef.current = false;
    setState('dancing');
    setCurrentStep(0);
    setElapsed(0);

    let accumulatedTime = 0;

    steps.forEach((step, i) => {
      const base = getArduinoDuration(step.command);
      const speedMult = step.speed === 'fast' ? 0.6 : step.speed === 'slow' ? 1.6 : 1.0;
      const isPauseStep = step.command === 'PAUSE';
      const commandDuration = isPauseStep ? Math.max(step.duration, step.pauseAfter || 0, base) : base * speedMult;

      for (let rep = 0; rep < step.repetitions; rep++) {
        const sendAt = accumulatedTime;
        const stepIndex = i;

        const t = setTimeout(async () => {
          if (abortRef.current) return;
          setCurrentStep(stepIndex);
          await sendCommand(isPauseStep ? `PAUSE:${step.duration}` : buildOttoCommand(step));
        }, sendAt);
        intervalsRef.current.push(t);

        accumulatedTime += commandDuration;

        if (!isPauseStep && step.pauseAfter && step.pauseAfter > 0) {
          const pauseAt = accumulatedTime;
          const pauseT = setTimeout(async () => {
            if (abortRef.current) return;
            await sendCommand(`PAUSE:${step.pauseAfter}`);
          }, pauseAt);
          intervalsRef.current.push(pauseT);
          accumulatedTime += step.pauseAfter;
        }
      }
    });

    // Finish
    const finishT = setTimeout(() => {
      setState('finished');
      setCurrentStep(-1);
      toast('¡Baile completado! 🎉', { duration: 2000 });
    }, accumulatedTime);
    intervalsRef.current.push(finishT);

    // Elapsed counter
    const elapsedInterval = setInterval(() => setElapsed(prev => prev + 100), 100);
    const elapsedStop = setTimeout(() => clearInterval(elapsedInterval), accumulatedTime);
    intervalsRef.current.push(elapsedInterval as any);
    intervalsRef.current.push(elapsedStop);
  }, [steps, connected, cleanup, sendCommand]);

  const stopDancing = useCallback(() => {
    cleanup();
    void sendCommand('FREEZE');
    setState('ready');
    setCurrentStep(-1);
    setElapsed(0);
  }, [cleanup, sendCommand]);

  const currentStepData = currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null;
  const noSteps = steps.length === 0;
  const isDancing = state === 'dancing';
  const isSending = state === 'sending';
  const insecure = !isSecureContext();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#0B0B14' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-2">
        <h2 className="text-center mb-0.5" style={{ color: '#E8E8F0', fontSize: 20, fontWeight: 800 }}>
          {isDancing ? '🎵 Bailando...' : state === 'ready' ? '✅ Listo!' : state === 'finished' ? '🎉 ¡Hecho!' : isSending ? '📡 Enviando...' : 'Play'}
        </h2>
        <p className="text-center" style={{ color: '#4A4A6A', fontSize: 12 }}>
          {noSteps ? 'Sin pasos — construye una coreografía primero' : `${fmt(totalDuration)} · ${steps.length} pasos`}
          {isDancing && ` · ${fmt(elapsed)}`}
        </p>
      </div>

      {/* Robot */}
      <div className="flex-shrink-0 px-5 py-3">
        <motion.div
          className="mx-auto flex items-center justify-center rounded-2xl overflow-hidden"
          style={{
            width: 190, height: 195,
            background: '#0E0E1A',
            border: isDancing ? '1px solid #818CF833' : '1px solid #161628',
          }}
          animate={isDancing ? { borderColor: ['#818CF833', '#F472B633', '#818CF833'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <OttoRobot
            size={130}
            dancing={isDancing}
            highlightPart={currentStepData?.bodyPart}
            activeCommand={isDancing && currentStepData ? currentStepData.command : null}
          />
        </motion.div>
      </div>

      {/* Current step chip */}
      <div className="flex-shrink-0 px-5">
        <AnimatePresence mode="wait">
          {isDancing && currentStepData && (
            <motion.div
              key={currentStep}
              className="flex items-center justify-center gap-2 mb-2 py-2 px-4 rounded-xl mx-auto w-fit"
              style={{ background: '#111120', border: `1px solid ${currentStepData.color}30` }}
              initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <motion.span style={{ fontSize: 18 }} animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.3 }}>
                {currentStepData.icon}
              </motion.span>
              <span style={{ color: currentStepData.color, fontSize: 13, fontWeight: 600 }}>{currentStepData.name}</span>
              <div className="w-px h-3.5" style={{ background: '#1E1E30' }} />
              <span style={{ color: '#4A4A6A', fontSize: 11, fontWeight: 600 }}>{currentStep + 1}/{steps.length}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warnings */}
        {insecure && (
          <motion.div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl mx-auto w-fit"
            style={{ background: '#1A0F00', border: '1px solid #3A2000' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <WifiOff size={13} style={{ color: '#FBBF24' }} />
            <span style={{ color: '#FBBF24', fontSize: 11, fontWeight: 600 }}>
              ⚠ Abre la app desde localhost o https:// para usar BLE
            </span>
          </motion.div>
        )}

        {state === 'ready' && (
          <motion.div className="flex items-center justify-center gap-2 mb-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            <CheckCircle2 size={15} style={{ color: '#34D399' }} />
            <span style={{ color: '#34D399', fontSize: 12, fontWeight: 600 }}>¡Listo para bailar!</span>
          </motion.div>
        )}
        {!connected && (
          <div className="flex items-center justify-center gap-2 mb-2 px-3 py-2 rounded-xl mx-auto w-fit" style={{ background: '#160F12', border: '1px solid #2A1520' }}>
            <AlertCircle size={13} style={{ color: '#F87171' }} />
            <span style={{ color: '#F87171', fontSize: 11, fontWeight: 600 }}>Conecta tu robot primero</span>
          </div>
        )}
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {noSteps ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
              <Layers size={20} style={{ color: '#1E1E35' }} />
            </div>
            <p style={{ color: '#2E2E48', fontSize: 12, fontWeight: 600 }}>Sin pasos para reproducir</p>
            <button onClick={() => navigate('/choreography')} className="mt-3 px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform" style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 12, fontWeight: 600 }}>
              Ir al Constructor
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
            <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderBottom: '1px solid #131322' }}>
              <span style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>SECUENCIA</span>
              <span style={{ color: '#3A3A5A', fontSize: 10 }}>{steps.length} pasos</span>
            </div>
            {steps.map((step, i) => {
              const isActive = currentStep === i;
              return (
                <motion.div
                  key={step.id}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{ borderBottom: '1px solid #111120', background: isActive ? `${step.color}0A` : 'transparent' }}
                  animate={isActive ? { x: [0, 3, 0] } : {}}
                  transition={{ duration: 0.3, repeat: isActive ? Infinity : 0 }}
                >
                  <motion.span
                    style={{ color: isActive ? step.color : i < currentStep ? '#2E2E48' : '#3A3A5A', fontSize: 10, fontWeight: 700, width: 18 }}
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >{i + 1}</motion.span>
                  <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: isActive ? `${step.color}15` : 'transparent' }}>
                    <span style={{ fontSize: 12 }}>{step.icon}</span>
                  </div>
                  <span className="flex-1" style={{
                    color: isActive ? '#E8E8F0' : i < currentStep && isDancing ? '#3A3A5A' : '#7A7A98',
                    fontSize: 12, fontWeight: isActive ? 600 : 400,
                    textDecoration: i < currentStep && isDancing ? 'line-through' : 'none',
                  }}>{step.name}</span>
                  <span style={{ color: '#3A3A5A', fontSize: 10 }}>
                    ~{(getStepEstimatedDuration(step) / 1000).toFixed(1)}s
                    {step.repetitions > 1 && ` ×${step.repetitions}`}
                    {step.speed !== 'normal' && ` ${step.speed === 'fast' ? '⚡' : '🐢'}`}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send progress bar */}
      <AnimatePresence>
        {isSending && (
          <motion.div className="flex-shrink-0 px-5 pb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex justify-between mb-1">
              <span style={{ color: '#818CF8', fontSize: 11, fontWeight: 600 }}>Enviando a Otto...</span>
              <span style={{ color: '#818CF8', fontSize: 11, fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#161628' }}>
              <motion.div className="h-full rounded-full" style={{ background: '#818CF8', width: `${progress}%` }} layout />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex-shrink-0 px-5 pb-[5.5rem] pt-2">
        <div className="flex gap-2">
          {/* Send sequence button */}
          {!isDancing && state !== 'sending' && (
            <button
              className="flex-1 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: '#111120', color: '#818CF8', border: '1px solid #1E1E40',
                fontSize: 14, fontWeight: 700,
                opacity: (!noSteps && connected) ? 1 : 0.3,
                pointerEvents: (!noSteps && connected) ? 'auto' : 'none',
              }}
              onClick={handleSend}
            >
              <Send size={16} /> Enviar
            </button>
          )}

          {/* Dance / Stop */}
          {(state === 'ready' || isDancing || state === 'finished') && (
            <button
              className="flex-1 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: isDancing ? '#160F12' : '#1A1A35',
                color: isDancing ? '#F87171' : '#C4B5FD',
                border: isDancing ? '1px solid #2A1520' : '1px solid #2E2E55',
                fontSize: 14, fontWeight: 700,
              }}
              onClick={isDancing ? stopDancing : startDancing}
            >
              {isDancing
                ? <><Square size={16} /> Parar</>
                : state === 'finished'
                  ? <><RotateCcw size={16} /> Repetir</>
                  : <><Play size={16} /> ¡Bailar!</>}
            </button>
          )}
        </div>

        {/* Mode hint */}
        {!noSteps && !isDancing && (
          <p className="text-center mt-2" style={{ color: '#2E2E48', fontSize: 10 }}>
            <strong style={{ color: '#3A3A5A' }}>Enviar</strong> → manda la secuencia completa al robot &nbsp;·&nbsp;
            <strong style={{ color: '#3A3A5A' }}>¡Bailar!</strong> → control en tiempo real
          </p>
        )}
      </div>
    </div>
  );
}