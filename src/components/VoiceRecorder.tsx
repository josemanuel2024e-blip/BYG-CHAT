import React, { useState, useRef, useEffect } from 'react';
import { Square, Play, Pause, Trash2, Send, Volume2 } from 'lucide-react';

interface VoiceRecorderProps {
  onSendVoiceNote: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoiceNote,
  onCancel,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(10));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopAndCleanup();
    };
  }, []);

  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return ''; // fallback to browser default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalType = mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      };

      // Set up Web Audio API analyzer for real audio waveform level
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualizer fallback:', audioCtxErr);
      }

      mediaRecorder.start(100);
      setIsRecording(true);

      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Visualizer loop
      const updateVisualizer = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const sampled = Array.from(dataArray.slice(0, 20)).map((val) =>
            Math.max(8, (val / 255) * 40)
          );
          setAudioLevels(sampled);
        } else {
          // Animated pseudo waveform fallback if analyser not available
          const pseudo = Array.from({ length: 20 }, () => Math.floor(Math.random() * 25) + 8);
          setAudioLevels(pseudo);
        }
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.');
      onCancel();
    }
  };

  const stopAndCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    stopAndCleanup();
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendVoiceNote(audioBlob, recordingTime || 1);
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (!audioPlayerRef.current) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Audio play error:', err));
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="flex items-center justify-between w-full bg-[#181818] border border-zinc-800 rounded-2xl px-4 py-2.5 text-white shadow-lg animate-fade-in min-h-[48px]">
      {/* Left controls */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="p-2.5 rounded-full hover:bg-[#252525] text-rose-400 hover:text-rose-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Cancelar nota de voz"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          {isRecording ? (
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-xs font-mono font-bold text-blue-400">
            {formatTime(recordingTime)}
          </span>
        </div>
      </div>

      {/* Visualizer bars */}
      <div className="flex items-center space-x-1 mx-2 sm:mx-4 h-8 flex-1 justify-center max-w-xs overflow-hidden">
        {audioLevels.map((height, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              isRecording ? 'bg-blue-400 shadow-sm shadow-blue-400/50' : 'bg-zinc-600'
            }`}
            style={{ height: `${height}px` }}
          />
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <button
            type="button"
            onClick={handleStopRecording}
            className="flex items-center space-x-1 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold transition-all min-h-[44px]"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Detener</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={togglePlayback}
            className="p-2 bg-[#252525] hover:bg-[#303030] rounded-full text-blue-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Escuchar vista previa"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        )}

        {audioBlob && (
          <button
            type="button"
            onClick={handleSend}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar Cifrado</span>
          </button>
        )}
      </div>
    </div>
  );
};
