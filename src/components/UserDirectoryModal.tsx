import React, { useState, useEffect } from 'react';
import { UserCheck, Search, MessageSquare, X, Hash, Phone } from 'lucide-react';
import { User } from '../types';
import { Avatar } from './Avatar';
import { db, collection, getDocs } from '../lib/firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatXaonDisplay, generateXaonId } from '../utils/xaon';

interface UserDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectUser: (targetUser: User) => void;
  onViewUserProfile?: (user: User) => void;
}

export const UserDirectoryModal: React.FC<UserDirectoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  onViewUserProfile,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadUsers = async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.from('users').select('*');
          if (error) throw error;
          const fetchedUsers: User[] = (data || []).map((u) => ({
            id: u.id,
            name: u.name || u.username || 'Usuario BYG',
            avatar: u.avatar || '😎',
            status: u.status || 'online',
            bio: u.bio || '',
            xaonId: u.xaonId || formatXaonDisplay(u.xaon_id, u.id),
            fingerprint: u.fingerprint || 'BYG:SAFE:2026:USER',
          }));
          setUsers(fetchedUsers.filter((u) => u.id !== currentUser.id));
          return;
        }

        const snapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers: User[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const uid = data.uid || docSnap.id;
          return {
            id: uid,
            name: data.name || data.username || 'Usuario BYG',
            avatar: data.avatar || '😎',
            status: data.status || 'online',
            bio: data.bio || '',
            xaonId: formatXaonDisplay(data.xaonId, uid),
            fingerprint: data.fingerprint || 'BYG:SAFE:2026:USER',
          };
        });
        setUsers(fetchedUsers.filter((u) => u.id !== currentUser.id));
      } catch (err) {
        console.error('Error fetching users:', err);
        try {
          const res = await fetch('/api/users');
          const data = await res.json();
          if (Array.isArray(data)) {
            setUsers(
              data
                .filter((u: User) => u.id !== currentUser.id)
                .map((u: User) => ({ ...u, xaonId: formatXaonDisplay(u.xaonId, u.id) }))
            );
          }
        } catch (e) {
          console.error('API fallback error:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const query = searchQuery.toLowerCase().trim().replace(/\s+/g, '');

  const filteredUsers = users.filter((u) => {
    const nameMatch = u.name.toLowerCase().includes(query);
    const idMatch = u.id.toLowerCase().includes(query);
    const xaonMatch = (u.xaonId || generateXaonId(u.id))
      .toLowerCase()
      .replace('-', '')
      .includes(query.replace('-', ''));
    return nameMatch || idMatch || xaonMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-lg">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <span>Directorio y Búsqueda XAON</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-[#222222] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-300 flex items-center space-x-2">
          <Phone className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Busca usuarios directamente por su <strong>ID XAON</strong> (ej: YE32-GT24) o por su nombre.
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID XAON (ej: YE32-GT24) o nombre..."
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
              <p className="text-xs">Verifica el código XAON e intenta nuevamente.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const userXaon = formatXaonDisplay(user.xaonId, user.id);

              return (
                <div
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#161616] hover:bg-[#202020] border border-zinc-800/80 cursor-pointer transition-all active:scale-[0.98] min-h-[60px]"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar
                      src={user.avatar}
                      name={user.name}
                      size="sm"
                      status={user.status}
                      showStatus
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-bold text-white truncate">{user.name}</p>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-zinc-400 truncate">@{user.id}</span>
                        <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-md inline-flex items-center space-x-0.5">
                          <Hash className="w-2.5 h-2.5" />
                          <span>{userXaon}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {onViewUserProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewUserProfile(user);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold shrink-0 min-h-[36px]"
                        title="Ver perfil"
                      >
                        Perfil
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onSelectUser(user);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-semibold shrink-0 flex items-center space-x-1 min-h-[36px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chatear</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500 text-center flex items-center justify-center space-x-1">
          <Hash className="w-3 h-3 text-blue-400" />
          <span>Los identificadores XAON son automáticos, únicos e inmodificables.</span>
        </div>
      </div>
    </div>
  );
};
