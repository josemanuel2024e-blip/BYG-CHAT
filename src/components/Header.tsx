import React, { useState } from 'react';
import { Shield, LogOut, ChevronLeft, UserCheck, Plus, Hash, Check, Copy, Volume2, VolumeX, Settings } from 'lucide-react';
import { User, CallState } from '../types';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';
import { soundFx } from '../utils/audioEffects';
import SVG_PATHS from '../assets/svg';

interface HeaderProps {
  currentUser: User;
  activeRoomName?: string;
  isWsConnected: boolean;
  callState: CallState;
  onOpenSecurityModal?: () => void;
  onStartVoiceCall: () => void;
  onLogout: () => void;
  onBackMobile?: () => void;
  showBackMobile?: boolean;
  onOpenDirectory?: () => void;
  onNewGroup?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onBackMobile,
  showBackMobile,
  onOpenDirectory,
  onNewGroup,
  onOpenProfile,
  onOpenSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(!soundFx.isMuted());
  const userXaon = formatXaonDisplay(currentUser.xaonId, currentUser.id);

  const handleCopyXaon = () => {
    navigator.clipboard.writeText(userXaon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = () => {
    const enabled = soundFx.toggleSound();
    setSoundEnabled(enabled);
    if (enabled) {
      soundFx.playMessageSend();
    }
  };

  return (
    <header className="bg-[#111111] border-b border-zinc-800 px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0 shadow-2xl z-20">
      {/* Left side: Back button on mobile & App Brand */}
      <div className="flex items-center space-x-2.5">
        {showBackMobile && onBackMobile && (
          <button
            onClick={onBackMobile}
            className="md:hidden p-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-blue-400 rounded-2xl font-bold text-xs flex items-center space-x-1 min-h-[44px] min-w-[44px] active:scale-95"
            title="Volver a chats"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 shrink-0 p-1.5 overflow-hidden">
          <img src={SVG_PATHS.logo} alt="BYG CHAT Logo" className="w-full h-full object-contain" />
        </div>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-black tracking-wider text-white truncate flex items-center space-x-1">
            <span>BYG CHAT</span>
          </h1>
          <p className="text-[11px] text-zinc-400 hidden sm:block truncate">
            Mensajería y llamadas
          </p>
        </div>
      </div>

      {/* Right Controls - Simplified & Merged for Space */}
      <div className="flex items-center space-x-2">
        {/* Sound FX Toggle Button */}
        <button
          onClick={handleToggleSound}
          className={`p-2 rounded-2xl border transition-all min-h-[42px] min-w-[42px] flex items-center justify-center active:scale-95 ${
            soundEnabled
              ? 'bg-blue-600/15 border-blue-500/30 text-blue-400 hover:bg-blue-600/25'
              : 'bg-[#1a1a1a] border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
          title={soundEnabled ? 'Efectos de sonido activados (haz clic para silenciar)' : 'Efectos de sonido desactivados (haz clic para activar)'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        {/* Merged Action Button: Directores y Grupos */}
        {onOpenDirectory && (
          <button
            onClick={onOpenDirectory}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all min-h-[42px] flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/20 active:scale-95"
            title="Buscar contactos por ID XAON"
          >
            <UserCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Contactos</span>
          </button>
        )}

        {onNewGroup && (
          <button
            onClick={onNewGroup}
            className="p-2 sm:px-3 sm:py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-200 rounded-2xl text-xs font-semibold transition-all min-h-[42px] flex items-center justify-center space-x-1.5 active:scale-95"
            title="Crear grupo"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline">Nuevo Grupo</span>
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-2xl bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-400 hover:text-white transition-all min-h-[42px] min-w-[42px] flex items-center justify-center active:scale-95"
            title="Ajustes Globales"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        {/* User Profile Avatar & XAON ID Badge */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-zinc-800">
          <button
            onClick={onOpenProfile}
            className="flex items-center space-x-2 hover:opacity-90 transition-opacity p-1 rounded-2xl hover:bg-zinc-800/50"
            title="Ver / Editar tu perfil"
          >
            <div className="hidden sm:flex flex-col items-end min-w-0">
              <span className="text-xs font-bold text-white truncate max-w-[110px]">{currentUser.name}</span>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyXaon();
                }}
                className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-lg flex items-center space-x-1 hover:bg-blue-500/20 transition-colors cursor-pointer"
                title="Tu ID XAON único (haz clic para copiar)"
              >
                <Hash className="w-3 h-3 text-blue-400" />
                <span>XAON: {userXaon}</span>
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </div>
            </div>

            <Avatar
              src={currentUser.avatar}
              name={currentUser.name}
              size="sm"
              status={currentUser.status || 'online'}
              showStatus
            />
          </button>

          <button
            onClick={onLogout}
            className="p-2 bg-[#1a1a1a] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 rounded-2xl transition-colors min-h-[42px] min-w-[42px] flex items-center justify-center active:scale-95"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};


