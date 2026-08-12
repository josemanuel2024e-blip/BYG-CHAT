import React, { useState } from 'react';
import { X, Users, ShieldCheck, Plus } from 'lucide-react';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (groupName: string) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose, onCreateGroup }) => {
  const [groupName, setGroupName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onCreateGroup(groupName.trim());
    setGroupName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#111111] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2 text-white font-bold text-lg">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Crear Nuevo Grupo</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-[#222222] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Nombre del Grupo
            </label>
            <input
              type="text"
              placeholder="Ej. Equipo de Proyecto"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="p-3 bg-[#161616] border border-zinc-800 rounded-2xl text-xs text-zinc-300 flex items-start space-x-2">
            <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Los grupos te permiten chatear con múltiples participantes en tiempo real.
            </span>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-[#222222] hover:bg-[#2a2a2a] text-zinc-300 rounded-xl text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!groupName.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Grupo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

