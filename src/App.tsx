import React, { useState, useEffect, useRef } from 'react';
import { User, Room, Message, CallState, KeyVaultInfo, Attachment, UserStatus } from './types';
import { getUserKeyVault, encryptText, decryptText, encryptFile } from './utils/crypto';
import { formatXaonDisplay } from './utils/xaon';
import { soundFx } from './utils/audioEffects';
import { saveMessageLocally, getMessagesLocally, deleteMessageLocally } from './utils/localDb';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CallModal } from './components/CallModal';
import { SecurityModal } from './components/SecurityModal';
import { MediaViewer } from './components/MediaViewer';
import { NewGroupModal } from './components/NewGroupModal';
import { AuthModal } from './components/AuthModal';
import { UserDirectoryModal } from './components/UserDirectoryModal';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { LockScreen } from './components/LockScreen';
import { motion, AnimatePresence } from 'motion/react';
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from './lib/firebase';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<KeyVaultInfo | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [roomMessagesMap, setRoomMessagesMap] = useState<Record<string, Message[]>>({});
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({}); // roomId -> list of user names

  // WebRTC Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // User Settings State
  const [userSettings, setUserSettings] = useState<any>(() => {
    const saved = localStorage.getItem('byg_chat_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'dark',
      accentColor: '#3b82f6', // Default blue
      fontSize: 'medium',
      notificationsEnabled: true,
      soundEnabled: true,
      appPin: '1234'
    };
  });

  useEffect(() => {
    localStorage.setItem('byg_chat_settings', JSON.stringify(userSettings));
  }, [userSettings]);

  // Modals state
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState<boolean>(false);
  const [showUserDirectory, setShowUserDirectory] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [profileTargetUser, setProfileTargetUser] = useState<User | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  const initialMsgsLoadedRef = useRef<Record<string, boolean>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Call state
  const [callState, setCallState] = useState<CallState>({
    active: false,
    callId: null,
    peerId: null,
    peerName: '',
    peerAvatar: '',
    status: 'idle',
    isMuted: false,
    isSpeaker: true,
    startTime: null,
    audioLevel: 0,
    isVoiceOnly: true,
    signalQuality: 'none',
  });

  // Monochrome mode state & keyboard shortcut (Shift + Q + Z)
  const [isMonochrome, setIsMonochrome] = useState<boolean>(() => {
    return localStorage.getItem('byg_chat_monochrome') === 'true';
  });
  const [showMonoToast, setShowMonoToast] = useState<boolean>(false);

  // Lock Screen Logic
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    return localStorage.getItem('byg_chat_locked') === 'true';
  });
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentUser || isAppLocked) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - lastActivityRef.current;
      if (diff >= 5 * 60 * 1000) { // 5 minutes of inactivity
        setIsAppLocked(true);
        localStorage.setItem('byg_chat_locked', 'true');
        soundFx.playCallEnd(); // Subtle sound cue for lock
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [isAppLocked, currentUser]);

  const handleUnlock = () => {
    setIsAppLocked(false);
    localStorage.setItem('byg_chat_locked', 'false');
    lastActivityRef.current = Date.now();
  };
  const activeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      activeKeysRef.current.add(e.code.toLowerCase());
      activeKeysRef.current.add(e.key.toLowerCase());

      const keys = activeKeysRef.current;
      const hasQ = keys.has('keyq') || keys.has('q');
      const hasZ = keys.has('keyz') || keys.has('z');

      if (e.shiftKey && hasQ && hasZ) {
        setIsMonochrome((prev) => {
          const next = !prev;
          localStorage.setItem('byg_chat_monochrome', String(next));
          return next;
        });
        setShowMonoToast(true);
        setTimeout(() => setShowMonoToast(false), 2500);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeysRef.current.delete(e.code.toLowerCase());
      activeKeysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 1. Check Firebase Auth session or localStorage session on startup
  useEffect(() => {
    // Solicitar permiso para notificaciones web
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setToken(idToken);

          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const d = userSnap.data();
            const u: User = {
              id: fbUser.uid,
              name: d.name || fbUser.displayName || 'Usuario BYG',
              avatar: d.avatar || '😎',
              status: 'online',
              bio: d.bio || 'Usuario verificado de BYG CHAT',
              xaonId: formatXaonDisplay(d.xaonId, fbUser.uid),
              fingerprint: d.fingerprint || 'BYG:SAFE:2026:AUTH',
            };
            setCurrentUser(u);
            localStorage.setItem('byg_chat_user', JSON.stringify(u));
            localStorage.setItem('byg_chat_token', idToken);
          } else {
            const u: User = {
              id: fbUser.uid,
              name: fbUser.displayName || 'Usuario BYG',
              avatar: '😎',
              status: 'online',
              bio: 'Usuario verificado de BYG CHAT',
              xaonId: formatXaonDisplay(undefined, fbUser.uid),
              fingerprint: 'BYG:SAFE:2026:AUTH',
            };
            setCurrentUser(u);
          }
        } catch (e) {
          console.error('Error restoring session:', e);
        }
      } else {
        const savedToken = localStorage.getItem('byg_chat_token');
        const savedUserRaw = localStorage.getItem('byg_chat_user');
        if (savedToken && savedUserRaw) {
          try {
            const parsedUser = JSON.parse(savedUserRaw);
            parsedUser.xaonId = formatXaonDisplay(parsedUser.xaonId, parsedUser.id);
            setToken(savedToken);
            setCurrentUser(parsedUser);
            return;
          } catch (e) {
            localStorage.removeItem('byg_chat_token');
            localStorage.removeItem('byg_chat_user');
          }
        }
        setCurrentUser(null);
        setToken(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Load E2EE Key Vault when logged in
  useEffect(() => {
    if (currentUser) {
      getUserKeyVault().then((vault) => {
        setVaultInfo(vault);
        setCurrentUser((prev) => (prev ? { ...prev, fingerprint: vault.fingerprint } : null));
      });
    }
  }, [currentUser?.id]);

  // 3. Real-time Rooms sync for logged in user (Supabase or Firestore)
  useEffect(() => {
    if (!currentUser) return;

    if (isSupabaseConfigured && supabase) {
      const fetchSupabaseRooms = async () => {
        const { data, error } = await supabase.from('rooms').select('*');
        if (!error && data) {
          const fetchedRooms: Room[] = data.map((r) => ({
            id: r.id,
            name: r.name || 'Canal Cifrado',
            type: r.type || 'group',
            participants: r.participants || [],
            unreadCount: r.unread_count || 0,
            isEncrypted: r.is_encrypted ?? true,
            fingerprint: r.fingerprint || 'BYG:E2EE:SAFE',
            avatar: r.avatar || '💬',
          }));
          const userRooms = fetchedRooms.filter(
            (r) => r.participants.includes(currentUser.id) || r.type === 'group'
          );
          setRooms(userRooms);
          if (userRooms.length > 0 && !activeRoomId && window.innerWidth >= 768) {
            setActiveRoomId(userRooms[0].id);
          }
        }
      };

      fetchSupabaseRooms();

      const channel = supabase
        .channel('public:rooms')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          () => {
            fetchSupabaseRooms();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Listen to all rooms where user is participant or type is group (Firestore)
    const roomsCol = collection(db, 'rooms');
    const unsubscribe = onSnapshot(roomsCol, (snapshot) => {
      const fetchedRooms: Room[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          name: data.name || 'Canal Cifrado',
          type: data.type || 'group',
          participants: data.participants || [],
          unreadCount: data.unreadCount || 0,
          isEncrypted: data.isEncrypted ?? true,
          fingerprint: data.fingerprint || 'BYG:E2EE:SAFE',
          avatar: data.avatar || '💬',
        };
      });

      const userRooms = fetchedRooms.filter(
        (r) => r.participants.includes(currentUser.id) || r.type === 'group'
      );

      setRooms(userRooms);
      if (userRooms.length > 0 && !activeRoomId) {
        if (window.innerWidth >= 768) {
          setActiveRoomId(userRooms[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // 4. Real-time Messages sync for activeRoomId (Supabase or Firestore)
  useEffect(() => {
    if (!currentUser || !activeRoomId) return;

    if (isSupabaseConfigured && supabase) {
      const fetchSupabaseMessages = async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', activeRoomId);

        if (!error && data) {
          const msgPromises = data.map(async (item) => {
            let decryptedText = item.text || '';
            if (item.encrypted_payload && item.encrypted_payload.ciphertext) {
              try {
                decryptedText = await decryptText(item.encrypted_payload, activeRoomId);
              } catch (e) {
                console.error('Decryption failed for msg:', item.id);
              }
            }

            const msg: Message = {
              id: item.id,
              senderId: item.sender_id,
              receiverId: item.room_id || activeRoomId,
              text: decryptedText,
              encryptedPayload: item.encrypted_payload,
              timestamp: Number(item.timestamp) || Date.now(),
              status: item.status || 'sent',
              attachment: item.attachment,
              isVoiceNote: item.is_voice_note,
              audioDuration: item.audio_duration,
            };
            return msg;
          });

          const processedMsgs = await Promise.all(msgPromises);
          processedMsgs.sort((a, b) => a.timestamp - b.timestamp);

          setRoomMessagesMap((prev) => ({
            ...prev,
            [activeRoomId]: processedMsgs,
          }));

          if (processedMsgs.length > 0) {
            const lastMsg = processedMsgs[processedMsgs.length - 1];
            setRooms((prevRooms) =>
              prevRooms.map((r) =>
                r.id === activeRoomId ? { ...r, lastMessage: lastMsg } : r
              )
            );
          }
        }
      };

      fetchSupabaseMessages();

      const channel = supabase
        .channel(`public:messages:${activeRoomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${activeRoomId}`,
          },
          () => {
            fetchSupabaseMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const messagesCol = collection(db, 'messages');
    const q = query(messagesCol, where('roomId', '==', activeRoomId));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgPromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let decryptedText = data.text || '';

        if (data.encryptedPayload && data.encryptedPayload.ciphertext) {
          try {
            decryptedText = await decryptText(data.encryptedPayload, activeRoomId);
          } catch (e) {
            console.error('Decryption failed for msg:', docSnap.id);
          }
        }

        const msg: Message = {
          id: data.id || docSnap.id,
          senderId: data.senderId,
          receiverId: data.roomId || activeRoomId,
          text: decryptedText,
          encryptedPayload: data.encryptedPayload,
          timestamp: data.timestamp || Date.now(),
          status: data.status || 'sent',
          attachment: data.attachment,
          isVoiceNote: data.isVoiceNote,
          audioDuration: data.audioDuration,
        };
        return msg;
      });

      const processedMsgs = await Promise.all(msgPromises);
      processedMsgs.sort((a, b) => a.timestamp - b.timestamp);

      // Play receive sound for new incoming messages
      if (initialMsgsLoadedRef.current[activeRoomId] && processedMsgs.length > 0) {
        const lastMsg = processedMsgs[processedMsgs.length - 1];
        if (lastMsg.senderId !== currentUser.id) {
          soundFx.playMessageReceive();

          // Mostrar notificación si la pestaña no está visible
          if (document.hidden && Notification.permission === 'granted') {
            const room = rooms.find(r => r.id === activeRoomId);
            new Notification('BYG CHAT', {
              body: `Nuevo mensaje en ${room?.name || 'el chat'}`,
              icon: '/svg/logo.svg',
            });
          }
        }
      }
      initialMsgsLoadedRef.current[activeRoomId] = true;

      // Save all fetched messages to local DB for offline access
      processedMsgs.forEach(msg => saveMessageLocally({ ...msg, roomId: activeRoomId }));

      setRoomMessagesMap((prev) => ({
        ...prev,
        [activeRoomId]: processedMsgs,
      }));

      // Update last message in room list
      if (processedMsgs.length > 0) {
        const lastMsg = processedMsgs[processedMsgs.length - 1];
        setRooms((prevRooms) =>
          prevRooms.map((r) =>
            r.id === activeRoomId ? { ...r, lastMessage: lastMsg } : r
          )
        );

        // Mark as read if user is in the room and there are new messages
        if (lastMsg.senderId !== currentUser.id) {
          handleMarkAsRead(activeRoomId);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id, activeRoomId]);

  // Handle Mark as Read on Room Entry
  useEffect(() => {
    if (activeRoomId && currentUser) {
      handleMarkAsRead(activeRoomId);
    }
  }, [activeRoomId, currentUser?.id]);

  // 5. Setup WebSocket connection for signaling/presence
  useEffect(() => {
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsWsConnected(true);
      socket.send(
        JSON.stringify({
          type: 'user:join',
          userId: currentUser.id,
          userName: currentUser.name,
          avatar: currentUser.avatar,
        })
      );
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'presence:update':
            setOnlineUsers(data.onlineUsers || []);
            break;

          case 'call:initiate': {
            soundFx.startIncomingCallRing();
            setCallState({
              active: true,
              callId: 'call_' + Date.now(),
              peerId: data.senderId,
              peerName: 'Contacto BYG',
              peerAvatar:
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
              status: 'incoming',
              isMuted: false,
              isSpeaker: true,
              startTime: null,
              audioLevel: 0,
              isVoiceOnly: true,
              signalQuality: 'connecting',
            });
            break;
          }

          case 'call:accept': {
            soundFx.stopAllRings();
            setCallState((prev) => ({
              ...prev,
              status: 'connected',
              startTime: Date.now(),
            }));
            break;
          }

          case 'call:reject':
          case 'call:end': {
            soundFx.playCallEnd();
            cleanupWebRTC();
            setCallState((prev) => ({
              ...prev,
              status: 'ended',
            }));
            setTimeout(() => {
              setCallState({
                active: false,
                callId: null,
                peerId: null,
                peerName: '',
                peerAvatar: '',
                status: 'idle',
                isMuted: false,
                isSpeaker: true,
                startTime: null,
                audioLevel: 0,
                isVoiceOnly: true,
                signalQuality: 'none',
              });
            }, 800);
            break;
          }

          case 'typing:update':
            setTypingUsers(prev => ({
              ...prev,
              [data.payload.roomId]: data.payload.users
            }));
            break;

          case 'message:delete': {
            const { messageId, roomId } = data.payload;
            if (roomId === activeRoomId) {
              setRoomMessagesMap(prev => {
                const currentMsgs = prev[roomId] || [];
                return {
                  ...prev,
                  [roomId]: currentMsgs.filter(m => m.id !== messageId)
                };
              });
              deleteMessageLocally(messageId);
            }
            break;
          }

          case 'message:read': {
            const { roomId, userId } = data.payload;
            // Update local state to reflect read status
            setRoomMessagesMap(prev => {
              const msgs = prev[roomId] || [];
              const updatedMsgs = msgs.map(m => 
                (m.senderId !== userId) ? { ...m, status: 'read' as const } : m
              );
              return { ...prev, [roomId]: updatedMsgs };
            });
            break;
          }

          case 'webrtc:offer':
            handleReceiveOffer(data.senderId, data.payload);
            break;

          case 'webrtc:answer':
            handleReceiveAnswer(data.payload);
            break;

          case 'webrtc:ice-candidate':
            handleReceiveIceCandidate(data.payload);
            break;
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      setIsWsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [currentUser?.id]);

  // Auth logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
    localStorage.removeItem('byg_chat_token');
    localStorage.removeItem('byg_chat_user');
    setCurrentUser(null);
    setToken(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Auth login/register success
  const handleLoginSuccess = (user: User, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
  };

  // Handle Sending Encrypted Message to Firestore
  const handleSendMessage = async (text: string, attachment?: Attachment) => {
    if (!activeRoomId || !currentUser) return;

    const encryptedPayload = await encryptText(text, activeRoomId);

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      receiverId: activeRoomId,
      text,
      encryptedPayload,
      timestamp: Date.now(),
      status: 'sent',
      attachment,
    };

    // Save locally immediately for offline sync
    saveMessageLocally({ ...newMsg, roomId: activeRoomId });

    // Save message to Supabase or Firestore
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('messages').insert({
          id: msgId,
          room_id: activeRoomId,
          sender_id: currentUser.id,
          receiver_id: activeRoomId,
          text,
          encrypted_payload: encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
          attachment: attachment || null,
        });
      } else {
        await addDoc(collection(db, 'messages'), {
          id: msgId,
          roomId: activeRoomId,
          senderId: currentUser.id,
          receiverId: activeRoomId,
          text,
          encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
          attachment: attachment || null,
        });
      }
    } catch (e) {
      console.error('Error saving message:', e);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'message:send',
          payload: newMsg,
        })
      );
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoomId || !currentUser) return;

    // 1. Update Local UI immediately
    setRoomMessagesMap(prev => {
      const currentMsgs = prev[activeRoomId] || [];
      return {
        ...prev,
        [activeRoomId]: currentMsgs.filter(m => m.id !== messageId)
      };
    });

    // 2. Delete from Local DB
    await deleteMessageLocally(messageId);

    // 3. Delete from Central DB (Firestore)
    try {
      // Find the document with the matching message id property
      const q = query(collection(db, 'messages'), where('id', '==', messageId));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (docSnap) => {
        await deleteDoc(doc(db, 'messages', docSnap.id));
      });
    } catch (e) {
      console.error('Error deleting message from Firestore:', e);
    }

    // 4. Notify via WebSocket for real-time sync with others
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'message:delete',
          payload: { messageId, roomId: activeRoomId },
        })
      );
    }
  };

  const handleMarkAsRead = async (roomId: string) => {
    if (!currentUser || !roomId) return;

    try {
      // 1. Update Firestore
      const q = query(
        collection(db, 'messages'),
        where('roomId', '==', roomId),
        where('senderId', '!=', currentUser.id),
        where('status', '==', 'sent')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = snapshot.docs.map(docSnap => {
        const docRef = doc(db, 'messages', docSnap.id);
        return updateDoc(docRef, { status: 'read' });
      });
      await Promise.all(batch);

      // 2. Notify via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'message:read',
          payload: { roomId, userId: currentUser.id }
        }));
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Handle Sending Encrypted Voice Note to Firestore
  const handleSendVoiceNote = async (audioBlob: Blob, duration: number) => {
    if (!activeRoomId || !currentUser) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });

    const encryptedAudioData = await encryptFile(audioFile, activeRoomId);

    const attachment: Attachment = {
      id: 'att_audio_' + Date.now(),
      type: 'audio',
      name: `Nota de Voz Cifrada (${duration}s)`,
      size: audioBlob.size,
      url: audioUrl,
      mimeType: 'audio/webm',
      encryptedData: encryptedAudioData,
    };

    const text = '🎤 [Nota de Voz Cifrada]';
    const encryptedPayload = await encryptText(text, activeRoomId);

    const msgId = 'msg_voice_' + Date.now();
    const newMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      receiverId: activeRoomId,
      text,
      encryptedPayload,
      timestamp: Date.now(),
      status: 'sent',
      attachment,
      isVoiceNote: true,
      audioDuration: duration,
    };

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('messages').insert({
          id: msgId,
          room_id: activeRoomId,
          sender_id: currentUser.id,
          receiver_id: activeRoomId,
          text,
          encrypted_payload: encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
          attachment,
          is_voice_note: true,
          audio_duration: duration,
        });
      } else {
        await addDoc(collection(db, 'messages'), {
          id: msgId,
          roomId: activeRoomId,
          senderId: currentUser.id,
          receiverId: activeRoomId,
          text,
          encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
          attachment,
          isVoiceNote: true,
          audioDuration: duration,
        });
      }
    } catch (e) {
      console.error('Error saving voice note:', e);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'message:send',
          payload: newMsg,
        })
      );
    }
  };

  const logCallMessage = async (type: 'started' | 'ended' | 'missed', roomId: string) => {
    if (!currentUser) return;

    let text = '';
    if (type === 'started') text = '📞 Llamada de voz iniciada';
    else if (type === 'ended') text = '🏁 Llamada de voz finalizada';
    else if (type === 'missed') text = '🚫 Llamada perdida';

    const encryptedPayload = await encryptText(text, roomId);
    const msgId = 'call_log_' + Date.now();

    const newMsg: Message = {
      id: msgId,
      senderId: currentUser.id,
      receiverId: roomId,
      text,
      encryptedPayload,
      timestamp: Date.now(),
      status: 'sent',
    };

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('messages').insert({
          id: msgId,
          room_id: roomId,
          sender_id: currentUser.id,
          receiver_id: roomId,
          text,
          encrypted_payload: encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
        });
      } else {
        await addDoc(collection(db, 'messages'), {
          id: msgId,
          roomId: roomId,
          senderId: currentUser.id,
          receiverId: roomId,
          text,
          encryptedPayload,
          timestamp: Date.now(),
          status: 'sent',
        });
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message:send',
            payload: newMsg,
          })
        );
      }
    } catch (e) {
      console.error('Error logging call message:', e);
    }
  };

  // Load messages from local DB when changing room
  useEffect(() => {
    if (activeRoomId) {
      getMessagesLocally(activeRoomId).then(localMsgs => {
        if (localMsgs.length > 0) {
          setRoomMessagesMap(prev => ({
            ...prev,
            [activeRoomId]: localMsgs
          }));
        }
      });
    }
  }, [activeRoomId]);
  const handleStartVoiceCall = () => {
    const activeRoom = rooms.find((r) => r.id === activeRoomId);

    soundFx.startOutgoingCallRing();
    logCallMessage('started', activeRoomId!);
    setCallState({
      active: true,
      callId: 'call_' + Date.now(),
      peerId: activeRoom?.id || 'peer',
      peerName: activeRoom?.name || 'Contacto BYG',
      peerAvatar:
        activeRoom?.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      status: 'calling',
      isMuted: false,
      isSpeaker: true,
      startTime: null,
      audioLevel: 0,
      isVoiceOnly: true,
      signalQuality: 'connecting',
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:initiate',
          payload: { roomId: activeRoomId },
        })
      );
    }
  };

  const handleAcceptCall = async () => {
    soundFx.stopAllRings();
    setCallState((prev) => ({
      ...prev,
      status: 'connected',
      startTime: Date.now(),
    }));

    if (callState.peerId) {
      await setupWebRTC(callState.peerId, true);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:accept',
          payload: { callId: callState.callId },
        })
      );
    }
  };

  const handleRejectCall = () => {
    soundFx.playCallEnd();
    logCallMessage('missed', activeRoomId!);
    cleanupWebRTC();
    setCallState((prev) => ({ ...prev, status: 'ended' }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:reject',
          payload: { callId: callState.callId },
        })
      );
    }
    setTimeout(() => {
      setCallState({
        active: false,
        callId: null,
        peerId: null,
        peerName: '',
        peerAvatar: '',
        status: 'idle',
        isMuted: false,
        isSpeaker: true,
        startTime: null,
        audioLevel: 0,
        isVoiceOnly: true,
        signalQuality: 'none',
      });
    }, 500);
  };

  const handleEndCall = () => {
    soundFx.playCallEnd();
    logCallMessage('ended', activeRoomId!);
    cleanupWebRTC();
    setCallState((prev) => ({ ...prev, status: 'ended' }));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:end',
          payload: { callId: callState.callId },
        })
      );
    }
    setTimeout(() => {
      setCallState({
        active: false,
        callId: null,
        peerId: null,
        peerName: '',
        peerAvatar: '',
        status: 'idle',
        isMuted: false,
        isSpeaker: true,
        startTime: null,
        audioLevel: 0,
        isVoiceOnly: true,
        signalQuality: 'none',
      });
    }, 500);
  };

  // WebRTC Signal Handlers
  const setupWebRTC = async (targetId: string, isInitiator: boolean) => {
    cleanupWebRTC();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc:ice-candidate',
          targetUserId: targetId,
          payload: event.candidate
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`ICE Connection State: ${state}`);

      let quality: any = 'none';
      if (state === 'checking' || state === 'new') quality = 'connecting';
      if (state === 'connected' || state === 'completed') quality = 'stable';
      if (state === 'disconnected') quality = 'weak';
      if (state === 'failed' || state === 'closed') quality = 'none';

      setCallState(prev => ({ ...prev, signalQuality: quality }));

      if (state === 'failed' || state === 'disconnected') {
        if (isInitiator) {
          console.warn('ICE Connection failed, triggering restart...');
          triggerICERestart(targetId);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Peer Connection State: ${state}`);

      let quality: any = 'none';
      if (state === 'connecting') quality = 'connecting';
      if (state === 'connected') quality = 'stable';
      if (state === 'failed' || state === 'closed') quality = 'none';
      if (state === 'disconnected') quality = 'weak';

      setCallState(prev => ({ ...prev, signalQuality: quality }));

      if (state === 'failed') {
        if (isInitiator) {
          triggerICERestart(targetId);
        }
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      const audio = new Audio();
      audio.srcObject = remoteStreamRef.current;
      audio.play().catch(e => console.error('Audio play failed:', e));
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({
          type: 'webrtc:offer',
          targetUserId: targetId,
          payload: offer
        }));
      }
    } catch (err) {
      console.error('WebRTC error:', err);
    }
  };

  const triggerICERestart = async (targetId: string) => {
    const pc = peerConnectionRef.current;
    if (!pc || !wsRef.current) return;

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({
        type: 'webrtc:offer',
        targetUserId: targetId,
        payload: offer
      }));
      console.log('ICE Restart offer sent');
    } catch (err) {
      console.error('ICE Restart failed:', err);
    }
  };

  const handleReceiveOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    await setupWebRTC(senderId, false);
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({
        type: 'webrtc:answer',
        targetUserId: senderId,
        payload: answer
      }));
    }
  };

  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleReceiveIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const cleanupWebRTC = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
  };

  // Create Group in Supabase or Firestore
  const handleCreateGroup = async (groupName: string) => {
    if (!currentUser) return;

    try {
      const roomId = `room_group_${Date.now()}`;
      const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();

      const newRoom = {
        id: roomId,
        name: groupName.trim(),
        type: 'group' as const,
        participants: [currentUser.id],
        unreadCount: 0,
        isEncrypted: true,
        fingerprint: `GRP:${hexRandom}:E2EE:SAFE`,
        avatar: '👥',
        createdAt: Date.now(),
      };

      if (isSupabaseConfigured && supabase) {
        await supabase.from('rooms').insert({
          id: roomId,
          name: groupName.trim(),
          type: 'group',
          participants: [currentUser.id],
          unread_count: 0,
          is_encrypted: true,
          fingerprint: `GRP:${hexRandom}:E2EE:SAFE`,
          avatar: '👥',
          created_at: Date.now(),
        });
      } else {
        await setDoc(doc(db, 'rooms', roomId), newRoom);
      }
      setActiveRoomId(roomId);
    } catch (e) {
      console.error('Error creating group:', e);
    }
  };

  // Direct chat selection from User Directory in Supabase or Firestore
  const handleSelectUserFromDirectory = async (targetUser: User) => {
    if (!currentUser) return;

    try {
      const existingRoom = rooms.find(
        (r) =>
          r.type === 'direct' &&
          r.participants.includes(currentUser.id) &&
          r.participants.includes(targetUser.id)
      );

      if (existingRoom) {
        setActiveRoomId(existingRoom.id);
        return;
      }

      const roomId = `room_direct_${Date.now()}`;
      const directRoom = {
        id: roomId,
        name: targetUser.name,
        type: 'direct' as const,
        participants: [currentUser.id, targetUser.id],
        unreadCount: 0,
        isEncrypted: true,
        fingerprint: targetUser.fingerprint || 'BYG:SAFE:2026:DIRECT',
        avatar: targetUser.avatar || '💬',
        createdAt: Date.now(),
      };

      if (isSupabaseConfigured && supabase) {
        await supabase.from('rooms').insert({
          id: roomId,
          name: targetUser.name,
          type: 'direct',
          participants: [currentUser.id, targetUser.id],
          unread_count: 0,
          is_encrypted: true,
          fingerprint: targetUser.fingerprint || 'BYG:SAFE:2026:DIRECT',
          avatar: targetUser.avatar || '💬',
          created_at: Date.now(),
        });
      } else {
        await setDoc(doc(db, 'rooms', roomId), directRoom);
      }
      setActiveRoomId(roomId);
    } catch (e) {
      console.error('Error opening direct chat room:', e);
    }
  };

  const handleUpdateProfile = async (updatedData: { name: string; avatar: string; bio: string; status: UserStatus }) => {
    if (!currentUser) return;

    const updatedUser: User = {
      ...currentUser,
      name: updatedData.name,
      avatar: updatedData.avatar,
      bio: updatedData.bio,
      status: updatedData.status,
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('byg_chat_user', JSON.stringify(updatedUser));

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      await setDoc(
        userDocRef,
        {
          name: updatedData.name,
          avatar: updatedData.avatar,
          bio: updatedData.bio,
          status: updatedData.status,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Error actualizando Firestore profile:', e);
    }

    try {
      await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: updatedData.name,
          avatar: updatedData.avatar,
          bio: updatedData.bio,
          status: updatedData.status,
        }),
      });
    } catch (e) {
      console.error('Error actualizando REST API profile:', e);
    }
  };

  const handleViewUserProfile = async (targetUserOrId: User | string, nameHint?: string) => {
    if (typeof targetUserOrId === 'object') {
      setProfileTargetUser(targetUserOrId);
      setShowProfileModal(true);
      return;
    }

    const userId = targetUserOrId;
    const foundInOnline = onlineUsers.find((u) => u.id === userId);
    if (foundInOnline) {
      setProfileTargetUser(foundInOnline);
      setShowProfileModal(true);
      return;
    }

    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists()) {
        const d = docSnap.data();
        setProfileTargetUser({
          id: userId,
          name: d.name || nameHint || 'Usuario BYG',
          avatar: d.avatar || '😎',
          status: d.status || 'online',
          bio: d.bio || '',
          xaonId: formatXaonDisplay(d.xaonId, userId),
          fingerprint: d.fingerprint || 'BYG:SAFE:2026:USER',
        });
      } else {
        setProfileTargetUser({
          id: userId,
          name: nameHint || 'Usuario BYG',
          avatar: '😎',
          status: 'online',
          bio: '',
          xaonId: formatXaonDisplay(undefined, userId),
          fingerprint: 'BYG:SAFE:2026:USER',
        });
      }
    } catch (e) {
      setProfileTargetUser({
        id: userId,
        name: nameHint || 'Usuario BYG',
        avatar: '😎',
        status: 'online',
        bio: '',
        xaonId: formatXaonDisplay(undefined, userId),
        fingerprint: 'BYG:SAFE:2026:USER',
      });
    }
    setShowProfileModal(true);
  };

  // If user not authenticated, render AuthModal
  if (!currentUser) {
    return (
      <div className={`w-full h-full min-h-screen transition-all duration-300 ${isMonochrome ? 'grayscale contrast-[1.12]' : ''}`}>
        <AuthModal onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  const currentActiveRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const currentMessages = activeRoomId ? roomMessagesMap[activeRoomId] || [] : [];

  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  }[userSettings.fontSize as 'small' | 'medium' | 'large'];

  return (
    <div 
      className={`flex flex-col h-[100dvh] w-screen bg-[#050505] font-sans text-zinc-100 p-0 sm:p-2 lg:p-4 gap-0 sm:gap-2 lg:gap-4 overflow-hidden antialiased transition-all duration-300 ${isMonochrome ? 'grayscale contrast-[1.12]' : ''} ${fontSizeClass}`}
      style={{ '--accent-color': userSettings.accentColor } as any}
    >
      <AnimatePresence>
        {isAppLocked && currentUser && (
          <LockScreen 
            savedPin={userSettings.appPin || '1234'} 
            onUnlock={handleUnlock} 
          />
        )}
      </AnimatePresence>

      {/* Monochrome mode Toast indicator */}
      {showMonoToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#181818] border border-zinc-700 text-white font-mono text-xs font-bold rounded-2xl shadow-2xl flex items-center space-x-2 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
          <span>
            Modo Monocromático: {isMonochrome ? 'ACTIVADO' : 'DESACTIVADO'} (Shift + Q + Z)
          </span>
        </div>
      )}

      {/* Top App Header - Hidden on mobile when inside a chat room to act like WhatsApp */}
      <div className={activeRoomId ? 'hidden md:block' : 'block'}>
        <Header
          currentUser={currentUser}
          activeRoomName={currentActiveRoom?.name}
          isWsConnected={isWsConnected}
          callState={callState}
          onOpenSecurityModal={() => setShowSecurityModal(true)}
          onStartVoiceCall={handleStartVoiceCall}
          onLogout={handleLogout}
          onBackMobile={() => setActiveRoomId('')}
          showBackMobile={!!activeRoomId}
          onOpenDirectory={() => setShowUserDirectory(true)}
          onNewGroup={() => setShowNewGroupModal(true)}
          onOpenProfile={() => {
            setProfileTargetUser(currentUser);
            setShowProfileModal(true);
          }}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      </div>

      {/* Main Content Area with Mobile Responsiveness */}
      <div className="flex-1 flex gap-0 sm:gap-2 lg:gap-4 overflow-hidden relative">
        {/* On mobile: Hide Sidebar when a room is active */}
        <div className={`h-full w-full md:w-88 lg:w-96 shrink-0 ${activeRoomId ? 'hidden md:block' : 'block'}`}>
          <Sidebar
            rooms={rooms}
            activeRoomId={activeRoomId}
            onSelectRoom={(roomId) => setActiveRoomId(roomId)}
            onNewGroup={() => setShowNewGroupModal(true)}
            onOpenDirectory={() => setShowUserDirectory(true)}
            onlineUsers={onlineUsers}
            userFingerprint={currentUser.fingerprint}
            className="sm:rounded-[2rem] sm:border border-zinc-800"
          />
        </div>

        {/* On mobile: Hide ChatArea when no room is active */}
        <div className={`h-full flex-1 ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}>
          <ChatArea
            room={currentActiveRoom}
            messages={currentMessages}
            currentUser={currentUser}
            callState={callState}
            onSendMessage={handleSendMessage}
            onSendVoiceNote={handleSendVoiceNote}
            onStartVoiceCall={handleStartVoiceCall}
            onOpenSecurityModal={() => setShowSecurityModal(true)}
            onOpenMediaViewer={(att) => setViewingAttachment(att)}
            onBackMobile={() => setActiveRoomId('')}
            onViewUserProfile={handleViewUserProfile}
            onDeleteMessage={handleDeleteMessage}
            className="sm:rounded-[2rem] sm:border border-zinc-800"
            typingUsers={typingUsers[activeRoomId] || []}
            onTypingStart={() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'typing:start', payload: { roomId: activeRoomId } }));
              }
            }}
            onTypingStop={() => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'typing:stop', payload: { roomId: activeRoomId } }));
              }
            }}
          />
        </div>
      </div>

      {/* User Directory Modal */}
      <UserDirectoryModal
        isOpen={showUserDirectory}
        onClose={() => setShowUserDirectory(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUserFromDirectory}
        onViewUserProfile={handleViewUserProfile}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        targetUser={profileTargetUser}
        onUpdateProfile={handleUpdateProfile}
        onStartChatWithUser={(u) => {
          handleSelectUserFromDirectory(u);
          setShowProfileModal(false);
        }}
        onStartCallWithUser={(u) => {
          handleSelectUserFromDirectory(u);
          handleStartVoiceCall();
          setShowProfileModal(false);
        }}
      />

      {/* Call Modal Overlay */}
      <CallModal
        callState={callState}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
        onEndCall={handleEndCall}
        onToggleMute={() => setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
        onToggleSpeaker={() => setCallState((prev) => ({ ...prev, isSpeaker: !prev.isSpeaker }))}
      />

      {/* Security Modal Overlay */}
      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        vaultInfo={vaultInfo}
        onRegenerateKeys={() => {
          localStorage.removeItem('byg_user_vault');
          getUserKeyVault().then((newVault) => {
            setVaultInfo(newVault);
            setCurrentUser((prev) => (prev ? { ...prev, fingerprint: newVault.fingerprint } : null));
          });
        }}
      />

      {/* Media Viewer Modal */}
      <MediaViewer
        attachment={viewingAttachment}
        onClose={() => setViewingAttachment(null)}
      />

      {/* New Group Modal */}
      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        onCreateGroup={handleCreateGroup}
      />

      {showSettingsModal && (
        <SettingsModal
          settings={userSettings}
          onUpdateSettings={(newSet) => setUserSettings((prev: any) => ({ ...prev, ...newSet }))}
          onClose={() => setShowSettingsModal(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
