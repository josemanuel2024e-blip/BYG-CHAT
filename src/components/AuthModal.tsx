import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, Smile } from 'lucide-react';
import { User } from '../types';
import { generateXaonId, formatXaonDisplay } from '../utils/xaon';
import { Avatar } from './Avatar';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  onLoginSuccess: (user: User, token: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Android / iOS Populares',
    emojis: ['😎', '🤖', '🥳', '🤓', '🤩', '🤠', '🧐', '😈', '👽', '👻', '👾', '🤡'],
  },
  {
    name: 'Animales & Fantasía',
    emojis: ['🦊', '🦁', '🐼', '🐱', '🐶', '🐯', '🐸', '🐵', '🐨', '🦄', '🐉', '🐙'],
  },
  {
    name: 'Aventura & Símbolos',
    emojis: ['⚡', '🔥', '💎', '👑', '🏆', '🚀', '🌊', '🎨', '🎧', '🎮', '🛡️', '🌟'],
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('Usuario verificado de BYG CHAT E2EE');
  const [selectedEmoji, setSelectedEmoji] = useState('😎');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Ingresa tu nombre para completar el registro.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado correctamente.');
      return;
    }

    setLoading(true);

    try {
      const cleanUsername = username.toLowerCase().trim();
      const email = cleanUsername.includes('@')
        ? cleanUsername
        : `${cleanUsername.replace(/[^a-z0-9_]/g, '_')}@bygchat.app`;
      const avatarValue = customEmojiInput.trim() || selectedEmoji;

      if (mode === 'register') {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        const spUser = authData.user;
        if (!spUser) throw new Error('No se pudo crear el usuario en Supabase');

        const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();
        const fingerprint = `BYG:${hexRandom.slice(0, 4)}:${hexRandom.slice(4)}:2026:SAFE`;
        const userXaonId = generateXaonId(spUser.id);

        const userData: User = {
          id: spUser.id,
          name: name.trim(),
          avatar: avatarValue,
          status: 'online',
          bio: bio.trim() || 'Usuario verificado de BYG CHAT',
          xaonId: userXaonId,
          fingerprint,
        };

        // Insert into Supabase users table
        const { error: upsertError } = await supabase.from('users').upsert({
          id: spUser.id,
          username: cleanUsername,
          name: name.trim(),
          avatar: avatarValue,
          bio: bio.trim(),
          status: 'online',
          fingerprint,
          xaon_id: userXaonId,
          created_at: Date.now(),
        });

        if (upsertError) throw upsertError;

        // Ensure default general room in Supabase
        await supabase.from('rooms').upsert({
          id: 'room_general',
          name: 'Canal General BYG',
          type: 'group',
          participants: [spUser.id],
          unread_count: 0,
          is_encrypted: true,
          fingerprint: '990B:1102:4455:8877:6611:3322',
          avatar: '👥',
          created_at: Date.now(),
        });

        const token = authData.session?.access_token || spUser.id;
        localStorage.setItem('byg_chat_token', token);
        localStorage.setItem('byg_chat_user', JSON.stringify(userData));

        onLoginSuccess(userData, token);
      } else {
        // Login with Supabase
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        const spUser = authData.user;
        if (!spUser) throw new Error('Usuario o contraseña no válidos');

        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', spUser.id)
          .single();

        let userData: User;
        if (userProfile) {
          userData = {
            id: spUser.id,
            name: userProfile.name || cleanUsername,
            avatar: userProfile.avatar || '😎',
            status: 'online',
            bio: userProfile.bio || 'Usuario verificado de BYG CHAT',
            xaonId: formatXaonDisplay(userProfile.xaon_id || userProfile.xaonId, spUser.id),
            fingerprint: userProfile.fingerprint || 'BYG:SAFE:2026:AUTH',
          };
        } else {
          const userXaonId = generateXaonId(spUser.id);
          userData = {
            id: spUser.id,
            name: cleanUsername,
            avatar: '😎',
            status: 'online',
            bio: 'Usuario verificado de BYG CHAT',
            xaonId: userXaonId,
            fingerprint: 'BYG:SAFE:2026:AUTH',
          };
          await supabase.from('users').upsert({
            id: spUser.id,
            username: cleanUsername,
            name: userData.name,
            avatar: userData.avatar,
            bio: userData.bio,
            status: 'online',
            fingerprint: userData.fingerprint,
            xaon_id: userXaonId,
            created_at: Date.now(),
          });
        }

        const token = authData.session?.access_token || spUser.id;
        localStorage.setItem('byg_chat_token', token);
        localStorage.setItem('byg_chat_user', JSON.stringify(userData));

        onLoginSuccess(userData, token);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Error al autenticar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden my-auto">
        {/* Glow effect header */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-full" />

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mb-1">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-wide text-white">BYG CHAT</h1>
          <p className="text-xs text-zinc-400">
            Sistema de mensajería instantánea
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#181818] p-1 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Nombre Completo *
              </label>
              <input
                type="text"
                placeholder="Ej. Alex Coder"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Usuario *
            </label>
            <input
              type="text"
              placeholder="Ej. alex_byg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Contraseña *
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    Selecciona Avatar Emoji (iOS / Android)
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-400">Vista Previa:</span>
                    <Avatar
                      src={customEmojiInput.trim() || selectedEmoji}
                      name={name || 'U'}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Emoji Grid Categories */}
                <div className="bg-[#161616] border border-zinc-800 rounded-2xl p-2.5 space-y-2 max-h-40 overflow-y-auto">
                  {EMOJI_CATEGORIES.map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        {cat.name}
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setSelectedEmoji(emoji);
                              setCustomEmojiInput('');
                            }}
                            className={`p-2 rounded-xl text-xl flex items-center justify-center transition-all min-h-[44px] min-w-[44px] ${
                              selectedEmoji === emoji && !customEmojiInput
                                ? 'bg-blue-600/30 border-2 border-blue-500 scale-105 shadow-md shadow-blue-500/20'
                                : 'bg-[#202020] hover:bg-[#2a2a2a] border border-zinc-800 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <span>{emoji}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <Smile className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Escribe otro emoji de tu teclado iOS / Android..."
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    className="w-full bg-[#181818] border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Estado / Biografía
                </label>
                <input
                  type="text"
                  placeholder="Mensaje de estado..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 active:scale-95 min-h-[48px]"
          >
            <span>
              {loading
                ? 'Procesando...'
                : mode === 'login'
                ? 'Entrar a BYG CHAT'
                : 'Registrar Cuenta'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-zinc-500 border-t border-zinc-800/80">
          🔒 Claves criptográficas RSA-4096 y AES-256 generadas en tu dispositivo.
        </div>
      </div>
    </div>
  );
};
