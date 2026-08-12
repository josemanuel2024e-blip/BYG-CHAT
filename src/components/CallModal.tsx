import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Activity, Hash, PhoneCall } from 'lucide-react';
import { CallState } from '../types';
import { Avatar } from './Avatar';
import { formatXaonDisplay } from '../utils/xaon';

interface CallModalProps {
  callState: CallState;
  onAcceptCall: () => void;
  onRejectCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
}) => {
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(12));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (callState.status === 'connected') {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      setupAudioVisualizer();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [callState.status]);

  const setupAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const draw = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const sampled = Array.from(dataArray.slice(0, 16)).map((val) =>
          Math.max(10, (val / 255) * 60)
        );
        setAudioLevels(sampled);

        animRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (err) {
      console.warn('Microphone visualization unavailable:', err);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  if (!callState.active && callState.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Background glow circle */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Security badge top bar */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-6">
          <PhoneOff className="w-3.5 h-3.5" />
          <span>Llamada de Voz</span>
        </div>

        {/* Avatar with pulsing halo */}
        <div className="relative mb-6">
          <Avatar
            src={callState.peerAvatar || '📞'}
            name={callState.peerName}
            size="xl"
          />

          {/* Pulse animation rings */}
          {(callState.status === 'calling' || callState.status === 'incoming') && (
            <>
              <div className="absolute inset-0 rounded-full bg-blue-600/20 animate-ping pointer-events-none" />
              <div className="absolute -inset-3 rounded-full border border-blue-500/40 animate-pulse pointer-events-none" />
            </>
          )}
        </div>

        {/* Name, XAON ID caller identification and status */}
        <h3 className="text-2xl font-extrabold text-white mb-1 tracking-tight">
          {callState.peerName}
        </h3>

        {/* XAON Caller ID Identifier */}
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 rounded-xl font-mono text-xs font-bold text-blue-400 mb-3">
          <Hash className="w-3.5 h-3.5" />
          <span>ID XAON: {formatXaonDisplay(undefined, callState.peerId || callState.peerName)}</span>
        </div>

        <div className="text-sm font-medium text-zinc-400 mb-6 flex items-center justify-center space-x-2">
          {callState.status === 'calling' && (
            <span className="text-amber-400 animate-pulse">Llamando...</span>
          )}
          {callState.status === 'incoming' && (
            <span className="text-blue-400 animate-bounce">Llamada entrante de voz</span>
          )}
          {callState.status === 'connected' && (
            <div className="flex items-center space-x-2 text-green-400 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
              <span>{formatDuration(duration)}</span>
            </div>
          )}
          {callState.status === 'ended' && (
            <span className="text-rose-400">Llamada finalizada</span>
          )}
        </div>

        {/* Real-time spectrum visualizer when connected */}
        {callState.status === 'connected' && (
          <div className="w-full bg-[#181818] border border-zinc-800 rounded-2xl p-4 mb-8 flex flex-col items-center">
            <div className="flex items-center space-x-1.5 text-xs text-zinc-400 mb-3">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Espectro de Voz Cifrada en Vivo</span>
            </div>
            <div className="flex items-end justify-center space-x-1.5 h-12 w-full">
              {audioLevels.map((val, idx) => (
                <div
                  key={idx}
                  className="w-2 bg-gradient-to-t from-blue-600 to-indigo-400 rounded-full transition-all duration-75 shadow-sm shadow-blue-400/30"
                  style={{ height: `${val}px` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {callState.status === 'incoming' ? (
          <div className="flex items-center justify-center space-x-6 w-full mt-4">
            <button
              onClick={onRejectCall}
              className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Rechazar</span>
            </button>
            <button
              onClick={onAcceptCall}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition-transform active:scale-95 animate-pulse"
            >
              <Volume2 className="w-5 h-5" />
              <span>Contestar</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-4 w-full mt-2">
            <button
              onClick={onToggleMute}
              className={`p-4 rounded-2xl border transition-all ${
                callState.isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-[#1e1e1e] hover:bg-[#252525] border-zinc-800 text-zinc-200'
              }`}
              title={callState.isMuted ? 'Dessilenciar' : 'Silenciar'}
            >
              {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={onEndCall}
              className="p-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-600/40 transition-transform active:scale-95"
              title="Colgar llamada"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            <button
              onClick={onToggleSpeaker}
              className={`p-4 rounded-2xl border transition-all ${
                callState.isSpeaker
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                  : 'bg-[#1e1e1e] hover:bg-[#252525] border-zinc-800 text-zinc-200'
              }`}
              title="Altavoz"
            >
              {callState.isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

