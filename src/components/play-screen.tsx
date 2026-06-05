import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, RotateCcw, Layers, WifiOff, AlertCircle, ChevronRight, Music2 } from 'lucide-react';
import { OttoRobot } from './otto-robot';
import { useSteps, useConnection, getStepEstimatedDuration, expandStepsToCommands } from '../store';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { isSecureContext } from '../lib/ottoBluetooth';

type PlayState = 'idle' | 'dancing' | 'finished';

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function PlayScreen() {
  const { steps, meta } = useSteps();
  const { connected, sendSequence } = useConnection();
  const navigate = useNavigate();

  const [robotSize, setRobotSize] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 320 : 130
  );
  useEffect(() => {
    const update = () => setRobotSize(window.innerWidth >= 768 ? 320 : 130);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const [playState, setPlayState]       = useState<PlayState>('idle');
  // currentCmd: índice dentro de la lista expandida (incluye PAUSEs)
  const [currentCmd, setCurrentCmd]     = useState(-1);
  // currentStep: índice dentro de steps[] (para mostrar el paso actual)
  const [currentStep, setCurrentStep]   = useState(-1);
  const [elapsed, setElapsed]           = useState(0);
  const youtubePlayerRef = useRef<HTMLIFrameElement>(null);

  const abortRef     = useRef<AbortController | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lista expandida: se recalcula cuando cambian los steps
  const commands = expandStepsToCommands(steps);
  const totalDuration = commands.reduce((a, c) => a + c.durationMs, 0);

  // Mapa de índice de comando expandido → índice de step original
  const cmdToStepIndex = useCallback((): number[] => {
    const map: number[] = [];
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      const reps = step.repetitions;
      const hasPause = (step.pauseAfter || 0) > 0;
      for (let r = 0; r < reps; r++) {
        map.push(si);              // el comando principal
        if (hasPause) map.push(si); // el PAUSE:X que sigue
      }
    }
    return map;
  }, [steps]);

  const stopTimers = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null; }
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  const startDancing = useCallback(async () => {
    if (steps.length === 0 || !connected) return;
    stopTimers();

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setPlayState('dancing');
    setCurrentStep(0);
    setCurrentCmd(0);
    setElapsed(0);

    // Play YouTube video if available
    if (meta.youtubeUrl && youtubePlayerRef.current) {
      try {
        const urlObj = new URL(meta.youtubeUrl);
        const videoId = urlObj.searchParams.get('v') || urlObj.pathname.slice(1);
        youtubePlayerRef.current!.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      } catch (e) {
        console.error('Invalid YouTube URL:', e);
      }
    }

    const stepMap = cmdToStepIndex();

    // Contador de tiempo transcurrido
    const startMs = Date.now();
    elapsedTimer.current = setInterval(() => {
      setElapsed(Date.now() - startMs);
    }, 200);

    const cmdStrings = commands.map(c => c.cmd);

    // sendSequence ya espera la duración real entre comandos
    const ok = await sendSequence(
      cmdStrings,
      (i) => {
        if (!signal.aborted) {
          setCurrentCmd(i);
          setCurrentStep(stepMap[i] ?? -1);
        }
      },
      signal,
    );

    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null; }

    if (!signal.aborted) {
      if (ok) {
        setPlayState('finished');
        setCurrentStep(-1);
        setCurrentCmd(-1);
        toast('¡Baile completado! 🎉', { duration: 2500 });
      } else {
        setPlayState('idle');
        toast.error('Se interrumpió la conexión con el robot.');
      }
    }
  }, [steps, connected, commands, cmdToStepIndex, sendSequence, stopTimers]);

  const stopDancing = useCallback(() => {
    stopTimers();
    setPlayState('idle');
    setCurrentStep(-1);
    setCurrentCmd(-1);
    setElapsed(0);
    // Stop YouTube video
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.src = '';
    }
  }, [stopTimers]);

  const isDancing  = playState === 'dancing';
  const isFinished = playState === 'finished';
  const noSteps    = steps.length === 0;
  const insecure   = !isSecureContext();

  const currentStepData = currentStep >= 0 && currentStep < steps.length ? steps[currentStep] : null;

  // Progreso real basado en tiempo transcurrido vs total
  const progressPct = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;

  const playButton = (
    <button
      className="w-full py-4 rounded-2xl cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95"
      style={{
        background: isDancing ? '#160F12' : isFinished ? '#0F1A14' : '#1A1A35',
        color: isDancing ? '#F87171' : isFinished ? '#34D399' : '#C4B5FD',
        border: isDancing ? '1px solid #2A1520' : isFinished ? '1px solid #1A3528' : '1px solid #2E2E55',
        fontSize: 15, fontWeight: 700,
        opacity: (!noSteps && (connected || isDancing)) ? 1 : 0.3,
        pointerEvents: (!noSteps && (connected || isDancing)) ? 'auto' : 'none',
      }}
      onClick={isDancing ? stopDancing : startDancing}
    >
      {isDancing
        ? <><Square size={16} /> Parar</>
        : isFinished
          ? <><RotateCcw size={16} /> Repetir</>
          : <><Play size={16} /> ¡Bailar!</>}
    </button>
  );

  return (
    <div className="flex flex-col min-h-dvh md:h-dvh md:overflow-hidden" style={{ background: '#0B0B14' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-2 text-center md:text-left md:px-8 md:pt-6">
        <h2 className="mb-0.5" style={{ color: '#E8E8F0', fontSize: 20, fontWeight: 800 }}>
          {isDancing ? 'Bailando…' : isFinished ? '¡Hecho!' : 'Play'}
        </h2>
        <p style={{ color: '#4A4A6A', fontSize: 12 }}>
          {noSteps ? 'Sin pasos — construye una coreografía primero' : `${fmt(totalDuration)} · ${steps.length} paso${steps.length !== 1 ? 's' : ''}`}
          {isDancing && ` · ${fmt(elapsed)} transcurrido`}
        </p>
      </div>

      {/* Content: mobile = columna, desktop = grid 2 cols que llena el espacio restante */}
      <div className="flex-1 flex flex-col min-h-0 md:grid md:grid-cols-2 md:gap-6 md:px-8 md:pb-6 md:overflow-hidden">

        {/* Izquierda: robot + estado + botón play */}
        <div className="flex flex-col min-h-0 md:h-full">

          {/* Robot container — flex-1 para crecer, min-h-0 para poder encogerse */}
          <div className="flex-shrink-0 flex justify-center px-5 py-3 md:px-0 md:py-0 md:flex-1 md:min-h-0">
            <motion.div
              className="flex items-center justify-center rounded-2xl overflow-hidden w-full"
              style={{
                background: '#0E0E1A',
                border: isDancing ? '1px solid #818CF833' : '1px solid #161628',
                height: robotSize >= 320 ? '100%' : 195,
                minHeight: robotSize >= 320 ? 0 : 195,
              }}
              animate={isDancing ? { borderColor: ['#818CF833', '#F472B633', '#818CF833'] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <OttoRobot size={robotSize} dancing={isDancing} highlightPart={currentStepData?.bodyPart} activeCommand={isDancing && currentStepData ? currentStepData.command : null} />
            </motion.div>
          </div>

          {/* YouTube Player */}
          {meta.youtubeUrl && (
            <div className="flex-shrink-0 px-5 py-2 md:px-0 md:py-0">
              {/* Iframe visible solo al bailar */}
              <iframe
                ref={youtubePlayerRef}
                className="w-full rounded-xl"
                height="160"
                style={{
                  background: '#0E0E1A',
                  border: '1px solid #161628',
                  display: isDancing ? 'block' : 'none',
                }}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube music player"
              />
              {/* Chip informativo cuando no está bailando */}
              {!isDancing && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1A1A35', border: '1px solid #2E2E55' }}>
                    <Music2 size={13} style={{ color: '#818CF8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: '#B0B0C8', fontSize: 11, fontWeight: 600 }}>Música vinculada</p>
                    <p className="truncate" style={{ color: '#4A4A6A', fontSize: 10 }}>{meta.youtubeUrl}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step chip + warnings */}
          <div className="flex-shrink-0 px-5 flex flex-col items-center gap-2 mb-1 md:px-0 md:items-start">
            <AnimatePresence mode="wait">
              {isDancing && currentStepData && (
                <motion.div key={`${currentStep}-${currentCmd}`} className="flex items-center gap-2 py-2 px-4 rounded-xl w-fit" style={{ background: '#111120', border: `1px solid ${currentStepData.color}30` }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}>
                  <motion.span style={{ fontSize: 18 }} animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>{currentStepData.icon}</motion.span>
                  <span style={{ color: currentStepData.color, fontSize: 13, fontWeight: 600 }}>{currentStepData.name}</span>
                  <div className="w-px h-3.5" style={{ background: '#1E1E30' }} />
                  <span style={{ color: '#4A4A6A', fontSize: 11, fontWeight: 600 }}>{currentStep + 1}/{steps.length}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {insecure && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#1A0F00', border: '1px solid #3A2000' }}>
                <WifiOff size={13} style={{ color: '#FBBF24' }} />
                <span style={{ color: '#FBBF24', fontSize: 11, fontWeight: 600 }}>Abre la app desde localhost o https:// para usar BLE</span>
              </div>
            )}
            {!connected && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#160F12', border: '1px solid #2A1520' }}>
                <AlertCircle size={13} style={{ color: '#F87171' }} />
                <span style={{ color: '#F87171', fontSize: 11, fontWeight: 600 }}>Conecta tu robot primero</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {(isDancing || isFinished) && (
            <div className="flex-shrink-0 px-5 mb-3 md:px-0 md:mb-2">
              <div className="flex justify-between mb-1">
                <span style={{ color: '#5A5A7A', fontSize: 10, fontWeight: 600 }}>{isDancing ? 'Progreso real' : 'Completado'}</span>
                <span style={{ color: '#818CF8', fontSize: 10, fontWeight: 700 }}>{fmt(elapsed)} / {fmt(totalDuration)}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#161628' }}>
                <motion.div className="h-full rounded-full" style={{ background: isFinished ? '#34D399' : '#818CF8' }} animate={{ width: `${isFinished ? 100 : progressPct}%` }} transition={{ duration: 0.2 }} />
              </div>
              <div className="flex gap-1 mt-2 flex-wrap justify-center md:justify-start">
                {steps.map((s, i) => (
                  <motion.div key={s.id} className="rounded-full" style={{ width: i === currentStep && isDancing ? 12 : 6, height: 6, background: i === currentStep && isDancing ? s.color : i < currentStep || isFinished ? `${s.color}60` : '#1E1E30', transition: 'all 0.2s' }} />
                ))}
              </div>
            </div>
          )}

          {/* Play button — desktop */}
          <div className="hidden md:block flex-shrink-0 pt-2">
            {playButton}
            {!noSteps && !isDancing && connected && (
              <p className="text-center mt-2" style={{ color: '#2E2E48', fontSize: 10 }}>Cada comando se envía cuando el robot termina el anterior</p>
            )}
          </div>
        </div>

        {/* Derecha: lista de pasos — altura fija, scroll interno */}
        <div className="flex-1 px-5 pb-4 md:px-0 md:pb-0 md:flex md:flex-col md:min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {noSteps ? (
            <div className="flex flex-col items-center justify-center py-10 md:flex-1 rounded-xl" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#111120', border: '1px solid #1C1C30' }}>
                <Layers size={20} style={{ color: '#1E1E35' }} />
              </div>
              <p style={{ color: '#2E2E48', fontSize: 12, fontWeight: 600 }}>Sin pasos para reproducir</p>
              <button onClick={() => navigate('/choreography')} className="mt-3 px-4 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform flex items-center gap-1" style={{ background: '#1A1A35', border: '1px solid #2E2E55', color: '#C4B5FD', fontSize: 12, fontWeight: 600 }}>
                Ir al Constructor <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden md:flex md:flex-col md:flex-1 md:min-h-0" style={{ background: '#0E0E1A', border: '1px solid #161628' }}>
              <div className="px-3 py-1.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #131322' }}>
                <span style={{ color: '#3A3A5A', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>SECUENCIA</span>
                <span style={{ color: '#3A3A5A', fontSize: 10 }}>{steps.length} paso{steps.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                {steps.map((step, i) => {
                  const isActive = isDancing && currentStep === i;
                  const isDone   = (isDancing && i < currentStep) || isFinished;
                  const stepDur  = getStepEstimatedDuration(step);
                  return (
                    <motion.div key={step.id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: '1px solid #111120', background: isActive ? `${step.color}0A` : 'transparent' }} animate={isActive ? { x: [0, 2, 0] } : {}} transition={{ duration: 0.4, repeat: isActive ? Infinity : 0 }}>
                      <motion.span style={{ color: isActive ? step.color : isDone ? '#2A2A40' : '#3A3A5A', fontSize: 10, fontWeight: 700, width: 18 }} animate={isActive ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>{i + 1}</motion.span>
                      <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: isActive ? `${step.color}15` : 'transparent' }}>
                        <span style={{ fontSize: 12, opacity: isDone ? 0.3 : 1 }}>{step.icon}</span>
                      </div>
                      <span className="flex-1" style={{ color: isActive ? '#E8E8F0' : isDone ? '#2A2A40' : '#7A7A98', fontSize: 12, fontWeight: isActive ? 600 : 400, textDecoration: isDone && !isFinished ? 'line-through' : 'none' }}>{step.name}</span>
                      <div className="text-right" style={{ minWidth: 60 }}>
                        <span style={{ color: isActive ? step.color : '#3A3A5A', fontSize: 10 }}>{fmt(stepDur)}</span>
                        {step.repetitions > 1 && <span style={{ color: '#3A3A5A', fontSize: 9 }}> ×{step.repetitions}</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Play button — mobile only */}
      <div className="md:hidden flex-shrink-0 px-5 pb-[5.5rem] pt-2">
        {playButton}
        {!noSteps && !isDancing && connected && (
          <p className="text-center mt-2" style={{ color: '#2E2E48', fontSize: 10 }}>Cada comando se envía cuando el robot termina el anterior</p>
        )}
      </div>
    </div>
  );
}
