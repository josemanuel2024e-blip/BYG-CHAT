import React, { useState, useEffect } from 'react';
import { Lock, Delete, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LockScreenProps {
  onUnlock: () => void;
  savedPin: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, savedPin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === savedPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setPin(''), 500);
      }
    }
  }, [pin, savedPin, onUnlock]);

  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

  return (
    <div className="fixed inset-0 z-[9999] bg-[#080808] flex flex-col items-center justify-center p-6 select-none">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xs w-full flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-8">
          <Lock className="w-8 h-8 text-blue-400" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Aplicación Bloqueada</h1>
        <p className="text-zinc-500 text-sm mb-12 text-center">Introduce tu PIN de seguridad para continuar</p>

        {/* PIN Indicators */}
        <div className={`flex space-x-6 mb-16 ${error ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > i 
                  ? 'bg-blue-400 scale-125 shadow-[0_0_15px_rgba(96,165,250,0.5)]' 
                  : 'bg-zinc-800'
              } ${error ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : ''}`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-6 w-full">
          {numpad.map((val, idx) => {
            if (val === '') return <div key={idx} />;
            if (val === 'delete') {
              return (
                <button
                  key={idx}
                  onClick={handleDelete}
                  className="w-full aspect-square flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <Delete className="w-6 h-6" />
                </button>
              );
            }
            return (
              <button
                key={idx}
                onClick={() => handleKeyPress(val)}
                className="w-full aspect-square bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-center text-2xl font-medium text-white hover:bg-zinc-800 active:scale-95 transition-all"
              >
                {val}
              </button>
            );
          })}
        </div>

      </motion.div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};
