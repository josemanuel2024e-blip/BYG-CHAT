import React, { useState } from 'react';
import { X, Moon, Sun, Monitor, Palette, Type, Bell, Smartphone, LogOut, Check, Laptop, ShieldCheck, KeyRound, QrCode } from 'lucide-react';
import { UserSettings } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface SettingsModalProps {
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  onClose: () => void;
  currentUser?: { id: string; name: string };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdateSettings, onClose, currentUser }) => {
  const [pinInput, setPinInput] = useState(settings.appPin || '1234');
  const [showQR, setShowQR] = useState(false);
  
  // Linking token logic (simulated functional API data)
  const linkingPayload = JSON.stringify({
    action: 'link_device',
    uid: currentUser?.id,
    timestamp: Date.now(),
    app: 'BYG_CHAT_V2'
  });
  const accentColors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
  ];

  const fontSizes = [
    { id: 'small', label: 'Pequeño', class: 'text-xs' },
    { id: 'medium', label: 'Normal', class: 'text-sm' },
    { id: 'large', label: 'Grande', class: 'text-base' },
  ];

  const linkedDevices = [
    { id: '1', name: 'Chrome en Windows', lastActive: 'Ahora', isCurrent: true, icon: Monitor },
    { id: '2', name: 'App en iPhone 13', lastActive: 'Hace 2 horas', isCurrent: false, icon: Smartphone },
    { id: '3', name: 'MacBook Pro', lastActive: 'Ayer', isCurrent: false, icon: Laptop },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111111] w-full max-w-2xl max-h-[85vh] rounded-[2rem] border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 rounded-2xl">
              <Monitor className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ajustes Globales</h2>
              <p className="text-sm text-zinc-400">Personaliza tu experiencia en BYG CHAT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Island Style Layout */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          
          {/* Island 1: Appearance */}
          <div className="bg-[#161616] rounded-3xl p-5 border border-zinc-800/50 space-y-4">
            <div className="flex items-center space-x-2 text-zinc-300 font-semibold mb-2">
              <Palette className="w-5 h-5 text-purple-400" />
              <span>Personalización Visual</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Theme Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tema</label>
                <div className="flex bg-[#222222] p-1 rounded-2xl border border-zinc-800">
                  <button
                    onClick={() => onUpdateSettings({ theme: 'dark' })}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${settings.theme === 'dark' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Moon className="w-4 h-4" />
                    <span className="text-sm">Oscuro</span>
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ theme: 'light' })}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl transition-all ${settings.theme === 'light' ? 'bg-white text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Sun className="w-4 h-4" />
                    <span className="text-sm">Claro</span>
                  </button>
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Color de Acento</label>
                <div className="flex flex-wrap gap-2">
                  {accentColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => onUpdateSettings({ accentColor: color.value })}
                      className="w-8 h-8 rounded-full border-2 transition-transform active:scale-90 flex items-center justify-center"
                      style={{ backgroundColor: color.value, borderColor: settings.accentColor === color.value ? 'white' : 'transparent' }}
                    >
                      {settings.accentColor === color.value && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Island 2: Accessibility */}
          <div className="bg-[#161616] rounded-3xl p-5 border border-zinc-800/50 space-y-4">
            <div className="flex items-center space-x-2 text-zinc-300 font-semibold mb-2">
              <Type className="w-5 h-5 text-blue-400" />
              <span>Accesibilidad</span>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tamaño de Fuente</label>
              <div className="grid grid-cols-3 gap-3">
                {fontSizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => onUpdateSettings({ fontSize: size.id as any })}
                    className={`p-3 rounded-2xl border transition-all text-center ${
                      settings.fontSize === size.id
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'bg-[#222222] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span className={`block font-bold ${size.class}`}>{size.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Island 3: Security */}
          <div className="bg-[#161616] rounded-3xl p-5 border border-zinc-800/50 space-y-4">
            <div className="flex items-center space-x-2 text-zinc-300 font-semibold mb-2">
              <ShieldCheck className="w-5 h-5 text-red-400" />
              <span>Seguridad Avanzada</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#222222]/50 border border-zinc-800/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-red-500/10 rounded-xl">
                    <KeyRound className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">PIN de Bloqueo</span>
                    <span className="text-xs text-zinc-500">Se activa tras 5 minutos de inactividad</span>
                  </div>
                </div>
                <input 
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPinInput(val);
                    if (val.length === 4) {
                      onUpdateSettings({ appPin: val });
                    }
                  }}
                  className="w-16 bg-[#111111] border border-zinc-800 rounded-xl px-3 py-2 text-center font-mono text-lg text-blue-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="****"
                />
              </div>
            </div>
          </div>

          {/* Island 4: Linked Devices */}
          <div className="bg-[#161616] rounded-3xl p-5 border border-zinc-800/50 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-zinc-300 font-semibold">
                <Smartphone className="w-5 h-5 text-green-400" />
                <span>Dispositivos Vinculados</span>
              </div>
              <button 
                onClick={() => setShowQR(!showQR)}
                className="flex items-center space-x-2 text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-400/10 px-3 py-1.5 rounded-xl transition-all"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Vincular Nuevo</span>
              </button>
            </div>

            {showQR && (
              <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl mb-4 animate-in fade-in zoom-in duration-300">
                <QRCodeSVG 
                  value={linkingPayload}
                  size={180}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: "/icon.png",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
                <p className="text-[#080808] text-[10px] font-bold mt-4 text-center uppercase tracking-widest opacity-60">
                  Escanea para sincronizar tu cuenta
                </p>
              </div>
            )}

            <div className="space-y-2">
              {linkedDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#222222]/50 border border-zinc-800/50 group">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2.5 rounded-xl ${device.isCurrent ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      <device.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white">{device.name}</span>
                        {device.isCurrent && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full uppercase font-bold">Este dispositivo</span>}
                      </div>
                      <span className="text-xs text-zinc-500">Última actividad: {device.lastActive}</span>
                    </div>
                  </div>
                  {!device.isCurrent && (
                    <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:bg-red-500/10 rounded-xl" title="Cerrar sesión">
                      <LogOut className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-[#161616]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
