import React, { useState, useRef, useEffect } from 'react';
import { Phone, Shield, Lock, Send, Paperclip, Mic, Play, Pause, FileText, CheckCheck, Eye, EyeOff, Info, ChevronLeft, Hash, Image, Video, Music, File, Trash2, SignalHigh, SignalMedium, SignalLow } from 'lucide-react';
import { Message, Room, Attachment, User, AttachmentType, CallState } from '../types';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaUploader } from './MediaUploader';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';
import { soundFx } from '../utils/audioEffects';

interface ChatAreaProps {
  room: Room | null;
  messages: Message[];
  currentUser: User;
  callState: CallState;
  onSendMessage: (text: string, attachment?: Attachment) => void;
  onSendVoiceNote: (audioBlob: Blob, duration: number) => void;
  onStartVoiceCall: () => void;
  onOpenSecurityModal: () => void;
  onOpenMediaViewer: (attachment: Attachment) => void;
  onBackMobile?: () => void;
  onViewUserProfile?: (userId: string, name: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  className?: string;
  typingUsers?: string[];
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  room,
  messages,
  currentUser,
  callState,
  onSendMessage,
  onSendVoiceNote,
  onStartVoiceCall,
  onOpenSecurityModal,
  onOpenMediaViewer,
  onBackMobile,
  onViewUserProfile,
  onDeleteMessage,
  className = '',
  typingUsers = [],
  onTypingStart,
  onTypingStop,
}) => {
  const [textInput, setTextInput] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [uploaderType, setUploaderType] = useState<AttachmentType | undefined>(undefined);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [rawCipherMap, setRawCipherMap] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  if (!room) {
    return (
      <div className="flex-1 bg-[#111111] border border-zinc-800 sm:rounded-3xl flex flex-col items-center justify-center p-8 text-center text-zinc-400 shadow-2xl">
        <div className="p-6 rounded-3xl bg-[#161616] border border-zinc-800 shadow-xl mb-4">
          <Shield className="w-12 h-12 text-blue-400 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">BYG CHAT</h3>
        <p className="text-xs text-zinc-400 max-w-sm">
          Selecciona un chat en la barra lateral para comenzar a enviar mensajes.
        </p>
      </div>
    );
  }

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;

    onSendMessage(textInput.trim());
    soundFx.playMessageSend();
    setTextInput('');
    
    if (isTypingRef.current && onTypingStop) {
      isTypingRef.current = false;
      onTypingStop();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);

    if (!isTypingRef.current && e.target.value.trim() && onTypingStart) {
      isTypingRef.current = true;
      onTypingStart();
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current && onTypingStop) {
        isTypingRef.current = false;
        onTypingStop();
      }
    }, 3000);
  };

  const toggleRawCipher = (msgId: string) => {
    setRawCipherMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleToggleAudioNote = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioElementsRef.current[msgId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioElementsRef.current[playingAudioId]) {
        audioElementsRef.current[playingAudioId].pause();
      }

      if (!audioElementsRef.current[msgId]) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingAudioId(null);
        audioElementsRef.current[msgId] = audio;
      }

      audioElementsRef.current[msgId].play();
      setPlayingAudioId(msgId);
    }
  };

  const handleMediaSelected = (attachment: Attachment, rawFile: File) => {
    setShowUploader(false);
    setUploaderType(undefined);
    onSendMessage(`📎 Archivo adjunto: ${attachment.name}`, attachment);
  };

  const openUploader = (type?: AttachmentType) => {
    setUploaderType(type);
    setShowUploader(true);
    setShowAttachMenu(false);
  };

  const attachOptions = [
    { id: 'image', label: 'Fotos', icon: Image, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'video', label: 'Videos', icon: Video, color: 'text-red-400', bg: 'bg-red-500/10' },
    { id: 'audio', label: 'Música', icon: Music, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'document', label: 'Documentos', icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <main className={`flex-1 bg-[#111111] flex flex-col h-full relative overflow-hidden shadow-2xl ${className}`}>
      {/* Top Bar Header */}
      <div className="px-3 sm:px-6 py-2.5 bg-[#161616] border-b border-zinc-800/80 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center space-x-2 sm:space-x-3.5 min-w-0">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-2 hover:bg-[#222222] text-blue-400 rounded-2xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shrink-0"
              title="Volver a chats"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <div
            onClick={() => {
              if (onViewUserProfile && room.type === 'direct') {
                onViewUserProfile(room.id, room.name);
              }
            }}
            className={`flex items-center space-x-2.5 min-w-0 ${
              room.type === 'direct' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            title={room.type === 'direct' ? 'Haz clic para ver el perfil' : ''}
          >
            <Avatar
              src={room.avatar || (room.type === 'group' ? '👥' : '💬')}
              name={room.name}
              size="sm"
              status="online"
              showStatus
            />

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs">{room.name}</h2>
                {typingUsers.length > 0 && (
                  <span className="text-[10px] text-blue-400 font-bold animate-pulse whitespace-nowrap">
                    escribiendo...
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 text-[10px]">
                {typingUsers.length > 0 ? (
                  <span className="text-blue-400 font-medium truncate">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está' : 'están'} escribiendo...
                  </span>
                ) : (
                  <>
                    <span className="text-zinc-400">En línea</span>
                    {room.type === 'direct' && (
                      <span className="font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-md font-bold inline-flex items-center space-x-0.5">
                        <Hash className="w-2.5 h-2.5" />
                        <span>XAON: {formatXaonDisplay(undefined, room.id)}</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <button
            onClick={onStartVoiceCall}
            className="p-2 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-semibold transition-all active:scale-95 flex items-center space-x-1.5 shadow-lg shadow-blue-600/20 min-h-[42px] min-w-[42px] justify-center"
            title="Llamada de voz"
          >
            <Phone className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Llamar</span>
          </button>
        </div>
      </div>

      {/* Connection Quality Indicator for active calls in the room */}
      {callState.active && callState.status === 'connected' && (
        <div className="mx-4 mt-2 flex items-center justify-between px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300 z-10">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
            <span className="text-xs font-bold text-blue-400">Llamada en curso</span>
          </div>
          
          <div className="flex items-center space-x-3">
             <div className="flex items-center space-x-1.5">
              {callState.signalQuality === 'stable' && (
                <>
                  <SignalHigh className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] font-bold text-green-400 uppercase">Estable</span>
                </>
              )}
              {callState.signalQuality === 'weak' && (
                <>
                  <SignalLow className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Débil</span>
                </>
              )}
              {callState.signalQuality === 'connecting' && (
                <>
                  <div className="w-2 h-2 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Conectando...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 group`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md p-4 rounded-3xl text-sm relative shadow-md ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-[#181818] border border-zinc-800 text-zinc-100 rounded-tl-none'
                }`}
              >
                {/* Voice Note Player */}
                {msg.isVoiceNote && msg.attachment ? (
                  <div className="flex items-center space-x-3 py-1 pr-2">
                    <button
                      onClick={() => handleToggleAudioNote(msg.id, msg.attachment!.url)}
                      className="p-3 bg-[#111111]/60 hover:bg-[#111111]/80 rounded-full text-blue-400 transition-colors shadow-inner"
                    >
                      {playingAudioId === msg.id ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-1 h-6">
                        {[12, 24, 18, 30, 16, 28, 10, 22, 28, 14, 20, 12, 25].map((h, idx) => (
                          <div
                            key={idx}
                            className={`w-1 rounded-full ${
                              playingAudioId === msg.id ? 'bg-blue-200 animate-pulse' : 'bg-zinc-500'
                            }`}
                            style={{ height: `${h}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono opacity-80 block">
                        Nota de Voz ({msg.audioDuration || 3}s)
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Standard Message / Attachment */
                  <div className="space-y-2">
                    {msg.attachment && (
                      <div
                        onClick={() => onOpenMediaViewer(msg.attachment!)}
                        className="cursor-pointer rounded-2xl overflow-hidden bg-[#111111]/80 border border-zinc-800 p-2 hover:border-blue-500/40 transition-colors"
                      >
                        {msg.attachment.type === 'image' && (
                          <img
                            src={msg.attachment.url}
                            alt="Adjunto"
                            className="max-h-48 w-full object-cover rounded-xl"
                          />
                        )}
                        {msg.attachment.type === 'video' && (
                          <video src={msg.attachment.url} className="max-h-48 w-full rounded-xl" />
                        )}
                        {msg.attachment.type === 'document' && (
                          <div className="flex items-center space-x-3 p-2">
                            <FileText className="w-8 h-8 text-blue-400" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{msg.attachment.name}</p>
                              <p className="text-[10px] text-zinc-400">
                                {(msg.attachment.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                )}

                {/* Footer details */}
                <div className="flex items-center justify-end space-x-1 mt-1 pt-0.5 text-[10px] opacity-80">
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isMe && (
                    <CheckCheck 
                      className={`w-3.5 h-3.5 inline ${msg.status === 'read' ? 'text-blue-400' : 'text-zinc-500'}`} 
                    />
                  )}
                  {isMe && onDeleteMessage && (
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar este mensaje?')) {
                          onDeleteMessage(msg.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all ml-1"
                      title="Eliminar mensaje"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Toolbar - WhatsApp Style Dynamic Mic / Send */}
      <div className="p-2.5 sm:p-4 bg-[#161616] border-t border-zinc-800 shrink-0 relative">
        {/* Attachment Sub-menu */}
        {showAttachMenu && (
          <div
            ref={menuRef}
            className="absolute bottom-20 left-4 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-2 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 z-30 min-w-[180px]"
          >
            <div className="grid grid-cols-1 gap-1">
              {attachOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => openUploader(opt.id as AttachmentType)}
                  className="flex items-center space-x-3 p-3 rounded-2xl hover:bg-[#222222] transition-all group"
                >
                  <div className={`p-2 rounded-xl ${opt.bg} ${opt.color} group-hover:scale-110 transition-transform`}>
                    <opt.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-300 group-hover:text-white">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isRecordingVoice ? (
          <VoiceRecorder
            onSendVoiceNote={(blob, duration) => {
              setIsRecordingVoice(false);
              onSendVoiceNote(blob, duration);
              soundFx.playMessageSend();
            }}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSend} className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`p-2.5 rounded-2xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shrink-0 ${
                showAttachMenu
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-[#222222] hover:bg-[#2a2a2a] border-zinc-800 text-blue-400'
              }`}
              title="Adjuntar archivo multimedia cifrado"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder="Escribe un mensaje cifrado..."
              value={textInput}
              onChange={handleInputChange}
              className="flex-1 bg-[#111111] border border-zinc-800 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors min-h-[44px]"
            />

            {textInput.trim() ? (
              <button
                type="submit"
                className="p-2.5 sm:p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
                title="Enviar mensaje"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2.5 sm:p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
                title="Grabar nota de voz"
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Media Uploader Modal */}
      {showUploader && (
        <MediaUploader
          initialType={uploaderType}
          onSelectFile={handleMediaSelected}
          onCancel={() => {
            setShowUploader(false);
            setUploaderType(undefined);
          }}
        />
      )}
    </main>
  );
};

