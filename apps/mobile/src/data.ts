// חיבור הממשק לשכבת הנתונים. הקובץ היחיד בממשק שמאתחל את @pulse/db.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { initDb } from '@pulse/db';

const secure = {
  getItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  setItem: (k: string, v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  removeItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

export function setupData(): void {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return; // מצב תצוגה בלבד, בלי שרת
  initDb({ url, anonKey, storage: secure });
}

export const hasBackend = () => Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL);

export * as api from '@pulse/db';
