import React, { useState, useEffect } from 'react';
import { UserCheck, Search, MessageSquare, X, Shield, Lock, Circle } from 'lucide-react';
import { User, Room } from '../types';
import { Avatar } from './Avatar';

interface UserDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectUser: (targetUser: User) => void;
}

export const UserDirectoryModal: React.FC<UserDirectoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/users')
        .then((res) => res.json())
        .then((data: User[]) => {
          // Filter out self
          setUsers(data.filter((u) => u.id !== currentUser.id));
        })
        .catch((err) => console.error('Error fetching users:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-lg">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <span>Directorio de Usuarios BYG</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-[#222222] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o usuario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181818] border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
          />
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <p className="text-center text-xs text-zinc-500 py-8">Cargando directorio de usuarios...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 space-y-2">
              <p className="text-sm font-semibold">No se encontraron usuarios</p>
              <p className="text-xs">Invita a otros usuarios a registrarse en BYG CHAT.</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onClose();
                }}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#161616] hover:bg-[#202020] border border-zinc-800/80 cursor-pointer transition-all active:scale-[0.98] min-h-[56px]"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Avatar
                    src={user.avatar}
                    name={user.name}
                    size="sm"
                    status={user.status}
                    showStatus
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.name}</p>
                    <p className="text-xs text-zinc-400 truncate">@{user.id}</p>
                  </div>
                </div>

                <button className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-semibold shrink-0 flex items-center space-x-1 min-h-[36px]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chatear</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center space-x-1.5 justify-center">
          <Lock className="w-3 h-3 text-blue-400 shrink-0" />
          <span>Las conversaciones directas son cifradas con AES-256-GCM.</span>
        </div>
      </div>
    </div>
  );
};
