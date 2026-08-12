import React, { useState, useRef, useEffect } from 'react';
import { Phone, Shield, Lock, Send, Paperclip, Mic, Play, Pause, FileText, CheckCheck, Eye, EyeOff, Info, ChevronLeft, Hash } from 'lucide-react';
import { Message, Room, Attachment, User } from '../types';
import { VoiceRecorder } from './VoiceRecorder';
import { MediaUploader } from './MediaUploader';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';

interface ChatAreaProps {
  room: Room | null;
  messages: Message[];
  currentUser: User;
  onSendMessage: (text: string, attachment?: Attachment) => void;
  onSendVoiceNote: (audioBlob: Blob, duration: number) => void;
  onStartVoiceCall: () => void;
  onOpenSecurityModal: () => void;
  onOpenMediaViewer: (attachment: Attachment) => void;
  onBackMobile?: () => void;
  onViewUserProfile?: (userId: string, name: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  room,
  messages,
  currentUser,
  onSendMessage,
  onSendVoiceNote,
  onStartVoiceCall,
  onOpenSecurityModal,
  onOpenMediaViewer,
  onBackMobile,
  onViewUserProfile,
}) => {
  const [textInput, setTextInput] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [rawCipherMap, setRawCipherMap] = useState<Record<string, boolean>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setTextInput('');
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
    onSendMessage(`📎 Archivo adjunto: ${attachment.name}`, attachment);
  };

  return (
    <main className="flex-1 bg-[#111111] border-b sm:border border-zinc-800 sm:rounded-3xl flex flex-col h-full relative overflow-hidden shadow-2xl">
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
              <h2 className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs">{room.name}</h2>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span className="text-zinc-400">En línea</span>
                {room.type === 'direct' && (
                  <span className="font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-md font-bold inline-flex items-center space-x-0.5">
                    <Hash className="w-2.5 h-2.5" />
                    <span>XAON: {formatXaonDisplay(undefined, room.id)}</span>
                  </span>
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
                  {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-200 inline" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Toolbar - WhatsApp Style Dynamic Mic / Send */}
      <div className="p-2.5 sm:p-4 bg-[#161616] border-t border-zinc-800 shrink-0">
        {isRecordingVoice ? (
          <VoiceRecorder
            onSendVoiceNote={(blob, duration) => {
              setIsRecordingVoice(false);
              onSendVoiceNote(blob, duration);
            }}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSend} className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              className="p-2.5 rounded-2xl bg-[#222222] hover:bg-[#2a2a2a] border border-zinc-800 text-zinc-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shrink-0"
              title="Adjuntar archivo multimedia cifrado"
            >
              <Paperclip className="w-5 h-5 text-blue-400" />
            </button>

            <input
              type="text"
              placeholder="Escribe un mensaje cifrado..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
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
          onSelectFile={handleMediaSelected}
          onCancel={() => setShowUploader(false)}
        />
      )}
    </main>
  );
};

