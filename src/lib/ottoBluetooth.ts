const OTTO_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const OTTO_UART_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const OTTO_BATTERY_SERVICE_UUID = 'battery_service';
const OTTO_BATTERY_LEVEL_UUID = 'battery_level';

const textEncoder = new TextEncoder();

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
  mtu: number;
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

type OttoConnection =
  | { mode: 'bluetooth'; deviceName: string; battery: number; device: OttoBluetoothDevice }
  | { mode: 'serial'; deviceName: string; battery: number };

let bluetoothConnection: OttoBluetoothConnection | null = null;
let serialConnection: OttoSerialConnection | null = null;

// ── NUEVO: callbacks para notificar a la UI el estado de conexión ──
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

const BLE_DEFAULT_MTU_PAYLOAD = 20;

// ── NUEVO: reconexión automática ──
// Cuando el GATT se desconecta, guarda el device para poder reconectar.
// Intenta reconectar hasta MAX_RECONNECT_ATTEMPTS veces con backoff.
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;
let reconnecting = false;

async function attemptReconnect(device: OttoBluetoothDevice): Promise<void> {
  if (reconnecting) return;
  reconnecting = true;
  reconnectAttempts = 0;

  while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const waitMs = Math.min(500 * reconnectAttempts, 3000); // 500ms, 1s, 1.5s, 2s, 2.5s
    console.log(`[Otto] Reconectando intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} en ${waitMs}ms...`);
    await new Promise(r => setTimeout(r, waitMs));

    try {
      if (!device.gatt) break;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(OTTO_UART_SERVICE_UUID);
      const rxCharacteristic = await service.getCharacteristic(OTTO_UART_RX_UUID);

      bluetoothConnection = { device, rxCharacteristic, mtu: BLE_DEFAULT_MTU_PAYLOAD };
      reconnecting = false;
      reconnectAttempts = 0;
      notifyConnectionState(true);
      console.log('[Otto] Reconectado exitosamente.');
      return;
    } catch (e) {
      console.warn(`[Otto] Intento ${reconnectAttempts} fallido:`, e);
    }
  }

  // Agotamos los intentos
  reconnecting = false;
  bluetoothConnection = null;
  notifyConnectionState(false);
  console.error('[Otto] No se pudo reconectar después de varios intentos.');
}

export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth;
}

export function isSerialSupported() {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { serial?: unknown }).serial;
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
  try {
    (window as any).ottoBluetoothDiagnostics = getBluetoothDiagnostics;
  } catch (e) { /* ignore */ }
}

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
      throw new Error('No se seleccionó ningún dispositivo. Asegúrate de elegir el ESP32 (Otto-BT-001) en el diálogo.');
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
  } catch { /* battery not available */ }

  bluetoothConnection = { device, rxCharacteristic, mtu: BLE_DEFAULT_MTU_PAYLOAD };

  // ── NUEVO: al desconectarse, intentar reconectar automáticamente ──
  device.addEventListener('gattserverdisconnected', () => {
    console.log('[Otto] GATT desconectado, intentando reconectar...');
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

export async function connectOttoSerial() {
  if (!isSerialSupported()) {
    throw new Error('Tu navegador no soporta Web Serial. Usa Chrome o Edge, o conecta por Bluetooth.');
  }
  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 115200 });
  if (!port.writable) throw new Error('No se pudo abrir el puerto serial.');
  const writer = port.writable.getWriter();
  serialConnection = { port, writer };
  return { mode: 'serial' as const, deviceName: 'Otto USB', battery: 0 };
}

export async function disconnectOttoBluetooth() {
  // ── NUEVO: cancelar reconexión pendiente al desconectar manualmente ──
  reconnecting = false;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // evita que attemptReconnect siga
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

// ── NUEVO: helper interno que espera reconexión si está en progreso ──
async function waitForConnection(timeoutMs = 4000): Promise<boolean> {
  if (bluetoothConnection) return true;
  if (!reconnecting) return false;

  // Espera hasta que reconecte o falle
  const start = Date.now();
  while (reconnecting && Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 100));
    if (bluetoothConnection) return true;
  }
  return !!bluetoothConnection;
}

export async function sendOttoBluetoothCommand(command: string): Promise<boolean> {
  // ── NUEVO: esperar reconexión si está en progreso ──
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

export async function sendOttoSequence(commands: string[]): Promise<boolean> {
  // ── NUEVO: esperar reconexión si está en progreso ──
  const ready = await waitForConnection();
  if (!ready || !bluetoothConnection || commands.length === 0) return false;

  const message = `SEQ:${commands.join(',')}\n`;
  const bytes = textEncoder.encode(message);
  const mtu = bluetoothConnection.mtu;

  try {
    for (let offset = 0; offset < bytes.length; offset += mtu) {
      // ── NUEVO: verificar conexión en cada chunk, no solo al inicio ──
      if (!bluetoothConnection) {
        console.warn('[Otto BLE] conexión perdida durante secuencia');
        return false;
      }
      const chunk = bytes.slice(offset, offset + mtu);
      if (bluetoothConnection.rxCharacteristic.properties.writeWithoutResponse) {
        await bluetoothConnection.rxCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await bluetoothConnection.rxCharacteristic.writeValue(chunk);
      }
      if (offset + mtu < bytes.length) {
        await new Promise(r => setTimeout(r, 20));
      }
    }
    return true;
  } catch (e) {
    console.error('[Otto BLE] sequence write error:', e);
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

export async function connectOttoRobot(): Promise<OttoConnection> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth no disponible. Usa Chrome o Edge en escritorio.');
  }
  return connectOttoBluetooth();
}

export async function disconnectOttoRobot() {
  await Promise.all([disconnectOttoBluetooth(), disconnectOttoSerial()]);
}

export function sendOttoRobotCommand(command: string) {
  if (bluetoothConnection) return sendOttoBluetoothCommand(command);
  if (serialConnection) return sendOttoSerialCommand(command);
  return Promise.resolve(false);
}

export function getOttoTransportMode() {
  return bluetoothConnection ? 'bluetooth' : serialConnection ? 'serial' : null;
}

// ── NUEVO: exponer estado de reconexión para la UI ──
export function isReconnecting() {
  return reconnecting;
}

export function isConnected() {
  return !!bluetoothConnection;
}