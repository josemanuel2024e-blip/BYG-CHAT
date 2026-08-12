import React, { useState } from 'react';
import { Search, Plus, Lock, Users, MessageSquare, ShieldAlert, UserCheck } from 'lucide-react';
import { Room, User } from '../types';
import { Avatar } from './Avatar';

interface SidebarProps {
  rooms: Room[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onNewGroup: () => void;
  onOpenDirectory: () => void;
  onlineUsers: User[];
  userFingerprint: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onNewGroup,
  onOpenDirectory,
  userFingerprint,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'direct'>('all');

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterType === 'groups') return matchesSearch && room.type === 'group';
    if (filterType === 'direct') return matchesSearch && room.type === 'direct';
    return matchesSearch;
  });

  return (
    <aside className="w-full md:w-80 lg:w-88 bg-[#111111] border-b sm:border border-zinc-800 sm:rounded-3xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl relative">
      {/* Sidebar Header & Controls */}
      <div className="p-4 space-y-3.5 border-b border-zinc-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span>Chats Cifrados</span>
          </h2>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenDirectory}
              className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl transition-all text-xs font-semibold flex items-center space-x-1 min-h-[36px]"
              title="Buscar usuarios registrados"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Contactos</span>
            </button>

            <button
              onClick={onNewGroup}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all min-h-[36px] min-w-[36px] flex items-center justify-center shadow-md shadow-blue-600/30"
              title="Crear Nuevo Grupo Cifrado"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar chats o mensajes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181818] border border-zinc-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors min-h-[44px]"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center space-x-1.5 pt-0.5">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all min-h-[38px] ${
              filterType === 'all'
                ? 'bg-[#222222] text-blue-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('direct')}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all min-h-[38px] ${
              filterType === 'direct'
                ? 'bg-[#222222] text-blue-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Directos
          </button>
          <button
            onClick={() => setFilterType('groups')}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all min-h-[38px] ${
              filterType === 'groups'
                ? 'bg-[#222222] text-blue-400 border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Grupos
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredRooms.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs space-y-3">
            <p>No hay conversaciones con ese filtro.</p>
            <button
              onClick={onOpenDirectory}
              className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl font-bold border border-blue-500/30 text-xs"
            >
              Explorar Directorio de Usuarios
            </button>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className={`p-3 rounded-2xl flex items-center space-x-3 cursor-pointer transition-all active:scale-[0.98] min-h-[64px] ${
                  isActive
                    ? 'bg-[#1d1d1d] border border-blue-500/40 text-white shadow-md'
                    : 'hover:bg-[#161616] border border-transparent'
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={room.avatar || (room.type === 'group' ? '👥' : '💬')}
                  name={room.name}
                  size="md"
                  status="online"
                  showStatus
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-white truncate max-w-[140px]">
                      {room.name}
                    </h3>
                    <span className="text-[10px] text-zinc-500 shrink-0">
                      {room.lastMessage
                        ? new Date(room.lastMessage.timestamp).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Ahora'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <p className="truncate text-[11px] text-zinc-400 max-w-[160px] flex items-center">
                      <Lock className="w-3 h-3 text-blue-400 shrink-0 inline mr-1" />
                      <span>
                        {room.lastMessage
                          ? room.lastMessage.text
                          : '🔒 Canal cifrado E2EE'}
                      </span>
                    </p>

                    {room.unreadCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white font-extrabold rounded-full text-[10px] shrink-0">
                        {room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (FAB) for mobile - WhatsApp Style */}
      <button
        onClick={onOpenDirectory}
        className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl shadow-blue-600/50 flex items-center justify-center transition-transform active:scale-90 border border-blue-400/30 min-h-[56px] min-w-[56px]"
        title="Abrir Directorio de Contactos"
      >
        <UserCheck className="w-6 h-6 text-white" />
      </button>

      {/* Security footer bar */}
      <div className="p-3 bg-[#151515] border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center space-x-1.5 truncate">
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-mono text-[10px] text-zinc-300 truncate">
            Huella: {userFingerprint ? userFingerprint.slice(0, 14) : 'GENERANDO'}...
          </span>
        </div>

        <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[9px] rounded-full shrink-0">
          AES-256
        </span>
      </div>
    </aside>
  );
};
