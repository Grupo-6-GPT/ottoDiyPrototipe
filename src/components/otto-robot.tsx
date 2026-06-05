import { motion } from 'motion/react';
import { useState } from 'react';

interface OttoRobotProps {
  size?: number;
  dancing?: boolean;
  interactive?: boolean;
  onPartTap?: (part: string) => void;
  highlightPart?: string | null;
  color?: string;
  /** Active command drives per-move animation */
  activeCommand?: string | null;
}

const partMap: Record<string, string> = {
  head: '#A78BFA',
  body: '#F472B6',
  legs: '#818CF8',
};

/* ─── Per-command animation configs ─── */
type Anim = {
  body?: Record<string, any>;
  bodyT?: Record<string, any>;
  leftLeg?: Record<string, any>;
  leftLegT?: Record<string, any>;
  rightLeg?: Record<string, any>;
  rightLegT?: Record<string, any>;
  leftFoot?: Record<string, any>;
  leftFootT?: Record<string, any>;
  rightFoot?: Record<string, any>;
  rightFootT?: Record<string, any>;
  whole?: Record<string, any>;
  wholeT?: Record<string, any>;
  eyes?: Record<string, any>;
  eyesT?: Record<string, any>;
};

const COMMAND_ANIMS: Record<string, Anim> = {
  WALK_F: {
    leftLeg: { rotate: [0, -18, 0, 8, 0] },
    leftLegT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    rightLeg: { rotate: [0, 8, 0, -18, 0] },
    rightLegT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    whole: { y: [0, -2, 0, -2, 0] },
    wholeT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
  },
  WALK_B: {
    leftLeg: { rotate: [0, 8, 0, -18, 0] },
    leftLegT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    rightLeg: { rotate: [0, -18, 0, 8, 0] },
    rightLegT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    whole: { y: [0, -2, 0, -2, 0] },
    wholeT: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
  },
  TURN_L: {
    whole: { rotate: [0, -15, -15, 0], x: [0, -5, -5, 0] },
    wholeT: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
    leftLeg: { rotate: [0, 5, -5, 0] },
    leftLegT: { duration: 0.5, repeat: Infinity },
    rightLeg: { rotate: [0, -10, 10, 0] },
    rightLegT: { duration: 0.5, repeat: Infinity },
  },
  TURN_R: {
    whole: { rotate: [0, 15, 15, 0], x: [0, 5, 5, 0] },
    wholeT: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
    leftLeg: { rotate: [0, -10, 10, 0] },
    leftLegT: { duration: 0.5, repeat: Infinity },
    rightLeg: { rotate: [0, 5, -5, 0] },
    rightLegT: { duration: 0.5, repeat: Infinity },
  },
  SHAKE: {
    whole: { rotate: [0, -8, 8, -8, 8, 0] },
    wholeT: { duration: 0.35, repeat: Infinity, ease: 'easeInOut' },
    body: { rotate: [0, 5, -5, 5, -5, 0] },
    bodyT: { duration: 0.35, repeat: Infinity },
  },
  JUMP: {
    whole: { y: [0, 0, -20, -20, 0, 0] },
    wholeT: { duration: 0.7, repeat: Infinity, ease: [0.22, 1.4, 0.36, 1] },
    leftLeg: { rotate: [0, 0, 15, 15, 0, 0] },
    leftLegT: { duration: 0.7, repeat: Infinity },
    rightLeg: { rotate: [0, 0, -15, -15, 0, 0] },
    rightLegT: { duration: 0.7, repeat: Infinity },
  },
  MOONWALK: {
    leftLeg: { y: [0, 0, -4, 0], rotate: [0, 0, -12, -12] },
    leftLegT: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    rightLeg: { y: [0, -4, 0, 0], rotate: [-12, -12, 0, 0] },
    rightLegT: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    whole: { x: [0, 3, 0, -3, 0] },
    wholeT: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
    body: { rotate: [0, -2, 0, 2, 0] },
    bodyT: { duration: 1.6, repeat: Infinity },
  },
  SPIN: {
    whole: { rotate: [0, 360] },
    wholeT: { duration: 1.2, repeat: Infinity, ease: 'linear' },
  },
  TILT_L: {
    whole: { rotate: [0, -15, -15, 0] },
    wholeT: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
    leftLeg: { scaleY: [1, 0.85, 0.85, 1] },
    leftLegT: { duration: 1, repeat: Infinity },
  },
  TILT_R: {
    whole: { rotate: [0, 15, 15, 0] },
    wholeT: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
    rightLeg: { scaleY: [1, 0.85, 0.85, 1] },
    rightLegT: { duration: 1, repeat: Infinity },
  },
  STOMP: {
    leftLeg: { y: [0, -10, 2, 0, 0, 0] },
    leftLegT: { duration: 0.5, repeat: Infinity },
    rightLeg: { y: [0, 0, 0, -10, 2, 0] },
    rightLegT: { duration: 0.5, repeat: Infinity },
    whole: { y: [0, 0, 2, 0, 0, 2] },
    wholeT: { duration: 0.5, repeat: Infinity },
  },
  WIGGLE: {
    whole: { x: [0, -6, 6, -6, 6, 0] },
    wholeT: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
    body: { rotate: [0, -4, 4, -4, 4, 0] },
    bodyT: { duration: 0.5, repeat: Infinity },
    leftLeg: { rotate: [0, 3, -3, 3, -3, 0] },
    leftLegT: { duration: 0.5, repeat: Infinity },
    rightLeg: { rotate: [0, -3, 3, -3, 3, 0] },
    rightLegT: { duration: 0.5, repeat: Infinity },
  },
  FREEZE: {
    // No movement at all — static
  },
  BEEP: {
    eyes: { opacity: [1, 0.2, 1, 0.2, 1] },
    eyesT: { duration: 0.4, repeat: Infinity },
    whole: { y: [0, -1, 0] },
    wholeT: { duration: 0.2, repeat: Infinity },
  },
  MELODY: {
    eyes: { opacity: [1, 0.3, 1, 0.5, 1, 0.3, 1] },
    eyesT: { duration: 0.7, repeat: Infinity },
    whole: { rotate: [0, -3, 3, -3, 3, 0], y: [0, -2, 0, -2, 0] },
    wholeT: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    body: { rotate: [0, 2, -2, 2, -2, 0] },
    bodyT: { duration: 0.8, repeat: Infinity },
  },
  PAUSE: {
    // Idle breathing
    whole: { y: [0, -1, 0] },
    wholeT: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

export function OttoRobot({
  size = 160,
  dancing = false,
  interactive = false,
  onPartTap,
  highlightPart,
  color = '#EF4444',
  activeCommand,
}: OttoRobotProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const partStyle = (part: string): React.CSSProperties => {
    if (!interactive) return {};
    const active = highlightPart === part;
    const hover = hovered === part;
    return {
      cursor: 'pointer',
      filter: active
        ? `drop-shadow(0 0 10px ${partMap[part]}) drop-shadow(0 0 20px ${partMap[part]}55)`
        : hover
        ? `drop-shadow(0 0 6px ${partMap[part]}88)`
        : 'none',
      transition: 'filter 0.2s ease',
    };
  };

  const tap = (part: string) => { if (interactive && onPartTap) onPartTap(part); };

  const bodyColor = color;
  const bodyDark = '#C43030';
  const bodyDarker = '#A02828';

  // Get command-specific animations, fallback to generic dancing or idle
  const cmd = activeCommand || '';
  const anim = COMMAND_ANIMS[cmd];
  const hasAnim = !!anim && Object.keys(anim).length > 0;
  const isActive = hasAnim || dancing;

  // Fallback generic dance if dancing=true but no specific command
  const fallbackDance = dancing && !hasAnim;

  const wholeAnim = hasAnim ? (anim.whole || {}) : fallbackDance ? { rotate: [0, -4, 4, -4, 4, 0] } : {};
  const wholeT = hasAnim ? (anim.wholeT || { duration: 0.5, repeat: Infinity }) : fallbackDance ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' as const } : {};

  const bodyAnim = hasAnim ? (anim.body || {}) : {};
  const bodyT = hasAnim ? (anim.bodyT || { duration: 0.5, repeat: Infinity }) : {};

  const leftLegAnim = hasAnim ? (anim.leftLeg || {}) : fallbackDance ? { rotate: [0, -12, 12, 0] } : highlightPart === 'legs' ? { y: [0, -4, 0] } : {};
  const leftLegT = hasAnim ? (anim.leftLegT || { duration: 0.4, repeat: Infinity }) : fallbackDance ? { duration: 0.4, repeat: Infinity } : highlightPart === 'legs' ? { duration: 0.4, repeat: Infinity } : {};

  const rightLegAnim = hasAnim ? (anim.rightLeg || {}) : fallbackDance ? { rotate: [0, 12, -12, 0] } : highlightPart === 'legs' ? { y: [0, -4, 0] } : {};
  const rightLegT = hasAnim ? (anim.rightLegT || { duration: 0.4, repeat: Infinity }) : fallbackDance ? { duration: 0.4, repeat: Infinity } : highlightPart === 'legs' ? { duration: 0.4, repeat: Infinity } : {};

  const eyeAnim = hasAnim ? (anim.eyes || {}) : {};
  const eyeT = hasAnim ? (anim.eyesT || { duration: 0.5, repeat: Infinity }) : {};

  // Eye pupil movement
  const eyesPupilAnim = isActive && !eyeAnim.opacity
    ? { cy: [52, 56, 52], cx: [76, 78, 74, 76] }
    : {};
  const eyesPupilAnimR = isActive && !eyeAnim.opacity
    ? { cy: [52, 56, 52], cx: [124, 126, 122, 124] }
    : {};

  return (
    <motion.div
      animate={wholeAnim}
      transition={wholeT}
      style={{ width: size, height: size * 1.15 }}
      className="relative mx-auto select-none"
    >
      <svg viewBox="0 0 200 230" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        {/* === HEAD === */}
        <motion.g
          onClick={() => tap('head')}
          onMouseEnter={() => setHovered('head')}
          onMouseLeave={() => setHovered(null)}
          style={partStyle('head')}
          animate={eyeAnim}
          transition={eyeT}
        >
          <rect x="48" y="10" width="104" height="88" rx="10" fill={bodyColor} />
          <rect x="52" y="12" width="96" height="4" rx="2" fill={bodyColor} opacity="0.7" />
          <rect x="140" y="14" width="8" height="80" rx="4" fill={bodyDark} opacity="0.4" />
          <rect x="52" y="88" width="96" height="6" rx="3" fill={bodyDarker} opacity="0.3" />

          {/* Left eye */}
          <circle cx="76" cy="54" r="18" fill="#1A1A2E" stroke="#0D0D18" strokeWidth="2" />
          <circle cx="76" cy="54" r="13" fill="#0D0D18" />
          <circle cx="76" cy="54" r="6" fill="#1A1A2E" />
          <motion.circle
            cx="76" cy="52" r="3" fill="#fff" opacity="0.6"
            animate={eyesPupilAnim}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Right eye */}
          <circle cx="124" cy="54" r="18" fill="#1A1A2E" stroke="#0D0D18" strokeWidth="2" />
          <circle cx="124" cy="54" r="13" fill="#0D0D18" />
          <circle cx="124" cy="54" r="6" fill="#1A1A2E" />
          <motion.circle
            cx="124" cy="52" r="3" fill="#fff" opacity="0.6"
            animate={eyesPupilAnimR}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Beep indicator */}
          {(cmd === 'BEEP' || cmd === 'MELODY') && (
            <>
              <motion.circle
                cx="156" cy="24" r="6"
                fill="none" stroke="#A78BFA" strokeWidth="1.5"
                animate={{ r: [6, 12, 6], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
              <motion.circle
                cx="164" cy="18" r="4"
                fill="none" stroke="#A78BFA" strokeWidth="1"
                animate={{ r: [4, 10, 4], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
            </>
          )}
        </motion.g>

        {/* === BODY === */}
        <motion.g
          onClick={() => tap('body')}
          onMouseEnter={() => setHovered('body')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...partStyle('body'), transformOrigin: '100px 126px' }}
          animate={bodyAnim}
          transition={bodyT}
        >
          <rect x="56" y="100" width="88" height="52" rx="6" fill={bodyColor} />
          <rect x="144" y="104" width="6" height="44" rx="3" fill={bodyDark} opacity="0.35" />
          <rect x="60" y="144" width="80" height="4" rx="2" fill={bodyDarker} opacity="0.3" />
          <rect x="72" y="116" width="56" height="3" rx="1.5" fill={bodyDark} opacity="0.25" />
          <rect x="80" y="126" width="40" height="3" rx="1.5" fill={bodyDark} opacity="0.2" />
        </motion.g>

        {/* === LEFT LEG === */}
        <motion.g
          onClick={() => tap('legs')}
          onMouseEnter={() => setHovered('legs')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...partStyle('legs'), transformOrigin: '77px 154px' }}
          animate={leftLegAnim}
          transition={leftLegT}
        >
          <rect x="62" y="154" width="30" height="36" rx="5" fill={bodyColor} />
          <rect x="88" y="158" width="4" height="28" rx="2" fill={bodyDark} opacity="0.3" />
          <rect x="50" y="188" width="50" height="20" rx="5" fill={bodyColor} />
          <rect x="50" y="202" width="50" height="4" rx="2" fill={bodyDarker} opacity="0.35" />
          <rect x="52" y="206" width="46" height="3" rx="1.5" fill="#0B0B14" opacity="0.3" />
        </motion.g>

        {/* === RIGHT LEG === */}
        <motion.g
          onClick={() => tap('legs')}
          onMouseEnter={() => setHovered('legs')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...partStyle('legs'), transformOrigin: '123px 154px' }}
          animate={rightLegAnim}
          transition={rightLegT}
        >
          <rect x="108" y="154" width="30" height="36" rx="5" fill={bodyColor} />
          <rect x="134" y="158" width="4" height="28" rx="2" fill={bodyDark} opacity="0.3" />
          <rect x="100" y="188" width="50" height="20" rx="5" fill={bodyColor} />
          <rect x="100" y="202" width="50" height="4" rx="2" fill={bodyDarker} opacity="0.35" />
          <rect x="102" y="206" width="46" height="3" rx="1.5" fill="#0B0B14" opacity="0.3" />
        </motion.g>

        {/* Direction arrow for walk/turn */}
        {cmd === 'WALK_F' && (
          <motion.g animate={{ y: [0, -5, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <polygon points="100,230 92,242 108,242" fill="#818CF8" opacity="0.5" transform="rotate(180 100 236)" />
          </motion.g>
        )}
        {cmd === 'WALK_B' && (
          <motion.g animate={{ y: [0, 5, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <polygon points="100,230 92,242 108,242" fill="#818CF8" opacity="0.5" />
          </motion.g>
        )}
        {cmd === 'TURN_L' && (
          <motion.g animate={{ x: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <polygon points="28,120 38,112 38,128" fill="#818CF8" opacity="0.5" />
          </motion.g>
        )}
        {cmd === 'TURN_R' && (
          <motion.g animate={{ x: [0, 4, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <polygon points="172,120 162,112 162,128" fill="#818CF8" opacity="0.5" />
          </motion.g>
        )}

        {/* Shadow on floor */}
        <ellipse cx="100" cy="218" rx="55" ry="4" fill="#000" opacity="0.15" />

        {/* Interactive hints */}
        {interactive && hovered && (
          <g>
            <rect x="10" y="218" width="180" height="18" rx="4" fill="#141422" opacity="0.9" />
            <text
              x="100" y="230"
              textAnchor="middle"
              fill={partMap[hovered]}
              fontSize="10"
              fontWeight="600"
              fontFamily="Inter, sans-serif"
            >
              {typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'Toca' : 'Click'}: agregar movimiento de {hovered === 'head' ? 'cabeza' : hovered === 'body' ? 'cuerpo' : 'piernas'}
            </text>
          </g>
        )}
      </svg>
    </motion.div>
  );
}
