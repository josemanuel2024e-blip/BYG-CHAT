export type UserStatus = 'online' | 'offline' | 'busy' | 'calling';

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: UserStatus;
  xaonId: string;
  publicKeyPem?: string;
  fingerprint: string;
  bio?: string;
  lastSeen?: string;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'document';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  size: number;
  url: string;
  mimeType: string;
  encryptedData?: string; // Base64 cipher if encrypted file
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  hash: string;
  algorithm: string; // e.g. 'AES-256-GCM'
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string; // user ID or room ID
  roomId?: string; // Room context for local storage
  text: string;
  encryptedPayload: EncryptedPayload;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  attachment?: Attachment;
  isVoiceNote?: boolean;
  audioDuration?: number; // seconds
}

export interface Room {
  id: string;
  name: string;
  type: 'direct' | 'group';
  participants: string[];
  unreadCount: number;
  lastMessage?: Message;
  isEncrypted: boolean;
  fingerprint: string;
  avatar?: string;
}

export interface CallState {
  active: boolean;
  callId: string | null;
  peerId: string | null;
  peerName: string;
  peerAvatar: string;
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';
  isMuted: boolean;
  isSpeaker: boolean;
  startTime: number | null;
  audioLevel: number;
  isVoiceOnly: boolean;
}

export interface KeyVaultInfo {
  publicKeyPem: string;
  fingerprint: string;
  createdAt: number;
  algorithm: string;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'amoled';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  appPin?: string;
}
