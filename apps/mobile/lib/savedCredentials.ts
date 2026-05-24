import * as SecureStore from "expo-secure-store";

/**
 * Optional "Remember me" credential storage. Email + password are kept in the
 * device's encrypted keychain (SecureStore), never in plain AsyncStorage.
 */
const KEY = "squarely:saved-credentials";

export type SavedCredentials = { email: string; password: string };

export async function loadCredentials(): Promise<SavedCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCredentials;
    if (parsed?.email && parsed?.password) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: SavedCredentials): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(creds));
  } catch {
    // ignore — saving is best-effort
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
