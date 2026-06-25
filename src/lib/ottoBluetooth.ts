// ottoBluetooth.ts
// Envía comandos al Otto por BLE o Serial exactamente igual que por Serial:
// cada comando termina en \n.
//
// CAMBIO CLAVE para secuencias:
//   Ya NO se usa SEQ:CMD1,CMD2,...  (el ESP32 lo ejecuta bloqueando BLE).
//   En cambio, sendOttoSequence() envía cada comando individualmente
//   esperando arduinoDuration ms entre uno y el siguiente, de modo que
//   el robot termina el movimiento antes de recibir el próximo comando.

const OTTO_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const OTTO_UART_RX_UUID      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const OTTO_BATTERY_SERVICE_UUID = 'battery_service';
const OTTO_BATTERY_LEVEL_UUID   = 'battery_level';

const textEncoder = new TextEncoder();

// ── Duraciones reales del Arduino por comando (ms) ─────────────
// Deben coincidir con los valores en store.ts → AVAILABLE_MOVES.arduinoDuration
const ARDUINO_DURATIONS: Record<string, number> = {
  WALK_F: 2160, WALK_B: 2160,
  WALK_F_FAST: 1360, WALK_F_SLOW: 3600, WALK_B_FAST: 1360, WALK_B_SLOW: 3600,
  TURN_L: 1120, TURN_R: 1120, TURN_L_FAST: 880, TURN_R_FAST: 880,
  JUMP: 520,
  MOONWALK: 1840, MOONWALK_B: 1840,
  SPIN: 1600, SPIN_L: 2000, SPIN_R: 2000, SPIN_L_FAST: 1360, SPIN_R_FAST: 1360,
  MARCH_F: 1900, MARCH_B: 1900,
  SNEAK_F: 4400, SNEAK_B: 4400,
  STRUT_F: 2500, STRUT_B: 2500,
  SIDE_STEP_L: 2800, SIDE_STEP_R: 2800, SIDE_STEP_FAST: 10400,
  LEAN_L: 875, LEAN_R: 875, LEAN_F: 875, LEAN_B: 875,
  BALANCE: 6000, ROCK_LR: 900, ROCK_LR_FAST: 810, ROCK_FB: 1800,
  WIDE_STAND: 750, PIGEON_L: 750, PIGEON_R: 750,
  KICK_L: 800, KICK_R: 800,
  STOMP: 810, STOMP_L: 485, STOMP_R: 485, STOMP_ALTERNATE: 3900,
  HI_FIVE_L: 460, HI_FIVE_R: 460,
  CROUCH: 800, SQUAT: 1400, SQUAT_PULSE: 850,
  SHAKE: 1360, SHIMMY: 1600, SHIMMY_SLOW: 2200, WIGGLE: 1200,
  TILT_L: 650, TILT_R: 650,
  SWING: 3400, SWING_BIG: 3400, UPDOWN: 3400, UPDOWN_BIG: 3400,
  BOUNCE: 2400, BOUNCE_BIG: 2000,
  BODY_ROLL: 3900, BODY_ROLL_FAST: 2400,
  WAVE_L: 3400, WAVE_R: 3400, WAVE_FULL: 7600,
  PULSE_LR: 2800, JITTER: 1840, JITTER_SMALL: 1840,
  DISCO_L: 2400, DISCO_R: 2400,
  ROBOT_STEP: 2900, ROBOT_STEP_FAST: 2200,
  ASCENDING: 4000, TIPTOE: 4400, ELECTRIC_SLIDE: 13600,
  SCARED: 1000, HAPPY_DANCE: 5200, SAD_WALK: 11200,
  DIZZY: 10000, TIRED: 1350, SNEEZE: 450,
  COMBO_SALSA: 6600, COMBO_ROBOT: 5400, COMBO_WAVE: 9700, COMBO_REGGAETON: 7200,
  SMOOTH: 25000, SMOOTH_CRIMINAL: 25000,
  SHAKE_IT: 10900, DEMO: 120000,
  HOME: 400, NEUTRO: 400, FREEZE: 300, PAUSE: 300, BEEP: 200, MELODY: 1600,
};

/** Retorna la duración real del Arduino para un comando (con parámetro opcional). */
function getCommandDuration(rawCommand: string): number {
  const upper = rawCommand.toUpperCase();
  const colonIdx = upper.indexOf(':');
  const base = colonIdx !== -1 ? upper.substring(0, colonIdx) : upper;
  const param = colonIdx !== -1 ? parseInt(upper.substring(colonIdx + 1)) : NaN;

  // Para WALK_F:VEL → duración real = VEL*4 + 400 (2 pasos × 4 fases × VEL + neutro)
  if ((base === 'WALK_F' || base === 'WALK_B') && !isNaN(param) && param > 0) {
    return param * 4 * 2 + 400; // 2 pasos, 4 mover() cada uno
  }
  if ((base === 'TURN_L' || base === 'TURN_R') && !isNaN(param) && param > 0) {
    return param * 2 * 2 + 400;
  }
  if ((base === 'MOONWALK' || base === 'MOONWALK_B') && !isNaN(param) && param > 0) {
    return param * 4 * 2 + 400;
  }
  if (base === 'PAUSE' && !isNaN(param) && param > 0) {
    return param;
  }

  return ARDUINO_DURATIONS[base] ?? 1000;
}

// ── Tipos internos ─────────────────────────────────────────
type OttoBluetoothCharacteristic = {
  properties: { writeWithoutResponse?: boolean };
  writeValueWithoutResponse: (value: Uint8Array) => Promise<void>;
  writeValue: (value: Uint8Array) => Promise<void>;
  readValue: () => Promise<DataView>;
};

type OttoBluetoothService = {
  getCharacteristic: (uuid: string) => Promise<OttoBluetoothCharacteristic>;
};

type OttoBluetoothServer = {
  getPrimaryService: (uuid: string) => Promise<OttoBluetoothService>;
};

type OttoBluetoothDevice = {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<OttoBluetoothServer>;
    disconnect: () => void;
  };
  addEventListener: (type: 'gattserverdisconnected', listener: () => void) => void;
  removeEventListener: (type: 'gattserverdisconnected', listener: () => void) => void;
};

type OttoBluetoothConnection = {
  device: OttoBluetoothDevice;
  rxCharacteristic: OttoBluetoothCharacteristic;
};

type OttoSerialPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
};

type OttoSerialConnection = {
  port: OttoSerialPort;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

export type OttoConnection =
  | { mode: 'bluetooth'; deviceName: string; battery: number; device: OttoBluetoothDevice }
  | { mode: 'serial';    deviceName: string; battery: number };

// ── Estado global ──────────────────────────────────────────
let bluetoothConnection: OttoBluetoothConnection | null = null;
let serialConnection: OttoSerialConnection | null = null;

// ── Callbacks de estado de conexión ───────────────────────
type ConnectionStateCallback = (connected: boolean) => void;
const connectionStateCallbacks: ConnectionStateCallback[] = [];

export function onConnectionStateChange(cb: ConnectionStateCallback) {
  connectionStateCallbacks.push(cb);
  return () => {
    const idx = connectionStateCallbacks.indexOf(cb);
    if (idx !== -1) connectionStateCallbacks.splice(idx, 1);
  };
}

function notifyConnectionState(connected: boolean) {
  connectionStateCallbacks.forEach(cb => cb(connected));
}

// ── Reconexión automática ──────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;
let reconnecting = false;

async function attemptReconnect(device: OttoBluetoothDevice): Promise<void> {
  if (reconnecting) return;
  reconnecting = true;
  reconnectAttempts = 0;

  while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const waitMs = Math.min(500 * reconnectAttempts, 3000);
    console.log(`[Otto] Reconectando intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${waitMs}ms...`);
    await new Promise(r => setTimeout(r, waitMs));

    try {
      if (!device.gatt) break;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(OTTO_UART_SERVICE_UUID);
      const rxCharacteristic = await service.getCharacteristic(OTTO_UART_RX_UUID);
      bluetoothConnection = { device, rxCharacteristic };
      reconnecting = false;
      reconnectAttempts = 0;
      notifyConnectionState(true);
      console.log('[Otto] Reconectado.');
      return;
    } catch (e) {
      console.warn(`[Otto] Intento ${reconnectAttempts} fallido:`, e);
    }
  }

  reconnecting = false;
  bluetoothConnection = null;
  notifyConnectionState(false);
  console.error('[Otto] No se pudo reconectar.');
}

async function waitForConnection(timeoutMs = 4000): Promise<boolean> {
  if (bluetoothConnection) return true;
  if (!reconnecting) return false;
  const start = Date.now();
  while (reconnecting && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 100));
    if (bluetoothConnection) return true;
  }
  return !!bluetoothConnection;
}

// ── Diagnósticos ───────────────────────────────────────────
export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export function isSerialSupported() {
  return typeof navigator !== 'undefined' && !!(navigator as any).serial;
}

export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

export function getBluetoothDiagnostics() {
  const n = typeof navigator !== 'undefined' ? (navigator as any) : null;
  return {
    hasNavigator: !!n,
    userAgent: n?.userAgent || null,
    hasBluetooth: !!n?.bluetooth,
    isSecureContext: isSecureContext(),
    protocol: typeof window !== 'undefined' ? window.location.protocol : null,
  };
}

if (typeof window !== 'undefined') {
  try { (window as any).ottoBluetoothDiagnostics = getBluetoothDiagnostics; } catch { /* ignore */ }
}

// ── Conexión BLE ───────────────────────────────────────────
export async function connectOttoBluetooth() {
  if (!isSecureContext()) {
    throw new Error(
      'La app debe servirse desde https:// o localhost para usar Bluetooth.\n' +
      'Accede via http://localhost:5173 en lugar de la IP local.'
    );
  }
  if (!isBluetoothSupported()) {
    throw new Error('Tu navegador no soporta Web Bluetooth. Usa Chrome o Edge en escritorio/Android.');
  }

  const bluetooth = (navigator as any).bluetooth;
  let device: OttoBluetoothDevice;
  try {
    device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [OTTO_UART_SERVICE_UUID, OTTO_BATTERY_SERVICE_UUID],
    });
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      throw new Error('No se seleccionó ningún dispositivo. Elige Otto-BT-001 en el diálogo.');
    }
    if (err?.name === 'SecurityError') {
      throw new Error('Permiso denegado. La app necesita correr en https:// o localhost.');
    }
    throw new Error(`Error al seleccionar dispositivo BLE: ${err?.message || String(err)}`);
  }

  if (!device.gatt) throw new Error('No se pudo acceder al servidor GATT del robot.');

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(OTTO_UART_SERVICE_UUID);
  const rxCharacteristic = await service.getCharacteristic(OTTO_UART_RX_UUID);

  let battery = 85;
  try {
    const batteryService = await server.getPrimaryService(OTTO_BATTERY_SERVICE_UUID);
    const batteryChar = await batteryService.getCharacteristic(OTTO_BATTERY_LEVEL_UUID);
    const value = await batteryChar.readValue();
    battery = value.getUint8(0);
  } catch { /* battery no disponible */ }

  bluetoothConnection = { device, rxCharacteristic };

  device.addEventListener('gattserverdisconnected', () => {
    console.log('[Otto] GATT desconectado, reconectando...');
    bluetoothConnection = null;
    notifyConnectionState(false);
    attemptReconnect(device);
  });

  notifyConnectionState(true);

  return {
    mode: 'bluetooth' as const,
    deviceName: device.name || 'Otto-BT-001',
    battery,
    device,
  };
}

// ── Conexión Serial ────────────────────────────────────────
export async function connectOttoSerial() {
  if (!isSerialSupported()) {
    throw new Error('Tu navegador no soporta Web Serial. Usa Chrome o Edge.');
  }
  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 115200 });
  if (!port.writable) throw new Error('No se pudo abrir el puerto serial.');
  const writer = port.writable.getWriter();
  serialConnection = { port, writer };
  return { mode: 'serial' as const, deviceName: 'Otto USB', battery: 0 };
}

// ── Desconexión ────────────────────────────────────────────
export async function disconnectOttoBluetooth() {
  reconnecting = false;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  if (bluetoothConnection?.device.gatt?.connected) {
    bluetoothConnection.device.gatt.disconnect();
  }
  bluetoothConnection = null;
  notifyConnectionState(false);
}

export async function disconnectOttoSerial() {
  if (serialConnection) {
    try { await serialConnection.writer.close(); } catch { /* ignore */ }
    try { await serialConnection.port.close(); } catch { /* ignore */ }
  }
  serialConnection = null;
}

// ── Envío de un solo comando ───────────────────────────────
// Igual que por Serial: manda "COMANDO\n"
export async function sendOttoBluetoothCommand(command: string): Promise<boolean> {
  const ready = await waitForConnection();
  if (!ready || !bluetoothConnection) return false;

  const payload = textEncoder.encode(`${command}\n`);
  try {
    if (bluetoothConnection.rxCharacteristic.properties.writeWithoutResponse) {
      await bluetoothConnection.rxCharacteristic.writeValueWithoutResponse(payload);
    } else {
      await bluetoothConnection.rxCharacteristic.writeValue(payload);
    }
    return true;
  } catch (e) {
    console.error('[Otto BLE] write error:', e);
    return false;
  }
}

export async function sendOttoSerialCommand(command: string): Promise<boolean> {
  if (!serialConnection) return false;
  try {
    await serialConnection.writer.write(textEncoder.encode(`${command}\n`));
    return true;
  } catch { return false; }
}

// ── Envío de secuencia ─────────────────────────────────────
// IMPORTANTE: NO usa SEQ: — envía cada comando por separado
// esperando el tiempo real que tarda el Arduino en ejecutarlo.
// Así el robot termina cada movimiento antes de recibir el siguiente,
// exactamente igual que cuando uno los escribe por Serial a mano.
export async function sendOttoSequence(
  commands: string[],
  onProgress?: (index: number, total: number) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  if (commands.length === 0) return true;

  for (let i = 0; i < commands.length; i++) {
    if (signal?.aborted) return false;

    const cmd = commands[i];
    const ok = await sendOttoRobotCommand(cmd);
    if (!ok) return false;

    onProgress?.(i, commands.length);

    const duration = getCommandDuration(cmd);
    // Esperar la duración real del movimiento + 80ms de margen
    await new Promise<void>((resolve, reject) => {
      const id = setTimeout(resolve, duration + 80);
      if (signal) {
        signal.addEventListener('abort', () => { clearTimeout(id); reject(new Error('aborted')); }, { once: true });
      }
    });
  }

  onProgress?.(commands.length, commands.length);
  return true;
}

// ── API pública unificada ──────────────────────────────────
export async function connectOttoRobot(): Promise<OttoConnection> {
  if (isBluetoothSupported()) return connectOttoBluetooth();
  if (isSerialSupported())    return connectOttoSerial();
  throw new Error('Ni Web Bluetooth ni Web Serial están disponibles. Usa Chrome o Edge.');
}

export async function disconnectOttoRobot() {
  await Promise.all([disconnectOttoBluetooth(), disconnectOttoSerial()]);
}

export function sendOttoRobotCommand(command: string) {
  if (bluetoothConnection) return sendOttoBluetoothCommand(command);
  if (serialConnection)    return sendOttoSerialCommand(command);
  return Promise.resolve(false);
}

export function getOttoTransportMode() {
  return bluetoothConnection ? 'bluetooth' : serialConnection ? 'serial' : null;
}

export function isReconnecting() { return reconnecting; }
export function isConnected()    { return !!bluetoothConnection || !!serialConnection; }

// ── Utilidad exportada para la UI ─────────────────────────
export { getCommandDuration };