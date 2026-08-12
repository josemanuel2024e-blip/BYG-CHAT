import React from 'react';
import { X, Download, FileText, Lock, ShieldCheck } from 'lucide-react';
import { Attachment } from '../types';

interface MediaViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ attachment, onClose }) => {
  if (!attachment) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = attachment.url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-[#111111] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-[#161616] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm truncate max-w-md">{attachment.name}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-[#222222] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-[#0a0a0a] min-h-[300px]">
          {attachment.type === 'image' && (
            <img
              src={attachment.url}
              alt={attachment.name}
              className="max-h-[70vh] w-auto object-contain rounded-2xl shadow-xl border border-zinc-800"
            />
          )}

          {attachment.type === 'video' && (
            <video src={attachment.url} controls autoPlay className="max-h-[70vh] w-full rounded-2xl shadow-xl" />
          )}

          {attachment.type === 'audio' && (
            <div className="p-8 bg-[#111111] border border-zinc-800 rounded-2xl flex flex-col items-center space-y-4 text-center max-w-sm w-full">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white">{attachment.name}</p>
              <audio src={attachment.url} controls className="w-full" />
            </div>
          )}

          {attachment.type === 'document' && (
            <div className="p-12 bg-[#111111] border border-zinc-800 rounded-3xl flex flex-col items-center space-y-4 text-center max-w-md w-full">
              <FileText className="w-16 h-16 text-blue-400" />
              <p className="text-base font-bold text-white">{attachment.name}</p>
              <p className="text-xs text-zinc-400">Tamaño: {(attachment.size / 1024).toFixed(1)} KB</p>
              <p className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                🔒 Archivo verificado y desencriptado localmente
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

