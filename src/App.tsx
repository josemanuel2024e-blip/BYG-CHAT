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
import { supabase } from './lib/supabase';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<KeyVaultInfo | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [roomMessagesMap, setRoomMessagesMap] = useState<Record<string, Message[]>>({});
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

  // 1. Check Supabase Auth session on startup
  useEffect(() => {
    // Solicitar permiso para notificaciones web
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
        // User data is usually stored in metadata or we fetch from users table
        const savedUserRaw = localStorage.getItem('byg_chat_user');
        if (savedUserRaw) {
           setCurrentUser(JSON.parse(savedUserRaw));
        } else {
           // Fetch from profile
           supabase.from('users').select('*').eq('id', session.user.id).single().then(({ data: profile }) => {
             if (profile) {
               const u: User = {
                  id: session.user.id,
                  name: profile.name || 'Usuario BYG',
                  avatar: profile.avatar || '😎',
                  status: 'online',
                  bio: profile.bio || 'Usuario verificado de BYG CHAT',
                  xaonId: formatXaonDisplay(profile.xaon_id || profile.xaonId, session.user.id),
                  fingerprint: profile.fingerprint || 'BYG:SAFE:2026:AUTH',
               };
               setCurrentUser(u);
               localStorage.setItem('byg_chat_user', JSON.stringify(u));
             }
           });
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setToken(session.access_token);
      } else {
        setCurrentUser(null);
        setToken(null);
        localStorage.removeItem('byg_chat_token');
        localStorage.removeItem('byg_chat_user');
      }
    });

    return () => subscription.unsubscribe();
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

  // 3. Real-time Rooms sync for logged in user (Supabase)
  useEffect(() => {
    if (!currentUser || !supabase) return;

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
  }, [currentUser?.id]);

  // 4. Real-time Messages sync for activeRoomId (Supabase)
  useEffect(() => {
    if (!currentUser || !activeRoomId || !supabase) return;

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

        // Sound effect and notifications for new messages
        if (initialMsgsLoadedRef.current[activeRoomId] && processedMsgs.length > 0) {
          const lastMsg = processedMsgs[processedMsgs.length - 1];
          if (lastMsg.senderId !== currentUser.id) {
            const prevMsgs = roomMessagesMap[activeRoomId] || [];
            if (!prevMsgs.some(m => m.id === lastMsg.id)) {
               soundFx.playMessageReceive();
               if (document.hidden && Notification.permission === 'granted') {
                 const room = rooms.find(r => r.id === activeRoomId);
                 new Notification('BYG CHAT', {
                   body: `Nuevo mensaje en ${room?.name || 'el chat'}`,
                   icon: '/svg/logo.svg',
                 });
               }
            }
          }
        }
        initialMsgsLoadedRef.current[activeRoomId] = true;

        processedMsgs.forEach(msg => saveMessageLocally({ ...msg, roomId: activeRoomId }));

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
          if (lastMsg.senderId !== currentUser.id) {
            handleMarkAsRead(activeRoomId);
          }
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
  }, [currentUser?.id, activeRoomId]);

  // Handle Mark as Read on Room Entry
  useEffect(() => {
    if (activeRoomId && currentUser) {
      handleMarkAsRead(activeRoomId);
    }
  }, [activeRoomId, currentUser?.id]);

  // 5. Setup Supabase Realtime for signaling/presence
  useEffect(() => {
    if (!currentUser || !supabase) return;

    const signalingChannel = supabase.channel('byg_signaling', {
      config: {
        presence: { key: currentUser.id },
        broadcast: { self: false }
      }
    });

    signalingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = signalingChannel.presenceState();
        const online: User[] = Object.values(state).flat().map((p: any) => ({
          id: p.id || p.userId,
          name: p.name || p.userName,
          avatar: p.avatar,
          status: 'online',
        }));
        setOnlineUsers(online);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setTypingUsers(prev => ({
          ...prev,
          [payload.roomId]: payload.users
        }));
      })
      .on('broadcast', { event: 'call_initiate' }, ({ payload }) => {
        if (payload.targetId === currentUser.id || payload.roomId === activeRoomId) {
          soundFx.startIncomingCallRing();
          setCallState({
            active: true,
            callId: payload.callId,
            peerId: payload.senderId,
            peerName: payload.senderName || 'Contacto BYG',
            peerAvatar: payload.senderAvatar || '💬',
            status: 'incoming',
            isMuted: false,
            isSpeaker: true,
            startTime: null,
            audioLevel: 0,
            isVoiceOnly: true,
            signalQuality: 'connecting',
          });
        }
      })
      .on('broadcast', { event: 'call_accept' }, ({ payload }) => {
        if (payload.callId === callState.callId || payload.targetId === currentUser.id) {
          soundFx.stopAllRings();
          setCallState(prev => ({ ...prev, status: 'connected', startTime: Date.now() }));
        }
      })
      .on('broadcast', { event: 'call_reject' }, ({ payload }) => {
        if (payload.callId === callState.callId) {
          soundFx.playCallEnd();
          cleanupWebRTC();
          setCallState(prev => ({ ...prev, status: 'ended' }));
          setTimeout(() => resetCallState(), 800);
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }) => {
        if (payload.callId === callState.callId) {
          soundFx.playCallEnd();
          cleanupWebRTC();
          setCallState(prev => ({ ...prev, status: 'ended' }));
          setTimeout(() => resetCallState(), 800);
        }
      })
      .on('broadcast', { event: 'webrtc_offer' }, ({ payload }) => {
        if (payload.targetId === currentUser.id) {
          handleReceiveOffer(payload.senderId, payload.offer);
        }
      })
      .on('broadcast', { event: 'webrtc_answer' }, ({ payload }) => {
        if (payload.targetId === currentUser.id) {
          handleReceiveAnswer(payload.answer);
        }
      })
      .on('broadcast', { event: 'webrtc_ice' }, ({ payload }) => {
        if (payload.targetId === currentUser.id) {
          handleReceiveIceCandidate(payload.candidate);
        }
      })
      .on('broadcast', { event: 'message_read' }, ({ payload }) => {
         const { roomId, userId } = payload;
         setRoomMessagesMap(prev => {
            const msgs = prev[roomId] || [];
            const updatedMsgs = msgs.map(m => 
               (m.senderId !== userId) ? { ...m, status: 'read' as const } : m
            );
            return { ...prev, [roomId]: updatedMsgs };
         });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await signalingChannel.track({
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            online_at: new Date().toISOString(),
          });
          setIsWsConnected(true);
        }
      });

    // Helper to store channel in ref if needed
    (window as any).signalingChannel = signalingChannel;

    return () => {
      supabase.removeChannel(signalingChannel);
      setIsWsConnected(false);
    };
  }, [currentUser?.id, activeRoomId, callState.callId]);

  const resetCallState = () => {
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
  };

  // Auth logout handler
  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('byg_chat_token');
    localStorage.removeItem('byg_chat_user');
    setCurrentUser(null);
    setToken(null);
  };

  // Auth login/register success
  const handleLoginSuccess = (user: User, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
  };

  // Handle Sending Encrypted Message to Supabase
  const handleSendMessage = async (text: string, attachment?: Attachment) => {
    if (!activeRoomId || !currentUser || !supabase) return;

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

    // Save message to Supabase
    try {
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
    } catch (e) {
      console.error('Error saving message:', e);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoomId || !currentUser || !supabase) return;

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

    // 3. Delete from Supabase
    try {
      await supabase.from('messages').delete().eq('id', messageId);
    } catch (e) {
      console.error('Error deleting message from Supabase:', e);
    }
  };

  const handleMarkAsRead = async (roomId: string) => {
    if (!currentUser || !roomId || !supabase) return;

    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('room_id', roomId)
        .neq('sender_id', currentUser.id)
        .eq('status', 'sent');
      
      if (error) return;

      // 2. Notify via broadcast
      const channel = (window as any).signalingChannel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'message_read',
          payload: { roomId, userId: currentUser.id }
        });
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Handle Sending Encrypted Voice Note to Supabase
  const handleSendVoiceNote = async (audioBlob: Blob, duration: number) => {
    if (!activeRoomId || !currentUser || !supabase) return;

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
    
    try {
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
    } catch (e) {
      console.error('Error saving voice note:', e);
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
    if (!activeRoom || !currentUser || !supabase) return;

    soundFx.startOutgoingCallRing();
    logCallMessage('started', activeRoomId!);
    
    const callId = 'call_' + Date.now();
    setCallState({
      active: true,
      callId,
      peerId: activeRoom.id,
      peerName: activeRoom.name,
      peerAvatar: activeRoom.avatar || '💬',
      status: 'calling',
      isMuted: false,
      isSpeaker: true,
      startTime: null,
      audioLevel: 0,
      isVoiceOnly: true,
      signalQuality: 'connecting',
    });

    const channel = (window as any).signalingChannel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_initiate',
        payload: { 
          callId,
          roomId: activeRoomId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          targetId: activeRoom.type === 'direct' ? activeRoom.participants.find(p => p !== currentUser.id) : null
        },
      });
    }
  };

  const handleAcceptCall = async () => {
    if (!currentUser || !supabase) return;
    soundFx.stopAllRings();
    setCallState((prev) => ({
      ...prev,
      status: 'connected',
      startTime: Date.now(),
    }));

    if (callState.peerId) {
      await setupWebRTC(callState.peerId, true);
    }

    const channel = (window as any).signalingChannel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_accept',
        payload: { 
          callId: callState.callId,
          targetId: callState.peerId
        },
      });
    }
  };

  const handleRejectCall = () => {
    soundFx.playCallEnd();
    logCallMessage('missed', activeRoomId!);
    cleanupWebRTC();
    setCallState((prev) => ({ ...prev, status: 'ended' }));
    
    const channel = (window as any).signalingChannel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_reject',
        payload: { callId: callState.callId, targetId: callState.peerId },
      });
    }
    setTimeout(() => resetCallState(), 500);
  };

  const handleEndCall = () => {
    soundFx.playCallEnd();
    logCallMessage('ended', activeRoomId!);
    cleanupWebRTC();
    setCallState((prev) => ({ ...prev, status: 'ended' }));
    
    const channel = (window as any).signalingChannel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'call_end',
        payload: { callId: callState.callId, targetId: callState.peerId },
      });
    }
    setTimeout(() => resetCallState(), 500);
  };

  // WebRTC Signal Handlers via Supabase
  const setupWebRTC = async (targetId: string, isInitiator: boolean) => {
    cleanupWebRTC();
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const channel = (window as any).signalingChannel;
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc_ice',
            payload: {
              targetId,
              candidate: event.candidate
            }
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      let quality: any = 'none';
      if (state === 'checking' || state === 'new') quality = 'connecting';
      if (state === 'connected' || state === 'completed') quality = 'stable';
      if (state === 'disconnected') quality = 'weak';
      if (state === 'failed' || state === 'closed') quality = 'none';
      setCallState(prev => ({ ...prev, signalQuality: quality }));
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
        const channel = (window as any).signalingChannel;
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc_offer',
            payload: {
              targetId,
              senderId: currentUser?.id,
              offer
            }
          });
        }
      }
    } catch (err) {
      console.error('WebRTC error:', err);
    }
  };

  const handleReceiveOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    await setupWebRTC(senderId, false);
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      const channel = (window as any).signalingChannel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc_answer',
          payload: {
            targetId: senderId,
            answer
          }
        });
      }
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

  // Create Group in Supabase
  const handleCreateGroup = async (groupName: string) => {
    if (!currentUser || !supabase) return;

    try {
      const roomId = `room_group_${Date.now()}`;
      const hexRandom = Math.random().toString(36).substring(2, 10).toUpperCase();

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
      setActiveRoomId(roomId);
    } catch (e) {
      console.error('Error creating group:', e);
    }
  };

  // Direct chat selection from User Directory in Supabase
  const handleSelectUserFromDirectory = async (targetUser: User) => {
    if (!currentUser || !supabase) return;

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
      setActiveRoomId(roomId);
    } catch (e) {
      console.error('Error opening direct chat room:', e);
    }
  };

  const handleUpdateProfile = async (updatedData: { name: string; avatar: string; bio: string; status: UserStatus }) => {
    if (!currentUser || !supabase) return;

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
      await supabase.from('users').update({
        name: updatedData.name,
        avatar: updatedData.avatar,
        bio: updatedData.bio,
        status: updatedData.status,
      }).eq('id', currentUser.id);
    } catch (e) {
      console.error('Error actualizando Supabase profile:', e);
    }
  };

  const handleViewUserProfile = async (targetUserOrId: User | string, nameHint?: string) => {
    if (typeof targetUserOrId === 'object') {
      setProfileTargetUser(targetUserOrId);
      setShowProfileModal(true);
      return;
    }

    if (!supabase) return;

    const userId = targetUserOrId;
    const foundInOnline = onlineUsers.find((u) => u.id === userId);
    if (foundInOnline) {
      setProfileTargetUser(foundInOnline);
      setShowProfileModal(true);
      return;
    }

    try {
      const { data: profile } = await supabase.from('users').select('*').eq('id', userId).single();
      if (profile) {
        setProfileTargetUser({
          id: userId,
          name: profile.name || nameHint || 'Usuario BYG',
          avatar: profile.avatar || '😎',
          status: profile.status || 'online',
          bio: profile.bio || '',
          xaonId: formatXaonDisplay(profile.xaon_id || profile.xaonId, userId),
          fingerprint: profile.fingerprint || 'BYG:SAFE:2026:USER',
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
