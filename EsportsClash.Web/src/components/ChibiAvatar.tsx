import React from 'react';

interface ChibiAvatarProps {
  avatarType: string;
  className?: string;
  size?: number;
}

export const ChibiAvatar: React.FC<ChibiAvatarProps> = ({ avatarType, className = '', size = 80 }) => {
  // Generate distinct stylized chibi heads based on avatarType
  const getAvatarConfig = () => {
    switch (avatarType) {
      case 'faker':
        return {
          hair: '#1e293b',
          skin: '#ffdfba',
          glasses: true,
          headband: false,
          headset: false,
          pose: 'thumbs-up',
          expression: 'cool',
          accent: '#dc2626'
        };
      case 'caps':
        return {
          hair: '#e2e8f0',
          skin: '#ffdfba',
          glasses: false,
          headband: false,
          headset: true,
          pose: 'coin-flip',
          expression: 'smug',
          accent: '#f59e0b'
        };
      case 'deft':
        return {
          hair: '#334155',
          skin: '#ffe0bd',
          glasses: true,
          headband: false,
          headset: false,
          pose: 'alpaca-smile',
          expression: 'gentle',
          accent: '#3b82f6'
        };
      case 's1mple':
        return {
          hair: '#b45309',
          skin: '#ffdfba',
          glasses: false,
          headband: false,
          headset: true,
          pose: 'one-tap',
          expression: 'intense',
          accent: '#eab308'
        };
      case 'niko':
        return {
          hair: '#18181b',
          skin: '#ffdfba',
          glasses: false,
          headband: true,
          headset: true,
          pose: 'cat-hoodie',
          expression: 'serious',
          accent: '#ef4444'
        };
      case 'zywoo':
        return {
          hair: '#475569',
          skin: '#ffdfba',
          glasses: false,
          headband: false,
          headset: false,
          pose: 'peace',
          expression: 'smiling',
          accent: '#10b981'
        };
      case 'miracle':
        return {
          hair: '#0f172a',
          skin: '#ffd1a4',
          glasses: false,
          headband: false,
          headset: true,
          pose: 'shadow',
          expression: 'calm',
          accent: '#8b5cf6'
        };
      case 'tenz':
        return {
          hair: '#111827',
          skin: '#ffdfba',
          glasses: true,
          headband: false,
          headset: true,
          pose: 'aimlab',
          expression: 'happy',
          accent: '#06b6d4'
        };
      case 'fns':
        return {
          hair: '#1e293b',
          skin: '#deb887',
          glasses: true,
          headband: false,
          headset: true,
          pose: 'galaxy-brain',
          expression: 'wise',
          accent: '#6366f1'
        };
      case 'boaster':
        return {
          hair: '#f59e0b',
          skin: '#ffdfba',
          glasses: false,
          headband: false,
          headset: true,
          pose: 'dance',
          expression: 'joyful',
          accent: '#f97316'
        };
      default:
        return {
          hair: '#475569',
          skin: '#ffdfba',
          glasses: false,
          headband: false,
          headset: false,
          pose: 'normal',
          expression: 'determined',
          accent: '#64748b'
        };
    }
  };

  const cfg = getAvatarConfig();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`rounded-full shadow-inner ${className}`}
    >
      {/* Background Glow Ring */}
      <circle cx="50" cy="50" r="48" fill="#0f172a" stroke={cfg.accent} strokeWidth="3" />

      {/* Chibi Head */}
      <ellipse cx="50" cy="52" rx="30" ry="28" fill={cfg.skin} />

      {/* Hair */}
      <path
        d="M 20 45 C 18 20, 82 20, 80 45 C 75 35, 60 30, 50 34 C 40 30, 25 35, 20 45 Z"
        fill={cfg.hair}
      />

      {/* Headband if active */}
      {cfg.headband && (
        <rect x="22" y="36" width="56" height="8" rx="2" fill={cfg.accent} />
      )}

      {/* Eyes */}
      {cfg.expression === 'intense' ? (
        <>
          <polygon points="34,48 44,52 36,54" fill="#0f172a" />
          <polygon points="66,48 56,52 64,54" fill="#0f172a" />
        </>
      ) : cfg.expression === 'joyful' || cfg.expression === 'smiling' ? (
        <>
          <path d="M 34 52 Q 40 46 46 52" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <path d="M 54 52 Q 60 46 66 52" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy="50" r="4.5" fill="#0f172a" />
          <circle cx="39" cy="48" r="1.5" fill="#ffffff" />
          <circle cx="62" cy="50" r="4.5" fill="#0f172a" />
          <circle cx="63" cy="48" r="1.5" fill="#ffffff" />
        </>
      )}

      {/* Glasses */}
      {cfg.glasses && (
        <g stroke="#1e293b" strokeWidth="2.5" fill="none">
          <circle cx="38" cy="50" r="7" />
          <circle cx="62" cy="50" r="7" />
          <line x1="45" y1="50" x2="55" y2="50" />
        </g>
      )}

      {/* Cute Blush */}
      <ellipse cx="30" cy="57" rx="4" ry="2" fill="#f87171" opacity="0.6" />
      <ellipse cx="70" cy="57" rx="4" ry="2" fill="#f87171" opacity="0.6" />

      {/* Mouth */}
      {cfg.expression === 'smug' ? (
        <path d="M 45 62 Q 54 66 56 60" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M 44 62 Q 50 67 56 62" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* Headset */}
      {cfg.headset && (
        <g>
          <path d="M 18 50 Q 50 15 82 50" fill="none" stroke="#334155" strokeWidth="4" />
          <rect x="15" y="42" width="7" height="16" rx="3" fill={cfg.accent} />
          <rect x="78" y="42" width="7" height="16" rx="3" fill={cfg.accent} />
        </g>
      )}

      {/* Jersey Collar */}
      <path d="M 32 75 L 50 82 L 68 75 L 75 95 L 25 95 Z" fill={cfg.accent} />
      <path d="M 44 80 L 50 86 L 56 80" fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
};

