import React from 'react';
import { Shield, Lock, Key, Phone, Radio, LogOut, ChevronLeft, UserCheck, Users } from 'lucide-react';
import { User, CallState } from '../types';
import { Avatar } from './Avatar';

interface HeaderProps {
  currentUser: User;
  activeRoomName?: string;
  isWsConnected: boolean;
  callState: CallState;
  onOpenSecurityModal: () => void;
  onStartVoiceCall: () => void;
  onLogout: () => void;
  onBackMobile?: () => void;
  showBackMobile?: boolean;
  onOpenDirectory?: () => void;
  onNewGroup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeRoomName,
  isWsConnected,
  callState,
  onOpenSecurityModal,
  onStartVoiceCall,
  onLogout,
  onBackMobile,
  showBackMobile,
  onOpenDirectory,
  onNewGroup,
}) => {
  return (
    <header className="bg-[#111111] border-b sm:border border-zinc-800 sm:rounded-3xl px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0 shadow-2xl z-20">
      {/* Left side: Back button on mobile or Brand Logo */}
      <div className="flex items-center space-x-2">
        {showBackMobile && onBackMobile && (
          <button
            onClick={onBackMobile}
            className="md:hidden p-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-blue-400 rounded-2xl font-bold text-xs flex items-center space-x-1 min-h-[44px] min-w-[44px] active:scale-95"
            title="Volver a chats"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 shrink-0">
          <Shield className="w-5 h-5 fill-current" />
          <Lock className="w-2.5 h-2.5 text-zinc-950 absolute" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-1.5">
            <h1 className="text-sm sm:text-base font-black tracking-wider text-white truncate">BYG CHAT</h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono font-bold text-[10px]">
              E2EE
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 hidden sm:block truncate">
            Cifrado de extremo a extremo • Llamadas
          </p>
        </div>
      </div>

      {/* Middle status indicator */}
      <div className="hidden lg:flex items-center space-x-2 px-3.5 py-1.5 bg-[#161616] border border-zinc-800 rounded-full">
        <Radio className={`w-3.5 h-3.5 ${isWsConnected ? 'text-green-400 animate-pulse' : 'text-amber-400'}`} />
        <span className="text-xs text-zinc-300 font-medium">
          {isWsConnected ? 'Servidor Cifrado Activo' : 'Conectando...'}
        </span>
      </div>

      {/* Right Controls - Compressed for Mobile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Quick Directory button */}
        {onOpenDirectory && (
          <button
            onClick={onOpenDirectory}
            className="p-2 sm:px-3 sm:py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-200 rounded-2xl text-xs font-semibold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
            title="Buscar usuarios en el directorio"
          >
            <UserCheck className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline ml-1.5">Contactos</span>
          </button>
        )}

        {/* Quick New Group button */}
        {onNewGroup && (
          <button
            onClick={onNewGroup}
            className="p-2 sm:px-3 sm:py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-200 rounded-2xl text-xs font-semibold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
            title="Crear Nuevo Grupo Cifrado"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span className="hidden md:inline ml-1.5">Nuevo Grupo</span>
          </button>
        )}

        {/* Security Vault Button */}
        <button
          onClick={onOpenSecurityModal}
          className="p-2 sm:px-3 sm:py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-200 rounded-2xl text-xs font-semibold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
          title="Ver Bóveda de Claves Criptográficas"
        >
          <Key className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline ml-1.5">Llaves</span>
        </button>

        {/* User profile avatar & Logout */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 pl-1.5 border-l border-zinc-800">
          <Avatar
            src={currentUser.avatar}
            name={currentUser.name}
            size="sm"
            status="online"
            showStatus
          />

          <button
            onClick={onLogout}
            className="p-2 bg-[#1a1a1a] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 rounded-2xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

