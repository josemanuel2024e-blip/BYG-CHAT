import React, { useState } from 'react';
import { Shield, Lock, Key, Copy, Check, RefreshCw, X, FileCode, CheckCircle2, Database } from 'lucide-react';
import { KeyVaultInfo } from '../types';
import { SUPABASE_SQL_SCHEMA, isSupabaseConfigured } from '../lib/supabase';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultInfo: KeyVaultInfo | null;
  onRegenerateKeys: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  vaultInfo,
  onRegenerateKeys,
}) => {
  const [copied, setCopied] = useState(false);
  const [verifyFingerprintInput, setVerifyFingerprintInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<'success' | 'fail' | null>(null);

  if (!isOpen || !vaultInfo) return null;

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(vaultInfo.fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = verifyFingerprintInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanVault = vaultInfo.fingerprint.replace(/[^A-Z0-9]/g, '');

    if (cleanInput.length > 5 && cleanVault.includes(cleanInput)) {
      setVerificationResult('success');
    } else {
      setVerificationResult('fail');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-[#111111] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-[#161616] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Bóveda de Cifrado E2EE</h3>
              <p className="text-xs text-zinc-400">Seguridad criptográfica de BYG CHAT</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#222222] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status card */}
          <div className="p-4 rounded-2xl bg-[#161616] border border-zinc-800 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-300">Cifrado de Extremo a Extremo Activo</p>
              <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                Tus conversaciones, llamadas de voz y archivos multimedia están protegidos con la API nativa <span className="font-mono text-blue-400">WebCrypto (AES-256-GCM)</span>. Ningún intermediario ni servidor puede descifrar el contenido.
              </p>
            </div>
          </div>

          {/* SHA-256 Fingerprint */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Huella Digital SHA-256 (Fingerprint)</span>
              <span className="text-blue-400 font-mono text-[10px]">{vaultInfo.algorithm}</span>
            </label>

            <div className="p-3 bg-[#0a0a0a] border border-zinc-800 rounded-2xl flex items-center justify-between font-mono text-xs text-blue-400 break-all">
              <span>{vaultInfo.fingerprint}</span>
              <button
                onClick={handleCopyFingerprint}
                className="ml-3 p-2 bg-[#222222] hover:bg-[#2a2a2a] text-zinc-200 rounded-xl transition-colors shrink-0 flex items-center space-x-1"
                title="Copiar Huella"
              >
                {copied ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
                <span className="text-[11px]">{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Peer Fingerprint Verification Form */}
          <div className="p-4 bg-[#161616] border border-zinc-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Verificar Huella de Contacto</span>
            </h4>

            <form onSubmit={handleVerify} className="flex space-x-2">
              <input
                type="text"
                placeholder="Pega la huella del contacto (ej. A89F:44E1...)"
                value={verifyFingerprintInput}
                onChange={(e) => setVerifyFingerprintInput(e.target.value)}
                className="flex-1 bg-[#0a0a0a] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0"
              >
                Verificar
              </button>
            </form>

            {verificationResult === 'success' && (
              <div className="flex items-center space-x-2 text-xs text-green-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Huella verificada! El canal de transmisión es seguro.</span>
              </div>
            )}
            {verificationResult === 'fail' && (
              <div className="text-xs text-rose-400 font-medium">
                ⚠️ La huella no coincide con la llave pública actual.
              </div>
            )}
          </div>

          {/* Supabase Database Info & SQL Schema */}
          <div className="space-y-2 p-4 bg-[#161616] border border-zinc-800 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <Database className="w-4 h-4" />
                <span>Base de Datos Supabase</span>
              </label>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                {isSupabaseConfigured ? '🟢 Conectado' : '⚪ Esperando URL / Key en Secrets'}
              </span>
            </div>

            <p className="text-xs text-zinc-400">
              Usa este script SQL en el SQL Editor de tu proyecto Supabase para crear las tablas <code className="text-emerald-400 font-mono">users</code>, <code className="text-emerald-400 font-mono">rooms</code> y <code className="text-emerald-400 font-mono">messages</code>:
            </p>

            <div className="relative">
              <pre className="p-3 bg-[#0a0a0a] border border-zinc-800 rounded-xl text-[10px] font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap max-h-36">
                {SUPABASE_SQL_SCHEMA}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                  alert('¡Script SQL de Supabase copiado al portapapeles!');
                }}
                className="absolute top-2 right-2 p-1.5 bg-[#222] hover:bg-[#333] text-zinc-300 rounded-lg text-[10px] font-bold flex items-center space-x-1 border border-zinc-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar SQL</span>
              </button>
            </div>
          </div>

          {/* Public Key Pem View */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Llave Pública RSA Pem</span>
            </label>
            <pre className="p-3 bg-[#0a0a0a] border border-zinc-800 rounded-2xl text-[10px] font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap max-h-28">
              {vaultInfo.publicKeyPem}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#161616] border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={onRegenerateKeys}
            className="flex items-center space-x-2 px-4 py-2 bg-[#222222] hover:bg-[#2a2a2a] text-amber-300 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerar Llaves</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

