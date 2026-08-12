
// IndexedDB Utility for BYG CHAT - Offline Persistence
import { Message } from '../types';

const DB_NAME = 'byg_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'messages_cache';

export const initLocalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('roomId', 'roomId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveMessageLocally = async (message: Message) => {
  const db = await initLocalDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(message);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getMessagesLocally = async (roomId: string): Promise<Message[]> => {
  const db = await initLocalDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('roomId');
    const request = index.getAll(IDBKeyRange.only(roomId));

    request.onsuccess = () => {
      const msgs = request.result as Message[];
      // Sort by timestamp
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      resolve(msgs);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteMessageLocally = async (messageId: string) => {
  const db = await initLocalDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(messageId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
