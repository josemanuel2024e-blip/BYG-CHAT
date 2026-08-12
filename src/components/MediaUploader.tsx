import React, { useRef, useState } from 'react';
import { Upload, X, ShieldCheck, Lock, FileText } from 'lucide-react';
import { Attachment, AttachmentType } from '../types';

interface MediaUploaderProps {
  onSelectFile: (attachment: Attachment, rawFile: File) => void;
  onCancel: () => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ onSelectFile, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<AttachmentType>('document');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      // Determine attachment type
      let type: AttachmentType = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      setFileType(type);

      // Generate local preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleConfirmSend = () => {
    if (!selectedFile || !previewUrl) return;

    const attachment: Attachment = {
      id: 'att_' + Date.now(),
      type: fileType,
      name: selectedFile.name,
      size: selectedFile.size,
      url: previewUrl,
      mimeType: selectedFile.type,
    };

    onSelectFile(attachment, selectedFile);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2 text-white font-bold text-lg">
            <Upload className="w-5 h-5 text-blue-400" />
            <span>Compartir Multimedia Cifrado</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-[#222222] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#161616] group"
          >
            <div className="p-4 rounded-full bg-[#222222] group-hover:bg-blue-500/10 text-blue-400 mb-3 transition-colors">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-zinc-200">
              Haz clic para seleccionar un archivo
            </p>
            <p className="text-xs text-zinc-400 mt-1">Imágenes, Vídeos o Documentos</p>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Box */}
            <div className="relative rounded-2xl overflow-hidden bg-[#0a0a0a] border border-zinc-800 flex items-center justify-center min-h-[160px] max-h-[260px]">
              {fileType === 'image' && previewUrl && (
                <img src={previewUrl} alt="Preview" className="max-h-[240px] w-auto object-contain rounded-xl" />
              )}
              {fileType === 'video' && previewUrl && (
                <video src={previewUrl} controls className="max-h-[240px] w-full rounded-xl" />
              )}
              {fileType === 'document' && (
                <div className="p-6 flex flex-col items-center text-center space-y-2">
                  <FileText className="w-12 h-12 text-blue-400" />
                  <p className="text-sm font-bold text-white max-w-xs truncate">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-400">{formatFileSize(selectedFile.size)}</p>
                </div>
              )}
            </div>

            {/* E2EE File encryption info badge */}
            <div className="p-3 rounded-xl bg-[#161616] border border-zinc-800 text-blue-300 text-xs flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>El archivo se cifrará con AES-256-GCM antes de ser transmitido.</span>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="flex-1 py-2.5 bg-[#222222] hover:bg-[#2a2a2a] text-zinc-300 rounded-xl text-xs font-semibold transition-all"
              >
                Cambiar Archivo
              </button>

              <button
                onClick={handleConfirmSend}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enviar Cifrado</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

