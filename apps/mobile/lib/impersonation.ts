import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Platform-admin "view as client" state. When set, useActiveMerchant resolves
 * to this merchant so the admin can operate the POS/Kiosk/KDS/Admin modes for
 * that client (allowed by the pa_all RLS policies). Persisted so it survives
 * reloads; cleared with `stop()`.
 */
interface ImpersonationState {
  merchantId: string | null;
  merchantName: string | null;
  hydrated: boolean;
  viewAs: (merchantId: string, merchantName: string) => void;
  stop: () => void;
  hydrate: () => Promise<void>;
}

const KEY = "squarely:impersonate";

export const useImpersonation = create<ImpersonationState>((set) => ({
  merchantId: null,
  merchantName: null,
  hydrated: false,
  viewAs: (merchantId, merchantName) => {
    AsyncStorage.setItem(KEY, JSON.stringify({ merchantId, merchantName }));
    set({ merchantId, merchantName });
  },
  stop: () => {
    AsyncStorage.removeItem(KEY);
    set({ merchantId: null, merchantName: null });
  },
  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(KEY);
      if (v) {
        const p = JSON.parse(v) as { merchantId: string; merchantName: string };
        set({ merchantId: p.merchantId, merchantName: p.merchantName, hydrated: true });
        return;
      }
    } catch {
      // ignore
    }
    set({ hydrated: true });
  },
}));
