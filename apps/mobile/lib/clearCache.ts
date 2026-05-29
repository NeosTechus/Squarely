import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Frees up the app's locally cached data without signing the user out.
 *
 * Removes non-essential AsyncStorage entries (the app's own `squarely:` keys
 * such as boot-mode, impersonation, and onboarding flags) while deliberately
 * preserving:
 *   - saved login credentials (`squarely:saved-credentials`)
 *   - the Supabase auth session (keys containing `supabase` / `sb-`)
 *
 * The in-memory react-query cache should be cleared separately by the caller
 * via `queryClient.clear()`. This is best-effort and never throws.
 */
const PRESERVE_EXACT = ["squarely:saved-credentials"];

function isAuthKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("supabase") || k.includes("sb-");
}

function shouldClear(key: string): boolean {
  if (!key.startsWith("squarely:")) return false;
  if (PRESERVE_EXACT.includes(key)) return false;
  if (isAuthKey(key)) return false;
  return true;
}

export async function clearAppCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(shouldClear);
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // best-effort — clearing cached data should never crash the app
  }
}
