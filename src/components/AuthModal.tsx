import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, Check, Smile } from 'lucide-react';
import { User } from '../types';
import { Avatar } from './Avatar';

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

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const avatarValue = customEmojiInput.trim() || selectedEmoji;

      const body =
        mode === 'login'
          ? { username: username.toLowerCase().trim(), password }
          : {
              username: username.toLowerCase().trim(),
              password,
              name: name.trim(),
              bio: bio.trim(),
              avatar: avatarValue,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error en la autenticación');
      }

      // Save credentials in local storage
      localStorage.setItem('byg_chat_token', data.token);
      localStorage.setItem('byg_chat_user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
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
            Sistema de cuentas y mensajería cifrada de extremo a extremo
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
