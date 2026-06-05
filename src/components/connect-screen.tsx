import { motion, AnimatePresence } from 'motion/react';
import { Bluetooth, BluetoothOff, Battery, Signal, Cpu, Settings, ChevronRight } from 'lucide-react';
import { OttoRobot } from './otto-robot';
import { useConnection } from '../store';
import { useState } from 'react';
import { toast } from 'sonner';

export function ConnectScreen() {
  const { connected, battery, deviceName, connect, disconnect, transportMode } = useConnection();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (navigator.vibrate) navigator.vibrate(15);
    setConnecting(true);

    try {
      const connection = await connect();
      toast.success(connection.mode === 'serial' ? 'Robot conectado por USB' : 'Robot conectado por Bluetooth');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar al robot';
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-dvh overflow-y-auto px-5 pb-24 pt-8 md:justify-center md:py-12" style={{ WebkitOverflowScrolling: 'touch' as any }}>
      {/* Robot */}
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <OttoRobot size={160} dancing={connected} />
      </motion.div>

      {/* Title */}
      <motion.h1
        className="mt-4 text-center"
        style={{ fontSize: 26, fontWeight: 800, color: '#E8E8F0', letterSpacing: '-0.5px' }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        OttoDance
      </motion.h1>
      <motion.p
        style={{ color: '#4A4A6A', fontSize: 13, marginTop: 2 }}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Create. Dance. Repeat.
      </motion.p>

      {/* Status */}
      <motion.div
        className="flex items-center gap-2 mt-5 px-3.5 py-2 rounded-full"
        style={{ background: '#111120', border: '1px solid #1C1C30' }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: connected ? '#34D399' : connecting ? '#FBBF24' : '#EF4444' }}
          animate={connecting ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
        <span style={{ color: connected ? '#34D399' : connecting ? '#FBBF24' : '#5A5A7A', fontSize: 12, fontWeight: 600 }}>
          {connected ? 'Connected' : connecting ? 'Searching...' : 'Not connected'}
        </span>
        {connected && (
          <>
            <div className="w-px h-3" style={{ background: '#1E1E33' }} />
            <Battery size={13} style={{ color: battery > 20 ? '#34D399' : '#F87171' }} />
            <span style={{ color: battery > 20 ? '#34D399' : '#F87171', fontSize: 12, fontWeight: 600 }}>{battery}%</span>
          </>
        )}
      </motion.div>

      {/* Connect button */}
      <motion.button
        className="mt-7 flex items-center gap-3 px-8 py-4 rounded-2xl cursor-pointer"
        style={{
          background: connected ? '#160F12' : connecting ? '#141422' : '#15152A',
          border: connected ? '1px solid #2A1520' : '1px solid #252545',
          color: connected ? '#F87171' : '#C4B5FD',
          fontSize: 16, fontWeight: 700,
          opacity: connecting ? 0.7 : 1,
          pointerEvents: connecting ? 'none' : 'auto',
        }}
        whileTap={{ scale: 0.96 }}
        onClick={connected ? disconnect : handleConnect}
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {connected ? <BluetoothOff size={18} /> : (
          <motion.div
            animate={connecting ? { rotate: 360 } : { scale: [1, 1.12, 1] }}
            transition={connecting ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 2, repeat: Infinity }}
          >
            <Bluetooth size={18} />
          </motion.div>
        )}
        {connected ? 'Disconnect' : connecting ? 'Connecting...' : 'Connect Robot'}
      </motion.button>

      {/* Device info */}
      <AnimatePresence>
        {connected && (
          <motion.div
            className="mt-5 w-full max-w-xs md:max-w-sm flex flex-col gap-2"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
          >
            {/* Device card */}
            <div className="p-3.5 rounded-xl" style={{ background: '#111120', border: '1px solid #1C1C30' }}>
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1A1A30' }}>
                  <Cpu size={16} style={{ color: '#818CF8' }} />
                </div>
                <div className="flex-1">
                  <p style={{ color: '#D0D0E0', fontSize: 13, fontWeight: 700 }}>{deviceName || 'Otto-BT-001'}</p>
                  <p style={{ color: '#4A4A6A', fontSize: 11 }}>{transportMode === 'serial' ? 'ESP32 · USB Serial' : 'ESP32 · BLE UART'}</p>
                </div>
                <ChevronRight size={14} style={{ color: '#3A3A5A' }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Signal, label: 'Signal', value: 'Strong', color: '#34D399' },
                  { icon: Battery, label: 'Battery', value: `${battery}%`, color: battery > 20 ? '#34D399' : '#F87171' },
                  { icon: Settings, label: 'Firmware', value: 'v2.1', color: '#818CF8' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-1 py-2 rounded-lg" style={{ background: '#0E0E1A' }}>
                    <item.icon size={12} style={{ color: item.color }} />
                    <span style={{ color: item.color, fontSize: 11, fontWeight: 700 }}>{item.value}</span>
                    <span style={{ color: '#3A3A5A', fontSize: 9 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Servo test hint */}
            <div className="p-3 rounded-xl flex items-center gap-2.5" style={{ background: '#111120', border: '1px solid #1C1C30' }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#1A1A30' }}>
                <span style={{ fontSize: 14 }}>🔧</span>
              </div>
              <div className="flex-1">
                <p style={{ color: '#B0B0C8', fontSize: 12, fontWeight: 600 }}>4 servos detected</p>
                <p style={{ color: '#3A3A5A', fontSize: 10 }}>Left hip · Right hip · Left foot · Right foot</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}