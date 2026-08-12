import React, { useState, useEffect, useRef } from 'react';
import { User, Room, Message, CallState, KeyVaultInfo, Attachment } from './types';
import { getUserKeyVault, encryptText, decryptText, encryptFile } from './utils/crypto';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CallModal } from './components/CallModal';
import { SecurityModal } from './components/SecurityModal';
import { MediaViewer } from './components/MediaViewer';
import { NewGroupModal } from './components/NewGroupModal';
import { AuthModal } from './components/AuthModal';
import { UserDirectoryModal } from './components/UserDirectoryModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<KeyVaultInfo | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [roomMessagesMap, setRoomMessagesMap] = useState<Record<string, Message[]>>({});
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);

  // Modals state
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState<boolean>(false);
  const [showUserDirectory, setShowUserDirectory] = useState<boolean>(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

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
  });

  // Monochrome mode state & keyboard shortcut (Shift + Q + Z)
  const [isMonochrome, setIsMonochrome] = useState<boolean>(() => {
    return localStorage.getItem('byg_chat_monochrome') === 'true';
  });
  const [showMonoToast, setShowMonoToast] = useState<boolean>(false);
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

  // 1. Check local session on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('byg_chat_token');
    const savedUserRaw = localStorage.getItem('byg_chat_user');

    if (savedToken && savedUserRaw) {
      try {
        const parsedUser = JSON.parse(savedUserRaw);
        setToken(savedToken);
        setCurrentUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('byg_chat_token');
        localStorage.removeItem('byg_chat_user');
      }
    }
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

  // 3. Load Rooms for logged in user
  const loadUserRooms = (usrId: string, tok?: string) => {
    const queryToken = tok || token || '';
    fetch(`/api/rooms?userId=${usrId}&token=${queryToken}`)
      .then((res) => res.json())
      .then((data: Room[]) => {
        setRooms(data);
        if (data.length > 0 && !activeRoomId) {
          // Select first room on desktop by default
          if (window.innerWidth >= 768) {
            setActiveRoomId(data[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load user rooms:', err));
  };

  useEffect(() => {
    if (currentUser) {
      loadUserRooms(currentUser.id, token || '');
    }
  }, [currentUser?.id, token]);

  // 4. Setup WebSocket connection for logged in user
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

          case 'message:receive': {
            const rawMsg: Message = data.payload;
            const roomId = rawMsg.receiverId;

            let decryptedText = rawMsg.text;
            if (rawMsg.encryptedPayload && rawMsg.encryptedPayload.ciphertext) {
              decryptedText = await decryptText(rawMsg.encryptedPayload, roomId);
            }

            const processedMsg: Message = {
              ...rawMsg,
              text: decryptedText,
            };

            setRoomMessagesMap((prev) => {
              const currentList = prev[roomId] || [];
              if (currentList.some((m) => m.id === processedMsg.id)) {
                return prev;
              }
              return {
                ...prev,
                [roomId]: [...currentList, processedMsg],
              };
            });

            setRooms((prevRooms) =>
              prevRooms.map((r) =>
                r.id === roomId
                  ? {
                      ...r,
                      lastMessage: processedMsg,
                    }
                  : r
              )
            );
            break;
          }

          case 'call:initiate': {
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
            });
            break;
          }

          case 'call:accept': {
            setCallState((prev) => ({
              ...prev,
              status: 'connected',
              startTime: Date.now(),
            }));
            break;
          }

          case 'call:reject':
          case 'call:end': {
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
              });
            }, 800);
            break;
          }
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
  const handleLogout = () => {
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

  // Handle Sending Encrypted Message
  const handleSendMessage = async (text: string, attachment?: Attachment) => {
    if (!activeRoomId || !currentUser) return;

    const encryptedPayload = await encryptText(text, activeRoomId);

    const newMsg: Message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      senderId: currentUser.id,
      receiverId: activeRoomId,
      text,
      encryptedPayload,
      timestamp: Date.now(),
      status: 'sent',
      attachment,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'message:send',
          payload: newMsg,
        })
      );
    }
  };

  // Handle Sending Encrypted Voice Note
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

    const newMsg: Message = {
      id: 'msg_voice_' + Date.now(),
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

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'message:send',
          payload: newMsg,
        })
      );
    }
  };

  // Voice Call logic
  const handleStartVoiceCall = () => {
    const activeRoom = rooms.find((r) => r.id === activeRoomId);

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

  const handleAcceptCall = () => {
    setCallState((prev) => ({
      ...prev,
      status: 'connected',
      startTime: Date.now(),
    }));

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
      });
    }, 500);
  };

  const handleEndCall = () => {
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
      });
    }, 500);
  };

  // Create Group
  const handleCreateGroup = async (groupName: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/rooms/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          creatorId: currentUser.id,
        }),
      });

      const newRoom: Room = await res.json();
      setRooms((prev) => [newRoom, ...prev]);
      setActiveRoomId(newRoom.id);
    } catch (e) {
      console.error('Error creating group:', e);
    }
  };

  // Direct chat selection from User Directory
  const handleSelectUserFromDirectory = async (targetUser: User) => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/rooms/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          targetUserId: targetUser.id,
        }),
      });

      const directRoom: Room = await res.json();
      setRooms((prev) => {
        if (prev.some((r) => r.id === directRoom.id)) return prev;
        return [directRoom, ...prev];
      });
      setActiveRoomId(directRoom.id);
    } catch (e) {
      console.error('Error opening direct chat room:', e);
    }
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

  return (
    <div className={`flex flex-col h-[100dvh] w-screen bg-[#050505] font-sans text-zinc-100 p-0 sm:p-3 gap-0 sm:gap-3 overflow-hidden antialiased transition-all duration-300 ${isMonochrome ? 'grayscale contrast-[1.12]' : ''}`}>
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
        />
      </div>

      {/* Main Content Area with Mobile Responsiveness */}
      <div className="flex-1 flex gap-0 sm:gap-3 overflow-hidden relative">
        {/* On mobile: Hide Sidebar when a room is active */}
        <div className={`h-full w-full md:w-auto ${activeRoomId ? 'hidden md:block' : 'block'}`}>
          <Sidebar
            rooms={rooms}
            activeRoomId={activeRoomId}
            onSelectRoom={(roomId) => setActiveRoomId(roomId)}
            onNewGroup={() => setShowNewGroupModal(true)}
            onOpenDirectory={() => setShowUserDirectory(true)}
            onlineUsers={onlineUsers}
            userFingerprint={currentUser.fingerprint}
          />
        </div>

        {/* On mobile: Hide ChatArea when no room is active */}
        <div className={`h-full flex-1 ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}>
          <ChatArea
            room={currentActiveRoom}
            messages={currentMessages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onSendVoiceNote={handleSendVoiceNote}
            onStartVoiceCall={handleStartVoiceCall}
            onOpenSecurityModal={() => setShowSecurityModal(true)}
            onOpenMediaViewer={(att) => setViewingAttachment(att)}
            onBackMobile={() => setActiveRoomId('')}
          />
        </div>
      </div>

      {/* User Directory Modal */}
      <UserDirectoryModal
        isOpen={showUserDirectory}
        onClose={() => setShowUserDirectory(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUserFromDirectory}
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
    </div>
  );
}
