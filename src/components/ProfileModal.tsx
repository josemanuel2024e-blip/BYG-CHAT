import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Check,
  Copy,
  Hash,
  Shield,
  Phone,
  MessageSquare,
  Edit2,
  Sparkles,
  Camera,
  Activity,
  Calendar,
  Key,
  Info
} from 'lucide-react';
import { User, UserStatus } from '../types';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  targetUser?: User | null; // If provided, view this user's profile. Otherwise view/edit currentUser.
  onUpdateProfile?: (updatedData: { name: string; avatar: string; bio: string; status: UserStatus }) => Promise<void> | void;
  onStartChatWithUser?: (user: User) => void;
  onStartCallWithUser?: (user: User) => void;
}

const AVATAR_EMOJIS = ['😎', '🚀', '💻', '🛡️', '🦊', '🤖', '🐱', '🦁', '⚡', '👑', '🎯', '👾', '🎨', '🎧', '🎮', '🔥'];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  onUpdateProfile,
  onStartChatWithUser,
  onStartCallWithUser,
}) => {
  const isEditingSelf = !targetUser || targetUser.id === currentUser.id;
  const user = isEditingSelf ? currentUser : targetUser;

  // Form states for self edit
  const [name, setName] = useState(user.name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '😎');
  const [status, setStatus] = useState<UserStatus>(user.status || 'online');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedXaon, setCopiedXaon] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !user) return null;

  const xaonCode = formatXaonDisplay(user.xaonId, user.id);

  const handleCopyXaon = () => {
    navigator.clipboard.writeText(xaonCode);
    setCopiedXaon(true);
    setTimeout(() => setCopiedXaon(false), 2000);
  };

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(user.fingerprint);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateProfile) return;

    setIsSaving(true);
    try {
      const finalAvatar = customAvatarUrl.trim() || avatar;
      await onUpdateProfile({
        name: name.trim() || user.name,
        avatar: finalAvatar,
        bio: bio.trim(),
        status,
      });
      setSavedSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="bg-[#121212] border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl my-8 relative">
        {/* Cover / Header Banner */}
        <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative flex items-start justify-between p-4">
          <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Perfil de Usuario</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar Section */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative group">
              <div className="ring-4 ring-[#121212] rounded-full overflow-hidden bg-[#181818]">
                <Avatar
                  src={isEditing ? (customAvatarUrl || avatar) : user.avatar}
                  name={isEditing ? name : user.name}
                  size="xl"
                  status={isEditing ? status : user.status}
                  showStatus
                />
              </div>

              {isEditingSelf && isEditing && (
                <button
                  onClick={() => setShowCustomAvatarInput((p) => !p)}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg border border-black/50 transition-transform active:scale-95"
                  title="Cambiar imagen"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action buttons top right */}
            <div className="flex items-center space-x-2">
              {isEditingSelf ? (
                !isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 active:scale-95"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Perfil</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                )
              ) : (
                <div className="flex items-center space-x-2">
                  {onStartChatWithUser && (
                    <button
                      onClick={() => {
                        onStartChatWithUser(user);
                        onClose();
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all flex items-center space-x-1 shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Mensaje</span>
                    </button>
                  )}
                  {onStartCallWithUser && (
                    <button
                      onClick={() => {
                        onStartCallWithUser(user);
                        onClose();
                      }}
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all active:scale-95"
                      title="Llamar por voz"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Success banner if updated */}
          {savedSuccess && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>¡Perfil actualizado con éxito!</span>
            </div>
          )}

          {/* EDIT FORM or DISPLAY VIEW */}
          {isEditingSelf && isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Custom Image URL Drawer */}
              {showCustomAvatarInput && (
                <div className="p-3 bg-[#181818] border border-zinc-800 rounded-2xl space-y-2 animate-fade-in">
                  <label className="text-[11px] font-bold text-zinc-400 block">
                    URL de Imagen Personalizada
                  </label>
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/mi-foto.jpg"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-zinc-500">Pega un enlace directo a tu fotografía o imagen de perfil.</p>
                </div>
              )}

              {/* Avatar Preset Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                  Elige tu Avatar o Emoji
                </label>
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
                  {AVATAR_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        setAvatar(e);
                        setCustomAvatarUrl('');
                      }}
                      className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        avatar === e && !customAvatarUrl
                          ? 'bg-blue-600 scale-110 shadow-lg shadow-blue-600/30'
                          : 'bg-[#1a1a1a] hover:bg-[#252525] border border-zinc-800'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                  {PRESET_AVATARS.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt="Avatar preset"
                      onClick={() => {
                        setCustomAvatarUrl(url);
                      }}
                      className={`w-9 h-9 rounded-xl object-cover cursor-pointer shrink-0 border-2 transition-all ${
                        customAvatarUrl === url ? 'border-blue-500 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Nombre Visible
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre de usuario"
                  className="w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-[42px]"
                />
              </div>

              {/* Bio Field */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Biografía / Estado
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuéntale un poco a tus contactos sobre ti..."
                  className="w-full bg-[#181818] border border-zinc-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Status Radio options */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                  Estado de Presencia
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['online', 'busy', 'offline'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center space-x-1.5 transition-all ${
                        status === st
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-[#181818] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          st === 'online' ? 'bg-emerald-500' : st === 'busy' ? 'bg-amber-500' : 'bg-zinc-500'
                        }`}
                      />
                      <span className="capitalize">
                        {st === 'online' ? 'En Línea' : st === 'busy' ? 'Ocupado' : 'Invisible'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save submit button */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 min-h-[44px]"
              >
                {isSaving ? (
                  <span>Guardando cambios...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* VIEW MODE */
            <div className="space-y-4">
              {/* User Name & Handle */}
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-white">{user.name}</h2>
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 uppercase">
                    {user.status === 'online' ? 'En línea' : user.status === 'busy' ? 'Ocupado' : 'Desconectado'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono">@{user.id}</p>
              </div>

              {/* XAON ID Card (Fixed & Unique) */}
              <div className="p-4 bg-[#181818] border border-blue-500/30 rounded-2xl space-y-2 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-blue-600/20 rounded-lg text-blue-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">ID XAON Único</span>
                      <span className="text-[10px] text-zinc-400">Identificador personal e inmutable</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyXaon}
                    className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all active:scale-95"
                    title="Copiar ID XAON"
                  >
                    {copiedXaon ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedXaon ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-lg font-mono font-black text-blue-400 tracking-wider">
                    {xaonCode}
                  </span>
                  <span className="text-[10px] text-zinc-500 flex items-center space-x-1">
                    <Info className="w-3 h-3 text-blue-400" />
                    <span>Inmodificable</span>
                  </span>
                </div>
              </div>

              {/* Bio Section */}
              <div className="p-4 bg-[#181818] border border-zinc-800/80 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">
                  Biografía
                </span>
                <p className="text-xs text-zinc-200 leading-relaxed">
                  {user.bio || 'Este usuario no ha agregado una biografía aún.'}
                </p>
              </div>

              {/* Security Fingerprint info */}
              <div className="p-4 bg-[#181818] border border-zinc-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    <span>Huella Digital de Seguridad</span>
                  </span>
                  <button
                    onClick={handleCopyFingerprint}
                    className="text-[10px] text-blue-400 hover:underline flex items-center space-x-1"
                  >
                    {copiedFingerprint ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedFingerprint ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] font-mono text-zinc-400 break-all bg-[#0e0e0e] p-2 rounded-xl border border-zinc-800/60">
                  {user.fingerprint}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
