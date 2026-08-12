import React from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  status?: 'online' | 'offline';
  showStatus?: boolean;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-base',
  md: 'w-11 h-11 text-xl',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-4xl',
};

const STATUS_SIZE_MAP = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

// Deterministic gradients for emoji avatars
const GRADIENTS = [
  'from-blue-600/30 to-indigo-600/30 border-blue-500/40 text-blue-200',
  'from-emerald-600/30 to-teal-600/30 border-emerald-500/40 text-emerald-200',
  'from-purple-600/30 to-pink-600/30 border-purple-500/40 text-purple-200',
  'from-amber-600/30 to-orange-600/30 border-amber-500/40 text-amber-200',
  'from-rose-600/30 to-red-600/30 border-rose-500/40 text-rose-200',
  'from-cyan-600/30 to-blue-600/30 border-cyan-500/40 text-cyan-200',
];

function getGradient(key: string = ''): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'U',
  size = 'md',
  className = '',
  status,
  showStatus = false,
}) => {
  const isImage = src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:'));
  const displayEmoji = !isImage && src ? src : name ? name.charAt(0).toUpperCase() : '😎';
  const gradientClass = getGradient(name || src || 'byg');

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`rounded-full flex items-center justify-center overflow-hidden border shadow-inner transition-transform ${
          SIZE_MAP[size]
        } ${
          isImage
            ? 'bg-[#181818] border-zinc-700'
            : `bg-gradient-to-br ${gradientClass}`
        }`}
        style={{
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
        }}
      >
        {isImage ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="select-none leading-none transform active:scale-110 transition-transform">
            {displayEmoji}
          </span>
        )}
      </div>

      {showStatus && status && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-[#111111] ${
            STATUS_SIZE_MAP[size]
          } ${status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'}`}
        />
      )}
    </div>
  );
};
