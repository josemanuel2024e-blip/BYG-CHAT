import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, X, MessageSquare, UserCheck, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, User } from '../types';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';

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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'direct'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const toggleSearch = () => {
    if (isSearchOpen && searchQuery) {
      setSearchQuery('');
    }
    setIsSearchOpen((prev) => !prev);
  };

  const filteredRooms = rooms.filter((room) => {
    const query = searchQuery.toLowerCase().trim().replace(/\s+/g, '');
    const nameMatch = room.name.toLowerCase().includes(query);
    const xaonId = formatXaonDisplay(undefined, room.id).toLowerCase().replace('-', '');
    const xaonMatch = xaonId.includes(query.replace('-', ''));
    const matchesSearch = nameMatch || xaonMatch;

    if (filterType === 'groups') return matchesSearch && room.type === 'group';
    if (filterType === 'direct') return matchesSearch && room.type === 'direct';
    return matchesSearch;
  });

  return (
    <aside className="w-full md:w-80 lg:w-88 bg-[#111111] border-b sm:border border-zinc-800 sm:rounded-3xl flex flex-col h-full shrink-0 overflow-hidden shadow-2xl relative">
      {/* Sidebar Header & Controls */}
      <div className="p-4 space-y-3 border-b border-zinc-800/80">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span>Chats</span>
          </h2>

          <div className="flex items-center space-x-1.5">
            {/* Small top toggle button for Search */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={toggleSearch}
              className={`p-2 rounded-xl transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
                isSearchOpen || searchQuery
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800 text-zinc-300'
              }`}
              title={isSearchOpen ? 'Cerrar búsqueda' : 'Buscar chats por nombre'}
            >
              {isSearchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onOpenDirectory}
              className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl transition-all text-xs font-semibold flex items-center space-x-1 min-h-[36px]"
              title="Buscar contactos"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Contactos</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onNewGroup}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all min-h-[36px] min-w-[36px] flex items-center justify-center shadow-md shadow-blue-600/30"
              title="Nuevo Grupo"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Expandable Search Input with Slide-Down Animation */}
        <AnimatePresence>
          {(isSearchOpen || searchQuery.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -12 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="relative pt-1">
                <Search className="w-4 h-4 text-blue-400 absolute left-3.5 top-4 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar chat por nombre o ID XAON..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#181818] border border-blue-500/40 focus:border-blue-500 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all shadow-inner min-h-[42px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3.5 p-0.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filters with animation */}
        <div className="flex items-center space-x-1.5 pt-0.5">
          {(['all', 'direct', 'groups'] as const).map((type) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.96 }}
              onClick={() => setFilterType(type)}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all min-h-[36px] relative ${
                filterType === type
                  ? 'bg-[#222222] text-blue-400 border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {type === 'all' && 'Todos'}
              {type === 'direct' && 'Directos'}
              {type === 'groups' && 'Grupos'}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Room list with staggered entry animations */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {filteredRooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 text-center text-zinc-500 text-xs space-y-3"
            >
              <p>No se encontraron chats que coincidan con la búsqueda.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-700 transition-colors"
                >
                  Limpiar búsqueda
                </button>
              )}
            </motion.div>
          ) : (
            filteredRooms.map((room, index) => {
              const isActive = room.id === activeRoomId;

              return (
                <motion.div
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
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
                      <p className="truncate text-[11px] text-zinc-400 max-w-[160px]">
                        {room.lastMessage ? room.lastMessage.text : 'Sin mensajes aún'}
                      </p>

                      {room.unreadCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-600 text-white font-extrabold rounded-full text-[10px] shrink-0">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button (FAB) for mobile */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onOpenDirectory}
        className="md:hidden fixed bottom-6 right-6 z-30 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl shadow-blue-600/50 flex items-center justify-center transition-transform border border-blue-400/30 min-h-[56px] min-w-[56px]"
        title="Abrir Contactos"
      >
        <UserCheck className="w-6 h-6 text-white" />
      </motion.button>
    </aside>
  );
};
