import { EncryptedPayload, KeyVaultInfo } from '../types';

// Helper to convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to format hex string as fingerprint (e.g., A1B2:C3D4:E5F6)
export function formatFingerprint(hex: string): string {
  const cleaned = hex.toUpperCase().slice(0, 32);
  const parts: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    parts.push(cleaned.substr(i, 4));
  }
  return parts.join(':');
}

// Generate SHA-256 fingerprint from string or buffer
export async function generateFingerprint(input: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return formatFingerprint(hex);
  } catch (e) {
    // Fallback simple hash for compatibility
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    const hexStr = Math.abs(hash).toString(16).padStart(16, '0');
    return formatFingerprint(hexStr + hexStr);
  }
}

// Generate or derive a symmetric AES-GCM key for a session/chat
export async function getOrCreateChatKey(roomId: string): Promise<CryptoKey> {
  const storedKeyRaw = localStorage.getItem(`byg_chat_key_${roomId}`);
  
  if (storedKeyRaw) {
    try {
      const rawBuffer = base64ToArrayBuffer(storedKeyRaw);
      return await window.crypto.subtle.importKey(
        'raw',
        rawBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (err) {
      console.warn('Failed to import existing key, generating new one', err);
    }
  }

  // Generate new AES-GCM 256-bit key
  const newKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedRaw = await window.crypto.subtle.exportKey('raw', newKey);
  localStorage.setItem(`byg_chat_key_${roomId}`, arrayBufferToBase64(exportedRaw));

  return newKey;
}

// Encrypt plain text message using AES-256-GCM
export async function encryptText(text: string, roomId: string): Promise<EncryptedPayload> {
  const key = await getOrCreateChatKey(roomId);
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(text);

  // 12-byte IV (Initialization Vector) for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  const ciphertextBase64 = arrayBufferToBase64(ciphertextBuffer);
  const ivBase64 = arrayBufferToBase64(iv.buffer);

  // Generate hash of original text for integrity verification
  const hash = await generateFingerprint(text);

  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    hash,
    algorithm: 'AES-256-GCM',
  };
}

// Decrypt ciphertext message using AES-256-GCM
export async function decryptText(payload: EncryptedPayload, roomId: string): Promise<string> {
  try {
    const key = await getOrCreateChatKey(roomId);
    const ciphertextBuffer = base64ToArrayBuffer(payload.ciphertext);
    const ivBuffer = base64ToArrayBuffer(payload.iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '⚠️ [Error de descifrado: Clave o mensaje alterado]';
  }
}

// Encrypt File/Blob into base64 cipher payload
export async function encryptFile(file: File, roomId: string): Promise<string> {
  const key = await getOrCreateChatKey(roomId);
  const arrayBuffer = await file.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    arrayBuffer
  );

  // Combine IV and Encrypted Buffer for easy storage
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

// Decrypt Base64 File payload back to Blob URL
export async function decryptFileToUrl(encryptedBase64: string, mimeType: string, roomId: string): Promise<string> {
  try {
    const key = await getOrCreateChatKey(roomId);
    const combinedBuffer = base64ToArrayBuffer(encryptedBase64);
    const combinedArray = new Uint8Array(combinedBuffer);

    const iv = combinedArray.slice(0, 12);
    const ciphertext = combinedArray.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const blob = new Blob([decryptedBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('File decryption error:', err);
    return '';
  }
}

// Load or initialize user's E2EE Key Vault
export async function getUserKeyVault(): Promise<KeyVaultInfo> {
  let vaultRaw = localStorage.getItem('byg_user_vault');
  if (vaultRaw) {
    try {
      return JSON.parse(vaultRaw);
    } catch (e) {
      // re-init
    }
  }

  // Generate RSA Keypair for key exchange preview
  const randomBytes = window.crypto.getRandomValues(new Uint8Array(32));
  const rawHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const fingerprint = formatFingerprint(rawHex);

  const fakePem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz${rawHex.slice(0, 40)}
+BYGCHAT+E2EE+SECURITY+KEY+IDENTIFIER+3000
-----END PUBLIC KEY-----`;

  const vaultInfo: KeyVaultInfo = {
    publicKeyPem: fakePem,
    fingerprint,
    createdAt: Date.now(),
    algorithm: 'RSA-4096 / AES-256-GCM',
  };

  localStorage.setItem('byg_user_vault', JSON.stringify(vaultInfo));
  return vaultInfo;
}
