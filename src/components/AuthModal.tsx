import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, Check, Smile } from 'lucide-react';
import { User } from '../types';
import { generateXaonId, formatXaonDisplay } from '../utils/xaon';
import { Avatar } from './Avatar';
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  doc,
  setDoc,
  getDoc,
  updateProfile,
} from '../lib/firebase';
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

    setLoading(true);

    try {
      const cleanUsername = username.toLowerCase().trim();
      const email = cleanUsername.includes('@')
        ? cleanUsername
        : `${cleanUsername.replace(/[^a-z0-9_]/g, '_')}@bygchat.app`;
      const avatarValue = customEmojiInput.trim() || selectedEmoji;

      if (isSupabaseConfigured && supabase) {
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

          // Upsert into Supabase users table
          await supabase.from('users').upsert({
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

          // Ensure default general room in Supabase rooms table
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
          return;
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
          return;
        }
      }

      if (mode === 'register') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const fbUser = userCredential.user;

          await updateProfile(fbUser, { displayName: name.trim() });

          const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();
          const fingerprint = `BYG:${hexRandom.slice(0, 4)}:${hexRandom.slice(4)}:2026:SAFE`;
          const xaonId = generateXaonId(fbUser.uid);

          const userData: User = {
            id: fbUser.uid,
            name: name.trim(),
            avatar: avatarValue,
            status: 'online',
            xaonId,
            bio: bio.trim() || 'Usuario verificado de BYG CHAT',
            fingerprint,
          };

          // Store user profile in Firestore
          await setDoc(doc(db, 'users', fbUser.uid), {
            uid: fbUser.uid,
            username: cleanUsername,
            email,
            name: name.trim(),
            avatar: avatarValue,
            bio: bio.trim(),
            status: 'online',
            fingerprint,
            xaonId,
            createdAt: Date.now(),
          });

          // Ensure default general room exists
          await setDoc(
            doc(db, 'rooms', 'room_general'),
            {
              id: 'room_general',
              name: 'Canal General BYG',
              type: 'group',
              participants: [fbUser.uid],
              unreadCount: 0,
              isEncrypted: true,
              fingerprint: '990B:1102:4455:8877:6611:3322',
              avatar: '👥',
              createdAt: Date.now(),
            },
            { merge: true }
          );

          const idToken = await fbUser.getIdToken();
          localStorage.setItem('byg_chat_token', idToken);
          localStorage.setItem('byg_chat_user', JSON.stringify(userData));

          onLoginSuccess(userData, idToken);
        } catch (fbErr: any) {
          if (
            fbErr.code === 'auth/operation-not-allowed' ||
            fbErr.code === 'auth/admin-restricted-operation' ||
            fbErr.code === 'auth/configuration-not-found'
          ) {
            console.warn('Firebase Auth restricted. Executing fallback server authentication...');
            await performServerAuthFallback();
            return;
          }
          throw fbErr;
        }
      } else {
        // Login mode
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const fbUser = userCredential.user;

          // Fetch profile document from Firestore
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);

          let userData: User;
          if (userSnap.exists()) {
            const d = userSnap.data();
            const userXaonId = d.xaonId || generateXaonId(fbUser.uid);
            userData = {
              id: fbUser.uid,
              name: d.name || fbUser.displayName || 'Usuario BYG',
              avatar: d.avatar || '😎',
              status: 'online',
              xaonId: userXaonId,
              bio: d.bio || 'Usuario verificado de BYG CHAT',
              fingerprint: d.fingerprint || 'BYG:SAFE:2026:AUTH',
            };
            if (!d.xaonId) {
              await setDoc(doc(db, 'users', fbUser.uid), { xaonId: userXaonId }, { merge: true });
            }
          } else {
            const userXaonId = generateXaonId(fbUser.uid);
            userData = {
              id: fbUser.uid,
              name: fbUser.displayName || cleanUsername,
              avatar: '😎',
              status: 'online',
              xaonId: userXaonId,
              bio: 'Usuario verificado de BYG CHAT',
              fingerprint: 'BYG:SAFE:2026:AUTH',
            };
            await setDoc(doc(db, 'users', fbUser.uid), {
              uid: fbUser.uid,
              username: cleanUsername,
              email,
              name: userData.name,
              avatar: userData.avatar,
              bio: userData.bio,
              status: 'online',
              fingerprint: userData.fingerprint,
              xaonId: userXaonId,
              createdAt: Date.now(),
            });
          }

          const idToken = await fbUser.getIdToken();
          localStorage.setItem('byg_chat_token', idToken);
          localStorage.setItem('byg_chat_user', JSON.stringify(userData));

          onLoginSuccess(userData, idToken);
        } catch (fbErr: any) {
          if (
            fbErr.code === 'auth/operation-not-allowed' ||
            fbErr.code === 'auth/admin-restricted-operation' ||
            fbErr.code === 'auth/configuration-not-found'
          ) {
            console.warn('Firebase Auth restricted. Executing fallback server authentication...');
            await performServerAuthFallback();
            return;
          }
          throw fbErr;
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Usuario o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('El nombre de usuario ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(err.message || 'Error al autenticar con la base de datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const performServerAuthFallback = async () => {
    const cleanUsername = username.toLowerCase().trim();
    const avatarValue = customEmojiInput.trim() || selectedEmoji;
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'login'
        ? { username: cleanUsername, password }
        : {
            username: cleanUsername,
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
      throw new Error(data.message || 'Error en la autenticación local.');
    }

    try {
      const userXaonId = data.user.xaonId || generateXaonId(data.user.id);
      data.user.xaonId = userXaonId;

      await setDoc(doc(db, 'users', data.user.id), {
        uid: data.user.id,
        username: cleanUsername,
        name: data.user.name,
        avatar: data.user.avatar,
        bio: data.user.bio,
        status: 'online',
        fingerprint: data.user.fingerprint,
        xaonId: userXaonId,
        createdAt: Date.now(),
      });

      await setDoc(
        doc(db, 'rooms', 'room_general'),
        {
          id: 'room_general',
          name: 'Canal General BYG',
          type: 'group',
          participants: [data.user.id],
          unreadCount: 0,
          isEncrypted: true,
          fingerprint: '990B:1102:4455:8877:6611:3322',
          avatar: '👥',
          createdAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore fallback sync warning:', e);
    }

    localStorage.setItem('byg_chat_token', data.token);
    localStorage.setItem('byg_chat_user', JSON.stringify(data.user));

    onLoginSuccess(data.user, data.token);
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
